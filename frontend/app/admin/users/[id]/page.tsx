"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import {
  getAdminUser,
  suspendUser,
  reactivateUser,
  deleteAdminUser,
  type AdminUserDetail
} from "@/lib/api/admin";
import AdminBadge from "@/components/admin/AdminBadge";
import {
  UserIcon,
  ShoppingBagIcon,
  MapPinIcon,
  PhoneIcon,
  ChevronLeftIcon,
  ShieldCheckIcon,
  AlertCircleIcon,
  TrashIcon
} from "@/components/icons/Icons";
import Link from "next/link";
import { formatMoney } from "@/lib/utils";

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { adminToken } = useAdminAuth();
  const router = useRouter();

  const [customer, setCustomer] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  async function loadCustomer() {
    if (!adminToken || !id) return;
    setLoading(true);
    setError("");
    try {
      const data = await getAdminUser(adminToken, parseInt(id, 10));
      setCustomer(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load customer profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomer();
  }, [adminToken, id]);

  async function handleToggleSuspend() {
    if (!adminToken || !customer) return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      if (customer.is_active) {
        await suspendUser(adminToken, customer.id, suspensionReason);
        setSuccess(`Customer ${customer.email} has been suspended.`);
      } else {
        await reactivateUser(adminToken, customer.id);
        setSuccess(`Customer ${customer.email} has been reactivated.`);
      }
      setShowSuspendModal(false);
      setSuspensionReason("");
      await loadCustomer();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update user status.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteUser() {
    if (!adminToken || !customer) return;
    setActionLoading(true);
    setError("");
    try {
      await deleteAdminUser(adminToken, customer.id);
      router.push("/admin/users");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete customer.");
      setActionLoading(false);
      setShowDeleteModal(false);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "100px 20px" }}>
        <div style={{
          width: 36, height: 36, border: "3px solid #000",
          borderTopColor: "transparent", borderRadius: "50%",
          animation: "spin 0.8s linear infinite", margin: "0 auto 16px"
        }} />
        <p style={{ color: "#888", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: '-0.025em' }}>
          Loading customer profile...
        </p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <Link href="/admin/users" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", fontWeight: 700, color: "#666", textDecoration: "none" }}>
            <ChevronLeftIcon size={16} />
            Back to Customers
          </Link>
        </div>
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#b91c1c", padding: "20px 24px", fontWeight: 700, fontSize: "0.9rem" }}>
          {error || "Customer profile not found."}
        </div>
      </div>
    );
  }

  const initials = customer.full_name
    ? customer.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "CU";

  const avgOrderValue = customer.orders_count > 0 ? customer.total_spend / customer.orders_count : 0;

  return (
    <div>
      {/* Top Navigation & Breadcrumb */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/users" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", fontWeight: 700, color: "#666", textDecoration: "none", textTransform: "uppercase", letterSpacing: '-0.025em', marginBottom: 12 }}>
          <ChevronLeftIcon size={14} color="#666" />
          Back to Customers
        </Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Avatar Circle */}
            <div style={{
              width: 56, height: 56, background: "#000", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.25rem", fontWeight: 900, letterSpacing: '-0.025em',
              flexShrink: 0
            }}>
              {initials}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "1.6rem", fontWeight: 900, margin: 0, textTransform: "uppercase", letterSpacing: '-0.025em' }}>
                  {customer.full_name || "Customer Profile"}
                </h1>
                <AdminBadge variant={customer.is_verified ? "success" : "warning"}>
                  {customer.is_verified ? "VERIFIED" : "UNVERIFIED"}
                </AdminBadge>
                <AdminBadge variant={customer.is_active ? "success" : "danger"}>
                  {customer.is_active ? "ACTIVE" : "SUSPENDED"}
                </AdminBadge>
              </div>
              <p style={{ margin: "4px 0 0", color: "#666", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span>{customer.email}</span>
                {customer.phone && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <PhoneIcon size={13} color="#888" />
                    {customer.phone}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Actions Header */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setShowSuspendModal(true)}
              style={{
                background: customer.is_active ? "#fef2f2" : "#f0fdf4",
                border: customer.is_active ? "1px solid #fca5a5" : "1px solid #86efac",
                color: customer.is_active ? "#dc2626" : "#16a34a",
                padding: "9px 18px", fontSize: "0.78rem", fontWeight: 800,
                cursor: "pointer", textTransform: "uppercase", letterSpacing: '-0.025em'
              }}
            >
              {customer.is_active ? "Suspend Account" : "Reactivate Account"}
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              style={{
                background: "#fff", border: "1px solid #e5e7eb", color: "#dc2626",
                padding: "9px 14px", fontSize: "0.78rem", fontWeight: 800,
                cursor: "pointer", textTransform: "uppercase", letterSpacing: '-0.025em',
                display: "inline-flex", alignItems: "center", gap: 6
              }}
            >
              <TrashIcon size={14} color="#dc2626" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div style={{ background: "#f0fdf4", borderLeft: "4px solid #16a34a", color: "#15803d", padding: "12px 16px", fontSize: "0.85rem", fontWeight: 700, marginBottom: 20 }}>
          {success}
        </div>
      )}
      {error && (
        <div style={{ background: "#fef2f2", borderLeft: "4px solid #dc2626", color: "#b91c1c", padding: "12px 16px", fontSize: "0.85rem", fontWeight: 700, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Metric Cards Row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16, marginBottom: 28
      }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "20px 24px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: '-0.025em', marginBottom: 6 }}>
            Total Orders
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#000" }}>
            {customer.orders_count}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#666", marginTop: 4 }}>
            Lifetime purchases
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "20px 24px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: '-0.025em', marginBottom: 6 }}>
            Total Spend
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#000" }}>
            {formatMoney({ amount: String(customer.total_spend), currencyCode: "INR" })}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#666", marginTop: 4 }}>
            Net spend (excl. cancelled)
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "20px 24px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: '-0.025em', marginBottom: 6 }}>
            Avg. Order Value
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#000" }}>
            {formatMoney({ amount: String(avgOrderValue), currencyCode: "INR" })}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#666", marginTop: 4 }}>
            Per transaction average
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "20px 24px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: '-0.025em', marginBottom: 6 }}>
            Customer Since
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 900, color: "#000", marginTop: 4 }}>
            {customer.created_at}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#666", marginTop: 4 }}>
            Registered account
          </div>
        </div>
      </div>

      {/* Content Grid (Main 2 Cols) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
        
        {/* Left Column (Orders & Addresses) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Order History Section */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ShoppingBagIcon size={18} color="#000" />
                <h3 style={{ fontSize: "1rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: '-0.025em', margin: 0 }}>
                  Order History ({customer.orders.length})
                </h3>
              </div>
            </div>

            {customer.orders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", background: "#f8fafc", border: "1px dashed #cbd5e1" }}>
                <ShoppingBagIcon size={32} color="#94a3b8" />
                <h4 style={{ fontSize: "0.9rem", fontWeight: 800, margin: "12px 0 4px", textTransform: "uppercase" }}>No Orders Placed Yet</h4>
                <p style={{ fontSize: "0.8rem", color: "#64748b", margin: 0 }}>This customer has not placed any orders yet.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #000", fontSize: "0.72rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: '-0.025em', color: "#666" }}>
                      <th style={{ padding: "10px 12px" }}>Order ID</th>
                      <th style={{ padding: "10px 12px" }}>Date</th>
                      <th style={{ padding: "10px 12px" }}>Status</th>
                      <th style={{ padding: "10px 12px" }}>Items</th>
                      <th style={{ padding: "10px 12px" }}>Total</th>
                      <th style={{ padding: "10px 12px", textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.orders.map(order => (
                      <tr key={order.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: "0.85rem" }}>
                        <td style={{ padding: "12px", fontWeight: 900, fontFamily: "monospace" }}>
                          {order.id}
                        </td>
                        <td style={{ padding: "12px", color: "#666", fontSize: "0.8rem" }}>
                          {order.created_at}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <AdminBadge variant={
                            order.status === "DELIVERED" ? "success" :
                            order.status === "CANCELLED" ? "danger" :
                            order.status === "SHIPPED" ? "info" : "warning"
                          }>
                            {order.status}
                          </AdminBadge>
                        </td>
                        <td style={{ padding: "12px", color: "#333", fontSize: "0.8rem" }}>
                          <span style={{ fontWeight: 800 }}>{order.items_count} items</span>
                          {order.items_summary && (
                            <div style={{ color: "#888", fontSize: "0.74rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>
                              {order.items_summary}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px", fontWeight: 900 }}>
                          {formatMoney({ amount: String(order.total_amount), currencyCode: order.currency || "INR" })}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <Link
                            href={`/admin/orders/${order.id}`}
                            style={{
                              background: "#000", color: "#fff", padding: "6px 12px",
                              fontSize: "0.72rem", fontWeight: 800, textDecoration: "none",
                              textTransform: "uppercase", letterSpacing: '-0.025em', display: "inline-block"
                            }}
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Saved Addresses Section */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <MapPinIcon size={18} color="#000" />
                <h3 style={{ fontSize: "1rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: '-0.025em', margin: 0 }}>
                  Saved Delivery Locations ({customer.addresses.length})
                </h3>
              </div>
            </div>

            {customer.addresses.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 20px", background: "#f8fafc", border: "1px dashed #cbd5e1" }}>
                <MapPinIcon size={28} color="#94a3b8" />
                <h4 style={{ fontSize: "0.88rem", fontWeight: 800, margin: "10px 0 4px", textTransform: "uppercase" }}>No Address Added</h4>
                <p style={{ fontSize: "0.78rem", color: "#64748b", margin: 0 }}>Customer has not saved any shipping location yet.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                {customer.addresses.map(addr => (
                  <div
                    key={addr.id}
                    style={{
                      border: addr.is_default ? "2px solid #000" : "1px solid #e5e7eb",
                      background: addr.is_default ? "#fff" : "#fafafa",
                      padding: "16px 18px", position: "relative"
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{
                        background: "#000", color: "#fff",
                        padding: "2px 8px", fontSize: "0.65rem", fontWeight: 900,
                        textTransform: "uppercase", letterSpacing: '-0.025em'
                      }}>
                        {addr.label}
                      </span>
                      {addr.is_default && (
                        <span style={{ background: "#f0fdf4", border: "1px solid #16a34a", color: "#15803d", padding: "2px 7px", fontSize: "0.62rem", fontWeight: 900, letterSpacing: '-0.025em' }}>
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 900, fontSize: "0.9rem", color: "#000", marginBottom: 4 }}>
                      {addr.first_name} {addr.last_name}
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "#333", margin: "0 0 4px", lineHeight: 1.4 }}>
                      {addr.house_flat_no ? `Flat ${addr.house_flat_no}, ` : ""}
                      {addr.floor_no ? `Floor ${addr.floor_no}, ` : ""}
                      {addr.block_wing ? `Wing ${addr.block_wing}, ` : ""}
                      {addr.building_name || addr.apartment ? `${addr.building_name || addr.apartment}, ` : ""}
                      {addr.street_address}
                    </p>
                    <p style={{ fontSize: "0.8rem", color: "#666", margin: "0 0 6px" }}>
                      {addr.city}, {addr.state} — <strong style={{ color: "#000" }}>{addr.pincode}</strong>
                    </p>
                    <div style={{ fontSize: "0.78rem", color: "#777", display: "flex", alignItems: "center", gap: 6 }}>
                      <PhoneIcon size={12} color="#777" />
                      {addr.phone}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column (Overview & Details) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Customer Overview Card */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "24px" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: '-0.025em', margin: "0 0 16px", borderBottom: "1px solid #f3f4f6", paddingBottom: 10 }}>
              Profile Details
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: '-0.025em' }}>User ID</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#000", fontFamily: "monospace" }}>#{customer.id}</div>
              </div>

              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: '-0.025em' }}>Full Name</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#000" }}>{customer.full_name || "—"}</div>
              </div>

              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: '-0.025em' }}>Email Address</div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#000", wordBreak: "break-all" }}>{customer.email}</div>
              </div>

              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: '-0.025em' }}>Phone Number</div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#000" }}>{customer.phone || "—"}</div>
              </div>

              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: '-0.025em' }}>Account Role</div>
                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#000", textTransform: "uppercase" }}>{customer.role}</div>
              </div>

              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: '-0.025em' }}>Registration Date</div>
                <div style={{ fontSize: "0.85rem", color: "#333" }}>{customer.created_at}</div>
              </div>

              {customer.suspended_at && (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", padding: "12px", marginTop: 6 }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 900, color: "#dc2626", textTransform: "uppercase", letterSpacing: '-0.025em', marginBottom: 2 }}>
                    Suspended On {customer.suspended_at}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#991b1b" }}>
                    Reason: {customer.suspension_reason || "No reason specified."}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Account Security Card */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "24px" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: '-0.025em', margin: "0 0 14px", borderBottom: "1px solid #f3f4f6", paddingBottom: 10 }}>
              Account Management
            </h3>

            <p style={{ fontSize: "0.8rem", color: "#666", lineHeight: 1.5, margin: "0 0 16px" }}>
              Manage customer access status. Suspending an account prevents the customer from placing orders or signing in.
            </p>

            <button
              type="button"
              onClick={() => setShowSuspendModal(true)}
              style={{
                width: "100%", background: customer.is_active ? "#dc2626" : "#16a34a",
                color: "#fff", border: "none", padding: "11px 16px",
                fontSize: "0.8rem", fontWeight: 900, cursor: "pointer",
                textTransform: "uppercase", letterSpacing: '-0.025em'
              }}
            >
              {customer.is_active ? "Suspend Customer Account" : "Reactivate Customer Account"}
            </button>
          </div>

        </div>

      </div>

      {/* Suspend Confirmation Modal */}
      {showSuspendModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: 20
        }}>
          <div style={{ background: "#fff", width: "100%", maxWidth: 460, padding: 28, border: "2px solid #000" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 900, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: '-0.025em' }}>
              {customer.is_active ? "Suspend Account?" : "Reactivate Account?"}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#555", margin: "0 0 16px", lineHeight: 1.5 }}>
              {customer.is_active
                ? `Are you sure you want to suspend ${customer.full_name || customer.email} (${customer.email})? They will be logged out immediately and prevented from logging in.`
                : `Are you sure you want to reactivate ${customer.full_name || customer.email} (${customer.email})? They will regain full access to log in and shop.`
              }
            </p>

            {customer.is_active && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: '-0.025em', marginBottom: 6 }}>
                  Suspension Reason (Optional)
                </label>
                <input
                  type="text"
                  value={suspensionReason}
                  onChange={e => setSuspensionReason(e.target.value)}
                  placeholder="e.g. Fraudulent activity, policy violation"
                  style={{
                    width: "100%", padding: "10px 12px", border: "1px solid #000",
                    fontSize: "0.85rem", outline: "none"
                  }}
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowSuspendModal(false)}
                disabled={actionLoading}
                style={{
                  background: "#fff", border: "1px solid #000", padding: "10px 18px",
                  fontSize: "0.8rem", fontWeight: 800, cursor: "pointer", textTransform: "uppercase"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleSuspend}
                disabled={actionLoading}
                style={{
                  background: customer.is_active ? "#dc2626" : "#16a34a", color: "#fff",
                  border: "none", padding: "10px 20px", fontSize: "0.8rem",
                  fontWeight: 900, cursor: "pointer", textTransform: "uppercase"
                }}
              >
                {actionLoading ? "Processing..." : customer.is_active ? "Confirm Suspension" : "Confirm Reactivation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: 20
        }}>
          <div style={{ background: "#fff", width: "100%", maxWidth: 460, padding: 28, border: "2px solid #dc2626", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ width: 44, height: 44, background: "#fef2f2", border: "1px solid #fca5a5", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <AlertCircleIcon size={24} color="#dc2626" />
            </div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 900, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: '-0.025em', color: "#dc2626" }}>
              Delete Customer Account?
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#555", margin: "0 0 20px", lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{customer.full_name || customer.email}</strong> ({customer.email})? This action is permanent and cannot be undone.
            </p>


            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={actionLoading}
                style={{
                  background: "#fff", border: "1px solid #000", padding: "10px 18px",
                  fontSize: "0.8rem", fontWeight: 800, cursor: "pointer", textTransform: "uppercase"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={actionLoading}
                style={{
                  background: "#dc2626", color: "#fff", border: "none",
                  padding: "10px 20px", fontSize: "0.8rem", fontWeight: 900,
                  cursor: "pointer", textTransform: "uppercase"
                }}
              >
                {actionLoading ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
