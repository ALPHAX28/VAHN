"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { getAdminOrder, updateOrderStatus, type AdminOrder } from "@/lib/api/admin";
import AdminBadge from "@/components/admin/AdminBadge";
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
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{order.id}</h1>
          <p className="admin-page-subtitle">
            <AdminBadge label={order.status} /> &nbsp;·&nbsp; {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <button onClick={() => router.back()} className="admin-btn admin-btn--ghost">← Orders</button>
      </div>

      {error && <div className="admin-alert admin-alert--error">{error}</div>}
      {success && <div className="admin-alert admin-alert--success">{success}</div>}

      <div className="admin-order-layout">
        {/* Left: Items + Customer */}
        <div className="admin-order-main">
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
              <div className="admin-order-customer-name">{order.user_name}</div>
              <div className="admin-order-customer-email">{order.user_email}</div>
              <Link href={`/admin/users/${order.user_id}`} className="admin-link">View customer →</Link>
            </div>
          </div>

          {/* Shipping */}
          <div className="admin-card">
            <h2 className="admin-card-title">Shipping Address</h2>
            <div className="admin-order-address">
              <div>{addr.name}</div>
              <div>{addr.address}</div>
              <div>{addr.city}, {addr.postalCode}</div>
              {addr.phone && <div>{addr.phone}</div>}
            </div>
          </div>
        </div>

        {/* Right: Status Management */}
        <div className="admin-order-sidebar">
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
    </div>
  );
}
