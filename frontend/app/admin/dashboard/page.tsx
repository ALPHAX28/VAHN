"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { getDashboardStats, type DashboardStats } from "@/lib/api/admin";
import AdminStatsCard from "@/components/admin/AdminStatsCard";
import AdminBadge from "@/components/admin/AdminBadge";
import Link from "next/link";

import { clientCache } from "@/lib/api/cache";

export default function AdminDashboardPage() {
  const { adminToken, adminUser } = useAdminAuth();
  const cacheKey = adminToken ? `admin:${adminToken.slice(0, 10)}:/admin/dashboard/stats` : "";
  const initialStats = cacheKey ? clientCache.get<DashboardStats>(cacheKey) : null;
  const [stats, setStats] = useState<DashboardStats | null>(initialStats);
  const [loading, setLoading] = useState(!initialStats);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!adminToken) return;
    getDashboardStats(adminToken)
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [adminToken]);

  const statCards = stats ? [
    { label: "Total Revenue", value: `₹${stats.total_revenue.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`, icon: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", color: "green" as const, subLabel: "All time" },
    { label: "Total Orders", value: stats.total_orders, icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2", color: "blue" as const, subLabel: `${stats.pending_orders} pending` },
    { label: "Customers", value: stats.total_users, icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", color: "purple" as const, subLabel: "Registered" },
    { label: "Products", value: stats.total_products, icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", color: "amber" as const, subLabel: "In catalogue" },
  ] : [];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{greeting}, {adminUser?.full_name?.split(" ")[0] || "Admin"} 👋</h1>
          <p className="admin-page-subtitle">Here's what's happening with your store today.</p>
        </div>

      </div>

      {loading && (
        <div className="admin-loading-row">
          <div className="admin-loading-spinner" />
          <span>Loading dashboard...</span>
        </div>
      )}

      {error && <div className="admin-alert admin-alert--error">{error}</div>}

      {stats && (
        <>
          <AdminStatsCard cards={statCards} />

          <div className="admin-dashboard-grid">
            {/* Recent Orders */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h2 className="admin-card-title">Recent Orders</h2>
                <Link href="/admin/orders" className="admin-card-action">View all →</Link>
              </div>
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_orders.length === 0 && (
                      <tr><td colSpan={5} className="admin-table-empty">No orders yet</td></tr>
                    )}
                    {stats.recent_orders.map(order => (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/admin/orders/${order.id}`} className="admin-table-link">
                            {order.id}
                          </Link>
                        </td>
                        <td>
                          <div className="admin-table-name">{order.user_name}</div>
                          <div className="admin-table-sub">{order.user_email}</div>
                        </td>
                        <td>₹{order.total_amount.toLocaleString("en-IN")}</td>
                        <td><AdminBadge label={order.status} /></td>
                        <td>{order.created_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Products */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h2 className="admin-card-title">Top Products</h2>
                <Link href="/admin/products" className="admin-card-action">View all →</Link>
              </div>
              {stats.top_products.length === 0 ? (
                <p className="admin-empty-state">No sales data yet</p>
              ) : (
                <div className="admin-top-products">
                  {stats.top_products.map((p, i) => (
                    <div key={p.product_title} className="admin-top-product-row">
                      <span className="admin-top-product-rank">#{i + 1}</span>
                      <div className="admin-top-product-info">
                        <span className="admin-top-product-title">{p.product_title}</span>
                        <span className="admin-top-product-sub">{p.total_sold} sold</span>
                      </div>
                      <span className="admin-top-product-revenue">
                        ₹{p.total_revenue.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Inventory & Out of Stock Alerts */}
          <div className="admin-card" style={{ marginTop: 24 }}>
            <div className="admin-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(229, 57, 53, 0.1)", color: "#c62828", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <div>
                  <h2 className="admin-card-title" style={{ margin: 0 }}>Inventory & Stock Alerts</h2>
                  <p className="admin-table-sub" style={{ margin: 0 }}>Variants with low stock (≤ 5) or completely out of stock</p>
                </div>
              </div>
              <Link href="/admin/products" className="admin-card-action">Manage Products →</Link>
            </div>

            <div className="admin-table-wrapper" style={{ marginTop: 16 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Variant / Size</th>
                    <th>Remaining Stock</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(!stats.stock_alerts || stats.stock_alerts.length === 0) && (
                    <tr><td colSpan={5} className="admin-table-empty">All inventory levels healthy (no out-of-stock items)</td></tr>
                  )}
                  {stats.stock_alerts?.map(alert => (
                    <tr key={`${alert.product_id}-${alert.variant_id}`}>
                      <td>
                        <Link href={`/admin/products/${alert.product_id}`} className="admin-table-link">
                          <strong>{alert.product_title}</strong>
                        </Link>
                      </td>
                      <td>
                        <span className="admin-code">{alert.variant_title}</span>
                      </td>
                      <td>
                        <strong style={{ color: alert.is_out_of_stock ? "#c62828" : "#c77b00" }}>
                          {alert.inventory_quantity} {alert.inventory_quantity === 1 ? "unit" : "units"}
                        </strong>
                      </td>
                      <td>
                        {alert.is_out_of_stock ? (
                          <AdminBadge label="OUT OF STOCK" variant="CANCELLED" />
                        ) : (
                          <AdminBadge label={`LOW STOCK (${alert.inventory_quantity} LEFT)`} variant="amber" />
                        )}
                      </td>
                      <td>
                        <Link href={`/admin/products/${alert.product_id}`} className="admin-btn admin-btn--ghost" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
                          Update Stock ↗
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
