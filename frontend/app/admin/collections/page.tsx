"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useAdminAuth } from "@/context/AdminAuthContext";
import {
  getAdminCollections, createAdminCollection, updateAdminCollection, deleteAdminCollection,
  getAdminProducts, manageCollectionProducts,
  type AdminCollection, type AdminProductSummary, type PaginatedResponse
} from "@/lib/api/admin";
import { clientCache } from "@/lib/api/cache";
import { uploadFileToS3 } from "@/lib/s3";

export default function AdminCollectionsPage() {
  const { adminToken } = useAdminAuth();
  const [page, setPage] = useState(1);

  const cachePath = `/admin/collections?page=${page}`;
  const cacheKey = adminToken ? `admin:${adminToken.slice(0, 10)}:${cachePath}` : "";
  const initialData = cacheKey ? clientCache.get<PaginatedResponse<AdminCollection>>(cacheKey) : null;

  const [data, setData] = useState<PaginatedResponse<AdminCollection> | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", handle: "", description: "", image_url: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Cover Image Drag & Drop Staging ──
  const [stagedImageFile, setStagedImageFile] = useState<File | null>(null);
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Manage Products state ──
  const [managingCollectionId, setManagingCollectionId] = useState<number | null>(null);
  const [managingTitle, setManagingTitle] = useState("");
  const [, setProductSearch] = useState("");
  const [productSearchInput, setProductSearchInput] = useState("");
  const [productResults, setProductResults] = useState<AdminProductSummary[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [attachedProducts, setAttachedProducts] = useState<AdminProductSummary[]>([]);
  const [selectedToAttach, setSelectedToAttach] = useState<number[]>([]);
  const [manageError, setManageError] = useState("");
  const [manageSaving, setManageSaving] = useState(false);

  function handleImageSelect(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    setError("");
    if (stagedPreviewUrl && stagedPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(stagedPreviewUrl);
    }
    const localUrl = URL.createObjectURL(file);
    setStagedImageFile(file);
    setStagedPreviewUrl(localUrl);
  }

  function handleRemoveImage() {
    if (stagedPreviewUrl && stagedPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(stagedPreviewUrl);
    }
    setStagedImageFile(null);
    setStagedPreviewUrl(null);
    setForm(f => ({ ...f, image_url: "" }));
  }

  async function load(isSilent = false) {
    if (!adminToken) return;
    if (!isSilent && !data) setLoading(true);
    try {
      const res = await getAdminCollections(adminToken, { page });
      setData(res);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(!!initialData); }, [adminToken, page]);

  // ── Fetch attached + all products when a collection is opened for management ──
  const loadManagePanel = useCallback(async (collectionId: number) => {
    if (!adminToken) return;
    setSearchLoading(true);
    setManageError("");
    setSelectedToAttach([]);
    try {
      const res = await getAdminProducts(adminToken, { page: 1 });
      setProductResults(res.items);
      setAttachedProducts([]);
    } catch (e: unknown) {
      setManageError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setSearchLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    if (managingCollectionId !== null) {
      setProductSearch("");
      setProductSearchInput("");
      loadManagePanel(managingCollectionId);
    }
  }, [managingCollectionId]);

  async function handleProductSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!adminToken) return;
    setSearchLoading(true);
    setProductSearch(productSearchInput);
    try {
      const res = await getAdminProducts(adminToken, { search: productSearchInput || undefined });
      setProductResults(res.items);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleAttach() {
    if (!adminToken || !managingCollectionId || selectedToAttach.length === 0) return;
    setManageSaving(true);
    setManageError("");
    try {
      await manageCollectionProducts(adminToken, managingCollectionId, selectedToAttach, "attach");
      setSelectedToAttach([]);
      load();
    } catch (e: unknown) {
      setManageError(e instanceof Error ? e.message : "Failed to attach products");
    } finally {
      setManageSaving(false);
    }
  }

  async function handleDetach(productId: number) {
    if (!adminToken || !managingCollectionId) return;
    setManageSaving(true);
    setManageError("");
    try {
      await manageCollectionProducts(adminToken, managingCollectionId, [productId], "detach");
      setAttachedProducts(prev => prev.filter(p => p.id !== productId));
      load();
    } catch (e: unknown) {
      setManageError(e instanceof Error ? e.message : "Failed to detach product");
    } finally {
      setManageSaving(false);
    }
  }

  async function handleSave() {
    if (!adminToken) return;
    setSaving(true);
    setError("");
    try {
      let finalImageUrl = form.image_url;

      // Upload image ONLY when Save / Update Collection is clicked
      if (stagedImageFile) {
        const uploaded = await uploadFileToS3(stagedImageFile, "collections", adminToken);
        if (uploaded.url) {
          finalImageUrl = uploaded.url;
        }
      }

      const payload = { ...form, image_url: finalImageUrl };

      if (editingId) {
        await updateAdminCollection(adminToken, editingId, payload);
      } else {
        await createAdminCollection(adminToken, payload);
      }

      setShowForm(false);
      setEditingId(null);
      setStagedImageFile(null);
      setStagedPreviewUrl(null);
      setForm({ title: "", handle: "", description: "", image_url: "" });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save collection");
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
        <button className="admin-btn admin-btn--primary" onClick={() => { setShowForm(true); setEditingId(null); setStagedImageFile(null); setStagedPreviewUrl(null); setForm({ title: "", handle: "", description: "", image_url: "" }); }}>
          + New Collection
        </button>
      </div>

      {/* ── Create / Edit Form ── */}
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

            {/* Drag & Drop Cover Image Uploader */}
            <div className="admin-form-group admin-form-group--full">
              <label className="admin-form-label">Cover Image</label>
              {stagedPreviewUrl || form.image_url ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 14, border: '1px solid var(--admin-border)', borderRadius: 8, background: 'var(--admin-surface)' }}>
                  <div style={{ width: 80, height: 80, position: 'relative', overflow: 'hidden', borderRadius: 6, border: '1px solid var(--admin-border)', flexShrink: 0, background: '#000' }}>
                    <Image
                      src={stagedPreviewUrl || form.image_url}
                      alt="Collection cover"
                      fill
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.85rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stagedImageFile ? stagedImageFile.name : "Current Cover Image"}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', margin: '2px 0 0' }}>
                      {stagedImageFile ? "✦ Selected for upload (Uploads to storage on Save)" : "✦ Active collection image"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    style={{ color: '#dc2626', borderColor: 'rgba(220,38,38,0.2)' }}
                    onClick={handleRemoveImage}
                  >
                    ✕ Remove Image
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleImageSelect(e.dataTransfer.files);
                    }
                  }}
                  onClick={() => document.getElementById("collection-image-file-input")?.click()}
                  style={{
                    border: `2px dashed ${isDragOver ? 'var(--admin-accent)' : 'var(--admin-border)'}`,
                    background: isDragOver ? 'rgba(58,54,153,0.05)' : 'var(--admin-surface)',
                    borderRadius: 8,
                    padding: '24px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <input
                    id="collection-image-file-input"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => handleImageSelect(e.target.files)}
                  />
                  <div style={{ width: 40, height: 40, margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(58,54,153,0.08)', color: 'var(--admin-accent)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                  <p style={{ fontWeight: 600, fontSize: '0.85rem', margin: '0 0 4px' }}>
                    Drag & drop cover image here, or <span style={{ color: 'var(--admin-accent)', textDecoration: 'underline' }}>browse file</span>
                  </p>
                  <p style={{ fontSize: '0.74rem', color: 'var(--admin-text-muted)', margin: 0 }}>
                    Supports PNG, JPG, WebP — Uploads to storage when you click {editingId ? "Update" : "Create"}
                  </p>
                </div>
              )}
            </div>

            <div className="admin-form-group admin-form-group--full">
              <label className="admin-form-label">Description</label>
              <textarea className="admin-form-textarea" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="admin-form-actions">
            <button className="admin-btn admin-btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? <span className="admin-btn-spinner" /> : (editingId ? "Update Collection" : "Create Collection")}
            </button>
            <button className="admin-btn admin-btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Collections Table ── */}
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
                  <>
                    <tr key={col.id}>
                      <td className="admin-table-name">{col.title}</td>
                      <td><code className="admin-code">{col.handle}</code></td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: 'var(--admin-surface)', border: '1px solid var(--admin-border)',
                          padding: '2px 10px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 600
                        }}>
                          {col.products_count}
                        </span>
                      </td>
                      <td>
                        <div className="admin-table-actions">
                          {/* Manage Products */}
                          <button
                            className="admin-icon-btn"
                            title="Manage Products"
                            style={{ color: managingCollectionId === col.id ? 'var(--admin-accent)' : undefined }}
                            onClick={() => {
                              if (managingCollectionId === col.id) {
                                setManagingCollectionId(null);
                              } else {
                                setManagingCollectionId(col.id);
                                setManagingTitle(col.title);
                              }
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="12" y1="9" x2="12" y2="15" />
                            </svg>
                          </button>
                          {/* Edit */}
                          <button className="admin-icon-btn" title="Edit" onClick={() => { setEditingId(col.id); setStagedImageFile(null); setStagedPreviewUrl(null); setForm({ title: col.title, handle: col.handle, description: col.description || "", image_url: col.image_url || "" }); setShowForm(true); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </button>
                          {/* Delete */}
                          <button className="admin-icon-btn admin-icon-btn--danger" title="Delete" onClick={() => handleDelete(col.id, col.title)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ── Manage Products Accordion Panel ── */}
                    {managingCollectionId === col.id && (
                      <tr key={`manage-${col.id}`}>
                        <td colSpan={4} style={{ padding: 0, borderTop: '2px solid var(--admin-accent)' }}>
                          <div style={{
                            background: 'var(--admin-surface)',
                            padding: '24px 28px',
                            borderBottom: '1px solid var(--admin-border)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                              <div>
                                <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>Manage Products</p>
                                <p style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)', margin: '2px 0 0' }}>
                                  Search for products and attach/detach them from <strong>{managingTitle}</strong>
                                </p>
                              </div>
                              <button className="admin-icon-btn" title="Close" onClick={() => setManagingCollectionId(null)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                              </button>
                            </div>

                            {manageError && <div className="admin-alert admin-alert--error" style={{ marginBottom: 14 }}>{manageError}</div>}

                            {/* Product search */}
                            <form onSubmit={handleProductSearch} style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                              <input
                                type="text"
                                className="admin-form-input"
                                placeholder="Search products by name…"
                                value={productSearchInput}
                                onChange={e => setProductSearchInput(e.target.value)}
                                style={{ flex: 1 }}
                              />
                              <button type="submit" className="admin-btn admin-btn--ghost" disabled={searchLoading}>
                                {searchLoading ? <span className="admin-btn-spinner" /> : "Search"}
                              </button>
                            </form>

                            {/* Product results */}
                            {productResults.length > 0 && (
                              <div style={{ marginBottom: 16 }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', marginBottom: 10 }}>
                                  Results ({productResults.length})
                                </p>
                                <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--admin-border)', borderRadius: 6 }}>
                                  {productResults.map(p => {
                                    const isSelected = selectedToAttach.includes(p.id);
                                    return (
                                      <div
                                        key={p.id}
                                        onClick={() => setSelectedToAttach(prev =>
                                          isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                        )}
                                        style={{
                                          display: 'flex', alignItems: 'center', gap: 12,
                                          padding: '10px 14px',
                                          cursor: 'pointer',
                                          borderBottom: '1px solid var(--admin-border)',
                                          background: isSelected ? 'rgba(var(--admin-accent-rgb, 58,54,153), 0.06)' : 'transparent',
                                          transition: 'background 0.15s',
                                        }}
                                      >
                                        <div style={{
                                          width: 18, height: 18, border: `2px solid ${isSelected ? 'var(--admin-accent)' : 'var(--admin-border)'}`,
                                          borderRadius: 3, background: isSelected ? 'var(--admin-accent)' : 'transparent',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                        }}>
                                          {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</p>
                                          <p style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)', margin: '1px 0 0' }}>{p.handle}</p>
                                        </div>
                                        <span style={{
                                          fontSize: '0.68rem', fontWeight: 700,
                                          padding: '2px 8px', borderRadius: 3,
                                          background: p.available_for_sale ? '#ecfdf5' : '#fef2f2',
                                          color: p.available_for_sale ? '#15803d' : '#b91c1c',
                                        }}>
                                          {p.available_for_sale ? 'Active' : 'Inactive'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>

                                {selectedToAttach.length > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                                    <span style={{ fontSize: '0.82rem', color: 'var(--admin-text-muted)' }}>
                                      {selectedToAttach.length} product{selectedToAttach.length !== 1 ? 's' : ''} selected
                                    </span>
                                    <button
                                      className="admin-btn admin-btn--primary"
                                      onClick={handleAttach}
                                      disabled={manageSaving}
                                      style={{ fontSize: '0.78rem', padding: '6px 16px' }}
                                    >
                                      {manageSaving ? <span className="admin-btn-spinner" /> : `Attach ${selectedToAttach.length} Product${selectedToAttach.length !== 1 ? 's' : ''} →`}
                                    </button>
                                    <button className="admin-btn admin-btn--ghost" onClick={() => setSelectedToAttach([])} style={{ fontSize: '0.78rem', padding: '6px 14px' }}>
                                      Clear
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Attached products */}
                            {attachedProducts.length > 0 && (
                              <div>
                                <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', marginBottom: 10 }}>
                                  Currently Attached ({attachedProducts.length})
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {attachedProducts.map(p => (
                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid var(--admin-border)', borderRadius: 6, background: '#fff' }}>
                                      <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600 }}>{p.title}</span>
                                      <button
                                        className="admin-icon-btn admin-icon-btn--danger"
                                        title="Remove from collection"
                                        onClick={() => handleDetach(p.id)}
                                        disabled={manageSaving}
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {!searchLoading && productResults.length === 0 && (
                              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--admin-text-muted)', fontSize: '0.85rem' }}>
                                Search for products above to add them to this collection.
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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
