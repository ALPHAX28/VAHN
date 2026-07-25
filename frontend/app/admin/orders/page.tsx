"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { getAdminOrders, type AdminOrderSummary, type PaginatedResponse } from "@/lib/api/admin";
import AdminBadge from "@/components/admin/AdminBadge";
import Link from "next/link";

import { clientCache } from "@/lib/api/cache";

const STATUS_FILTERS = ["", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

export default function AdminOrdersPage() {
  const { adminToken } = useAdminAuth();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const cachePath = `/admin/orders?page=${page}${status ? `&status=${status}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`;
  const cacheKey = adminToken ? `admin:${adminToken.slice(0, 10)}:${cachePath}` : "";
  const initialData = cacheKey ? clientCache.get<PaginatedResponse<AdminOrderSummary>>(cacheKey) : null;

  const [data, setData] = useState<PaginatedResponse<AdminOrderSummary> | null>(initialData);
  const [loading, setLoading] = useState(!initialData);

  async function load(isSilent = false) {
    if (!adminToken) return;
    if (!isSilent && !data) setLoading(true);
    try {
      const res = await getAdminOrders(adminToken, { page, status: status || undefined, search: search || undefined });
      setData(res);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(!!initialData); }, [adminToken, page, status, search]);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Orders</h1>
          <p className="admin-page-subtitle">{data?.total || 0} total orders</p>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-filters-row">
        <div className="admin-status-tabs">
          {STATUS_FILTERS.map(s => (
            <button key={s || "all"} className={`admin-status-tab ${status === s ? "admin-status-tab--active" : ""}`} onClick={() => { setStatus(s); setPage(1); }}>
              {s || "All"}
            </button>
          ))}
        </div>
        <form className="admin-search-bar" onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1); }}>
          <input type="text" className="admin-search-input" placeholder="Search by order ID or email..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
          <button type="submit" className="admin-btn admin-btn--secondary">Search</button>
        </form>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="admin-loading-row"><div className="admin-loading-spinner" /><span>Loading...</span></div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Refund</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(!data?.items || data.items.length === 0) && (
                  <tr><td colSpan={8} className="admin-table-empty">No orders found</td></tr>
                )}
                {data?.items.map(order => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/admin/orders/${order.id}`} className="admin-table-link">{order.id}</Link>
                    </td>
                    <td>
                      <div className="admin-table-name">{order.user_name}</div>
                      <div className="admin-table-sub">{order.user_email}</div>
                    </td>
                    <td>{order.items_count}</td>
                    <td>₹{order.total_amount.toLocaleString("en-IN")}</td>
                    <td><AdminBadge label={order.status} /></td>
                    <td>{order.refund_status ? <AdminBadge label={order.refund_status} variant={order.refund_status === "REFUNDED" ? "REFUNDED" : "PENDING"} /> : "—"}</td>
                    <td>{order.created_at}</td>
                    <td>
                      <Link href={`/admin/orders/${order.id}`} className="admin-icon-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total_pages > 1 && (
          <div className="admin-pagination">
            <button className="admin-btn admin-btn--ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span className="admin-pagination-info">Page {page} of {data.total_pages}</span>
            <button className="admin-btn admin-btn--ghost" disabled={page === data.total_pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
