'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  AlertCircleIcon,
  CheckIcon,
  MapPinIcon,
  PackageIcon,
  PrinterIcon,
  SearchIcon,
  ShieldCheckIcon,
  TruckIcon,
  XIcon,
} from '@/components/icons/Icons';
import { getPublicOrderInvoice, getPublicTracking } from '@/lib/api';
import type { TrackingInfo } from '@/lib/api/types';

function TrackingContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const isSuccessRedirect = searchParams.get('success') === '1';

  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  async function handleSearch(searchCode: string) {
    const trimmed = searchCode.trim();
    if (!trimmed) return;
    setError('');
    setLoading(true);

    try {
      const data = await getPublicTracking(trimmed);
      setTracking(data);
    } catch (err: any) {
      setError(
        err?.message ||
          'No tracking details found for this Order ID or AWB. Please verify the code and try again.'
      );
      setTracking(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      handleSearch(query.trim());
    }
  }

  function handleCopyAwb(awb: string) {
    if (!awb) return;
    navigator.clipboard.writeText(awb);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownloadInvoice() {
    const code = tracking?.order_id || tracking?.orderId || query.trim();
    if (!code) return;
    setDownloadingInvoice(true);
    try {
      const res = await getPublicOrderInvoice(code);
      if (res.invoice_url) {
        window.open(res.invoice_url, '_blank');
        return;
      }
      if (res.message) {
        alert(res.message);
      } else {
        alert('Official invoice is currently generating. Please try again in a few moments.');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to retrieve invoice. Please try again later.');
    } finally {
      setDownloadingInvoice(false);
    }
  }

  function resolveForwardMilestone(t: TrackingInfo | null): {
    index: number;
    badgeLabel: string;
    isCancelled: boolean;
    isPaymentFailed: boolean;
    isPaymentPending: boolean;
  } {
    if (!t)
      return {
        index: -1,
        badgeLabel: 'UNKNOWN',
        isCancelled: false,
        isPaymentFailed: false,
        isPaymentPending: false,
      };

    const rawStatus = (t.status || '').toUpperCase().trim();
    const rawPayment = (t.payment_status || '').toUpperCase().trim();
    const rawShipping = (t.shipping_status || '').toUpperCase().trim();
    const rawCurrent = (t.current_status || t.currentStatus || '').toUpperCase().trim();
    const rawMilestone = (t.currentMilestone || '').toUpperCase().trim();
    const combined =
      `${rawStatus} ${rawPayment} ${rawShipping} ${rawCurrent} ${rawMilestone}`.replace(
        /[-_]/g,
        ' '
      );

    // 1. Cancelled
    if (
      rawStatus === 'CANCELLED' ||
      rawShipping === 'CANCELLED' ||
      combined.includes('CANCELLED')
    ) {
      return {
        index: 0,
        badgeLabel: 'CANCELLED',
        isCancelled: true,
        isPaymentFailed: false,
        isPaymentPending: false,
      };
    }

    // 2. Payment Failed (Uncaptured or failed Razorpay session)
    if (
      rawPayment === 'FAILED' ||
      rawStatus === 'PAYMENT_FAILED' ||
      combined.includes('PAYMENT FAILED')
    ) {
      return {
        index: 0,
        badgeLabel: 'PAYMENT FAILED',
        isCancelled: false,
        isPaymentFailed: true,
        isPaymentPending: false,
      };
    }

    // 3. Payment Pending (Awaiting confirmation)
    if (rawStatus === 'PENDING_PAYMENT' || rawPayment === 'PENDING') {
      return {
        index: 0,
        badgeLabel: 'PAYMENT PENDING',
        isCancelled: false,
        isPaymentFailed: false,
        isPaymentPending: true,
      };
    }

    // 4. Delivered
    if (t.delivered_at || combined.includes('DELIVERED') || combined.includes('COMPLETED')) {
      return {
        index: 5,
        badgeLabel: 'DELIVERED',
        isCancelled: false,
        isPaymentFailed: false,
        isPaymentPending: false,
      };
    }

    // 5. Out for delivery
    if (
      combined.includes('OUT FOR DELIVERY') ||
      combined.includes('OUT FOR DISPATCH') ||
      combined.includes('OUT FOR PICKUP')
    ) {
      return {
        index: 4,
        badgeLabel: 'OUT FOR DELIVERY',
        isCancelled: false,
        isPaymentFailed: false,
        isPaymentPending: false,
      };
    }

    // 6. In transit / reached hub
    if (
      combined.includes('IN TRANSIT') ||
      combined.includes('TRANSIT') ||
      combined.includes('REACHED DESTINATION') ||
      combined.includes('REACHED HUB') ||
      combined.includes('AT HUB') ||
      combined.includes('CONNECTED')
    ) {
      return {
        index: 3,
        badgeLabel: 'IN TRANSIT',
        isCancelled: false,
        isPaymentFailed: false,
        isPaymentPending: false,
      };
    }

    // 7. Shipped / Handed to courier
    if (
      t.is_picked_up ||
      combined.includes('PICKED UP') ||
      combined.includes('SHIPPED') ||
      combined.includes('DISPATCHED') ||
      combined.includes('HANDED OVER') ||
      combined.includes('IN FLIGHT')
    ) {
      return {
        index: 2,
        badgeLabel: 'SHIPPED',
        isCancelled: false,
        isPaymentFailed: false,
        isPaymentPending: false,
      };
    }

    // 8. Packed / Ready for pickup / Manifest generated / AWB assigned
    if (
      combined.includes('MANIFEST GENERATED') ||
      combined.includes('MANIFESTED') ||
      combined.includes('READY TO SHIP') ||
      combined.includes('AWB ASSIGNED') ||
      combined.includes('PICKUP SCHEDULED') ||
      combined.includes('PICKUP GENERATED') ||
      combined.includes('LABEL GENERATED') ||
      combined.includes('PACKED') ||
      (t.awb_code && t.awb_code.trim().length > 0)
    ) {
      return {
        index: 1,
        badgeLabel: 'PACKED / READY FOR PICKUP',
        isCancelled: false,
        isPaymentFailed: false,
        isPaymentPending: false,
      };
    }

    // 9. Ordered / Placed / Verified
    return {
      index: 0,
      badgeLabel: 'ORDER CONFIRMED',
      isCancelled: false,
      isPaymentFailed: false,
      isPaymentPending: false,
    };
  }

  function resolveReturnMilestone(t: TrackingInfo | null): {
    index: number;
    badgeLabel: string;
  } {
    if (!t) return { index: -1, badgeLabel: 'UNKNOWN' };

    const rawStatus = (t.status || '').toUpperCase().trim();
    const rawReturn = (t.return_status || '').toUpperCase().trim();
    const rawCurrent = (t.current_status || t.currentStatus || '').toUpperCase().trim();
    const combined = `${rawStatus} ${rawReturn} ${rawCurrent}`.replace(/[-_]/g, ' ');

    if (combined.includes('REFUNDED') || combined.includes('REFUND COMPLETED')) {
      return { index: 4, badgeLabel: 'REFUND COMPLETED' };
    }
    if (combined.includes('REFUND INITIATED') || combined.includes('REFUND DISPATCHED')) {
      return { index: 3, badgeLabel: 'REFUND INITIATED' };
    }
    if (
      combined.includes('RETURN IN TRANSIT') ||
      combined.includes('RETURNING TO HUB') ||
      (combined.includes('IN TRANSIT') && Boolean(t.reverse_awb))
    ) {
      return { index: 2, badgeLabel: 'RETURN IN TRANSIT' };
    }
    if (
      combined.includes('RETURN PICKED UP') ||
      combined.includes('PICKED UP') ||
      combined.includes('DOORSTEP COLLECTION')
    ) {
      return { index: 1, badgeLabel: 'RETURN PICKED UP' };
    }
    return { index: 0, badgeLabel: 'RETURN INITIATED' };
  }

  const isReturn = Boolean(
    tracking?.isReturn ||
      (tracking?.return_status && tracking.return_status !== 'NONE') ||
      tracking?.reverse_awb
  );

  const {
    index: currentStepIndex,
    badgeLabel: statusBadgeLabel,
    isCancelled,
    isPaymentFailed,
    isPaymentPending,
  } = isReturn
    ? {
        ...resolveReturnMilestone(tracking),
        isCancelled: false,
        isPaymentFailed: false,
        isPaymentPending: false,
      }
    : resolveForwardMilestone(tracking);

  const forwardSteps = [
    {
      key: 'PLACED',
      label: isCancelled
        ? 'Cancelled'
        : isPaymentFailed
          ? 'Payment Failed'
          : isPaymentPending
            ? 'Payment Pending'
            : 'Ordered',
    },
    { key: 'PROCESSING', label: 'Packed' },
    { key: 'SHIPPED', label: 'Shipped' },
    { key: 'IN_TRANSIT', label: 'In Transit' },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
    { key: 'DELIVERED', label: 'Delivered' },
  ];

  const returnSteps = [
    { key: 'RETURN_REQUESTED', label: 'Return Initiated' },
    { key: 'RETURN_PICKED_UP', label: 'Picked Up' },
    { key: 'RETURN_IN_TRANSIT', label: 'In Transit' },
    { key: 'REFUND_INITIATED', label: 'Refund Initiated' },
    { key: 'REFUNDED', label: 'Refund Completed' },
  ];

  const activeSteps = isReturn ? returnSteps : forwardSteps;

  const badgeBg =
    statusBadgeLabel === 'DELIVERED' || statusBadgeLabel === 'REFUND COMPLETED'
      ? '#16a34a'
      : isCancelled || isPaymentFailed
        ? '#dc2626'
        : isPaymentPending
          ? '#d97706'
          : '#000';

  const rawLocation = (tracking?.current_location || tracking?.currentLocation || '').trim();
  const isValidLocation = Boolean(
    rawLocation &&
      ![
        'in transit',
        'transit',
        'unfulfilled',
        'processing',
        'manifest generated',
        'origin facility',
        'pending',
        'unknown',
        'n/a',
      ].includes(rawLocation.toLowerCase()) &&
      !rawLocation.toLowerCase().includes('transit') &&
      !rawLocation.toLowerCase().includes('unfulfilled') &&
      !rawLocation.toLowerCase().includes('processing') &&
      !rawLocation.toLowerCase().includes('manifest')
  );

  return (
    <div
      className="tracking-page-container"
      style={{
        maxWidth: 880,
        margin: '48px auto 100px',
        padding: '0 20px',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {/* Responsive Styles */}
      <style>{`
        .tracking-card {
          border: 1px solid #000;
          background: #fff;
          padding: 28px 32px;
          box-shadow: 0 6px 24px rgba(0,0,0,0.06);
        }
        .tracking-card-header {
          border-bottom: 1px solid #f0f0f0;
          padding-bottom: 22px;
          margin-bottom: 28px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .tracking-card-header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }
        .tracking-shipment-type {
          font-size: 0.72rem;
          font-weight: 800;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          display: block;
          margin-bottom: 4px;
        }
        .tracking-order-id {
          font-size: 1.45rem;
          font-weight: 900;
          margin: 0;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        .tracking-badge-container {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }
        .tracking-status-badge {
          display: inline-block;
          font-size: 0.75rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          padding: 6px 14px;
          border-radius: 2px;
          white-space: nowrap;
        }
        .tracking-est-delivery {
          font-size: 0.78rem;
          color: #666;
          margin-top: 2px;
        }
        .tracking-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .tracking-meta-pills {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }
        .tracking-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 5px 10px;
          font-size: 0.8rem;
          color: #475569;
          border-radius: 3px;
        }
        .tracking-pill strong {
          color: #0f172a;
        }
        .tracking-copy-btn {
          background: #fff;
          border: 1px solid #cbd5e1;
          font-size: 0.68rem;
          padding: 2px 6px;
          cursor: pointer;
          font-weight: 700;
          text-transform: uppercase;
          border-radius: 2px;
        }
        .tracking-invoice-btn {
          background: #000;
          color: #fff;
          border: 1px solid #000;
          padding: 7px 16px;
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 2px;
          letter-spacing: -0.01em;
          transition: all 0.2s ease;
        }
        .tracking-stepper-container {
          margin: 24px 0 36px;
          overflow-x: auto;
          padding-bottom: 10px;
          -webkit-overflow-scrolling: touch;
        }
        .tracking-stepper-grid {
          display: grid;
          position: relative;
          min-width: 520px;
        }
        .tracking-stepper-line {
          position: absolute;
          top: 14px;
          height: 2px;
          z-index: 0;
        }
        .tracking-step-circle {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.72rem;
          font-weight: 900;
          margin-bottom: 8px;
          transition: all 0.3s ease;
          border-radius: 0;
        }
        .tracking-step-label {
          font-size: 0.78rem;
          text-transform: uppercase;
          line-height: 1.25;
        }

        @media (max-width: 640px) {
          .tracking-page-container {
            margin: 24px auto 60px !important;
            padding: 0 14px !important;
          }
          .tracking-card {
            padding: 20px 16px !important;
          }
          .tracking-card-header-top {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
          }
          .tracking-badge-container {
            align-items: flex-start !important;
            width: 100% !important;
          }
          .tracking-meta-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .tracking-meta-pills {
            width: 100% !important;
          }
          .tracking-pill {
            font-size: 0.75rem !important;
            padding: 4px 8px !important;
          }
          .tracking-invoice-btn {
            width: 100% !important;
            justify-content: center !important;
            padding: 10px !important;
          }
          .tracking-stepper-container {
            margin: 18px 0 28px !important;
            overflow-x: visible !important;
            padding-bottom: 0 !important;
          }
          .tracking-stepper-grid {
            min-width: 0 !important;
            width: 100% !important;
          }
          .tracking-step-circle {
            width: 22px !important;
            height: 22px !important;
            font-size: 0.65rem !important;
            margin-bottom: 4px !important;
            border-radius: 0 !important;
          }
          .tracking-step-label {
            font-size: 0.58rem !important;
            letter-spacing: -0.02em !important;
            line-height: 1.15 !important;
            padding: 0 1px !important;
            word-break: break-word !important;
          }
          .tracking-stepper-line {
            top: 11px !important;
          }
          .tracking-search-form {
            margin-bottom: 24px !important;
          }
        }
      `}</style>

      {/* Checkout Success Banner (Shown only for actual successful prepaid orders) */}
      {isSuccessRedirect && !isPaymentFailed && !isCancelled && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            padding: '18px 24px',
            marginBottom: '36px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: '#16a34a',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CheckIcon size={16} color="#fff" />
          </div>
          <div>
            <h2
              style={{
                fontSize: '1rem',
                fontWeight: 900,
                color: '#166534',
                margin: '0 0 2px',
                textTransform: 'uppercase',
              }}
            >
              Order & Payment Confirmed
            </h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#15803d' }}>
              Thank you for choosing VAHN. Your prepaid payment is verified and live shipment
              tracking is displayed below.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div
          style={{
            display: 'inline-block',
            background: '#f3f4f6',
            color: '#555',
            fontSize: '0.7rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '4px 12px',
            marginBottom: '12px',
          }}
        >
          VAHN Fulfillment & Tracking
        </div>
        <h1
          style={{
            fontSize: 'clamp(1.75rem, 3.5vw, 2.4rem)',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '-0.03em',
            margin: '0 0 10px',
            color: '#000',
          }}
        >
          Track Your Order
        </h1>
        <p
          style={{
            color: '#666',
            fontSize: '0.92rem',
            maxWidth: 520,
            margin: '0 auto',
            lineHeight: 1.5,
          }}
        >
          Enter your Order ID or Courier AWB number below to view live delivery status and
          checkpoint scans.
        </p>
      </div>

      {/* Search Bar */}
      <form
        onSubmit={handleSubmit}
        className="tracking-search-form"
        style={{
          display: 'flex',
          border: '2px solid #000',
          background: '#fff',
          marginBottom: '40px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '16px', color: '#888' }}>
          <SearchIcon size={18} color="#666" />
        </div>
        <input
          type="text"
          placeholder="Enter Order ID (e.g. ORD-820990) or Courier AWB..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: 1,
            padding: '16px 14px',
            border: 'none',
            fontSize: '0.95rem',
            fontWeight: 600,
            outline: 'none',
            letterSpacing: '-0.01em',
            background: 'transparent',
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setTracking(null);
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 12px',
              color: '#888',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Clear search"
          >
            <XIcon size={14} color="#888" />
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            background: '#000',
            color: '#fff',
            border: 'none',
            padding: '0 28px',
            fontSize: '0.85rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {loading ? (
            <span>Tracking...</span>
          ) : (
            <>
              <span>Track</span>
              <span>→</span>
            </>
          )}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            padding: '16px 20px',
            marginBottom: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#dc2626',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          <AlertCircleIcon size={18} color="#dc2626" />
          <span>{error}</span>
        </div>
      )}

      {/* Tracking Result View */}
      {tracking ? (
        <div className="tracking-card">
          {/* Header Summary */}
          <div className="tracking-card-header">
            <div className="tracking-card-header-top">
              <div>
                <span className="tracking-shipment-type">
                  {tracking.isReturn ? 'Return Shipment' : 'Order Shipment'}
                </span>
                <h2 className="tracking-order-id">{tracking.order_id || tracking.orderId}</h2>
              </div>

              <div className="tracking-badge-container">
                <span
                  className="tracking-status-badge"
                  style={{
                    background: badgeBg,
                    color: '#fff',
                  }}
                >
                  {statusBadgeLabel}
                </span>
                {tracking.estimatedDelivery && (
                  <div className="tracking-est-delivery">
                    Est. Delivery: <strong>{tracking.estimatedDelivery}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Courier & AWB Meta Row */}
            <div className="tracking-meta-row">
              <div className="tracking-meta-pills">
                <span className="tracking-pill">
                  Courier:{' '}
                  <strong>
                    {tracking.courier_name ||
                      tracking.courierName ||
                      (isPaymentFailed ? 'None (Payment Failed)' : 'Express Delivery')}
                  </strong>
                </span>
                {(tracking.awb_code || tracking.awbCode) && (
                  <span className="tracking-pill">
                    AWB:{' '}
                    <strong style={{ fontFamily: 'monospace' }}>
                      {tracking.awb_code || tracking.awbCode}
                    </strong>
                    <button
                      type="button"
                      onClick={() => handleCopyAwb(tracking.awb_code || tracking.awbCode || '')}
                      className="tracking-copy-btn"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </span>
                )}
              </div>

              {(tracking.awb_code ||
                tracking.awbCode ||
                tracking.status === 'SHIPPED' ||
                tracking.status === 'DELIVERED' ||
                tracking.shipping_status === 'SHIPPED' ||
                tracking.shipping_status === 'DELIVERED') &&
                !isPaymentFailed && (
                  <button
                    type="button"
                    onClick={handleDownloadInvoice}
                    disabled={downloadingInvoice}
                    className="tracking-invoice-btn"
                  >
                    <PrinterIcon size={13} color="#fff" />
                    {downloadingInvoice ? 'Fetching...' : 'Download Invoice'}
                  </button>
                )}
            </div>
          </div>

          {/* Payment Failed Notice Banner */}
          {isPaymentFailed && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                padding: '16px 20px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                color: '#991b1b',
              }}
            >
              <AlertCircleIcon size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                  }}
                >
                  Payment Failed — Order Incomplete
                </div>
                <div style={{ fontSize: '0.84rem', lineHeight: 1.5, color: '#7f1d1d' }}>
                  {tracking.cancellation_reason
                    ? `${tracking.cancellation_reason} `
                    : 'The online payment for this order was not completed or failed at checkout. '}
                  Because no funds were captured, this order cannot be fulfilled, dispatched, or
                  shipped.
                </div>
              </div>
            </div>
          )}

          {/* Payment Pending Notice Banner */}
          {isPaymentPending && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fcd34d',
                padding: '16px 20px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                color: '#92400e',
              }}
            >
              <AlertCircleIcon size={20} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                  }}
                >
                  Payment Pending Confirmation
                </div>
                <div style={{ fontSize: '0.84rem', lineHeight: 1.5, color: '#78350f' }}>
                  We are waiting for payment verification from your bank or payment gateway. Once
                  verified, order fulfillment will begin immediately.
                </div>
              </div>
            </div>
          )}

          {/* Cancelled Notice Banner */}
          {isCancelled && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                padding: '14px 18px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#991b1b',
                fontSize: '0.85rem',
                fontWeight: 700,
              }}
            >
              <AlertCircleIcon size={18} color="#dc2626" />
              <span>
                This order has been cancelled.{' '}
                {tracking.cancellation_reason ? `Reason: ${tracking.cancellation_reason}. ` : ''}
                Prepaid payments are refunded to your original payment method.
              </span>
            </div>
          )}

          {/* Real physical location banner */}
          {isValidLocation && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '12px 18px',
                marginBottom: '28px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.85rem',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '0px',
                  background: '#2563eb',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontWeight: 800, color: '#1e293b' }}>Current Location:</span>
              <span style={{ color: '#334155' }}>{rawLocation}</span>
            </div>
          )}

          {/* Stepper Progress */}
          <div className="tracking-stepper-container">
            <div
              className="tracking-stepper-grid"
              style={{
                gridTemplateColumns: `repeat(${activeSteps.length}, 1fr)`,
              }}
            >
              {/* Background connecting line */}
              <div
                className="tracking-stepper-line"
                style={{
                  left: `calc(100% / (${activeSteps.length} * 2))`,
                  right: `calc(100% / (${activeSteps.length} * 2))`,
                  background: '#e5e7eb',
                }}
              />
              {/* Active connecting line */}
              <div
                className="tracking-stepper-line"
                style={{
                  left: `calc(100% / (${activeSteps.length} * 2))`,
                  width: `calc((100% - 100% / ${activeSteps.length}) * ${
                    !isCancelled && !isPaymentFailed && currentStepIndex >= 0
                      ? currentStepIndex / (activeSteps.length - 1)
                      : 0
                  })`,
                  background:
                    isCancelled || isPaymentFailed
                      ? '#dc2626'
                      : isPaymentPending
                        ? '#d97706'
                        : '#000',
                  transition: 'width 0.4s ease',
                }}
              />

              {activeSteps.map((step, idx) => {
                const isFailedStep = (isCancelled || isPaymentFailed) && idx === 0;
                const isPendingStep = isPaymentPending && idx === 0;
                const isPassed = !isCancelled && !isPaymentFailed && currentStepIndex >= idx;
                const isCurrent = !isCancelled && !isPaymentFailed && currentStepIndex === idx;

                const circleBg = isFailedStep
                  ? '#dc2626'
                  : isPendingStep
                    ? '#d97706'
                    : isPassed
                      ? '#000'
                      : '#fff';

                const circleBorder = isFailedStep
                  ? '2px solid #dc2626'
                  : isPendingStep
                    ? '2px solid #d97706'
                    : isPassed
                      ? '2px solid #000'
                      : '2px solid #d1d5db';

                const circleColor = isFailedStep || isPendingStep || isPassed ? '#fff' : '#9ca3af';

                const labelColor = isFailedStep
                  ? '#dc2626'
                  : isPendingStep
                    ? '#d97706'
                    : isPassed
                      ? '#000'
                      : '#9ca3af';

                const circleContent = isFailedStep
                  ? '✕'
                  : isPendingStep
                    ? '⏳'
                    : isPassed
                      ? '✓'
                      : idx + 1;

                return (
                  <div
                    key={step.key}
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      className="tracking-step-circle"
                      style={{
                        background: circleBg,
                        border: circleBorder,
                        color: circleColor,
                        borderRadius: '0px',
                        boxShadow: isCurrent
                          ? '0 0 0 4px rgba(0,0,0,0.12)'
                          : isFailedStep
                            ? '0 0 0 4px rgba(220,38,38,0.15)'
                            : 'none',
                      }}
                    >
                      {circleContent}
                    </div>
                    <div
                      className="tracking-step-label"
                      style={{
                        fontWeight: isCurrent || isFailedStep || isPendingStep ? 900 : 700,
                        color: labelColor,
                      }}
                    >
                      {step.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Activity Checkpoints */}
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '24px' }}>
            <h3
              style={{
                fontSize: '0.85rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                margin: '0 0 16px',
                color: '#333',
              }}
            >
              Checkpoint Scans & Transit History
            </h3>

            {(() => {
              // Construct unified checkpoints from live scans, milestones, or synthesized order milestones
              const checkpoints: Array<{
                title: string;
                description?: string | null;
                location?: string | null;
                timestamp?: string | null;
              }> = [];

              const rawScans = isReturn
                ? tracking?.reverse_scans && tracking.reverse_scans.length > 0
                  ? tracking.reverse_scans
                  : tracking?.scans || []
                : tracking?.scans && tracking.scans.length > 0
                  ? tracking.scans
                  : [];

              if (tracking?.milestones && tracking.milestones.length > 0) {
                tracking.milestones.forEach((m) => {
                  checkpoints.push({
                    title: m.title,
                    description: m.description,
                    location: m.location,
                    timestamp: m.timestamp,
                  });
                });
              } else if (rawScans.length > 0) {
                const reversedScans = [...rawScans].reverse();
                reversedScans.forEach((s) => {
                  checkpoints.push({
                    title: s.activity || 'Shipment Scan',
                    location: s.location || undefined,
                    timestamp: s.date || undefined,
                  });
                });
                if (isPaymentFailed) {
                  checkpoints.push({
                    title: 'Payment Failed — Order Incomplete',
                    description:
                      tracking.cancellation_reason ||
                      'Online payment was not captured or failed at checkout.',
                    timestamp: tracking.created_at || 'Recent',
                  });
                } else if (isPaymentPending) {
                  checkpoints.push({
                    title: 'Order Received — Awaiting Payment',
                    description: 'Order is registered. Awaiting payment verification.',
                    timestamp: tracking.created_at || 'Recent',
                  });
                } else if (isCancelled) {
                  checkpoints.push({
                    title: 'Order Cancelled',
                    description: tracking.cancellation_reason || 'Order was cancelled.',
                    timestamp: tracking.created_at || 'Recent',
                  });
                } else {
                  checkpoints.push({
                    title: 'Order Placed & Payment Confirmed',
                    description: `Order #${tracking.order_id || tracking.orderId} placed successfully. Prepaid payment confirmed.`,
                    timestamp: tracking.created_at || 'Recent',
                  });
                }
              } else if (tracking) {
                if (isCancelled) {
                  checkpoints.push({
                    title: 'Order Cancelled',
                    description: tracking.cancellation_reason
                      ? `Cancellation Reason: ${tracking.cancellation_reason}`
                      : 'Order was cancelled. Any prepaid payment has been refunded.',
                    timestamp: tracking.created_at || 'Recent',
                  });
                } else if (isPaymentFailed) {
                  checkpoints.push({
                    title: 'Payment Failed — Order Incomplete',
                    description: tracking.cancellation_reason
                      ? `Reason: ${tracking.cancellation_reason}`
                      : 'Online payment was not captured or was declined by the bank. Order cannot be fulfilled.',
                    timestamp: tracking.created_at || 'Recent',
                  });
                } else if (isPaymentPending) {
                  checkpoints.push({
                    title: 'Order Received — Awaiting Payment',
                    description:
                      'Order is registered and awaiting payment verification from payment gateway.',
                    timestamp: tracking.created_at || 'Recent',
                  });
                } else {
                  if (currentStepIndex >= 5) {
                    checkpoints.push({
                      title: 'Package Delivered',
                      description: 'Shipment was delivered successfully.',
                      timestamp: tracking.delivered_at || 'Delivered',
                    });
                  }
                  if (currentStepIndex >= 4) {
                    checkpoints.push({
                      title: 'Out for Delivery',
                      description: 'Package is out for delivery with the courier agent.',
                      timestamp: 'In Progress',
                    });
                  }
                  if (currentStepIndex >= 3) {
                    checkpoints.push({
                      title: 'In Transit',
                      description: isValidLocation
                        ? `Package is in transit to destination facility near ${rawLocation}.`
                        : 'Package is in transit to destination facility.',
                      timestamp: 'In Progress',
                    });
                  }
                  if (currentStepIndex >= 2) {
                    checkpoints.push({
                      title: 'Handed Over to Courier',
                      description: `Package picked up by ${tracking.courier_name || tracking.courierName || 'Courier Partner'}.`,
                      timestamp: 'Dispatched',
                    });
                  }
                  if (currentStepIndex >= 1) {
                    checkpoints.push({
                      title: 'Packed & Ready for Pickup',
                      description: tracking.awb_code
                        ? `Assigned to ${tracking.courier_name || tracking.courierName || 'Express Delivery'} (AWB: ${tracking.awb_code})`
                        : 'Order is packed and awaiting courier pickup at fulfillment facility.',
                      timestamp: 'Packed',
                    });
                  }
                  checkpoints.push({
                    title: 'Order Placed & Payment Confirmed',
                    description: `Order #${tracking.order_id || tracking.orderId} placed successfully. Prepaid payment confirmed.`,
                    timestamp: tracking.created_at || 'Recent',
                  });
                }
              }

              if (checkpoints.length === 0) {
                return (
                  <div style={{ color: '#666', fontSize: '0.85rem', padding: '12px 0' }}>
                    Shipment is registered. Live checkpoints will update automatically once scanned
                    at the dispatch hub.
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {checkpoints.map((cp, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '14px',
                        paddingBottom: '14px',
                        borderBottom: i < checkpoints.length - 1 ? '1px solid #f8f8f8' : 'none',
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          background:
                            i === 0
                              ? isCancelled || isPaymentFailed
                                ? '#dc2626'
                                : isPaymentPending
                                  ? '#d97706'
                                  : '#16a34a'
                              : '#cbd5e1',
                          borderRadius: '0px',
                          marginTop: '5px',
                          flexShrink: 0,
                          boxShadow:
                            i === 0
                              ? `0 0 0 3px ${
                                  isCancelled || isPaymentFailed
                                    ? 'rgba(220,38,38,0.2)'
                                    : isPaymentPending
                                      ? 'rgba(217,119,6,0.2)'
                                      : 'rgba(22,163,74,0.2)'
                                }`
                              : 'none',
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            flexWrap: 'wrap',
                            gap: 6,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: '0.88rem',
                              textTransform: 'uppercase',
                              color: i === 0 ? '#000' : '#444',
                            }}
                          >
                            {cp.title}
                          </div>
                          {cp.timestamp && (
                            <div style={{ fontSize: '0.75rem', color: '#888' }}>{cp.timestamp}</div>
                          )}
                        </div>
                        {cp.description && (
                          <div style={{ fontSize: '0.82rem', color: '#555', marginTop: '2px' }}>
                            {cp.description}
                          </div>
                        )}
                        {cp.location && (
                          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                            📍 {cp.location}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        /* Empty State / Helpful Information Cards */
        <div style={{ marginTop: '32px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '20px',
            }}
          >
            <div style={{ border: '1px solid #e5e7eb', padding: '24px', background: '#fafafa' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: '#000',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                <TruckIcon size={18} color="#fff" />
              </div>
              <h3
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  margin: '0 0 6px',
                }}
              >
                Fast Express Dispatch
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#666', lineHeight: 1.5 }}>
                Orders are processed and dispatched within 24–48 business hours with automated
                courier allocation.
              </p>
            </div>

            <div style={{ border: '1px solid #e5e7eb', padding: '24px', background: '#fafafa' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: '#000',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                <MapPinIcon size={18} color="#fff" />
              </div>
              <h3
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  margin: '0 0 6px',
                }}
              >
                Live Checkpoint Scans
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#666', lineHeight: 1.5 }}>
                Track package movements step-by-step from sorting facility to out-for-delivery with
                SMS alerts.
              </p>
            </div>

            <div style={{ border: '1px solid #e5e7eb', padding: '24px', background: '#fafafa' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: '#000',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                <ShieldCheckIcon size={18} color="#fff" />
              </div>
              <h3
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  margin: '0 0 6px',
                }}
              >
                Need Help?
              </h3>
              <p
                style={{ margin: '0 0 10px', fontSize: '0.82rem', color: '#666', lineHeight: 1.5 }}
              >
                Questions regarding your shipment? Our customer support team is available to assist
                you.
              </p>
              <Link
                href="/pages/contact"
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#000',
                  textDecoration: 'underline',
                }}
              >
                Contact Support →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '100px', textAlign: 'center', color: '#666' }}>
          Loading tracking portal...
        </div>
      }
    >
      <TrackingContent />
    </Suspense>
  );
}
