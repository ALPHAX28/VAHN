"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@/context/AuthContext";
import { getOrderDetail, cancelOrder, requestOrderReturn, getOrderTracking, getOrderExchangeOptions } from "@/lib/api";
import type { OrderDetail, TrackingInfo, OrderExchangeOptionsResponse, ExchangeItemOption, ExchangeVariantOption } from "@/lib/api/types";
import Image from "next/image";
import Link from "next/link";
import {
  MapPinIcon, PrinterIcon, PackageIcon, TruckIcon,
  SparklesIcon, CheckIcon, PhoneIcon, ChevronLeftIcon, XIcon
} from "@/components/icons/Icons";

const STATUS_STEPS = [
  { key: "PROCESSING", label: "Order Placed & Processing", sublabel: "Confirmed", IconComponent: PackageIcon },
  { key: "SHIPPED", label: "Shipped & In Transit", sublabel: "En Route", IconComponent: TruckIcon },
  { key: "DELIVERED", label: "Delivered", sublabel: "Completed", IconComponent: SparklesIcon },
];

function getStatusColor(status: string) {
  if (status === "DELIVERED") return { bg: "#ecfdf5", text: "#15803d", border: "#16a34a" };
  if (status === "SHIPPED") return { bg: "#eff6ff", text: "#1d4ed8", border: "#3b82f6" };
  if (status === "CANCELLED") return { bg: "#fef2f2", text: "#dc2626", border: "#ef4444" };
  if (status === "REFUNDED") return { bg: "#ecfdf5", text: "#15803d", border: "#16a34a" };
  return { bg: "#fffbeb", text: "#b45309", border: "#d97706" };
}

function numberToWordsINR(amount: number): string {
  const a = Math.round(amount);
  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(num: number): string {
    if (num < 20) return units[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + units[num % 10] : "");
    if (num < 1000) return units[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + inWords(num % 100) : "");
    if (num < 100000) return inWords(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + inWords(num % 1000) : "");
    if (num < 10000000) return inWords(Math.floor(num / 100000)) + " Lakh" + (num % 100000 ? " " + inWords(num % 100000) : "");
    return inWords(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 ? " " + inWords(num % 10000000) : "");
  }

  if (a === 0) return "Rupees Zero Only";
  return `Rupees ${inWords(a)} Only`;
}

import { useRouter, useSearchParams } from "next/navigation";

export default function CustomerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = use(params);
  const { token, user, openAuthModal } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuccess = searchParams?.get("success") === "1";

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Live tracking modal states
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingModalData, setTrackingModalData] = useState<TrackingInfo | null>(null);
  const [loadingTrackingModal, setLoadingTrackingModal] = useState(false);
  const [activeTrackingTab, setActiveTrackingTab] = useState<"forward" | "reverse">("forward");
  const [copiedAwb, setCopiedAwb] = useState(false);

  useEffect(() => {
    if (orderId === "undefined" || !orderId) {
      router.replace("/account/orders");
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
      setError(err instanceof Error ? err.message : "Failed to load order details");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenTrackingModal(tab: "forward" | "reverse" = "forward") {
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && showTrackingModal) {
        setShowTrackingModal(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showTrackingModal]);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [returnActionType, setReturnActionType] = useState<"REPLACEMENT" | "RETURN">("REPLACEMENT");
  const [returnReason, setReturnReason] = useState("SIZE_FIT");
  const [returnNotes, setReturnNotes] = useState("");
  const [exchangeOptions, setExchangeOptions] = useState<OrderExchangeOptionsResponse | null>(null);
  const [loadingExchangeOptions, setLoadingExchangeOptions] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [selectedVariantTitle, setSelectedVariantTitle] = useState<string>("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleOpenReturnModal() {
    if (!order) return;
    setShowReturnModal(true);
    setReturnActionType("REPLACEMENT");
    setReturnReason("SIZE_FIT");
    setReturnNotes("");
    setLoadingExchangeOptions(true);
    try {
      const res = await getOrderExchangeOptions(order.id, token || undefined);
      setExchangeOptions(res);
      if (res?.items && res.items.length > 0) {
        const firstItem = res.items[0];
        setSelectedItemId(firstItem.item_id);
        // Pre-select first available replacement variant
        const firstAvail = firstItem.variants.find(v => v.is_available && !v.is_current);
        if (firstAvail) {
          setSelectedVariantId(firstAvail.variant_id);
          setSelectedVariantTitle(firstAvail.title);
        } else {
          setSelectedVariantId("");
          setSelectedVariantTitle("");
        }
      }
    } catch (err) {
      console.error("Failed to load exchange options:", err);
    } finally {
      setLoadingExchangeOptions(false);
    }
  }

  async function handleCancelOrder() {
    if (!token || !order) return;
    setSubmittingAction(true);
    setActionMessage(null);
    try {
      const res = await cancelOrder(order.id, cancelReason || "Customer requested cancellation before dispatch", token);
      setActionMessage({
        type: "success",
        text: `Order #${order.id} cancelled. 100% refund of ₹${parseFloat(order.totalPrice.amount).toLocaleString()} initiated via Razorpay (Refund ID: ${res.refund_id || "Active"}).`
      });
      setShowCancelModal(false);
      loadOrder();
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Failed to cancel order. Please contact support."
      });
    } finally {
      setSubmittingAction(false);
    }
  }

  async function handleRequestReturn() {
    if (!token || !order) return;
    if (returnActionType === "REPLACEMENT" && !selectedVariantId) {
      setActionMessage({
        type: "error",
        text: "Please select an available size for exchange, or switch to Return for 100% Refund."
      });
      return;
    }
    setSubmittingAction(true);
    setActionMessage(null);
    try {
      const res = await requestOrderReturn(order.id, {
        action: returnActionType,
        reason: returnReason,
        notes: returnNotes,
        order_item_id: selectedItemId || undefined,
        replacement_variant_id: returnActionType === "REPLACEMENT" ? selectedVariantId : undefined,
      }, token);

      if (returnActionType === "REPLACEMENT") {
        setActionMessage({
          type: "success",
          text: `Size replacement requested for Order #${order.id}! Replacement item (${selectedVariantTitle}) reserved in warehouse. Shiprocket reverse pickup scheduled${res.reverseAwb ? ` (AWB: ${res.reverseAwb})` : ""}. Courier scan will trigger immediate replacement dispatch!`
        });
      } else {
        setActionMessage({
          type: "success",
          text: `Return requested for Order #${order.id}! Shiprocket reverse pickup scheduled${res.reverseAwb ? ` (AWB: ${res.reverseAwb})` : ""}. Courier scan will automatically disburse your 100% refund via Razorpay.`
        });
      }
      setShowReturnModal(false);
      loadOrder();
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err?.message || "Failed to submit return request."
      });
    } finally {
      setSubmittingAction(false);
    }
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 560, margin: "100px auto", padding: "0 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 900, textTransform: "uppercase", margin: "0 0 16px" }}>
          Please Sign In
        </h2>
        <button
          type="button"
          onClick={() => openAuthModal()}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#000", fontWeight: 800, textDecoration: "underline", fontSize: "0.9rem" }}
        >
          Sign In →
        </button>
      </div>
    );
  }


  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #000", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: '-0.025em' }}>
          Loading order #{orderId}...
        </span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, border: "2px solid #dc2626", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <span style={{ fontSize: "1.5rem", color: "#dc2626" }}>!</span>
        </div>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 900, textTransform: "uppercase", margin: "0 0 8px" }}>Order Not Found</h2>
        <p style={{ color: "#666", fontSize: "0.875rem", margin: "0 0 20px" }}>{error || "Unable to locate this order."}</p>
        <Link href="/account/orders" style={{
          display: "inline-block", background: "#000", color: "#fff",
          padding: "12px 24px", fontWeight: 900, textDecoration: "none",
          textTransform: "uppercase", fontSize: "0.82rem"
        }}>
          ← Back to Orders
        </Link>
      </div>
    );
  }

  // Calculate status tracker step index & live logistics snapshot
  let stepIndex = 0;
  if (order.status === "SHIPPED") stepIndex = 1;
  if (order.status === "DELIVERED") stepIndex = 2;

  const isCancelled = order.status === "CANCELLED";

  // Checkpoint scans preparation
  const activeForwardScans = (trackingModalData?.scans && trackingModalData.scans.length > 0)
    ? trackingModalData.scans
    : (order.trackingData?.scans && order.trackingData.scans.length > 0)
    ? order.trackingData.scans
    : [];

  const activeReverseScans = (trackingModalData?.reverse_scans && trackingModalData.reverse_scans.length > 0)
    ? trackingModalData.reverse_scans
    : (order.reverseTrackingData?.scans && order.reverseTrackingData.scans.length > 0)
    ? order.reverseTrackingData.scans
    : [];

  const forwardCurrentLoc = trackingModalData?.current_location
    || order.trackingData?.current_location
    || (activeForwardScans.length > 0 ? activeForwardScans[activeForwardScans.length - 1]?.location : null)
    || (order.shippingStatus === "IN_TRANSIT" || order.shippingStatus === "SHIPPED" ? "In Transit to Sorting Facility" : null);

  const reverseCurrentLoc = trackingModalData?.current_location
    || order.reverseTrackingData?.current_location
    || (activeReverseScans.length > 0 ? activeReverseScans[activeReverseScans.length - 1]?.location : null);

  const isReturnPickedUp = trackingModalData?.is_picked_up
    ?? order.reverseTrackingData?.is_picked_up
    ?? (order.returnStatus === "PICKED_UP" || order.returnStatus === "REFUNDED" || activeReverseScans.some((s: any) => String(s.activity || '').toLowerCase().includes('picked up')));

  const addr = order.shippingAddress || {};
  const statusColors = getStatusColor(order.status);

  return (
    <>
      {/* WEB VIEW CONTENT (Hidden during print) */}
      <div className="vahn-no-print">
        {isSuccess && (
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              padding: "16px 20px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#10b981",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CheckIcon size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, color: "#065f46", fontSize: "0.95rem", textTransform: "uppercase" }}>
                Order Placed Successfully!
              </div>
              <div style={{ fontSize: "0.82rem", color: "#047857", marginTop: "2px" }}>
                Thank you for your purchase. We have verified your payment and our fulfillment center is preparing your gear.
              </div>
            </div>
          </div>
        )}

      {/* Header: Back link + order meta + print button */}
      <div style={{ marginBottom: 28 }}>
        <Link href="/account/orders" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          color: "#666", fontSize: "0.78rem", fontWeight: 700,
          textDecoration: "none", textTransform: "uppercase", letterSpacing: '-0.025em', marginBottom: 12
        }}>
          <ChevronLeftIcon size={14} color="#666" />
          My Orders
        </Link>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 900, margin: "0 0 4px", letterSpacing: '-0.025em' }}>
              Order #{order.id}
            </h1>
            <span style={{ fontSize: "0.83rem", color: "#888" }}>
              Placed on {order.createdAt}
            </span>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            {order.status !== "CANCELLED" && (order.shiprocketAwb || order.trackingData?.awb) && (
              <button
                type="button"
                onClick={() => handleOpenTrackingModal("forward")}
                style={{
                  background: "#4232d9",
                  color: "#fff",
                  border: "none",
                  padding: "10px 18px",
                  fontSize: "0.8rem",
                  fontWeight: 900,
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <TruckIcon size={15} color="#fff" />
                Track Shipment →
              </button>
            )}

            {order.status === "PROCESSING" && (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                style={{
                  background: "#fff",
                  border: "2px solid #dc2626",
                  color: "#dc2626",
                  padding: "10px 18px",
                  fontSize: "0.8rem",
                  fontWeight: 900,
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                }}
              >
                Cancel Order
              </button>
            )}

            {order.status === "DELIVERED" && (!order.returnStatus || order.returnStatus === "NONE") && (
              <button
                type="button"
                onClick={handleOpenReturnModal}
                style={{
                  background: "#000",
                  border: "2px solid #000",
                  color: "#fff",
                  padding: "10px 18px",
                  fontSize: "0.8rem",
                  fontWeight: 900,
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                }}
              >
                Request 10-Day Return / Exchange
              </button>
            )}

            <button
              onClick={() => window.print()}
              style={{
                background: "#fff",
                border: "2px solid #000",
                color: "#000",
                padding: "10px 20px",
                fontSize: "0.8rem",
                fontWeight: 900,
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "-0.025em",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f3f4f6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff";
              }}
            >
              <PrinterIcon size={15} color="#000" />
              Print Receipt
            </button>
          </div>
        </div>

        {actionMessage && (
          <div
            style={{
              background: actionMessage.type === "success" ? "#f6ffed" : "#fff2f0",
              border: `1px solid ${actionMessage.type === "success" ? "#b7eb8f" : "#ffccc7"}`,
              color: actionMessage.type === "success" ? "#389e0d" : "#cf1322",
              padding: "12px 16px",
              marginTop: "16px",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            {actionMessage.text}
          </div>
        )}
      </div>

      {/* Order Fulfillment Tracker */}
      {isCancelled ? (
        /* ======================================================== */
        /* CLEAN, SIMPLIFIED ORDER CANCELLED & REFUND CARD          */
        /* ======================================================== */
        <div
          className="vahn-order-card"
          style={{
            borderLeft: "4px solid #ef4444",
            padding: "24px 28px",
            marginBottom: 24,
            background: "#fff",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", background: "#fee2e2", color: "#dc2626",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <XIcon size={18} color="#dc2626" />
              </div>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", margin: 0 }}>
                  Order Cancelled
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#666" }}>
                  {order.cancellationReason || "Cancelled by customer before dispatch"}
                </p>
              </div>
            </div>

            <span style={{
              background: order.refundStatus === "REFUNDED" ? "#f0fdf4" : "#fef3c7",
              color: order.refundStatus === "REFUNDED" ? "#16a34a" : "#b45309",
              border: `1px solid ${order.refundStatus === "REFUNDED" ? "#bbf7d0" : "#fde68a"}`,
              padding: "5px 14px",
              fontSize: "0.75rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "-0.01em"
            }}>
              {order.refundStatus === "REFUNDED" ? "100% Refund Completed" : "Refund in Process"}
            </span>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 20,
            paddingTop: 16,
            borderTop: "1px solid #f0f0f0",
            fontSize: "0.85rem"
          }}>
            <div>
              <span style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 2 }}>
                Refund Amount
              </span>
              <span style={{ fontSize: "1.25rem", fontWeight: 900, color: "#000" }}>
                ₹{parseFloat(order.totalPrice.amount).toLocaleString()}
              </span>
            </div>

            <div>
              <span style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 2 }}>
                Refund Method
              </span>
              <span style={{ fontWeight: 700, color: "#000" }}>
                Original Payment Method (Razorpay)
              </span>
            </div>

            <div>
              <span style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 2 }}>
                Refund Status
              </span>
              <span style={{ fontWeight: 800, color: order.refundStatus === "REFUNDED" ? "#16a34a" : "#b45309" }}>
                {order.refundStatus === "REFUNDED" ? "Disbursed to Source Account" : "Initiated via Razorpay"}
              </span>
            </div>

            {order.refundedAt && (
              <div>
                <span style={{ fontSize: "0.72rem", color: "#888", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 2 }}>
                  Processed Date
                </span>
                <span style={{ fontWeight: 700, color: "#000" }}>
                  {order.refundedAt}
                </span>
              </div>
            )}
          </div>

          <div style={{
            marginTop: 18,
            padding: "12px 16px",
            background: "#fafafa",
            border: "1px solid #e5e7eb",
            fontSize: "0.82rem",
            color: "#555",
            lineHeight: 1.5
          }}>
            <strong style={{ color: "#000" }}>Direct Source Account Refund:</strong> Because your order was cancelled prior to courier dispatch, a 100% refund of ₹{parseFloat(order.totalPrice.amount).toLocaleString()} was initiated back to your original payment method via Razorpay. Depending on your bank (UPI / Card / NetBanking), it typically reflects within 2–5 business days.
          </div>
        </div>
      ) : (
        /* Order Fulfillment Tracker for Active Shipments */
        <div className="vahn-order-card">
          {/* Tracker header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <h3 style={{ fontSize: "0.78rem", fontWeight: 900, margin: 0, textTransform: "uppercase", letterSpacing: '-0.025em', color: "#555" }}>
              Fulfillment Status
            </h3>
            <span style={{
              background: statusColors.bg, color: statusColors.text,
              border: `1px solid ${statusColors.border}`,
              padding: "5px 14px", fontSize: "0.72rem", fontWeight: 900,
              textTransform: "uppercase", letterSpacing: '-0.025em'
            }}>
              {order.status}
            </span>
          </div>

          {/* Desktop Tracker */}
          <div className="vahn-tracker-desktop" style={{ position: "relative" }}>
            {/* Background track */}
            <div style={{
              position: "absolute", top: 19, left: "calc(16.66% + 8px)", right: "calc(16.66% + 8px)",
              height: 2, background: "#e5e7eb", zIndex: 1
            }} />
            {/* Active progress track */}
            <div style={{
              position: "absolute", top: 19, left: "calc(16.66% + 8px)",
              width: stepIndex === 0 ? "0%" : stepIndex === 1 ? "calc(33.33% - 16px)" : "calc(66.66% - 16px)",
              height: 2, background: "#000", zIndex: 2, transition: "width 0.6s ease"
            }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 3 }}>
              {STATUS_STEPS.map((s, idx) => {
                const isCompleted = idx <= stepIndex;
                const isPast = idx < stepIndex;
                const isCurrent = idx === stepIndex;
                const IconComp = s.IconComponent;

                return (
                  <div
                    key={s.key}
                    onClick={() => {
                      if (order.shiprocketAwb || order.trackingData?.awb) {
                        handleOpenTrackingModal("forward");
                      }
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      width: "33.33%",
                      textAlign: "center",
                      cursor: (order.shiprocketAwb || order.trackingData?.awb) ? "pointer" : "default",
                    }}
                    title={(order.shiprocketAwb || order.trackingData?.awb) ? "Click to view live tracking" : undefined}
                  >
                    <div style={{
                      width: 40, height: 40,
                      background: isCompleted ? "#000" : "#fff",
                      color: isCompleted ? "#fff" : "#9ca3af",
                      border: isCompleted ? "2px solid #000" : "2px solid #d1d5db",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.3s ease",
                      boxShadow: isCurrent ? "0 0 0 4px rgba(0,0,0,0.1)" : "none"
                    }}>
                      {isPast ? (
                        <CheckIcon size={16} color="#fff" />
                      ) : isCurrent ? (
                        <IconComp size={16} color="#fff" />
                      ) : (
                        <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{idx + 1}</span>
                      )}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 900, color: isCompleted ? "#000" : "#9ca3af", lineHeight: 1.3 }}>
                        {s.label}
                      </div>
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: '-0.025em', marginTop: 2 }}>
                        {s.sublabel}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile Vertical Tracker */}
          <div className="vahn-tracker-mobile" style={{ display: "none", flexDirection: "column", gap: 16 }}>
            {STATUS_STEPS.map((s, idx) => {
              const isCompleted = idx <= stepIndex;
              const isPast = idx < stepIndex;
              const isCurrent = idx === stepIndex;
              const IconComp = s.IconComponent;

              return (
                <div key={s.key} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{
                    width: 34, height: 34,
                    background: isCompleted ? "#000" : "#fff",
                    color: isCompleted ? "#fff" : "#9ca3af",
                    border: isCompleted ? "2px solid #000" : "2px solid #d1d5db",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0
                  }}>
                    {isPast ? <CheckIcon size={14} color="#fff" /> : isCurrent ? <IconComp size={14} color="#fff" /> : <span>{idx + 1}</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 900, color: isCompleted ? "#000" : "#9ca3af" }}>{s.label}</div>
                    <div style={{ fontSize: "0.72rem", color: "#888" }}>{s.sublabel}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Forward Tracking Snapshot Bar */}
          {(order.shiprocketAwb || order.trackingData?.awb || order.shippingStatus === "IN_TRANSIT" || order.shippingStatus === "SHIPPED") && (
            <div
              style={{
                marginTop: 24,
                padding: "16px 20px",
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: "#000",
                    borderRadius: "0px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <TruckIcon size={20} color="#fff" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 900, textTransform: "uppercase", color: "#000" }}>
                      {order.shippingStatus || "IN TRANSIT"}
                    </span>
                    {forwardCurrentLoc && (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          color: "#4232d9",
                          background: "#eef2ff",
                          border: "1px solid #c7d2fe",
                          padding: "2px 8px",
                        }}
                      >
                        📍 Current Location: {forwardCurrentLoc}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#666", marginTop: 3 }}>
                    {order.shiprocketCourierName || "Express Courier"}
                    {(order.shiprocketAwb || order.trackingData?.awb) && (
                      <span> · AWB: <strong style={{ fontFamily: "monospace", color: "#000" }}>{order.shiprocketAwb || order.trackingData?.awb}</strong></span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenTrackingModal("forward")}
                style={{
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  padding: "10px 18px",
                  fontSize: "0.78rem",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <span>📍 View Live Tracking & Checkpoints →</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reverse Logistics Return Tracker (Automated Shiprocket Reverse Pickup) */}
      {order.returnStatus && order.returnStatus !== "NONE" && (
        <div
          className="vahn-order-card"
          style={{
            marginTop: 24,
            border: "2px solid #4232d9",
            background: "#f9f8ff",
            padding: "24px",
            borderRadius: "0px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 16,
              borderBottom: "1px solid rgba(66, 50, 217, 0.15)",
              paddingBottom: 12,
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 900,
                  color: "#4232d9",
                  textTransform: "uppercase",
                  letterSpacing: "-0.01em",
                }}
              >
                {order.returnType === "REPLACEMENT" ? "Automated Size Replacement & Reverse Logistics" : "Automated Reverse Logistics"}
              </span>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 900, margin: "2px 0 0", textTransform: "uppercase" }}>
                {order.returnType === "REPLACEMENT"
                  ? `Replacement Status: ${order.replacementStatus && order.replacementStatus !== "NONE" ? order.replacementStatus : order.returnStatus}`
                  : `Return Status: ${order.returnStatus}`}
              </h3>
            </div>
            <span
              style={{
                background: order.returnStatus === "REFUNDED" || order.replacementStatus === "REPLACEMENT_DISPATCHED" ? "#52c41a" : "#4232d9",
                color: "#fff",
                padding: "6px 14px",
                fontSize: "0.75rem",
                fontWeight: 900,
                textTransform: "uppercase",
                borderRadius: "0px",
              }}
            >
              {order.returnType === "REPLACEMENT"
                ? (order.replacementStatus === "REPLACEMENT_DISPATCHED" ? "DISPATCHED" : order.replacementStatus === "PICKED_UP" ? "ORIGINAL PICKED UP" : "EXCHANGE REQUESTED")
                : order.returnStatus}
            </span>
          </div>

          {/* Size Replacement Highlights Banner */}
          {order.returnType === "REPLACEMENT" && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 16,
                padding: "12px 16px",
                background: "#f5f3ff",
                border: "1px solid #c4b5fd",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1.2rem" }}>🔄</span>
                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#6b21a8", textTransform: "uppercase" }}>
                    Reserved Replacement Size
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#4232d9" }}>
                    {order.replacementVariantTitle || "Selected Replacement Item"}
                  </div>
                </div>
              </div>

              {order.replacementAwb && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#666", textTransform: "uppercase" }}>
                    Replacement Shipment AWB
                  </div>
                  <div style={{ fontFamily: "monospace", fontWeight: 900, color: "#000", fontSize: "0.9rem" }}>
                    {order.replacementAwb} ({order.replacementCourierName || "Courier"})
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Doorstep Pickup Verification Banner */}
          <div
            style={{
              background: isReturnPickedUp ? "#ecfdf5" : "#fffbeb",
              border: isReturnPickedUp ? "1px solid #86efac" : "1px solid #fde68a",
              padding: "12px 16px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: isReturnPickedUp ? "#16a34a" : "#d97706",
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: "0.82rem", fontWeight: 800, color: isReturnPickedUp ? "#15803d" : "#b45309" }}>
                {isReturnPickedUp
                  ? "✔ ORIGINAL ITEM COLLECTED FROM YOUR DOORSTEP"
                  : "⏳ PICKUP SCHEDULED — COURIER ARRIVING FOR COLLECTION"}
              </span>
            </div>
            {reverseCurrentLoc && (
              <span style={{ fontSize: "0.78rem", color: "#333", fontWeight: 700 }}>
                📍 Current Location: {reverseCurrentLoc}
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16, fontSize: "0.85rem", color: "#333", marginBottom: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
              <div>
                Reverse Courier: <strong>{order.reverseCourierName || "Shiprocket Reverse"}</strong>
              </div>
              {order.reverseAwb && (
                <div>
                  Reverse AWB: <strong style={{ fontFamily: "monospace" }}>{order.reverseAwb}</strong>
                </div>
              )}
              {order.returnReason && (
                <div>
                  Reason: <strong>{order.returnReason}</strong>
                </div>
              )}
            </div>

            {(order.reverseAwb || order.reverseTrackingData?.awb) && (
              <button
                type="button"
                onClick={() => handleOpenTrackingModal("reverse")}
                style={{
                  background: "#4232d9",
                  color: "#fff",
                  border: "none",
                  padding: "8px 16px",
                  fontSize: "0.75rem",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "-0.02em",
                  cursor: "pointer",
                }}
              >
                📍 View Return Checkpoints & Status →
              </button>
            )}
          </div>

          <div
            style={{
              padding: "12px 16px",
              background: "#fff",
              border: "1px solid rgba(66, 50, 217, 0.2)",
              fontSize: "0.82rem",
              color: "#444",
              lineHeight: 1.5,
            }}
          >
            {order.returnType === "REPLACEMENT" ? (
              <>
                <strong>Size Replacement & Exchange Process:</strong> Shiprocket reverse courier will collect the original garment from your address. Once collected and verified, our warehouse will immediately dispatch your replacement size ({order.replacementVariantTitle || "Selected Size"}). Live replacement shipment updates will appear directly on this page.
              </>
            ) : (
              <>
                <strong>Automated 10-Day Refund Process:</strong> Once the courier arrives at your address and scans the package pickup, your 100% refund of ₹{parseFloat(order.totalPrice.amount).toLocaleString()} is automatically disbursed back to your original payment method via Razorpay.
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
            <h3 style={{ fontSize: "0.8rem", fontWeight: 900, margin: 0, textTransform: "uppercase", letterSpacing: '-0.025em', color: "#555" }}>
              Items in Order ({order.items.length})
            </h3>
          </div>

          <div className="vahn-card-box-body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {order.items.map(item => (
              <div key={item.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", borderBottom: "1px solid #f3f4f6", paddingBottom: 18 }}>
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl} alt={item.productTitle}
                    width={64} height={64}
                    style={{ objectFit: "cover", border: "1px solid #e5e5e5", flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 64, height: 64, background: "#f3f4f6", border: "1px solid #e5e5e5", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: "0.92rem", color: "#000", marginBottom: 4, lineHeight: 1.35 }}>
                    {item.productTitle}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#555", marginBottom: 2 }}>
                    Variant: {item.variantTitle}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#888" }}>
                    Qty: <strong style={{ color: "#000" }}>{item.quantity}</strong> &nbsp;·&nbsp; Unit: ₹{parseFloat(item.price.amount).toLocaleString()}
                  </div>
                </div>
                <div style={{ fontWeight: 900, fontSize: "0.95rem", color: "#000", flexShrink: 0 }}>
                  ₹{(parseFloat(item.price.amount) * item.quantity).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Delivery Address Card */}
          <div className="vahn-card-box">
            <div className="vahn-card-box-header" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MapPinIcon size={15} color="#000" />
              <h3 style={{ fontSize: "0.78rem", fontWeight: 900, margin: 0, textTransform: "uppercase", letterSpacing: '-0.025em', color: "#555" }}>
                Delivery Address
              </h3>
            </div>
            <div className="vahn-card-box-body">
              {addr.name && (
                <div style={{ fontWeight: 900, fontSize: "0.95rem", color: "#000", marginBottom: 6 }}>{addr.name}</div>
              )}
              {addr.label && (
                <span style={{
                  display: "inline-block", background: "#000", color: "#fff",
                  padding: "2px 9px", fontSize: "0.65rem", fontWeight: 900,
                  textTransform: "uppercase", marginBottom: 10
                }}>
                  {addr.label}
                </span>
              )}
              <div style={{ fontSize: "0.875rem", color: "#333", lineHeight: 1.5 }}>
                {addr.address || "Standard Address"}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#555", marginTop: 3 }}>
                {addr.city}, {addr.state} — <strong style={{ color: "#000" }}>{addr.postalCode}</strong>
              </div>
              <div style={{ fontSize: "0.82rem", color: "#888", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <MapPinIcon size={12} color="#aaa" /> India
              </div>
              {addr.phone && (
                <div style={{ fontSize: "0.82rem", color: "#777", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                  <PhoneIcon size={12} color="#888" /> {addr.phone}
                </div>
              )}
            </div>
          </div>

          {/* Payment Summary Card */}
          <div className="vahn-card-box">
            <div className="vahn-card-box-header">
              <h3 style={{ fontSize: "0.78rem", fontWeight: 900, margin: 0, textTransform: "uppercase", letterSpacing: '-0.025em', color: "#555" }}>
                Payment Summary
              </h3>
            </div>
            <div className="vahn-card-box-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.875rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#555" }}>Items Subtotal</span>
                  <span style={{ fontWeight: 700, color: "#000" }}>₹{parseFloat(order.subtotalPrice.amount).toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#555" }}>Shipping</span>
                  <span>
                    {parseFloat(order.shippingPrice.amount) === 0
                      ? <strong style={{ color: "#16a34a" }}>FREE</strong>
                      : `₹${order.shippingPrice.amount}`}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#999", fontSize: "0.8rem" }}>
                  <span>GST Tax (12% incl.)</span>
                  <span>₹{parseFloat(order.taxPrice.amount).toLocaleString()}</span>
                </div>
              </div>

              {/* Total Row */}
              <div style={{
                marginTop: 14, paddingTop: 14, borderTop: "2px solid #000",
                display: "flex", justifyContent: "space-between", alignItems: "center"
              }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: '-0.025em', color: "#555" }}>
                  Total Paid
                </span>
                <span style={{ fontSize: "1.4rem", fontWeight: 900, color: "#000" }}>
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
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              overflowY: "auto",
              border: "2px solid #000",
              boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#000",
                color: "#fff",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      background: "#4232d9",
                      color: "#fff",
                      fontSize: "0.68rem",
                      fontWeight: 900,
                      padding: "2px 8px",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    Live Logistics
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#aaa", textTransform: "uppercase" }}>
                    Shiprocket Courier Network
                  </span>
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 900, margin: 0, letterSpacing: "-0.025em" }}>
                  Tracking Details · Order #{order.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTrackingModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  padding: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label="Close tracking modal"
              >
                <XIcon size={20} color="#fff" />
              </button>
            </div>

            {/* Tab Switcher for orders with forward and return tracking */}
            {(order.reverseAwb || (order.returnStatus && order.returnStatus !== "NONE")) && (
              <div style={{ display: "flex", borderBottom: "2px solid #000", background: "#f3f4f6" }}>
                <button
                  type="button"
                  onClick={() => setActiveTrackingTab("forward")}
                  style={{
                    flex: 1,
                    padding: "14px",
                    fontWeight: 900,
                    fontSize: "0.82rem",
                    textTransform: "uppercase",
                    letterSpacing: "-0.02em",
                    background: activeTrackingTab === "forward" ? "#fff" : "transparent",
                    color: activeTrackingTab === "forward" ? "#000" : "#666",
                    border: "none",
                    borderBottom: activeTrackingTab === "forward" ? "3px solid #4232d9" : "none",
                    cursor: "pointer",
                  }}
                >
                  Forward Delivery ({order.shiprocketAwb || "Active"})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTrackingTab("reverse")}
                  style={{
                    flex: 1,
                    padding: "14px",
                    fontWeight: 900,
                    fontSize: "0.82rem",
                    textTransform: "uppercase",
                    letterSpacing: "-0.02em",
                    background: activeTrackingTab === "reverse" ? "#fff" : "transparent",
                    color: activeTrackingTab === "reverse" ? "#4232d9" : "#666",
                    border: "none",
                    borderBottom: activeTrackingTab === "reverse" ? "3px solid #4232d9" : "none",
                    cursor: "pointer",
                  }}
                >
                  Reverse Return ({order.reverseAwb || "Return"})
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
              {loadingTrackingModal ? (
                <div style={{ padding: "40px 0", textAlign: "center" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      border: "3px solid #4232d9",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                      margin: "0 auto 12px",
                    }}
                  />
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#666", textTransform: "uppercase" }}>
                    Fetching live courier checkpoint scans...
                  </div>
                </div>
              ) : activeTrackingTab === "forward" ? (
                /* FORWARD TRACKING VIEW */
                <>
                  {/* Current Location Highlight Banner */}
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1.5px solid #86efac",
                      padding: "16px 20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#16a34a",
                            display: "inline-block",
                            boxShadow: "0 0 0 3px rgba(22,163,74,0.25)",
                          }}
                        />
                        <span style={{ fontSize: "0.72rem", fontWeight: 900, color: "#16a34a", textTransform: "uppercase" }}>
                          Current Location
                        </span>
                      </div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#000" }}>
                        📍 {forwardCurrentLoc || "In Transit to Destination Facility"}
                      </div>
                    </div>
                    <span
                      style={{
                        background: "#000",
                        color: "#fff",
                        padding: "6px 14px",
                        fontSize: "0.75rem",
                        fontWeight: 900,
                        textTransform: "uppercase",
                      }}
                    >
                      {order.shippingStatus || order.status}
                    </span>
                  </div>

                  {/* Courier & AWB Code strip */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 16,
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      padding: "16px 20px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "#666", textTransform: "uppercase", fontWeight: 800 }}>
                        Courier Partner
                      </div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#000", marginTop: 2 }}>
                        {order.shiprocketCourierName || trackingModalData?.courier_name || trackingModalData?.courierName || "Assigned on Dispatch"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "#666", textTransform: "uppercase", fontWeight: 800 }}>
                        AWB Tracking Code
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                        <strong style={{ fontFamily: "monospace", fontSize: "0.95rem", color: "#000" }}>
                          {order.shiprocketAwb || trackingModalData?.awb_code || trackingModalData?.awbCode || "Pending Dispatch"}
                        </strong>
                        {(order.shiprocketAwb || trackingModalData?.awb_code) && (
                          <button
                            type="button"
                            onClick={() => handleCopyAwb(order.shiprocketAwb || trackingModalData?.awb_code || "")}
                            style={{
                              background: copiedAwb ? "#16a34a" : "#fff",
                              color: copiedAwb ? "#fff" : "#000",
                              border: "1px solid #000",
                              padding: "2px 8px",
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            {copiedAwb ? "COPIED" : "COPY"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "#666", textTransform: "uppercase", fontWeight: 800 }}>
                        Estimated Delivery
                      </div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#000", marginTop: 2 }}>
                        3–5 Business Days
                      </div>
                    </div>
                  </div>

                  {/* Scans Timeline */}
                  <div>
                    <h4
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 900,
                        textTransform: "uppercase",
                        letterSpacing: "-0.01em",
                        margin: "0 0 16px",
                        color: "#000",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>Complete Checkpoint Scans ({activeForwardScans.length})</span>
                      <span style={{ fontSize: "0.72rem", color: "#888", fontWeight: 600 }}>Chronological Scan Feed</span>
                    </h4>

                    {activeForwardScans.length === 0 ? (
                      <div style={{ padding: "24px", textAlign: "center", background: "#f9fafb", border: "1px dashed #d1d5db" }}>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>
                          Package is manifesting. Courier pickup scan will appear here once handed over.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
                        {activeForwardScans.map((scan: any, idx: number) => {
                          const isLatest = idx === activeForwardScans.length - 1;
                          return (
                            <div key={idx} style={{ display: "flex", gap: 16, position: "relative" }}>
                              {/* Left timeline node and line */}
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                                <div
                                  style={{
                                    width: 14,
                                    height: 14,
                                    background: isLatest ? "#4232d9" : "#000",
                                    border: isLatest ? "3px solid #c7d2fe" : "none",
                                    marginTop: 4,
                                  }}
                                />
                                {idx < activeForwardScans.length - 1 && (
                                  <div style={{ width: 2, flex: 1, minHeight: 36, background: "#e5e7eb" }} />
                                )}
                              </div>

                              {/* Right content */}
                              <div style={{ paddingBottom: 20, flex: 1 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                                  <span style={{ fontSize: "0.88rem", fontWeight: 900, color: isLatest ? "#4232d9" : "#000" }}>
                                    {scan.activity}
                                  </span>
                                  <span style={{ fontSize: "0.72rem", color: "#888", fontWeight: 600 }}>
                                    {scan.date || "Recorded"}
                                  </span>
                                </div>
                                {scan.location && (
                                  <div style={{ fontSize: "0.78rem", color: "#666", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                                    <MapPinIcon size={12} color="#888" /> {scan.location}
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
                  {/* Doorstep Pickup Verification Banner */}
                  <div
                    style={{
                      background: isReturnPickedUp ? "#f0fdf4" : "#fffbeb",
                      border: isReturnPickedUp ? "1.5px solid #86efac" : "1.5px solid #fde68a",
                      padding: "16px 20px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: isReturnPickedUp ? "#16a34a" : "#d97706",
                          display: "inline-block",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 900,
                          color: isReturnPickedUp ? "#16a34a" : "#d97706",
                          textTransform: "uppercase",
                        }}
                      >
                        Customer Doorstep Pickup Status
                      </span>
                    </div>
                    <div style={{ fontSize: "1.05rem", fontWeight: 900, color: isReturnPickedUp ? "#15803d" : "#b45309" }}>
                      {isReturnPickedUp
                        ? "✔ PARCEL SUCCESSFULLY PICKED UP FROM CUSTOMER DOORSTEP"
                        : "⏳ PICKUP SCHEDULED — COURIER WILL ARRIVE AT CUSTOMER ADDRESS"}
                    </div>
                    {reverseCurrentLoc && (
                      <div style={{ fontSize: "0.82rem", color: "#444", marginTop: 6 }}>
                        📍 <strong>Current Package Location:</strong> {reverseCurrentLoc}
                      </div>
                    )}
                  </div>

                  {/* Reverse Courier & AWB Code strip */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 16,
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      padding: "16px 20px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "#666", textTransform: "uppercase", fontWeight: 800 }}>
                        Reverse Courier
                      </div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#000", marginTop: 2 }}>
                        {order.reverseCourierName || trackingModalData?.reverse_courier_name || "Delhivery Reverse Surface"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "#666", textTransform: "uppercase", fontWeight: 800 }}>
                        Reverse AWB
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                        <strong style={{ fontFamily: "monospace", fontSize: "0.95rem", color: "#000" }}>
                          {order.reverseAwb || trackingModalData?.reverse_awb || "98798441933"}
                        </strong>
                        <button
                          type="button"
                          onClick={() => handleCopyAwb(order.reverseAwb || trackingModalData?.reverse_awb || "98798441933")}
                          style={{
                            background: copiedAwb ? "#16a34a" : "#fff",
                            color: copiedAwb ? "#fff" : "#000",
                            border: "1px solid #000",
                            padding: "2px 8px",
                            fontSize: "0.7rem",
                            fontWeight: 800,
                            cursor: "pointer",
                            textTransform: "uppercase",
                          }}
                        >
                          {copiedAwb ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "#666", textTransform: "uppercase", fontWeight: 800 }}>
                        Automated Refund
                      </div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#16a34a", marginTop: 2 }}>
                        100% on Doorstep Scan
                      </div>
                    </div>
                  </div>

                  {/* Return Checkpoint Scans Timeline */}
                  <div>
                    <h4
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 900,
                        textTransform: "uppercase",
                        letterSpacing: "-0.01em",
                        margin: "0 0 16px",
                        color: "#000",
                      }}
                    >
                      Return Transit Checkpoints ({activeReverseScans.length})
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {activeReverseScans.map((scan: any, idx: number) => {
                        const isLatest = idx === activeReverseScans.length - 1;
                        return (
                          <div key={idx} style={{ display: "flex", gap: 16, position: "relative" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                              <div
                                style={{
                                  width: 14,
                                  height: 14,
                                  background: isLatest ? "#4232d9" : "#000",
                                  border: isLatest ? "3px solid #c7d2fe" : "none",
                                  marginTop: 4,
                                }}
                              />
                              {idx < activeReverseScans.length - 1 && (
                                <div style={{ width: 2, flex: 1, minHeight: 36, background: "#e5e7eb" }} />
                              )}
                            </div>
                            <div style={{ paddingBottom: 20, flex: 1 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                                <span style={{ fontSize: "0.88rem", fontWeight: 900, color: isLatest ? "#4232d9" : "#000" }}>
                                  {scan.activity}
                                </span>
                                <span style={{ fontSize: "0.72rem", color: "#888", fontWeight: 600 }}>
                                  {scan.date || "Recorded"}
                                </span>
                              </div>
                              {scan.location && (
                                <div style={{ fontSize: "0.78rem", color: "#666", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                                  <MapPinIcon size={12} color="#888" /> {scan.location}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #e5e7eb",
                background: "#fafafa",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => handleOpenTrackingModal(activeTrackingTab)}
                  style={{
                    background: "#fff",
                    border: "1px solid #000",
                    color: "#000",
                    padding: "8px 14px",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  ↻ Refresh Live Scans
                </button>
                {(order.shiprocketAwb || trackingModalData?.awb_code) && (
                  <Link
                    href={`/track?q=${order.shiprocketAwb || trackingModalData?.awb_code}`}
                    target="_blank"
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      color: "#4232d9",
                      textDecoration: "underline",
                      textTransform: "uppercase",
                    }}
                  >
                    Public Tracking Portal ↗
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowTrackingModal(false)}
                style={{
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  padding: "8px 20px",
                  fontSize: "0.78rem",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* PRINTABLE OFFICIAL TAX INVOICE / RECEIPT (Only visible during print) */}
      <div className="vahn-printable-receipt">
        <div style={{ padding: "40px", border: "2px solid #000", background: "#fff", color: "#000", fontFamily: "sans-serif" }}>
          
          {/* Header Banner */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: 20, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: "2.4rem", fontWeight: 900, margin: "0 0 4px", letterSpacing: '-0.025em', textTransform: "uppercase" }}>
                VAHN
              </h1>
              <div style={{ fontSize: "0.8rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: '-0.025em', color: "#222" }}>
                VAHN SPORTSWEAR INDIA PVT. LTD.
              </div>
              <div style={{ fontSize: "0.75rem", color: "#555", marginTop: 4, lineHeight: 1.4 }}>
                Registered Office: 502 Airport Towers, Masterda Sarani, Mumbai, MH 400001<br />
                GSTIN: 27AAACV1234F1Z9 · Support: support@vahnsports.com
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ background: "#000", color: "#fff", padding: "6px 16px", fontSize: "0.85rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: '-0.025em', display: "inline-block" }}>
                OFFICIAL TAX INVOICE
              </div>
              <div style={{ fontSize: "0.88rem", fontWeight: 900, marginTop: 12 }}>
                Invoice #: INV-{order.id}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#555", marginTop: 2 }}>
                Order Date: {order.createdAt}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#15803d", fontWeight: 900, marginTop: 2 }}>
                Payment Status: PAID (CONFIRMED)
              </div>
            </div>
          </div>

          {/* Customer & Shipping Details */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, paddingBottom: 20, borderBottom: "1px solid #e5e5e5", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: '-0.025em', color: "#777", marginBottom: 6 }}>
                BILLED TO (CUSTOMER)
              </div>
              <div style={{ fontWeight: 900, fontSize: "0.95rem" }}>{user.full_name}</div>
              <div style={{ fontSize: "0.82rem", color: "#444", marginTop: 2 }}>{user.email}</div>
              {addr.phone && <div style={{ fontSize: "0.82rem", color: "#444", marginTop: 2 }}>Ph: {addr.phone}</div>}
            </div>

            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: '-0.025em', color: "#777", marginBottom: 6 }}>
                SHIPPED TO (DELIVERY LOCATION)
              </div>
              <div style={{ fontWeight: 900, fontSize: "0.95rem" }}>{addr.name || user.full_name}</div>
              <div style={{ fontSize: "0.85rem", color: "#333", marginTop: 2, lineHeight: 1.4 }}>
                {addr.address || "Standard Shipping Address"}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#333", fontWeight: 700 }}>
                {addr.city}, {addr.state} — {addr.postalCode}
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderTop: "2px solid #000", borderBottom: "2px solid #000", textAlign: "left" }}>
                <th style={{ padding: "10px 12px", fontWeight: 900, textTransform: "uppercase", fontSize: "0.72rem" }}>S.No</th>
                <th style={{ padding: "10px 12px", fontWeight: 900, textTransform: "uppercase", fontSize: "0.72rem" }}>Product Description</th>
                <th style={{ padding: "10px 12px", fontWeight: 900, textTransform: "uppercase", fontSize: "0.72rem" }}>Variant / Size</th>
                <th style={{ padding: "10px 12px", fontWeight: 900, textTransform: "uppercase", fontSize: "0.72rem", textAlign: "right" }}>Unit Price</th>
                <th style={{ padding: "10px 12px", fontWeight: 900, textTransform: "uppercase", fontSize: "0.72rem", textAlign: "center" }}>Qty</th>
                <th style={{ padding: "10px 12px", fontWeight: 900, textTransform: "uppercase", fontSize: "0.72rem", textAlign: "right" }}>GST Rate</th>
                <th style={{ padding: "10px 12px", fontWeight: 900, textTransform: "uppercase", fontSize: "0.72rem", textAlign: "right" }}>Total Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => {
                const unitPrice = parseFloat(item.price.amount);
                const lineTotal = unitPrice * item.quantity;
                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid #e5e5e5" }}>
                    <td style={{ padding: "12px", color: "#666" }}>{index + 1}</td>
                    <td style={{ padding: "12px", fontWeight: 800 }}>{item.productTitle}</td>
                    <td style={{ padding: "12px", color: "#555" }}>{item.variantTitle}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>₹{unitPrice.toLocaleString()}</td>
                    <td style={{ padding: "12px", textAlign: "center", fontWeight: 800 }}>{item.quantity}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#666" }}>12% (incl)</td>
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: 900 }}>₹{lineTotal.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Amount in Words & Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, paddingBottom: 24, borderBottom: "2px solid #000" }}>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 900, textTransform: "uppercase", color: "#777", marginBottom: 4 }}>
                AMOUNT IN WORDS
              </div>
              <div style={{ fontSize: "0.875rem", fontWeight: 900, fontStyle: "italic" }}>
                {numberToWordsINR(parseFloat(order.totalPrice.amount))}
              </div>

              <div style={{ marginTop: 24, fontSize: "0.75rem", color: "#555", lineHeight: 1.5 }}>
                <strong>Payment Method:</strong> Online Prepaid (Razorpay / UPI)<br />
                <strong>Logistics Partner:</strong> VAHN Express Logistics (Delhivery / Bluedart)
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "16px", border: "1px solid #000" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.82rem" }}>
                <span>Subtotal (Excl. Tax)</span>
                <span style={{ fontWeight: 800 }}>₹{(parseFloat(order.subtotalPrice.amount) - parseFloat(order.taxPrice.amount)).toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.82rem" }}>
                <span>GST Tax (12% Incl.)</span>
                <span style={{ fontWeight: 800 }}>₹{parseFloat(order.taxPrice.amount).toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.82rem" }}>
                <span>Shipping & Handling</span>
                <span>
                  {parseFloat(order.shippingPrice.amount) === 0 ? "FREE" : `₹${order.shippingPrice.amount}`}
                </span>
              </div>
              <div style={{ borderTop: "2px solid #000", paddingTop: 10, marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: "1.1rem", fontWeight: 900 }}>
                <span>GRAND TOTAL</span>
                <span>₹{parseFloat(order.totalPrice.amount).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Official Footer */}
          <div style={{ paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: "0.75rem", color: "#555" }}>
            <div>
              <strong>Thank you for choosing VAHN!</strong><br />
              This is a computer-generated Tax Invoice and requires no physical signature.<br />
              For returns, exchanges, or order support, contact support@vahnsports.com.
            </div>
            <div style={{ textAlign: "right", borderTop: "1px solid #000", paddingTop: 8, width: 160 }}>
              <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "0.7rem" }}>AUTHORIZED SIGNATORY</div>
              <div style={{ fontSize: "0.65rem", color: "#888", marginTop: 2 }}>VAHN SPORTSWEAR INDIA</div>
            </div>
          </div>

        </div>
      </div>

      {/* Cancel Order Modal */}
      {showCancelModal && (
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
          onClick={() => setShowCancelModal(false)}
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
              Cancel Order #{order.id}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#555", lineHeight: 1.5, marginBottom: "20px" }}>
              Are you sure you want to cancel this order? Since this order has not been dispatched yet, a <strong>100% full refund</strong> of ₹{parseFloat(order.totalPrice.amount).toLocaleString()} will be automatically processed to your original payment method via Razorpay.
            </p>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "6px" }}>
                Cancellation Reason (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Changed mind, ordered wrong size, etc."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
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

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={submittingAction}
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
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={submittingAction}
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  padding: "10px 20px",
                  fontSize: "0.8rem",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  cursor: submittingAction ? "not-allowed" : "pointer",
                  borderRadius: "0px",
                }}
              >
                {submittingAction ? "Processing..." : "Confirm & Refund →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return / Replacement Request Modal (10-Day Automated Return & Exchange Window) */}
      {showReturnModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            overflowY: "auto",
          }}
          onClick={() => setShowReturnModal(false)}
        >
          <div
            style={{
              background: "#fff",
              maxWidth: 620,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "28px",
              borderRadius: "0px",
              border: "2px solid #000",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#4232d9", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  10-Day Guarantee
                </span>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 900, textTransform: "uppercase", margin: "2px 0 0" }}>
                  Return / Replacement #{order.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "#000",
                  padding: "4px 8px",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Segmented Option Selector: Exchange vs Refund */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => setReturnActionType("REPLACEMENT")}
                style={{
                  padding: "14px 12px",
                  border: returnActionType === "REPLACEMENT" ? "2px solid #4232d9" : "1px solid #ddd",
                  background: returnActionType === "REPLACEMENT" ? "#f5f3ff" : "#fff",
                  color: returnActionType === "REPLACEMENT" ? "#4232d9" : "#333",
                  fontWeight: 900,
                  fontSize: "0.82rem",
                  textTransform: "uppercase",
                  letterSpacing: "-0.01em",
                  cursor: "pointer",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  borderRadius: "0px",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  🔄 Exchange Size (Free)
                </span>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: returnActionType === "REPLACEMENT" ? "#4232d9" : "#777" }}>
                  Select available replacement size
                </span>
              </button>

              <button
                type="button"
                onClick={() => setReturnActionType("RETURN")}
                style={{
                  padding: "14px 12px",
                  border: returnActionType === "RETURN" ? "2px solid #000" : "1px solid #ddd",
                  background: returnActionType === "RETURN" ? "#fafafa" : "#fff",
                  color: returnActionType === "RETURN" ? "#000" : "#333",
                  fontWeight: 900,
                  fontSize: "0.82rem",
                  textTransform: "uppercase",
                  letterSpacing: "-0.01em",
                  cursor: "pointer",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  borderRadius: "0px",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  💰 Return for Refund
                </span>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#777" }}>
                  100% Refund via Razorpay
                </span>
              </button>
            </div>

            {/* FLOW 1: REPLACEMENT (SIZE EXCHANGE) */}
            {returnActionType === "REPLACEMENT" && (
              <div>
                <div
                  style={{
                    background: "#f9f8ff",
                    border: "1px solid #d9d6fe",
                    padding: "12px 14px",
                    marginBottom: "18px",
                    fontSize: "0.82rem",
                    color: "#333",
                    lineHeight: 1.45,
                  }}
                >
                  <strong>How Size Replacement Works:</strong> Choose your new size below. Shiprocket reverse pickup will collect the original garment. Once picked up, your replacement piece will be dispatched immediately!
                </div>

                {loadingExchangeOptions ? (
                  <div style={{ textAlign: "center", padding: "30px 0" }}>
                    <div style={{ width: 28, height: 28, border: "2px solid #4232d9", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#666", textTransform: "uppercase" }}>
                      Checking Live Size Availability...
                    </span>
                  </div>
                ) : (
                  <div>
                    {(exchangeOptions?.items || []).map((item) => (
                      <div
                        key={item.item_id}
                        style={{
                          border: "1px solid #eee",
                          padding: "14px",
                          marginBottom: "18px",
                          background: "#fff",
                        }}
                      >
                        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={item.product_title}
                              width={48}
                              height={48}
                              style={{ objectFit: "cover", border: "1px solid #ddd" }}
                            />
                          ) : (
                            <div style={{ width: 48, height: 48, background: "#f3f4f6", border: "1px solid #ddd" }} />
                          )}
                          <div>
                            <div style={{ fontWeight: 900, fontSize: "0.88rem", textTransform: "uppercase" }}>
                              {item.product_title}
                            </div>
                            <div style={{ fontSize: "0.78rem", color: "#666" }}>
                              Currently Ordered: <strong>{item.current_variant_title}</strong>
                            </div>
                          </div>
                        </div>

                        <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: 8, color: "#444" }}>
                          Select New Size for Replacement *
                        </div>

                        {/* Variants Stock Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
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
                                  padding: "10px 8px",
                                  border: isSelected ? "2px solid #4232d9" : "1px solid #ccc",
                                  background: isSelected
                                    ? "#4232d9"
                                    : isCurrent
                                    ? "#f3f4f6"
                                    : isAvailable
                                    ? "#fff"
                                    : "#fafafa",
                                  color: isSelected ? "#fff" : isAvailable ? "#000" : "#999",
                                  cursor: isAvailable ? "pointer" : "not-allowed",
                                  textAlign: "center",
                                  borderRadius: "0px",
                                  opacity: isAvailable || isSelected ? 1 : 0.6,
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: 4,
                                  transition: "all 0.1s ease",
                                }}
                              >
                                <span style={{ fontWeight: 900, fontSize: "0.85rem" }}>
                                  {v.size || v.title}
                                </span>

                                {isCurrent ? (
                                  <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#666" }}>
                                    (Current)
                                  </span>
                                ) : isAvailable ? (
                                  <span
                                    style={{
                                      fontSize: "0.65rem",
                                      fontWeight: 800,
                                      color: isSelected ? "#fff" : "#16a34a",
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    {isSelected ? "✓ Selected" : "✓ In Stock"}
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: "0.62rem",
                                      fontWeight: 700,
                                      color: "#dc2626",
                                      textTransform: "uppercase",
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
                          <div style={{ fontSize: "0.72rem", color: "#888", marginTop: 8, fontStyle: "italic" }}>
                            * Out of stock sizes cannot be selected. If your desired size is unavailable, please choose &ldquo;Return for Refund&rdquo;.
                          </div>
                        )}
                      </div>
                    ))}

                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "6px" }}>
                        Reason for Replacement *
                      </label>
                      <select
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid #ccc",
                          borderRadius: "0px",
                          fontSize: "0.85rem",
                          outline: "none",
                          background: "#fff",
                        }}
                      >
                        <option value="SIZE_TOO_SMALL">Size Too Small — Need Larger Size</option>
                        <option value="SIZE_TOO_LARGE">Size Too Large — Need Smaller Size</option>
                        <option value="FIT_ISSUE">Fit / Cut Issue</option>
                        <option value="DEFECTIVE">Defective or Damaged Piece (Need Fresh Piece)</option>
                        <option value="OTHER">Other Reason</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: "20px" }}>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "6px" }}>
                        Additional Notes (Optional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Any specific delivery instructions or notes for the fulfillment team..."
                        value={returnNotes}
                        onChange={(e) => setReturnNotes(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid #ccc",
                          borderRadius: "0px",
                          fontSize: "0.85rem",
                          outline: "none",
                          resize: "vertical",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* FLOW 2: RETURN FOR REFUND */}
            {returnActionType === "RETURN" && (
              <div>
                <p style={{ fontSize: "0.85rem", color: "#555", lineHeight: 1.5, marginBottom: "20px" }}>
                  VAHN provides a <strong>10-day hassle-free return window</strong>. Shiprocket reverse pickup will be automatically dispatched to your delivery address. Once the courier scans the package at your doorstep, a 100% refund of <strong>₹{parseFloat(order.totalPrice.amount).toLocaleString()}</strong> will be automatically credited to your payment account via Razorpay.
                </p>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "6px" }}>
                    Reason for Return *
                  </label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #ccc",
                      borderRadius: "0px",
                      fontSize: "0.85rem",
                      outline: "none",
                      background: "#fff",
                    }}
                  >
                    <option value="SIZE_FIT">Size / Fit Issue (Too small / Too large)</option>
                    <option value="DEFECTIVE">Item defective or damaged</option>
                    <option value="QUALITY">Quality not as expected</option>
                    <option value="WRONG_ITEM">Received incorrect product</option>
                    <option value="OTHER">Other Reason</option>
                  </select>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "6px" }}>
                    Additional Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe why you want to return or any specific instructions..."
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #ccc",
                      borderRadius: "0px",
                      fontSize: "0.85rem",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", borderTop: "1px solid #eee", paddingTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                disabled={submittingAction}
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
                onClick={handleRequestReturn}
                disabled={submittingAction || (returnActionType === "REPLACEMENT" && !selectedVariantId)}
                style={{
                  background: returnActionType === "REPLACEMENT" ? "#4232d9" : "#000",
                  color: "#fff",
                  border: "none",
                  padding: "12px 24px",
                  fontSize: "0.82rem",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  cursor: submittingAction || (returnActionType === "REPLACEMENT" && !selectedVariantId) ? "not-allowed" : "pointer",
                  borderRadius: "0px",
                  opacity: returnActionType === "REPLACEMENT" && !selectedVariantId ? 0.6 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {submittingAction
                  ? "Processing..."
                  : returnActionType === "REPLACEMENT"
                  ? `Confirm Size Exchange (${selectedVariantTitle || "Select Size"}) →`
                  : "Schedule Pickup & 100% Refund →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
