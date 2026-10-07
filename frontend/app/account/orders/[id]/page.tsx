'use client';

import Image from 'next/image';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronLeftIcon,
  MapPinIcon,
  PackageIcon,
  PhoneIcon,
  PrinterIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TruckIcon,
  XIcon,
} from '@/components/icons/Icons';
import ReturnCountdownTimer from '@/components/order/ReturnCountdownTimer';
import { useAuth } from '@/context/AuthContext';
import {
  cancelCustomerOrderReturn,
  cancelOrder,
  checkReverseShippingServiceability,
  getCustomerOrderInvoice,
  getOrderDetail,
  getOrderExchangeOptions,
  getOrderTracking,
  requestOrderReturn,
} from '@/lib/api';
import { formatISTDate } from '@/lib/utils/date';
import type {
  ExchangeItemOption,
  ExchangeVariantOption,
  OrderDetail,
  OrderExchangeOptionsResponse,
  TrackingInfo,
} from '@/lib/api/types';
import { parseCheckpointDate, prettifyActivityLabel, prettifyShipStatus } from '@/lib/shipStatus';

const STATUS_STEPS = [
  {
    key: 'PROCESSING',
    label: 'Order Placed & Processing',
    sublabel: 'Confirmed',
    IconComponent: PackageIcon,
  },
  { key: 'SHIPPED', label: 'Shipped & In Transit', sublabel: 'En Route', IconComponent: TruckIcon },
  { key: 'DELIVERED', label: 'Delivered', sublabel: 'Completed', IconComponent: SparklesIcon },
];

function getStatusColor(status: string) {
  if (status === 'DELIVERED') return { bg: '#ecfdf5', text: '#15803d', border: '#16a34a' };
  if (status === 'SHIPPED') return { bg: '#eff6ff', text: '#1d4ed8', border: '#3b82f6' };
  if (status === 'CANCELLED' || status === 'FAILED' || status === 'PAYMENT_FAILED')
    return { bg: '#fef2f2', text: '#dc2626', border: '#ef4444' };
  if (status === 'REFUNDED') return { bg: '#ecfdf5', text: '#15803d', border: '#16a34a' };
  return { bg: '#fffbeb', text: '#b45309', border: '#d97706' };
}

function getCustomerReturnBadge(order: {
  returnStatus?: string | null;
  returnType?: string | null;
  replacementStatus?: string | null;
  isReturnPickedUp?: boolean;
}) {
  if (order.returnType === 'REPLACEMENT') {
    if (order.replacementStatus === 'DELIVERED' || order.replacementStatus === 'COMPLETED') {
      return { title: 'Replacement Delivered', badge: 'EXCHANGE COMPLETED', color: '#16a34a' };
    }
    if (
      order.replacementStatus === 'REPLACEMENT_DISPATCHED' ||
      order.replacementStatus === 'DISPATCHED'
    ) {
      return { title: 'Replacement Dispatched', badge: 'DISPATCHED', color: '#16a34a' };
    }
    if (
      order.replacementStatus === 'PICKED_UP' ||
      order.returnStatus === 'PICKED_UP' ||
      order.returnStatus === 'DELIVERED_TO_WAREHOUSE' ||
      order.isReturnPickedUp
    ) {
      return { title: 'Original Item Picked Up', badge: 'ORIGINAL PICKED UP', color: '#2563eb' };
    }
    if (order.replacementStatus === 'CANCELLED' || order.returnStatus === 'CANCELLED') {
      return { title: 'Exchange Cancelled', badge: 'CANCELLED', color: '#dc2626' };
    }
    return { title: 'Exchange Request Registered', badge: 'EXCHANGE REQUESTED', color: '#000' };
  }

  // Return for 100% Refund
  if (order.returnStatus === 'REFUNDED' || order.returnStatus === 'COMPLETED') {
    return { title: '100% Refund Credited', badge: 'REFUNDED', color: '#16a34a' };
  }
  if (order.returnStatus === 'REJECTED') {
    return { title: 'Return Request Rejected', badge: 'REJECTED', color: '#dc2626' };
  }
  if (order.returnStatus === 'CANCELLED') {
    return { title: 'Return Request Cancelled', badge: 'CANCELLED', color: '#dc2626' };
  }
  if (
    order.returnStatus === 'PICKED_UP' ||
    order.returnStatus === 'DELIVERED_TO_WAREHOUSE' ||
    order.isReturnPickedUp
  ) {
    return {
      title: 'Package Picked Up — Refund Processing',
      badge: 'PACKAGE PICKED UP',
      color: '#2563eb',
    };
  }
  return { title: 'Return Pickup Scheduled', badge: 'PICKUP SCHEDULED', color: '#000' };
}

import { useRouter, useSearchParams } from 'next/navigation';

export default function CustomerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = use(params);
  const { token, user, openAuthModal } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuccess = searchParams?.get('success') === '1';

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Live tracking modal states
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingModalData, setTrackingModalData] = useState<TrackingInfo | null>(null);
  const [loadingTrackingModal, setLoadingTrackingModal] = useState(false);
  const [activeTrackingTab, setActiveTrackingTab] = useState<
    'forward' | 'reverse' | 'replacement'
  >('forward');
  const [copiedAwb, setCopiedAwb] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  useEffect(() => {
    if (orderId === 'undefined' || !orderId) {
      router.replace('/account/orders');
      return;
    }
    if (!token) return;
    loadOrder();
  }, [token, orderId]);

  async function loadOrder() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getOrderDetail(token, orderId);
      setOrder(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  }

  const [showCancelReturnModal, setShowCancelReturnModal] = useState(false);
  const [cancellingReturn, setCancellingReturn] = useState(false);

  async function handleCustomerCancelReturn() {
    if (!order) return;
    setCancellingReturn(true);
    try {
      const updated = await cancelCustomerOrderReturn(
        order.id,
        {
          reason: 'Customer self-cancelled return request',
        },
        token || undefined
      );
      setOrder(updated);
      toast.success('Return / Exchange request has been cancelled.');
      setShowCancelReturnModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
      toast.error(msg || 'Failed to cancel return request.');
    } finally {
      setCancellingReturn(false);
    }
  }

  async function handleOpenTrackingModal(
    tab: 'forward' | 'reverse' | 'replacement' = 'forward'
  ) {
    if (!order) return;
    setActiveTrackingTab(tab);
    setShowTrackingModal(true);
    setLoadingTrackingModal(true);
    try {
      const data = await getOrderTracking(order.id, token || undefined);
      setTrackingModalData(data);
    } catch {
      setTrackingModalData(null);
    } finally {
      setLoadingTrackingModal(false);
    }
  }

  function handleCopyAwb(code: string) {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedAwb(true);
    setTimeout(() => setCopiedAwb(false), 2000);
  }

  async function handleDownloadInvoice() {
    if (!order) return;
    setDownloadingInvoice(true);
    try {
      const res = await getCustomerOrderInvoice(order.id, token || undefined);
      if (res?.invoice_url) {
        window.open(res.invoice_url, '_blank');
        toast.success('Official Shiprocket tax invoice opened in new tab.');
        return;
      } else {
        toast.error(
          'Official Shiprocket tax invoice is being generated. Please check back shortly.'
        );
      }
    } catch (err: any) {
      console.warn('Failed to fetch official Shiprocket invoice', err);
      toast.error(
        err?.message ||
          'Official Shiprocket tax invoice is being generated by courier. Please try again shortly.'
      );
    } finally {
      setDownloadingInvoice(false);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && showTrackingModal) {
        setShowTrackingModal(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showTrackingModal]);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [returnActionType, setReturnActionType] = useState<'REPLACEMENT' | 'RETURN'>('REPLACEMENT');
  const [returnReason, setReturnReason] = useState('SIZE_FIT');
  const [returnNotes, setReturnNotes] = useState('');
  const [exchangeOptions, setExchangeOptions] = useState<OrderExchangeOptionsResponse | null>(null);
  const [loadingExchangeOptions, setLoadingExchangeOptions] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedVariantTitle, setSelectedVariantTitle] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [revServiceable, setRevServiceable] = useState<{
    serviceable: boolean;
    courierName?: string;
    message?: string;
  } | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  async function handleOpenReturnModal() {
    if (!order) return;
    setShowReturnModal(true);
    setReturnActionType('REPLACEMENT');
    setReturnReason('SIZE_FIT');
    setReturnNotes('');
    setLoadingExchangeOptions(true);

    const pin =
      order.shippingAddress?.postalCode ||
      (order.shippingAddress as Record<string, string> | undefined)?.pincode;
    if (pin && String(pin).trim().length === 6) {
      checkReverseShippingServiceability(String(pin).trim())
        .then((resp) => {
          setRevServiceable({
            serviceable: resp.serviceable,
            courierName: resp.courier_name || undefined,
            message: resp.message || undefined,
          });
        })
        .catch(() => {
          setRevServiceable(null);
        });
    }

    try {
      const res = await getOrderExchangeOptions(order.id, token || undefined);
      setExchangeOptions(res);
      if (res?.items && res.items.length > 0) {
        const firstItem = res.items[0];
        setSelectedItemId(firstItem.item_id);
        // Pre-select first available replacement variant
        const firstAvail = firstItem.variants.find((v) => v.is_available && !v.is_current);
        if (firstAvail) {
          setSelectedVariantId(firstAvail.variant_id);
          setSelectedVariantTitle(firstAvail.title);
        } else {
          setSelectedVariantId('');
          setSelectedVariantTitle('');
        }
      }
    } catch (err) {
      console.error('Failed to load exchange options:', err);
    } finally {
      setLoadingExchangeOptions(false);
    }
  }

  async function handleCancelOrder() {
    if (!token || !order) return;
    setSubmittingAction(true);
    setActionMessage(null);
    try {
      const res = await cancelOrder(
        order.id,
        cancelReason || 'Customer requested cancellation before dispatch',
        token
      );
      setActionMessage({
        type: 'success',
        text: `Order #${order.id} cancelled. 100% refund of ₹${parseFloat(order.totalPrice.amount).toLocaleString()} initiated via Razorpay (Refund ID: ${res.refund_id || 'Active'}).`,
      });
      setShowCancelModal(false);
      loadOrder();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'Failed to cancel order. Please contact support.',
      });
    } finally {
      setSubmittingAction(false);
    }
  }

  async function handleRequestReturn() {
    if (!token || !order) return;
    if (returnActionType === 'REPLACEMENT' && !selectedVariantId) {
      setActionMessage({
        type: 'error',
        text: 'Please select an available size for exchange, or switch to Return for 100% Refund.',
      });
      return;
    }
    setSubmittingAction(true);
    setActionMessage(null);
    try {
      const res = await requestOrderReturn(
        order.id,
        {
          action: returnActionType,
          reason: returnReason,
          notes: returnNotes,
          order_item_id: selectedItemId || undefined,
          replacement_variant_id:
            returnActionType === 'REPLACEMENT' ? selectedVariantId : undefined,
        },
        token
      );

      if (returnActionType === 'REPLACEMENT') {
        setActionMessage({
          type: 'success',
          text: `Size replacement requested for Order #${order.id}! Replacement item (${selectedVariantTitle}) reserved in warehouse. Shiprocket reverse pickup scheduled${res.reverseAwb ? ` (AWB: ${res.reverseAwb})` : ''}. Courier scan will trigger immediate replacement dispatch!`,
        });
      } else {
        setActionMessage({
          type: 'success',
          text: `Return requested for Order #${order.id}! Shiprocket reverse pickup scheduled${res.reverseAwb ? ` (AWB: ${res.reverseAwb})` : ''}. Courier scan will automatically disburse your 100% refund via Razorpay.`,
        });
      }
      setShowReturnModal(false);
      loadOrder();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'Failed to submit return request.',
      });
    } finally {
      setSubmittingAction(false);
    }
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 560, margin: '100px auto', padding: '0 24px', textAlign: 'center' }}>
        <h2
          style={{
            fontSize: '1.3rem',
            fontWeight: 900,
            textTransform: 'uppercase',
            margin: '0 0 16px',
          }}
        >
          Please Sign In
        </h2>
        <button
          type="button"
          onClick={() => openAuthModal()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#000',
            fontWeight: 800,
            textDecoration: 'underline',
            fontSize: '0.9rem',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <span>Sign In</span>
          <svg
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
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid #000',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <span
          style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#666',
            textTransform: 'uppercase',
            letterSpacing: '-0.025em',
          }}
        >
          Loading order #{orderId}...
        </span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div
          style={{
            width: 52,
            height: 52,
            border: '2px solid #dc2626',
            background: '#fef2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <span style={{ fontSize: '1.5rem', color: '#dc2626' }}>!</span>
        </div>
        <h2
          style={{
            fontSize: '1.2rem',
            fontWeight: 900,
            textTransform: 'uppercase',
            margin: '0 0 8px',
          }}
        >
          Order Not Found
        </h2>
        <p style={{ color: '#666', fontSize: '0.875rem', margin: '0 0 20px' }}>
          {error || 'Unable to locate this order.'}
        </p>
        <Link
          href="/account/orders"
          style={{
            display: 'inline-block',
            background: '#000',
            color: '#fff',
            padding: '12px 24px',
            fontWeight: 900,
            textDecoration: 'none',
            textTransform: 'uppercase',
            fontSize: '0.82rem',
          }}
        >
          ← Back to Orders
        </Link>
      </div>
    );
  }

  // Checkpoint scans preparation
  const rawForwardScans =
    trackingModalData?.scans && trackingModalData.scans.length > 0
      ? trackingModalData.scans
      : order.trackingData?.scans && order.trackingData.scans.length > 0
        ? order.trackingData.scans
        : [];
  const activeForwardScans = [...rawForwardScans].sort(
    (a, b) => parseCheckpointDate(b.date) - parseCheckpointDate(a.date)
  );

  const rawReverseScans =
    trackingModalData?.reverse_scans && trackingModalData.reverse_scans.length > 0
      ? trackingModalData.reverse_scans
      : order.reverseTrackingData?.scans && order.reverseTrackingData.scans.length > 0
        ? order.reverseTrackingData.scans
        : [];
  const activeReverseScans = [...rawReverseScans].sort(
    (a, b) => parseCheckpointDate(b.date) - parseCheckpointDate(a.date)
  );

  const rawReplacementScans =
    trackingModalData?.replacement_scans && trackingModalData.replacement_scans.length > 0
      ? trackingModalData.replacement_scans
      : [];
  const activeReplacementScans = [...rawReplacementScans].sort(
    (a, b) => parseCheckpointDate(b.date) - parseCheckpointDate(a.date)
  );

  const hasForwardDeliveredScan = Boolean(
    activeForwardScans.some(
      (s) =>
        !/undelivered|cancel/i.test(s.activity || '') &&
        /delivered|package delivered|delivered to recipient|shipment delivered/i.test(s.activity || '')
    )
  );

  const isDelivered = Boolean(
    order.status === 'DELIVERED' ||
      order.shippingStatus === 'DELIVERED' ||
      trackingModalData?.is_delivered ||
      order.deliveredAt ||
      hasForwardDeliveredScan
  );

  // Order is considered shipped ONLY when admin has dispatched via Shiprocket API
  const isShipped = Boolean(
    order.status !== 'CANCELLED' &&
      (order.status === 'SHIPPED' ||
        isDelivered ||
        order.shippingStatus === 'SHIPPED' ||
        order.shippingStatus === 'IN_TRANSIT' ||
        order.shippingStatus === 'PICKED_UP' ||
        order.shippingStatus === 'MANIFEST_GENERATED' ||
        order.shippingStatus === 'DELIVERED') &&
      Boolean(order.shiprocketAwb || order.trackingData?.awb)
  );

  // Calculate status tracker step index & live logistics snapshot
  let stepIndex = 0;
  if (isDelivered) {
    stepIndex = 2;
  } else if (isShipped) {
    stepIndex = 1;
  } else {
    stepIndex = 0;
  }

  const isCancelled = order.status === 'CANCELLED';
  const isFailed =
    order.status === 'FAILED' ||
    order.status === 'PAYMENT_FAILED' ||
    order.paymentStatus === 'FAILED';
  const canDownloadInvoice = !isFailed && !isCancelled && Boolean(order.shiprocketAwb) && isShipped;

  // Strictly dynamic courier location from API (latest chronological checkpoint with valid location)
  const latestValidFwdScan = activeForwardScans.find(
    (s) =>
      s.location &&
      s.location.trim() &&
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
      ].includes(s.location.trim().toLowerCase())
  );

  const rawForwardLoc = (
    latestValidFwdScan?.location ||
    trackingModalData?.current_location ||
    order.trackingData?.current_location ||
    ''
  ).trim();

  const isInvalidForwardLoc =
    !rawForwardLoc ||
    [
      'in transit',
      'transit',
      'unfulfilled',
      'processing',
      'manifest generated',
      'origin facility',
      'pending',
      'unknown',
      'n/a',
    ].includes(rawForwardLoc.toLowerCase()) ||
    rawForwardLoc.toLowerCase().includes('transit');

  const forwardCurrentLoc = isShipped && !isInvalidForwardLoc ? rawForwardLoc : null;

  // Synthesized forward milestone scans if courier live scans haven't populated yet
  const displayForwardScans: Array<{
    activity: string;
    date?: string | null;
    location?: string | null;
  }> = [];
  if (activeForwardScans.length > 0) {
    displayForwardScans.push(...activeForwardScans);
  } else {
    const synthesized: Array<{ activity: string; date?: string | null; location?: string | null }> = [];
    synthesized.push({
      activity: 'Order Placed & Payment Confirmed',
      date: order.createdAt
        ? formatISTDate(order.createdAt, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Confirmed',
      location: 'Prepaid Verified',
    });
    if (
      order.status === 'PROCESSING' ||
      isShipped ||
      order.shippingStatus === 'IN_TRANSIT' ||
      order.shippingStatus === 'DELIVERED'
    ) {
      synthesized.push({
        activity: 'Packed & Ready for Pickup',
        date: 'Packed',
        location: order.shiprocketAwb ? `AWB: ${order.shiprocketAwb}` : 'Fulfillment Facility',
      });
    }
    if (
      isShipped ||
      order.shippingStatus === 'IN_TRANSIT' ||
      order.shippingStatus === 'DELIVERED'
    ) {
      synthesized.push({
        activity: 'Handed Over to Courier',
        date: 'Dispatched',
        location:
          order.shiprocketCourierName || trackingModalData?.courier_name || 'Express Courier',
      });
      synthesized.push({
        activity: 'In Transit',
        date: 'In Progress',
        location: forwardCurrentLoc || 'Destination Hub',
      });
    }
    const isOutForDelivery =
      !isDelivered &&
      (order.shippingStatus === 'OUT_FOR_DELIVERY' ||
        order.shippingStatus === 'OUT FOR DELIVERY' ||
        activeForwardScans.some((s) => /out for delivery|out for dispatch/i.test(s.activity || '')));
    if (isOutForDelivery) {
      synthesized.push({
        activity: 'Out for Delivery',
        date: 'In Progress',
        location: order.shippingAddress?.city || null,
      });
    }
    if (isDelivered || order.status === 'DELIVERED' || order.shippingStatus === 'DELIVERED') {
      synthesized.push({
        activity: 'Package Delivered',
        date: order.deliveredAt
          ? formatISTDate(order.deliveredAt, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Delivered',
        location: order.shippingAddress?.city || null,
      });
    }
    displayForwardScans.push(...synthesized.reverse());
  }

  const reverseCurrentLoc =
    trackingModalData?.current_location ||
    order.reverseTrackingData?.current_location ||
    (activeReverseScans.length > 0
      ? activeReverseScans[activeReverseScans.length - 1]?.location
      : null);

  const isReturnPickedUp =
    trackingModalData?.is_picked_up ??
    order.reverseTrackingData?.is_picked_up ??
    (order.returnStatus === 'PICKED_UP' ||
      order.returnStatus === 'REFUNDED' ||
      activeReverseScans.some((s: any) =>
        String(s.activity || '')
          .toLowerCase()
          .includes('picked up')
      ));

  const addr = order.shippingAddress || {};
  const statusColors = getStatusColor(order.status);

  return (
    <>
      {/* WEB VIEW CONTENT (Hidden during print) */}
      <div className="vahn-no-print">
        {isSuccess && (
          <div
            style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              padding: '16px 20px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#10b981',
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
              <div
                style={{
                  fontWeight: 800,
                  color: '#065f46',
                  fontSize: '0.95rem',
                  textTransform: 'uppercase',
                }}
              >
                Order Placed Successfully!
              </div>
              <div style={{ fontSize: '0.82rem', color: '#047857', marginTop: '2px' }}>
                Thank you for your purchase. We have verified your payment and our fulfillment
                center is preparing your gear.
              </div>
            </div>
          </div>
        )}

        {/* Header: Back link + order meta + print button */}
        <div style={{ marginBottom: 28 }}>
          <Link
            href="/account/orders"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#666',
              fontSize: '0.78rem',
              fontWeight: 700,
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '-0.025em',
              marginBottom: 12,
            }}
          >
            <ChevronLeftIcon size={14} color="#666" />
            My Orders
          </Link>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 900,
                  margin: '0 0 4px',
                  letterSpacing: '-0.025em',
                }}
              >
                Order #{order.id}
              </h1>
              <span style={{ fontSize: '0.83rem', color: '#888' }}>
                Placed on {order.createdAt}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>

              {['PROCESSING', 'CONFIRMED', 'PENDING'].includes(order.status) &&
                !['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(
                  order.shippingStatus || ''
                ) && (
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                    style={{
                      background: '#fff',
                      border: '2px solid #dc2626',
                      color: '#dc2626',
                      padding: '10px 18px',
                      fontSize: '0.8rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '-0.025em',
                    }}
                  >
                    Cancel Order
                  </button>
                )}

              {(isDelivered || order.status === 'DELIVERED') &&
                (!order.returnStatus || order.returnStatus === 'NONE') && (
                  <button
                    type="button"
                    onClick={handleOpenReturnModal}
                    style={{
                      background: '#000',
                      border: '2px solid #000',
                      color: '#fff',
                      padding: '10px 18px',
                      fontSize: '0.8rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '-0.025em',
                    }}
                  >
                    Request 10-Day Return / Exchange
                  </button>
                )}

              {canDownloadInvoice && (
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  disabled={downloadingInvoice}
                  style={{
                    background: '#fff',
                    border: '2px solid #000',
                    color: '#000',
                    padding: '10px 20px',
                    fontSize: '0.8rem',
                    fontWeight: 900,
                    cursor: downloadingInvoice ? 'not-allowed' : 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.025em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    flexShrink: 0,
                    opacity: downloadingInvoice ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!downloadingInvoice) e.currentTarget.style.background = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    if (!downloadingInvoice) e.currentTarget.style.background = '#fff';
                  }}
                >
                  <PrinterIcon size={15} color="#000" />
                  {downloadingInvoice ? 'Fetching Invoice...' : 'Download Tax Invoice'}
                </button>
              )}
            </div>
          </div>

          {actionMessage && (
            <div
              style={{
                background: actionMessage.type === 'success' ? '#f6ffed' : '#fff2f0',
                border: `1px solid ${actionMessage.type === 'success' ? '#b7eb8f' : '#ffccc7'}`,
                color: actionMessage.type === 'success' ? '#389e0d' : '#cf1322',
                padding: '12px 16px',
                marginTop: '16px',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              {actionMessage.text}
            </div>
          )}
        </div>

        {/* 10-Day Return / Exchange Real-Time Countdown Window */}
        {(isDelivered || order.status === 'DELIVERED') && (!order.returnStatus || order.returnStatus === 'NONE') && (
          <ReturnCountdownTimer
            deliveredAt={order.deliveredAt}
            deliveredAtIso={order.deliveredAtIso}
            returnStatus={order.returnStatus}
            isDelivered={isDelivered || order.status === 'DELIVERED'}
          />
        )}

        {/* Order Fulfillment Tracker */}
        {isCancelled ? (
          /* ======================================================== */
          /* CLEAN, SIMPLIFIED ORDER CANCELLED & REFUND CARD          */
          /* ======================================================== */
          <div
            className="vahn-order-card"
            style={{
              borderLeft: '4px solid #ef4444',
              padding: '24px 28px',
              marginBottom: 24,
              background: '#fff',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 14,
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <XIcon size={18} color="#dc2626" />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '-0.02em',
                      margin: 0,
                    }}
                  >
                    Order Cancelled
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#666' }}>
                    {order.cancellationReason || 'Cancelled by customer before dispatch'}
                  </p>
                </div>
              </div>

              <span
                style={{
                  background: order.refundStatus === 'REFUNDED' ? '#f0fdf4' : '#fef3c7',
                  color: order.refundStatus === 'REFUNDED' ? '#16a34a' : '#b45309',
                  border: `1px solid ${order.refundStatus === 'REFUNDED' ? '#bbf7d0' : '#fde68a'}`,
                  padding: '5px 14px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '-0.01em',
                }}
              >
                {order.refundStatus === 'REFUNDED' ? '100% Refund Completed' : 'Refund in Process'}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 20,
                paddingTop: 16,
                borderTop: '1px solid #f0f0f0',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#888',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 2,
                  }}
                >
                  Refund Amount
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#000' }}>
                  ₹{parseFloat(order.totalPrice.amount).toLocaleString()}
                </span>
              </div>

              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#888',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 2,
                  }}
                >
                  Refund Method
                </span>
                <span style={{ fontWeight: 700, color: '#000' }}>
                  Original Payment Method (Razorpay)
                </span>
              </div>

              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#888',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 2,
                  }}
                >
                  Refund Status
                </span>
                <span
                  style={{
                    fontWeight: 800,
                    color: order.refundStatus === 'REFUNDED' ? '#16a34a' : '#b45309',
                  }}
                >
                  {order.refundStatus === 'REFUNDED'
                    ? 'Disbursed to Source Account'
                    : 'Initiated via Razorpay'}
                </span>
              </div>

              {order.refundedAt && (
                <div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: '#888',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      display: 'block',
                      marginBottom: 2,
                    }}
                  >
                    Processed Date
                  </span>
                  <span style={{ fontWeight: 700, color: '#000' }}>{order.refundedAt}</span>
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: 18,
                padding: '12px 16px',
                background: '#fafafa',
                border: '1px solid #e5e7eb',
                fontSize: '0.82rem',
                color: '#555',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: '#000' }}>Direct Source Account Refund:</strong> Because your
              order was cancelled prior to courier dispatch, a 100% refund of ₹
              {parseFloat(order.totalPrice.amount).toLocaleString()} was initiated back to your
              original payment method via Razorpay. Depending on your bank (UPI / Card /
              NetBanking), it typically reflects within 2–5 business days.
            </div>
          </div>
        ) : isFailed ? (
          /* ======================================================== */
          /* CLEAN, DEDICATED PAYMENT FAILED / ORDER INCOMPLETE CARD   */
          /* ======================================================== */
          <div
            className="vahn-order-card"
            style={{
              borderLeft: '4px solid #ef4444',
              padding: '24px 28px',
              marginBottom: 24,
              background: '#fff',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 14,
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <XIcon size={18} color="#dc2626" />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '-0.02em',
                      margin: 0,
                      color: '#111',
                    }}
                  >
                    Payment Unsuccessful
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#666' }}>
                    {order.cancellationReason ||
                      'The payment transaction was declined by your bank or the session expired.'}
                  </p>
                </div>
              </div>

              <span
                style={{
                  background: '#fef2f2',
                  color: '#dc2626',
                  border: '1px solid #ef4444',
                  padding: '5px 14px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '-0.01em',
                }}
              >
                FAILED
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 20,
                paddingTop: 16,
                borderTop: '1px solid #f0f0f0',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#888',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 2,
                  }}
                >
                  Payment Method
                </span>
                <span style={{ fontWeight: 800, color: '#111' }}>
                  {order.paymentMethod?.toUpperCase().includes('RAZORPAY')
                    ? 'Razorpay'
                    : order.paymentMethod || 'Razorpay'}
                </span>
              </div>
              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#888',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 2,
                  }}
                >
                  Payment Gateway Status
                </span>
                <span style={{ fontWeight: 800, color: '#dc2626' }}>FAILED (Uncaptured)</span>
              </div>
              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#888',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 2,
                  }}
                >
                  Fulfillment Status
                </span>
                <span style={{ fontWeight: 800, color: '#666' }}>NOT DISPATCHED</span>
              </div>
              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#888',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 2,
                  }}
                >
                  Amount Attempted
                </span>
                <span style={{ fontWeight: 800, color: '#111' }}>
                  ₹{parseFloat(order.totalPrice.amount).toLocaleString()}
                </span>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: '14px 18px',
                background: '#fff5f5',
                border: '1px solid #fed7d7',
                fontSize: '0.82rem',
                color: '#4a5568',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: '#c53030' }}>Notice on Deductions:</strong> No funds were
              captured by VAHN for this order. If your bank or UPI app debited this amount, the
              issuing bank will automatically release the hold and credit it back to your account
              within 5–7 business days.
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link
                href={`/checkout/failed?order_id=${order.id}`}
                style={{
                  background: '#000',
                  color: '#fff',
                  padding: '10px 20px',
                  fontSize: '0.8rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '-0.025em',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>Retry Payment Now</span>
                <svg
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
              <Link
                href="/products"
                style={{
                  background: '#fff',
                  border: '1px solid #d1d5db',
                  color: '#111',
                  padding: '10px 20px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '-0.025em',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        ) : (
          /* Order Fulfillment Tracker for Active Shipments */
          <div className="vahn-order-card">
            {/* Tracker header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 28,
              }}
            >
              <h3
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 900,
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '-0.025em',
                  color: '#555',
                }}
              >
                Fulfillment Status
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    background: statusColors.bg,
                    color: statusColors.text,
                    border: `1px solid ${statusColors.border}`,
                    padding: '5px 14px',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '-0.025em',
                  }}
                >
                  {order.status}
                </span>
                {/* Mobile-only compact Track button beside the status badge */}
                {isShipped && (
                  <button
                    type="button"
                    onClick={() => handleOpenTrackingModal('forward')}
                    className="vahn-tracker-mobile-track-btn"
                  >
                    <TruckIcon size={12} color="#fff" />
                    <span>Track</span>
                  </button>
                )}
              </div>
            </div>

            {/* Desktop Tracker */}
            <div className="vahn-tracker-desktop" style={{ position: 'relative' }}>
              {/* Background track */}
              <div
                style={{
                  position: 'absolute',
                  top: 19,
                  left: 'calc(16.66% + 8px)',
                  right: 'calc(16.66% + 8px)',
                  height: 2,
                  background: '#e5e7eb',
                  zIndex: 1,
                }}
              />
              {/* Active progress track */}
              <div
                style={{
                  position: 'absolute',
                  top: 19,
                  left: 'calc(16.66% + 8px)',
                  width:
                    stepIndex === 0
                      ? '0%'
                      : stepIndex === 1
                        ? 'calc(33.33% - 16px)'
                        : 'calc(66.66% - 16px)',
                  height: 2,
                  background: '#000',
                  zIndex: 2,
                  transition: 'width 0.6s ease',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  position: 'relative',
                  zIndex: 3,
                }}
              >
                {STATUS_STEPS.map((s, idx) => {
                  const isCompleted = idx <= stepIndex;
                  const isPast = idx < stepIndex;
                  const isCurrent = idx === stepIndex;
                  const IconComp = s.IconComponent;

                  return (
                    <div
                      key={s.key}
                      onClick={() => {
                        if (isShipped) {
                          handleOpenTrackingModal('forward');
                        }
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '33.33%',
                        textAlign: 'center',
                        cursor: isShipped ? 'pointer' : 'default',
                      }}
                      title={isShipped ? 'Click to view live tracking' : undefined}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          background: isCompleted ? '#000' : '#fff',
                          color: isCompleted ? '#fff' : '#9ca3af',
                          border: isCompleted ? '2px solid #000' : '2px solid #d1d5db',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.3s ease',
                          boxShadow: isCurrent ? '0 0 0 4px rgba(0,0,0,0.1)' : 'none',
                        }}
                      >
                        {isPast ? (
                          <CheckIcon size={16} color="#fff" />
                        ) : isCurrent ? (
                          <IconComp size={16} color="#fff" />
                        ) : (
                          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{idx + 1}</span>
                        )}
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <div
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 900,
                            color: isCompleted ? '#000' : '#9ca3af',
                            lineHeight: 1.3,
                          }}
                        >
                          {s.label}
                        </div>
                        <div
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#888',
                            textTransform: 'uppercase',
                            letterSpacing: '-0.025em',
                            marginTop: 2,
                          }}
                        >
                          {s.sublabel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile Vertical Tracker */}
            <div
              className="vahn-tracker-mobile"
              style={{ display: 'none', flexDirection: 'column', gap: 16 }}
            >
              {STATUS_STEPS.map((s, idx) => {
                const isCompleted = idx <= stepIndex;
                const isPast = idx < stepIndex;
                const isCurrent = idx === stepIndex;
                const IconComp = s.IconComponent;

                return (
                  <div key={s.key} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        background: isCompleted ? '#000' : '#fff',
                        color: isCompleted ? '#fff' : '#9ca3af',
                        border: isCompleted ? '2px solid #000' : '2px solid #d1d5db',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isPast ? (
                        <CheckIcon size={14} color="#fff" />
                      ) : isCurrent ? (
                        <IconComp size={14} color="#fff" />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 900,
                          color: isCompleted ? '#000' : '#9ca3af',
                        }}
                      >
                        {s.label}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#888' }}>{s.sublabel}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Forward Tracking Snapshot Bar */}
            {isShipped && (
              <div className="vahn-shipment-snapshot vahn-shipment-snapshot-desktop-only">
                <div className="vahn-shipment-snapshot-main">
                  <div className="vahn-shipment-snapshot-icon">
                    <TruckIcon size={20} color="#fff" />
                  </div>
                  <div className="vahn-shipment-snapshot-content">
                    <div className="vahn-shipment-snapshot-top">
                      <span className="vahn-shipment-snapshot-status">
                        {prettifyShipStatus(order.shippingStatus || order.status)}
                      </span>
                      {forwardCurrentLoc && (
                        <span className="vahn-shipment-snapshot-location">
                          <MapPinIcon size={12} color="#166534" style={{ flexShrink: 0 }} />
                          <span>Current Location: {forwardCurrentLoc}</span>
                        </span>
                      )}
                    </div>
                    <div className="vahn-shipment-snapshot-courier">
                      {order.shiprocketCourierName ||
                        order.trackingData?.courier_name ||
                        'Express Courier'}
                      {(order.shiprocketAwb || order.trackingData?.awb) && (
                        <span>
                          {' '}
                          · AWB:{' '}
                          <strong style={{ fontFamily: 'monospace', color: '#000' }}>
                            {order.shiprocketAwb || order.trackingData?.awb}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenTrackingModal('forward')}
                  className="vahn-shipment-snapshot-btn"
                >
                  <TruckIcon size={16} color="#fff" />
                  <span>Track Shipment</span>
                  <svg
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
                </button>
              </div>
            )}
          </div>
        )}

        {/* Cancelled Return / Exchange Notice */}
        {order.returnStatus === 'CANCELLED' && (
          <div
            className="vahn-order-card"
            style={{
              marginTop: 24,
              border: '2px solid #ef4444',
              background: '#fef2f2',
              padding: '24px',
              borderRadius: '0px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
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
                <h3
                  style={{
                    margin: '4px 0 0',
                    fontSize: '1.1rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    color: '#991b1b',
                  }}
                >
                  {order.returnType === 'REPLACEMENT'
                    ? 'Size Exchange Request Cancelled'
                    : 'Return Request Cancelled'}
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#7f1d1d', marginTop: 6, lineHeight: 1.5 }}>
                  {order.returnNotes ||
                    'The return or exchange request for this order was cancelled. Courier reverse pickup has been cancelled, and your original item remains yours to keep.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Reverse Logistics Return Tracker (Automated Shiprocket Reverse Pickup) */}
        {order.returnStatus && order.returnStatus !== 'NONE' && order.returnStatus !== 'CANCELLED' && (
          <div
            className="vahn-order-card"
            style={{
              marginTop: 24,
              border: '2px solid #000',
              background: '#f9f9f9',
              padding: '24px',
              borderRadius: '0px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 16,
                borderBottom: '1px solid #e5e5e5',
                paddingBottom: 12,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    color: '#000',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {order.returnType === 'REPLACEMENT'
                    ? 'Automated Size Replacement & Exchange'
                    : 'Automated Return & 100% Refund'}
                </span>
                <h3
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 900,
                    margin: '2px 0 0',
                    textTransform: 'uppercase',
                  }}
                >
                  {getCustomerReturnBadge({
                    returnStatus: order.returnStatus,
                    returnType: order.returnType,
                    replacementStatus: order.replacementStatus,
                    isReturnPickedUp,
                  }).title}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {!isReturnPickedUp &&
                  ['REQUESTED', 'PICKUP_SCHEDULED'].includes(order.returnStatus) && (
                    <button
                      type="button"
                      onClick={() => setShowCancelReturnModal(true)}
                      style={{
                        background: '#fff',
                        border: '1px solid #ef4444',
                        color: '#dc2626',
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        borderRadius: '0px',
                        textTransform: 'uppercase',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <XIcon size={12} color="#dc2626" />
                      Cancel Request
                    </button>
                  )}
                <span
                  style={{
                    background: getCustomerReturnBadge({
                      returnStatus: order.returnStatus,
                      returnType: order.returnType,
                      replacementStatus: order.replacementStatus,
                      isReturnPickedUp,
                    }).color,
                    color: '#fff',
                    padding: '6px 14px',
                    fontSize: '0.75rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    borderRadius: '0px',
                  }}
                >
                  {getCustomerReturnBadge({
                    returnStatus: order.returnStatus,
                    returnType: order.returnType,
                    replacementStatus: order.replacementStatus,
                    isReturnPickedUp,
                  }).badge}
                </span>
              </div>
            </div>

            {/* Size Replacement Highlights Banner */}
            {order.returnType === 'REPLACEMENT' && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 16,
                  padding: '12px 16px',
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.2rem' }}>🔄</span>
                  <div>
                    <div
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: '#666',
                        textTransform: 'uppercase',
                      }}
                    >
                      Reserved Replacement Size
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#000' }}>
                      {order.replacementVariantTitle || 'Selected Replacement Item'}
                    </div>
                  </div>
                </div>

                {order.replacementAwb && (
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: '#666',
                        textTransform: 'uppercase',
                      }}
                    >
                      Replacement Shipment AWB
                    </div>
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 900,
                        color: '#000',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>{order.replacementAwb} ({order.replacementCourierName || 'Courier'})</span>
                      <button
                        type="button"
                        onClick={() => handleOpenTrackingModal('replacement')}
                        style={{
                          background: '#000',
                          color: '#fff',
                          border: 'none',
                          padding: '4px 10px',
                          fontSize: '0.7rem',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                        }}
                      >
                        📍 Track &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Doorstep Pickup Verification Banner */}
            <div
              style={{
                background: isReturnPickedUp ? '#ecfdf5' : '#fffbeb',
                border: isReturnPickedUp ? '1px solid #86efac' : '1px solid #fde68a',
                padding: '12px 16px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: isReturnPickedUp ? '#16a34a' : '#d97706',
                    display: 'inline-block',
                  }}
                />
                <span
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: isReturnPickedUp ? '#15803d' : '#b45309',
                  }}
                >
                  {isReturnPickedUp
                    ? '✔ ORIGINAL ITEM COLLECTED FROM YOUR DOORSTEP'
                    : '⏳ PICKUP SCHEDULED — COURIER ARRIVING FOR COLLECTION'}
                </span>
              </div>
              {reverseCurrentLoc && (
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: '#333',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <MapPinIcon size={13} color="#333" />
                  <span>Current Location: {reverseCurrentLoc}</span>
                </span>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                fontSize: '0.85rem',
                color: '#333',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                {order.returnType !== 'REPLACEMENT' ? (
                  <>
                    <div>
                      Reverse Courier:{' '}
                      <strong>{order.reverseCourierName || 'Shiprocket Reverse'}</strong>
                    </div>
                    {order.reverseAwb && (
                      <div>
                        Reverse AWB:{' '}
                        <strong style={{ fontFamily: 'monospace' }}>{order.reverseAwb}</strong>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {order.replacementAwb && (
                      <div>
                        Replacement Courier:{' '}
                        <strong>{order.replacementCourierName || 'Courier Partner'}</strong>
                      </div>
                    )}
                  </>
                )}
                {order.returnReason && (
                  <div>
                    Reason: <strong>{order.returnReason}</strong>
                  </div>
                )}
              </div>

              {order.returnType === 'REPLACEMENT' ? (
                (order.replacementAwb || trackingModalData?.replacement_awb) && (
                  <button
                    type="button"
                    onClick={() => handleOpenTrackingModal('replacement')}
                    style={{
                      background: '#000',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 16px',
                      fontSize: '0.75rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '-0.02em',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <TruckIcon size={14} color="#fff" />
                      <span>Track Replacement</span>
                      <svg
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
                    </span>
                  </button>
                )
              ) : (
                (order.reverseAwb || order.reverseTrackingData?.awb) && (
                  <button
                    type="button"
                    onClick={() => handleOpenTrackingModal('reverse')}
                    style={{
                      background: '#000',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 16px',
                      fontSize: '0.75rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '-0.02em',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <TruckIcon size={14} color="#fff" />
                      <span>Track Return</span>
                      <svg
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
                    </span>
                  </button>
                )
              )}
            </div>

            <div
              style={{
                padding: '12px 16px',
                background: '#fff',
                border: '1px solid #e5e5e5',
                fontSize: '0.82rem',
                color: '#444',
                lineHeight: 1.5,
              }}
            >
              {order.returnType === 'REPLACEMENT' ? (
                <>
                  <strong>Size Replacement & Exchange Process:</strong> Shiprocket reverse courier
                  will collect the original garment from your address. Once collected and verified,
                  we will immediately dispatch your replacement size (
                  {order.replacementVariantTitle || 'Selected Size'}). Live replacement shipment
                  updates will appear directly on this page.
                </>
              ) : (
                <>
                  <strong>Automated 10-Day Refund Process:</strong> Once the courier arrives at your
                  address and scans the package pickup, your 100% refund of ₹
                  {parseFloat(order.totalPrice.amount).toLocaleString()} is automatically disbursed
                  back to your original payment method via Razorpay.
                </>
              )}
            </div>
          </div>
        )}

        {/* Content Grid: Items (left) | Info (right) */}
        <div className="vahn-order-grid">
          {/* Ordered Items */}
          <div className="vahn-card-box">
            <div className="vahn-card-box-header">
              <h3
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 900,
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '-0.025em',
                  color: '#555',
                }}
              >
                Items in Order ({order.items.length})
              </h3>
            </div>

            <div
              className="vahn-card-box-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
            >
              {order.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                    borderBottom: '1px solid #f3f4f6',
                    paddingBottom: 18,
                  }}
                >
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.productTitle}
                      width={64}
                      height={64}
                      style={{ objectFit: 'cover', border: '1px solid #e5e5e5', flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        background: '#f3f4f6',
                        border: '1px solid #e5e5e5',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: '0.92rem',
                        color: '#000',
                        marginBottom: 4,
                        lineHeight: 1.35,
                      }}
                    >
                      {item.productTitle}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#555', marginBottom: 2 }}>
                      Variant: {item.variantTitle}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#888' }}>
                      Qty: <strong style={{ color: '#000' }}>{item.quantity}</strong> &nbsp;·&nbsp;
                      Unit: ₹{parseFloat(item.price.amount).toLocaleString()}
                    </div>
                  </div>
                  <div
                    style={{ fontWeight: 900, fontSize: '0.95rem', color: '#000', flexShrink: 0 }}
                  >
                    ₹{(parseFloat(item.price.amount) * item.quantity).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Delivery Address Card */}
            <div className="vahn-card-box">
              <div
                className="vahn-card-box-header"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <MapPinIcon size={15} color="#000" />
                <h3
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '-0.025em',
                    color: '#555',
                  }}
                >
                  Delivery Address
                </h3>
              </div>
              <div className="vahn-card-box-body">
                {addr.name && (
                  <div
                    style={{ fontWeight: 900, fontSize: '0.95rem', color: '#000', marginBottom: 6 }}
                  >
                    {addr.name}
                  </div>
                )}
                {addr.label && (
                  <span
                    style={{
                      display: 'inline-block',
                      background: '#000',
                      color: '#fff',
                      padding: '2px 9px',
                      fontSize: '0.65rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      marginBottom: 10,
                    }}
                  >
                    {addr.label}
                  </span>
                )}
                <div style={{ fontSize: '0.875rem', color: '#333', lineHeight: 1.5 }}>
                  {addr.address || 'Standard Address'}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#555', marginTop: 3 }}>
                  {addr.city}, {addr.state} —{' '}
                  <strong style={{ color: '#000' }}>{addr.postalCode}</strong>
                </div>
                <div
                  style={{
                    fontSize: '0.82rem',
                    color: '#888',
                    marginTop: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <MapPinIcon size={12} color="#aaa" /> India
                </div>
                {addr.phone && (
                  <div
                    style={{
                      fontSize: '0.82rem',
                      color: '#777',
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <PhoneIcon size={12} color="#888" /> {addr.phone}
                  </div>
                )}
              </div>
            </div>

            {/* Payment Summary Card */}
            <div className="vahn-card-box">
              <div className="vahn-card-box-header">
                <h3
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '-0.025em',
                    color: '#555',
                  }}
                >
                  Payment Summary
                </h3>
              </div>
              <div className="vahn-card-box-body">
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    fontSize: '0.875rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#555' }}>Items Subtotal</span>
                    <span style={{ fontWeight: 700, color: '#000' }}>
                      ₹{parseFloat(order.subtotalPrice.amount).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#555' }}>Shipping</span>
                    <span>
                      {parseFloat(order.shippingPrice.amount) === 0 ? (
                        <strong style={{ color: '#16a34a' }}>FREE</strong>
                      ) : (
                        `₹${order.shippingPrice.amount}`
                      )}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      color: '#999',
                      fontSize: '0.8rem',
                    }}
                  >
                    <span>GST Tax (12% incl.)</span>
                    <span>₹{parseFloat(order.taxPrice.amount).toLocaleString()}</span>
                  </div>
                </div>

                {/* Total Row */}
                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: '2px solid #000',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '-0.025em',
                      color: '#555',
                    }}
                  >
                    Total Paid
                  </span>
                  <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#000' }}>
                    ₹{parseFloat(order.totalPrice.amount).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CUSTOM TRACKING MODAL (Active only for non-cancelled orders) */}
        {!isCancelled && showTrackingModal && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowTrackingModal(false);
            }}
            className="vahn-tracking-modal-backdrop"
          >
            <div className="vahn-tracking-modal-dialog">
              {/* Modal Header */}
              <div className="vahn-tracking-modal-header">
                <div className="vahn-tracking-modal-header-left">
                  <div className="vahn-tracking-modal-header-icon">
                    <TruckIcon size={20} color="#fff" />
                  </div>
                  <div className="vahn-tracking-modal-header-text">
                    <div className="vahn-tracking-modal-header-title-row">
                      <h3 className="vahn-tracking-modal-header-title">
                        Live Logistics & Checkpoints
                      </h3>
                      <span className="vahn-tracking-modal-header-badge">
                        Live Feed
                      </span>
                    </div>
                    <span className="vahn-tracking-modal-header-sub">
                      Order #{order.id} · Verified Shiprocket Courier Network
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTrackingModal(false)}
                  className="vahn-tracking-modal-close-btn"
                  aria-label="Close tracking modal"
                >
                  <XIcon size={18} color="#fff" />
                </button>
              </div>

              {/* Tab Switcher for orders with forward, return, and replacement tracking */}
              {(order.reverseAwb ||
                (order.returnStatus && order.returnStatus !== 'NONE') ||
                order.replacementAwb ||
                order.returnType === 'REPLACEMENT') && (
                <div className="vahn-tracking-tabs">
                  <button
                    type="button"
                    onClick={() => setActiveTrackingTab('forward')}
                    className="vahn-tracking-tab-btn"
                    style={{
                      background: activeTrackingTab === 'forward' ? '#fff' : 'transparent',
                      color: activeTrackingTab === 'forward' ? '#000' : '#666',
                      borderBottom: activeTrackingTab === 'forward' ? '3px solid #000' : 'none',
                    }}
                  >
                    Forward Delivery ({order.shiprocketAwb || 'Active'})
                  </button>
                  {order.returnType !== 'REPLACEMENT' && (
                    <button
                      type="button"
                      onClick={() => setActiveTrackingTab('reverse')}
                      className="vahn-tracking-tab-btn"
                      style={{
                        background: activeTrackingTab === 'reverse' ? '#fff' : 'transparent',
                        color: activeTrackingTab === 'reverse' ? '#000' : '#666',
                        borderBottom: activeTrackingTab === 'reverse' ? '3px solid #000' : 'none',
                      }}
                    >
                      Return Pickup ({order.reverseAwb || 'Return'})
                    </button>
                  )}
                  {(order.replacementAwb || order.returnType === 'REPLACEMENT') && (
                    <button
                      type="button"
                      onClick={() => setActiveTrackingTab('replacement')}
                      className="vahn-tracking-tab-btn"
                      style={{
                        background: activeTrackingTab === 'replacement' ? '#fff' : 'transparent',
                        color: activeTrackingTab === 'replacement' ? '#000' : '#666',
                        borderBottom:
                          activeTrackingTab === 'replacement' ? '3px solid #000' : 'none',
                      }}
                    >
                      Replacement Delivery ({order.replacementAwb || 'Exchange'})
                    </button>
                  )}
                </div>
              )}

              {/* Modal Body: Pinned Top Info + Dedicated Scrollable Timeline Feed */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  overflow: 'hidden',
                }}
              >
                {loadingTrackingModal ? (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px 0',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        border: '3px solid #000000',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        margin: '0 auto 12px',
                      }}
                    />
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: '#666',
                        textTransform: 'uppercase',
                      }}
                    >
                      Fetching live courier checkpoint scans...
                    </div>
                  </div>
                ) : activeTrackingTab === 'forward' ? (
                  /* FORWARD TRACKING VIEW */
                  <>
                    {/* Fixed Forward Logistics Header Summary (Never scrolls away) */}
                    <div
                      style={{
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        flexShrink: 0,
                        borderBottom: '1px solid #e5e7eb',
                        background: '#fff',
                      }}
                    >
                      {/* Current Location Highlight Banner */}
                      <div
                        style={{
                          background: '#f0fdf4',
                          border: '1.5px solid #86efac',
                          padding: '12px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 10,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              marginBottom: 2,
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: '#16a34a',
                                display: 'inline-block',
                                boxShadow: '0 0 0 3px rgba(22,163,74,0.25)',
                              }}
                            />
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 900,
                                color: '#16a34a',
                                textTransform: 'uppercase',
                              }}
                            >
                              Current Location
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '1rem',
                              fontWeight: 900,
                              color: '#000',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <MapPinIcon size={16} color="#000" />
                            <span>{forwardCurrentLoc || 'In Transit to Destination Facility'}</span>
                          </div>
                        </div>
                        <span
                          style={{
                            background: '#000',
                            color: '#fff',
                            padding: '4px 12px',
                            fontSize: '0.72rem',
                            fontWeight: 900,
                            textTransform: 'uppercase',
                          }}
                        >
                          {prettifyShipStatus(order.shippingStatus || order.status)}
                        </span>
                      </div>

                      {/* Courier & AWB Code strip */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                          gap: 12,
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          padding: '12px 16px',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: '0.68rem',
                              color: '#666',
                              textTransform: 'uppercase',
                              fontWeight: 800,
                            }}
                          >
                            Courier Partner
                          </div>
                          <div
                            style={{
                              fontSize: '0.92rem',
                              fontWeight: 900,
                              color: '#000',
                              marginTop: 2,
                            }}
                          >
                            {order.shiprocketCourierName ||
                              trackingModalData?.courier_name ||
                              trackingModalData?.courierName ||
                              'Assigned on Dispatch'}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: '0.68rem',
                              color: '#666',
                              textTransform: 'uppercase',
                              fontWeight: 800,
                            }}
                          >
                            AWB Tracking Code
                          </div>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}
                          >
                            <strong
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '0.92rem',
                                color: '#000',
                              }}
                            >
                              {order.shiprocketAwb ||
                                trackingModalData?.awb_code ||
                                trackingModalData?.awbCode ||
                                'Pending Dispatch'}
                            </strong>
                            {(order.shiprocketAwb || trackingModalData?.awb_code) && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyAwb(
                                    order.shiprocketAwb || trackingModalData?.awb_code || ''
                                  )
                                }
                                style={{
                                  background: copiedAwb ? '#16a34a' : '#fff',
                                  color: copiedAwb ? '#fff' : '#000',
                                  border: '1px solid #000',
                                  padding: '2px 8px',
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                }}
                              >
                                {copiedAwb ? 'COPIED' : 'COPY'}
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: '0.68rem',
                              color: '#666',
                              textTransform: 'uppercase',
                              fontWeight: 800,
                            }}
                          >
                            Estimated Delivery
                          </div>
                          <div
                            style={{
                              fontSize: '0.92rem',
                              fontWeight: 900,
                              color: '#000',
                              marginTop: 2,
                            }}
                          >
                            3–5 Business Days
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: '0.68rem',
                              color: '#666',
                              textTransform: 'uppercase',
                              fontWeight: 800,
                            }}
                          >
                            Official Invoice
                          </div>
                          <div style={{ marginTop: 2 }}>
                            <button
                              type="button"
                              onClick={handleDownloadInvoice}
                              disabled={downloadingInvoice}
                              style={{
                                background: '#000',
                                color: '#fff',
                                border: '1px solid #000',
                                padding: '3px 8px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                cursor: downloadingInvoice ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                textTransform: 'uppercase',
                              }}
                            >
                              <PrinterIcon size={11} color="#fff" />
                              {downloadingInvoice ? 'Loading...' : 'Download PDF'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Fixed Checkpoint Scans Subheader */}
                    <div
                      style={{
                        padding: '12px 20px',
                        background: '#fafafa',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                      }}
                    >
                      <h4
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '-0.01em',
                          margin: 0,
                          color: '#000',
                        }}
                      >
                        Complete Checkpoint Scans ({displayForwardScans.length})
                      </h4>
                      <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 700 }}>
                        Newest Checkpoints First
                      </span>
                    </div>

                    {/* ONLY THIS SCROLLS: Dedicated Checkpoint Scans Feed */}
                    <div
                      style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '16px 20px 24px',
                        minHeight: 0,
                      }}
                    >

                      {displayForwardScans.length === 0 ? (
                        <div
                          style={{
                            padding: '24px',
                            textAlign: 'center',
                            background: '#f9fafb',
                            border: '1px dashed #d1d5db',
                          }}
                        >
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
                            Package is manifesting. Courier pickup scan will appear here once handed
                            over.
                          </p>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0,
                            position: 'relative',
                          }}
                        >
                          {displayForwardScans.map((scan: any, idx: number) => {
                            const isLatest = idx === 0;
                            return (
                              <div
                                key={idx}
                                style={{ display: 'flex', gap: 16, position: 'relative' }}
                              >
                                {/* Left timeline node and line */}
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 14,
                                      height: 14,
                                      background: isLatest ? '#16a34a' : '#000000',
                                      border: isLatest ? '3px solid #bbf7d0' : 'none',
                                      marginTop: 4,
                                    }}
                                  />
                                  {idx < displayForwardScans.length - 1 && (
                                    <div
                                      style={{
                                        width: 2,
                                        flex: 1,
                                        minHeight: 36,
                                        background: '#e5e7eb',
                                      }}
                                    />
                                  )}
                                </div>

                                {/* Right content */}
                                <div style={{ paddingBottom: 20, flex: 1 }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'baseline',
                                      flexWrap: 'wrap',
                                      gap: 8,
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: '0.88rem',
                                        fontWeight: 900,
                                        color: '#000000',
                                      }}
                                    >
                                      {prettifyActivityLabel(scan.activity)}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        color: '#888',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {scan.date || 'Recorded'}
                                    </span>
                                  </div>
                                  {scan.location && (
                                    <div
                                      style={{
                                        fontSize: '0.78rem',
                                        color: '#666',
                                        marginTop: 3,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                      }}
                                    >
                                      <MapPinIcon size={12} color="#888" />
                                      <span>{scan.location}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                ) : activeTrackingTab === 'replacement' ? (
                  /* REPLACEMENT DELIVERY TRACKING VIEW */
                  <>
                    {/* Fixed Replacement Logistics Header Summary */}
                    <div
                      style={{
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        flexShrink: 0,
                        borderBottom: '1px solid #e5e7eb',
                        background: '#fff',
                      }}
                    >
                      {/* Replacement Delivery Status Banner */}
                      <div
                        style={{
                          background:
                            order.replacementStatus === 'DELIVERED' || order.status === 'COMPLETED'
                              ? '#f0fdf4'
                              : '#fafafa',
                          border:
                            order.replacementStatus === 'DELIVERED' || order.status === 'COMPLETED'
                              ? '1.5px solid #86efac'
                              : '1.5px solid #000000',
                          padding: '12px 16px',
                        }}
                      >
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background:
                                order.replacementStatus === 'DELIVERED' || order.status === 'COMPLETED'
                                  ? '#16a34a'
                                  : '#000000',
                              display: 'inline-block',
                            }}
                          />
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 900,
                              color:
                                order.replacementStatus === 'DELIVERED' || order.status === 'COMPLETED'
                                  ? '#16a34a'
                                  : '#000000',
                              textTransform: 'uppercase',
                            }}
                          >
                            Size Exchange Replacement Status
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.98rem',
                            fontWeight: 900,
                            color:
                              order.replacementStatus === 'DELIVERED' || order.status === 'COMPLETED'
                                ? '#15803d'
                                : '#000000',
                          }}
                        >
                          {order.replacementStatus === 'DELIVERED' || order.status === 'COMPLETED'
                            ? '✔ REPLACEMENT PACKAGE DELIVERED TO YOUR DOORSTEP'
                            : order.replacementAwb || order.replacementStatus === 'REPLACEMENT_DISPATCHED'
                              ? '✔ REPLACEMENT DISPATCHED — EN ROUTE TO YOUR ADDRESS'
                              : '⏳ SIZE RESERVED — AWAITING COURIER DISPATCH'}
                        </div>
                        {trackingModalData?.current_location && (
                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: '#444',
                              marginTop: 6,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            <MapPinIcon size={13} color="#444" />
                            <span>
                              <strong>Current Location:</strong>{' '}
                              {trackingModalData.current_location}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Replacement Courier & AWB Code strip */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                          gap: 12,
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          padding: '12px 16px',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: '0.68rem',
                              color: '#666',
                              textTransform: 'uppercase',
                              fontWeight: 800,
                            }}
                          >
                            Courier Partner
                          </div>
                          <div
                            style={{
                              fontSize: '0.92rem',
                              fontWeight: 900,
                              color: '#000',
                              marginTop: 2,
                            }}
                          >
                            {order.replacementCourierName ||
                              trackingModalData?.replacement_courier_name ||
                              'Express Courier'}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: '0.68rem',
                              color: '#666',
                              textTransform: 'uppercase',
                              fontWeight: 800,
                            }}
                          >
                            Replacement AWB
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              marginTop: 2,
                            }}
                          >
                            <strong
                              style={{ fontFamily: 'monospace', fontSize: '0.92rem', color: '#000' }}
                            >
                              {order.replacementAwb || trackingModalData?.replacement_awb || 'Processing Dispatch'}
                            </strong>
                            {(order.replacementAwb || trackingModalData?.replacement_awb) && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyAwb(
                                    order.replacementAwb || trackingModalData?.replacement_awb || ''
                                  )
                                }
                                style={{
                                  background: copiedAwb ? '#16a34a' : '#fff',
                                  color: copiedAwb ? '#fff' : '#000',
                                  border: '1px solid #000',
                                  padding: '2px 8px',
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {copiedAwb ? 'COPIED' : 'COPY'}
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: '0.68rem',
                              color: '#666',
                              textTransform: 'uppercase',
                              fontWeight: 800,
                            }}
                          >
                            New Selected Size
                          </div>
                          <div
                            style={{
                              fontSize: '0.92rem',
                              fontWeight: 900,
                              color: '#000000',
                              marginTop: 2,
                            }}
                          >
                            {order.replacementVariantTitle ||
                              trackingModalData?.replacement_variant_title ||
                              'Reserved Size'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Fixed Replacement Checkpoints Subheader */}
                    <div
                      style={{
                        padding: '12px 20px',
                        background: '#fafafa',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                      }}
                    >
                      <h4
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '-0.01em',
                          margin: 0,
                          color: '#000',
                        }}
                      >
                        Replacement Checkpoint Scans ({activeReplacementScans.length})
                      </h4>
                      <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 700 }}>
                        Newest Checkpoints First
                      </span>
                    </div>

                    {/* ONLY THIS SCROLLS: Dedicated Replacement Checkpoints Feed */}
                    <div
                      style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '16px 20px 24px',
                        minHeight: 0,
                      }}
                    >

                      {activeReplacementScans.length === 0 ? (
                        <div
                          style={{
                            padding: '24px',
                            textAlign: 'center',
                            background: '#f9fafb',
                            border: '1px dashed #000000',
                          }}
                        >
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#111111', fontWeight: 600 }}>
                            {order.replacementAwb
                              ? `Replacement parcel dispatched via ${order.replacementCourierName || 'Express Courier'} (AWB: ${order.replacementAwb}). Live courier checkpoint scans will appear as the courier scans the package.`
                              : 'Replacement parcel is being prepared for dispatch. Courier dispatch scan will appear here once handed over.'}
                          </p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {activeReplacementScans.map((scan: any, idx: number) => {
                            const isLatest = idx === 0;
                            return (
                              <div
                                key={idx}
                                style={{ display: 'flex', gap: 16, position: 'relative' }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 14,
                                      height: 14,
                                      background: isLatest ? '#16a34a' : '#000000',
                                      border: isLatest ? '3px solid #bbf7d0' : 'none',
                                      marginTop: 4,
                                    }}
                                  />
                                  {idx < activeReplacementScans.length - 1 && (
                                    <div
                                      style={{
                                        width: 2,
                                        flex: 1,
                                        minHeight: 36,
                                        background: '#e5e7eb',
                                      }}
                                    />
                                  )}
                                </div>
                                <div style={{ paddingBottom: 20, flex: 1 }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'baseline',
                                      flexWrap: 'wrap',
                                      gap: 8,
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: '0.88rem',
                                        fontWeight: 900,
                                        color: '#000000',
                                      }}
                                    >
                                      {prettifyActivityLabel(scan.activity)}
                                    </span>
                                    <span
                                      style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600 }}
                                    >
                                      {scan.date || 'Recorded'}
                                    </span>
                                  </div>
                                  {scan.location && (
                                    <div
                                      style={{
                                        fontSize: '0.78rem',
                                        color: '#666',
                                        marginTop: 3,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                      }}
                                    >
                                      <MapPinIcon size={12} color="#888" />
                                      <span>{scan.location}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* REVERSE RETURN TRACKING VIEW */
                  <>
                    {/* Fixed Reverse Logistics Header Summary */}
                    <div
                      style={{
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        flexShrink: 0,
                        borderBottom: '1px solid #e5e7eb',
                        background: '#fff',
                      }}
                    >
                      {/* Doorstep Pickup Verification Banner */}
                      <div
                        style={{
                          background: isReturnPickedUp ? '#f0fdf4' : '#fffbeb',
                          border: isReturnPickedUp ? '1.5px solid #86efac' : '1.5px solid #fde68a',
                          padding: '12px 16px',
                        }}
                      >
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: isReturnPickedUp ? '#16a34a' : '#d97706',
                              display: 'inline-block',
                            }}
                          />
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 900,
                              color: isReturnPickedUp ? '#16a34a' : '#d97706',
                              textTransform: 'uppercase',
                            }}
                          >
                            Customer Doorstep Pickup Status
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.98rem',
                            fontWeight: 900,
                            color: isReturnPickedUp ? '#15803d' : '#b45309',
                          }}
                        >
                          {isReturnPickedUp
                            ? '✔ PARCEL SUCCESSFULLY PICKED UP FROM CUSTOMER DOORSTEP'
                            : '⏳ PICKUP SCHEDULED — COURIER WILL ARRIVE AT CUSTOMER ADDRESS'}
                        </div>
                      </div>

                      {/* Reverse Courier & AWB Code strip */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                          gap: 12,
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          padding: '12px 16px',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: '0.68rem',
                              color: '#666',
                              textTransform: 'uppercase',
                              fontWeight: 800,
                            }}
                          >
                            Reverse Courier
                          </div>
                          <div
                            style={{
                              fontSize: '0.92rem',
                              fontWeight: 900,
                              color: '#000',
                              marginTop: 2,
                            }}
                          >
                            {order.reverseCourierName ||
                              trackingModalData?.reverse_courier_name ||
                              'Delhivery Reverse Surface'}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: '0.68rem',
                              color: '#666',
                              textTransform: 'uppercase',
                              fontWeight: 800,
                            }}
                          >
                            Reverse AWB
                          </div>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}
                          >
                            <strong
                              style={{ fontFamily: 'monospace', fontSize: '0.92rem', color: '#000' }}
                            >
                              {order.reverseAwb || trackingModalData?.reverse_awb || '98798441933'}
                            </strong>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyAwb(
                                  order.reverseAwb || trackingModalData?.reverse_awb || '98798441933'
                                )
                              }
                              style={{
                                background: copiedAwb ? '#16a34a' : '#fff',
                                color: copiedAwb ? '#fff' : '#000',
                                border: '1px solid #000',
                                padding: '2px 8px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                              }}
                            >
                              {copiedAwb ? 'COPIED' : 'COPY'}
                            </button>
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: '0.68rem',
                              color: '#666',
                              textTransform: 'uppercase',
                              fontWeight: 800,
                            }}
                          >
                            Automated Refund
                          </div>
                          <div
                            style={{
                              fontSize: '0.92rem',
                              fontWeight: 900,
                              color: '#16a34a',
                              marginTop: 2,
                            }}
                          >
                            100% on Doorstep Scan
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Fixed Return & Refund Progress Subheader */}
                    <div
                      style={{
                        padding: '12px 20px',
                        background: '#fafafa',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                      }}
                    >
                      <h4
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '-0.01em',
                          margin: 0,
                          color: '#000',
                        }}
                      >
                        Return & Refund Progress (3 Stages)
                      </h4>
                    </div>

                    {/* ONLY THIS SCROLLS: 3-Stage Return Tracking Stepper */}
                    <div
                      style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '16px 20px 24px',
                        minHeight: 0,
                      }}
                    >
                      {(() => {
                        const isRefunded =
                          order.returnStatus === 'REFUNDED' ||
                          order.refundStatus === 'REFUNDED' ||
                          trackingModalData?.return_status === 'REFUNDED' ||
                          trackingModalData?.refund_status === 'REFUNDED';
                        const isPickedUp = isReturnPickedUp || isRefunded;

                        const stages = [
                          {
                            title: '1. Return Request Registered',
                            desc: order.returnReason
                              ? `Reason: ${order.returnReason}. Reverse doorstep pickup dispatched.`
                              : 'Doorstep return pickup registered.',
                            date: order.returnRequestedAt || 'Registered',
                            completed: true,
                            active: !isPickedUp,
                          },
                          {
                            title: '2. Package Picked Up from Doorstep',
                            desc: isPickedUp
                              ? 'Physical item collected and verified by courier partner at customer doorstep.'
                              : 'Courier partner scheduled to arrive at your delivery address for doorstep physical inspection and collection.',
                            date: isPickedUp ? 'Completed' : 'Pending Doorstep Pickup',
                            completed: isPickedUp,
                            active: isPickedUp && !isRefunded,
                          },
                          {
                            title: '3. 100% Refund Disbursed',
                            desc: isRefunded
                              ? `Refund of ₹${parseFloat(order.totalPrice.amount).toLocaleString('en-IN')} has been credited back to original payment method via Razorpay.`
                              : '100% refund is initiated automatically once the courier verifies and collects the package at your doorstep.',
                            date: isRefunded ? order.refundedAt || 'Refunded' : 'Pending',
                            completed: isRefunded,
                            active: isRefunded,
                          },
                        ];

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {stages.map((st, idx) => (
                              <div
                                key={idx}
                                style={{ display: 'flex', gap: 16, position: 'relative' }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 18,
                                      height: 18,
                                      background: st.completed ? '#000' : '#e5e7eb',
                                      color: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.65rem',
                                      fontWeight: 900,
                                      marginTop: 3,
                                      borderRadius: '0px',
                                      border: st.active ? '2px solid #000' : 'none',
                                    }}
                                  >
                                    {st.completed ? '✓' : ''}
                                  </div>
                                  {idx < stages.length - 1 && (
                                    <div
                                      style={{
                                        width: 2,
                                        flex: 1,
                                        minHeight: 36,
                                        background: st.completed ? '#000' : '#e5e7eb',
                                      }}
                                    />
                                  )}
                                </div>
                                <div style={{ paddingBottom: 22, flex: 1 }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'baseline',
                                      flexWrap: 'wrap',
                                      gap: 8,
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: '0.88rem',
                                        fontWeight: 900,
                                        color: st.completed ? '#000' : '#888',
                                      }}
                                    >
                                      {st.title}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        color: '#888',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                      }}
                                    >
                                      {st.date}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '0.8rem',
                                      color: st.completed ? '#444' : '#888',
                                      marginTop: 4,
                                      lineHeight: 1.45,
                                    }}
                                  >
                                    {st.desc}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="vahn-tracking-modal-footer">
                <button
                  type="button"
                  onClick={() => handleOpenTrackingModal(activeTrackingTab)}
                  className="vahn-tracking-modal-refresh-btn"
                >
                  ↻ Refresh Live Scans
                </button>
                {(() => {
                  const portalAwb =
                    activeTrackingTab === 'replacement'
                      ? order.replacementAwb || trackingModalData?.replacement_awb
                      : activeTrackingTab === 'reverse'
                        ? order.reverseAwb || trackingModalData?.reverse_awb
                        : order.shiprocketAwb || trackingModalData?.awb_code;
                  return (
                    <Link
                      href={`/track?q=${portalAwb || order.id}`}
                      target="_blank"
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: '#000',
                        textDecoration: 'underline',
                        textTransform: 'uppercase',
                      }}
                    >
                      Public Tracking Portal ↗
                    </Link>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowCancelModal(false)}
        >
          <div
            style={{
              background: '#fff',
              maxWidth: 480,
              width: '100%',
              padding: 'clamp(16px, 4vw, 28px)',
              borderRadius: '0px',
              border: '2px solid #000',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: '1.2rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                margin: '0 0 12px',
              }}
            >
              Cancel Order #{order.id}
            </h3>
            <p
              style={{ fontSize: '0.85rem', color: '#555', lineHeight: 1.5, marginBottom: '20px' }}
            >
              Are you sure you want to cancel this order? Since this order has not been dispatched
              yet, a <strong>100% full refund</strong> of ₹
              {parseFloat(order.totalPrice.amount).toLocaleString()} will be automatically processed
              to your original payment method via Razorpay.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                Cancellation Reason (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Changed mind, ordered wrong size, etc."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '0px',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
            </div>

            <div
              style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}
            >
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={submittingAction}
                style={{
                  background: '#fff',
                  border: '1px solid #ccc',
                  padding: '10px 18px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  borderRadius: '0px',
                }}
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={submittingAction}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  fontSize: '0.8rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  cursor: submittingAction ? 'not-allowed' : 'pointer',
                  borderRadius: '0px',
                }}
              >
                {submittingAction ? (
                  'Processing...'
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <span>Confirm & Refund</span>
                    <svg
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
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return / Replacement Request Modal (10-Day Automated Return & Exchange Window) */}
      {showReturnModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            overflowY: 'auto',
          }}
          onClick={() => setShowReturnModal(false)}
        >
          <div
            style={{
              background: '#fff',
              maxWidth: 620,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 'clamp(16px, 4vw, 28px)',
              borderRadius: '0px',
              border: '2px solid #000',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 16,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: '#666',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  10-Day Guarantee
                </span>
                <h3
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    margin: '2px 0 0',
                  }}
                >
                  Return / Replacement #{order.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  color: '#000',
                  padding: '4px 8px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Segmented Option Selector: Exchange vs Refund */}
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}
            >
              <button
                type="button"
                onClick={() => setReturnActionType('REPLACEMENT')}
                style={{
                  padding: '14px 12px',
                  border:
                    returnActionType === 'REPLACEMENT' ? '2px solid #000' : '1px solid #ddd',
                  background: returnActionType === 'REPLACEMENT' ? '#000' : '#fff',
                  color: returnActionType === 'REPLACEMENT' ? '#fff' : '#333',
                  fontWeight: 900,
                  fontSize: '0.82rem',
                  textTransform: 'uppercase',
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: '0px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  🔄 Exchange Size (Free)
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: returnActionType === 'REPLACEMENT' ? '#ccc' : '#777',
                  }}
                >
                  Select available replacement size
                </span>
              </button>

              <button
                type="button"
                onClick={() => setReturnActionType('RETURN')}
                style={{
                  padding: '14px 12px',
                  border: returnActionType === 'RETURN' ? '2px solid #000' : '1px solid #ddd',
                  background: returnActionType === 'RETURN' ? '#000' : '#fff',
                  color: returnActionType === 'RETURN' ? '#fff' : '#333',
                  fontWeight: 900,
                  fontSize: '0.82rem',
                  textTransform: 'uppercase',
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: '0px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  💰 Return for Refund
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: returnActionType === 'RETURN' ? '#ccc' : '#777',
                  }}
                >
                  100% Refund via Razorpay
                </span>
              </button>
            </div>

            {/* FLOW 1: REPLACEMENT (SIZE EXCHANGE) */}
            {returnActionType === 'REPLACEMENT' && (
              <div>
                <div
                  style={{
                    background: '#f9f9f9',
                    border: '1px solid #e5e5e5',
                    padding: '12px 14px',
                    marginBottom: '18px',
                    fontSize: '0.82rem',
                    color: '#222',
                    lineHeight: 1.45,
                  }}
                >
                  <strong>How Size Replacement Works:</strong> Choose your new size below.
                  Shiprocket reverse pickup will collect the original garment. Once picked up, your
                  replacement piece will be dispatched immediately!
                </div>

                {loadingExchangeOptions ? (
                  <div style={{ textAlign: 'center', padding: '30px 0' }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        border: '2px solid #000',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        margin: '0 auto 10px',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: '#666',
                        textTransform: 'uppercase',
                      }}
                    >
                      Checking Live Size Availability...
                    </span>
                  </div>
                ) : (
                  <div>
                    {(exchangeOptions?.items || []).map((item) => (
                      <div
                        key={item.item_id}
                        style={{
                          border: '1px solid #eee',
                          padding: '14px',
                          marginBottom: '18px',
                          background: '#fff',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            gap: 12,
                            alignItems: 'center',
                            marginBottom: 14,
                          }}
                        >
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={item.product_title}
                              width={48}
                              height={48}
                              style={{ objectFit: 'cover', border: '1px solid #ddd' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 48,
                                height: 48,
                                background: '#f3f4f6',
                                border: '1px solid #ddd',
                              }}
                            />
                          )}
                          <div>
                            <div
                              style={{
                                fontWeight: 900,
                                fontSize: '0.88rem',
                                textTransform: 'uppercase',
                              }}
                            >
                              {item.product_title}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#666' }}>
                              Currently Ordered: <strong>{item.current_variant_title}</strong>
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            marginBottom: 8,
                            color: '#444',
                          }}
                        >
                          Select New Size for Replacement *
                        </div>

                        {/* Variants Stock Grid */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                            gap: 8,
                          }}
                        >
                          {item.variants.map((v) => {
                            const isSelected = selectedVariantId === v.variant_id;
                            const isCurrent = v.is_current;
                            const isAvailable = v.is_available && !isCurrent;

                            return (
                              <button
                                key={v.variant_id}
                                type="button"
                                disabled={!isAvailable}
                                onClick={() => {
                                  setSelectedItemId(item.item_id);
                                  setSelectedVariantId(v.variant_id);
                                  setSelectedVariantTitle(v.title);
                                }}
                                style={{
                                  padding: '10px 8px',
                                  border: isSelected ? '2px solid #000' : '1px solid #ccc',
                                  background: isSelected
                                    ? '#000'
                                    : isCurrent
                                      ? '#f3f4f6'
                                      : isAvailable
                                        ? '#fff'
                                        : '#fafafa',
                                  color: isSelected ? '#fff' : isAvailable ? '#000' : '#999',
                                  cursor: isAvailable ? 'pointer' : 'not-allowed',
                                  textAlign: 'center',
                                  borderRadius: '0px',
                                  opacity: isAvailable || isSelected ? 1 : 0.6,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 4,
                                  transition: 'all 0.1s ease',
                                }}
                              >
                                <span style={{ fontWeight: 900, fontSize: '0.85rem' }}>
                                  {v.size || v.title}
                                </span>

                                {isCurrent ? (
                                  <span
                                    style={{ fontSize: '0.65rem', fontWeight: 700, color: '#666' }}
                                  >
                                    (Current)
                                  </span>
                                ) : isAvailable ? (
                                  <span
                                    style={{
                                      fontSize: '0.65rem',
                                      fontWeight: 800,
                                      color: isSelected ? '#fff' : '#16a34a',
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    {isSelected ? '✓ Selected' : '✓ In Stock'}
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: '0.62rem',
                                      fontWeight: 700,
                                      color: '#dc2626',
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    ✕ Out of Stock
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {item.variants.some((v) => !v.is_available && !v.is_current) && (
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: '#888',
                              marginTop: 8,
                              fontStyle: 'italic',
                            }}
                          >
                            * Out of stock sizes cannot be selected. If your desired size is
                            unavailable, please choose &ldquo;Return for Refund&rdquo;.
                          </div>
                        )}
                      </div>
                    ))}

                    <div style={{ marginBottom: '16px' }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          marginBottom: '6px',
                        }}
                      >
                        Reason for Replacement *
                      </label>
                      <select
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #ccc',
                          borderRadius: '0px',
                          fontSize: '0.85rem',
                          outline: 'none',
                          background: '#fff',
                        }}
                      >
                        <option value="SIZE_TOO_SMALL">Size Too Small — Need Larger Size</option>
                        <option value="SIZE_TOO_LARGE">Size Too Large — Need Smaller Size</option>
                        <option value="FIT_ISSUE">Fit / Cut Issue</option>
                        <option value="DEFECTIVE">
                          Defective or Damaged Piece (Need Fresh Piece)
                        </option>
                        <option value="OTHER">Other Reason</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          marginBottom: '6px',
                        }}
                      >
                        Additional Notes (Optional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Any specific delivery instructions or notes for the fulfillment team..."
                        value={returnNotes}
                        onChange={(e) => setReturnNotes(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #ccc',
                          borderRadius: '0px',
                          fontSize: '0.85rem',
                          outline: 'none',
                          resize: 'vertical',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* FLOW 2: RETURN FOR REFUND */}
            {returnActionType === 'RETURN' && (
              <div>
                <p
                  style={{
                    fontSize: '0.85rem',
                    color: '#555',
                    lineHeight: 1.5,
                    marginBottom: '20px',
                  }}
                >
                  VAHN provides a <strong>10-day hassle-free return window</strong>. Shiprocket
                  reverse pickup will be automatically dispatched to your delivery address. Once the
                  courier scans the package at your doorstep, a 100% refund of{' '}
                  <strong>₹{parseFloat(order.totalPrice.amount).toLocaleString()}</strong> will be
                  automatically credited to your payment account via Razorpay.
                </p>

                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      marginBottom: '6px',
                    }}
                  >
                    Reason for Return *
                  </label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #ccc',
                      borderRadius: '0px',
                      fontSize: '0.85rem',
                      outline: 'none',
                      background: '#fff',
                    }}
                  >
                    <option value="SIZE_FIT">Size / Fit Issue (Too small / Too large)</option>
                    <option value="DEFECTIVE">Item defective or damaged</option>
                    <option value="QUALITY">Quality not as expected</option>
                    <option value="WRONG_ITEM">Received incorrect product</option>
                    <option value="OTHER">Other Reason</option>
                  </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      marginBottom: '6px',
                    }}
                  >
                    Additional Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe why you want to return or any specific instructions..."
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #ccc',
                      borderRadius: '0px',
                      fontSize: '0.85rem',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Doorstep Quality Check (QC) Advisory Banner */}
            {returnActionType === 'REPLACEMENT' && (
              <div
                style={{
                  background: '#f9f9f9',
                  border: '1px solid #e5e5e5',
                  padding: '12px 14px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: '0.78rem',
                  color: '#222',
                  lineHeight: 1.4,
                }}
              >
                <ShieldCheckIcon
                  size={18}
                  color="#000"
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <div>
                  <strong style={{ color: '#000' }}>Doorstep Quality Check (QC) Active:</strong>
                  <div style={{ marginTop: 2 }}>
                    Please keep the apparel <strong>unworn</strong>, <strong>unwashed</strong>, with{' '}
                    <strong>original tags & packaging intact</strong>. The courier partner will
                    perform a quick physical verification before handing over your replacement unit.
                  </div>
                </div>
              </div>
            )}

            {/* Live Reverse Serviceability Status */}
            {revServiceable && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '10px 14px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.78rem',
                }}
              >
                <MapPinIcon size={14} color="#64748b" />
                {revServiceable.serviceable ? (
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>
                    &#10003; Doorstep reverse pickup serviceable for your address
                    {revServiceable.courierName ? ` via ${revServiceable.courierName}` : ''}
                  </span>
                ) : (
                  <span style={{ color: '#d97706', fontWeight: 600 }}>
                    &#9888; Note:{' '}
                    {revServiceable.message || 'Reverse pickup may require manual carrier routing.'}
                  </span>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
                borderTop: '1px solid #eee',
                paddingTop: 16,
              }}
            >
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                disabled={submittingAction}
                style={{
                  background: '#fff',
                  border: '1px solid #ccc',
                  padding: '10px 18px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  borderRadius: '0px',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleRequestReturn}
                disabled={
                  submittingAction || (returnActionType === 'REPLACEMENT' && !selectedVariantId)
                }
                style={{
                  background: '#000',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  fontSize: '0.82rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  cursor:
                    submittingAction || (returnActionType === 'REPLACEMENT' && !selectedVariantId)
                      ? 'not-allowed'
                      : 'pointer',
                  borderRadius: '0px',
                  opacity: returnActionType === 'REPLACEMENT' && !selectedVariantId ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {submittingAction ? (
                  'Processing...'
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <span>
                      {returnActionType === 'REPLACEMENT'
                        ? `Confirm Size Exchange (${selectedVariantTitle || 'Select Size'})`
                        : 'Schedule Pickup & 100% Refund'}
                    </span>
                    <svg
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
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER CANCEL RETURN CONFIRMATION MODAL */}
      {showCancelReturnModal && order && (
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
                Cancel {order.returnType === 'REPLACEMENT' ? 'Size Exchange' : 'Return'} Request
              </h3>
              <button
                type="button"
                onClick={() => setShowCancelReturnModal(false)}
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
              <strong>{order.returnType === 'REPLACEMENT' ? 'size exchange' : 'return'}</strong> request?
              <br />
              <br />
              Reverse courier doorstep pickup will be cancelled immediately, and your original item will remain yours.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowCancelReturnModal(false)}
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
                disabled={cancellingReturn}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 22px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: cancellingReturn ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {cancellingReturn ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
