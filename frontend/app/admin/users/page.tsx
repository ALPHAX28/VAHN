"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { getAdminUsers, suspendUser, reactivateUser, deleteAdminUser, type AdminUser, type PaginatedResponse } from "@/lib/api/admin";
import AdminBadge from "@/components/admin/AdminBadge";
import Link from "next/link";
import { AlertCircleIcon } from "@/components/icons/Icons";
import { clientCache } from "@/lib/api/cache";

export default function AdminUsersPage() {
  const { adminToken } = useAdminAuth();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const cachePath = `/admin/users?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ""}&role=customer`;
  const cacheKey = adminToken ? `admin:${adminToken.slice(0, 10)}:${cachePath}` : "";
  const initialData = cacheKey ? clientCache.get<PaginatedResponse<AdminUser>>(cacheKey) : null;

  const [data, setData] = useState<PaginatedResponse<AdminUser> | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [suspendModal, setSuspendModal] = useState<{ userId: number; name: string; email: string; is_active: boolean } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [deleteModal, setDeleteModal] = useState<{ userId: number; name: string; email: string } | null>(null);

  async function load(isSilent = false) {
    if (!adminToken) return;
    if (!isSilent && !data) setLoading(true);
    try {
      const res = await getAdminUsers(adminToken, { page, search: search || undefined, role: "customer" });
      setData(res);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(!!initialData); }, [adminToken, page, search]);

  async function handleToggleSuspend() {
    if (!adminToken || !suspendModal) return;
    setActionLoading(true);
    try {
      if (suspendModal.is_active) {
        await suspendUser(adminToken, suspendModal.userId, suspendReason);
      } else {
        await reactivateUser(adminToken, suspendModal.userId);
      }
      setSuspendModal(null);
      setSuspendReason("");
      load(true);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteUser() {
    if (!adminToken || !deleteModal) return;
    setActionLoading(true);
    try {
      await deleteAdminUser(adminToken, deleteModal.userId);
      setDeleteModal(null);
      load(true);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Customers</h1>
          <p className="admin-page-subtitle">{data?.total || 0} registered customers</p>
        </div>
      </div>

      <form className="admin-search-bar" onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1); }}>
        <input type="text" className="admin-search-input" placeholder="Search by name or email..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
        <button type="submit" className="admin-btn admin-btn--secondary">Search</button>
        {search && <button type="button" className="admin-btn admin-btn--ghost" onClick={() => { setSearch(""); setSearchInput(""); }}>Clear</button>}
      </form>

      <div className="admin-card">
        {loading ? (
          <div className="admin-loading-row"><div className="admin-loading-spinner" /></div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Verified</th>
                  <th>Status</th>
                  <th>Orders</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(!data?.items || data.items.length === 0) && (
                  <tr><td colSpan={6} className="admin-table-empty">No customers found</td></tr>
                )}
                {data?.items.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-table-name">
                        <Link href={`/admin/users/${user.id}`} className="admin-table-link">{user.full_name}</Link>
                      </div>
                      <div className="admin-table-sub">{user.email}</div>
                    </td>
                    <td><AdminBadge label={user.is_verified ? "verified" : "unverified"} /></td>
                    <td><AdminBadge label={user.is_active ? "active" : "suspended"} variant={user.is_active ? "active" : "suspended"} /></td>
                    <td>{user.orders_count}</td>
                    <td>{user.created_at}</td>
                    <td>
                      <div className="admin-table-actions">
                        <Link href={`/admin/users/${user.id}`} className="admin-icon-btn" title="View Customer Details">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </Link>
                        {user.is_active ? (
                          <button
                            className="admin-icon-btn admin-icon-btn--warning"
                            title="Suspend Account"
                            onClick={() => {
                              setSuspendReason("");
                              setSuspendModal({ userId: user.id, name: user.full_name || user.email, email: user.email, is_active: true });
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                          </button>
                        ) : (
                          <button
                            className="admin-icon-btn admin-icon-btn--success"
                            title="Reactivate Account"
                            onClick={() => {
                              setSuspendReason("");
                              setSuspendModal({ userId: user.id, name: user.full_name || user.email, email: user.email, is_active: false });
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                        )}
                        <button
                          className="admin-icon-btn admin-icon-btn--danger"
                          title="Delete Customer"
                          onClick={() => setDeleteModal({ userId: user.id, name: user.full_name || user.email, email: user.email })}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                      </div>
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

      {/* Suspend / Reactivate Confirmation Modal */}
      {suspendModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: 20
        }}>
          <div style={{ background: "#fff", width: "100%", maxWidth: 460, padding: 28, border: "2px solid #000", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 900, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: '-0.025em' }}>
              {suspendModal.is_active ? "Suspend Account?" : "Reactivate Account?"}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#555", margin: "0 0 16px", lineHeight: 1.5 }}>
              {suspendModal.is_active
                ? `Are you sure you want to suspend ${suspendModal.name} (${suspendModal.email})? They will be logged out immediately and prevented from logging in.`
                : `Are you sure you want to reactivate ${suspendModal.name} (${suspendModal.email})? They will regain full access to log in and shop.`
              }
            </p>


            {suspendModal.is_active && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: '-0.025em', marginBottom: 6 }}>
                  Suspension Reason (Optional)
                </label>
                <input
                  type="text"
                  value={suspendReason}
                  onChange={e => setSuspendReason(e.target.value)}
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
                onClick={() => setSuspendModal(null)}
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
                  background: suspendModal.is_active ? "#dc2626" : "#16a34a", color: "#fff",
                  border: "none", padding: "10px 20px", fontSize: "0.8rem",
                  fontWeight: 900, cursor: "pointer", textTransform: "uppercase"
                }}
              >
                {actionLoading ? "Processing..." : suspendModal.is_active ? "Confirm Suspension" : "Confirm Reactivation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
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
              Are you sure you want to delete <strong>{deleteModal.name}</strong> ({deleteModal.email})? This action is permanent and cannot be undone.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
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

