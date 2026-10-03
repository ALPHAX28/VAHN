'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AdminBadge from '@/components/admin/AdminBadge';
import SchedulePickupWizardModal from '@/components/admin/SchedulePickupWizardModal';
import {
  AlertCircleIcon,
  CheckIcon,
  MapPinIcon,
  PackageIcon,
  PrinterIcon,
  TruckIcon,
  XIcon,
} from '@/components/icons/Icons';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  type AdminOrder,
  cancelAdminOrderReturn,
  cancelAdminOrderShipment,
  dispatchAdminOrderReplacement,
  getAdminOrder,
  getAdminOrderInvoice,
  getAdminOrderManifest,
  getAdminOrderShippingLabel,
  markAdminOrderReturnReceived,
  notifyAdminOrderReturn,
  refreshAdminOrderTracking,
  refundAdminOrder,
  rejectAdminOrderReturn,
  shipAdminOrder,
  updateOrderStatus,
} from '@/lib/api/admin';
import { parseCheckpointDate } from '@/lib/shipStatus';
import { getPublicTrackingUrl } from '@/lib/utils';

const ORDER_STATUSES = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
const REFUND_STATUSES = ['', 'PENDING', 'REFUNDED'];

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { adminToken } = useAdminAuth();
  const router = useRouter();

  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [status, setStatus] = useState('');
  const [refundStatus, setRefundStatus] = useState('');
  const [refundNote, setRefundNote] = useState('');

  // Logistics & Refund Actions
  const [dispatching, setDispatching] = useState(false);
  const [downloadingLabel, setDownloadingLabel] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [downloadingBoth, setDownloadingBoth] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [downloadingManifest, setDownloadingManifest] = useState(false);
  const [showCancelShipmentModal, setShowCancelShipmentModal] = useState(false);
  const [cancelShipmentReason, setCancelShipmentReason] = useState('');
  const [cancellingShipment, setCancellingShipment] = useState(false);
  const [refreshingTracking, setRefreshingTracking] = useState(false);
  const [showForwardScans, setShowForwardScans] = useState(false);
  const [showReverseScans, setShowReverseScans] = useState(false);
  const [showReplacementScans, setShowReplacementScans] = useState(false);
  const [adminExchangeTrackTab, setAdminExchangeTrackTab] = useState<'reverse' | 'replacement'>('reverse');
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState('');
  const [restockItems, setRestockItems] = useState(true);
  const [processingRefund, setProcessingRefund] = useState(false);
  const [dispatchingReplacement, setDispatchingReplacement] = useState(false);
  const [replacementAwbInput, setReplacementAwbInput] = useState('');
  const [replacementCourierInput, setReplacementCourierInput] = useState('Blue Dart Air');

  // Customer Return Notification Modal
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyType, setNotifyType] = useState<
    'UPDATE' | 'PICKUP_REMINDER' | 'VERIFIED' | 'CUSTOM'
  >('UPDATE');
  const [notifySubject, setNotifySubject] = useState('');
  const [notifyCustomMessage, setNotifyCustomMessage] = useState('');
  const [notifyingCustomer, setNotifyingCustomer] = useState(false);

  // Cancel Return / Size Exchange State
  const [showCancelReturnModal, setShowCancelReturnModal] = useState(false);
  const [cancelReturnReason, setCancelReturnReason] = useState(
    'Customer requested cancellation of return/exchange'
  );
  const [cancellingReturn, setCancellingReturn] = useState(false);

  async function handleCancelReturn() {
    if (!adminToken || !order) return;
    setCancellingReturn(true);
    try {
      const updated = await cancelAdminOrderReturn(adminToken, order.id, {
        reason: cancelReturnReason || 'Customer requested cancellation of return/exchange',
      });
      setOrder(updated);
      toast.success(
        `${order.return_type === 'REPLACEMENT' ? 'Size exchange' : 'Return'} request cancelled successfully. Courier pickup cancelled and inventory restored.`
      );
      setShowCancelReturnModal(false);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message;
      toast.error(msg || 'Failed to cancel return request.');
    } finally {
      setCancellingReturn(false);
    }
  }

  // Warehouse Delivery & QC Rejection State
  const [markingWarehouseReceived, setMarkingWarehouseReceived] = useState(false);
  const [showRejectReturnModal, setShowRejectReturnModal] = useState(false);
  const [rejectReturnReason, setRejectReturnReason] = useState('');
  const [rejectingReturn, setRejectingReturn] = useState(false);

  async function handleMarkWarehouseReceived() {
    if (!adminToken || !order) return;
    setMarkingWarehouseReceived(true);
    try {
      const updated = await markAdminOrderReturnReceived(adminToken, order.id);
      setOrder(updated);
      toast.success(
        order.return_type === 'REPLACEMENT'
          ? 'Return parcel received at warehouse. Original size inventory restocked!'
          : 'Return parcel received at warehouse. Item restocked to inventory & refund controls unlocked.'
      );
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message;
      toast.error(msg || 'Failed to mark return received at warehouse.');
    } finally {
      setMarkingWarehouseReceived(false);
    }
  }

  async function handleRejectReturn() {
    if (!adminToken || !order) return;
    const trimmed = rejectReturnReason.trim();
    if (!trimmed) {
      toast.error('A mandatory rejection reason is required (e.g. QC failure, tags removed).');
      return;
    }
    setRejectingReturn(true);
    try {
      const updated = await rejectAdminOrderReturn(adminToken, order.id, { reason: trimmed });
      setOrder(updated);
      toast.success('Return refund rejected & cancelled. Customer status updated.');
      setShowRejectReturnModal(false);
      setRejectReturnReason('');
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message;
      toast.error(msg || 'Failed to reject return refund.');
    } finally {
      setRejectingReturn(false);
    }
  }

  const [showManualAwb, setShowManualAwb] = useState(false);

  async function handleDispatchReplacement(isManual: boolean = false) {
    if (!adminToken || !order) return;
    if (isManual && !replacementAwbInput.trim()) {
      toast.error('Please enter an AWB tracking code for the manual replacement shipment.');
      return;
    }
    setDispatchingReplacement(true);
    setError('');
    setSuccess('');
    try {
      const payload = isManual
        ? { awb_code: replacementAwbInput.trim(), courier_name: replacementCourierInput }
        : {};
      const res = await dispatchAdminOrderReplacement(adminToken, order.id, payload);
      setOrder(res);
      const awbText = res.replacement_awb || replacementAwbInput || 'Assigned';
      toast.success(
        `Replacement shipment dispatched via Shiprocket (AWB: ${awbText})! Customer notified via email.`
      );
      setSuccess(`Replacement shipment dispatched (AWB: ${awbText})!`);
      setTimeout(() => setSuccess(''), 4000);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to dispatch replacement via Shiprocket.');
      toast.error(e?.message || 'Failed to dispatch replacement via Shiprocket.');
    } finally {
      setDispatchingReplacement(false);
    }
  }

  async function handleNotifyCustomer() {
    if (!adminToken || !order) return;
    setNotifyingCustomer(true);
    try {
      const res = await notifyAdminOrderReturn(adminToken, order.id, {
        notification_type: notifyType,
        custom_message: notifyCustomMessage || undefined,
        subject: notifySubject || undefined,
      });
      toast.success(res.message || 'Customer notified successfully via email!');
      setShowNotifyModal(false);
      setNotifyCustomMessage('');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send notification to customer.');
    } finally {
      setNotifyingCustomer(false);
    }
  }

  async function load() {
    if (!adminToken) return;
    try {
      const o = await getAdminOrder(adminToken, id);
      setOrder(o);
      setStatus(o.status);
      setRefundStatus(o.refund_status || '');
      setRefundNote(o.refund_note || '');
      setRefundAmount(o.total_amount);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [adminToken, id]);

  async function handleSave() {
    if (!adminToken) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await updateOrderStatus(adminToken, id, {
        status,
        refund_status: refundStatus || undefined,
        refund_note: refundNote || undefined,
      });
      setSuccess('Order status updated successfully!');
      await load();
      setTimeout(() => setSuccess(''), 3500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDispatchShipment() {
    if (!adminToken || !order) return;
    setDispatching(true);
    setError('');
    setSuccess('');
    try {
      const res = await shipAdminOrder(adminToken, order.id);
      setSuccess(
        `Shipment dispatched via Shiprocket! Courier: ${res.courier_name || 'Express Courier'} | AWB: ${res.awb_code}`
      );
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to dispatch shipment.');
    } finally {
      setDispatching(false);
    }
  }

  async function handleDownloadLabel() {
    if (!adminToken || !order) return;
    setDownloadingLabel(true);
    setError('');
    try {
      const res = await getAdminOrderShippingLabel(adminToken, order.id);
      if (res.label_url) {
        window.open(res.label_url, '_blank');
      } else {
        setError(res.message || 'Shipping label is pending courier generation in Shiprocket.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch official Shiprocket label.');
    } finally {
      setDownloadingLabel(false);
    }
  }

  async function handleDownloadInvoice() {
    if (!adminToken || !order) return;
    setDownloadingInvoice(true);
    setError('');
    try {
      const res = await getAdminOrderInvoice(adminToken, order.id);
      if (res.invoice_url) {
        window.open(res.invoice_url, '_blank');
      } else {
        setError(res.message || 'Invoice is pending generation in Shiprocket.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to download invoice.');
    } finally {
      setDownloadingInvoice(false);
    }
  }

  async function handleDownloadBoth() {
    if (!adminToken || !order) return;
    setDownloadingBoth(true);
    setError('');
    try {
      const [labelRes, invoiceRes] = await Promise.all([
        getAdminOrderShippingLabel(adminToken, order.id).catch((err) => ({
          label_url: '',
          message: err?.message,
        })),
        getAdminOrderInvoice(adminToken, order.id).catch((err) => ({
          invoice_url: '',
          message: err?.message,
        })),
      ]);
      let openedCount = 0;
      if (labelRes.label_url) {
        window.open(labelRes.label_url, '_blank');
        openedCount++;
      }
      if (invoiceRes.invoice_url) {
        setTimeout(() => {
          window.open(invoiceRes.invoice_url, '_blank');
        }, 400);
        openedCount++;
      }
      if (openedCount === 0) {
        setError(
          labelRes.message ||
            invoiceRes.message ||
            'Label and Invoice are pending generation in Shiprocket.'
        );
      } else if (!labelRes.label_url) {
        setError(
          "Invoice opened, but Shipping Label is still generating in Shiprocket. Click 'Download Label' to retry."
        );
      } else if (!invoiceRes.invoice_url) {
        setError(
          "Shipping Label opened, but Tax Invoice is still generating in Shiprocket. Click 'Download Invoice' to retry."
        );
      } else {
        setSuccess('Opened Official Shiprocket Label and Tax Invoice in new tabs.');
        setTimeout(() => setSuccess(''), 4000);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to download label and invoice.');
    } finally {
      setDownloadingBoth(false);
    }
  }

  async function handleDownloadManifest() {
    if (!adminToken || !order) return;
    setDownloadingManifest(true);
    setError('');
    try {
      const res = await getAdminOrderManifest(adminToken, order.id);
      if (res.manifest_url) {
        window.open(res.manifest_url, '_blank');
      } else {
        setError(
          res.message ||
            'Manifest is still being generated in Shiprocket. Please try again in a moment.'
        );
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to download manifest.');
    } finally {
      setDownloadingManifest(false);
    }
  }

  async function handleCancelShipment() {
    if (!adminToken || !order) return;
    setCancellingShipment(true);
    setError('');
    try {
      const updated = await cancelAdminOrderShipment(adminToken, order.id, {
        reason: cancelShipmentReason,
      });
      setOrder(updated);
      setStatus(updated.status);
      setRefundStatus(updated.refund_status || '');
      setShowCancelShipmentModal(false);
      setSuccess(
        'Shipment cancelled, inventory restocked, and 100% refund initiated via Razorpay!'
      );
      await load();
      setTimeout(() => setSuccess(''), 5000);
    } catch (e: any) {
      setError(e?.message || 'Failed to cancel shipment in Shiprocket.');
    } finally {
      setCancellingShipment(false);
    }
  }

  async function handleRefreshTracking() {
    if (!adminToken || !order) return;
    setRefreshingTracking(true);
    setError('');
    try {
      const updated = await refreshAdminOrderTracking(adminToken, order.id);
      setOrder(updated);
      setSuccess('Live tracking checkpoints synchronized from courier network!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (e: any) {
      setError(e?.message || 'Failed to refresh live tracking.');
    } finally {
      setRefreshingTracking(false);
    }
  }

  async function handleProcessRefund() {
    if (!adminToken || !order) return;
    setProcessingRefund(true);
    setError('');
    try {
      const res = await refundAdminOrder(adminToken, order.id, {
        amount: refundAmount || order.total_amount,
        reason: refundReason || 'Admin manual refund',
        restock_items: restockItems,
      });
      setSuccess(
        `Refund processed successfully via Razorpay (Refund ID: ${res.refund_id || 'Active'})`
      );
      setShowRefundModal(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to process refund via Razorpay.');
    } finally {
      setProcessingRefund(false);
    }
  }

  if (loading)
    return (
      <div className="admin-page">
        <div className="admin-loading-row">
          <div className="admin-loading-spinner" />
          <span>Loading order #{id}...</span>
        </div>
      </div>
    );
  if (!order)
    return (
      <div className="admin-page">
        <div className="admin-alert admin-alert--error">{error || 'Order not found'}</div>
      </div>
    );

  const addr = order.shipping_address || {};

  const isPickupScheduled = Boolean(
    order.tracking_data?.pickup_scheduled ||
      order.tracking_data?.pickup_token ||
      order.shipping_status === 'PICKUP_SCHEDULED' ||
      order.shipping_status === 'PICKUP_QUEUED'
  );

  const pickupScheduledDate: string | null = order.tracking_data?.pickup_scheduled_date || null;
  const pickupToken: string | null = order.tracking_data?.pickup_token || null;
  // Use live tracking courier_name if available (most accurate from Shiprocket)
  const displayCourierName: string | null =
    order.tracking_data?.courier_name || order.shiprocket_courier_name || null;

  return (
    <div className="admin-page">
      {error && <div className="admin-alert admin-alert--error">{error}</div>}
      {success && <div className="admin-alert admin-alert--success">{success}</div>}

      {order.payment_status === 'FAILED' && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderLeft: '6px solid #dc2626',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
          }}
        >
          <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>⚠️</span>
          <div>
            <div
              style={{
                fontSize: '0.95rem',
                fontWeight: 900,
                color: '#991b1b',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              Payment Failed — Transaction Incomplete
            </div>
            <div style={{ fontSize: '0.84rem', color: '#7f1d1d', marginTop: 4, lineHeight: 1.45 }}>
              The customer&apos;s online payment was not captured or failed at Razorpay checkout.
              Because no funds were received,{' '}
              <strong>this order cannot be fulfilled, dispatched, or refunded</strong>.
            </div>
          </div>
        </div>
      )}

      {/* Header Title & Nav */}
      <div className="admin-page-header">
        <div>
          <button
            onClick={() => router.push('/admin/orders')}
            className="admin-btn-inline-link"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 8,
              fontSize: '0.8125rem',
              color: 'var(--admin-text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              padding: 0,
            }}
          >
            ← Back to Orders
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1
              className="admin-page-title"
              style={{ fontSize: '1.75rem', fontWeight: 900, margin: 0 }}
            >
              {order.id}
            </h1>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                background: order.is_guest ? '#e0e0e0' : '#000',
                color: order.is_guest ? '#333' : '#fff',
                padding: '3px 8px',
                borderRadius: '0px',
                textTransform: 'uppercase',
              }}
            >
              {order.is_guest ? 'GUEST ORDER' : 'REGISTERED ATHLETE'}
            </span>
          </div>
          <p className="admin-page-subtitle" style={{ marginTop: 6 }}>
            Created on{' '}
            {new Date(order.created_at).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>

        <div className="admin-header-actions">
          {order.shiprocket_awb && (
            <a
              href={getPublicTrackingUrl(order.shiprocket_awb)}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-btn admin-btn--secondary"
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <TruckIcon size={14} color="#000" />
              Public Tracking Portal →
            </a>
          )}
        </div>
      </div>

      <div className="admin-order-layout">
        {/* Left Main Content */}
        <div className="admin-order-main">
          {/* Unified Fulfillment & Logistics Command Card */}
          {(() => {
            const isPaymentFailed = order.payment_status === 'FAILED';
            const isCancelled =
              order.status === 'CANCELLED' || order.shipping_status === 'CANCELLED';
            const isDelivered =
              order.status === 'DELIVERED' || order.shipping_status === 'DELIVERED';
            const isReplacement = order.return_type === 'REPLACEMENT';

            // Active Return/Exchange: return requested, picked up, or replacement dispatched (NOT cancelled)
            const isReturnActive = Boolean(
              order.return_status &&
                order.return_status !== 'NONE' &&
                order.return_status !== 'CANCELLED' &&
                order.replacement_status !== 'CANCELLED'
            );

            const isReturnCancelled = Boolean(
              order.return_status === 'CANCELLED' || order.replacement_status === 'CANCELLED'
            );

            const isReplacementDispatched = order.replacement_status === 'REPLACEMENT_DISPATCHED';

            const reverseTracking = order.reverse_tracking_data;
            const rawRevScans: Array<{ date?: string; activity: string; location?: string }> =
              Array.isArray(reverseTracking?.scans) ? reverseTracking.scans : [];
            const reverseScans = [...rawRevScans].sort((a, b) => {
              const tA = parseCheckpointDate(a.date);
              const tB = parseCheckpointDate(b.date);
              return tB - tA;
            });
            const reverseCurrentLocation =
              reverseTracking?.current_location ||
              (reverseScans.length > 0 ? reverseScans[0]?.location : null) ||
              'Customer Area / Sorting Hub';

            const isPickedUpFromCustomer =
              isReturnActive &&
              (Boolean(reverseTracking?.is_picked_up) ||
                order.return_status === 'PICKED_UP' ||
                order.replacement_status === 'PICKED_UP' ||
                order.return_status === 'REFUNDED' ||
                reverseScans.some(
                  (s) =>
                    !/cancel/i.test(s.activity || '') &&
                    /picked up|doorstep collection|qc pass|item collected/i.test(s.activity || '')
                ));

            const isDeliveredToWarehouse =
              isReturnActive &&
              Boolean(
                order.return_status === 'DELIVERED_TO_WAREHOUSE' ||
                  order.return_status === 'RETURN_DELIVERED' ||
                  order.return_status === 'COMPLETED' ||
                  order.return_status === 'RESOLVED' ||
                  reverseTracking?.is_delivered ||
                  (reverseTracking as { delivered_to_warehouse?: boolean })
                    ?.delivered_to_warehouse ||
                  reverseCurrentLocation.toLowerCase().includes('delivered') ||
                  reverseCurrentLocation.toLowerCase().includes('warehouse') ||
                  reverseScans.some((s) =>
                    /delivered to warehouse|reached warehouse|return delivered|delivered/i.test(
                      s.activity || ''
                    )
                  )
              );

            const isReturnRejected =
              order.return_status === 'REJECTED' || order.refund_status === 'REJECTED';
            const isRefundProcessed =
              order.refund_status === 'REFUNDED' || order.payment_status === 'REFUNDED';

            const rawRepScans: Array<{ date?: string; activity: string; location?: string }> =
              Array.isArray((order.tracking_data as any)?.replacement_scans)
                ? (order.tracking_data as any).replacement_scans
                : Array.isArray((order.tracking_data as any)?.replacement_tracking?.scans)
                  ? (order.tracking_data as any).replacement_tracking.scans
                  : [];
            const replacementScans = [...rawRepScans].sort((a, b) => {
              const tA = parseCheckpointDate(a.date);
              const tB = parseCheckpointDate(b.date);
              return tB - tA;
            });
            const replacementCurrentLocation =
              (order.tracking_data as any)?.replacement_current_location ||
              (order.tracking_data as any)?.replacement_tracking?.current_location ||
              (replacementScans.length > 0 ? replacementScans[0]?.location : null) ||
              (order.replacement_awb ? 'In Transit to Customer' : 'Warehouse / Dispatch Facility');

            const forwardTracking = order.tracking_data;
            const rawFwdScans: Array<{ date?: string; activity: string; location?: string }> =
              Array.isArray(forwardTracking?.scans) ? forwardTracking.scans : [];
            const forwardScans = [...rawFwdScans].sort((a, b) => {
              const tA = parseCheckpointDate(a.date);
              const tB = parseCheckpointDate(b.date);
              return tB - tA;
            });
            const forwardCurrentLocation = isPaymentFailed
              ? 'Fulfillment Blocked (Payment Failed)'
              : isCancelled
                ? 'Shipment Revoked & Cancelled'
                : forwardTracking?.current_location ||
                  (forwardScans.length > 0
                    ? forwardScans[0]?.location
                    : null) ||
                  (isDelivered
                    ? 'Delivered to Customer'
                    : order.shiprocket_awb
                      ? 'In Transit'
                      : 'Awaiting Dispatch');

            const isOutForDelivery =
              !isDelivered &&
              (order.shipping_status === 'OUT_FOR_DELIVERY' ||
                forwardScans.some((s) => /out for delivery/i.test(s.activity || '')));

            const isForwardPickedUp = Boolean(
              forwardTracking?.is_picked_up ||
                order.shipping_status === 'IN_TRANSIT' ||
                order.shipping_status === 'SHIPPED' ||
                order.shipping_status === 'PICKED_UP' ||
                order.shipping_status === 'OUT_FOR_DELIVERY' ||
                isDelivered ||
                forwardScans.some(
                  (s) =>
                    !/cancel/i.test(s.activity || '') &&
                    /picked up|in transit|reached hub|out for delivery|shipment connected|dispatched from|arrived at/i.test(
                      s.activity || ''
                    )
                )
            );

            const isInTransit =
              !isDelivered &&
              !isOutForDelivery &&
              (order.shipping_status === 'IN_TRANSIT' ||
                order.shipping_status === 'SHIPPED' ||
                isForwardPickedUp ||
                Boolean(order.shiprocket_awb && forwardScans.length > 0));

            const isPickupScheduledPending =
              !isDelivered &&
              !isOutForDelivery &&
              !isInTransit &&
              !isForwardPickedUp &&
              Boolean(
                order.tracking_data?.pickup_scheduled ||
                  order.tracking_data?.pickup_token ||
                  order.shipping_status === 'PICKUP_SCHEDULED' ||
                  order.shipping_status === 'PICKUP_QUEUED'
              );

            // Single authoritative Card Title, Icon, Border Accent, and Status Badge
            let cardTitle = 'Forward Logistics (Shiprocket)';
            let cardIcon = <TruckIcon size={20} color="#4232d9" />;
            let borderAccent = '#4232d9';
            let cardBg = '#fff';
            let statusBadge = {
              text: order.shipping_status || 'UNFULFILLED',
              bg: '#fffbe6',
              color: '#d48806',
              border: '#ffe58f',
            };

            if (isPaymentFailed) {
              cardTitle = 'Logistics & Fulfillment';
              cardIcon = <AlertCircleIcon size={20} color="#dc2626" />;
              borderAccent = '#dc2626';
              statusBadge = {
                text: 'PAYMENT FAILED',
                bg: '#fef2f2',
                color: '#dc2626',
                border: '#fca5a5',
              };
            } else if (isCancelled) {
              cardTitle = 'Logistics & Fulfillment';
              cardIcon = <XIcon size={20} color="#dc2626" />;
              borderAccent = '#dc2626';
              statusBadge = {
                text: 'CANCELLED',
                bg: '#fef2f2',
                color: '#dc2626',
                border: '#fca5a5',
              };
            } else if (isReturnActive) {
              cardTitle = isReplacement
                ? 'Size Replacement & Exchange Logistics'
                : 'Reverse Return Logistics';
              cardIcon = <PackageIcon size={20} color={isReplacement ? '#000' : '#fa8c16'} />;
              borderAccent = isReplacement ? '#000' : '#fa8c16';
              cardBg = isReplacement ? '#fafafa' : '#fffaf0';

              if (isReturnRejected) {
                statusBadge = {
                  text: 'RETURN REJECTED (QC FAILED)',
                  bg: '#fef2f2',
                  color: '#dc2626',
                  border: '#fca5a5',
                };
              } else if (isRefundProcessed) {
                statusBadge = {
                  text: 'REFUND COMPLETED',
                  bg: '#f0fdf4',
                  color: '#16a34a',
                  border: '#bbf7d0',
                };
              } else if (isReplacementDispatched) {
                statusBadge = {
                  text: 'EXCHANGE DISPATCHED',
                  bg: '#f3f4f6',
                  color: '#000',
                  border: '#e5e7eb',
                };
              } else if (isDeliveredToWarehouse) {
                statusBadge = {
                  text: isReplacement
                    ? 'ORIGINAL RECEIVED (RESTOCKED)'
                    : 'DELIVERED TO WAREHOUSE (QC PENDING)',
                  bg: '#eff6ff',
                  color: '#1d4ed8',
                  border: '#bfdbfe',
                };
              } else if (isPickedUpFromCustomer) {
                statusBadge = {
                  text: isReplacement ? 'ORIGINAL PICKED UP' : 'PARCEL PICKED UP',
                  bg: '#f6ffed',
                  color: '#389e0d',
                  border: '#b7eb8f',
                };
              } else {
                statusBadge = {
                  text: isReplacement ? 'EXCHANGE REQUESTED' : 'RETURN REQUESTED',
                  bg: '#fffbe6',
                  color: '#d48806',
                  border: '#ffe58f',
                };
              }
            } else if (isDelivered) {
              cardTitle = 'Logistics & Order Fulfillment';
              cardIcon = <CheckIcon size={20} color="#52c41a" />;
              borderAccent = '#52c41a';
              statusBadge = {
                text: 'DELIVERED',
                bg: '#f6ffed',
                color: '#389e0d',
                border: '#b7eb8f',
              };
            } else if (isOutForDelivery) {
              cardTitle = 'Forward Logistics (Shiprocket)';
              cardIcon = <TruckIcon size={20} color="#1d4ed8" />;
              borderAccent = '#1d4ed8';
              statusBadge = {
                text: 'OUT FOR DELIVERY',
                bg: '#eff6ff',
                color: '#1d4ed8',
                border: '#bfdbfe',
              };
            } else if (isInTransit) {
              cardTitle = 'Forward Logistics (Shiprocket)';
              cardIcon = <TruckIcon size={20} color="#1d4ed8" />;
              borderAccent = '#1d4ed8';
              statusBadge = {
                text: 'IN TRANSIT',
                bg: '#eff6ff',
                color: '#1d4ed8',
                border: '#bfdbfe',
              };
            } else if (isPickupScheduledPending) {
              cardTitle = 'Forward Logistics (Shiprocket)';
              cardIcon = <TruckIcon size={20} color="#d97706" />;
              borderAccent = '#d97706';
              statusBadge = {
                text: 'PICKUP SCHEDULED',
                bg: '#fffbe6',
                color: '#d48806',
                border: '#ffe58f',
              };
            } else if (order.shiprocket_awb) {
              cardTitle = 'Forward Logistics (Shiprocket)';
              cardIcon = <TruckIcon size={20} color="#4232d9" />;
              borderAccent = '#4232d9';
              statusBadge = {
                text: 'AWB ASSIGNED',
                bg: '#f3f4f6',
                color: '#111827',
                border: '#e5e7eb',
              };
            }

            return (
              <div
                className="admin-card"
                style={{
                  borderLeft: `4px solid ${borderAccent}`,
                  background: cardBg,
                  position: 'relative',
                  marginBottom: '24px',
                }}
              >
                {/* Single Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {cardIcon}
                    <h2
                      className="admin-card-title"
                      style={{
                        margin: 0,
                        textTransform: 'uppercase',
                        color: isReturnActive ? '#000000' : '#111',
                      }}
                    >
                      {cardTitle}
                    </h2>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {isReturnActive && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowNotifyModal(true)}
                          style={{
                            background: '#f3f4f6',
                            border: '1px solid #d1d5db',
                            padding: '5px 12px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: '0px',
                            textTransform: 'uppercase',
                          }}
                        >
                          ✉ Notify Customer
                        </button>
                        <button
                          type="button"
                          onClick={handleRefreshTracking}
                          disabled={refreshingTracking}
                          style={{
                            background: '#f3f4f6',
                            border: '1px solid #d1d5db',
                            padding: '5px 12px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: refreshingTracking ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: '0px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {refreshingTracking ? 'Refreshing...' : '↻ Refresh Return Tracking'}
                        </button>
                      </>
                    )}

                    {!isReturnActive &&
                      order.shiprocket_awb &&
                      !isCancelled &&
                      !isPaymentFailed && (
                        <button
                          type="button"
                          onClick={handleRefreshTracking}
                          disabled={refreshingTracking}
                          style={{
                            background: '#f3f4f6',
                            border: '1px solid #d1d5db',
                            padding: '5px 12px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: refreshingTracking ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: '0px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {refreshingTracking ? 'Refreshing...' : '↻ Refresh Live Tracking'}
                        </button>
                      )}

                    {/* Single Authoritative Status Badge */}
                    <span
                      style={{
                        background: statusBadge.bg,
                        color: statusBadge.color,
                        border: `1px solid ${statusBadge.border}`,
                        padding: '5px 12px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                      }}
                    >
                      {statusBadge.text}
                    </span>
                  </div>
                </div>

                {/* Card Body - Adapts Dynamically */}
                {isReturnActive ? (
                  /* =========================================================================
                     ACTIVE RETURN / SIZE EXCHANGE FLOW
                     ========================================================================= */
                  <div>
                    {/* For Exchange Orders: Dual Journey Tabs (Reverse Pickup <-> Replacement Order) */}
                    {isReplacement && (
                      <div
                        style={{
                          display: 'flex',
                          borderBottom: '2px solid #000',
                          marginBottom: 16,
                          background: '#f3f4f6',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setAdminExchangeTrackTab('reverse')}
                          style={{
                            flex: 1,
                            padding: '12px 14px',
                            fontWeight: 900,
                            fontSize: '0.8rem',
                            textTransform: 'uppercase',
                            letterSpacing: '-0.02em',
                            background:
                              adminExchangeTrackTab === 'reverse' ? '#fff' : 'transparent',
                            color: adminExchangeTrackTab === 'reverse' ? '#000' : '#666',
                            border: 'none',
                            borderBottom:
                              adminExchangeTrackTab === 'reverse' ? '3px solid #000' : 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          <span>📦 Reverse Pickup (Customer → Warehouse)</span>
                          {reverseScans.length > 0 && (
                            <span
                              style={{
                                background: '#000',
                                color: '#fff',
                                fontSize: '0.68rem',
                                padding: '1px 6px',
                                borderRadius: '10px',
                              }}
                            >
                              {reverseScans.length}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminExchangeTrackTab('replacement')}
                          style={{
                            flex: 1,
                            padding: '12px 14px',
                            fontWeight: 900,
                            fontSize: '0.8rem',
                            textTransform: 'uppercase',
                            letterSpacing: '-0.02em',
                            background:
                              adminExchangeTrackTab === 'replacement' ? '#fff' : 'transparent',
                            color: adminExchangeTrackTab === 'replacement' ? '#000' : '#666',
                            border: 'none',
                            borderBottom:
                              adminExchangeTrackTab === 'replacement' ? '3px solid #000' : 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          <span>⚡ Replacement Order (Warehouse → Customer)</span>
                          {replacementScans.length > 0 && (
                            <span
                              style={{
                                background: '#000',
                                color: '#fff',
                                fontSize: '0.68rem',
                                padding: '1px 6px',
                                borderRadius: '10px',
                              }}
                            >
                              {replacementScans.length}
                            </span>
                          )}
                        </button>
                      </div>
                    )}

                    {/* REVERSE PICKUP VIEW (Customer -> Warehouse) */}
                    {(!isReplacement || adminExchangeTrackTab === 'reverse') && (
                      <div>
                        {/* Reverse Status Banner */}
                        {isPickedUpFromCustomer ? (
                          <div
                            style={{
                              background: '#f6ffed',
                              border: '1px solid #b7eb8f',
                              padding: '12px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              marginBottom: 16,
                            }}
                          >
                            <CheckIcon size={20} color="#52c41a" />
                            <div>
                              <strong
                                style={{
                                  color: '#274f13',
                                  fontSize: '0.85rem',
                                  textTransform: 'uppercase',
                                  display: 'block',
                                }}
                              >
                                Parcel Successfully Picked Up from Customer
                              </strong>
                              <span style={{ fontSize: '0.78rem', color: '#389e0d' }}>
                                Physical original item collected at customer doorstep and verified by{' '}
                                {order.reverse_courier_name || 'Delhivery Reverse Surface'}. Doorstep QC
                                Passed.
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              background: '#fffbe6',
                              border: '1px solid #ffe58f',
                              padding: '12px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              marginBottom: 16,
                            }}
                          >
                            <AlertCircleIcon size={20} color="#d48806" />
                            <div>
                              <strong
                                style={{
                                  color: '#ad6800',
                                  fontSize: '0.85rem',
                                  textTransform: 'uppercase',
                                  display: 'block',
                                }}
                              >
                                Doorstep Reverse Pickup Scheduled
                              </strong>
                              <span style={{ fontSize: '0.78rem', color: '#874d00' }}>
                                Courier agent assigned for doorstep collection. Customer advised to keep
                                original brand tags and packaging ready.
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Reverse Logistics Details Grid */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: '12px 16px',
                            padding: '14px',
                            background: '#fff',
                            border: '1px solid #eee',
                            marginBottom: 16,
                          }}
                        >
                          <div>
                            <span
                              style={{
                                color: '#777',
                                display: 'block',
                                fontSize: '0.7rem',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                              }}
                            >
                              Reverse Courier
                            </span>
                            <strong style={{ fontSize: '0.82rem', color: '#111' }}>
                              {order.reverse_courier_name || 'Shiprocket Reverse Logistics'}
                            </strong>
                          </div>
                          <div>
                            <span
                              style={{
                                color: '#777',
                                display: 'block',
                                fontSize: '0.7rem',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                              }}
                            >
                              Reverse AWB
                            </span>
                            {order.reverse_awb ? (
                              <a
                                href={getPublicTrackingUrl(order.reverse_awb)}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  fontSize: '0.82rem',
                                  fontWeight: 800,
                                  fontFamily: 'monospace',
                                  color: '#000',
                                  textDecoration: 'underline',
                                }}
                              >
                                {order.reverse_awb}
                              </a>
                            ) : (
                              <span style={{ fontSize: '0.82rem', color: '#999' }}>
                                Assigned on Pickup
                              </span>
                            )}
                          </div>
                          <div>
                            <span
                              style={{
                                color: '#777',
                                display: 'block',
                                fontSize: '0.7rem',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                              }}
                            >
                              Customer Reason
                            </span>
                            <strong style={{ fontSize: '0.82rem', color: '#111' }}>
                              {order.return_reason || (isReplacement ? 'Size Mismatch' : 'Return')}
                            </strong>
                          </div>
                          <div>
                            <span
                              style={{
                                color: '#777',
                                display: 'block',
                                fontSize: '0.7rem',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                              }}
                            >
                              Reverse Package Location
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MapPinIcon size={12} color="#000" />
                              <span
                                style={{
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  color: '#111',
                                }}
                              >
                                {reverseCurrentLocation}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Reverse Checkpoints Toggle */}
                        <div style={{ marginBottom: 16 }}>
                          <button
                            type="button"
                            onClick={() => setShowReverseScans(!showReverseScans)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#000',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              padding: 0,
                              textTransform: 'uppercase',
                              textDecoration: 'underline',
                            }}
                          >
                            {showReverseScans
                              ? '▲ Hide Reverse Checkpoints'
                              : `▼ View Reverse Checkpoints (${reverseScans.length})`}
                          </button>
                          {showReverseScans && (
                            <div
                              style={{
                                marginTop: 10,
                                background: '#fff',
                                border: '1px solid #eee',
                                padding: '12px',
                              }}
                            >
                              {reverseScans.length > 0 ? (
                                reverseScans.map((s, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: 12,
                                      padding: '6px 0',
                                      borderBottom:
                                        idx === reverseScans.length - 1
                                          ? 'none'
                                          : '1px solid #f3f4f6',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: idx === 0 ? '#000' : '#bbb',
                                        marginTop: 6,
                                      }}
                                    />
                                    <div>
                                      <strong style={{ fontSize: '0.8rem', display: 'block' }}>
                                        {s.activity}
                                      </strong>
                                      <span style={{ fontSize: '0.72rem', color: '#666' }}>
                                        {s.location ? `${s.location} • ` : ''}
                                        {s.date || ''}
                                      </span>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                  Reverse shipment registered. Live courier scans will display here
                                  upon doorstep pickup.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* REPLACEMENT DELIVERY VIEW (Warehouse -> Customer) */}
                    {isReplacement && adminExchangeTrackTab === 'replacement' && (
                      <div>
                        {/* Replacement Status Banner */}
                        {isReplacementDispatched ? (
                          <div
                            style={{
                              background: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              padding: '12px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              marginBottom: 16,
                            }}
                          >
                            <CheckIcon size={20} color="#16a34a" />
                            <div>
                              <strong
                                style={{
                                  color: '#15803d',
                                  fontSize: '0.85rem',
                                  textTransform: 'uppercase',
                                  display: 'block',
                                }}
                              >
                                Replacement Unit Dispatched to Customer
                              </strong>
                              <span style={{ fontSize: '0.78rem', color: '#166534' }}>
                                Fresh size package dispatched via{' '}
                                {order.replacement_courier_name || 'Express Courier'} (AWB:{' '}
                                <code style={{ fontWeight: 800 }}>
                                  {order.replacement_awb || 'Assigned'}
                                </code>
                                ).
                              </span>
                            </div>
                          </div>
                        ) : isPickedUpFromCustomer ? (
                          <div
                            style={{
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              padding: '12px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              marginBottom: 16,
                            }}
                          >
                            <PackageIcon size={20} color="#1d4ed8" />
                            <div>
                              <strong
                                style={{
                                  color: '#1e40af',
                                  fontSize: '0.85rem',
                                  textTransform: 'uppercase',
                                  display: 'block',
                                }}
                              >
                                Ready to Dispatch Replacement Unit
                              </strong>
                              <span style={{ fontSize: '0.78rem', color: '#1d4ed8' }}>
                                Original item collected & QC passed. You can now dispatch the reserved{' '}
                                <strong>{order.replacement_variant_title || 'replacement size'}</strong> package below.
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              background: '#fffbe6',
                              border: '1px solid #ffe58f',
                              padding: '12px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              marginBottom: 16,
                            }}
                          >
                            <AlertCircleIcon size={20} color="#d48806" />
                            <div>
                              <strong
                                style={{
                                  color: '#ad6800',
                                  fontSize: '0.85rem',
                                  textTransform: 'uppercase',
                                  display: 'block',
                                }}
                              >
                                Dispatch Locked — Awaiting Customer Doorstep Pickup
                              </strong>
                              <span style={{ fontSize: '0.78rem', color: '#874d00' }}>
                                Replacement package will be unlocked for dispatch as soon as the courier collects the original garment.
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Replacement Logistics Details Grid */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: '12px 16px',
                            padding: '14px',
                            background: '#fff',
                            border: '1px solid #eee',
                            marginBottom: 16,
                          }}
                        >
                          <div>
                            <span
                              style={{
                                color: '#777',
                                display: 'block',
                                fontSize: '0.7rem',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                              }}
                            >
                              Replacement Courier
                            </span>
                            <strong style={{ fontSize: '0.82rem', color: '#111' }}>
                              {order.replacement_courier_name || (isReplacementDispatched ? 'Express Courier' : 'Pending Dispatch')}
                            </strong>
                          </div>
                          <div>
                            <span
                              style={{
                                color: '#777',
                                display: 'block',
                                fontSize: '0.7rem',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                              }}
                            >
                              Replacement AWB
                            </span>
                            {order.replacement_awb ? (
                              <a
                                href={getPublicTrackingUrl(order.replacement_awb)}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  fontSize: '0.82rem',
                                  fontWeight: 800,
                                  fontFamily: 'monospace',
                                  color: '#000',
                                  textDecoration: 'underline',
                                }}
                              >
                                {order.replacement_awb}
                              </a>
                            ) : (
                              <span style={{ fontSize: '0.82rem', color: '#999' }}>
                                Generated on Dispatch
                              </span>
                            )}
                          </div>
                          <div>
                            <span
                              style={{
                                color: '#777',
                                display: 'block',
                                fontSize: '0.7rem',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                              }}
                            >
                              Requested Size
                            </span>
                            <strong style={{ fontSize: '0.82rem', color: '#111' }}>
                              {order.replacement_variant_title || 'Selected Size'}
                            </strong>
                          </div>
                          <div>
                            <span
                              style={{
                                color: '#777',
                                display: 'block',
                                fontSize: '0.7rem',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                              }}
                            >
                              Replacement Location
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MapPinIcon size={12} color="#000" />
                              <span
                                style={{
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  color: '#111',
                                }}
                              >
                                {replacementCurrentLocation}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Replacement Checkpoints Toggle */}
                        <div style={{ marginBottom: 16 }}>
                          <button
                            type="button"
                            onClick={() => setShowReplacementScans(!showReplacementScans)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#000',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              padding: 0,
                              textTransform: 'uppercase',
                              textDecoration: 'underline',
                            }}
                          >
                            {showReplacementScans
                              ? '▲ Hide Replacement Checkpoints'
                              : `▼ View Replacement Checkpoints (${replacementScans.length})`}
                          </button>
                          {showReplacementScans && (
                            <div
                              style={{
                                marginTop: 10,
                                background: '#fff',
                                border: '1px solid #eee',
                                padding: '12px',
                              }}
                            >
                              {replacementScans.length > 0 ? (
                                replacementScans.map((s, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: 12,
                                      padding: '6px 0',
                                      borderBottom:
                                        idx === replacementScans.length - 1
                                          ? 'none'
                                          : '1px solid #f3f4f6',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: idx === 0 ? '#000' : '#bbb',
                                        marginTop: 6,
                                      }}
                                    />
                                    <div>
                                      <strong style={{ fontSize: '0.8rem', display: 'block' }}>
                                        {s.activity}
                                      </strong>
                                      <span style={{ fontSize: '0.72rem', color: '#666' }}>
                                        {s.location ? `${s.location} • ` : ''}
                                        {s.date || ''}
                                      </span>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                  Replacement package registered. Live transit scans from courier will appear here once dispatched.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Replacement Specific Details */}
                    {isReplacement && (
                      <div
                        style={{
                          background: '#fff',
                          border: '1px solid #e5e5e5',
                          padding: '14px',
                          marginBottom: 16,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8,
                            marginBottom: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              color: '#000',
                            }}
                          >
                            Requested Replacement Variant
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              background: '#f3f4f6',
                              color: '#000',
                              padding: '2px 8px',
                              textTransform: 'uppercase',
                            }}
                          >
                            Doorstep QC Pass Required
                          </span>
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#111' }}>
                          Size / Variant: {order.replacement_variant_title || 'M / Exchange Unit'}
                        </div>

                        {/* Replacement Dispatch Locked Guard (If original not picked up yet) */}
                        {!isPickedUpFromCustomer && !isReplacementDispatched && (
                          <div
                            style={{
                              marginTop: 14,
                              padding: '12px 14px',
                              background: '#fffbe6',
                              border: '1px solid #ffe58f',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                            }}
                          >
                            <AlertCircleIcon size={18} color="#d48806" />
                            <div style={{ fontSize: '0.8rem', color: '#874d00' }}>
                              <strong>🔒 Replacement Dispatch Locked:</strong> The original item
                              must be picked up by the courier from customer doorstep first before
                              replacement dispatch can be initiated (Doorstep QC verification
                              required).
                            </div>
                          </div>
                        )}

                        {/* Dispatch Replacement Unit Form (Only if picked up and not dispatched) */}
                        {isPickedUpFromCustomer && !isReplacementDispatched && (
                          <div
                            style={{
                              marginTop: 14,
                              padding: '12px',
                              background: '#fafafa',
                              border: '1px solid #000000',
                            }}
                          >
                            <span
                              style={{
                                display: 'block',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                color: '#000000',
                                marginBottom: 8,
                              }}
                            >
                              Dispatch Replacement Package (
                              {order.replacement_variant_title || 'New Size'})
                            </span>
                            <p
                              style={{
                                fontSize: '0.75rem',
                                color: '#555555',
                                margin: '0 0 12px',
                                lineHeight: 1.4,
                              }}
                            >
                              Original item verified at doorstep. Click below to automatically book
                              the replacement shipment, assign a courier, and generate the AWB via
                              Shiprocket API:
                            </p>

                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 12,
                                alignItems: 'center',
                              }}
                            >
                              {/* One-Click Automated Dispatch Button */}
                              <button
                                type="button"
                                onClick={() => handleDispatchReplacement(false)}
                                disabled={dispatchingReplacement}
                                style={{
                                  background: '#000000',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '10px 22px',
                                  fontSize: '0.82rem',
                                  fontWeight: 800,
                                  cursor: dispatchingReplacement ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  borderRadius: 0,
                                  textTransform: 'uppercase',
                                }}
                              >
                                <PackageIcon size={16} color="#fff" />
                                {dispatchingReplacement
                                  ? 'Generating AWB via Shiprocket...'
                                  : '⚡ Dispatch Replacement via Shiprocket →'}
                              </button>

                              <button
                                type="button"
                                onClick={() => setShowManualAwb((prev) => !prev)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#000000',
                                  fontSize: '0.74rem',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  padding: 0,
                                }}
                              >
                                {showManualAwb
                                  ? 'Hide manual AWB entry'
                                  : 'or enter offline / manual AWB'}
                              </button>
                            </div>

                            {/* Optional Manual/Offline Courier Fallback */}
                            {showManualAwb && (
                              <div
                                style={{
                                  marginTop: 14,
                                  paddingTop: 12,
                                  borderTop: '1px dashed #cccccc',
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 10,
                                  alignItems: 'center',
                                }}
                              >
                                <input
                                  type="text"
                                  placeholder="Enter custom/offline AWB..."
                                  value={replacementAwbInput}
                                  onChange={(e) => setReplacementAwbInput(e.target.value)}
                                  style={{
                                    padding: '8px 12px',
                                    fontSize: '0.8rem',
                                    border: '1px solid #ccc',
                                    borderRadius: 0,
                                    flex: '1 1 200px',
                                  }}
                                />
                                <select
                                  value={replacementCourierInput}
                                  onChange={(e) => setReplacementCourierInput(e.target.value)}
                                  style={{
                                    padding: '8px 12px',
                                    fontSize: '0.8rem',
                                    border: '1px solid #ccc',
                                    borderRadius: 0,
                                  }}
                                >
                                  <option value="Blue Dart Air">Blue Dart Air</option>
                                  <option value="Delhivery Express">Delhivery Express</option>
                                  <option value="DTDC Express">DTDC Express</option>
                                  <option value="Shadowfax">Shadowfax</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleDispatchReplacement(true)}
                                  disabled={dispatchingReplacement || !replacementAwbInput.trim()}
                                  style={{
                                    background: '#000',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '8px 16px',
                                    fontSize: '0.78rem',
                                    fontWeight: 800,
                                    cursor:
                                      dispatchingReplacement || !replacementAwbInput.trim()
                                        ? 'not-allowed'
                                        : 'pointer',
                                    borderRadius: 0,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Save Manual AWB
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Dynamic Action Buttons Footer for Return/Exchange */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 10,
                        alignItems: 'center',
                        borderTop: '1px solid #eee',
                        paddingTop: 14,
                      }}
                    >
                      {!isPickedUpFromCustomer &&
                        !isDeliveredToWarehouse &&
                        !isReturnRejected &&
                        !isRefundProcessed && (
                          <button
                            type="button"
                            onClick={() => setShowCancelReturnModal(true)}
                            style={{
                              background: '#fff',
                              border: '1px solid #dc2626',
                              color: '#dc2626',
                              padding: '8px 14px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                              borderRadius: 0,
                            }}
                          >
                            Cancel {isReplacement ? 'Exchange' : 'Return'} Request
                          </button>
                        )}

                      {/* Warehouse Receipt & QC Section */}
                      {isReturnActive && !isReturnRejected && !isRefundProcessed && (
                        <>
                          {!isDeliveredToWarehouse ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                flexWrap: 'wrap',
                              }}
                            >
                              {!isReplacement && (
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    padding: '6px 12px',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    border: '1px solid #fde68a',
                                  }}
                                >
                                  <span>🔒</span>
                                  <span>
                                    Refund controls locked until package reaches warehouse
                                  </span>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={handleMarkWarehouseReceived}
                                disabled={markingWarehouseReceived}
                                style={{
                                  background: '#000',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '8px 14px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: markingWarehouseReceived ? 'not-allowed' : 'pointer',
                                  textTransform: 'uppercase',
                                  borderRadius: 0,
                                }}
                              >
                                {markingWarehouseReceived
                                  ? 'Marking...'
                                  : 'Mark Received at Warehouse ✓'}
                              </button>
                            </div>
                          ) : !isReplacement ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                flexWrap: 'wrap',
                              }}
                            >
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  background: '#ecfdf5',
                                  color: '#065f46',
                                  padding: '6px 12px',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  border: '1px solid #a7f3d0',
                                }}
                              >
                                <span>✓</span>
                                <span>Package received at warehouse — Item restocked to inventory:</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowRefundModal(true)}
                                style={{
                                  background: '#16a34a',
                                  border: 'none',
                                  color: '#fff',
                                  padding: '8px 16px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  textTransform: 'uppercase',
                                  borderRadius: 0,
                                  boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                                }}
                              >
                                ⚡ Initiate Refund via Razorpay →
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowRejectReturnModal(true)}
                                style={{
                                  background: '#fff',
                                  border: '2px solid #dc2626',
                                  color: '#dc2626',
                                  padding: '8px 14px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  textTransform: 'uppercase',
                                  borderRadius: 0,
                                }}
                              >
                                ✕ Cancel / Reject Refund (QC Failed)
                              </button>
                            </div>
                          ) : (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                background: '#f0fdf4',
                                color: '#16a34a',
                                padding: '6px 12px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                border: '1px solid #86efac',
                              }}
                            >
                              <span>✓</span>
                              <span>
                                Original package received at warehouse — Size restocked to inventory
                              </span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Display when return was rejected */}
                      {isReturnRejected && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: '#fef2f2',
                            color: '#991b1b',
                            padding: '6px 12px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            border: '1px solid #fca5a5',
                          }}
                        >
                          <span>✕</span>
                          <span>
                            Return / Refund Rejected: {order.refund_note || 'QC inspection failed'}
                          </span>
                        </div>
                      )}

                      {/* Display when refund is processed */}
                      {isRefundProcessed && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: '#f0fdf4',
                            color: '#166534',
                            padding: '6px 12px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            border: '1px solid #bbf7d0',
                          }}
                        >
                          <span>✓</span>
                          <span>
                            Refund Processed: ₹
                            {(order.refund_amount || order.total_amount).toLocaleString('en-IN')}
                            {order.razorpay_refund_id ? ` (ID: ${order.razorpay_refund_id})` : ''}
                          </span>
                        </div>
                      )}

                      {/* Collapsed Forward Delivery Summary within the single container */}
                      {order.shiprocket_awb && (
                        <div
                          style={{
                            marginLeft: 'auto',
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color: '#777',
                            }}
                          >
                            Original Forward Delivery:{' '}
                            <code style={{ fontWeight: 700 }}>{order.shiprocket_awb}</code>
                          </span>
                          <button
                            type="button"
                            onClick={handleDownloadInvoice}
                            disabled={downloadingInvoice}
                            style={{
                              background: '#fff',
                              border: '1px solid #000',
                              color: '#000',
                              padding: '4px 10px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              borderRadius: 0,
                              textTransform: 'uppercase',
                            }}
                          >
                            Invoice
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* =========================================================================
                     STANDARD FORWARD LOGISTICS FLOW (DELIVERED, IN TRANSIT, UNFULFILLED, ETC)
                     ========================================================================= */
                  <div>
                    {/* Status Alert Banner */}
                    {isPaymentFailed ? (
                      <div
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          marginBottom: 16,
                        }}
                      >
                        <AlertCircleIcon size={20} color="#dc2626" />
                        <div>
                          <strong
                            style={{
                              color: '#991b1b',
                              fontSize: '0.85rem',
                              textTransform: 'uppercase',
                              display: 'block',
                            }}
                          >
                            Fulfillment Blocked: Payment Failed
                          </strong>
                          <span style={{ fontSize: '0.78rem', color: '#b91c1c' }}>
                            Customer checkout failed at Razorpay. Do not dispatch inventory.
                          </span>
                        </div>
                      </div>
                    ) : isCancelled ? (
                      <div
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          marginBottom: 16,
                        }}
                      >
                        <XIcon size={20} color="#dc2626" />
                        <div>
                          <strong
                            style={{
                              color: '#991b1b',
                              fontSize: '0.85rem',
                              textTransform: 'uppercase',
                              display: 'block',
                            }}
                          >
                            Order Cancelled
                          </strong>
                          <span style={{ fontSize: '0.78rem', color: '#b91c1c' }}>
                            Shipment revoked and inventory restored to stock.
                          </span>
                        </div>
                      </div>
                    ) : isDelivered ? (
                      <div
                        style={{
                          background: '#f6ffed',
                          border: '1px solid #b7eb8f',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          marginBottom: 16,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <CheckIcon size={20} color="#52c41a" />
                          <div>
                            <strong
                              style={{
                                color: '#274f13',
                                fontSize: '0.85rem',
                                textTransform: 'uppercase',
                                display: 'block',
                              }}
                            >
                              Order Delivered to Customer
                            </strong>
                            <span style={{ fontSize: '0.78rem', color: '#389e0d' }}>
                              Shipment journey successfully completed. Customer is within active
                              return/exchange window.
                            </span>
                            {isReturnCancelled && (
                              <div
                                style={{
                                  marginTop: 4,
                                  fontSize: '0.73rem',
                                  color: '#555',
                                  fontStyle: 'italic',
                                }}
                              >
                                Note: Previous size exchange was cancelled (Customer decided to keep
                                original size). Delivered order is finalized.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : isOutForDelivery ? (
                      <div
                        style={{
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          marginBottom: 16,
                        }}
                      >
                        <TruckIcon size={20} color="#1d4ed8" />
                        <div>
                          <strong
                            style={{
                              color: '#1e40af',
                              fontSize: '0.85rem',
                              textTransform: 'uppercase',
                              display: 'block',
                            }}
                          >
                            Out for Delivery — Arriving Today
                          </strong>
                          <span style={{ fontSize: '0.78rem', color: '#1d4ed8' }}>
                            Package is with the courier delivery executive and on the way to the customer.
                          </span>
                        </div>
                      </div>
                    ) : isInTransit ? (
                      <div
                        style={{
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          marginBottom: 16,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <TruckIcon size={20} color="#1d4ed8" />
                          <div>
                            <strong
                              style={{
                                color: '#1e40af',
                                fontSize: '0.85rem',
                                textTransform: 'uppercase',
                                display: 'block',
                              }}
                            >
                              Shipment In Transit
                            </strong>
                            <span style={{ fontSize: '0.78rem', color: '#1d4ed8' }}>
                              Courier picked up package from warehouse. Order is moving through the courier network towards destination.
                            </span>
                          </div>
                        </div>
                        {forwardCurrentLocation &&
                          forwardCurrentLocation !== 'In Transit' &&
                          forwardCurrentLocation !== 'Awaiting Dispatch' && (
                            <div
                              style={{
                                background: '#fff',
                                border: '1px solid #bfdbfe',
                                padding: '4px 10px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: '#1e40af',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <MapPinIcon size={12} color="#1d4ed8" />
                              <span>{forwardCurrentLocation}</span>
                            </div>
                          )}
                      </div>
                    ) : isPickupScheduledPending ? (
                      <div
                        style={{
                          background: '#fffbe6',
                          border: '1px solid #ffe58f',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          marginBottom: 16,
                        }}
                      >
                        <TruckIcon size={20} color="#d48806" />
                        <div>
                          <strong
                            style={{
                              color: '#ad6800',
                              fontSize: '0.85rem',
                              textTransform: 'uppercase',
                              display: 'block',
                            }}
                          >
                            Courier Pickup Scheduled
                          </strong>
                          <span style={{ fontSize: '0.78rem', color: '#874d00' }}>
                            Pickup Token: <code style={{ fontWeight: 800 }}>{pickupToken}</code>
                            {pickupScheduledDate && ` • Scheduled Date: ${pickupScheduledDate}`}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {/* Logistics Details Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '12px 16px',
                        padding: '14px',
                        background: '#fafafa',
                        border: '1px solid #eee',
                        marginBottom: 16,
                      }}
                    >
                      <div>
                        <span
                          style={{
                            color: '#777',
                            display: 'block',
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                          }}
                        >
                          Courier Partner
                        </span>
                        <strong style={{ fontSize: '0.82rem', color: '#111' }}>
                          {displayCourierName ||
                            (order.shiprocket_awb ? 'Blue Dart Express' : 'Assigned on Dispatch')}
                        </strong>
                      </div>
                      <div>
                        <span
                          style={{
                            color: '#777',
                            display: 'block',
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                          }}
                        >
                          AWB Code
                        </span>
                        {order.shiprocket_awb ? (
                          <a
                            href={getPublicTrackingUrl(order.shiprocket_awb)}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              color: '#0052cc',
                              textDecoration: 'underline',
                              textUnderlineOffset: '3px',
                            }}
                          >
                            {order.shiprocket_awb}
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.82rem', color: '#999' }}>Not Assigned</span>
                        )}
                      </div>
                      <div>
                        <span
                          style={{
                            color: '#777',
                            display: 'block',
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                          }}
                        >
                          Shipment ID
                        </span>
                        <strong style={{ fontSize: '0.82rem', color: '#111' }}>
                          {order.shiprocket_shipment_id || (isDelivered ? 'Delivered' : 'Pending')}
                        </strong>
                      </div>
                      <div>
                        <span
                          style={{
                            color: '#777',
                            display: 'block',
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                          }}
                        >
                          Current Location
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPinIcon size={12} color="#4232d9" />
                          <span
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              color: '#111',
                            }}
                          >
                            {forwardCurrentLocation}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span
                          style={{
                            color: '#777',
                            display: 'block',
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                          }}
                        >
                          Estimated Delivery
                        </span>
                        <strong style={{ fontSize: '0.82rem', color: '#111' }}>
                          {order.delivered_at
                            ? new Date(order.delivered_at).toLocaleDateString('en-IN', {
                                dateStyle: 'medium',
                              })
                            : forwardTracking?.etd || '3-5 Business Days'}
                        </strong>
                      </div>
                    </div>

                    {/* Forward Checkpoints Toggle */}
                    {forwardScans.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <button
                          type="button"
                          onClick={() => setShowForwardScans(!showForwardScans)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#4232d9',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            padding: 0,
                            textTransform: 'uppercase',
                            textDecoration: 'underline',
                          }}
                        >
                          {showForwardScans
                            ? '▲ Hide Transit Checkpoints'
                            : `▼ View Checkpoints (${forwardScans.length})`}
                        </button>
                        {showForwardScans && (
                          <div
                            style={{
                              marginTop: 10,
                              background: '#fff',
                              border: '1px solid #eee',
                              padding: '12px',
                            }}
                          >
                            {forwardScans.map((s, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 12,
                                  padding: '6px 0',
                                  borderBottom:
                                    idx === forwardScans.length - 1 ? 'none' : '1px solid #f3f4f6',
                                }}
                              >
                                <div
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: idx === 0 ? '#4232d9' : '#bbb',
                                    marginTop: 6,
                                  }}
                                />
                                <div>
                                  <strong style={{ fontSize: '0.8rem', display: 'block' }}>
                                    {s.activity}
                                  </strong>
                                  <span style={{ fontSize: '0.72rem', color: '#666' }}>
                                    {s.location ? `${s.location} • ` : ''}
                                    {s.date || ''}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Dynamic Action Buttons Footer for Forward Logistics */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 10,
                        alignItems: 'center',
                        borderTop: '1px solid #eee',
                        paddingTop: 14,
                      }}
                    >
                      {!order.shiprocket_awb && !isCancelled && !isPaymentFailed && (
                        <button
                          type="button"
                          onClick={handleDispatchShipment}
                          disabled={dispatching}
                          style={{
                            background: '#000',
                            color: '#fff',
                            border: 'none',
                            padding: '10px 20px',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            cursor: dispatching ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            borderRadius: 0,
                            textTransform: 'uppercase',
                          }}
                        >
                          <PackageIcon size={16} color="#fff" />
                          {dispatching
                            ? 'Dispatching in Shiprocket...'
                            : 'Dispatch Shipment & Schedule Pickup →'}
                        </button>
                      )}

                      {order.shiprocket_awb && (
                        <>
                          <button
                            type="button"
                            onClick={handleDownloadLabel}
                            disabled={downloadingLabel}
                            style={{
                              background: '#000',
                              color: '#fff',
                              border: 'none',
                              padding: '8px 16px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: downloadingLabel ? 'not-allowed' : 'pointer',
                              borderRadius: 0,
                              textTransform: 'uppercase',
                            }}
                          >
                            {downloadingLabel ? 'Downloading...' : 'Download Label'}
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadInvoice}
                            disabled={downloadingInvoice}
                            style={{
                              background: '#fff',
                              color: '#000',
                              border: '1px solid #000',
                              padding: '8px 16px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: downloadingInvoice ? 'not-allowed' : 'pointer',
                              borderRadius: 0,
                              textTransform: 'uppercase',
                            }}
                          >
                            {downloadingInvoice ? 'Downloading...' : 'Download Invoice'}
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadBoth}
                            disabled={downloadingBoth}
                            style={{
                              background: '#f3f4f6',
                              color: '#111',
                              border: '1px solid #d1d5db',
                              padding: '8px 16px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: downloadingBoth ? 'not-allowed' : 'pointer',
                              borderRadius: 0,
                              textTransform: 'uppercase',
                            }}
                          >
                            {downloadingBoth ? 'Opening...' : 'Download Both'}
                          </button>
                          {isPickupScheduled && (
                            <button
                              type="button"
                              onClick={handleDownloadManifest}
                              disabled={downloadingManifest}
                              style={{
                                background: '#fff',
                                color: '#d97706',
                                border: '1px solid #d97706',
                                padding: '8px 16px',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                cursor: downloadingManifest ? 'not-allowed' : 'pointer',
                                borderRadius: 0,
                                textTransform: 'uppercase',
                              }}
                            >
                              <PrinterIcon size={14} color="#d97706" />
                              {downloadingManifest ? 'Generating...' : 'Print Manifest'}
                            </button>
                          )}
                          {!isDelivered && !isCancelled && (
                            <button
                              type="button"
                              onClick={() => setShowCancelShipmentModal(true)}
                              style={{
                                background: '#fff',
                                color: '#dc2626',
                                border: '1px solid #dc2626',
                                padding: '8px 16px',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                borderRadius: 0,
                                textTransform: 'uppercase',
                                marginLeft: 'auto',
                              }}
                            >
                              Cancel Shipment
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 3. Items Breakdown */}
          <div className="admin-card">
            <h2 className="admin-card-title">Ordered Items ({order.items.length})</h2>

            <div className="admin-order-items">
              {order.items.map((item) => (
                <div key={item.id} className="admin-order-item">
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.product_title}
                      width={56}
                      height={56}
                      className="admin-order-item-img"
                    />
                  ) : (
                    <div className="admin-order-item-img-placeholder" />
                  )}
                  <div className="admin-order-item-info">
                    <span className="admin-order-item-title">{item.product_title}</span>
                    <span className="admin-order-item-variant">{item.variant_title}</span>
                  </div>
                  <div className="admin-order-item-pricing">
                    <span className="admin-order-item-qty">×{item.quantity}</span>
                    <span className="admin-order-item-price">
                      ₹{(item.price_amount * item.quantity).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="admin-order-totals">
              <div className="admin-order-total-row">
                <span>Subtotal</span>
                <span>₹{order.subtotal_amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="admin-order-total-row">
                <span>Shipping Fee</span>
                <span>{order.shipping_amount === 0 ? 'FREE' : `₹${order.shipping_amount}`}</span>
              </div>
              <div className="admin-order-total-row">
                <span>Estimated Tax (12% GST)</span>
                <span>₹{order.tax_amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="admin-order-total-row admin-order-total-row--bold">
                <span>Total Paid</span>
                <span>₹{order.total_amount.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* 4. Customer & Shipping Address */}
          <div className="admin-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <h2 className="admin-card-title" style={{ margin: 0 }}>
                Customer & Shipping Destination
              </h2>
              {order.user_id ? (
                <Link
                  href={`/admin/users/${order.user_id}?returnTo=${encodeURIComponent(`/admin/orders/${order.id}`)}&orderId=${order.id}`}
                  className="admin-btn admin-btn--secondary"
                  style={{ textDecoration: 'none', fontSize: '0.75rem', padding: '4px 10px' }}
                >
                  View Athlete Account →
                </Link>
              ) : null}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: '#888',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  Customer Profile
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                  {order.user_name || order.guest_name || 'Guest Athlete'}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#555' }}>
                  {order.user_email || order.guest_email || 'No email'}
                </div>
                {(order.guest_phone || addr.phone) && (
                  <div style={{ fontSize: '0.85rem', color: '#555' }}>
                    Ph: {order.guest_phone || addr.phone}
                  </div>
                )}
              </div>

              <div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: '#888',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  Delivery Address
                </div>
                <div style={{ fontSize: '0.85rem', color: '#333', lineHeight: 1.5 }}>
                  {addr.name && (
                    <strong>
                      {addr.name}
                      <br />
                    </strong>
                  )}
                  {addr.address || 'Standard Address'}
                  <br />
                  {addr.city}, {addr.state} — <strong>{addr.pincode || addr.postalCode}</strong>
                  <br />
                  India
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Status & Payment Control */}
        <div className="admin-order-sidebar">
          {/* Payment & Refund Audit Card */}
          {(() => {
            const isPaymentFailed = order.payment_status === 'FAILED';
            const isRefunded =
              order.refund_status === 'REFUNDED' || order.payment_status === 'REFUNDED';
            const isCancelled =
              order.status === 'CANCELLED' || order.shipping_status === 'CANCELLED';

            return (
              <>
                <div
                  className="admin-card"
                  style={{
                    borderLeft: isPaymentFailed
                      ? '4px solid #dc2626'
                      : isRefunded
                        ? '4px solid #16a34a'
                        : '4px solid #52c41a',
                  }}
                >
                  <h2 className="admin-card-title">Prepaid Payment Audit</h2>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          color: '#666',
                          display: 'block',
                          fontSize: '0.72rem',
                          textTransform: 'uppercase',
                        }}
                      >
                        Method
                      </span>
                      <strong style={{ color: '#111' }}>
                        {order.payment_method?.toUpperCase().includes('RAZORPAY')
                          ? 'RAZORPAY'
                          : order.payment_method || 'RAZORPAY'}
                      </strong>
                    </div>
                    <div>
                      <span
                        style={{
                          color: '#666',
                          display: 'block',
                          fontSize: '0.72rem',
                          textTransform: 'uppercase',
                        }}
                      >
                        Payment Status
                      </span>
                      {isPaymentFailed ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <strong
                            style={{ color: '#dc2626', fontSize: '0.92rem', fontWeight: 900 }}
                          >
                            FAILED
                          </strong>
                          <span
                            style={{
                              background: '#fee2e2',
                              color: '#b91c1c',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              textTransform: 'uppercase',
                            }}
                          >
                            Uncaptured
                          </span>
                        </div>
                      ) : isRefunded ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <strong
                            style={{ color: '#16a34a', fontSize: '0.92rem', fontWeight: 900 }}
                          >
                            100% REFUNDED
                          </strong>
                          <span
                            style={{
                              background: '#dcfce7',
                              color: '#15803d',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              textTransform: 'uppercase',
                            }}
                          >
                            Settled
                          </span>
                        </div>
                      ) : (
                        <strong>{order.payment_status || 'PAID'}</strong>
                      )}
                    </div>
                    <div>
                      <span
                        style={{
                          color: '#666',
                          display: 'block',
                          fontSize: '0.72rem',
                          textTransform: 'uppercase',
                        }}
                      >
                        Razorpay Payment ID
                      </span>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          background: isPaymentFailed ? '#fee2e2' : '#f3f4f6',
                          color: isPaymentFailed ? '#991b1b' : 'inherit',
                          padding: '2px 6px',
                        }}
                      >
                        {order.razorpay_payment_id ||
                          (isPaymentFailed
                            ? 'None (Checkout Failed)'
                            : 'rzp_test_sandbox_verified')}
                      </span>
                      {isPaymentFailed && order.razorpay_payment_id && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: '#dc2626',
                            display: 'block',
                            marginTop: 2,
                          }}
                        >
                          Failed attempt: {order.razorpay_payment_id}
                        </span>
                      )}
                    </div>
                    <div>
                      <span
                        style={{
                          color: '#666',
                          display: 'block',
                          fontSize: '0.72rem',
                          textTransform: 'uppercase',
                        }}
                      >
                        Razorpay Order ID
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {order.razorpay_order_id || '—'}
                      </span>
                    </div>
                    {order.razorpay_refund_id && (
                      <div
                        style={{
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          padding: '10px 12px',
                          marginTop: 4,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 3,
                          }}
                        >
                          <span
                            style={{
                              color: '#166534',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                            }}
                          >
                            Refund Reference
                          </span>
                          <span style={{ color: '#15803d', fontSize: '0.78rem', fontWeight: 800 }}>
                            ₹{(order.refund_amount || order.total_amount).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            color: '#15803d',
                            fontWeight: 700,
                          }}
                        >
                          {order.razorpay_refund_id}
                        </span>
                      </div>
                    )}
                    {order.refund_amount && !order.razorpay_refund_id ? (
                      <div>
                        <span
                          style={{
                            color: '#666',
                            display: 'block',
                            fontSize: '0.72rem',
                            textTransform: 'uppercase',
                          }}
                        >
                          Amount Refunded
                        </span>
                        <strong style={{ color: '#cf1322' }}>
                          ₹{order.refund_amount.toLocaleString('en-IN')}
                        </strong>
                      </div>
                    ) : null}
                  </div>

                  {isPaymentFailed ? (
                    <div
                      style={{
                        marginTop: 14,
                        padding: '10px 12px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#991b1b',
                        fontSize: '0.76rem',
                        lineHeight: 1.4,
                      }}
                    >
                      ✕ <strong>Refund Not Applicable:</strong> Customer payment failed at checkout.
                      No funds were debited or captured, so no refund can be issued.
                    </div>
                  ) : !isRefunded && !isCancelled ? (
                    (() => {
                      const isReturn =
                        order.return_type === 'RETURN' &&
                        order.return_status &&
                        order.return_status !== 'NONE' &&
                        order.return_status !== 'CANCELLED';
                      const isAtWarehouse = Boolean(
                        order.return_status === 'DELIVERED_TO_WAREHOUSE' ||
                          order.return_status === 'RETURN_DELIVERED' ||
                          order.return_status === 'COMPLETED' ||
                          order.return_status === 'RESOLVED' ||
                          (order.reverse_tracking_data as { delivered_to_warehouse?: boolean })
                            ?.delivered_to_warehouse
                      );

                      if (isReturn && !isAtWarehouse) {
                        return (
                          <div
                            style={{
                              marginTop: 16,
                              padding: '10px 12px',
                              background: '#fffbe6',
                              border: '1px solid #ffe58f',
                              color: '#d48806',
                              fontSize: '0.76rem',
                              lineHeight: 1.4,
                            }}
                          >
                            🔒 <strong>Refund Locked:</strong> Return parcel must be delivered to
                            warehouse before refund can be initiated.
                          </div>
                        );
                      }

                      return (
                        <button
                          type="button"
                          onClick={() => setShowRefundModal(true)}
                          style={{
                            width: '100%',
                            marginTop: 16,
                            background: '#fff',
                            border: '2px solid #dc2626',
                            color: '#dc2626',
                            padding: '10px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            borderRadius: '0px',
                          }}
                        >
                          Issue Manual Refund →
                        </button>
                      );
                    })()
                  ) : null}
                </div>

                {/* Status Management Card */}
                <div className="admin-card">
                  <h2 className="admin-card-title">Order Status Controls</h2>
                  {isPaymentFailed && (
                    <div
                      style={{
                        background: '#fff1f2',
                        border: '1px solid #fecdd3',
                        padding: '8px 10px',
                        fontSize: '0.75rem',
                        color: '#9f1239',
                        marginBottom: 12,
                        lineHeight: 1.4,
                      }}
                    >
                      ⚠️ <strong>Payment Failed:</strong> Order cannot be fulfilled. Recommended
                      status is <strong>CANCELLED</strong>.
                    </div>
                  )}
                  <div className="admin-form-group">
                    <label className="admin-form-label">Order Fulfillment Status</label>
                    <select
                      className="admin-form-select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option
                          key={s}
                          value={s}
                          disabled={isPaymentFailed && (s === 'SHIPPED' || s === 'DELIVERED')}
                        >
                          {s}{' '}
                          {isPaymentFailed && (s === 'SHIPPED' || s === 'DELIVERED')
                            ? '(Blocked - Payment Failed)'
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">Refund Status</label>
                    {isPaymentFailed ? (
                      <div
                        style={{
                          padding: '8px 12px',
                          background: '#f3f4f6',
                          border: '1px solid #e5e7eb',
                          fontSize: '0.78rem',
                          color: '#6b7280',
                          fontStyle: 'italic',
                        }}
                      >
                        Not Applicable (Payment Failed)
                      </div>
                    ) : (
                      <select
                        className="admin-form-select"
                        value={refundStatus}
                        onChange={(e) => setRefundStatus(e.target.value)}
                      >
                        {REFUND_STATUSES.map((s) => (
                          <option key={s || 'none'} value={s}>
                            {s || 'No refund'}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {refundStatus && (
                    <div className="admin-form-group">
                      <label className="admin-form-label">Refund Note / Audit Log</label>
                      <textarea
                        className="admin-form-textarea"
                        rows={3}
                        value={refundNote}
                        onChange={(e) => setRefundNote(e.target.value)}
                        placeholder="Reason or reference for refund..."
                      />
                    </div>
                  )}

                  <button
                    className="admin-btn admin-btn--primary admin-btn--full"
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      padding: '12px',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                    }}
                  >
                    {saving ? <span className="admin-btn-spinner" /> : 'Save Status Changes'}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Manual Refund Modal */}
      {showRefundModal && (
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
          onClick={() => setShowRefundModal(false)}
        >
          <div
            style={{
              background: '#fff',
              maxWidth: 480,
              width: '100%',
              padding: '28px',
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
              Issue Razorpay Refund #{order.id}
            </h3>
            <p
              style={{ fontSize: '0.85rem', color: '#555', lineHeight: 1.5, marginBottom: '20px' }}
            >
              This calls the Razorpay Refund API directly. The amount will be refunded to the
              customer&rsquo;s original payment method.
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
                Refund Amount (₹ INR) *
              </label>
              <input
                type="number"
                max={order.total_amount}
                min={1}
                value={refundAmount}
                onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '0px',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

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
                Reason for Refund
              </label>
              <input
                type="text"
                placeholder="e.g. Return received, damaged goods, customer support request"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
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

            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={restockItems}
                  onChange={(e) => setRestockItems(e.target.checked)}
                  style={{ accentColor: '#4232d9' }}
                />
                <span>Automatically restock items into product inventory</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                disabled={processingRefund}
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
                onClick={handleProcessRefund}
                disabled={processingRefund || refundAmount <= 0}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  fontSize: '0.8rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  cursor: processingRefund ? 'not-allowed' : 'pointer',
                  borderRadius: '0px',
                }}
              >
                {processingRefund
                  ? 'Processing Refund...'
                  : `Refund ₹${refundAmount.toLocaleString('en-IN')} →`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFY CUSTOMER MODAL */}
      {showNotifyModal && order && (
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
          }}
          onClick={() => setShowNotifyModal(false)}
        >
          <div
            style={{
              background: '#fff',
              maxWidth: 540,
              width: '100%',
              padding: '28px',
              borderRadius: '0px',
              border: '2px solid #000',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 14,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    color: '#000000',
                    letterSpacing: '0.04em',
                  }}
                >
                  Customer Communication Dispatch
                </span>
                <h3
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    margin: '2px 0 0',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Notify Customer #{order.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNotifyModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.4rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  color: '#999',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Recipient Details Preview Card */}
            <div
              style={{
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                padding: '12px 14px',
                marginBottom: 18,
                fontSize: '0.8rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              <div>
                <span
                  style={{
                    color: '#6b7280',
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    display: 'block',
                    fontWeight: 700,
                  }}
                >
                  Recipient Email
                </span>
                <strong style={{ color: '#111', wordBreak: 'break-all' }}>
                  {order.guest_email || order.user_email || 'No email on file'}
                </strong>
              </div>
              <div>
                <span
                  style={{
                    color: '#6b7280',
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    display: 'block',
                    fontWeight: 700,
                  }}
                >
                  Customer Phone
                </span>
                <strong style={{ color: '#111' }}>
                  {order.guest_phone || (order.shipping_address as any)?.phone || '—'}
                </strong>
              </div>
            </div>

            {/* Preset Message Type Selector */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Notification Reason / Template
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  {
                    type: 'UPDATE',
                    label: 'Logistics Update',
                    desc: 'Courier milestones & transit updates',
                    defaultSubject: `Update on your ${order.return_type === 'REPLACEMENT' ? 'Size Exchange' : 'Return'} - Order #${order.id}`,
                  },
                  {
                    type: 'PICKUP_REMINDER',
                    label: 'Doorstep Pickup Reminder',
                    desc: 'Pack item securely with tags intact',
                    defaultSubject: `Doorstep Pickup Reminder for Order #${order.id}`,
                  },
                  {
                    type: 'VERIFIED',
                    label: 'Return Inspected',
                    desc: 'Item received & verified at warehouse',
                    defaultSubject: `Return Parcel Received & Verified - Order #${order.id}`,
                  },
                  {
                    type: 'CUSTOM',
                    label: 'Custom Communication',
                    desc: 'Custom message from VAHN support',
                    defaultSubject: `Important update regarding your Order #${order.id}`,
                  },
                ].map((item) => {
                  const isSelected = notifyType === item.type;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => {
                        setNotifyType(item.type as any);
                        setNotifySubject(item.defaultSubject);
                        if (item.type === 'PICKUP_REMINDER' && !notifyCustomMessage) {
                          setNotifyCustomMessage(
                            'Please keep the item safely packed in its original carton with all tags intact. The courier executive will collect it from your shipping address.'
                          );
                        } else if (item.type === 'VERIFIED' && !notifyCustomMessage) {
                          setNotifyCustomMessage(
                            'Your return shipment has been received at our warehouse and successfully verified by our QA team.'
                          );
                        }
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        border: isSelected ? '2px solid #000' : '1px solid #d1d5db',
                        background: isSelected ? '#f3f4f6' : '#fff',
                        cursor: 'pointer',
                        borderRadius: '0px',
                      }}
                    >
                      <div
                        style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}
                      >
                        {item.label}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 2 }}>
                        {item.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email Subject Line */}
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Email Subject Line *
              </label>
              <input
                type="text"
                value={notifySubject}
                onChange={(e) => setNotifySubject(e.target.value)}
                placeholder="Enter subject line for the email notification..."
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

            {/* Custom Notes / Message Body */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Custom Message / Instructions to Customer
              </label>
              <textarea
                rows={4}
                value={notifyCustomMessage}
                onChange={(e) => setNotifyCustomMessage(e.target.value)}
                placeholder="Type additional details, courier handover instructions, or updates that will be included in the email..."
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

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowNotifyModal(false)}
                disabled={notifyingCustomer}
                style={{
                  background: '#fff',
                  border: '1px solid #ccc',
                  padding: '10px 18px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  borderRadius: '0px',
                  textTransform: 'uppercase',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNotifyCustomer}
                disabled={notifyingCustomer || !notifySubject.trim()}
                style={{
                  background: '#000',
                  color: '#fff',
                  border: '2px solid #000',
                  padding: '10px 22px',
                  fontSize: '0.8rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  cursor: notifyingCustomer || !notifySubject.trim() ? 'not-allowed' : 'pointer',
                  borderRadius: '0px',
                  opacity: notifyingCustomer || !notifySubject.trim() ? 0.6 : 1,
                }}
              >
                {notifyingCustomer ? 'Dispatching Email...' : 'Send Notification Email →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULE PICKUP WIZARD MODAL */}
      {order && (
        <SchedulePickupWizardModal
          isOpen={showPickupModal}
          onClose={() => setShowPickupModal(false)}
          order={order}
          adminToken={adminToken || ''}
          onPickupScheduled={(updated) => {
            setOrder(updated);
            setSuccess('Pickup scheduled successfully with courier partner!');
            setTimeout(() => setSuccess(''), 5000);
          }}
        />
      )}

      {/* CANCEL SHIPMENT MODAL */}
      {showCancelShipmentModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#fff',
              width: '100%',
              maxWidth: '500px',
              padding: '28px',
              boxShadow:
                '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
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
                  fontSize: '1.1rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  color: '#dc2626',
                }}
              >
                Cancel Shipment & Order
              </h3>
              <button
                type="button"
                onClick={() => setShowCancelShipmentModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.3rem',
                  cursor: 'pointer',
                  color: '#666',
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '14px',
                marginBottom: 20,
                color: '#991b1b',
                fontSize: '0.85rem',
                lineHeight: 1.5,
              }}
            >
              ⚠️ <strong>Warning:</strong> This will cancel the courier shipment in Shiprocket. If
              this was a prepaid order, a 100% instant refund will be initiated via Razorpay, and
              items will be restocked to inventory.
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Reason for Cancellation
              </label>
              <input
                type="text"
                placeholder="e.g. Customer requested cancellation before dispatch"
                value={cancelShipmentReason}
                onChange={(e) => setCancelShipmentReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '0.88rem',
                  border: '1px solid #d1d5db',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowCancelShipmentModal(false)}
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
                Keep Shipment
              </button>
              <button
                type="button"
                onClick={handleCancelShipment}
                disabled={cancellingShipment}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 22px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: cancellingShipment ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {cancellingShipment ? 'Cancelling in Shiprocket...' : 'Confirm Cancellation →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL RETURN / SIZE EXCHANGE CONFIRMATION MODAL */}
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
              maxWidth: 500,
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
                  fontSize: '1.05rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircleIcon size={20} color="#dc2626" />
                Cancel {order.return_type === 'REPLACEMENT' ? 'Size Exchange' : 'Return'} Request
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

            <p style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.5, marginBottom: 16 }}>
              Are you sure you want to cancel the{' '}
              <strong>{order.return_type === 'REPLACEMENT' ? 'size exchange' : 'return'}</strong>{' '}
              request for Order <strong>#{order.id}</strong>?
              <br />
              <br />
              This will automatically:
              <br />• <strong>Cancel reverse courier pickup</strong> in Shiprocket
              {order.return_type === 'REPLACEMENT' && (
                <>
                  <br />• <strong>Cancel replacement dispatch</strong>
                  <br />• <strong>Restore +1 reserved inventory</strong> for{' '}
                  <em>{order.replacement_variant_title || 'exchange item'}</em>
                </>
              )}
              <br />• Mark return status as <strong>CANCELLED</strong>
              <br />• Send a status update email to the customer
            </p>

            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Reason for Cancellation
              </label>
              <input
                type="text"
                placeholder="e.g. Customer decided to keep original item"
                value={cancelReturnReason}
                onChange={(e) => setCancelReturnReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '0.88rem',
                  border: '1px solid #d1d5db',
                  fontFamily: 'inherit',
                }}
              />
            </div>

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
                Keep Request Active
              </button>
              <button
                type="button"
                onClick={handleCancelReturn}
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
                {cancellingReturn ? 'Cancelling in Shiprocket...' : 'Confirm Cancellation →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Return & Cancel Refund Modal (QC Failure) */}
      {showRejectReturnModal && order && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#fff',
              maxWidth: 540,
              width: '100%',
              padding: '28px 32px',
              border: '2px solid #dc2626',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
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
                  fontSize: '1.05rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircleIcon size={20} color="#dc2626" />
                Reject Return & Cancel Refund
              </h3>
              <button
                type="button"
                onClick={() => setShowRejectReturnModal(false)}
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

            <p style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.5, marginBottom: 16 }}>
              The returned parcel for Order <strong>#{order.id}</strong> has been received at the
              warehouse, but failed quality inspection.
              <br />
              <br />
              Cancelling the refund requires entering a <strong>mandatory reason</strong> explaining
              the QC failure. This explanation will be permanently recorded in the order audit and
              displayed on the customer tracking portal.
            </p>

            <div style={{ marginBottom: 14 }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#6b7280',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Quick QC Failure Templates:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  'Tags removed or missing',
                  'Item shows signs of wear, usage, or odor',
                  'Item physically damaged, stained, or torn',
                  'Incorrect product or variant returned',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectReturnReason(preset)}
                    style={{
                      background: rejectReturnReason === preset ? '#fee2e2' : '#f3f4f6',
                      border: `1px solid ${rejectReturnReason === preset ? '#ef4444' : '#e5e7eb'}`,
                      color: rejectReturnReason === preset ? '#991b1b' : '#374151',
                      padding: '4px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Mandatory QC Rejection Reason <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Enter specific quality inspection details (e.g. Tags missing, signs of wear on fabric, etc.)..."
                value={rejectReturnReason}
                onChange={(e) => setRejectReturnReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '0.88rem',
                  border: '1px solid #d1d5db',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowRejectReturnModal(false)}
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
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectReturn}
                disabled={rejectingReturn || !rejectReturnReason.trim()}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 22px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: rejectingReturn || !rejectReturnReason.trim() ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase',
                  opacity: rejectingReturn || !rejectReturnReason.trim() ? 0.6 : 1,
                }}
              >
                {rejectingReturn
                  ? 'Submitting Rejection...'
                  : 'Confirm Rejection & Cancel Refund →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
