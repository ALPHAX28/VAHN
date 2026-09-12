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
} from "@/lib/api";
import type { TrackingInfo } from "@/lib/api/types";
import { AlertCircleIcon, ShoppingBagIcon, XIcon } from "@/components/icons/Icons";

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
    "The payment was declined by your bank or timed out.";
  const orderId = searchParams.get("order_id") || searchParams.get("id") || "";

  const [reason, setReason] = useState<string>(initialReason);
  const [order, setOrder] = useState<TrackingInfo | null>(null);
  const [retrying, setRetrying] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string>("");

  // Clean up any lingering Razorpay lock and guarantee scrolling
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = "auto";
      document.body.style.pointerEvents = "auto";
      document.documentElement.style.overflow = "auto";
      document.querySelectorAll(".razorpay-container").forEach((el) => el.remove());
    }
  }, []);

  // Dynamically load correct Razorpay SDK:
  // - Logged-in users → standard checkout.js (no Magic Checkout)
  // - Guest users → magic-checkout.js (Magic Checkout / one-click)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isGuest = !user;
    const targetSrc = isGuest
      ? "https://checkout.razorpay.com/v1/magic-checkout.js"
      : "https://checkout.razorpay.com/v1/checkout.js";

    const existingScript = document.getElementById("rzp-retry-script") as HTMLScriptElement | null;

    if (existingScript && existingScript.src === targetSrc && window.Razorpay) {
      return; // correct SDK already loaded
    }

    if (existingScript) {
      existingScript.remove();
      try { delete (window as any).Razorpay; } catch { (window as any).Razorpay = undefined; }
    }

    const script = document.createElement("script");
    script.id = "rzp-retry-script";
    script.src = targetSrc;
    script.async = true;
    script.onerror = () => {
      // Fallback to standard checkout.js
      const fallback = document.createElement("script");
      fallback.id = "rzp-retry-script";
      fallback.src = "https://checkout.razorpay.com/v1/checkout.js";
      fallback.async = true;
      document.body.appendChild(fallback);
    };
    document.body.appendChild(script);
  }, [user]);

  // Fetch order summary if orderId is present
  useEffect(() => {
    if (!orderId) return;

    let isMounted = true;
    async function fetchOrder() {
      try {
        const data = await getPublicTracking(orderId);
        if (isMounted && data) {
          setOrder(data);
          if (data.cancellation_reason) {
            setReason(data.cancellation_reason);
          }
          if (data.status === "CANCELLED") {
            setIsCancelled(true);
          }
        }
      } catch (err) {
        console.error("Could not fetch failed order summary:", err);
      }
    }

    fetchOrder();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  // Cart lines resolution
  const cartLines = cart?.lines?.edges?.map((e: any) => e.node) || [];
  const orderItems = order?.items || [];

  // Items resolution with proper image extraction
  const displayItems =
    orderItems.length > 0
      ? orderItems.map((item: any) => ({
          id: item.id || item.variant_id,
          title: item.product_title || "Product",
          variantTitle: item.variant_title || "Standard",
          quantity: item.quantity || 1,
          price: item.price_amount || 0,
          image: item.image_url || "",
        }))
      : cartLines.map((line: any) => ({
          id: line.id || line?.merchandise?.id,
          title: line?.merchandise?.product?.title || line?.merchandise?.title || "Product",
          variantTitle: line?.merchandise?.title || "Standard",
          quantity: line.quantity || 1,
          price: parseFloat(line?.merchandise?.price?.amount || "0"),
          image:
            line?.merchandise?.product?.featuredImage?.url ||
            line?.merchandise?.image?.url ||
            line?.merchandise?.product?.images?.[0]?.url ||
            "",
        }));

  // Pricing calculation
  const itemsSubtotal = displayItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orderTotal = order?.total_amount || 0;
  const shippingFee = orderTotal > 0 ? Math.max(0, orderTotal - itemsSubtotal) : itemsSubtotal >= 1999 || itemsSubtotal === 0 ? 0 : 99;
  const grandTotal = orderTotal > 0 ? orderTotal : itemsSubtotal + shippingFee;

  // ============================================================
  // RETRY PAYMENT HANDLER (with complete validations)
  // ============================================================
  async function handleRetryPayment() {
    setActionError("");

    if (isCancelled || order?.status === "CANCELLED") {
      setActionError("This order has been cancelled. Return to your cart to checkout again.");
      return;
    }

    if (order?.payment_status === "CAPTURED") {
      router.push(`/checkout/success?order_id=${orderId}`);
      return;
    }

    if (typeof window === "undefined" || !window.Razorpay) {
      setActionError("Payment gateway is initializing. Please retry in a few moments.");
      return;
    }

    setRetrying(true);

    try {
      if (orderId) {
        const retryData = await retryOrderPayment(orderId, token || undefined);

        // Guest users get Magic Checkout (one_click_checkout), logged-in users get standard checkout
        const isGuest = !user;

        const options: any = {
          key: retryData.key_id,
          amount: retryData.amount,
          currency: retryData.currency || "INR",
          name: "VAHN Sports",
          description: `Retry Payment for Order #${orderId}`,
          image: "https://vahn.s3.ap-south-2.amazonaws.com/logo.png",
          order_id: retryData.razorpay_order_id,
          // Magic Checkout only for guest users
          one_click_checkout: isGuest,
          show_coupons: isGuest,
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
              setActionError(confErr?.message || "Payment verified, but confirmation timed out. Contact support.");
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
              if (typeof document !== "undefined") {
                document.body.style.overflow = "auto";
                document.documentElement.style.overflow = "auto";
                document.querySelectorAll(".razorpay-container").forEach((el) => el.remove());
              }
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", function (failRes: any) {
          try {
            rzp.close();
          } catch {}
          if (typeof document !== "undefined") {
            document.body.style.overflow = "auto";
            document.documentElement.style.overflow = "auto";
            document.querySelectorAll(".razorpay-container").forEach((el) => el.remove());
          }
          const newDesc = failRes?.error?.description || "Payment attempt declined.";
          setReason(newDesc);
          setActionError(`Payment declined: ${newDesc}`);
          setRetrying(false);
        });
        rzp.open();
      } else {
        router.push("/checkout");
      }
    } catch (err: any) {
      setActionError(err?.message || "Could not re-initiate payment. Please try again.");
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
      router.push("/cart");
    } catch (err: any) {
      setActionError(err?.message || "Could not cancel order. Please refresh and try again.");
      setCancelling(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: "540px",
        margin: "48px auto 80px",
        padding: "0 20px",
        fontFamily: "var(--font-ui, sans-serif)",
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid #fee2e2",
          boxShadow: "0 4px 20px rgba(220, 38, 38, 0.05)",
          padding: "36px 28px",
          textAlign: "center",
        }}
      >
        {/* Red Alert Icon */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "#fef2f2",
            border: "2px solid #ef4444",
            color: "#dc2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <AlertCircleIcon size={28} color="#dc2626" />
        </div>

        {/* Status Badge */}
        <span
          style={{
            display: "inline-block",
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: "0.72rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: "3px 10px",
            border: "1px solid #fecaca",
            marginBottom: "12px",
          }}
        >
          {isCancelled ? "Order Cancelled" : "Payment Not Completed"}
        </span>

        <h1
          style={{
            fontSize: "1.6rem",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-0.03em",
            margin: "0 0 8px",
            color: "#000",
          }}
        >
          {isCancelled ? "Order Cancelled" : "Transaction Incomplete"}
        </h1>

        <p style={{ fontSize: "0.88rem", color: "#666", margin: "0 0 16px", lineHeight: 1.5 }}>
          {isCancelled
            ? "Your order attempt has been cancelled. Your cart items are preserved."
            : "No money was deducted from your account. Your selected gear remains in your cart."}
        </p>

        {/* Failure Reason */}
        {!isCancelled && reason && (
          <div
            style={{
              background: "#fafafa",
              border: "1px solid #f0f0f0",
              borderLeft: "3px solid #ef4444",
              padding: "10px 14px",
              fontSize: "0.82rem",
              color: "#555",
              textAlign: "left",
              marginBottom: "20px",
            }}
          >
            <strong style={{ color: "#000", display: "block", marginBottom: "2px" }}>Reason:</strong>
            {reason}
          </div>
        )}

        {/* Action Error */}
        {actionError && (
          <div
            style={{
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              color: "#e11d48",
              padding: "10px 14px",
              fontSize: "0.82rem",
              fontWeight: 700,
              marginBottom: "16px",
              textAlign: "left",
            }}
          >
            {actionError}
          </div>
        )}

        {/* Order Items & Amount Summary (Minimal) */}
        {displayItems.length > 0 && (
          <div
            style={{
              borderTop: "1px solid #f0f0f0",
              borderBottom: "1px solid #f0f0f0",
              padding: "16px 0",
              marginBottom: "24px",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {displayItems.map((item, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      position: "relative",
                      width: "48px",
                      height: "48px",
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      flexShrink: 0,
                      overflow: "hidden",
                    }}
                  >
                    {item.image ? (
                      <Image src={item.image} alt={item.title} fill sizes="48px" style={{ objectFit: "cover" }} />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.6rem",
                          fontWeight: 800,
                          color: "#999",
                        }}
                      >
                        VAHN
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: "0.85rem",
                        color: "#000",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.title}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>
                      {item.variantTitle} • Qty: {item.quantity}
                    </div>
                  </div>

                  <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#000" }}>
                    ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </div>

            {/* Total Due Row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginTop: "14px",
                paddingTop: "12px",
                borderTop: "1px dashed #e5e7eb",
              }}
            >
              <span style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", color: "#555" }}>
                Total Due {shippingFee > 0 ? `(incl. ₹${shippingFee} shipping)` : "(Free Shipping)"}
              </span>
              <span style={{ fontSize: "1.2rem", fontWeight: 900, color: "#000" }}>
                ₹{grandTotal.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        )}

        {/* Minimal Action Buttons: Retry & Cancel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {!isCancelled ? (
            <>
              <button
                type="button"
                onClick={handleRetryPayment}
                disabled={retrying}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "15px",
                  background: retrying ? "#555" : "#000",
                  color: "#fff",
                  border: "none",
                  fontWeight: 900,
                  fontSize: "0.88rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  cursor: retrying ? "not-allowed" : "pointer",
                }}
              >
                <span>{retrying ? "Connecting Gateway..." : `Retry Payment (₹${grandTotal.toLocaleString("en-IN")}) →`}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                disabled={retrying || cancelling}
                style={{
                  padding: "13px",
                  background: "#fff",
                  border: "1px solid #d1d5db",
                  color: "#4b5563",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  cursor: "pointer",
                }}
              >
                Cancel Order & Return to Cart
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
                padding: "15px",
                background: "#000",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 900,
                fontSize: "0.88rem",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              <ShoppingBagIcon size={16} color="#fff" />
              <span>Return to Cart</span>
            </Link>
          )}

          <div style={{ marginTop: "8px" }}>
            <Link
              href="/contact"
              style={{
                fontSize: "0.78rem",
                color: "#888",
                textDecoration: "underline",
              }}
            >
              Need help? Contact VAHN Athlete Support
            </Link>
          </div>
        </div>
      </div>

      {/* Simple Cancel Confirmation Modal */}
      {showCancelModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
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
              maxWidth: "400px",
              width: "100%",
              padding: "24px",
              textAlign: "center",
            }}
          >
            <h3 style={{ fontSize: "1.05rem", fontWeight: 900, textTransform: "uppercase", margin: "0 0 8px" }}>
              Cancel This Order Attempt?
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#666", margin: "0 0 20px", lineHeight: 1.4 }}>
              Your selected items will remain in your cart so you can checkout whenever you are ready.
            </p>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                style={{
                  flex: 1,
                  padding: "11px",
                  background: "#fff",
                  border: "1px solid #ccc",
                  fontWeight: 800,
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                style={{
                  flex: 1,
                  padding: "11px",
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  fontWeight: 900,
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                  cursor: cancelling ? "not-allowed" : "pointer",
                }}
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel"}
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
    <Suspense fallback={<div style={{ textAlign: "center", padding: "80px 20px" }}>Loading...</div>}>
      <CheckoutFailedContent />
    </Suspense>
  );
}
