'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  type AdminOrder,
  type AvailableCouriersOrderDetails,
  type AvailableCouriersResponse,
  type CourierOption,
  getAdminOrder,
  getAvailableCouriersForOrder,
  type PickupWarehouseInfo,
  scheduleAdminOrderPickup,
} from '@/lib/api/admin';

interface SchedulePickupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: AdminOrder;
  adminToken: string;
  onPickupScheduled: (updatedOrder: AdminOrder) => void;
}

export default function SchedulePickupWizardModal({
  isOpen,
  onClose,
  order,
  adminToken,
  onPickupScheduled,
}: SchedulePickupWizardModalProps) {
  // Wizard step state (1: Courier Partner, 2: Pickup Date, 3: Package Specs, 4: Review & Confirm)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Data fetching state
  const [loadingCouriers, setLoadingCouriers] = useState<boolean>(true);
  const [courierError, setCourierError] = useState<string>('');
  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [warehouseInfo, setWarehouseInfo] = useState<PickupWarehouseInfo | null>(null);
  const [backendOrderDetails, setBackendOrderDetails] =
    useState<AvailableCouriersOrderDetails | null>(null);

  // Step 1 Filtering and Sorting state
  const [filterTab, setFilterTab] = useState<'all' | 'air' | 'surface'>('all');
  const [sortBy, setSortBy] = useState<'recommended' | 'cheapest' | 'fastest' | 'rating'>(
    'recommended'
  );

  // Form selections
  const [selectedCourierId, setSelectedCourierId] = useState<number | null>(null);
  const [pickupDate, setPickupDate] = useState<string>('');
  const [deadWeight, setDeadWeight] = useState<number>(0.5);
  const [length, setLength] = useState<number>(15);
  const [breadth, setBreadth] = useState<number>(15);
  const [height, setHeight] = useState<number>(5);

  // Mobile responsive UI states
  const [showMobileOrderDetails, setShowMobileOrderDetails] = useState<boolean>(false);
  const [activeRtoCourierId, setActiveRtoCourierId] = useState<number | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');

  // Calculate today and helper dates
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Fetch available couriers on open
  useEffect(() => {
    if (!isOpen || !order?.id || !adminToken) return;

    let mounted = true;
    setLoadingCouriers(true);
    setCourierError('');
    setCurrentStep(1);
    setShowMobileOrderDetails(false);
    setActiveRtoCourierId(null);

    getAvailableCouriersForOrder(adminToken, order.id)
      .then((res: AvailableCouriersResponse) => {
        if (!mounted) return;
        setCouriers(res.couriers || []);
        if (res.pickup_warehouse) {
          setWarehouseInfo(res.pickup_warehouse);
        }
        if (res.order_details) {
          setBackendOrderDetails(res.order_details);
        }

        // Initialize package details from stored dims or default 15x15x5
        if (res.stored_weight && res.stored_weight > 0) {
          setDeadWeight(res.stored_weight);
        }
        if (
          res.stored_dims?.length &&
          res.stored_dims?.breadth &&
          res.stored_dims?.height &&
          !(
            res.stored_dims.length === 31 &&
            res.stored_dims.breadth === 41 &&
            res.stored_dims.height === 2
          )
        ) {
          setLength(res.stored_dims.length);
          setBreadth(res.stored_dims.breadth);
          setHeight(res.stored_dims.height);
        }

        // Select recommended courier, current courier if matches, or first courier
        const recMatch = res.couriers.find((c) => c.is_recommended);
        const currentMatch = res.couriers.find((c) => c.is_current);
        if (recMatch) {
          setSelectedCourierId(recMatch.courier_company_id);
        } else if (currentMatch) {
          setSelectedCourierId(currentMatch.courier_company_id);
        } else if (res.couriers.length > 0) {
          setSelectedCourierId(res.couriers[0].courier_company_id);
        }
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const msg =
          err instanceof Error ? err.message : 'Failed to load available courier partners.';
        setCourierError(msg);
      })
      .finally(() => {
        if (mounted) setLoadingCouriers(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, order?.id, adminToken]);

  // Selected courier object
  const selectedCourier = useMemo(() => {
    return couriers.find((c) => c.courier_company_id === selectedCourierId) || null;
  }, [couriers, selectedCourierId]);

  // Allowed date range based on courier constraint
  const { maxDateStr, allowedDaysCount, isStrictTwoDays } = useMemo(() => {
    const daysWindow = selectedCourier?.pickup_days_window ?? 2;
    const isTwoDays = selectedCourier?.pickup_constraint === 'within_2_days' || daysWindow <= 2;

    const maxD = new Date();
    const daysToAdd = isTwoDays ? 1 : Math.max(daysWindow - 1, 1);
    maxD.setDate(maxD.getDate() + daysToAdd);
    const maxStr = maxD.toISOString().split('T')[0];

    return {
      maxDateStr: maxStr,
      allowedDaysCount: isTwoDays ? 2 : daysWindow,
      isStrictTwoDays: isTwoDays,
    };
  }, [selectedCourier]);

  // Auto-adjust pickup date when courier or allowed date range changes
  useEffect(() => {
    if (!pickupDate || pickupDate < todayStr) {
      setPickupDate(todayStr);
    } else if (pickupDate > maxDateStr) {
      // Clamped to allowed window automatically
      setPickupDate(maxDateStr);
    }
  }, [maxDateStr, pickupDate, todayStr]);

  // Calculations for package dimensions & weights
  const volumetricWeight = useMemo(() => {
    if (!length || !breadth || !height) return 0;
    return Number(((length * breadth * height) / 5000).toFixed(3));
  }, [length, breadth, height]);

  const billedWeight = useMemo(() => {
    return Number(Math.max(deadWeight, volumetricWeight).toFixed(3));
  }, [deadWeight, volumetricWeight]);

  // Filter & Sort Couriers
  const filteredAndSortedCouriers = useMemo(() => {
    let list = [...couriers];

    // Filter by Tab
    if (filterTab === 'air') {
      list = list.filter((c) => !c.is_surface);
    } else if (filterTab === 'surface') {
      list = list.filter((c) => c.is_surface);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'recommended') {
        if (a.is_recommended && !b.is_recommended) return -1;
        if (!a.is_recommended && b.is_recommended) return 1;
        const ratingDiff = (b.rating || 4.5) - (a.rating || 4.5);
        if (Math.abs(ratingDiff) > 0.01) return ratingDiff;
        return a.rate - b.rate;
      }
      if (sortBy === 'cheapest') {
        return a.rate - b.rate;
      }
      if (sortBy === 'fastest') {
        return (a.estimated_delivery_days || 99) - (b.estimated_delivery_days || 99);
      }
      if (sortBy === 'rating') {
        return (b.rating || 4.5) - (a.rating || 4.5);
      }
      return 0;
    });

    return list;
  }, [couriers, filterTab, sortBy]);

  // Helper date formatter
  const formatReadableDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-IN', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Helper expected delivery date string
  const getDeliveryDateString = (c: CourierOption) => {
    if (c.etd) {
      try {
        const d = new Date(c.etd);
        if (!Number.isNaN(d.getTime())) {
          return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }
      } catch {
        // fallback
      }
      return c.etd;
    }
    if (c.estimated_delivery_days) {
      const d = new Date();
      d.setDate(d.getDate() + c.estimated_delivery_days);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return '2-4 Days';
  };

  // Carrier initials for logo avatar fallback
  const getCarrierBadge = (name: string) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('amazon')) return { initials: 'AMZ', bg: '#ff9900', color: '#000000' };
    if (lower.includes('dtdc')) return { initials: 'DTDC', bg: '#003399', color: '#ffffff' };
    if (lower.includes('shadowfax')) return { initials: 'SF', bg: '#10b981', color: '#ffffff' };
    if (lower.includes('delhivery')) return { initials: 'DLV', bg: '#ef4444', color: '#ffffff' };
    if (lower.includes('xpressbees') || lower.includes('xpress bees'))
      return { initials: 'XB', bg: '#f59e0b', color: '#000000' };
    if (lower.includes('smartr')) return { initials: 'SMR', bg: '#6366f1', color: '#ffffff' };
    if (lower.includes('blue dart') || lower.includes('bluedart'))
      return { initials: 'BD', bg: '#dc2626', color: '#ffffff' };
    if (lower.includes('ecom express') || lower.includes('ecomexpress'))
      return { initials: 'ECE', bg: '#2563eb', color: '#ffffff' };
    return { initials: (name || 'EXP').slice(0, 3).toUpperCase(), bg: '#475569', color: '#ffffff' };
  };

  // Official carrier brand logo path
  const getCarrierLogo = (name: string, remoteUrl?: string): string => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('amazon')) return '/couriers/amazon.png';
    if (lower.includes('dtdc')) return '/couriers/dtdc.png';
    if (lower.includes('blue dart') || lower.includes('bluedart')) return '/couriers/bluedart.svg';
    if (lower.includes('delhivery')) return '/couriers/delhivery.png';
    if (lower.includes('xpressbees') || lower.includes('xpress bees'))
      return '/couriers/xpressbees.webp';
    if (lower.includes('shadowfax')) return '/couriers/shadowfax.svg';
    if (lower.includes('smartr')) return '/couriers/smartr.webp';
    if (lower.includes('ecom express') || lower.includes('ecomexpress'))
      return '/couriers/ecomexpress.svg';
    if (remoteUrl && !remoteUrl.includes('kr-shipmultichannel-mum/courier_logo/')) {
      return remoteUrl;
    }
    return '';
  };

  // Submit pickup scheduling
  const handleConfirmSchedule = async () => {
    if (!adminToken || !order?.id) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        pickup_date: pickupDate || todayStr,
        courier_id: selectedCourierId,
        weight: deadWeight,
        length: length,
        breadth: breadth,
        height: height,
      };

      const res = await scheduleAdminOrderPickup(adminToken, order.id, payload);

      if (res.success && res.pickup_status === 1) {
        toast.success(res.message || 'Pickup scheduled & shipment dispatched successfully!');
        // Refresh order details from backend to ensure status: SHIPPED is reflected
        const updated = await getAdminOrder(adminToken, order.id);
        onPickupScheduled(updated);
        onClose();
      } else {
        const msg = res.message || 'Courier partner rejected pickup scheduling request.';
        setSubmitError(msg);
        toast.error(msg);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to schedule pickup. Please check courier availability and package details.';
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Preset dimension choices
  const presets = [
    { label: 'Standard Polybag', w: 0.5, l: 31, b: 41, h: 2 },
    { label: 'Shoebox / Footwear', w: 1.0, l: 35, b: 25, h: 12 },
    { label: 'Outerwear / Heavy Box', w: 1.5, l: 45, b: 35, h: 10 },
  ];

  const shippingAddr = order.shipping_address || {};
  const customerName =
    backendOrderDetails?.customer_name ||
    order.user_name ||
    order.guest_name ||
    shippingAddr.name ||
    shippingAddr.fullName ||
    'Customer';
  const customerPhone =
    backendOrderDetails?.customer_phone || order.guest_phone || shippingAddr.phone || 'N/A';
  const customerEmail = order.user_email || order.guest_email || 'N/A';

  const pickupPincode =
    backendOrderDetails?.pickup_from.pincode || warehouseInfo?.pin_code || '110019';
  const pickupCity = backendOrderDetails?.pickup_from.city || warehouseInfo?.city || 'Delhi';

  const deliveryPincode =
    backendOrderDetails?.deliver_to.pincode ||
    shippingAddr.postalCode ||
    shippingAddr.pincode ||
    shippingAddr.pin_code ||
    '831003';
  const deliveryState =
    backendOrderDetails?.deliver_to.state ||
    shippingAddr.state ||
    shippingAddr.province ||
    shippingAddr.city ||
    'Jharkhand';

  const orderValue = backendOrderDetails?.order_value ?? order.total_amount ?? 0;
  const paymentMode =
    backendOrderDetails?.payment_mode ||
    (order.payment_method === 'COD' ? 'Cash on Delivery' : 'Prepaid');

  return (
    <>
      <style>{`
        /* ── SchedulePickupWizardModal Responsive Styles ── */
        .spwm-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.75);
          display: flex; align-items: center; justify-content: center;
          z-index: 1050; padding: 12px; backdrop-filter: blur(4px);
        }
        .spwm-modal {
          background: #ffffff; width: 100%; max-width: 1240px; height: 100%;
          max-height: 94vh; display: flex; flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35);
          border: 1px solid #cbd5e1; position: relative;
          border-radius: 8px; overflow: hidden;
        }

        /* Modal Header */
        .spwm-header {
          padding: 14px 22px;
          border-bottom: 1px solid #1e293b;
          background: #0f172a;
          color: #ffffff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }
        .spwm-header-info { min-width: 0; flex: 1; }
        .spwm-header-subtitle {
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #94a3b8;
          font-weight: 700;
        }
        .spwm-header-title {
          margin: 2px 0 0;
          font-size: 1.15rem;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #ffffff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .spwm-header-close {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 1.35rem;
          cursor: pointer;
          line-height: 1;
          padding: 6px 10px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .spwm-header-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }

        /* Step Progress Bar */
        .spwm-step-bar {
          display: flex;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
          overflow-x: auto;
          scrollbar-width: none;
          flex-shrink: 0;
        }
        .spwm-step-bar::-webkit-scrollbar { display: none; }
        .spwm-step-btn {
          flex: 1;
          min-width: 0;
          padding: 10px 8px;
          background: #f8fafc;
          border: none;
          border-bottom: 3px solid transparent;
          font-size: 0.74rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          cursor: default;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.15s ease;
          white-space: nowrap;
          color: #94a3b8;
          font-weight: 600;
        }
        .spwm-step-btn.completed {
          background: #f1f5f9;
          color: #0f172a;
          font-weight: 700;
          cursor: pointer;
        }
        .spwm-step-btn.active {
          background: #ffffff;
          border-bottom-color: #4f46e5;
          color: #4f46e5;
          font-weight: 800;
        }
        .spwm-step-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          font-size: 0.68rem;
          font-weight: 800;
          background: #e2e8f0;
          color: #475569;
          flex-shrink: 0;
        }
        .spwm-step-btn.active .spwm-step-num {
          background: #4f46e5;
          color: #ffffff;
        }
        .spwm-step-btn.completed .spwm-step-num {
          background: #10b981;
          color: #ffffff;
        }
        .spwm-step-label-desktop { display: inline; }
        .spwm-step-label-mobile { display: none; }

        /* Mobile Order Details Accordion (hidden on desktop) */
        .spwm-mobile-order-summary { display: none; }

        /* Sidebar + content layout */
        .spwm-body { display: flex; flex: 1; overflow: hidden; min-height: 0; }
        .spwm-sidebar {
          width: 215px; min-width: 215px; background: #f8fafc;
          border-right: 1px solid #e2e8f0; padding: 18px 16px;
          display: flex; flex-direction: column; gap: 16px;
          overflow-y: auto; flex-shrink: 0;
        }
        .spwm-content {
          flex: 1; min-width: 0; padding: 18px 24px;
          overflow-y: auto; overflow-x: hidden;
          background: #ffffff;
        }

        /* Desktop & Mobile visibility helpers */
        .spwm-desktop-only { display: block; }
        .spwm-mobile-only { display: none; }

        /* Courier table header */
        .spwm-courier-header {
          display: grid;
          grid-template-columns: minmax(190px, 2fr) 70px minmax(135px, 1.2fr) 95px 80px 95px;
          padding: 10px 14px; font-size: 0.74rem; font-weight: 700; color: #64748b;
          background: #f8fafc; align-items: center; gap: 10px;
          border-radius: 6px; box-sizing: border-box; margin-bottom: 8px;
        }

        /* Courier card row */
        .spwm-courier-row {
          display: grid;
          grid-template-columns: minmax(190px, 2fr) 70px minmax(135px, 1.2fr) 95px 80px 95px;
          align-items: center; gap: 10px;
        }
        .spwm-courier-col-details {
          display: contents;
        }
        .spwm-courier-col-identity { min-width: 0; }
        .spwm-courier-col-charges { text-align: right; }

        /* RTO pricing tooltip on hover / mobile tap */
        .spwm-rto-trigger {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .spwm-rto-icon {
          font-size: 0.72rem;
          color: #94a3b8;
          font-weight: 600;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s ease;
        }
        .spwm-rto-trigger:hover .spwm-rto-icon {
          color: #4f46e5;
        }
        .spwm-rto-tooltip {
          position: absolute;
          bottom: calc(100% + 8px);
          right: 0;
          background: #0f172a;
          color: #ffffff;
          padding: 8px 12px;
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          white-space: nowrap;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
          pointer-events: none;
          opacity: 0;
          visibility: hidden;
          transform: translateY(4px);
          transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
          z-index: 100;
        }
        .spwm-rto-trigger:hover .spwm-rto-tooltip,
        .spwm-rto-tooltip.spwm-rto-tooltip-open {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
        .spwm-rto-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          right: 5px;
          border-width: 5px;
          border-style: solid;
          border-color: #0f172a transparent transparent transparent;
        }
        .spwm-rto-tooltip-title {
          font-size: 0.62rem;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .spwm-rto-tooltip-amount {
          font-size: 0.88rem;
          font-weight: 800;
          color: #ffffff;
        }
        .spwm-rto-tooltip-sub {
          font-size: 0.60rem;
          font-weight: 500;
          color: #64748b;
        }

        /* Footer */
        .spwm-footer {
          padding: 14px 24px; border-top: 1px solid #e2e8f0;
          background: #ffffff; display: flex;
          justify-content: space-between; align-items: center; gap: 10px;
          flex-wrap: wrap; flex-shrink: 0;
        }
        .spwm-footer-left { display: flex; gap: 10px; }
        .spwm-footer-right { display: flex; gap: 10px; flex-wrap: wrap; }

        /* Step 1 Filter & Sort Controls */
        .spwm-filter-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .spwm-filter-tabs {
          display: flex;
          gap: 20px;
        }
        .spwm-sort-select {
          padding: 6px 12px;
          font-size: 0.82rem;
          font-weight: 600;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #ffffff;
          color: #1e293b;
          cursor: pointer;
        }
        .spwm-secured-banner {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .spwm-radar-banner {
          background: #faf8ff;
          border: 1px solid #e0e7ff;
          border-radius: 10px;
          padding: 14px 18px;
          margin-bottom: 16px;
        }

        /* Step 2 Date Controls */
        .spwm-quick-dates-grid {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .spwm-quick-date-btn {
          padding: 10px 14px;
          border-radius: 6px;
          font-weight: 800;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        /* Step 3 Package Presets & Form Inputs */
        .spwm-preset-group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .spwm-preset-btn {
          padding: 8px 14px;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          color: #334155;
          transition: all 0.15s ease;
        }
        .spwm-form-input {
          width: 100%;
          padding: 10px;
          font-size: 0.9rem;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-weight: 700;
          background: #ffffff;
          color: #0f172a;
          box-sizing: border-box;
        }
        .spwm-specs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }
        .spwm-weight-stats-grid {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
        }

        /* Step 4 Review Grid */
        .spwm-review-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        /* ── Tablet & Mobile Responsiveness (≤ 768px) ── */
        @media (max-width: 768px) {
          .spwm-overlay { padding: 0; align-items: flex-end; }
          .spwm-modal {
            max-width: 100%; width: 100%;
            max-height: 100dvh; height: 100dvh;
            border-radius: 0; border: none;
          }
          .spwm-header {
            padding: 10px 14px;
            gap: 8px;
          }
          .spwm-header-subtitle {
            font-size: 0.58rem;
            letter-spacing: 0.5px;
          }
          .spwm-header-title {
            font-size: 0.88rem;
            font-weight: 800;
          }
          .spwm-header-close {
            font-size: 1.15rem;
            padding: 4px 6px;
          }

          /* Step Bar on mobile */
          .spwm-step-bar {
            padding: 0 4px;
            background: #f8fafc;
          }
          .spwm-step-btn {
            padding: 8px 4px;
            font-size: 0.68rem;
            gap: 3px;
          }
          .spwm-step-num {
            width: 16px;
            height: 16px;
            font-size: 0.62rem;
          }
          .spwm-step-label-desktop { display: none; }
          .spwm-step-label-mobile { display: inline; font-size: 0.70rem; font-weight: 700; }

          /* Mobile Order Details Accordion */
          .spwm-mobile-order-summary {
            display: block;
            background: #f1f5f9;
            border-bottom: 1px solid #e2e8f0;
            flex-shrink: 0;
          }
          .spwm-mobile-order-toggle {
            width: 100%;
            padding: 7px 14px;
            background: transparent;
            border: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            font-size: 0.72rem;
            color: #334155;
            font-weight: 700;
          }
          .spwm-mobile-order-badge {
            background: #0f172a;
            color: #ffffff;
            font-size: 0.62rem;
            font-weight: 800;
            padding: 1px 6px;
            border-radius: 3px;
            margin-right: 6px;
          }
          .spwm-mobile-order-drawer {
            padding: 10px 14px;
            background: #ffffff;
            border-top: 1px solid #e2e8f0;
          }
          .spwm-mobile-order-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 12px;
          }
          .spwm-mobile-order-key {
            color: #64748b;
            font-size: 0.62rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin-bottom: 1px;
          }
          .spwm-mobile-order-val {
            color: #0f172a;
            font-weight: 800;
            font-size: 0.78rem;
          }

          /* Hide desktop sidebar */
          .spwm-sidebar { display: none; }
          .spwm-body { flex-direction: column; }
          .spwm-content {
            padding: 12px 14px;
            -webkit-overflow-scrolling: touch;
          }

          /* Step 1 Mobile Layout */
          .spwm-secured-banner {
            padding: 9px 12px;
            gap: 10px;
            margin-bottom: 12px;
          }
          .spwm-radar-banner {
            padding: 10px 12px;
            margin-bottom: 12px;
          }
          .spwm-filter-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
            margin-bottom: 12px;
          }
          .spwm-filter-tabs {
            justify-content: flex-start;
            gap: 16px;
          }
          .spwm-sort-select {
            width: 100%;
            height: 40px;
            font-size: 0.82rem;
          }

          /* Courier table mobile layout */
          .spwm-courier-header { display: none; }
          .spwm-courier-row {
            display: grid !important;
            grid-template-columns: 1fr auto !important;
            gap: 8px 10px !important;
            align-items: center !important;
          }
          .spwm-courier-col-identity {
            grid-column: 1 / 2 !important;
            grid-row: 1 !important;
          }
          .spwm-courier-col-charges {
            grid-column: 2 / 3 !important;
            grid-row: 1 !important;
            text-align: right !important;
          }
          .spwm-courier-col-details {
            grid-column: 1 / 3 !important;
            grid-row: 2 !important;
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 6px 10px !important;
            padding-top: 8px !important;
            border-top: 1px solid #f1f5f9 !important;
          }

          /* Visibility toggles */
          .spwm-desktop-only { display: none !important; }
          .spwm-mobile-only { display: flex !important; }

          .spwm-meta-pill {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 0.72rem;
            color: #334155;
            background: #f8fafc;
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid #f1f5f9;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .spwm-meta-key {
            color: #64748b;
            font-size: 0.64rem;
            font-weight: 600;
          }
          .spwm-meta-val {
            font-weight: 800;
            color: #0f172a;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .spwm-rating-badge {
            background: #dcfce7;
            color: #15803d;
            font-weight: 800;
            font-size: 0.68rem;
            padding: 1px 6px;
            border-radius: 10px;
          }

          /* Step 2 Date mobile */
          .spwm-quick-dates-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            width: 100%;
          }
          .spwm-quick-date-btn {
            padding: 10px 6px;
            font-size: 0.76rem;
            text-align: center;
          }

          /* Step 3 Specs mobile */
          .spwm-preset-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
            width: 100%;
          }
          .spwm-preset-btn {
            width: 100%;
            text-align: left;
            padding: 9px 12px;
            font-size: 0.78rem;
          }
          .spwm-form-input {
            font-size: 16px !important; /* Prevents auto-zoom on iOS */
            height: 42px;
            padding: 8px 12px;
          }
          .spwm-specs-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 16px;
          }
          .spwm-weight-stats-grid {
            padding: 12px;
            grid-template-columns: 1fr;
            gap: 10px;
          }

          /* Step 4 Review mobile */
          .spwm-review-grid {
            grid-template-columns: 1fr;
            gap: 12px;
            margin-bottom: 16px;
          }

          /* Mobile Footer: Side by side sticky bottom bar */
          .spwm-footer {
            padding: 10px 14px !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 8px !important;
            background: #ffffff !important;
            border-top: 1px solid #e2e8f0 !important;
            padding-bottom: max(10px, env(safe-area-inset-bottom)) !important;
          }
          .spwm-footer-left {
            flex: 1 !important;
            width: auto !important;
          }
          .spwm-footer-left button {
            width: 100% !important;
            height: 44px !important;
            padding: 0 10px !important;
            font-size: 0.78rem !important;
            border-radius: 6px !important;
            justify-content: center !important;
          }
          .spwm-footer-right {
            flex: 2 !important;
            width: auto !important;
            display: flex !important;
            gap: 8px !important;
          }
          .spwm-footer-right button {
            width: 100% !important;
            height: 44px !important;
            padding: 0 12px !important;
            font-size: 0.80rem !important;
            border-radius: 6px !important;
            justify-content: center !important;
          }
        }
      `}</style>
      <div className="spwm-overlay">
        <div className="spwm-modal">
          {/* MODAL HEADER */}
          <div className="spwm-header">
            <div className="spwm-header-info">
              <div className="spwm-header-subtitle">
                Shiprocket Logistics Dispatch & Pickup Scheduling
              </div>
              <h2 className="spwm-header-title">Dispatch Shipment • Order #{order.id}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="spwm-header-close"
              title="Close Wizard"
            >
              ✕
            </button>
          </div>

          {/* STEP PROGRESS BAR */}
          <div className="spwm-step-bar">
            {[
              { num: 1, label: 'Courier Partner', short: 'Courier' },
              { num: 2, label: 'Pickup Date', short: 'Pickup' },
              { num: 3, label: 'Package Specs', short: 'Specs' },
              { num: 4, label: 'Review & Confirm', short: 'Review' },
            ].map((s) => {
              const isActive = currentStep === s.num;
              const isCompleted = currentStep > s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    if (s.num < currentStep) setCurrentStep(s.num);
                  }}
                  disabled={s.num > currentStep}
                  className={`spwm-step-btn ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                >
                  <span className="spwm-step-num">{isCompleted ? '✓' : `${s.num}`}</span>
                  <span className="spwm-step-label-desktop">{s.label}</span>
                  <span className="spwm-step-label-mobile">{s.short}</span>
                </button>
              );
            })}
          </div>

          {/* MOBILE ORDER SUMMARY ACCORDION */}
          <div className="spwm-mobile-order-summary">
            <button
              type="button"
              className="spwm-mobile-order-toggle"
              onClick={() => setShowMobileOrderDetails((prev) => !prev)}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}
              >
                <span className="spwm-mobile-order-badge">ORD #{order.id}</span>
                <span style={{ fontWeight: 800, color: '#0f172a', marginRight: 4 }}>
                  ₹{Number(orderValue).toLocaleString('en-IN')}
                </span>
                <span style={{ color: '#64748b', fontSize: '0.68rem' }}>({paymentMode})</span>
              </div>
              <span
                style={{ color: '#4f46e5', fontWeight: 800, fontSize: '0.68rem', flexShrink: 0 }}
              >
                {showMobileOrderDetails ? 'Details ▲' : 'Details ▼'}
              </span>
            </button>
            {showMobileOrderDetails && (
              <div className="spwm-mobile-order-drawer">
                <div className="spwm-mobile-order-grid">
                  <div>
                    <div className="spwm-mobile-order-key">Pickup Origin</div>
                    <div className="spwm-mobile-order-val">
                      {pickupPincode}, {pickupCity}
                    </div>
                  </div>
                  <div>
                    <div className="spwm-mobile-order-key">Destination</div>
                    <div className="spwm-mobile-order-val">
                      {deliveryPincode}, {deliveryState}
                    </div>
                  </div>
                  <div>
                    <div className="spwm-mobile-order-key">Billed Weight</div>
                    <div className="spwm-mobile-order-val">
                      {billedWeight.toFixed(3)} kg{' '}
                      {volumetricWeight > deadWeight && (
                        <span
                          style={{
                            fontSize: '0.60rem',
                            color: '#4f46e5',
                            background: '#ede9fe',
                            padding: '1px 4px',
                            borderRadius: '3px',
                          }}
                        >
                          Vol
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="spwm-mobile-order-key">Customer</div>
                    <div className="spwm-mobile-order-val">{customerName}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* MODAL MAIN CONTENT CONTAINER (WITH SIDEBAR) */}
          <div className="spwm-body">
            {/* LEFT SIDEBAR: ORDER DETAILS */}
            <div className="spwm-sidebar">
              <div>
                <h3
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 900,
                    color: '#0f172a',
                    margin: '0 0 14px',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Order Details
                </h3>
              </div>

              {/* Pickup From */}
              <div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '2px',
                  }}
                >
                  Pickup From
                </div>
                <div
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    color: '#0f172a',
                  }}
                >
                  {pickupPincode}, {pickupCity}
                </div>
              </div>

              {/* Deliver To */}
              <div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '2px',
                  }}
                >
                  Deliver To
                </div>
                <div
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    borderBottom: '1px dashed #94a3b8',
                    display: 'inline-block',
                  }}
                >
                  {deliveryPincode}, {deliveryState}
                </div>
              </div>

              {/* Order Value */}
              <div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '2px',
                  }}
                >
                  Order Value
                </div>
                <div
                  style={{
                    fontSize: '0.96rem',
                    fontWeight: 900,
                    color: '#0f172a',
                  }}
                >
                  ₹ {Number(orderValue).toLocaleString('en-IN')}
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '2px',
                  }}
                >
                  Payment Mode
                </div>
                <div
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    color: '#0f172a',
                  }}
                >
                  {paymentMode}
                </div>
              </div>

              {/* Applicable Weight */}
              <div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '2px',
                  }}
                >
                  Applicable Weight (in Kg)
                </div>
                <div
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '6px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>
                    {billedWeight < 10
                      ? Number(billedWeight.toFixed(3))
                      : billedWeight.toLocaleString('en-IN', { maximumFractionDigits: 3 })}{' '}
                    Kg
                  </span>
                  {volumetricWeight > deadWeight && (
                    <span
                      style={{
                        fontSize: '0.64rem',
                        fontWeight: 700,
                        color: '#4f46e5',
                        background: '#ede9fe',
                        padding: '1px 5px',
                        borderRadius: '4px',
                      }}
                    >
                      Volumetric
                    </span>
                  )}
                </div>
              </div>

              {/* Customer Details Pill */}
              <div
                style={{
                  marginTop: 'auto',
                  padding: '10px 12px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ fontWeight: 800, color: '#0f172a' }}>{customerName}</div>
                <div style={{ color: '#64748b', marginTop: '2px' }}>{customerPhone}</div>
              </div>
            </div>

            {/* RIGHT MAIN AREA (SCROLLABLE) */}
            <div className="spwm-content">
              {/* ── STEP 1: SELECT COURIER PARTNER ── */}
              {currentStep === 1 && (
                <div>
                  {/* AUTO SECURED GREEN BANNER (MATCHING SCREENSHOT) */}
                  {/* AUTO SECURED GREEN BANNER (MATCHING SCREENSHOT) */}
                  <div className="spwm-secured-banner">
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: '#16a34a',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.85rem',
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: '0.86rem',
                          fontWeight: 800,
                          color: '#15803d',
                        }}
                      >
                        Your shipment is Auto Secured
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#166534' }}>
                        You are eligible for full refund on your shipment upto ₹ 4,75,000
                      </div>
                    </div>
                  </div>

                  {/* FILTER TABS & SORT DROPDOWN */}
                  <div className="spwm-filter-bar">
                    {/* Filter Tabs: All | Air | Surface */}
                    <div className="spwm-filter-tabs">
                      {(['all', 'air', 'surface'] as const).map((tab) => {
                        const isActive = filterTab === tab;
                        const label = tab === 'all' ? 'All' : tab === 'air' ? 'Air' : 'Surface';
                        return (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setFilterTab(tab)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              borderBottom: isActive
                                ? '3px solid #6366f1'
                                : '3px solid transparent',
                              padding: '6px 4px',
                              fontWeight: isActive ? 800 : 600,
                              color: isActive ? '#4f46e5' : '#64748b',
                              fontSize: '0.86rem',
                              cursor: 'pointer',
                              textTransform: 'capitalize',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Sort By Dropdown */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        className="spwm-sort-select"
                      >
                        <option value="recommended">Sort By: Shiprocket Recommendation</option>
                        <option value="cheapest">Sort By: Lowest Price</option>
                        <option value="fastest">Sort By: Fastest Delivery</option>
                        <option value="rating">Sort By: Highest Rating</option>
                      </select>
                    </div>
                  </div>

                  {/* COURIER COUNT */}
                  <div
                    style={{
                      fontSize: '0.86rem',
                      fontWeight: 800,
                      color: '#334155',
                      marginBottom: '12px',
                    }}
                  >
                    {filteredAndSortedCouriers.length} Couriers Found
                  </div>

                  {/* SMARTER COURIER SELECTION WITH RADAR (AI-POWERED) BANNER */}
                  <div className="spwm-radar-banner">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        marginBottom: '6px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: '0.90rem', fontWeight: 800, color: '#1e1b4b' }}>
                        Smarter Courier Selection with Radar
                      </span>
                      <span
                        style={{
                          background: '#6366f1',
                          color: '#ffffff',
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          flexShrink: 0,
                        }}
                      >
                        AI-POWERED
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: '#4338ca',
                        marginBottom: '4px',
                        fontWeight: 600,
                      }}
                    >
                      Uses real-time data of millions of shipments to measure:
                    </div>
                    <div
                      style={{
                        fontSize: '0.74rem',
                        color: '#4338ca',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                      }}
                    >
                      <div>• Current Stress at delivery pincode level for each courier.</div>
                      <div>• Pincode level rating for each courier.</div>
                    </div>
                  </div>

                  {/* TABLE HEADERS (desktop only, hidden on mobile via CSS) */}
                  <div className="spwm-courier-header">
                    <div>Courier Partner</div>
                    <div style={{ textAlign: 'center' }}>Rating (Radar)</div>
                    <div>Expected Pickup</div>
                    <div>Estimated Delivery</div>
                    <div style={{ textAlign: 'center' }}>Chargeable Wt</div>
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Charges</div>
                  </div>

                  {/* LOADING STATE */}
                  {loadingCouriers && (
                    <div
                      style={{
                        padding: '50px 20px',
                        textAlign: 'center',
                        background: '#f8fafc',
                        border: '1px dashed #cbd5e1',
                        marginTop: '12px',
                      }}
                    >
                      <div
                        style={{
                          display: 'inline-block',
                          width: '32px',
                          height: '32px',
                          border: '3px solid #e2e8f0',
                          borderTopColor: '#6366f1',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          marginBottom: '12px',
                        }}
                      />
                      <div style={{ fontSize: '0.88rem', color: '#334155', fontWeight: 700 }}>
                        Querying Shiprocket live rates for PIN {deliveryPincode}...
                      </div>
                    </div>
                  )}

                  {/* ERROR STATE */}
                  {courierError && !loadingCouriers && (
                    <div
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#991b1b',
                        padding: '14px 16px',
                        fontSize: '0.82rem',
                        marginTop: '12px',
                        borderRadius: '6px',
                      }}
                    >
                      ⚠️ {courierError}
                    </div>
                  )}

                  {/* COURIER LIST */}
                  {!loadingCouriers && filteredAndSortedCouriers.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        marginTop: '10px',
                      }}
                    >
                      {filteredAndSortedCouriers.map((c) => {
                        const isSelected = selectedCourierId === c.courier_company_id;
                        const isRecommended = c.is_recommended;
                        const badge = getCarrierBadge(c.courier_name);
                        const logoUrl = getCarrierLogo(c.courier_name, c.courier_logo_url);
                        const ratingVal = (c.rating || 4.7).toFixed(1);

                        return (
                          // biome-ignore lint/a11y/noStaticElementInteractions: courier card selection
                          <div
                            key={c.courier_company_id}
                            onClick={() => setSelectedCourierId(c.courier_company_id)}
                            style={{
                              border: isSelected
                                ? '1.5px solid #4f46e5'
                                : isRecommended
                                  ? '1.5px solid #818cf8'
                                  : '1px solid #e2e8f0',
                              borderRadius: '8px',
                              background: isSelected ? '#f5f3ff' : '#ffffff',
                              padding: '12px 14px',
                              position: 'relative',
                              transition: 'all 0.15s ease',
                              boxShadow: isSelected
                                ? '0 0 0 1px #4f46e5, 0 4px 12px rgba(99, 102, 241, 0.12)'
                                : isRecommended
                                  ? '0 2px 8px rgba(129, 140, 248, 0.1)'
                                  : 'none',
                              cursor: 'pointer',
                              boxSizing: 'border-box',
                            }}
                          >
                            {/* Recommended Ribbon Pill */}
                            {isRecommended && (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  background: '#000000',
                                  color: '#ffffff',
                                  fontSize: '0.70rem',
                                  fontWeight: 800,
                                  padding: '3px 10px',
                                  borderRadius: '12px',
                                  marginBottom: '10px',
                                }}
                              >
                                <span>★</span> Recommended
                              </div>
                            )}

                            <div className="spwm-courier-row">
                              {/* Column 1: Courier Logo, Name & Subtitle */}
                              <div
                                className="spwm-courier-col-identity"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  minWidth: 0,
                                }}
                              >
                                <input
                                  type="radio"
                                  name="courier_selection"
                                  checked={isSelected}
                                  onChange={() => setSelectedCourierId(c.courier_company_id)}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    cursor: 'pointer',
                                    accentColor: '#4f46e5',
                                    width: '16px',
                                    height: '16px',
                                    flexShrink: 0,
                                  }}
                                />
                                {/* Provider Brand Logo */}
                                <div
                                  style={{
                                    width: '42px',
                                    height: '30px',
                                    borderRadius: '6px',
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '2px 4px',
                                    flexShrink: 0,
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {logoUrl ? (
                                    // biome-ignore lint/performance/noImgElement: carrier brand logo
                                    <img
                                      src={logoUrl}
                                      alt={c.courier_name}
                                      style={{
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        objectFit: 'contain',
                                        display: 'block',
                                      }}
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                        const sibling = (e.target as HTMLElement)
                                          .nextElementSibling;
                                        if (sibling)
                                          (sibling as HTMLElement).style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      borderRadius: '4px',
                                      background: badge.bg,
                                      color: badge.color,
                                      display: logoUrl ? 'none' : 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.70rem',
                                      fontWeight: 800,
                                    }}
                                  >
                                    {badge.initials}
                                  </div>
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div
                                    style={{
                                      fontSize: '0.86rem',
                                      fontWeight: 800,
                                      color: '#0f172a',
                                      lineHeight: 1.25,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {c.courier_name}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '0.70rem',
                                      color: '#64748b',
                                      marginTop: '2px',
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    <span>{c.is_surface ? 'Surface' : 'Air'}</span>
                                    <span> | Min: {c.min_weight || 0.5} Kg</span>
                                  </div>
                                </div>
                              </div>

                              {/* Details container (display: contents on desktop, 2x2 grid on mobile) */}
                              <div className="spwm-courier-col-details">
                                {/* Detail 1: Rating */}
                                <div className="spwm-detail-col spwm-detail-rating">
                                  <div
                                    className="spwm-desktop-only"
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        border: '2px solid #22c55e',
                                        background: '#f0fdf4',
                                        color: '#15803d',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.82rem',
                                        fontWeight: 900,
                                      }}
                                    >
                                      {ratingVal}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: '0.60rem',
                                        color: '#64748b',
                                        marginTop: '2px',
                                      }}
                                    >
                                      Radar
                                    </div>
                                  </div>
                                  <div className="spwm-mobile-only spwm-meta-pill">
                                    <span className="spwm-meta-key">Rating:</span>
                                    <span className="spwm-rating-badge">★ {ratingVal}</span>
                                  </div>
                                </div>

                                {/* Detail 2: Expected Pickup */}
                                <div className="spwm-detail-col spwm-detail-pickup">
                                  <div className="spwm-desktop-only">
                                    {c.is_auto_pickup ? (
                                      <>
                                        <div
                                          style={{
                                            fontSize: '0.74rem',
                                            fontWeight: 700,
                                            color: '#0284c7',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                          }}
                                        >
                                          <span>⏱</span> Auto-Scheduled
                                        </div>
                                        <div
                                          style={{
                                            fontSize: '0.78rem',
                                            fontWeight: 800,
                                            color: '#0f172a',
                                            marginTop: '1px',
                                          }}
                                        >
                                          for{' '}
                                          {c.expected_pickup
                                            ? c.expected_pickup.replace(
                                                /^Auto-Scheduled Pickup for\s*/i,
                                                ''
                                              )
                                            : 'Monday'}
                                        </div>
                                      </>
                                    ) : (
                                      <div
                                        style={{
                                          fontSize: '0.80rem',
                                          fontWeight: 800,
                                          color: '#0f172a',
                                        }}
                                      >
                                        {c.expected_pickup || 'Monday'}
                                      </div>
                                    )}
                                    <div
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        background: '#ecfdf5',
                                        color: '#047857',
                                        fontSize: '0.64rem',
                                        fontWeight: 700,
                                        padding: '2px 7px',
                                        borderRadius: '4px',
                                        marginTop: '4px',
                                      }}
                                    >
                                      Pickup by{' '}
                                      <span style={{ color: '#000000', fontWeight: 900 }}>▷</span>{' '}
                                      Shiprocket
                                    </div>
                                  </div>
                                  <div className="spwm-mobile-only spwm-meta-pill">
                                    <span className="spwm-meta-key">Pickup:</span>
                                    <span className="spwm-meta-val">
                                      {c.expected_pickup
                                        ? c.expected_pickup.replace(
                                            /^Auto-Scheduled Pickup for\s*/i,
                                            ''
                                          )
                                        : 'Monday'}
                                    </span>
                                  </div>
                                </div>

                                {/* Detail 3: Estimated Delivery */}
                                <div className="spwm-detail-col spwm-detail-delivery">
                                  <div
                                    className="spwm-desktop-only"
                                    style={{
                                      fontSize: '0.82rem',
                                      fontWeight: 700,
                                      color: '#1e293b',
                                    }}
                                  >
                                    {getDeliveryDateString(c)}
                                  </div>
                                  <div className="spwm-mobile-only spwm-meta-pill">
                                    <span className="spwm-meta-key">Delivery:</span>
                                    <span className="spwm-meta-val">
                                      {getDeliveryDateString(c)}
                                    </span>
                                  </div>
                                </div>

                                {/* Detail 4: Chargeable Weight */}
                                <div className="spwm-detail-col spwm-detail-weight">
                                  <div
                                    className="spwm-desktop-only"
                                    style={{
                                      fontSize: '0.82rem',
                                      fontWeight: 700,
                                      color: '#475569',
                                      textAlign: 'center',
                                    }}
                                  >
                                    {c.charge_weight || billedWeight || 0.5} Kg
                                  </div>
                                  <div className="spwm-mobile-only spwm-meta-pill">
                                    <span className="spwm-meta-key">Weight:</span>
                                    <span className="spwm-meta-val">
                                      {c.charge_weight || billedWeight || 0.5} Kg
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Column 6: Charges */}
                              <div className="spwm-courier-col-charges">
                                <div
                                  style={{
                                    fontSize: '0.98rem',
                                    fontWeight: 900,
                                    color: '#0f172a',
                                    whiteSpace: 'nowrap',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    gap: '4px',
                                  }}
                                >
                                  <span>₹{c.rate.toFixed(2)}</span>
                                  {c.rto_charges !== undefined &&
                                    c.rto_charges !== null &&
                                    Number(c.rto_charges) > 0 && (
                                      // biome-ignore lint/a11y/noStaticElementInteractions: rto tooltip tap trigger
                                      <span
                                        className="spwm-rto-trigger"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveRtoCourierId((prev) =>
                                            prev === c.courier_company_id
                                              ? null
                                              : c.courier_company_id
                                          );
                                        }}
                                        title={`RTO Charges: ₹${c.rto_charges}`}
                                      >
                                        <span className="spwm-rto-icon">ⓘ</span>
                                        <span
                                          className={`spwm-rto-tooltip ${
                                            activeRtoCourierId === c.courier_company_id
                                              ? 'spwm-rto-tooltip-open'
                                              : ''
                                          }`}
                                        >
                                          <span className="spwm-rto-tooltip-title">
                                            Return To Origin (RTO)
                                          </span>
                                          <span className="spwm-rto-tooltip-amount">
                                            ₹{Number(c.rto_charges).toFixed(2)}
                                          </span>
                                          <span className="spwm-rto-tooltip-sub">
                                            Directly from Shiprocket API
                                          </span>
                                        </span>
                                      </span>
                                    )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 2: SELECT PICKUP DATE ── */}
              {currentStep === 2 && (
                <div>
                  <div style={{ marginBottom: 18 }}>
                    <h3
                      style={{
                        fontSize: '1rem',
                        fontWeight: 900,
                        margin: '0 0 6px',
                        color: '#0f172a',
                        textTransform: 'uppercase',
                      }}
                    >
                      Step 2: Select Date of Pickup
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.84rem',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>Selected Courier:</span>
                      {selectedCourier && (
                        <span
                          style={{
                            width: '34px',
                            height: '24px',
                            borderRadius: '4px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '1px 3px',
                            overflow: 'hidden',
                          }}
                        >
                          {getCarrierLogo(
                            selectedCourier.courier_name,
                            selectedCourier.courier_logo_url
                          ) ? (
                            // biome-ignore lint/performance/noImgElement: carrier brand logo
                            <img
                              src={getCarrierLogo(
                                selectedCourier.courier_name,
                                selectedCourier.courier_logo_url
                              )}
                              alt={selectedCourier.courier_name}
                              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                          ) : (
                            <span style={{ fontSize: '0.60rem', fontWeight: 800 }}>
                              {getCarrierBadge(selectedCourier.courier_name).initials}
                            </span>
                          )}
                        </span>
                      )}
                      <strong style={{ color: '#4f46e5' }}>
                        {selectedCourier?.courier_name || 'Selected Partner'}
                      </strong>{' '}
                      (₹{selectedCourier?.rate.toFixed(2)} • Rating {selectedCourier?.rating || 4.7}
                      )
                    </p>
                  </div>

                  {/* COURIER SLA CONSTRAINT BANNER */}
                  {isStrictTwoDays ? (
                    <div
                      style={{
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderLeft: '4px solid #f59e0b',
                        borderRadius: '6px',
                        padding: '14px 16px',
                        marginBottom: 20,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '0.86rem',
                          color: '#92400e',
                          marginBottom: 4,
                        }}
                      >
                        ⏱️ Mandatory 2-Day Courier SLA Window (Surface Road Courier)
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#78350f', lineHeight: 1.45 }}>
                        <strong>{selectedCourier?.courier_name}</strong> is a surface road courier
                        requiring pickup allocations strictly within{' '}
                        <strong>2 business days (Today or Tomorrow)</strong>. The calendar and quick
                        selectors below are automatically constrained to prevent courier rejection.
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderLeft: '4px solid #10b981',
                        borderRadius: '6px',
                        padding: '14px 16px',
                        marginBottom: 20,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '0.86rem',
                          color: '#166534',
                          marginBottom: 4,
                        }}
                      >
                        📅 Flexible Pickup Scheduling Available (Air / Express)
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#14532d', lineHeight: 1.45 }}>
                        <strong>{selectedCourier?.courier_name}</strong> allows flexible pickup
                        scheduling anytime up to <strong>{allowedDaysCount} days in advance</strong>
                        .
                      </div>
                    </div>
                  )}

                  {/* PARTNER CUTOFF TIME NOTICE */}
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '12px 14px',
                      marginBottom: 20,
                      fontSize: '0.8rem',
                      color: '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>⏰</span>
                    <div>
                      <strong>Partner Daily Cutoff:</strong>{' '}
                      {selectedCourier?.cutoff_time || '11:00 AM'} (IST). Pickups scheduled after
                      cutoff will be completed on the following working day.
                    </div>
                  </div>

                  {/* QUICK DATE SELECTOR BUTTONS */}
                  <div style={{ marginBottom: 20 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: '#334155',
                        marginBottom: 8,
                      }}
                    >
                      Quick Date Selection:
                    </span>
                    <div className="spwm-quick-dates-grid">
                      {(() => {
                        const buttons = [];
                        const d0 = new Date();
                        const d0Str = d0.toISOString().split('T')[0];
                        buttons.push({ label: 'Today (Earliest)', val: d0Str });

                        const d1 = new Date();
                        d1.setDate(d1.getDate() + 1);
                        const d1Str = d1.toISOString().split('T')[0];
                        buttons.push({ label: 'Tomorrow', val: d1Str });

                        if (!isStrictTwoDays && allowedDaysCount > 2) {
                          for (let i = 2; i < Math.min(allowedDaysCount, 6); i++) {
                            const di = new Date();
                            di.setDate(di.getDate() + i);
                            const diStr = di.toISOString().split('T')[0];
                            const dayName = di.toLocaleDateString('en-IN', { weekday: 'short' });
                            buttons.push({ label: `+${i}d (${dayName})`, val: diStr });
                          }
                        }

                        return buttons.map((b) => (
                          <button
                            key={b.val}
                            type="button"
                            onClick={() => setPickupDate(b.val)}
                            className="spwm-quick-date-btn"
                            style={{
                              border:
                                pickupDate === b.val ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                              background: pickupDate === b.val ? '#ede9fe' : '#ffffff',
                              color: pickupDate === b.val ? '#4f46e5' : '#1e293b',
                            }}
                          >
                            {b.label}
                          </button>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* CALENDAR DATE PICKER */}
                  <div style={{ marginBottom: 20 }}>
                    <label
                      htmlFor="pickup-calendar-input"
                      style={{
                        display: 'block',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: '#334155',
                        marginBottom: 6,
                      }}
                    >
                      Or Choose on Calendar:
                    </label>
                    <input
                      id="pickup-calendar-input"
                      type="date"
                      value={pickupDate}
                      min={todayStr}
                      max={maxDateStr}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v > maxDateStr) setPickupDate(maxDateStr);
                        else if (v < todayStr) setPickupDate(todayStr);
                        else setPickupDate(v);
                      }}
                      className="spwm-form-input"
                      style={{
                        maxWidth: '340px',
                        fontFamily: 'inherit',
                      }}
                    />
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                      Allowed range locked to {todayStr} through {maxDateStr} based on provider
                      rules.
                    </div>
                  </div>

                  {/* CHOSEN DATE DISPLAY BADGE */}
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '14px 16px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        color: '#64748b',
                        fontWeight: 700,
                      }}
                    >
                      Confirmed Pickup Schedule
                    </div>
                    <div
                      style={{
                        fontSize: '1rem',
                        fontWeight: 900,
                        color: '#0f172a',
                        marginTop: '2px',
                      }}
                    >
                      {formatReadableDate(pickupDate)}
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 3: PACKAGE DETAILS ── */}
              {currentStep === 3 && (
                <div>
                  <div style={{ marginBottom: 18 }}>
                    <h3
                      style={{
                        fontSize: '1rem',
                        fontWeight: 900,
                        margin: '0 0 6px',
                        color: '#0f172a',
                        textTransform: 'uppercase',
                      }}
                    >
                      Step 3: Fill Package Details & Dimensions
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>
                      Accurate weight and dimensions prevent courier weight discrepancy penalties
                      and ensure smooth pickup.
                    </p>
                  </div>

                  {/* PRESETS BUTTONS */}
                  <div style={{ marginBottom: 20 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: '#64748b',
                        marginBottom: 6,
                      }}
                    >
                      Quick Package Presets:
                    </span>
                    <div className="spwm-preset-group">
                      {presets.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            setDeadWeight(p.w);
                            setLength(p.l);
                            setBreadth(p.b);
                            setHeight(p.h);
                          }}
                          className="spwm-preset-btn"
                        >
                          {p.label} ({p.l}×{p.b}×{p.h}cm, {p.w}kg)
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* INPUT FIELDS */}
                  <div className="spwm-specs-grid">
                    <div>
                      <label
                        htmlFor="pkg-dead-weight"
                        style={{
                          display: 'block',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: '#334155',
                          marginBottom: 4,
                        }}
                      >
                        Dead Weight (kg)
                      </label>
                      <input
                        id="pkg-dead-weight"
                        type="number"
                        step="0.05"
                        min="0.05"
                        value={deadWeight}
                        onChange={(e) => setDeadWeight(Number(e.target.value) || 0)}
                        className="spwm-form-input"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="pkg-length"
                        style={{
                          display: 'block',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: '#334155',
                          marginBottom: 4,
                        }}
                      >
                        Length (cm)
                      </label>
                      <input
                        id="pkg-length"
                        type="number"
                        step="0.5"
                        min="1"
                        value={length}
                        onChange={(e) => setLength(Number(e.target.value) || 0)}
                        className="spwm-form-input"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="pkg-breadth"
                        style={{
                          display: 'block',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: '#334155',
                          marginBottom: 4,
                        }}
                      >
                        Breadth / Width (cm)
                      </label>
                      <input
                        id="pkg-breadth"
                        type="number"
                        step="0.5"
                        min="1"
                        value={breadth}
                        onChange={(e) => setBreadth(Number(e.target.value) || 0)}
                        className="spwm-form-input"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="pkg-height"
                        style={{
                          display: 'block',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: '#334155',
                          marginBottom: 4,
                        }}
                      >
                        Height (cm)
                      </label>
                      <input
                        id="pkg-height"
                        type="number"
                        step="0.5"
                        min="1"
                        value={height}
                        onChange={(e) => setHeight(Number(e.target.value) || 0)}
                        className="spwm-form-input"
                      />
                    </div>
                  </div>

                  {/* VOLUMETRIC WEIGHT DISPLAY */}
                  <div className="spwm-weight-stats-grid">
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                        Actual Dead Weight
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                        {deadWeight.toFixed(3)} kg
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                        Volumetric Weight (L×B×H / 5000)
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                        {volumetricWeight.toFixed(3)} kg
                      </div>
                    </div>
                    <div
                      style={{
                        background: '#ede9fe',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid #ddd6fe',
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', color: '#5b21b6', fontWeight: 800 }}>
                        Applied Billable Weight
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#4f46e5' }}>
                        {billedWeight.toFixed(3)} kg
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 4: FINAL SUMMARY & CONFIRMATION ── */}
              {currentStep === 4 && (
                <div>
                  <div style={{ marginBottom: 18 }}>
                    <h3
                      style={{
                        fontSize: '1rem',
                        fontWeight: 900,
                        margin: '0 0 6px',
                        color: '#0f172a',
                        textTransform: 'uppercase',
                      }}
                    >
                      Step 4: Final Summary & Verification
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>
                      Please review all logistics parameters carefully before confirming pickup.
                    </p>
                  </div>

                  {/* CRITICAL WARNING BANNER */}
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #f87171',
                      borderLeft: '5px solid #dc2626',
                      borderRadius: '6px',
                      padding: '14px 16px',
                      marginBottom: 20,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 900,
                        fontSize: '0.86rem',
                        color: '#991b1b',
                        textTransform: 'uppercase',
                        marginBottom: 4,
                      }}
                    >
                      <span>⚠️ Irreversible Action & Status Transition</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#7f1d1d', lineHeight: 1.45 }}>
                      Once you confirm and schedule pickup, Shiprocket generates the official AWB
                      code, locks the manifest, and updates order status to <strong>SHIPPED</strong>
                      . The customer will be sent an automated dispatch notification email. These
                      values <strong>CANNOT BE EDITED</strong> without cancelling the shipment.
                    </div>
                  </div>

                  {/* SUMMARY DETAILS GRID */}
                  <div className="spwm-review-grid">
                    {/* Courier & Date Card */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '14px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: '#4f46e5',
                          marginBottom: 8,
                        }}
                      >
                        Logistics Partner & Schedule
                      </div>
                      <div
                        style={{
                          marginBottom: 6,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Courier: </span>
                        {selectedCourier && (
                          <span
                            style={{
                              width: '34px',
                              height: '24px',
                              borderRadius: '4px',
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '1px 3px',
                              overflow: 'hidden',
                            }}
                          >
                            {getCarrierLogo(
                              selectedCourier.courier_name,
                              selectedCourier.courier_logo_url
                            ) ? (
                              // biome-ignore lint/performance/noImgElement: carrier brand logo
                              <img
                                src={getCarrierLogo(
                                  selectedCourier.courier_name,
                                  selectedCourier.courier_logo_url
                                )}
                                alt={selectedCourier.courier_name}
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: '100%',
                                  objectFit: 'contain',
                                }}
                              />
                            ) : (
                              <span style={{ fontSize: '0.60rem', fontWeight: 800 }}>
                                {getCarrierBadge(selectedCourier.courier_name).initials}
                              </span>
                            )}
                          </span>
                        )}
                        <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                          {selectedCourier?.courier_name || 'Selected Partner'}
                        </strong>
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          Rate & Rating:{' '}
                        </span>
                        <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                          ₹{selectedCourier?.rate.toFixed(2) || '0.00'} • ★{' '}
                          {selectedCourier?.rating || 4.7} Radar
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Pickup Date: </span>
                        <strong style={{ fontSize: '0.88rem', color: '#16a34a' }}>
                          {formatReadableDate(pickupDate)}
                        </strong>
                      </div>
                    </div>

                    {/* Package Dimensions Card */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '14px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: '#4f46e5',
                          marginBottom: 8,
                        }}
                      >
                        Package Specs & Weights
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Dimensions: </span>
                        <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                          {length} × {breadth} × {height} cm
                        </strong>
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Dead Weight: </span>
                        <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                          {deadWeight.toFixed(3)} kg
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          Applied Weight:{' '}
                        </span>
                        <strong style={{ fontSize: '0.88rem', color: '#4f46e5' }}>
                          {billedWeight.toFixed(3)} kg (Vol: {volumetricWeight.toFixed(3)} kg)
                        </strong>
                      </div>
                    </div>

                    {/* Origin Warehouse Card */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '14px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: '#0f172a',
                          marginBottom: 6,
                        }}
                      >
                        📍 Pickup Origin (Warehouse)
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#334155', lineHeight: 1.4 }}>
                        <strong>{warehouseInfo?.pickup_location || 'Home Warehouse'}</strong>
                        <br />
                        {warehouseInfo?.address || 'VAHN Sports Fulfillment Centre'}
                        {warehouseInfo?.city ? `, ${warehouseInfo.city}` : ''}
                        {warehouseInfo?.state ? `, ${warehouseInfo.state}` : ''}
                        {warehouseInfo?.pin_code ? ` - ${warehouseInfo.pin_code}` : ''}
                      </div>
                    </div>

                    {/* Destination Customer Card */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '14px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: '#0f172a',
                          marginBottom: 6,
                        }}
                      >
                        📦 Customer & Destination
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#334155', lineHeight: 1.4 }}>
                        <strong>{customerName}</strong> ({customerPhone} • {customerEmail})
                        <br />
                        {shippingAddr.address1 || shippingAddr.address || 'Address'}
                        {shippingAddr.address2 ? `, ${shippingAddr.address2}` : ''}
                        <br />
                        {shippingAddr.city || ''}
                        {shippingAddr.state ? `, ${shippingAddr.state}` : ''} -{' '}
                        <strong>{deliveryPincode}</strong>
                      </div>
                    </div>
                  </div>

                  {submitError && (
                    <div
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #f87171',
                        borderRadius: '6px',
                        color: '#b91c1c',
                        padding: '12px 14px',
                        fontSize: '0.82rem',
                        marginBottom: 16,
                      }}
                    >
                      ⚠️ <strong>Scheduling Error:</strong> {submitError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* MODAL FOOTER BUTTONS */}
          <div className="spwm-footer">
            <div className="spwm-footer-left">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  disabled={submitting}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    color: '#334155',
                    padding: '9px 18px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  ← Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    color: '#64748b',
                    padding: '9px 18px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="spwm-footer-right">
              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={currentStep === 1 && (!selectedCourierId || loadingCouriers)}
                  style={{
                    background: '#4f46e5',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px 22px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor:
                      currentStep === 1 && (!selectedCourierId || loadingCouriers)
                        ? 'not-allowed'
                        : 'pointer',
                    textTransform: 'uppercase',
                    opacity: currentStep === 1 && (!selectedCourierId || loadingCouriers) ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  Next Step →
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="spwm-desktop-only"
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      color: '#64748b',
                      padding: '10px 18px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSchedule}
                    disabled={submitting}
                    style={{
                      background: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '10px 26px',
                      fontSize: '0.84rem',
                      fontWeight: 900,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
                    }}
                  >
                    {submitting ? (
                      <>
                        <span
                          style={{
                            display: 'inline-block',
                            width: '14px',
                            height: '14px',
                            border: '2px solid #ffffff',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                          }}
                        />
                        Scheduling Pickup & Dispatching...
                      </>
                    ) : (
                      'Confirm & Schedule Pickup ✓'
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
