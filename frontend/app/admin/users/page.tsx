"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { getAdminUsers, suspendUser, reactivateUser, deleteAdminUser, type AdminUser, type PaginatedResponse } from "@/lib/api/admin";
import AdminBadge from "@/components/admin/AdminBadge";
import Link from "next/link";

export default function AdminUsersPage() {
  const { adminToken } = useAdminAuth();
  const [data, setData] = useState<PaginatedResponse<AdminUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [suspendModal, setSuspendModal] = useState<{ userId: number; email: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  async function load() {
    if (!adminToken) return;
    setLoading(true);
    try {
      const res = await getAdminUsers(adminToken, { page, search: search || undefined, role: "customer" });
      setData(res);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [adminToken, page, search]);

  async function handleSuspend() {
    if (!adminToken || !suspendModal) return;
    await suspendUser(adminToken, suspendModal.userId, suspendReason);
    setSuspendModal(null);
    setSuspendReason("");
    load();
  }

  async function handleReactivate(userId: number) {
    if (!adminToken) return;
    await reactivateUser(adminToken, userId);
    load();
  }

  async function handleDelete(userId: number, email: string) {
    if (!adminToken || !confirm(`Permanently delete user ${email}? This cannot be undone.`)) return;
    await deleteAdminUser(adminToken, userId);
    load();
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
                        <Link href={`/admin/users/${user.id}`} className="admin-icon-btn" title="View">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </Link>
                        {user.is_active ? (
                          <button className="admin-icon-btn admin-icon-btn--warning" title="Suspend" onClick={() => setSuspendModal({ userId: user.id, email: user.email })}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                          </button>
                        ) : (
                          <button className="admin-icon-btn admin-icon-btn--success" title="Reactivate" onClick={() => handleReactivate(user.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                        )}
                        <button className="admin-icon-btn admin-icon-btn--danger" title="Delete" onClick={() => handleDelete(user.id, user.email)}>
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

      {/* Suspend Modal */}
      {suspendModal && (
        <div className="admin-modal-overlay" onClick={() => setSuspendModal(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3 className="admin-modal-title">Suspend Account</h3>
            <p className="admin-modal-desc">Suspending <strong>{suspendModal.email}</strong> will prevent them from logging in.</p>
            <div className="admin-form-group">
              <label className="admin-form-label">Reason (optional)</label>
              <textarea className="admin-form-textarea" rows={3} value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="e.g. Suspicious activity" />
            </div>
            <div className="admin-modal-actions">
              <button className="admin-btn admin-btn--ghost" onClick={() => setSuspendModal(null)}>Cancel</button>
              <button className="admin-btn admin-btn--danger" onClick={handleSuspend}>Suspend Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
