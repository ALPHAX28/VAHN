"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import {
  getPublicTracking,
  retryOrderPayment,
  confirmRetryPayment,
  cancelPendingOrder,
  createRazorpayOrder,
  verifyRazorpayPayment,
  createMagicCheckoutOrder,
} from "@/lib/api";
import type { TrackingInfo } from "@/lib/api/types";
import {
  AlertCircleIcon,
  ShoppingBagIcon,
  ChevronLeftIcon,
  ShieldCheckIcon,
  MapPinIcon,
  XIcon,
  CheckIcon,
} from "@/components/icons/Icons";

declare global {
  interface Window {
    Razorpay: any;
  }
}

function CheckoutFailedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token, user } = useAuth();
  const { cart, clearCart } = useCart();

  const initialReason =
    searchParams.get("reason") ||
    searchParams.get("error") ||
    "The payment session was declined, timed out, or interrupted.";
  const orderId = searchParams.get("order_id") || searchParams.get("id") || "";

  const [reason, setReason] = useState<string>(initialReason);
  const [order, setOrder] = useState<TrackingInfo | null>(null);
  const [loadingOrder, setLoadingOrder] = useState<boolean>(Boolean(orderId));
  const [retrying, setRetrying] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string>("");

  // Dynamically load Razorpay SDK
  useEffect(() => {
    if (typeof window !== "undefined" && !window.Razorpay) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Fetch order summary if order_id is present
  useEffect(() => {
    if (!orderId) return;

    let isMounted = true;
    async function fetchOrder() {
      try {
        const data = await getPublicTracking(orderId);
        if (isMounted) {
          setOrder(data);
          if (data?.cancellation_reason) {
            setReason(data.cancellation_reason);
          }
          if (data?.status === "CANCELLED") {
            setIsCancelled(true);
          }
        }
      } catch (err) {
        console.error("Could not fetch failed order summary:", err);
      } finally {
        if (isMounted) setLoadingOrder(false);
      }
    }

    fetchOrder();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  // Total amount resolution
  const cartLines = cart?.lines?.edges?.map((e: any) => e.node) || [];
  const orderTotal = order?.total_amount || 0;
  const cartTotal = cartLines.reduce((acc: number, line: any) => {
    const p = parseFloat(line?.merchandise?.price?.amount || line?.cost?.totalAmount?.amount || "0");
    return acc + p * (line?.quantity || 1);
  }, 0);
  const grandTotal = orderTotal > 0 ? orderTotal : cartTotal;

  // Items resolution
  const orderItems = order?.items || [];
  const displayItems =
    orderItems.length > 0
      ? orderItems.map((item: any) => ({
          id: item.id || item.variant_id,
          title: item.product_title || "Product",
          variantTitle: item.variant_title || "Standard",
          quantity: item.quantity || 1,
          price: item.price_amount || 0,
          image: item.image_url || "/placeholder.jpg",
        }))
      : cartLines.map((line: any) => ({
          id: line.id || line?.merchandise?.id,
          title: line?.merchandise?.product?.title || line?.merchandise?.title || "Product",
          variantTitle: line?.merchandise?.title || "Standard",
          quantity: line.quantity || 1,
          price: parseFloat(line?.merchandise?.price?.amount || "0"),
          image: line?.merchandise?.image?.url || "/placeholder.jpg",
        }));

  // Shipping address resolution
  const shippingAddr = order?.shipping_address || {};

  // ============================================================
  // RETRY PAYMENT HANDLER (with complete validations)
  // ============================================================
  async function handleRetryPayment() {
    setActionError("");

    // Validation 1: Prevent retry if already cancelled
    if (isCancelled || order?.status === "CANCELLED") {
      setActionError("This order attempt has been cancelled. Please return to your cart to checkout afresh.");
      return;
    }

    // Validation 2: Prevent retry if already captured
    if (order?.payment_status === "CAPTURED") {
      router.push(`/checkout/success?order_id=${orderId}`);
      return;
    }

    // Validation 3: Razorpay SDK availability
    if (typeof window === "undefined" || !window.Razorpay) {
      setActionError("Payment gateway is initializing. Please wait a moment and try again.");
      return;
    }

    setRetrying(true);

    try {
      if (orderId) {
        // Retry existing order on backend
        const retryData = await retryOrderPayment(orderId, token || undefined);

        const options = {
          key: retryData.key_id,
          amount: retryData.amount,
          currency: retryData.currency || "INR",
          name: "VAHN Sports",
          description: `Retry Payment for Order #${orderId}`,
          image: "https://vahn.s3.ap-south-2.amazonaws.com/logo.png",
          order_id: retryData.razorpay_order_id,
          handler: async function (response: any) {
            try {
              await confirmRetryPayment(
                orderId,
                {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                },
                token || undefined
              );
              clearCart();
              router.push(`/checkout/success?order_id=${orderId}`);
            } catch (confErr: any) {
              setActionError(confErr?.message || "Payment completed, but order confirmation timed out. Contact support.");
              setRetrying(false);
            }
          },
          prefill: {
            name: retryData.customer_name || user?.full_name || "",
            email: retryData.customer_email || user?.email || "",
            contact: retryData.customer_phone || user?.phone || "",
          },
          theme: {
            color: "#4232d9",
          },
          modal: {
            ondismiss: function () {
              setRetrying(false);
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", function (failRes: any) {
          const newDesc = failRes?.error?.description || "Payment attempt declined.";
          setReason(newDesc);
          setActionError(`Payment failed: ${newDesc}`);
          setRetrying(false);
        });
        rzp.open();
      } else {
        // If no order_id was created yet, return user to checkout to initiate fresh
        router.push("/checkout");
      }
    } catch (err: any) {
      setActionError(err?.message || "Could not re-initialize payment. Please check your network or try again.");
      setRetrying(false);
    }
  }

  // ============================================================
  // CANCEL ORDER HANDLER (with complete validations)
  // ============================================================
  async function handleConfirmCancel() {
    setActionError("");
    setCancelling(true);

    try {
      if (orderId) {
        await cancelPendingOrder(orderId, "Customer cancelled after payment failure", token || undefined);
      }
      setIsCancelled(true);
      setShowCancelModal(false);
    } catch (err: any) {
      setActionError(err?.message || "Could not cancel order. Please refresh and try again.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: "960px",
        margin: "40px auto 100px",
        padding: "0 20px",
        fontFamily: "var(--font-ui, sans-serif)",
      }}
    >
      {/* Top Breadcrumb */}
      <div style={{ marginBottom: "20px" }}>
        <Link
          href="/cart"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "#666",
            fontSize: "0.8rem",
            fontWeight: 700,
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          <ChevronLeftIcon size={14} color="#666" />
          <span>Return to Cart</span>
        </Link>
      </div>

      {/* Main Alert Banner */}
      <div
        style={{
          background: isCancelled ? "#f8fafc" : "#fff",
          border: isCancelled ? "1px solid #e2e8f0" : "1px solid #fee2e2",
          borderLeft: isCancelled ? "6px solid #64748b" : "6px solid #ef4444",
          padding: "28px 32px",
          marginBottom: "32px",
          boxShadow: isCancelled ? "none" : "0 4px 20px rgba(239, 68, 68, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "20px", flexWrap: "wrap" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: isCancelled ? "#f1f5f9" : "#fef2f2",
              border: isCancelled ? "2px solid #cbd5e1" : "2px solid #fca5a5",
              color: isCancelled ? "#64748b" : "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {isCancelled ? <XIcon size={28} color="#64748b" /> : <AlertCircleIcon size={28} color="#dc2626" />}
          </div>

          <div style={{ flex: 1, minWidth: "260px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "6px" }}>
              <span
                style={{
                  display: "inline-block",
                  background: isCancelled ? "#f1f5f9" : "#fef2f2",
                  color: isCancelled ? "#475569" : "#991b1b",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "3px 10px",
                  border: isCancelled ? "1px solid #cbd5e1" : "1px solid #fecaca",
                }}
              >
                {isCancelled ? "Order Cancelled" : "Transaction Incomplete • Cart Preserved"}
              </span>

              {orderId && (
                <span style={{ fontSize: "0.78rem", color: "#888", fontWeight: 700 }}>
                  Order ID: <strong style={{ color: "#000" }}>{orderId}</strong>
                </span>
              )}
            </div>

            <h1
              style={{
                fontSize: "clamp(1.4rem, 3vw, 1.85rem)",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "-0.03em",
                margin: "0 0 8px",
                color: "#000",
              }}
            >
              {isCancelled ? "Order Cancelled" : "Payment Not Completed"}
            </h1>

            <p style={{ margin: "0 0 12px", color: "#555", fontSize: "0.88rem", lineHeight: 1.5 }}>
              {isCancelled
                ? "You cancelled this order attempt. No charges were made to your account, and your selected items remain safely in your cart."
                : "Your payment could not be processed. No funds were deducted from your bank or card account. You can retry with the same or different payment method, or cancel anytime."}
            </p>

            {/* Failure Reason Box */}
            {!isCancelled && reason && (
              <div
                style={{
                  background: "#fff5f5",
                  border: "1px solid #fed7d7",
                  padding: "10px 14px",
                  fontSize: "0.82rem",
                  color: "#9b2c2c",
                  marginTop: "8px",
                }}
              >
                <strong style={{ color: "#742a2a", marginRight: "6px" }}>Gateway Notice:</strong>
                {reason}
              </div>
            )}

            {/* Action Error Message */}
            {actionError && (
              <div
                style={{
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  color: "#e11d48",
                  padding: "10px 14px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  marginTop: "8px",
                }}
              >
                {actionError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Left Details, Right Payment & Actions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Attempted Items & Shipping Destination */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Items In Attempted Order */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              padding: "24px",
            }}
          >
            <h2
              style={{
                fontSize: "0.85rem",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                margin: "0 0 16px",
                color: "#000",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <ShoppingBagIcon size={16} color="#000" />
              <span>Items In This Order ({displayItems.length})</span>
            </h2>

            {displayItems.length === 0 ? (
              <p style={{ color: "#888", fontSize: "0.85rem", margin: 0 }}>No items recorded.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {displayItems.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      paddingBottom: idx !== displayItems.length - 1 ? "14px" : 0,
                      borderBottom: idx !== displayItems.length - 1 ? "1px solid #f3f4f6" : "none",
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: "56px",
                        height: "56px",
                        background: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        flexShrink: 0,
                        overflow: "hidden",
                      }}
                    >
                      {item.image && item.image !== "/placeholder.jpg" ? (
                        <Image src={item.image} alt={item.title} fill sizes="56px" style={{ objectFit: "cover" }} />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#999",
                            fontSize: "0.65rem",
                            fontWeight: 700,
                          }}
                        >
                          VAHN
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4
                        style={{
                          fontSize: "0.88rem",
                          fontWeight: 800,
                          margin: "0 0 2px",
                          color: "#000",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.title}
                      </h4>
                      <p style={{ fontSize: "0.75rem", color: "#666", margin: 0 }}>
                        {item.variantTitle} • Qty: {item.quantity}
                      </p>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "#000" }}>
                        ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shipping Destination */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              padding: "24px",
            }}
          >
            <h2
              style={{
                fontSize: "0.85rem",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                margin: "0 0 16px",
                color: "#000",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <MapPinIcon size={16} color="#000" />
              <span>Shipping Destination</span>
            </h2>

            {shippingAddr && shippingAddr.name ? (
              <div style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "#333" }}>
                <strong style={{ color: "#000", display: "block", fontSize: "0.92rem" }}>
                  {shippingAddr.name}
                </strong>
                <div>{shippingAddr.address}</div>
                <div>
                  {shippingAddr.city}, {shippingAddr.state} {shippingAddr.postalCode}
                </div>
                {shippingAddr.phone && (
                  <div style={{ marginTop: "4px", color: "#666" }}>
                    Contact: <strong>{shippingAddr.phone}</strong>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ fontSize: "0.85rem", color: "#666", margin: 0 }}>
                Standard express delivery address configured during checkout.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Payment Status & Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Payment & Transaction Status */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              padding: "24px",
            }}
          >
            <h2
              style={{
                fontSize: "0.85rem",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                margin: "0 0 16px",
                color: "#000",
              }}
            >
              Payment & Status Summary
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#666" }}>Payment Gateway</span>
                <span style={{ fontWeight: 800, color: "#000" }}>Razorpay Prepaid</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#666" }}>Payment Status</span>
                <span
                  style={{
                    background: isCancelled ? "#f1f5f9" : "#fee2e2",
                    color: isCancelled ? "#475569" : "#dc2626",
                    fontWeight: 900,
                    fontSize: "0.75rem",
                    padding: "2px 8px",
                    textTransform: "uppercase",
                    border: isCancelled ? "1px solid #cbd5e1" : "1px solid #fecaca",
                  }}
                >
                  {isCancelled ? "CANCELLED" : "FAILED / UNPAID"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#666" }}>Fulfillment Status</span>
                <span
                  style={{
                    background: isCancelled ? "#f1f5f9" : "#fffbeb",
                    color: isCancelled ? "#64748b" : "#b45309",
                    fontWeight: 800,
                    fontSize: "0.75rem",
                    padding: "2px 8px",
                    textTransform: "uppercase",
                    border: isCancelled ? "1px solid #e2e8f0" : "1px solid #fde68a",
                  }}
                >
                  {isCancelled ? "CANCELLED" : "ON HOLD (Awaiting Payment)"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#666" }}>Shipping Carrier</span>
                <span style={{ fontWeight: 700, color: "#000" }}>Blue Dart Express (Free)</span>
              </div>

              <div
                style={{
                  borderTop: "1px solid #e5e7eb",
                  marginTop: "6px",
                  paddingTop: "14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span style={{ fontSize: "0.92rem", fontWeight: 800, textTransform: "uppercase", color: "#000" }}>
                  Total Due
                </span>
                <span style={{ fontSize: "1.35rem", fontWeight: 900, color: isCancelled ? "#64748b" : "#dc2626" }}>
                  ₹{grandTotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Reassurance Badge */}
            <div
              style={{
                marginTop: "16px",
                padding: "10px 12px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.78rem",
                color: "#166534",
              }}
            >
              <ShieldCheckIcon size={16} color="#16a34a" />
              <span>Zero Risk: Cart preserved & no unauthorized charge.</span>
            </div>
          </div>

          {/* Action Buttons with Proper Validations */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {!isCancelled ? (
              <>
                {/* Retry Payment Button */}
                <button
                  type="button"
                  onClick={handleRetryPayment}
                  disabled={retrying}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "16px",
                    background: retrying ? "#666" : "#000",
                    color: "#fff",
                    border: "none",
                    fontWeight: 900,
                    fontSize: "0.92rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    cursor: retrying ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  }}
                >
                  <span>{retrying ? "Connecting Gateway..." : `Pay ₹${grandTotal.toLocaleString("en-IN")} Now →`}</span>
                </button>

                {/* Cancel Order Button */}
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  disabled={retrying || cancelling}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "14px",
                    background: "#fff",
                    border: "1px solid #dc2626",
                    color: "#dc2626",
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                    cursor: "pointer",
                  }}
                >
                  <XIcon size={14} color="#dc2626" />
                  <span>Cancel This Order</span>
                </button>
              </>
            ) : (
              <Link
                href="/cart"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "16px",
                  background: "#000",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 900,
                  fontSize: "0.92rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
              >
                <ShoppingBagIcon size={16} color="#fff" />
                <span>Return to Cart & Review Items</span>
              </Link>
            )}

            {/* Review Cart Button */}
            <Link
              href="/cart"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                width: "100%",
                padding: "14px",
                background: "#fff",
                border: "1px solid #000",
                color: "#000",
                textDecoration: "none",
                fontWeight: 800,
                fontSize: "0.82rem",
                textTransform: "uppercase",
                letterSpacing: "0.02em",
              }}
            >
              <ShoppingBagIcon size={14} color="#000" />
              <span>Review Cart ({cartLines.length})</span>
            </Link>

            {/* Need Help Link */}
            <div style={{ textAlign: "center", marginTop: "6px" }}>
              <Link
                href="/contact"
                style={{
                  fontSize: "0.8rem",
                  color: "#666",
                  textDecoration: "underline",
                }}
              >
                Need help? Contact VAHN Athlete Support
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Order Cancellation */}
      {showCancelModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#fff",
              maxWidth: "460px",
              width: "100%",
              padding: "32px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#fee2e2",
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <AlertCircleIcon size={20} color="#dc2626" />
              </div>
              <h3
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                Cancel This Order?
              </h3>
            </div>

            <p style={{ fontSize: "0.88rem", color: "#555", lineHeight: 1.5, margin: "0 0 20px" }}>
              Are you sure you want to cancel order <strong>{orderId || "attempt"}</strong>? Your cart items will remain safely stored in your bag so you can checkout whenever you are ready.
            </p>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                style={{
                  padding: "12px 18px",
                  background: "#fff",
                  border: "1px solid #ccc",
                  color: "#333",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                No, Keep Order
              </button>

              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                style={{
                  padding: "12px 20px",
                  background: "#dc2626",
                  border: "none",
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: "0.82rem",
                  textTransform: "uppercase",
                  cursor: cancelling ? "not-allowed" : "pointer",
                }}
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutFailedPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: "80px 20px", fontWeight: 800 }}>Loading Payment Details...</div>}>
      <CheckoutFailedContent />
    </Suspense>
  );
}
