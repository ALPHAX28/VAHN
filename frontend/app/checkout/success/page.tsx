"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getPublicTracking } from "@/lib/api";
import type { TrackingInfo } from "@/lib/api/types";
import { CheckIcon, TruckIcon, ShoppingBagIcon, AlertCircleIcon } from "@/components/icons/Icons";

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("order_id") || searchParams.get("id") || "";

  const [order, setOrder] = useState<TrackingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Restore scroll in case any prior modal locked it
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = "auto";
      document.body.style.pointerEvents = "auto";
      document.documentElement.style.overflow = "auto";
      document.querySelectorAll(".razorpay-container").forEach((el) => el.remove());
    }
  }, []);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    async function fetchSummary() {
      try {
        const data = await getPublicTracking(orderId);
        // Safety guard: If this order failed, is unpaid, or was cancelled, redirect to /checkout/failed
        if (
          data?.payment_status === "FAILED" ||
          data?.status === "CANCELLED" ||
          data?.status === "PENDING_PAYMENT"
        ) {
          router.replace(
            `/checkout/failed?order_id=${data.order_id || orderId}&reason=${encodeURIComponent(
              data.cancellation_reason || "Payment was not completed."
            )}`
          );
          return;
        }
        setOrder(data);
      } catch (e) {
        console.error("Could not fetch order summary:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, [orderId, router]);

  function handleCopyOrderId() {
    if (!orderId) return;
    navigator.clipboard.writeText(orderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!orderId && !loading) {
    return (
      <div
        style={{
          maxWidth: "540px",
          margin: "80px auto",
          padding: "36px 24px",
          textAlign: "center",
          background: "#fff",
          border: "1px solid #e5e7eb",
        }}
      >
        <AlertCircleIcon size={40} color="#dc2626" />
        <h1 style={{ fontSize: "1.25rem", fontWeight: 900, textTransform: "uppercase", marginTop: "12px" }}>
          No Order Found
        </h1>
        <p style={{ color: "#666", fontSize: "0.85rem", marginTop: "6px" }}>
          We could not locate an active checkout session.
        </p>
        <Link
          href="/products"
          style={{
            display: "inline-block",
            marginTop: "16px",
            padding: "12px 24px",
            background: "#000",
            color: "#fff",
            fontWeight: 800,
            fontSize: "0.85rem",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Explore Gear
        </Link>
      </div>
    );
  }

  const items = order?.items || [];
  const grandTotal = order?.total_amount || 0;

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
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
          padding: "36px 28px",
          textAlign: "center",
        }}
      >
        {/* Green Checkmark */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "#ecfdf5",
            border: "2px solid #10b981",
            color: "#10b981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <CheckIcon size={28} color="#10b981" />
        </div>

        {/* Status Badge */}
        <span
          style={{
            display: "inline-block",
            background: "#f0fdf4",
            color: "#166534",
            fontSize: "0.72rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: "3px 10px",
            border: "1px solid #bbf7d0",
            marginBottom: "12px",
          }}
        >
          Payment Verified • Order Confirmed
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
          Thank You For Your Order!
        </h1>

        <p style={{ fontSize: "0.88rem", color: "#666", margin: "0 0 16px", lineHeight: 1.5 }}>
          Your payment was received and your order is confirmed. Our team has begun preparing your gear for dispatch.
        </p>

        {/* Minimal Order ID Bar */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            background: "#f9fafb",
            border: "1px dashed #d1d5db",
            padding: "8px 16px",
            marginBottom: "24px",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase", fontWeight: 700 }}>
            Order ID:
          </span>
          <strong style={{ fontSize: "1rem", letterSpacing: "0.04em", color: "#000" }}>{orderId}</strong>
          <button
            onClick={handleCopyOrderId}
            style={{
              background: "none",
              border: "none",
              color: "#2563eb",
              fontSize: "0.72rem",
              fontWeight: 800,
              cursor: "pointer",
              padding: "2px 4px",
            }}
          >
            {copied ? "COPIED! ✓" : "COPY"}
          </button>
        </div>

        {/* Compact Item Summary */}
        {items.length > 0 && (
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
              {items.map((item: any, idx: number) => {
                const imgUrl = item.image_url || item.image || item.imageUrl || "";
                return (
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
                      {imgUrl ? (
                        <Image
                          src={imgUrl}
                          alt={item.product_title || "Product"}
                          fill
                          sizes="48px"
                          style={{ objectFit: "cover" }}
                        />
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
                        {item.product_title || "Product"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#666" }}>
                        {item.variant_title || "Standard"} • Qty: {item.quantity}
                      </div>
                    </div>

                    <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#000" }}>
                      ₹{(item.price_amount * item.quantity).toLocaleString("en-IN")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Paid Row */}
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
                Total Paid (Razorpay)
              </span>
              <span style={{ fontSize: "1.2rem", fontWeight: 900, color: "#16a34a" }}>
                ₹{grandTotal.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        )}

        {/* Minimal Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Link
            href={`/track?q=${order?.awb_code || orderId}`}
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
            <TruckIcon size={16} color="#fff" />
            <span>Track Order Live →</span>
          </Link>

          <Link
            href="/products"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "13px",
              background: "#fff",
              border: "1px solid #d1d5db",
              color: "#000",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: "0.82rem",
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            <ShoppingBagIcon size={14} color="#000" />
            <span>Continue Shopping</span>
          </Link>

          <div style={{ marginTop: "6px" }}>
            <Link
              href="/account/orders"
              style={{
                fontSize: "0.78rem",
                color: "#666",
                textDecoration: "underline",
              }}
            >
              View Order in My Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: "80px 20px" }}>Loading Order Summary...</div>}>
      <OrderSuccessContent />
    </Suspense>
  );
}
