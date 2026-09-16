"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import {
  getAdminOrder,
  refreshAdminOrderTracking,
  updateOrderStatus,
  shipAdminOrder,
  getAdminOrderShippingLabel,
  getAdminOrderInvoice,
  scheduleAdminOrderPickup,
  cancelAdminOrderShipment,
  refundAdminOrder,
  dispatchAdminOrderReplacement,
  type AdminOrder,
} from "@/lib/api/admin";
import AdminBadge from "@/components/admin/AdminBadge";
import { PrinterIcon, TruckIcon, MapPinIcon, CheckIcon, PackageIcon } from "@/components/icons/Icons";
import Image from "next/image";
import Link from "next/link";
import { getPublicTrackingUrl } from "@/lib/utils";

const ORDER_STATUSES = ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
const REFUND_STATUSES = ["", "PENDING", "REFUNDED"];

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { adminToken } = useAdminAuth();
  const router = useRouter();

  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [status, setStatus] = useState("");
  const [refundStatus, setRefundStatus] = useState("");
  const [refundNote, setRefundNote] = useState("");

  // Logistics & Refund Actions
  const [dispatching, setDispatching] = useState(false);
  const [downloadingLabel, setDownloadingLabel] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [downloadingBoth, setDownloadingBoth] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [pickupDate, setPickupDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [schedulingPickup, setSchedulingPickup] = useState(false);
  const [showCancelShipmentModal, setShowCancelShipmentModal] = useState(false);
  const [cancelShipmentReason, setCancelShipmentReason] = useState("");
  const [cancellingShipment, setCancellingShipment] = useState(false);
  const [refreshingTracking, setRefreshingTracking] = useState(false);
  const [showForwardScans, setShowForwardScans] = useState(false);
  const [showReverseScans, setShowReverseScans] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState("");
  const [restockItems, setRestockItems] = useState(true);
  const [processingRefund, setProcessingRefund] = useState(false);
  const [dispatchingReplacement, setDispatchingReplacement] = useState(false);
  const [replacementAwbInput, setReplacementAwbInput] = useState("");
  const [replacementCourierInput, setReplacementCourierInput] = useState("Blue Dart Air");

  async function handleDispatchReplacement() {
    if (!adminToken || !order) return;
    if (!replacementAwbInput) {
      setError("Please enter an AWB tracking code for the replacement parcel.");
      return;
    }
    setDispatchingReplacement(true);
    setError("");
    setSuccess("");
    try {
      const res = await dispatchAdminOrderReplacement(adminToken, order.id, {
        awb_code: replacementAwbInput,
        courier_name: replacementCourierInput,
      });
      setOrder(res);
      setSuccess(`Replacement shipment marked as dispatched (AWB: ${replacementAwbInput})!`);
      setTimeout(() => setSuccess(""), 4000);
    } catch (e: any) {
      setError(e?.message || "Failed to dispatch replacement.");
    } finally {
      setDispatchingReplacement(false);
    }
  }

  async function load() {
    if (!adminToken) return;
    try {
      const o = await getAdminOrder(adminToken, id);
      setOrder(o);
      setStatus(o.status);
      setRefundStatus(o.refund_status || "");
      setRefundNote(o.refund_note || "");
      setRefundAmount(o.total_amount);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load order");
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
    setError("");
    setSuccess("");
    try {
      await updateOrderStatus(adminToken, id, {
        status,
        refund_status: refundStatus || undefined,
        refund_note: refundNote || undefined,
      });
      setSuccess("Order status updated successfully!");
      await load();
      setTimeout(() => setSuccess(""), 3500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDispatchShipment() {
    if (!adminToken || !order) return;
    setDispatching(true);
    setError("");
    setSuccess("");
    try {
      const res = await shipAdminOrder(adminToken, order.id);
      setSuccess(
        `Shipment dispatched via Shiprocket! Courier: ${res.courier_name || "Express Courier"} | AWB: ${res.awb_code}`
      );
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to dispatch shipment.");
    } finally {
      setDispatching(false);
    }
  }

  async function handleDownloadLabel() {
    if (!adminToken || !order) return;
    setDownloadingLabel(true);
    setError("");
    try {
      const res = await getAdminOrderShippingLabel(adminToken, order.id);
      if (res.label_url) {
        window.open(res.label_url, "_blank");
      } else {
        setError(res.message || "Shipping label is pending courier generation in Shiprocket.");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to fetch official Shiprocket label.");
    } finally {
      setDownloadingLabel(false);
    }
  }

  async function handleDownloadInvoice() {
    if (!adminToken || !order) return;
    setDownloadingInvoice(true);
    setError("");
    try {
      const res = await getAdminOrderInvoice(adminToken, order.id);
      if (res.invoice_url) {
        window.open(res.invoice_url, "_blank");
      } else {
        setError(res.message || "Invoice is pending generation in Shiprocket.");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to download invoice.");
    } finally {
      setDownloadingInvoice(false);
    }
  }

  async function handleDownloadBoth() {
    if (!adminToken || !order) return;
    setDownloadingBoth(true);
    setError("");
    try {
      const [labelRes, invoiceRes] = await Promise.all([
        getAdminOrderShippingLabel(adminToken, order.id).catch((err) => ({ label_url: "", message: err?.message })),
        getAdminOrderInvoice(adminToken, order.id).catch((err) => ({ invoice_url: "", message: err?.message })),
      ]);
      let openedCount = 0;
      if (labelRes.label_url) {
        window.open(labelRes.label_url, "_blank");
        openedCount++;
      }
      if (invoiceRes.invoice_url) {
        setTimeout(() => {
          window.open(invoiceRes.invoice_url, "_blank");
        }, 400);
        openedCount++;
      }
      if (openedCount === 0) {
        setError(labelRes.message || invoiceRes.message || "Label and Invoice are pending generation in Shiprocket.");
      } else if (!labelRes.label_url) {
        setError("Invoice opened, but Shipping Label is still generating in Shiprocket. Click 'Download Label' to retry.");
      } else if (!invoiceRes.invoice_url) {
        setError("Shipping Label opened, but Tax Invoice is still generating in Shiprocket. Click 'Download Invoice' to retry.");
      } else {
        setSuccess("Opened Official Shiprocket Label and Tax Invoice in new tabs.");
        setTimeout(() => setSuccess(""), 4000);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to download label and invoice.");
    } finally {
      setDownloadingBoth(false);
    }
  }

  async function handleSchedulePickup() {
    if (!adminToken || !order) return;
    const todayStr = new Date().toISOString().split("T")[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split("T")[0];

    if (pickupDate < todayStr || pickupDate > tomorrowStr) {
      setError("Courier partners only accept pickups scheduled for Today or Tomorrow (the immediate next business day). Future dates beyond tomorrow are not supported.");
      return;
    }

    setSchedulingPickup(true);
    setError("");
    try {
      const res = await scheduleAdminOrderPickup(adminToken, order.id, { pickup_date: pickupDate });
      if (res.success && res.pickup_status === 1) {
        setSuccess(res.message || "Pickup scheduled successfully with courier partner!");
        setShowPickupModal(false);
        const updated = await getAdminOrder(adminToken, order.id);
        setOrder(updated);
        setTimeout(() => setSuccess(""), 5000);
      } else {
        setError(res.message || "Failed to schedule courier pickup.");
      }
    } catch (e: any) {
      setError(e?.message || "Courier partner rejected pickup scheduling. Couriers only support pickup manifests for Today or Tomorrow.");
    } finally {
      setSchedulingPickup(false);
    }
  }

  async function handleCancelShipment() {
    if (!adminToken || !order) return;
    setCancellingShipment(true);
    setError("");
    try {
      const updated = await cancelAdminOrderShipment(adminToken, order.id, { reason: cancelShipmentReason });
      setOrder(updated);
      setStatus(updated.status);
      setRefundStatus(updated.refund_status || "");
      setShowCancelShipmentModal(false);
      setSuccess("Shipment cancelled, inventory restocked, and 100% refund initiated via Razorpay!");
      await load();
      setTimeout(() => setSuccess(""), 5000);
    } catch (e: any) {
      setError(e?.message || "Failed to cancel shipment in Shiprocket.");
    } finally {
      setCancellingShipment(false);
    }
  }

  async function handleRefreshTracking() {
    if (!adminToken || !order) return;
    setRefreshingTracking(true);
    setError("");
    try {
      const updated = await refreshAdminOrderTracking(adminToken, order.id);
      setOrder(updated);
      setSuccess("Live tracking checkpoints synchronized from courier network!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (e: any) {
      setError(e?.message || "Failed to refresh live tracking.");
    } finally {
      setRefreshingTracking(false);
    }
  }

  async function handleProcessRefund() {
    if (!adminToken || !order) return;
    setProcessingRefund(true);
    setError("");
    try {
      const res = await refundAdminOrder(adminToken, order.id, {
        amount: refundAmount || order.total_amount,
        reason: refundReason || "Admin manual refund",
        restock_items: restockItems,
      });
      setSuccess(`Refund processed successfully via Razorpay (Refund ID: ${res.refund_id || "Active"})`);
      setShowRefundModal(false);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to process refund via Razorpay.");
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
        <div className="admin-alert admin-alert--error">{error || "Order not found"}</div>
      </div>
    );

  const addr = order.shipping_address || {};

  const isPickupScheduled = Boolean(
    (order as any).tracking_data?.pickup_scheduled ||
    (order as any).tracking_data?.pickup_token ||
    order.shipping_status === "PICKUP_SCHEDULED"
  );

  return (
    <div className="admin-page">
      {error && <div className="admin-alert admin-alert--error">{error}</div>}
      {success && <div className="admin-alert admin-alert--success">{success}</div>}

      {order.payment_status === "FAILED" && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderLeft: "6px solid #dc2626",
            padding: "16px 20px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "flex-start",
            gap: "14px",
          }}
        >
          <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>⚠️</span>
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Payment Failed — Transaction Incomplete
            </div>
            <div style={{ fontSize: "0.84rem", color: "#7f1d1d", marginTop: 4, lineHeight: 1.45 }}>
              The customer&apos;s online payment was not captured or failed at Razorpay checkout. Because no funds were received, <strong>this order cannot be fulfilled, dispatched, or refunded</strong>.
            </div>
          </div>
        </div>
      )}

      <div className="admin-order-layout">
        {/* Left Main Content */}
        <div className="admin-order-main">
          {/* Header Title & Nav */}
          <div className="vahn-no-print" style={{ marginBottom: 16 }}>
            <button
              onClick={() => router.back()}
              className="admin-btn-inline-link"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginBottom: 8,
                fontSize: "0.8125rem",
                color: "var(--admin-text-secondary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                padding: 0,
              }}
            >
              ← Back to Orders
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h1 className="admin-page-title" style={{ fontSize: "1.75rem", fontWeight: 900, margin: 0 }}>
                    {order.id}
                  </h1>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 800,
                      background: order.is_guest ? "#e0e0e0" : "#000",
                      color: order.is_guest ? "#333" : "#fff",
                      padding: "3px 8px",
                      borderRadius: "0px",
                      textTransform: "uppercase",
                    }}
                  >
                    {order.is_guest ? "GUEST ORDER" : "REGISTERED ATHLETE"}
                  </span>
                </div>
                <p className="admin-page-subtitle" style={{ marginTop: 6 }}>
                  Created on {new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {order.shiprocket_awb && (
                  <a
                    href={getPublicTrackingUrl(order.shiprocket_awb)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-btn admin-btn--secondary"
                    style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <TruckIcon size={14} color="#000" />
                    Public Tracking Portal →
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* 1. Forward Logistics Command Card (Shiprocket) */}
          {(() => {
            const isPaymentFailed = order.payment_status === "FAILED";
            const isCancelled = order.status === "CANCELLED" || order.shipping_status === "CANCELLED";
            const forwardTracking = order.tracking_data;
            const forwardScans: Array<{ date?: string; activity: string; location?: string }> =
              Array.isArray(forwardTracking?.scans) ? forwardTracking.scans : [];
            const forwardCurrentLocation = isPaymentFailed
              ? "Fulfillment Blocked (Payment Failed)"
              : isCancelled
              ? "Shipment Revoked & Cancelled"
              : forwardTracking?.current_location ||
                (forwardScans.length > 0 ? forwardScans[forwardScans.length - 1]?.location : null) ||
                (order.shipping_status === "DELIVERED"
                  ? "Delivered to Customer"
                  : order.shiprocket_awb
                  ? "In Transit"
                  : "Awaiting Dispatch");
            const latestForwardScan =
              forwardScans.length > 0 ? forwardScans[forwardScans.length - 1] : null;

            return (
              <div
                className="admin-card"
                style={{
                  borderLeft: isPaymentFailed
                    ? "4px solid #dc2626"
                    : isCancelled
                    ? "4px solid #dc2626"
                    : "4px solid #4232d9",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <TruckIcon size={20} color={isPaymentFailed || isCancelled ? "#dc2626" : "#4232d9"} />
                    <h2 className="admin-card-title" style={{ margin: 0, textTransform: "uppercase" }}>
                      Forward Logistics (Shiprocket)
                    </h2>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {order.shiprocket_awb && !isCancelled && !isPaymentFailed && (
                      <button
                        type="button"
                        onClick={handleRefreshTracking}
                        disabled={refreshingTracking}
                        style={{
                          background: "#f3f4f6",
                          border: "1px solid #d1d5db",
                          padding: "5px 12px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: refreshingTracking ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          borderRadius: "0px",
                          textTransform: "uppercase",
                        }}
                      >
                        {refreshingTracking ? "Refreshing..." : "↻ Refresh Live Tracking"}
                      </button>
                    )}
                    <span
                      style={{
                        background: isPaymentFailed
                          ? "#fef2f2"
                          : isCancelled
                          ? "#fef2f2"
                          : (order.shipping_status === "SHIPPED" || order.shipping_status === "DELIVERED" || order.shipping_status === "OUT_FOR_DELIVERY" ? "#f6ffed" : "#fffbe6"),
                        color: isPaymentFailed
                          ? "#dc2626"
                          : isCancelled
                          ? "#dc2626"
                          : (order.shipping_status === "SHIPPED" || order.shipping_status === "DELIVERED" || order.shipping_status === "OUT_FOR_DELIVERY" ? "#389e0d" : "#d48806"),
                        border: `1px solid ${isPaymentFailed ? "#fca5a5" : isCancelled ? "#fca5a5" : (order.shipping_status === "SHIPPED" || order.shipping_status === "DELIVERED" || order.shipping_status === "OUT_FOR_DELIVERY" ? "#b7eb8f" : "#ffe58f")}`,
                        padding: "5px 12px",
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                      }}
                    >
                      {isPaymentFailed ? "BLOCKED (PAYMENT FAILED)" : isCancelled ? "CANCELLED" : (order.shipping_status || "UNFULFILLED")}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, fontSize: "0.85rem", marginBottom: 16 }}>
                  <div>
                    <span style={{ color: "#777", fontSize: "0.72rem", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>
                      Courier Partner
                    </span>
                    <strong style={{ fontSize: "0.9rem", color: isPaymentFailed ? "#888" : "#111" }}>
                      {isPaymentFailed ? "None (Payment Incomplete)" : (order.shiprocket_courier_name || "Assigned on Dispatch")}
                    </strong>
                  </div>

                  <div>
                    <span style={{ color: "#777", fontSize: "0.72rem", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>
                      AWB Code
                    </span>
                    {order.shiprocket_awb ? (
                      <a
                        href={getPublicTrackingUrl(order.shiprocket_awb)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontFamily: "monospace",
                          fontWeight: 800,
                          fontSize: "0.9rem",
                          color: isCancelled ? "#dc2626" : "#4232d9",
                          textDecoration: "underline",
                        }}
                      >
                        {order.shiprocket_awb}
                      </a>
                    ) : (
                      <span style={{ color: isPaymentFailed ? "#dc2626" : "#999", fontSize: "0.85rem", fontWeight: isPaymentFailed ? 600 : 400 }}>
                        {isPaymentFailed ? "Blocked" : "Not Assigned"}
                      </span>
                    )}
                  </div>

                  <div>
                    <span style={{ color: "#777", fontSize: "0.72rem", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>
                      Shipment ID
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: "0.88rem", color: isPaymentFailed ? "#dc2626" : "#333" }}>
                      {order.shiprocket_shipment_id || (isPaymentFailed ? "Blocked" : "Pending")}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: "#777", fontSize: "0.72rem", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>
                      Current Location
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <MapPinIcon size={14} color={isPaymentFailed || isCancelled ? "#dc2626" : "#4232d9"} />
                      <strong style={{ fontSize: "0.88rem", color: isPaymentFailed || isCancelled ? "#dc2626" : "#111" }}>
                        {forwardCurrentLocation}
                      </strong>
                    </div>
                    {latestForwardScan && latestForwardScan.activity && (
                      <span style={{ fontSize: "0.72rem", color: "#777", display: "block", marginTop: 2 }}>
                        {latestForwardScan.activity}
                      </span>
                    )}
                  </div>

                  <div>
                    <span style={{ color: "#777", fontSize: "0.72rem", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>
                      Estimated Delivery
                    </span>
                    <span style={{ fontSize: "0.88rem", color: isPaymentFailed ? "#dc2626" : "#333", fontWeight: 600 }}>
                      {isPaymentFailed ? "Blocked (Unpaid)" : isCancelled ? "Cancelled" : (order.delivered_at || "3-5 Business Days")}
                    </span>
                  </div>
                </div>

                {/* Cancellation Notice (only if cancelled) */}
                {order.shiprocket_awb && isCancelled && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      padding: "10px 16px",
                      marginBottom: "16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, background: "#dc2626", borderRadius: "50%", display: "inline-block" }} />
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#991b1b" }}>
                        Cancelled: <span style={{ fontWeight: 500, color: "#7f1d1d" }}>{order.cancellation_reason || "Shipment was cancelled by administrator."}</span>
                      </span>
                    </div>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", background: "#fee2e2", padding: "2px 8px" }}>
                      Dispatch Halted • Restocked
                    </span>
                  </div>
                )}

                {/* Transit History Timeline (collapsible) */}
                {order.shiprocket_awb && (!isCancelled || forwardScans.length > 0) && (
                  <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 12, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#666", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Transit Checkpoints ({forwardScans.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowForwardScans(!showForwardScans)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#4232d9",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        {showForwardScans ? "Hide Checkpoints ▲" : "View Checkpoints ▼"}
                      </button>
                    </div>

                    {showForwardScans && (
                      <div style={{ marginTop: 12 }}>
                        {forwardScans.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 0, paddingLeft: 12, borderLeft: "2px solid #e5e7eb" }}>
                            {forwardScans.slice().reverse().map((scan, idx) => {
                              const isLatest = idx === 0;
                              return (
                                <div
                                  key={idx}
                                  style={{
                                    position: "relative",
                                    paddingBottom: idx < forwardScans.length - 1 ? 14 : 4,
                                    paddingLeft: 16,
                                  }}
                                >
                                  <span
                                    style={{
                                      position: "absolute",
                                      left: -19,
                                      top: 3,
                                      width: 10,
                                      height: 10,
                                      background: isLatest ? "#4232d9" : "#fff",
                                      border: isLatest ? "2px solid #4232d9" : "2px solid #9ca3af",
                                      borderRadius: "0px",
                                      display: "block",
                                    }}
                                  />
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                                    <div style={{ fontWeight: isLatest ? 800 : 600, fontSize: "0.82rem", color: isLatest ? "#000" : "#374151" }}>
                                      {scan.activity}
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "#6b7280", fontFamily: "monospace" }}>
                                      {scan.date || "—"}
                                    </div>
                                  </div>
                                  {scan.location && (
                                    <div style={{ fontSize: "0.72rem", color: "#4b5563", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                                      <MapPinIcon size={12} color="#6b7280" />
                                      <span>Facility / Hub: <strong>{scan.location}</strong></span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ fontSize: "0.8rem", color: "#777", padding: "8px 12px", background: "#fafafa" }}>
                            Awaiting initial courier scan at pickup hub. Click &ldquo;Refresh Live Tracking&rdquo; to fetch the latest courier milestones.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", borderTop: "1px solid #eee", paddingTop: 14, alignItems: "center" }}>
                  {isPaymentFailed ? (
                    <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", padding: "12px 16px", fontSize: "0.82rem", fontWeight: 700, width: "100%", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: "1.1rem" }}>⛔</span>
                      <div>
                        <div>Dispatch Blocked: Customer payment failed.</div>
                        <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#7f1d1d" }}>
                          Cannot fulfill, generate AWB, or print shipping labels for unpaid orders.
                        </span>
                      </div>
                    </div>
                  ) : isCancelled ? (
                    <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
                      <button
                        type="button"
                        onClick={handleDownloadInvoice}
                        disabled={downloadingInvoice}
                        style={{
                          background: "#000",
                          color: "#fff",
                          border: "none",
                          padding: "8px 18px",
                          fontWeight: 800,
                          fontSize: "0.78rem",
                          cursor: downloadingInvoice ? "not-allowed" : "pointer",
                          textTransform: "uppercase",
                          borderRadius: "0px",
                        }}
                      >
                        {downloadingInvoice ? "Fetching Invoice..." : "Download Tax Invoice"}
                      </button>
                    </div>
                  ) : !order.shiprocket_awb ? (
                    <button
                      type="button"
                      onClick={handleDispatchShipment}
                      disabled={dispatching || order.status === "CANCELLED" || order.status === "REFUNDED"}
                      style={{
                        background: "#4232d9",
                        color: "#fff",
                        border: "none",
                        padding: "10px 20px",
                        fontWeight: 800,
                        fontSize: "0.82rem",
                        cursor: dispatching ? "not-allowed" : "pointer",
                        textTransform: "uppercase",
                        borderRadius: "0px",
                      }}
                    >
                      {dispatching ? "Contacting Shiprocket..." : "Dispatch Shipment & Generate AWB →"}
                    </button>
                  ) : (
                    <>
                      {/* Schedule Pickup Action */}
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          const today = new Date().toISOString().split("T")[0];
                          const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
                          if (pickupDate < today || pickupDate > tomorrow) {
                            setPickupDate(tomorrow);
                          }
                          setShowPickupModal(true);
                        }}
                        disabled={order.status === "CANCELLED" || order.status === "REFUNDED"}
                        style={{
                          background: isPickupScheduled ? "#059669" : "#4232d9",
                          color: "#fff",
                          border: "none",
                          padding: "8px 18px",
                          fontWeight: 800,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                          textTransform: "uppercase",
                          borderRadius: "0px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {isPickupScheduled ? "Pickup Scheduled ✓" : "Schedule Pickup →"}
                      </button>

                      {/* Download Label Action */}
                      <button
                        type="button"
                        onClick={handleDownloadLabel}
                        disabled={downloadingLabel}
                        style={{
                          background: "#000",
                          color: "#fff",
                          border: "none",
                          padding: "8px 18px",
                          fontWeight: 800,
                          fontSize: "0.8rem",
                          cursor: downloadingLabel ? "not-allowed" : "pointer",
                          textTransform: "uppercase",
                          borderRadius: "0px",
                        }}
                      >
                        {downloadingLabel ? "Fetching Label..." : "Download Label"}
                      </button>

                      {/* Download Invoice Action */}
                      <button
                        type="button"
                        onClick={handleDownloadInvoice}
                        disabled={downloadingInvoice}
                        style={{
                          background: "#fff",
                          color: "#000",
                          border: "1px solid #d1d5db",
                          padding: "8px 18px",
                          fontWeight: 800,
                          fontSize: "0.8rem",
                          cursor: downloadingInvoice ? "not-allowed" : "pointer",
                          textTransform: "uppercase",
                          borderRadius: "0px",
                        }}
                      >
                        {downloadingInvoice ? "Fetching Invoice..." : "Download Invoice"}
                      </button>

                      {/* Cancel Shipment Action */}
                      {order.status !== "CANCELLED" && (
                        <button
                          type="button"
                          onClick={() => setShowCancelShipmentModal(true)}
                          style={{
                            background: "#fff",
                            color: "#dc2626",
                            border: "1px solid #dc2626",
                            padding: "8px 16px",
                            fontWeight: 800,
                            fontSize: "0.8rem",
                            cursor: "pointer",
                            textTransform: "uppercase",
                            borderRadius: "0px",
                            marginLeft: "auto",
                          }}
                        >
                          Cancel Shipment
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 2. Reverse Logistics & Return Card (If Return is Active) */}
          {order.return_status && order.return_status !== "NONE" && (() => {
            const reverseTracking = order.reverse_tracking_data;
            const reverseScans: Array<{ date?: string; activity: string; location?: string }> =
              Array.isArray(reverseTracking?.scans) ? reverseTracking.scans : [];
            const reverseCurrentLocation =
              reverseTracking?.current_location ||
              (reverseScans.length > 0 ? reverseScans[reverseScans.length - 1]?.location : null) ||
              "Customer Area / Sorting Hub";
            const isPickedUpFromCustomer =
              Boolean(reverseTracking?.is_picked_up) ||
              reverseScans.some((s) => /pick/i.test(s.activity || "")) ||
              order.return_status === "REFUNDED" ||
              order.shipping_status === "PICKED_UP";
            const latestReverseScan =
              reverseScans.length > 0 ? reverseScans[reverseScans.length - 1] : null;

            const isReplacement = order.return_type === "REPLACEMENT";

            return (
              <div
                className="admin-card"
                style={{
                  borderLeft: isReplacement ? "4px solid #7c3aed" : "4px solid #fa8c16",
                  background: isReplacement ? "#faf5ff" : "#fffaf0",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <PackageIcon size={20} color={isReplacement ? "#6b21a8" : "#d46b08"} />
                    <h2 className="admin-card-title" style={{ margin: 0, textTransform: "uppercase", color: isReplacement ? "#6b21a8" : "#d46b08" }}>
                      {isReplacement ? "Size Replacement & Exchange Logistics" : "Reverse Return Logistics"}
                    </h2>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {order.reverse_awb && (
                      <button
                        type="button"
                        onClick={handleRefreshTracking}
                        disabled={refreshingTracking}
                        style={{
                          background: "#fff",
                          border: `1px solid ${isReplacement ? "#d8b4fe" : "#ffd591"}`,
                          padding: "5px 12px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: refreshingTracking ? "not-allowed" : "pointer",
                          borderRadius: "0px",
                          textTransform: "uppercase",
                        }}
                      >
                        {refreshingTracking ? "Refreshing..." : "↻ Refresh Return Tracking"}
                      </button>
                    )}
                    <span
                      style={{
                        background: order.return_status === "REFUNDED" || order.replacement_status === "REPLACEMENT_DISPATCHED" ? "#52c41a" : isReplacement ? "#7c3aed" : "#fa8c16",
                        color: "#fff",
                        padding: "5px 12px",
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                      }}
                    >
                      {isReplacement
                        ? (order.replacement_status === "REPLACEMENT_DISPATCHED" ? "REPLACEMENT DISPATCHED" : order.replacement_status === "PICKED_UP" ? "ORIGINAL PICKED UP" : "EXCHANGE REQUESTED")
                        : order.return_status}
                    </span>
                  </div>
                </div>

                {/* REPLACEMENT VARIANT SUMMARY (IF EXCHANGE) */}
                {isReplacement && (
                  <div
                    style={{
                      background: "#f3e8ff",
                      border: "1px solid #d8b4fe",
                      padding: "12px 16px",
                      marginBottom: 16,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#6b21a8", textTransform: "uppercase" }}>
                        Requested Replacement Size
                      </span>
                      <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#581c87" }}>
                        {order.replacement_variant_title || "New Size / Alternative Variant"}
                      </div>
                    </div>

                    {order.replacement_awb ? (
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#6b21a8", textTransform: "uppercase" }}>
                          Replacement Dispatch AWB
                        </span>
                        <div style={{ fontFamily: "monospace", fontWeight: 900, color: "#111", fontSize: "0.95rem" }}>
                          {order.replacement_awb} ({order.replacement_courier_name || "Courier"})
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#7c3aed", background: "#fff", padding: "4px 10px", border: "1px solid #d8b4fe" }}>
                        Awaiting Replacement Dispatch
                      </span>
                    )}
                  </div>
                )}

                {/* CUSTOMER PICKUP VERIFICATION BANNER */}
                <div
                  style={{
                    background: isPickedUpFromCustomer ? "#f6ffed" : "#fffbe6",
                    border: `1px solid ${isPickedUpFromCustomer ? "#b7eb8f" : "#ffe58f"}`,
                    padding: "14px 18px",
                    marginBottom: 16,
                    borderRadius: "0px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      background: isPickedUpFromCustomer ? "#52c41a" : "#fa8c16",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "0px",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {isPickedUpFromCustomer ? "✓" : "⏳"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.88rem", fontWeight: 900, color: isPickedUpFromCustomer ? "#237804" : "#ad6800", textTransform: "uppercase" }}>
                      {isPickedUpFromCustomer
                        ? (isReplacement ? "✔ Original Item Collected from Customer — Ready to Dispatch Replacement" : "✔ Parcel Successfully Picked Up from Customer")
                        : (isReplacement ? "⏳ Reverse Pickup Scheduled — Awaiting Original Item Collection" : "⏳ Reverse Pickup Scheduled — Awaiting Customer Handover")}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#444", marginTop: 3 }}>
                      {isPickedUpFromCustomer ? (
                        <>
                          Physical original item was collected at customer doorstep and verified by <strong>{order.reverse_courier_name || "Reverse Courier"}</strong>.
                          {!isReplacement && order.refund_status === "REFUNDED" && (
                            <span style={{ color: "#15803d", fontWeight: 800, display: "block", marginTop: 2 }}>
                              ✓ 100% Refund of ₹{(order.refund_amount || order.total_amount).toLocaleString("en-IN")} automatically disbursed via Razorpay.
                            </span>
                          )}
                          {isReplacement && (
                            <span style={{ color: "#6b21a8", fontWeight: 800, display: "block", marginTop: 2 }}>
                              ✓ Doorstep handover complete. You can now dispatch the replacement parcel ({order.replacement_variant_title}) below.
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          Reverse courier has dispatched an executive for doorstep collection. Once the parcel is physically collected, the status will automatically update to &ldquo;PICKED_UP&rdquo;.
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* DISPATCH REPLACEMENT INPUT (IF EXCHANGE NOT YET DISPATCHED) */}
                {isReplacement && order.replacement_status !== "REPLACEMENT_DISPATCHED" && (
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #d8b4fe",
                      padding: "16px 18px",
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ fontSize: "0.82rem", fontWeight: 900, textTransform: "uppercase", color: "#6b21a8", marginBottom: 8 }}>
                      Dispatch Replacement Package ({order.replacement_variant_title})
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Courier Partner"
                        value={replacementCourierInput}
                        onChange={(e) => setReplacementCourierInput(e.target.value)}
                        style={{ padding: "8px 12px", border: "1px solid #ccc", fontSize: "0.82rem", width: 180 }}
                      />
                      <input
                        type="text"
                        placeholder="Enter Replacement Shipment AWB"
                        value={replacementAwbInput}
                        onChange={(e) => setReplacementAwbInput(e.target.value)}
                        style={{ padding: "8px 12px", border: "1px solid #ccc", fontSize: "0.82rem", flex: 1, minWidth: 200 }}
                      />
                      <button
                        type="button"
                        onClick={handleDispatchReplacement}
                        disabled={dispatchingReplacement}
                        style={{
                          background: "#7c3aed",
                          color: "#fff",
                          border: "none",
                          padding: "9px 18px",
                          fontWeight: 900,
                          fontSize: "0.8rem",
                          cursor: dispatchingReplacement ? "not-allowed" : "pointer",
                          textTransform: "uppercase",
                        }}
                      >
                        {dispatchingReplacement ? "Saving..." : "Mark Dispatched →"}
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, fontSize: "0.85rem", marginBottom: 16 }}>
                  <div>
                    <span style={{ color: "#777", fontSize: "0.75rem", display: "block" }}>Reverse Courier</span>
                    <strong>{order.reverse_courier_name || "Shiprocket Reverse Logistics"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#777", fontSize: "0.75rem", display: "block" }}>Reverse AWB</span>
                    <strong style={{ fontFamily: "monospace", color: "#d46b08" }}>{order.reverse_awb || "Pending"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#777", fontSize: "0.75rem", display: "block" }}>Customer Return Reason</span>
                    <strong>{order.return_reason || "None specified"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#777", fontSize: "0.75rem", display: "block" }}>Return Requested At</span>
                    <span>{order.return_requested_at || "—"}</span>
                  </div>
                </div>

                {order.return_notes && (
                  <div style={{ fontSize: "0.8rem", color: "#555", background: "#fff", padding: "8px 12px", border: "1px solid #ffd591", marginBottom: 14 }}>
                    Customer Notes: <em>&ldquo;{order.return_notes}&rdquo;</em>
                  </div>
                )}

                {/* CURRENT RETURN LOCATION BANNER */}
                {order.reverse_awb && (
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #ffd591",
                      padding: "14px 18px",
                      marginBottom: 16,
                      borderRadius: "0px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#d46b08", textTransform: "uppercase", marginBottom: 4 }}>
                          Current Return Package Location
                        </div>
                        <div style={{ fontSize: "1rem", fontWeight: 900, color: "#111", display: "flex", alignItems: "center", gap: 6 }}>
                          <MapPinIcon size={16} color="#d46b08" />
                          <span>{reverseCurrentLocation}</span>
                        </div>
                        {latestReverseScan && (
                          <div style={{ fontSize: "0.8rem", color: "#666", marginTop: 4 }}>
                            <strong>Current Progress:</strong> {latestReverseScan.activity}
                            {latestReverseScan.date && <span style={{ color: "#888", marginLeft: 8 }}>({latestReverseScan.date})</span>}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            background: isPickedUpFromCustomer ? "#52c41a" : "#fa8c16",
                            color: "#fff",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            padding: "4px 10px",
                            borderRadius: "0px",
                          }}
                        >
                          {isPickedUpFromCustomer ? "PICKED UP / IN RETURN TRANSIT" : "PICKUP PENDING"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* RETURN CHECKPOINTS SCANS TIMELINE */}
                {order.reverse_awb && (
                  <div style={{ borderTop: "1px solid #ffd591", paddingTop: 14, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#873800", textTransform: "uppercase" }}>
                        Return Checkpoint History ({reverseScans.length} Milestones)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowReverseScans(!showReverseScans)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#d46b08",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        {showReverseScans ? "Collapse ▲" : "Expand All Checkpoints ▼"}
                      </button>
                    </div>

                    {showReverseScans && (
                      reverseScans.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 0, paddingLeft: 12, borderLeft: "2px solid #ffd591" }}>
                          {reverseScans.slice().reverse().map((scan, idx) => {
                            const isLatest = idx === 0;
                            return (
                              <div
                                key={idx}
                                style={{
                                  position: "relative",
                                  paddingBottom: idx < reverseScans.length - 1 ? 16 : 4,
                                  paddingLeft: 16,
                                }}
                              >
                                <span
                                  style={{
                                    position: "absolute",
                                    left: -19,
                                    top: 3,
                                    width: 12,
                                    height: 12,
                                    background: isLatest ? "#d46b08" : "#fff",
                                    border: isLatest ? "2px solid #d46b08" : "2px solid #d97706",
                                    borderRadius: "0px",
                                    display: "block",
                                  }}
                                />
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                                  <div style={{ fontWeight: isLatest ? 800 : 600, fontSize: "0.85rem", color: isLatest ? "#000" : "#374151" }}>
                                    {scan.activity}
                                  </div>
                                  <div style={{ fontSize: "0.75rem", color: "#6b7280", fontFamily: "monospace" }}>
                                    {scan.date || "—"}
                                  </div>
                                </div>
                                {scan.location && (
                                  <div style={{ fontSize: "0.75rem", color: "#4b5563", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                                    <MapPinIcon size={12} color="#d46b08" />
                                    <span>Checkpoint Location: <strong>{scan.location}</strong></span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.82rem", color: "#666", padding: "10px", background: "#fff" }}>
                          Awaiting courier reverse pickup scan. Click &ldquo;Refresh Return Tracking&rdquo; to fetch the latest courier updates.
                        </div>
                      )
                    )}
                  </div>
                )}

                <div style={{ fontSize: "0.75rem", color: isReplacement ? "#6b21a8" : "#873800", borderTop: `1px solid ${isReplacement ? "#d8b4fe" : "#ffd591"}`, paddingTop: 10 }}>
                  {isReplacement ? (
                    <>
                      <strong>Automated Exchange Flow:</strong> When the courier confirms &ldquo;PICKED_UP&rdquo; at the customer doorstep, our webhook automatically updates the status to &ldquo;PICKED_UP&rdquo; so you can dispatch the replacement unit. <strong>No monetary refund is disbursed.</strong>
                    </>
                  ) : (
                    <>
                      <strong>Automated Refund Flow:</strong> When the courier confirms &ldquo;PICKED_UP&rdquo; at the customer doorstep, Shiprocket notifies our webhook and automatically disburses the 100% Razorpay refund immediately.
                    </>
                  )}
                </div>
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
                      ₹{(item.price_amount * item.quantity).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="admin-order-totals">
              <div className="admin-order-total-row">
                <span>Subtotal</span>
                <span>₹{order.subtotal_amount.toLocaleString("en-IN")}</span>
              </div>
              <div className="admin-order-total-row">
                <span>Shipping Fee</span>
                <span>{order.shipping_amount === 0 ? "FREE" : `₹${order.shipping_amount}`}</span>
              </div>
              <div className="admin-order-total-row">
                <span>Estimated Tax (12% GST)</span>
                <span>₹{order.tax_amount.toLocaleString("en-IN")}</span>
              </div>
              <div className="admin-order-total-row admin-order-total-row--bold">
                <span>Total Paid</span>
                <span>₹{order.total_amount.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* 4. Customer & Shipping Address */}
          <div className="admin-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 className="admin-card-title" style={{ margin: 0 }}>
                Customer & Shipping Destination
              </h2>
              {order.user_id ? (
                <Link
                  href={`/admin/users/${order.user_id}?returnTo=${encodeURIComponent(`/admin/orders/${order.id}`)}&orderId=${order.id}`}
                  className="admin-btn admin-btn--secondary"
                  style={{ textDecoration: "none", fontSize: "0.75rem", padding: "4px 10px" }}
                >
                  View Athlete Account →
                </Link>
              ) : null}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#888", textTransform: "uppercase", marginBottom: 4 }}>
                  Customer Profile
                </div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>
                  {order.user_name || order.guest_name || "Guest Athlete"}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#555" }}>
                  {order.user_email || order.guest_email || "No email"}
                </div>
                {(order.guest_phone || addr.phone) && (
                  <div style={{ fontSize: "0.85rem", color: "#555" }}>
                    Ph: {order.guest_phone || addr.phone}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#888", textTransform: "uppercase", marginBottom: 4 }}>
                  Delivery Address
                </div>
                <div style={{ fontSize: "0.85rem", color: "#333", lineHeight: 1.5 }}>
                  {addr.name && <strong>{addr.name}<br /></strong>}
                  {addr.address || "Standard Address"}<br />
                  {addr.city}, {addr.state} — <strong>{addr.pincode || addr.postalCode}</strong><br />
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
            const isPaymentFailed = order.payment_status === "FAILED";
            const isRefunded = order.refund_status === "REFUNDED" || order.payment_status === "REFUNDED";
            const isCancelled = order.status === "CANCELLED" || order.shipping_status === "CANCELLED";

            return (
              <>
                <div
                  className="admin-card"
                  style={{
                    borderLeft: isPaymentFailed
                      ? "4px solid #dc2626"
                      : isRefunded
                      ? "4px solid #16a34a"
                      : "4px solid #52c41a",
                  }}
                >
                  <h2 className="admin-card-title">Prepaid Payment Audit</h2>
                  <div style={{ fontSize: "0.82rem", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <span style={{ color: "#666", display: "block", fontSize: "0.72rem", textTransform: "uppercase" }}>Method</span>
                      {isPaymentFailed ? (
                        <strong style={{ color: "#dc2626" }}>PAYMENT FAILED (UNCAPTURED)</strong>
                      ) : (
                        <strong style={{ color: "#15803d" }}>100% PREPAID (ONLINE)</strong>
                      )}
                    </div>
                    <div>
                      <span style={{ color: "#666", display: "block", fontSize: "0.72rem", textTransform: "uppercase" }}>Payment Status</span>
                      {isPaymentFailed ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <strong style={{ color: "#dc2626", fontSize: "0.92rem", fontWeight: 900 }}>FAILED</strong>
                          <span style={{ background: "#fee2e2", color: "#b91c1c", fontSize: "0.68rem", fontWeight: 800, padding: "2px 6px", textTransform: "uppercase" }}>
                            Uncaptured
                          </span>
                        </div>
                      ) : isRefunded ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <strong style={{ color: "#16a34a", fontSize: "0.92rem", fontWeight: 900 }}>100% REFUNDED</strong>
                          <span style={{ background: "#dcfce7", color: "#15803d", fontSize: "0.68rem", fontWeight: 800, padding: "2px 6px", textTransform: "uppercase" }}>Settled</span>
                        </div>
                      ) : (
                        <strong>{order.payment_status || "PAID"}</strong>
                      )}
                    </div>
                    <div>
                      <span style={{ color: "#666", display: "block", fontSize: "0.72rem", textTransform: "uppercase" }}>Razorpay Payment ID</span>
                      <span style={{ fontFamily: "monospace", fontSize: "0.75rem", background: isPaymentFailed ? "#fee2e2" : "#f3f4f6", color: isPaymentFailed ? "#991b1b" : "inherit", padding: "2px 6px" }}>
                        {order.razorpay_payment_id || (isPaymentFailed ? "None (Checkout Failed)" : "rzp_test_sandbox_verified")}
                      </span>
                      {isPaymentFailed && order.razorpay_payment_id && (
                        <span style={{ fontSize: "0.7rem", color: "#dc2626", display: "block", marginTop: 2 }}>
                          Failed attempt: {order.razorpay_payment_id}
                        </span>
                      )}
                    </div>
                    <div>
                      <span style={{ color: "#666", display: "block", fontSize: "0.72rem", textTransform: "uppercase" }}>Razorpay Order ID</span>
                      <span style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                        {order.razorpay_order_id || "—"}
                      </span>
                    </div>
                    {order.razorpay_refund_id && (
                      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px 12px", marginTop: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                          <span style={{ color: "#166534", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase" }}>
                            Refund Reference
                          </span>
                          <span style={{ color: "#15803d", fontSize: "0.78rem", fontWeight: 800 }}>
                            ₹{(order.refund_amount || order.total_amount).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#15803d", fontWeight: 700 }}>
                          {order.razorpay_refund_id}
                        </span>
                      </div>
                    )}
                    {order.refund_amount && !order.razorpay_refund_id ? (
                      <div>
                        <span style={{ color: "#666", display: "block", fontSize: "0.72rem", textTransform: "uppercase" }}>Amount Refunded</span>
                        <strong style={{ color: "#cf1322" }}>₹{order.refund_amount.toLocaleString("en-IN")}</strong>
                      </div>
                    ) : null}
                  </div>

                  {isPaymentFailed ? (
                    <div style={{ marginTop: 14, padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "0.76rem", lineHeight: 1.4 }}>
                      ✕ <strong>Refund Not Applicable:</strong> Customer payment failed at checkout. No funds were debited or captured, so no refund can be issued.
                    </div>
                  ) : !isRefunded && !isCancelled ? (
                    <button
                      type="button"
                      onClick={() => setShowRefundModal(true)}
                      style={{
                        width: "100%",
                        marginTop: 16,
                        background: "#fff",
                        border: "2px solid #dc2626",
                        color: "#dc2626",
                        padding: "10px",
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        cursor: "pointer",
                        borderRadius: "0px",
                      }}
                    >
                      Issue Manual Refund →
                    </button>
                  ) : null}
                </div>

                {/* Status Management Card */}
                <div className="admin-card">
                  <h2 className="admin-card-title">Order Status Controls</h2>
                  {isPaymentFailed && (
                    <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", padding: "8px 10px", fontSize: "0.75rem", color: "#9f1239", marginBottom: 12, lineHeight: 1.4 }}>
                      ⚠️ <strong>Payment Failed:</strong> Order cannot be fulfilled. Recommended status is <strong>CANCELLED</strong>.
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
                          disabled={isPaymentFailed && (s === "SHIPPED" || s === "DELIVERED")}
                        >
                          {s} {isPaymentFailed && (s === "SHIPPED" || s === "DELIVERED") ? "(Blocked - Payment Failed)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">Refund Status</label>
                    {isPaymentFailed ? (
                      <div style={{ padding: "8px 12px", background: "#f3f4f6", border: "1px solid #e5e7eb", fontSize: "0.78rem", color: "#6b7280", fontStyle: "italic" }}>
                        Not Applicable (Payment Failed)
                      </div>
                    ) : (
                      <select
                        className="admin-form-select"
                        value={refundStatus}
                        onChange={(e) => setRefundStatus(e.target.value)}
                      >
                        {REFUND_STATUSES.map((s) => (
                          <option key={s || "none"} value={s}>
                            {s || "No refund"}
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
                    style={{ padding: "12px", fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase" }}
                  >
                    {saving ? <span className="admin-btn-spinner" /> : "Save Status Changes"}
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
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setShowRefundModal(false)}
        >
          <div
            style={{
              background: "#fff",
              maxWidth: 480,
              width: "100%",
              padding: "28px",
              borderRadius: "0px",
              border: "2px solid #000",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.2rem", fontWeight: 900, textTransform: "uppercase", margin: "0 0 12px" }}>
              Issue Razorpay Refund #{order.id}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#555", lineHeight: 1.5, marginBottom: "20px" }}>
              This calls the Razorpay Refund API directly. The amount will be refunded to the customer&rsquo;s original payment method.
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "6px" }}>
                Refund Amount (₹ INR) *
              </label>
              <input
                type="number"
                max={order.total_amount}
                min={1}
                value={refundAmount}
                onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #ccc",
                  borderRadius: "0px",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "6px" }}>
                Reason for Refund
              </label>
              <input
                type="text"
                placeholder="e.g. Return received, damaged goods, customer support request"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #ccc",
                  borderRadius: "0px",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={restockItems}
                  onChange={(e) => setRestockItems(e.target.checked)}
                  style={{ accentColor: "#4232d9" }}
                />
                <span>Automatically restock items into product inventory</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                disabled={processingRefund}
                style={{
                  background: "#fff",
                  border: "1px solid #ccc",
                  padding: "10px 18px",
                  fontSize: "0.8rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  borderRadius: "0px",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessRefund}
                disabled={processingRefund || refundAmount <= 0}
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  padding: "10px 20px",
                  fontSize: "0.8rem",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  cursor: processingRefund ? "not-allowed" : "pointer",
                  borderRadius: "0px",
                }}
              >
                {processingRefund ? "Processing Refund..." : `Refund ₹${refundAmount.toLocaleString("en-IN")} →`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULE PICKUP MODAL */}
      {showPickupModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: "520px",
              padding: "28px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 900, textTransform: "uppercase" }}>
                Schedule Courier Pickup
              </h3>
              <button
                type="button"
                onClick={() => setShowPickupModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#666" }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "14px 16px", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.82rem" }}>
                <span style={{ color: "#64748b", fontWeight: 600 }}>Order ID:</span>
                <strong style={{ color: "#0f172a" }}>#{order.id}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.82rem" }}>
                <span style={{ color: "#64748b", fontWeight: 600 }}>Courier Partner:</span>
                <strong style={{ color: "#0f172a" }}>{order.shiprocket_courier_name || "Express Courier"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                <span style={{ color: "#64748b", fontWeight: 600 }}>AWB Tracking Number:</span>
                <strong style={{ fontFamily: "monospace", color: "#4232d9" }}>{order.shiprocket_awb}</strong>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", marginBottom: 8 }}>
                Select Pickup Date
              </label>
              {(() => {
                const today = new Date().toISOString().split("T")[0];
                const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
                return (
                  <>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      {[
                        { label: "Today (Earliest)", val: today },
                        { label: "Tomorrow (Next Business Day)", val: tomorrow },
                      ].map((p) => (
                        <button
                          key={p.val}
                          type="button"
                          onClick={() => setPickupDate(p.val)}
                          style={{
                            flex: 1,
                            padding: "10px 8px",
                            fontSize: "0.78rem",
                            fontWeight: 800,
                            cursor: "pointer",
                            border: pickupDate === p.val ? "2px solid #4232d9" : "1px solid #d1d5db",
                            background: pickupDate === p.val ? "#eef2ff" : "#fff",
                            color: pickupDate === p.val ? "#4232d9" : "#374151",
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="date"
                      value={pickupDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val > tomorrow) {
                          setPickupDate(tomorrow);
                        } else if (val < today) {
                          setPickupDate(today);
                        } else {
                          setPickupDate(val);
                        }
                      }}
                      min={today}
                      max={tomorrow}
                      style={{
                        width: "100%",
                        padding: "10px",
                        fontSize: "0.88rem",
                        border: "1px solid #d1d5db",
                        fontFamily: "inherit",
                      }}
                    />
                  </>
                );
              })()}
            </div>

            <div style={{ fontSize: "0.78rem", color: "#475569", marginBottom: 16, lineHeight: 1.45, background: "#f8fafc", padding: "10px 12px", borderLeft: "3px solid #3b82f6" }}>
              💡 <strong>Courier SLA Window:</strong> Indian courier partners (Shadowfax, Delhivery, etc.) only accept pickup allocations for <strong>Today</strong> or <strong>Tomorrow</strong>. Manifests requested for dates beyond tomorrow are rejected by courier routing systems.
            </div>

            {isPickupScheduled && (
              <div style={{ background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46", padding: "10px 14px", fontSize: "0.82rem", marginBottom: 16, lineHeight: 1.4 }}>
                ✓ <strong>Pickup is confirmed</strong> {(order as any).tracking_data?.pickup_token ? `(Token: ${(order as any).tracking_data.pickup_token})` : ""}. Select a date below to reschedule if needed.
              </div>
            )}

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #f87171", color: "#b91c1c", padding: "10px 14px", fontSize: "0.82rem", marginBottom: 16, lineHeight: 1.4 }}>
                ⚠️ <strong>Pickup Scheduling Error:</strong> {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowPickupModal(false)}
                style={{
                  background: "#fff",
                  border: "1px solid #d1d5db",
                  padding: "10px 18px",
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSchedulePickup}
                disabled={schedulingPickup}
                style={{
                  background: "#4232d9",
                  color: "#fff",
                  border: "none",
                  padding: "10px 22px",
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  cursor: schedulingPickup ? "not-allowed" : "pointer",
                  textTransform: "uppercase",
                }}
              >
                {schedulingPickup ? "Scheduling..." : "Confirm & Schedule Pickup →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL SHIPMENT MODAL */}
      {showCancelShipmentModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: "500px",
              padding: "28px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 900, textTransform: "uppercase", color: "#dc2626" }}>
                Cancel Shipment & Order
              </h3>
              <button
                type="button"
                onClick={() => setShowCancelShipmentModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#666" }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "14px", marginBottom: 20, color: "#991b1b", fontSize: "0.85rem", lineHeight: 1.5 }}>
              ⚠️ <strong>Warning:</strong> This will cancel the courier shipment in Shiprocket. If this was a prepaid order, a 100% instant refund will be initiated via Razorpay, and items will be restocked to inventory.
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", marginBottom: 6 }}>
                Reason for Cancellation
              </label>
              <input
                type="text"
                placeholder="e.g. Customer requested cancellation before dispatch"
                value={cancelShipmentReason}
                onChange={(e) => setCancelShipmentReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "0.88rem",
                  border: "1px solid #d1d5db",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowCancelShipmentModal(false)}
                style={{
                  background: "#fff",
                  border: "1px solid #d1d5db",
                  padding: "10px 18px",
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                Keep Shipment
              </button>
              <button
                type="button"
                onClick={handleCancelShipment}
                disabled={cancellingShipment}
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  padding: "10px 22px",
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  cursor: cancellingShipment ? "not-allowed" : "pointer",
                  textTransform: "uppercase",
                }}
              >
                {cancellingShipment ? "Cancelling in Shiprocket..." : "Confirm Cancellation →"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
