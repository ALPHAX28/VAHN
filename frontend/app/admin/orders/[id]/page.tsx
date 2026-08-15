"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { getAdminOrder, updateOrderStatus, type AdminOrder } from "@/lib/api/admin";
import AdminBadge from "@/components/admin/AdminBadge";
import { PrinterIcon } from "@/components/icons/Icons";
import Image from "next/image";
import Link from "next/link";

const ORDER_STATUSES = ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
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

  async function load() {
    if (!adminToken) return;
    try {
      const o = await getAdminOrder(adminToken, id);
      setOrder(o);
      setStatus(o.status);
      setRefundStatus(o.refund_status || "");
      setRefundNote(o.refund_note || "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [adminToken, id]);

  async function handleSave() {
    if (!adminToken) return;
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await updateOrderStatus(adminToken, id, { status, refund_status: refundStatus || undefined, refund_note: refundNote || undefined });
      setSuccess("Order updated successfully!");
      await load();
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="admin-page"><div className="admin-loading-row"><div className="admin-loading-spinner" /></div></div>;
  if (!order) return <div className="admin-page"><div className="admin-alert admin-alert--error">{error || "Order not found"}</div></div>;

  const addr = order.shipping_address || {};

  return (
    <div className="admin-page">
      {error && <div className="admin-alert admin-alert--error">{error}</div>}
      {success && <div className="admin-alert admin-alert--success">{success}</div>}

      <div className="admin-order-layout">
        {/* Left: Header + Items + Customer */}
        <div className="admin-order-main">
          {/* Order Header Title Block */}
          <div className="vahn-no-print" style={{ marginBottom: 4 }}>
            <button
              onClick={() => router.back()}
              className="admin-btn-inline-link"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 6, fontSize: "0.8125rem", color: "var(--admin-text-secondary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}
            >
              ← Back to Orders
            </button>
            <h1 className="admin-page-title" style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>{order.id}</h1>
            <p className="admin-page-subtitle" style={{ marginTop: 4 }}>
              <AdminBadge label={order.status} /> &nbsp;·&nbsp; {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>

          {/* Items */}
          <div className="admin-card">
            <h2 className="admin-card-title">Order Items</h2>

            <div className="admin-order-items">
              {order.items.map(item => (
                <div key={item.id} className="admin-order-item">
                  {item.image_url ? (
                    <Image src={item.image_url} alt={item.product_title} width={56} height={56} className="admin-order-item-img" />
                  ) : <div className="admin-order-item-img-placeholder" />}
                  <div className="admin-order-item-info">
                    <span className="admin-order-item-title">{item.product_title}</span>
                    <span className="admin-order-item-variant">{item.variant_title}</span>
                  </div>
                  <div className="admin-order-item-pricing">
                    <span className="admin-order-item-qty">×{item.quantity}</span>
                    <span className="admin-order-item-price">₹{(item.price_amount * item.quantity).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="admin-order-totals">
              <div className="admin-order-total-row">
                <span>Subtotal</span>
                <span>₹{order.subtotal_amount.toLocaleString("en-IN")}</span>
              </div>
              <div className="admin-order-total-row admin-order-total-row--bold">
                <span>Total</span>
                <span>₹{order.total_amount.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="admin-card">
            <h2 className="admin-card-title">Customer</h2>
            <div className="admin-order-customer">
              <div className="admin-order-customer-name">{order.user_name || "Customer"}</div>
              {order.user_email && <div className="admin-order-customer-email">{order.user_email}</div>}
              {order.user_id ? (
                <Link
                  href={`/admin/users/${order.user_id}`}
                  className="admin-btn admin-btn--secondary"
                  style={{ marginTop: 10, display: "inline-flex", textDecoration: "none", fontSize: "0.8125rem" }}
                >
                  View Customer Profile →
                </Link>
              ) : order.user_email ? (
                <Link
                  href={`/admin/users?search=${encodeURIComponent(order.user_email)}`}
                  className="admin-btn admin-btn--secondary"
                  style={{ marginTop: 10, display: "inline-flex", textDecoration: "none", fontSize: "0.8125rem" }}
                >
                  View Customer Profile →
                </Link>
              ) : null}
            </div>
          </div>


          {/* Shipping */}
          <div className="admin-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 className="admin-card-title" style={{ margin: 0 }}>Shipping Address</h2>
              <button
                onClick={() => window.print()}
                className="admin-btn admin-btn--secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: "0.78rem" }}
              >
                <PrinterIcon size={14} color="#000" />
                Print Label
              </button>
            </div>
            <div className="admin-order-address">
              <div style={{ fontWeight: 900, color: "#000", fontSize: "0.95rem" }}>{addr.name || order.user_name}</div>
              <div>{addr.address || "Standard Address"}</div>
              <div style={{ fontWeight: 700, color: "#000" }}>{addr.city}, {addr.postalCode}</div>
              {addr.phone && <div>Ph: {addr.phone}</div>}
            </div>
          </div>
        </div>

        {/* Right: Status Management */}
        <div className="admin-order-sidebar">
          <button
            onClick={() => window.print()}
            className="admin-btn admin-btn--primary vahn-no-print"
            style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 16px" }}
          >
            <PrinterIcon size={16} color="#fff" />
            Print Shipping Label
          </button>

          <div className="admin-card">

            <h2 className="admin-card-title">Order Status</h2>
            <div className="admin-form-group">
              <label className="admin-form-label">Fulfilment Status</label>
              <select className="admin-form-select" value={status} onChange={e => setStatus(e.target.value)}>
                {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Refund Status</label>
              <select className="admin-form-select" value={refundStatus} onChange={e => setRefundStatus(e.target.value)}>
                {REFUND_STATUSES.map(s => <option key={s || "none"} value={s}>{s || "No refund"}</option>)}
              </select>
            </div>
            {refundStatus && (
              <div className="admin-form-group">
                <label className="admin-form-label">Refund Note</label>
                <textarea className="admin-form-textarea" rows={3} value={refundNote} onChange={e => setRefundNote(e.target.value)} placeholder="Reason for refund..." />
              </div>
            )}
            <button className="admin-btn admin-btn--primary admin-btn--full" onClick={handleSave} disabled={saving}>
              {saving ? <span className="admin-btn-spinner" /> : "Update Order"}
            </button>
          </div>
        </div>
      </div>

      {/* PRINTABLE OFFICIAL COURIER SHIPPING LABEL (Only visible during print mode) */}
      <div className="vahn-printable-shipping-label">
        <div style={{
          width: "100%", maxWidth: "560px", margin: "0 auto",
          border: "4px solid #000", padding: "24px",
          background: "#fff", color: "#000", fontFamily: "Arial, sans-serif"
        }}>
          
          {/* Label Top Header */}
          <div style={{ borderBottom: "3px solid #000", paddingBottom: 14, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ fontSize: "2.2rem", fontWeight: 900, margin: 0, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                VAHN
              </h1>
              <div style={{ fontSize: "0.72rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: "#333" }}>
                EXPRESS PRIORITY SHIPPING
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ background: "#000", color: "#fff", padding: "5px 14px", fontSize: "0.82rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                PREPAID
              </span>
              <div style={{ fontSize: "0.72rem", fontWeight: 800, marginTop: 6, color: "#444" }}>
                AIR EXPRESS LOGISTICS
              </div>
            </div>
          </div>

          {/* Barcode & Waybill Tracking */}
          <div style={{ borderBottom: "2px solid #000", paddingBottom: 14, marginBottom: 14, textAlign: "center" }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#666", marginBottom: 4 }}>
              WAYBILL / TRACKING NUMBER
            </div>
            {/* Scannable visual Barcode pattern */}
            <div style={{
              fontFamily: "'Courier New', monospace",
              fontSize: "2.4rem", fontWeight: 700, letterSpacing: "3px",
              lineHeight: 1, margin: "4px 0"
            }}>
              |||| | ||| |||| | |||| ||| |||| | |||
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 900, letterSpacing: "0.08em" }}>
              VAHN-{order.id}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#555", marginTop: 4 }}>
              Order Date: {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · Weight: 0.50 KG
            </div>
          </div>

          {/* SHIP TO (DELIVERY RECIPIENT) - BOLD LARGE BOX */}
          <div style={{ border: "2px solid #000", padding: "16px 20px", marginBottom: 14, background: "#fafafa" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#555", borderBottom: "1px solid #ddd", paddingBottom: 6, marginBottom: 10 }}>
              DELIVER TO (RECIPIENT)
            </div>
            <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#000", marginBottom: 4 }}>
              {addr.name || order.user_name}
            </div>
            <div style={{ fontSize: "1rem", color: "#111", lineHeight: 1.45, marginBottom: 6 }}>
              {addr.address || "Standard Address"}
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "#000" }}>
              {addr.city}, {addr.postalCode}
            </div>
            {addr.phone && (
              <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#000", marginTop: 6 }}>
                PHONE: {addr.phone}
              </div>
            )}
          </div>

          {/* RETURN ADDRESS (SHIP FROM) */}
          <div style={{ borderBottom: "2px dashed #000", paddingBottom: 12, marginBottom: 12, fontSize: "0.78rem" }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: "#666", marginBottom: 4 }}>
              IF UNDELIVERED, RETURN TO:
            </div>
            <div style={{ fontWeight: 800 }}>VAHN SPORTSWEAR INDIA PVT. LTD.</div>
            <div style={{ color: "#444" }}>502 Airport Towers, Masterda Sarani, Mumbai, MH — 400001</div>
            <div style={{ color: "#666", marginTop: 2 }}>Contact: support@vahnsports.com | +91 9875741243</div>
          </div>

          {/* ORDER CONTENTS SUMMARY */}
          <div style={{ fontSize: "0.75rem", color: "#333" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span><strong>Order ID:</strong> #{order.id}</span>
              <span><strong>Declared Value:</strong> ₹{order.total_amount.toLocaleString("en-IN")}</span>
            </div>
            <div style={{ color: "#555" }}>
              <strong>Contents ({order.items.length} items):</strong> {order.items.map(i => `${i.product_title} (${i.variant_title}) ×${i.quantity}`).join(", ")}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
