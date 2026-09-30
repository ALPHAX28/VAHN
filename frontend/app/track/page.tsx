'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
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
import GuestReturnModal from '@/components/order/GuestReturnModal';
import ReturnCountdownTimer from '@/components/order/ReturnCountdownTimer';
import { cancelCustomerOrderReturn, getPublicOrderInvoice, getPublicTracking } from '@/lib/api';
import type { TrackingInfo } from '@/lib/api/types';
import { prettifyActivityLabel } from '@/lib/shipStatus';

function TrackingContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const isSuccessRedirect = searchParams.get('success') === '1';

  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedReverse, setCopiedReverse] = useState(false);
  const [copiedReplacement, setCopiedReplacement] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [showGuestReturnModal, setShowGuestReturnModal] = useState(false);
  const [showCustomerCancelModal, setShowCustomerCancelModal] = useState(false);
  const [cancellingCustomerReturn, setCancellingCustomerReturn] = useState(false);

  const handleSearch = useCallback(async (searchCode: string) => {
    const trimmed = searchCode.trim();
    if (!trimmed) return;
    setError('');
    setLoading(true);

    try {
      const data = await getPublicTracking(trimmed);
      setTracking(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
      setError(
        msg ||
          'No tracking details found for this Order ID or AWB. Please verify the code and try again.'
      );
      setTracking(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCustomerCancelReturn = async () => {
    const targetId = tracking?.order_id || tracking?.orderId;
    if (!targetId || !tracking) return;
    setCancellingCustomerReturn(true);
    try {
      await cancelCustomerOrderReturn(targetId, {
        reason: 'Customer self-cancelled return request',
        customer_email: tracking.customer_email || undefined,
        customer_phone: tracking.customer_phone || undefined,
      });
      toast.success('Return / Exchange request has been cancelled.');
      setShowCustomerCancelModal(false);
      const activeCode = tracking.order_id || tracking.orderId || query;
      if (activeCode) {
        await handleSearch(activeCode);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
      toast.error(msg || 'Failed to cancel return request.');
    } finally {
      setCancellingCustomerReturn(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [initialQuery, handleSearch]);

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (!val.trim()) {
      setTracking(null);
      setError('');
      if (typeof window !== 'undefined' && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }

  function handleClearSearch() {
    setQuery('');
    setTracking(null);
    setError('');
    if (typeof window !== 'undefined' && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
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

  function handleCopyReverseAwb(awb: string) {
    if (!awb) return;
    navigator.clipboard.writeText(awb);
    setCopiedReverse(true);
    setTimeout(() => setCopiedReverse(false), 2000);
  }

  function handleCopyReplacementAwb(awb: string) {
    if (!awb) return;
    navigator.clipboard.writeText(awb);
    setCopiedReplacement(true);
    setTimeout(() => setCopiedReplacement(false), 2000);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
      alert(msg || 'Failed to retrieve invoice. Please try again later.');
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
    isReturnRejected?: boolean;
  } {
    if (!t) return { index: -1, badgeLabel: 'UNKNOWN' };

    const rawStatus = (t.status || '').toUpperCase().trim();
    const rawReturn = (t.return_status || '').toUpperCase().trim();
    const rawRefund = (t.refund_status || '').toUpperCase().trim();
    const rawCurrent = (t.current_status || t.currentStatus || '').toUpperCase().trim();
    const combined = `${rawStatus} ${rawReturn} ${rawRefund} ${rawCurrent}`.replace(/[-_]/g, ' ');

    if (combined.includes('REJECTED') || rawReturn === 'REJECTED' || rawRefund === 'REJECTED') {
      return { index: -1, badgeLabel: 'RETURN REJECTED', isReturnRejected: true };
    }
    if (
      combined.includes('REFUNDED') ||
      combined.includes('REFUND COMPLETED') ||
      rawRefund === 'REFUNDED' ||
      rawReturn === 'COMPLETED'
    ) {
      return { index: 4, badgeLabel: 'REFUND COMPLETED' };
    }
    if (
      combined.includes('DELIVERED TO WAREHOUSE') ||
      combined.includes('REACHED WAREHOUSE') ||
      rawReturn === 'DELIVERED_TO_WAREHOUSE' ||
      (t.reverse_tracking_data as { delivered_to_warehouse?: boolean })?.delivered_to_warehouse
    ) {
      return { index: 3, badgeLabel: 'DELIVERED TO WAREHOUSE' };
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

  function resolveReplacementMilestone(t: TrackingInfo | null): {
    index: number;
    badgeLabel: string;
  } {
    if (!t) return { index: -1, badgeLabel: 'UNKNOWN' };
    const rawRepl = (t.replacement_status || '').toUpperCase().trim();
    const rawReturn = (t.return_status || '').toUpperCase().trim();
    const combined = `${rawRepl} ${rawReturn}`.replace(/[-_]/g, ' ');

    if (
      combined.includes('COMPLETED') ||
      (combined.includes('DELIVERED') && Boolean(t.replacement_awb))
    ) {
      return { index: 4, badgeLabel: 'EXCHANGE COMPLETED' };
    }
    if (combined.includes('REPLACEMENT DISPATCHED') || t.replacement_awb) {
      return { index: 3, badgeLabel: 'REPLACEMENT DISPATCHED' };
    }
    if (
      combined.includes('DELIVERED TO WAREHOUSE') ||
      combined.includes('REACHED WAREHOUSE') ||
      rawReturn === 'DELIVERED_TO_WAREHOUSE' ||
      (t.reverse_tracking_data as { delivered_to_warehouse?: boolean })?.delivered_to_warehouse
    ) {
      return { index: 2, badgeLabel: 'ORIGINAL AT WAREHOUSE (RESTOCKED)' };
    }
    if (combined.includes('IN TRANSIT')) {
      return { index: 2, badgeLabel: 'ORIGINAL IN TRANSIT' };
    }
    if (combined.includes('PICKED UP') || t.is_picked_up) {
      return { index: 1, badgeLabel: 'ORIGINAL PICKED UP' };
    }
    return { index: 0, badgeLabel: 'EXCHANGE INITIATED' };
  }

  const isReturnCancelled =
    tracking?.return_status === 'CANCELLED' || tracking?.replacement_status === 'CANCELLED';

  const isReturnRejected =
    tracking?.return_status === 'REJECTED' || tracking?.refund_status === 'REJECTED';

  const isReturn = Boolean(
    !isReturnCancelled &&
      (tracking?.isReturn ||
        (tracking?.return_status && tracking.return_status !== 'NONE') ||
        tracking?.reverse_awb ||
        (tracking?.replacement_status && tracking.replacement_status !== 'NONE'))
  );

  const isReplacement = (tracking?.return_type || '').toUpperCase() === 'REPLACEMENT';

  const isDelivered = Boolean(
    tracking?.delivered_at ||
      tracking?.status === 'DELIVERED' ||
      tracking?.shipping_status === 'DELIVERED'
  );

  const hasActiveReturn = Boolean(
    !isReturnCancelled &&
      ((tracking?.return_status && tracking.return_status !== 'NONE') ||
        tracking?.reverse_awb ||
        (tracking?.replacement_status && tracking.replacement_status !== 'NONE'))
  );

  const isWithin10Days = (() => {
    if (!isDelivered || !tracking) return false;
    const dateStr = tracking.delivered_at_iso || tracking.delivered_at;
    if (!dateStr) return true;
    const deliveryMs = new Date(dateStr).getTime();
    if (Number.isNaN(deliveryMs)) return true;
    const diffDays = (Date.now() - deliveryMs) / (1000 * 60 * 60 * 24);
    return diffDays <= 10;
  })();

  const {
    index: currentStepIndex,
    badgeLabel: statusBadgeLabel,
    isCancelled,
    isPaymentFailed,
    isPaymentPending,
  } = isReturn
    ? isReplacement
      ? {
          ...resolveReplacementMilestone(tracking),
          isCancelled: false,
          isPaymentFailed: false,
          isPaymentPending: false,
        }
      : {
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
    { key: 'DELIVERED_TO_WAREHOUSE', label: 'Delivered to Warehouse' },
    { key: 'REFUNDED', label: 'Refund Completed' },
  ];

  const replacementSteps = [
    { key: 'EXCHANGE_REQUESTED', label: 'Exchange Initiated' },
    { key: 'RETURN_PICKED_UP', label: 'Original Picked Up' },
    { key: 'RETURN_IN_TRANSIT', label: 'In Transit to Warehouse' },
    { key: 'REPLACEMENT_DISPATCHED', label: 'Replacement Sent' },
    { key: 'COMPLETED', label: 'Completed' },
  ];

  const activeSteps = isReturn ? (isReplacement ? replacementSteps : returnSteps) : forwardSteps;

  const badgeBg =
    statusBadgeLabel === 'DELIVERED' ||
    statusBadgeLabel === 'REFUND COMPLETED' ||
    statusBadgeLabel === 'EXCHANGE COMPLETED'
      ? '#16a34a'
      : isCancelled || isPaymentFailed || isReturnRejected
        ? '#dc2626'
        : isPaymentPending
          ? '#d97706'
          : isReplacement
            ? '#7c3aed'
            : isReturn
              ? '#fa8c16'
              : '#000';

  const activeCourierName = isReplacement
    ? tracking?.replacement_awb
      ? tracking?.replacement_courier_name || 'Express Courier'
      : tracking?.reverse_courier_name || 'Shiprocket Reverse Logistics'
    : isReturn
      ? tracking?.reverse_courier_name || 'Shiprocket Reverse Logistics'
      : tracking?.courier_name ||
        tracking?.courierName ||
        (isPaymentFailed ? 'None (Payment Failed)' : 'Express Delivery');

  const activeAwbCode = isReplacement
    ? tracking?.replacement_awb || tracking?.reverse_awb || null
    : isReturn
      ? tracking?.reverse_awb || null
      : tracking?.awb_code || tracking?.awbCode || null;

  const activeAwbLabel = isReplacement
    ? tracking?.replacement_awb
      ? 'Replacement AWB'
      : 'Reverse Pickup AWB'
    : isReturn
      ? 'Reverse Pickup AWB'
      : 'AWB';

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
        .tracking-search-form {
          display: flex;
          align-items: stretch;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          border: 2px solid #000;
          background: #fff;
          margin-bottom: 40px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.05);
          overflow: hidden;
        }
        .tracking-search-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          padding-left: 16px;
          color: #888;
          flex-shrink: 0;
        }
        .tracking-search-input {
          flex: 1 1 0%;
          min-width: 0 !important;
          width: 100%;
          box-sizing: border-box;
          padding: 16px 12px;
          border: none;
          font-size: 0.95rem;
          font-weight: 600;
          outline: none;
          letter-spacing: -0.01em;
          background: transparent;
        }
        .tracking-search-clear-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0 10px;
          color: #888;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: color 0.15s ease;
        }
        .tracking-search-clear-btn:hover {
          color: #000;
        }
        .tracking-search-btn {
          background: #000;
          color: #fff;
          border: none;
          padding: 0 24px;
          font-size: 0.85rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: -0.01em;
          cursor: pointer;
          transition: background 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .tracking-search-btn:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }
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
          .tracking-search-icon-wrapper {
            padding-left: 10px !important;
          }
          .tracking-search-input {
            padding: 12px 6px !important;
            font-size: 0.84rem !important;
          }
          .tracking-search-clear-btn {
            padding: 0 6px !important;
          }
          .tracking-search-btn {
            padding: 0 14px !important;
            font-size: 0.78rem !important;
            gap: 4px !important;
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
      <form onSubmit={handleSubmit} className="tracking-search-form">
        <div className="tracking-search-icon-wrapper">
          <SearchIcon size={18} color="#666" />
        </div>
        <input
          type="text"
          className="tracking-search-input"
          placeholder="Enter Order ID or Courier AWB..."
          value={query}
          onChange={handleQueryChange}
        />
        {query && (
          <button
            type="button"
            className="tracking-search-clear-btn"
            onClick={handleClearSearch}
            title="Clear search"
          >
            <XIcon size={14} color="#888" />
          </button>
        )}
        <button type="submit" className="tracking-search-btn" disabled={loading}>
          {loading ? (
            <span>Tracking...</span>
          ) : (
            <>
              <span>Track</span>
              <svg
                aria-hidden="true"
                className="btn-checkout-arrow"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
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
                  {hasActiveReturn
                    ? isReplacement
                      ? 'Size Replacement & Exchange'
                      : 'Automated Return Shipment'
                    : 'Order Shipment'}
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
                  Courier: <strong>{activeCourierName}</strong>
                </span>
                {activeAwbCode && (
                  <span className="tracking-pill">
                    {activeAwbLabel}:{' '}
                    <strong style={{ fontFamily: 'monospace' }}>{activeAwbCode}</strong>
                    <button
                      type="button"
                      onClick={() => handleCopyAwb(activeAwbCode)}
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
                tracking.shipping_status === 'DELIVERED' ||
                tracking.replacement_awb) &&
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

          {/* Stepper Progress Bar (On Top) */}
          <div className="tracking-stepper-container" style={{ margin: '8px 0 28px' }}>
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

          {/* 10-Day Return & Exchange Countdown Timer */}
          {isDelivered && (
            <ReturnCountdownTimer
              deliveredAt={tracking.delivered_at}
              deliveredAtIso={tracking.delivered_at_iso}
              returnStatus={tracking.return_status}
              isDelivered={isDelivered}
            />
          )}

          {/* Rejected Return & Cancelled Refund Notice (QC Failed) */}
          {isReturnRejected && (
            <div
              style={{
                background: '#fef2f2',
                border: '2px solid #ef4444',
                padding: '20px 24px',
                marginBottom: '28px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <AlertCircleIcon size={20} color="#dc2626" />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      background: '#fee2e2',
                      color: '#991b1b',
                      fontSize: '0.68rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      letterSpacing: '0.04em',
                      border: '1px solid #fca5a5',
                    }}
                  >
                    RETURN REJECTED
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: '#7f1d1d',
                      fontWeight: 700,
                    }}
                  >
                    WAREHOUSE QC FAILED
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    color: '#991b1b',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Return Refund Cancelled
                </div>
                <div
                  style={{ fontSize: '0.85rem', color: '#7f1d1d', marginTop: 4, lineHeight: 1.5 }}
                >
                  {tracking.refund_note ||
                    tracking.return_notes ||
                    'The returned item was received at our warehouse but failed quality inspection. Refund request has been cancelled.'}
                </div>
              </div>
            </div>
          )}

          {/* Cancelled Return / Exchange Notice */}
          {isReturnCancelled && !isReturnRejected && (
            <div
              style={{
                background: '#fef2f2',
                border: '2px solid #ef4444',
                padding: '20px 24px',
                marginBottom: '28px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <AlertCircleIcon size={20} color="#dc2626" />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      background: '#fee2e2',
                      color: '#991b1b',
                      fontSize: '0.68rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      letterSpacing: '0.04em',
                      border: '1px solid #fca5a5',
                    }}
                  >
                    REQUEST CANCELLED
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: '#7f1d1d',
                      fontWeight: 700,
                    }}
                  >
                    ORIGINAL SHIPMENT DELIVERED
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    color: '#991b1b',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {isReplacement ? 'Size Exchange Cancelled' : 'Return Request Cancelled'}
                </div>
                <div
                  style={{ fontSize: '0.85rem', color: '#7f1d1d', marginTop: 4, lineHeight: 1.5 }}
                >
                  {tracking.return_notes ||
                    'The return or exchange request for this order was cancelled. Courier reverse pickup has been cancelled, and your original item remains confirmed as delivered.'}
                </div>
              </div>
            </div>
          )}

          {/* Guest Return / Size Exchange Initiation Card (If Delivered & No Active Return & Not Cancelled) */}
          {isDelivered && !hasActiveReturn && !isReturnCancelled && isWithin10Days && (
            <div
              style={{
                background: '#faf5ff',
                border: '2px solid #7c3aed',
                padding: '20px 24px',
                marginBottom: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      background: '#7c3aed',
                      color: '#fff',
                      fontSize: '0.68rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      letterSpacing: '0.04em',
                    }}
                  >
                    VAHN 10-DAY GUARANTEE
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    color: '#581c87',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Need a Different Size or Return?
                </div>
                <div style={{ fontSize: '0.82rem', color: '#6b21a8', marginTop: 3 }}>
                  Delivered on {tracking.delivered_at || 'Recently'}. Request an instant size
                  replacement or return for a 100% refund with automated doorstep pickup.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGuestReturnModal(true)}
                style={{
                  background: '#7c3aed',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 24px',
                  fontSize: '0.82rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
                }}
              >
                <span>Request Return / Size Exchange</span>
                <span style={{ fontSize: '1rem', lineHeight: 1 }}>&rarr;</span>
              </button>
            </div>
          )}

          {/* Active Return & Exchange Logistics Summary */}
          {hasActiveReturn && (
            <div
              style={{
                background: isReplacement ? '#faf5ff' : '#fffaf0',
                border: `1px solid ${isReplacement ? '#c084fc' : '#fed7aa'}`,
                padding: '20px 22px',
                marginBottom: '28px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  paddingBottom: '14px',
                  borderBottom: `1px solid ${isReplacement ? '#f3e8ff' : '#fef3c7'}`,
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <PackageIcon size={20} color={isReplacement ? '#7c3aed' : '#d97706'} />
                  <span
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      color: isReplacement ? '#581c87' : '#92400e',
                    }}
                  >
                    {isReplacement ? 'Size Exchange Details' : 'Return & Refund Details'}
                  </span>
                </div>

                {!tracking.is_picked_up &&
                  ['REQUESTED', 'PICKUP_SCHEDULED'].includes(tracking.return_status || '') && (
                    <button
                      type="button"
                      onClick={() => setShowCustomerCancelModal(true)}
                      style={{
                        background: '#fff',
                        border: '1px solid #ef4444',
                        color: '#dc2626',
                        padding: '5px 10px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        borderRadius: '0px',
                        textTransform: 'uppercase',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <XIcon size={12} color="#dc2626" />
                      Cancel Request
                    </button>
                  )}
              </div>

              {/* Clean Summary Grid */}
              {isReplacement ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '14px',
                  }}
                >
                  <div
                    style={{
                      background: '#ffffff',
                      padding: '14px 16px',
                      border: '1px solid #e9d5ff',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: '#7c3aed',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      Requested Replacement
                    </span>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#111' }}>
                      {tracking.replacement_variant_title || 'New Size Reserved'}
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#ffffff',
                      padding: '14px 16px',
                      border: '1px solid #e9d5ff',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: '#7c3aed',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      Original Item Pickup
                    </span>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                    >
                      <strong
                        style={{ fontFamily: 'monospace', fontSize: '0.88rem', color: '#111' }}
                      >
                        {tracking.reverse_awb || 'Pickup Scheduled'}
                      </strong>
                      {tracking.reverse_awb && (
                        <button
                          type="button"
                          onClick={() => handleCopyReverseAwb(tracking.reverse_awb || '')}
                          className="tracking-copy-btn"
                        >
                          {copiedReverse ? 'Copied!' : 'Copy'}
                        </button>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color:
                          tracking.return_status === 'DELIVERED_TO_WAREHOUSE' ||
                          (tracking.reverse_tracking_data as { delivered_to_warehouse?: boolean })
                            ?.delivered_to_warehouse
                            ? '#2563eb'
                            : tracking.is_picked_up
                              ? '#16a34a'
                              : '#b45309',
                        marginTop: 4,
                      }}
                    >
                      {tracking.return_status === 'DELIVERED_TO_WAREHOUSE' ||
                      (tracking.reverse_tracking_data as { delivered_to_warehouse?: boolean })
                        ?.delivered_to_warehouse
                        ? '✓ Received at Warehouse (Size Restocked)'
                        : tracking.is_picked_up
                          ? '✓ Handed Over to Courier'
                          : 'Awaiting Doorstep Pickup'}
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#ffffff',
                      padding: '14px 16px',
                      border: '1px solid #e9d5ff',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: '#7c3aed',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      Replacement Shipment
                    </span>
                    {tracking.replacement_awb ? (
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'wrap',
                          }}
                        >
                          <strong
                            style={{ fontFamily: 'monospace', fontSize: '0.88rem', color: '#111' }}
                          >
                            {tracking.replacement_awb}
                          </strong>
                          <button
                            type="button"
                            onClick={() => handleCopyReplacementAwb(tracking.replacement_awb || '')}
                            className="tracking-copy-btn"
                          >
                            {copiedReplacement ? 'Copied!' : 'Copy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (tracking.replacement_awb) {
                                setQuery(tracking.replacement_awb);
                                handleSearch(tracking.replacement_awb);
                              }
                            }}
                            style={{
                              background: '#7c3aed',
                              color: '#fff',
                              border: 'none',
                              padding: '2px 8px',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                              marginLeft: '2px',
                            }}
                          >
                            Track &rarr;
                          </button>
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#16a34a',
                            marginTop: 4,
                          }}
                        >
                          ✓ Dispatched ({tracking.replacement_courier_name || 'Express Courier'})
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 3 }}>
                        {tracking.is_picked_up
                          ? 'Processing replacement dispatch'
                          : 'Dispatches once original item is picked up'}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '14px',
                  }}
                >
                  <div
                    style={{
                      background: '#ffffff',
                      padding: '14px 16px',
                      border: '1px solid #fed7aa',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: '#d97706',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      Doorstep Pickup
                    </span>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                    >
                      <strong
                        style={{ fontFamily: 'monospace', fontSize: '0.88rem', color: '#111' }}
                      >
                        {tracking.reverse_awb || 'Pickup Scheduled'}
                      </strong>
                      {tracking.reverse_awb && (
                        <button
                          type="button"
                          onClick={() => handleCopyReverseAwb(tracking.reverse_awb || '')}
                          className="tracking-copy-btn"
                        >
                          {copiedReverse ? 'Copied!' : 'Copy'}
                        </button>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: tracking.is_picked_up ? '#16a34a' : '#b45309',
                        marginTop: 4,
                      }}
                    >
                      {tracking.is_picked_up
                        ? '✓ Handed Over to Courier'
                        : 'Awaiting Doorstep Pickup'}
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#ffffff',
                      padding: '14px 16px',
                      border: '1px solid #fed7aa',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: '#d97706',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      100% Refund
                    </span>
                    <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#111' }}>
                      {tracking.refund_amount
                        ? `₹${tracking.refund_amount.toLocaleString('en-IN')} via Razorpay`
                        : 'Original Payment Method (Razorpay)'}
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: isReturnRejected
                          ? '#dc2626'
                          : tracking.return_status === 'COMPLETED' ||
                              tracking.return_status === 'REFUNDED' ||
                              tracking.refund_status === 'REFUNDED'
                            ? '#16a34a'
                            : tracking.return_status === 'DELIVERED_TO_WAREHOUSE' ||
                                (
                                  tracking.reverse_tracking_data as {
                                    delivered_to_warehouse?: boolean;
                                  }
                                )?.delivered_to_warehouse
                              ? '#2563eb'
                              : '#b45309',
                        marginTop: 4,
                      }}
                    >
                      {isReturnRejected
                        ? '✕ Refund Cancelled (QC Failed)'
                        : tracking.return_status === 'COMPLETED' ||
                            tracking.return_status === 'REFUNDED' ||
                            tracking.refund_status === 'REFUNDED'
                          ? '✓ 100% Refund Credited via Razorpay'
                          : tracking.return_status === 'DELIVERED_TO_WAREHOUSE' ||
                              (
                                tracking.reverse_tracking_data as {
                                  delivered_to_warehouse?: boolean;
                                }
                              )?.delivered_to_warehouse
                            ? '✓ Package at Warehouse (Undergoing Quality Inspection)'
                            : 'Refund processed upon warehouse arrival & QC'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
                    title: prettifyActivityLabel(s.activity) || 'Shipment Update',
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
                  {checkpoints.map((cp, idx) => (
                    <div
                      key={`cp-${cp.title}-${cp.timestamp || ''}-${cp.location || ''}-${cp.description?.slice(0, 15) || ''}`}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '14px',
                        paddingBottom: '14px',
                        borderBottom: idx < checkpoints.length - 1 ? '1px solid #f8f8f8' : 'none',
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          background:
                            idx === 0
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
                            idx === 0
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
                              color: idx === 0 ? '#000' : '#444',
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

          {/* Guest Return Initiation Modal */}
          <GuestReturnModal
            isOpen={showGuestReturnModal}
            onClose={() => setShowGuestReturnModal(false)}
            orderId={tracking.order_id || tracking.orderId || query.trim()}
            tracking={tracking}
            onSuccess={() => {
              const code = tracking.order_id || tracking.orderId || query.trim();
              if (code) handleSearch(code);
            }}
          />
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
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <span>Contact Support</span>
                <svg
                  aria-hidden="true"
                  className="btn-checkout-arrow"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER CANCEL RETURN CONFIRMATION MODAL */}
      {showCustomerCancelModal && tracking && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#fff',
              maxWidth: 480,
              width: '100%',
              padding: 28,
              border: '2px solid #000',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircleIcon size={18} color="#dc2626" />
                Cancel {isReplacement ? 'Size Exchange' : 'Return'} Request
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomerCancelModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to cancel your{' '}
              <strong>{isReplacement ? 'size exchange' : 'return'}</strong> request?
              <br />
              <br />
              Reverse courier doorstep pickup will be cancelled immediately, and your original item
              will remain yours.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowCustomerCancelModal(false)}
                style={{
                  background: '#fff',
                  border: '1px solid #d1d5db',
                  padding: '10px 18px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                Keep Request
              </button>
              <button
                type="button"
                onClick={handleCustomerCancelReturn}
                disabled={cancellingCustomerReturn}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 22px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: cancellingCustomerReturn ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {cancellingCustomerReturn ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
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
