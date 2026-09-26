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
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '16px',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          width: '96vw',
          maxWidth: '1240px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid #cbd5e1',
          position: 'relative',
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: '#94a3b8',
                fontWeight: 700,
              }}
            >
              Shiprocket Logistics Dispatch & Pickup Scheduling
            </div>
            <h2
              style={{
                margin: '2px 0 0',
                fontSize: '1.25rem',
                fontWeight: 900,
                letterSpacing: '-0.02em',
                color: '#ffffff',
              }}
            >
              Dispatch Shipment • Order #{order.id}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.6rem',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '4px 8px',
            }}
            title="Close Wizard"
          >
            ✕
          </button>
        </div>

        {/* STEP PROGRESS BAR */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
          }}
        >
          {[
            { num: 1, label: '1. Courier Partner' },
            { num: 2, label: '2. Pickup Date' },
            { num: 3, label: '3. Package Specs' },
            { num: 4, label: '4. Review & Confirm' },
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
                style={{
                  flex: 1,
                  padding: '12px 6px',
                  background: isActive ? '#ffffff' : isCompleted ? '#f1f5f9' : '#f8fafc',
                  border: 'none',
                  borderBottom: isActive ? '3px solid #4f46e5' : '3px solid transparent',
                  color: isActive ? '#4f46e5' : isCompleted ? '#0f172a' : '#94a3b8',
                  fontWeight: isActive ? 800 : isCompleted ? 700 : 500,
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  cursor: s.num < currentStep ? 'pointer' : 'default',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{isCompleted ? '✓' : `${s.num}.`}</span>
                <span>{s.label.split('. ')[1]}</span>
              </button>
            );
          })}
        </div>

        {/* MODAL MAIN CONTENT CONTAINER (WITH SIDEBAR) */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {/* LEFT SIDEBAR: ORDER DETAILS (MATCHING SCREENSHOT) */}
          <div
            style={{
              width: '215px',
              minWidth: '215px',
              background: '#f8fafc',
              borderRight: '1px solid #e2e8f0',
              padding: '18px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflowY: 'auto',
              flexShrink: 0,
            }}
          >
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
          <div
            style={{
              flex: 1,
              minWidth: 0,
              padding: '18px 22px',
              overflowY: 'auto',
              overflowX: 'hidden',
              background: '#ffffff',
            }}
          >
            {/* ── STEP 1: SELECT COURIER PARTNER ── */}
            {currentStep === 1 && (
              <div>
                {/* AUTO SECURED GREEN BANNER (MATCHING SCREENSHOT) */}
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '20px',
                  }}
                >
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #e2e8f0',
                    paddingBottom: '8px',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  {/* Filter Tabs: All | Air | Surface */}
                  <div style={{ display: 'flex', gap: '20px' }}>
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
                            borderBottom: isActive ? '3px solid #6366f1' : '3px solid transparent',
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
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        background: '#ffffff',
                        color: '#1e293b',
                        cursor: 'pointer',
                      }}
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
                <div
                  style={{
                    background: '#faf8ff',
                    border: '1px solid #e0e7ff',
                    borderRadius: '10px',
                    padding: '14px 18px',
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '6px',
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

                {/* TABLE HEADERS */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'minmax(190px, 2fr) 70px minmax(135px, 1.2fr) 95px 80px 95px',
                    padding: '10px 14px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#64748b',
                    border: '1px solid transparent',
                    background: '#f8fafc',
                    alignItems: 'center',
                    gap: '10px',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                    marginBottom: '8px',
                  }}
                >
                  <div>Courier Partner</div>
                  <div style={{ textAlign: 'center' }}>Rating (Radar)</div>
                  <div>Expected Pickup</div>
                  <div>Estimated Delivery</div>
                  <div style={{ textAlign: 'center' }}>
                    Chargeable Wt <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>ⓘ</span>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    Charges <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>ⓘ</span>
                  </div>
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
                                background: '#7c3aed',
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

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns:
                                'minmax(190px, 2fr) 70px minmax(135px, 1.2fr) 95px 80px 95px',
                              alignItems: 'center',
                              gap: '10px',
                            }}
                          >
                            {/* Column 1: Courier Logo, Name & Subtitle */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                                  width: '46px',
                                  height: '34px',
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
                                      const sibling = (e.target as HTMLElement).nextElementSibling;
                                      if (sibling) (sibling as HTMLElement).style.display = 'flex';
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
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: '0.88rem',
                                    fontWeight: 800,
                                    color: '#0f172a',
                                    lineHeight: 1.25,
                                  }}
                                >
                                  {c.courier_name}
                                </div>
                                <div
                                  style={{
                                    fontSize: '0.72rem',
                                    color: '#64748b',
                                    marginTop: '3px',
                                    lineHeight: 1.4,
                                  }}
                                >
                                  <div>
                                    <span>{c.is_surface ? 'Surface' : 'Air'}</span>
                                    <span> | Min-weight: {c.min_weight || 0.5} Kg</span>
                                  </div>
                                  <div>RTO Charges: ₹{c.rto_charges ?? 70}</div>
                                </div>
                              </div>
                            </div>

                            {/* Column 2: Rating Circle Badge (Powered by Radar) */}
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
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

                            {/* Column 3: Expected Pickup */}
                            <div>
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
                                    <span>⏱</span> Auto-Scheduled Pickup
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
                                <span style={{ color: '#7c3aed', fontWeight: 900 }}>▷</span>{' '}
                                Shiprocket
                              </div>
                            </div>

                            {/* Column 4: Estimated Delivery */}
                            <div
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                color: '#1e293b',
                              }}
                            >
                              {getDeliveryDateString(c)}
                            </div>

                            {/* Column 5: Chargeable Weight */}
                            <div
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                color: '#475569',
                                textAlign: 'center',
                              }}
                            >
                              {c.charge_weight || billedWeight || 0.5} Kg
                            </div>

                            {/* Column 6: Charges */}
                            <div style={{ textAlign: 'right' }}>
                              <div
                                style={{
                                  fontSize: '0.98rem',
                                  fontWeight: 900,
                                  color: '#0f172a',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                ₹{c.rate.toFixed(2)}{' '}
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    color: '#94a3b8',
                                    fontWeight: 500,
                                  }}
                                >
                                  ⓘ
                                </span>
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
                    (₹{selectedCourier?.rate.toFixed(2)} • Rating {selectedCourier?.rating || 4.7})
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
                      scheduling anytime up to <strong>{allowedDaysCount} days in advance</strong>.
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
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                          style={{
                            padding: '10px 14px',
                            border:
                              pickupDate === b.val ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                            borderRadius: '6px',
                            background: pickupDate === b.val ? '#ede9fe' : '#ffffff',
                            color: pickupDate === b.val ? '#4f46e5' : '#1e293b',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
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
                    style={{
                      width: '100%',
                      maxWidth: '340px',
                      padding: '10px 14px',
                      fontSize: '0.9rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      background: '#ffffff',
                      fontFamily: 'inherit',
                      fontWeight: 700,
                    }}
                  />
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                    Allowed range locked to {todayStr} through {maxDateStr} based on provider rules.
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
                    Accurate weight and dimensions prevent courier weight discrepancy penalties and
                    ensure smooth pickup.
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
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                        style={{
                          padding: '8px 14px',
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          color: '#334155',
                        }}
                      >
                        {p.label} ({p.l}×{p.b}×{p.h}cm, {p.w}kg)
                      </button>
                    ))}
                  </div>
                </div>

                {/* INPUT FIELDS */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '14px',
                    marginBottom: 20,
                  }}
                >
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
                      style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '0.9rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontWeight: 700,
                      }}
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
                      style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '0.9rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontWeight: 700,
                      }}
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
                      style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '0.9rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontWeight: 700,
                      }}
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
                      style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '0.9rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontWeight: 700,
                      }}
                    />
                  </div>
                </div>

                {/* VOLUMETRIC WEIGHT DISPLAY */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '14px',
                  }}
                >
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
                    code, locks the manifest, and updates order status to <strong>SHIPPED</strong>.
                    The customer will be sent an automated dispatch notification email. These values{' '}
                    <strong>CANNOT BE EDITED</strong> without cancelling the shipment.
                  </div>
                </div>

                {/* SUMMARY DETAILS GRID */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '16px',
                    marginBottom: 20,
                  }}
                >
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
                      style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: '8px' }}
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
                              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
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
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Rate & Rating: </span>
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
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
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

          <div style={{ display: 'flex', gap: '10px' }}>
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
  );
}
