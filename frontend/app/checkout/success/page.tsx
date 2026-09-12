"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getPublicTracking } from "@/lib/api";
import type { TrackingInfo } from "@/lib/api/types";
import {
  CheckIcon,
  PackageIcon,
  TruckIcon,
  SparklesIcon,
  MapPinIcon,
  ShieldCheckIcon,
  PrinterIcon,
  ChevronLeftIcon,
  AlertCircleIcon,
} from "@/components/icons/Icons";

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("order_id") || searchParams.get("id") || "";

  const [order, setOrder] = useState<TrackingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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
  }, [orderId]);

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
          maxWidth: "680px",
          margin: "80px auto",
          padding: "40px 24px",
          textAlign: "center",
          background: "#fff",
          border: "1px solid #e5e7eb",
        }}
      >
        <AlertCircleIcon size={48} color="#dc2626" />
        <h1 style={{ fontSize: "1.4rem", fontWeight: 900, textTransform: "uppercase", marginTop: "16px" }}>
          No Order Specified
        </h1>
        <p style={{ color: "#666", fontSize: "0.9rem", marginTop: "8px" }}>
          We could not locate an active checkout session. If you recently placed an order, you can track it with your Order ID or view your orders history.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px" }}>
          <Link
            href="/account/orders"
            style={{
              padding: "12px 24px",
              background: "#000",
              color: "#fff",
              fontWeight: 800,
              fontSize: "0.85rem",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            My Orders
          </Link>
          <Link
            href="/track"
            style={{
              padding: "12px 24px",
              border: "1px solid #000",
              color: "#000",
              fontWeight: 800,
              fontSize: "0.85rem",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            Track Order
          </Link>
        </div>
      </div>
    );
  }

  const shippingAddr = order?.shipping_address || {};
  const items = order?.items || [];
  const grandTotal = order?.total_amount || 0;

  return (
    <div
      style={{
        maxWidth: "960px",
        margin: "40px auto 100px",
        padding: "0 20px",
        fontFamily: "var(--font-ui, sans-serif)",
      }}
    >
      {/* Top Confirmed Hero */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e0e0e0",
          padding: "40px 28px",
          textAlign: "center",
          marginBottom: "32px",
          position: "relative",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        }}
      >
        {/* Animated Green Badge */}
        <div
          style={{
            width: "68px",
            height: "68px",
            borderRadius: "50%",
            background: "#ecfdf5",
            border: "3px solid #10b981",
            color: "#10b981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <CheckIcon size={36} color="#10b981" />
        </div>

        <span
          style={{
            display: "inline-block",
            background: "#f0fdf4",
            color: "#166534",
            fontSize: "0.75rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "4px 12px",
            border: "1px solid #bbf7d0",
            marginBottom: "12px",
          }}
        >
          Payment Captured • Order Confirmed
        </span>

        <h1
          style={{
            fontSize: "clamp(1.8rem, 4vw, 2.4rem)",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-0.03em",
            margin: "0 0 10px",
            color: "#000",
          }}
        >
          Thank You For Your Order!
        </h1>

        <p
          style={{
            fontSize: "0.95rem",
            color: "#555",
            maxWidth: "580px",
            margin: "0 auto 24px",
            lineHeight: 1.5,
          }}
        >
          We have received your payment. Our fulfillment team has verified your order and begun preparing your gear for priority dispatch.
        </p>

        {/* Order Reference Box */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
            background: "#f9fafb",
            border: "1px dashed #d1d5db",
            padding: "10px 18px",
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "#666", textTransform: "uppercase", fontWeight: 700 }}>
            Order ID:
          </span>
          <strong style={{ fontSize: "1.1rem", letterSpacing: "0.04em", color: "#000" }}>
            {orderId}
          </strong>
          <button
            onClick={handleCopyOrderId}
            style={{
              background: "none",
              border: "none",
              color: "#2563eb",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              padding: "2px 6px",
            }}
          >
            {copied ? "COPIED! ✓" : "COPY"}
          </button>
        </div>

        {/* Milestone Steps */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "16px",
            marginTop: "36px",
            paddingTop: "28px",
            borderTop: "1px solid #f3f4f6",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "#10b981",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CheckIcon size={12} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.8rem", textTransform: "uppercase" }}>1. Placed</div>
              <div style={{ fontSize: "0.72rem", color: "#10b981", fontWeight: 700 }}>Confirmed</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "#000",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <PackageIcon size={12} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.8rem", textTransform: "uppercase" }}>2. Processing</div>
              <div style={{ fontSize: "0.72rem", color: "#2563eb", fontWeight: 700 }}>In Fulfillment</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", opacity: 0.6 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "#e5e7eb",
                color: "#6b7280",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <TruckIcon size={12} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.8rem", textTransform: "uppercase" }}>3. In Transit</div>
              <div style={{ fontSize: "0.72rem", color: "#888" }}>Blue Dart Express</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", opacity: 0.6 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "#e5e7eb",
                color: "#6b7280",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <SparklesIcon size={12} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.8rem", textTransform: "uppercase" }}>4. Delivered</div>
              <div style={{ fontSize: "0.72rem", color: "#888" }}>Est. 2-4 Days</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Details Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "32px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Shipment Items & Delivery Address */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Items Card */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e0e0e0",
              padding: "24px",
            }}
          >
            <h2
              style={{
                fontSize: "0.95rem",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
                margin: "0 0 18px",
                paddingBottom: "12px",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              Items in This Order ({items.length || "Active"})
            </h2>

            {items.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {items.map((item: any, idx: number) => (
                  <div
                    key={item.id || idx}
                    style={{
                      display: "flex",
                      gap: "14px",
                      alignItems: "center",
                      paddingBottom: idx !== items.length - 1 ? "14px" : "0",
                      borderBottom: idx !== items.length - 1 ? "1px solid #f9fafb" : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        background: "#f3f4f6",
                        flexShrink: 0,
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.product_title || "Product"}
                          fill
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
                            color: "#999",
                          }}
                        >
                          <PackageIcon size={24} />
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>{item.product_title}</div>
                      <div style={{ fontSize: "0.78rem", color: "#666", marginTop: "2px" }}>
                        Variant: {item.variant_title} • Qty: {item.quantity}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>
                      ₹{((item.price_amount || 0) * (item.quantity || 1)).toLocaleString("en-IN")}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "#666", fontSize: "0.85rem" }}>
                Order confirmed. Your package includes verified VAHN items.
              </div>
            )}
          </div>

          {/* Shipping Address Card */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e0e0e0",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <MapPinIcon size={18} color="#000" />
              <h2
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                Shipping Destination
              </h2>
            </div>

            <div style={{ fontSize: "0.88rem", color: "#333", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 800, color: "#000" }}>
                {shippingAddr.name || "Recipient"}
              </div>
              <div>{shippingAddr.address || shippingAddr.street_address || "Standard Delivery"}</div>
              <div>
                {[shippingAddr.city, shippingAddr.state, shippingAddr.postalCode || shippingAddr.pincode]
                  .filter(Boolean)
                  .join(", ")}
              </div>
              {shippingAddr.phone && (
                <div style={{ marginTop: "6px", color: "#666", fontSize: "0.82rem" }}>
                  Contact: {shippingAddr.phone}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Payment Summary & Next Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Summary Card */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e0e0e0",
              padding: "24px",
            }}
          >
            <h2
              style={{
                fontSize: "0.95rem",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
                margin: "0 0 18px",
                paddingBottom: "12px",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              Payment & Receipt
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.88rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#666" }}>
                <span>Payment Method</span>
                <span style={{ fontWeight: 700, color: "#000" }}>Razorpay Prepaid</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#666" }}>
                <span>Delivery Carrier</span>
                <span style={{ fontWeight: 700, color: "#000" }}>Blue Dart Express (Free)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#666" }}>
                <span>Payment Status</span>
                <span style={{ color: "#16a34a", fontWeight: 800 }}>CAPTURED / VERIFIED</span>
              </div>

              <div
                style={{
                  borderTop: "1px solid #f0f0f0",
                  paddingTop: "14px",
                  marginTop: "6px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span style={{ fontWeight: 900, fontSize: "1rem", textTransform: "uppercase" }}>Total Paid</span>
                <span style={{ fontWeight: 900, fontSize: "1.3rem", color: "#000" }}>
                  ₹{grandTotal ? grandTotal.toLocaleString("en-IN") : "—"}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "18px",
                padding: "10px 12px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                fontSize: "0.75rem",
                color: "#166534",
              }}
            >
              <ShieldCheckIcon size={16} color="#16a34a" />
              <span>Instant Refund Guarantee active for this order.</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Link
              href={`/track?q=${orderId}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "16px",
                background: "#000",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 800,
                fontSize: "0.88rem",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              <TruckIcon size={18} />
              <span>Track Shipment Live →</span>
            </Link>

            <Link
              href={`/account/orders/${orderId}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "14px",
                background: "#fff",
                border: "1px solid #000",
                color: "#000",
                textDecoration: "none",
                fontWeight: 800,
                fontSize: "0.85rem",
                textTransform: "uppercase",
              }}
            >
              <PackageIcon size={16} />
              <span>View Order In My Account</span>
            </Link>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => window.print()}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "12px",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  color: "#374151",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <PrinterIcon size={14} />
                <span>Print Receipt</span>
              </button>

              <Link
                href="/products"
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  color: "#374151",
                  textDecoration: "none",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div style={{ textAlign: "center", padding: "100px 20px" }}>
          Loading confirmation...
        </div>
      }
    >
      <OrderSuccessContent />
    </Suspense>
  );
}
