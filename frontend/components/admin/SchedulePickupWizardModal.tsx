'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  type AdminOrder,
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
  // Wizard step state (1: Courier, 2: Date, 3: Package, 4: Summary)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Data fetching state
  const [loadingCouriers, setLoadingCouriers] = useState<boolean>(true);
  const [courierError, setCourierError] = useState<string>('');
  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [warehouseInfo, setWarehouseInfo] = useState<PickupWarehouseInfo | null>(null);

  // Form selections
  const [selectedCourierId, setSelectedCourierId] = useState<number | null>(null);
  const [pickupDate, setPickupDate] = useState<string>('');
  const [deadWeight, setDeadWeight] = useState<number>(0.5);
  const [length, setLength] = useState<number>(31);
  const [breadth, setBreadth] = useState<number>(41);
  const [height, setHeight] = useState<number>(2);

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

        // Initialize package details from stored dims or default
        if (res.stored_weight && res.stored_weight > 0) {
          setDeadWeight(res.stored_weight);
        }
        if (res.stored_dims?.length) setLength(res.stored_dims.length);
        if (res.stored_dims?.breadth) setBreadth(res.stored_dims.breadth);
        if (res.stored_dims?.height) setHeight(res.stored_dims.height);

        // Select current courier if matches or first courier
        const currentMatch = res.couriers.find((c) => c.is_current);
        if (currentMatch) {
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

  // Format date helper
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
        toast.success(res.message || 'Pickup scheduled successfully with courier partner!');
        // Refresh order details
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
    order.user_name || order.guest_name || shippingAddr.name || shippingAddr.fullName || 'Customer';
  const customerPhone = order.guest_phone || shippingAddr.phone || 'N/A';
  const customerEmail = order.user_email || order.guest_email || 'N/A';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '16px',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: '740px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          position: 'relative',
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '20px 24px',
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
              Shiprocket Logistics Dispatch
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
              Schedule Courier Pickup • Order #{order.id}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.5rem',
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
                  // Only allow jumping back to completed steps
                  if (s.num < currentStep) setCurrentStep(s.num);
                }}
                disabled={s.num > currentStep}
                style={{
                  flex: 1,
                  padding: '12px 6px',
                  background: isActive ? '#ffffff' : isCompleted ? '#f1f5f9' : '#f8fafc',
                  border: 'none',
                  borderBottom: isActive ? '3px solid #4232d9' : '3px solid transparent',
                  color: isActive ? '#4232d9' : isCompleted ? '#0f172a' : '#94a3b8',
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
                <span>{isCompleted ? '✓' : s.num}.</span>
                <span>{s.label.split('. ')[1]}</span>
              </button>
            );
          })}
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {/* STEP 1: SELECT COURIER PARTNER */}
          {currentStep === 1 && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 900,
                    margin: '0 0 6px',
                    color: '#0f172a',
                    textTransform: 'uppercase',
                  }}
                >
                  Step 1: Select Courier Partner
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                  Live serviceability rates directly from Shiprocket for delivery PIN{' '}
                  <strong style={{ color: '#0f172a' }}>
                    {shippingAddr.postalCode || shippingAddr.pincode || '110001'}
                  </strong>
                  . Selecting a partner synchronizes both ways and assigns the AWB code.
                </p>
              </div>

              {loadingCouriers && (
                <div
                  style={{
                    padding: '40px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                  }}
                >
                  <div
                    style={{
                      display: 'inline-block',
                      width: '28px',
                      height: '28px',
                      border: '3px solid #e2e8f0',
                      borderTopColor: '#4232d9',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      marginBottom: '12px',
                    }}
                  />
                  <div style={{ fontSize: '0.86rem', color: '#475569', fontWeight: 600 }}>
                    Connecting to Shiprocket courier network...
                  </div>
                </div>
              )}

              {courierError && !loadingCouriers && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    padding: '12px 16px',
                    fontSize: '0.82rem',
                    marginBottom: 16,
                  }}
                >
                  ⚠️ {courierError}
                </div>
              )}

              {!loadingCouriers && couriers.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    maxHeight: '360px',
                    overflowY: 'auto',
                    paddingRight: '4px',
                  }}
                >
                  {couriers.map((c) => {
                    const isSelected = selectedCourierId === c.courier_company_id;
                    const isStrictTwo =
                      c.pickup_constraint === 'within_2_days' || c.pickup_days_window <= 2;
                    return (
                      <button
                        type="button"
                        key={c.courier_company_id}
                        onClick={() => setSelectedCourierId(c.courier_company_id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          font: 'inherit',
                          border: isSelected ? '2px solid #4232d9' : '1px solid #e2e8f0',
                          background: isSelected ? '#f5f3ff' : '#ffffff',
                          padding: '14px 16px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <input
                            type="radio"
                            name="courier_choice"
                            checked={isSelected}
                            onChange={() => setSelectedCourierId(c.courier_company_id)}
                            style={{ cursor: 'pointer', accentColor: '#4232d9' }}
                          />
                          <div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>
                                {c.courier_name}
                              </strong>
                              {c.is_current && (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    background: '#ecfdf5',
                                    color: '#047857',
                                    padding: '2px 6px',
                                    borderRadius: '2px',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Assigned
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  background: c.is_surface ? '#f1f5f9' : '#e0e7ff',
                                  color: c.is_surface ? '#475569' : '#3730a3',
                                  padding: '2px 6px',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {c.is_surface ? 'Surface' : 'Air'}
                              </span>
                            </div>

                            <div
                              style={{
                                marginTop: '4px',
                                fontSize: '0.76rem',
                                color: '#64748b',
                                display: 'flex',
                                gap: '12px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <span>
                                SLA:{' '}
                                <strong style={{ color: '#0f172a' }}>
                                  {c.estimated_delivery_days
                                    ? `${c.estimated_delivery_days} days`
                                    : '2-4 days'}
                                </strong>
                              </span>
                              <span>
                                Window:{' '}
                                <strong
                                  style={{
                                    color: isStrictTwo ? '#d97706' : '#059669',
                                  }}
                                >
                                  {isStrictTwo ? 'Within 2 Days' : 'Flexible (7 Days)'}
                                </strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              fontSize: '1.05rem',
                              fontWeight: 900,
                              color: '#0f172a',
                            }}
                          >
                            ₹{c.rate.toFixed(2)}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Est. Rate</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: SELECT PICKUP DATE */}
          {currentStep === 2 && (
            <div>
              <div style={{ marginBottom: 16 }}>
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
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                  Selected Courier:{' '}
                  <strong style={{ color: '#4232d9' }}>
                    {selectedCourier?.courier_name || 'Selected Partner'}
                  </strong>
                </p>
              </div>

              {/* COURIER SLA CONSTRAINT BANNER */}
              {isStrictTwoDays ? (
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    padding: '14px 16px',
                    marginBottom: 20,
                    borderLeft: '4px solid #f59e0b',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: '0.84rem',
                      color: '#92400e',
                      marginBottom: 4,
                    }}
                  >
                    ⏱️ Mandatory 2-Day Courier SLA Window
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#78350f', lineHeight: 1.45 }}>
                    <strong>{selectedCourier?.courier_name}</strong> requires pickup allocations
                    strictly within <strong>2 business days (Today or Tomorrow)</strong>. The
                    calendar below has been automatically restricted to prevent courier manifest
                    rejection.
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    padding: '14px 16px',
                    marginBottom: 20,
                    borderLeft: '4px solid #10b981',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: '0.84rem',
                      color: '#166534',
                      marginBottom: 4,
                    }}
                  >
                    📅 Flexible Pickup Scheduling Available
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#14532d', lineHeight: 1.45 }}>
                    <strong>{selectedCourier?.courier_name}</strong> allows scheduling pickup
                    anytime up to <strong>{allowedDaysCount} days in advance</strong>. Select your
                    preferred date below.
                  </div>
                </div>
              )}

              {/* QUICK DATE SELECTOR BUTTONS */}
              <div style={{ marginBottom: 18 }}>
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
                  Quick Selection:
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
                      for (let i = 2; i < Math.min(allowedDaysCount, 5); i++) {
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
                          border: pickupDate === b.val ? '2px solid #4232d9' : '1px solid #cbd5e1',
                          background: pickupDate === b.val ? '#ede9fe' : '#ffffff',
                          color: pickupDate === b.val ? '#4232d9' : '#1e293b',
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

              {/* INTERACTIVE CALENDAR DATE PICKER */}
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
                    padding: '12px 14px',
                    fontSize: '0.9rem',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontFamily: 'inherit',
                    fontWeight: 600,
                  }}
                />
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                  Allowed range automatically locked to {todayStr} through {maxDateStr} based on
                  provider rules.
                </div>
              </div>

              {/* CHOSEN DATE DISPLAY BADGE */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
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
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                    {formatReadableDate(pickupDate)}
                  </div>
                </div>
                <span
                  style={{
                    background: '#4232d9',
                    color: '#ffffff',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                  }}
                >
                  Ready for Dispatch
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: PACKAGE DETAILS */}
          {currentStep === 3 && (
            <div>
              <div style={{ marginBottom: 16 }}>
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
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                  Accurate dimensions ensure correct volumetric billing and prevent courier weight
                  discrepancy penalties on manifest generation.
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
                        padding: '6px 12px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.75rem',
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
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '12px',
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
                      fontWeight: 700,
                    }}
                  />
                </div>
              </div>

              {/* LIVE VOLUMETRIC WEIGHT DISPLAY */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '16px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '12px',
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
                    Volumetric (L×B×H / 5000)
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                    {volumetricWeight.toFixed(3)} kg
                  </div>
                </div>
                <div
                  style={{
                    background: '#ede9fe',
                    padding: '8px 12px',
                    border: '1px solid #ddd6fe',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: '#5b21b6', fontWeight: 800 }}>
                    Applied Billable Weight
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#4232d9' }}>
                    {billedWeight.toFixed(3)} kg
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: FINAL SUMMARY SCREEN */}
          {currentStep === 4 && (
            <div>
              <div style={{ marginBottom: 16 }}>
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
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                  Please review all selected logistics parameters before confirming pickup.
                </p>
              </div>

              {/* CRITICAL WARNING BANNER */}
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #f87171',
                  borderLeft: '5px solid #dc2626',
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
                  <span>⚠️ Non-Modifiable After Scheduling</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#7f1d1d', lineHeight: 1.45 }}>
                  Once you confirm and schedule pickup, these values{' '}
                  <strong>CANNOT BE CHANGED</strong>. Shiprocket and the courier partner lock the
                  manifest immediately. Courier assignment, scheduled date, and package dimensions
                  become final.
                </div>
              </div>

              {/* SUMMARY DETAILS GRID */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  marginBottom: 20,
                }}
              >
                {/* COURIER & DATE CARD */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: '14px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: '#4232d9',
                      marginBottom: 8,
                    }}
                  >
                    Logistics Partner & Date
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Courier: </span>
                    <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>
                      {selectedCourier?.courier_name || 'Selected Partner'}
                    </strong>
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Rate / SLA: </span>
                    <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>
                      ₹{selectedCourier?.rate.toFixed(2) || '0.00'} •{' '}
                      {selectedCourier?.estimated_delivery_days || 3} days transit
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Pickup Date: </span>
                    <strong style={{ fontSize: '0.86rem', color: '#16a34a' }}>
                      {formatReadableDate(pickupDate)}
                    </strong>
                  </div>
                </div>

                {/* PACKAGE SPECS CARD */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: '14px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: '#4232d9',
                      marginBottom: 8,
                    }}
                  >
                    Package Dimensions & Weight
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Dimensions: </span>
                    <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>
                      {length} × {breadth} × {height} cm
                    </strong>
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Dead Weight: </span>
                    <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>
                      {deadWeight.toFixed(3)} kg
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Applied Weight: </span>
                    <strong style={{ fontSize: '0.86rem', color: '#4232d9' }}>
                      {billedWeight.toFixed(3)} kg (Vol: {volumetricWeight.toFixed(3)} kg)
                    </strong>
                  </div>
                </div>

                {/* ORIGIN PICKUP WAREHOUSE */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
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
                    📍 Pickup Location (Origin Warehouse)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#334155', lineHeight: 1.4 }}>
                    <strong>{warehouseInfo?.pickup_location || 'Home Warehouse'}</strong>
                    <br />
                    {warehouseInfo?.address || 'VAHN Sports Fulfillment Centre'}
                    {warehouseInfo?.city ? `, ${warehouseInfo.city}` : ''}
                    {warehouseInfo?.state ? `, ${warehouseInfo.state}` : ''}
                    {warehouseInfo?.pin_code ? ` - ${warehouseInfo.pin_code}` : ''}
                    {warehouseInfo?.phone ? ` • Tel: ${warehouseInfo.phone}` : ''}
                  </div>
                </div>

                {/* DESTINATION CUSTOMER DETAILS */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
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
                    📦 Customer & Delivery Destination
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#334155', lineHeight: 1.4 }}>
                    <strong>{customerName}</strong> ({customerPhone} • {customerEmail})
                    <br />
                    {shippingAddr.address1 || shippingAddr.address || 'Address'}
                    {shippingAddr.address2 ? `, ${shippingAddr.address2}` : ''}
                    <br />
                    {shippingAddr.city || ''}
                    {shippingAddr.state ? `, ${shippingAddr.state}` : ''} -{' '}
                    <strong>{shippingAddr.postalCode || shippingAddr.pincode || ''}</strong>
                  </div>
                </div>
              </div>

              {submitError && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #f87171',
                    color: '#b91c1c',
                    padding: '10px 14px',
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
                  color: '#334155',
                  padding: '10px 18px',
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
                  color: '#64748b',
                  padding: '10px 18px',
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
                  background: '#4232d9',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 22px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor:
                    currentStep === 1 && (!selectedCourierId || loadingCouriers)
                      ? 'not-allowed'
                      : 'pointer',
                  textTransform: 'uppercase',
                  opacity: currentStep === 1 && (!selectedCourierId || loadingCouriers) ? 0.6 : 1,
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
                    padding: '10px 26px',
                    fontSize: '0.84rem',
                    fontWeight: 900,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
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
                      Scheduling...
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
