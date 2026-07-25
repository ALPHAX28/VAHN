"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { getAdminCollections, createAdminCollection, updateAdminCollection, deleteAdminCollection, type AdminCollection, type PaginatedResponse } from "@/lib/api/admin";

export default function AdminCollectionsPage() {
  const { adminToken } = useAdminAuth();
  const [data, setData] = useState<PaginatedResponse<AdminCollection> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", handle: "", description: "", image_url: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!adminToken) return;
    setLoading(true);
    try {
      const res = await getAdminCollections(adminToken, { page });
      setData(res);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [adminToken, page]);

  async function handleSave() {
    if (!adminToken) return;
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await updateAdminCollection(adminToken, editingId, form);
      } else {
        await createAdminCollection(adminToken, form);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ title: "", handle: "", description: "", image_url: "" });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, title: string) {
    if (!adminToken || !confirm(`Delete collection "${title}"?`)) return;
    await deleteAdminCollection(adminToken, id);
    load();
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Collections</h1>
          <p className="admin-page-subtitle">{data?.total || 0} collections</p>
        </div>
        <button className="admin-btn admin-btn--primary" onClick={() => { setShowForm(true); setEditingId(null); setForm({ title: "", handle: "", description: "", image_url: "" }); }}>
          + New Collection
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="admin-card">
          <h2 className="admin-card-section-title">{editingId ? "Edit Collection" : "New Collection"}</h2>
          {error && <div className="admin-alert admin-alert--error">{error}</div>}
          <div className="admin-form-grid">
            <div className="admin-form-group">
              <label className="admin-form-label">Title</label>
              <input type="text" className="admin-form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Jerseys" />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Handle</label>
              <input type="text" className="admin-form-input" value={form.handle} onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} placeholder="e.g. jerseys" />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Cover Image URL</label>
              <input type="url" className="admin-form-input" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="admin-form-group admin-form-group--full">
              <label className="admin-form-label">Description</label>
              <textarea className="admin-form-textarea" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="admin-form-actions">
            <button className="admin-btn admin-btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? <span className="admin-btn-spinner" /> : (editingId ? "Update" : "Create")} Collection
            </button>
            <button className="admin-btn admin-btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="admin-card">
        {loading ? (
          <div className="admin-loading-row"><div className="admin-loading-spinner" /></div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Handle</th>
                  <th>Products</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(!data?.items || data.items.length === 0) && (
                  <tr><td colSpan={4} className="admin-table-empty">No collections yet</td></tr>
                )}
                {data?.items.map(col => (
                  <tr key={col.id}>
                    <td className="admin-table-name">{col.title}</td>
                    <td><code className="admin-code">{col.handle}</code></td>
                    <td>{col.products_count}</td>
                    <td>
                      <div className="admin-table-actions">
                        <button className="admin-icon-btn" title="Edit" onClick={() => { setEditingId(col.id); setForm({ title: col.title, handle: col.handle, description: col.description || "", image_url: col.image_url || "" }); setShowForm(true); }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="admin-icon-btn admin-icon-btn--danger" title="Delete" onClick={() => handleDelete(col.id, col.title)}>
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
    </div>
  );
}
