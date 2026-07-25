"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@/context/AuthContext";
import { getOrderDetail } from "@/lib/api";
import type { OrderDetail } from "@/lib/api/types";
import Image from "next/image";
import Link from "next/link";
import { MapPinIcon, PrinterIcon, PackageIcon, TruckIcon, SparklesIcon, CheckIcon, PhoneIcon } from "@/components/icons/Icons";

const STATUS_STEPS = [
  { key: "PROCESSING", label: "Order Placed & Processing", IconComponent: PackageIcon },
  { key: "SHIPPED", label: "Shipped & In Transit", IconComponent: TruckIcon },
  { key: "DELIVERED", label: "Delivered to Customer", IconComponent: SparklesIcon },
];

export default function CustomerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = use(params);
  const { token, user } = useAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !orderId) return;
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

  if (!user) {
    return (
      <div style={{ maxWidth: 800, margin: "60px auto", padding: 20, color: "#000", textAlign: "center" }}>
        <h2>Please Sign In to View Order Details</h2>
        <Link href="/account/login" style={{ color: "#000", textDecoration: "underline", marginTop: 12, display: "inline-block" }}>
          Sign In →
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: "60px auto", padding: 20, color: "#666", textAlign: "center" }}>
        Loading order #{orderId}...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ maxWidth: 960, margin: "60px auto", padding: 20, color: "#000", textAlign: "center" }}>
        <h2>Order Not Found</h2>
        <p style={{ color: "#666" }}>{error || "Unable to locate order."}</p>
        <Link href="/account/orders" style={{ color: "#000", textDecoration: "underline", marginTop: 12, display: "inline-block" }}>
          ← Back to My Orders
        </Link>
      </div>
    );
  }

  // Calculate status tracker step index
  let stepIndex = 0;
  if (order.status === "SHIPPED") stepIndex = 1;
  if (order.status === "DELIVERED") stepIndex = 2;

  const addr = order.shippingAddress || {};

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", padding: "0 20px", color: "#000000" }}>
      {/* Back button & Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <Link href="/account/orders" style={{ color: "#666666", fontSize: "0.82rem", fontWeight: 700, textDecoration: "none", letterSpacing: "0.05em" }}>
            ← BACK TO MY ORDERS
          </Link>
          <h1 style={{ fontSize: "2rem", fontWeight: 900, margin: "6px 0 0", color: "#000000", letterSpacing: "-0.01em" }}>
            Order #{order.id}
          </h1>
          <span style={{ fontSize: "0.88rem", color: "#666666" }}>Placed on {order.createdAt}</span>
        </div>

        <button
          onClick={() => window.print()}
          style={{
            background: "#000000", color: "#ffffff", border: "none", padding: "10px 20px",
            borderRadius: 8, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)", display: "inline-flex", alignItems: "center", gap: 8,
            transition: "all 0.2s ease"
          }}
        >
          <PrinterIcon size={16} color="#ffffff" /> Print Invoice / Receipt
        </button>
      </div>

      {/* Interactive Status Bar Progress Tracker */}
      <div style={{
        background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 16,
        padding: 32, marginBottom: 32, boxShadow: "0 4px 20px rgba(0,0,0,0.04)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <h3 style={{ fontSize: "0.9rem", fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4b5563" }}>
            Order Fulfillment Status
          </h3>
          <span style={{
            background: order.status === "DELIVERED" ? "#15803d" : order.status === "SHIPPED" ? "#1d4ed8" : "#b45309",
            color: "#ffffff", padding: "6px 16px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase",
            letterSpacing: "0.05em"
          }}>
            {order.status}
          </span>
        </div>

        {/* Pixel-Perfect Centered Progress Bar Row */}
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          {/* Background Track Line (centered at 21px, half of 42px circle height) */}
          <div style={{
            position: "absolute", top: 19, left: "16.66%", right: "16.66%", height: 4,
            background: "#e5e7eb", zIndex: 1
          }} />
          {/* Active Completed Progress Line */}
          <div style={{
            position: "absolute", top: 19, left: "16.66%",
            width: stepIndex === 0 ? "0%" : stepIndex === 1 ? "33.33%" : "66.66%",
            height: 4, background: "#000000", zIndex: 2, transition: "width 0.5s ease"
          }} />

          {STATUS_STEPS.map((s, idx) => {
            const isCompleted = idx <= stepIndex;
            const isPast = idx < stepIndex;
            const isCurrent = idx === stepIndex;
            const IconComp = s.IconComponent;

            return (
              <div key={s.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 3, width: "33.33%", textAlign: "center" }}>
                <div style={{
                  width: 42, height: 42, borderRadius: "50%",
                  background: isCompleted ? "#000000" : "#ffffff",
                  color: isCompleted ? "#ffffff" : "#9ca3af",
                  border: isCompleted ? "2px solid #000000" : "2px solid #d1d5db",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.05rem", fontWeight: 800, transition: "all 0.3s ease",
                  boxShadow: isCompleted ? "0 4px 12px rgba(0,0,0,0.15)" : "none"
                }}>
                  {isPast ? (
                    <CheckIcon size={18} color="#ffffff" />
                  ) : isCurrent ? (
                    <IconComp size={18} color="#ffffff" />
                  ) : (
                    <IconComp size={18} color="#9ca3af" />
                  )}
                </div>
                <span style={{
                  fontSize: "0.85rem", fontWeight: isCompleted ? 800 : 500,
                  color: isCompleted ? "#000000" : "#6b7280", marginTop: 12, padding: "0 8px"
                }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid Layout: Items List (Left) & Delivery/Payment (Right) */}
      <div className="vahn-order-grid" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 28, alignItems: "start" }}>
        {/* Ordered Items Table */}
        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: "0.9rem", fontWeight: 800, margin: "0 0 24px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#4b5563" }}>
            Items in Order ({order.items.length})
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {order.items.map(item => (
              <div key={item.id} style={{ display: "flex", gap: 18, alignItems: "center", borderBottom: "1px solid #f3f4f6", paddingBottom: 18 }}>
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.productTitle} width={76} height={76} style={{ borderRadius: 10, objectFit: "cover", border: "1px solid #eee" }} />
                ) : (
                  <div style={{ width: 76, height: 76, background: "#f3f4f6", borderRadius: 10 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#000000" }}>{item.productTitle}</div>
                  <div style={{ fontSize: "0.85rem", color: "#4b5563", marginTop: 4 }}>
                    Variant: {item.variantTitle} | Qty: <strong>{item.quantity}</strong>
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#6b7280", marginTop: 2 }}>
                    Unit Price: ₹{parseFloat(item.price.amount).toLocaleString()}
                  </div>
                </div>
                <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "#000000" }}>
                  ₹{(parseFloat(item.price.amount) * item.quantity).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar: Delivery Address & Price Summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Delivery Address Card */}
          <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <MapPinIcon size={18} color="#000000" />
              <h3 style={{ fontSize: "0.85rem", fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4b5563" }}>
                Delivery Address
              </h3>
            </div>
            {addr.name && <div style={{ fontWeight: 800, fontSize: "1rem", color: "#000000" }}>{addr.name}</div>}
            {addr.label && (
              <span style={{ display: "inline-block", background: "#000000", color: "#ffffff", padding: "3px 10px", borderRadius: 12, fontSize: "0.7rem", fontWeight: 800, margin: "6px 0 10px" }}>
                {addr.label.toUpperCase()}
              </span>
            )}
            <div style={{ fontSize: "0.88rem", color: "#374151", lineHeight: 1.5, marginTop: 4 }}>{addr.address || "Standard Address"}</div>
            <div style={{ fontSize: "0.85rem", color: "#4b5563", marginTop: 4 }}>
              {addr.city}, {addr.state} — <strong>{addr.postalCode}</strong>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span>🇮🇳 India</span> | <PhoneIcon size={14} color="#6b7280" /> <span>{addr.phone}</span>
            </div>
          </div>

          {/* Price Breakdown */}
          <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
            <h3 style={{ fontSize: "0.85rem", fontWeight: 800, margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#4b5563" }}>
              Payment Summary
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: "0.88rem", color: "#374151" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Items Subtotal</span>
                <span style={{ fontWeight: 700, color: "#000000" }}>₹{parseFloat(order.subtotalPrice.amount).toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Shipping Fee</span>
                <span>{parseFloat(order.shippingPrice.amount) === 0 ? <strong style={{ color: "#16a34a" }}>FREE</strong> : `₹${order.shippingPrice.amount}`}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: "0.82rem" }}>
                <span>GST Tax (12% Included)</span>
                <span>₹{parseFloat(order.taxPrice.amount).toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: "1.25rem", color: "#000000", paddingTop: 14, borderTop: "1px solid #e5e7eb" }}>
                <span>Total Paid</span>
                <span>₹{parseFloat(order.totalPrice.amount).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
