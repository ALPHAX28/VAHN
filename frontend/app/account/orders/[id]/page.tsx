"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@/context/AuthContext";
import { getOrderDetail } from "@/lib/api";
import type { OrderDetail } from "@/lib/api/types";
import Image from "next/image";
import Link from "next/link";
import {
  MapPinIcon, PrinterIcon, PackageIcon, TruckIcon,
  SparklesIcon, CheckIcon, PhoneIcon, ChevronLeftIcon
} from "@/components/icons/Icons";

const STATUS_STEPS = [
  { key: "PROCESSING", label: "Order Placed & Processing", sublabel: "Confirmed", IconComponent: PackageIcon },
  { key: "SHIPPED", label: "Shipped & In Transit", sublabel: "En Route", IconComponent: TruckIcon },
  { key: "DELIVERED", label: "Delivered", sublabel: "Completed", IconComponent: SparklesIcon },
];

function getStatusColor(status: string) {
  if (status === "DELIVERED") return { bg: "#ecfdf5", text: "#15803d", border: "#16a34a" };
  if (status === "SHIPPED") return { bg: "#eff6ff", text: "#1d4ed8", border: "#3b82f6" };
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
      <div style={{ maxWidth: 560, margin: "100px auto", padding: "0 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 900, textTransform: "uppercase", margin: "0 0 16px" }}>
          Please Sign In
        </h2>
        <Link href="/account/login" style={{ color: "#000", fontWeight: 800, textDecoration: "underline" }}>
          Sign In →
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #000", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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

  // Calculate status tracker step index
  let stepIndex = 0;
  if (order.status === "SHIPPED") stepIndex = 1;
  if (order.status === "DELIVERED") stepIndex = 2;

  const addr = order.shippingAddress || {};
  const statusColors = getStatusColor(order.status);

  return (
    <>
      {/* WEB VIEW CONTENT (Hidden during print) */}
      <div className="vahn-no-print">
      {/* Header: Back link + order meta + print button */}
      <div style={{ marginBottom: 28 }}>
        <Link href="/account/orders" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          color: "#666", fontSize: "0.78rem", fontWeight: 700,
          textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12
        }}>
          <ChevronLeftIcon size={14} color="#666" />
          My Orders
        </Link>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 900, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
              Order #{order.id}
            </h1>
            <span style={{ fontSize: "0.83rem", color: "#888" }}>
              Placed on {order.createdAt}
            </span>
          </div>
          <button
            onClick={() => window.print()}
            style={{
              background: "#fff", border: "2px solid #000", color: "#000",
              padding: "10px 20px", fontSize: "0.8rem", fontWeight: 900,
              cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em",
              display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
          >
            <PrinterIcon size={15} color="#000" />
            Print Receipt
          </button>
        </div>
      </div>

      {/* Order Fulfillment Tracker */}
      <div className="vahn-order-card">
        {/* Tracker header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <h3 style={{ fontSize: "0.78rem", fontWeight: 900, margin: 0, textTransform: "uppercase", letterSpacing: "0.1em", color: "#555" }}>
            Fulfillment Status
          </h3>
          <span style={{
            background: statusColors.bg, color: statusColors.text,
            border: `1px solid ${statusColors.border}`,
            padding: "5px 14px", fontSize: "0.72rem", fontWeight: 900,
            textTransform: "uppercase", letterSpacing: "0.07em"
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
                <div key={s.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "33.33%", textAlign: "center" }}>
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
                      <IconComp size={16} color="#9ca3af" />
                    )}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{
                      fontSize: "0.82rem", fontWeight: isCompleted ? 800 : 500,
                      color: isCompleted ? "#000" : "#9ca3af",
                      lineHeight: 1.3, padding: "0 4px"
                    }}>
                      {s.label}
                    </div>
                    <div style={{
                      fontSize: "0.7rem", fontWeight: 600,
                      color: isCurrent ? "#000" : "#bbb",
                      textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2
                    }}>
                      {isCurrent ? s.sublabel : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile vertical tracker (CSS-shown on small screens) */}
        <div className="vahn-tracker-mobile" style={{ display: "none", flexDirection: "column", gap: 0 }}>
          {STATUS_STEPS.map((s, idx) => {
            const isCompleted = idx <= stepIndex;
            const isPast = idx < stepIndex;
            const isCurrent = idx === stepIndex;
            const IconComp = s.IconComponent;
            const isLast = idx === STATUS_STEPS.length - 1;

            return (
              <div key={s.key} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                {/* Circle + line column */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div style={{
                    width: 36, height: 36,
                    background: isCompleted ? "#000" : "#fff",
                    border: isCompleted ? "2px solid #000" : "2px solid #d1d5db",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.3s"
                  }}>
                    {isPast ? <CheckIcon size={14} color="#fff" /> :
                      isCurrent ? <IconComp size={14} color={isCompleted ? "#fff" : "#9ca3af"} /> :
                      <IconComp size={14} color="#9ca3af" />}
                  </div>
                  {!isLast && (
                    <div style={{ width: 2, height: 32, background: isCompleted && idx < stepIndex ? "#000" : "#e5e7eb", marginTop: 4 }} />
                  )}
                </div>

                {/* Text */}
                <div style={{ paddingTop: 6, paddingBottom: isLast ? 0 : 32 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: isCompleted ? 800 : 500, color: isCompleted ? "#000" : "#9ca3af" }}>
                    {s.label}
                  </div>
                  {isCurrent && (
                    <div style={{ fontSize: "0.7rem", color: "#666", marginTop: 2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {s.sublabel}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Grid: Items (left) | Info (right) */}
      <div className="vahn-order-grid">

        {/* Ordered Items */}
        <div className="vahn-card-box">
          <div className="vahn-card-box-header">
            <h3 style={{ fontSize: "0.8rem", fontWeight: 900, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", color: "#555" }}>
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
              <h3 style={{ fontSize: "0.78rem", fontWeight: 900, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", color: "#555" }}>
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
              <h3 style={{ fontSize: "0.78rem", fontWeight: 900, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", color: "#555" }}>
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
                <span style={{ fontSize: "0.8rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: "#555" }}>
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
      </div>

      {/* PRINTABLE OFFICIAL TAX INVOICE / RECEIPT (Only visible during print) */}
      <div className="vahn-printable-receipt">
        <div style={{ padding: "40px", border: "2px solid #000", background: "#fff", color: "#000", fontFamily: "sans-serif" }}>
          
          {/* Header Banner */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: 20, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: "2.4rem", fontWeight: 900, margin: "0 0 4px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                VAHN
              </h1>
              <div style={{ fontSize: "0.8rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: "#222" }}>
                VAHN SPORTSWEAR INDIA PVT. LTD.
              </div>
              <div style={{ fontSize: "0.75rem", color: "#555", marginTop: 4, lineHeight: 1.4 }}>
                Registered Office: 502 Airport Towers, Masterda Sarani, Mumbai, MH 400001<br />
                GSTIN: 27AAACV1234F1Z9 · Support: support@vahnsports.com
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ background: "#000", color: "#fff", padding: "6px 16px", fontSize: "0.85rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", display: "inline-block" }}>
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
              <div style={{ fontSize: "0.72rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: "#777", marginBottom: 6 }}>
                BILLED TO (CUSTOMER)
              </div>
              <div style={{ fontWeight: 900, fontSize: "0.95rem" }}>{user.full_name}</div>
              <div style={{ fontSize: "0.82rem", color: "#444", marginTop: 2 }}>{user.email}</div>
              {addr.phone && <div style={{ fontSize: "0.82rem", color: "#444", marginTop: 2 }}>Ph: {addr.phone}</div>}
            </div>

            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: "#777", marginBottom: 6 }}>
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
    </>
  );
}
