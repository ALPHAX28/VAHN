"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import {
  getAdminReviews,
  getProductReviews,
  getAdminProducts,
  updateAdminReview,
  deleteAdminReview,
  createAdminReview,
  type AdminReview,
  type AdminProductSummary,
  type PaginatedResponse,
} from "@/lib/api/admin";
import AdminBadge from "@/components/admin/AdminBadge";
import Image from "next/image";

import { clientCache } from "@/lib/api/cache";

interface ProductReviewGroup {
  productId: number;
  productTitle: string;
  featuredImageUrl?: string | null;
  totalReviews: number;
  avgRating: number;
  hiddenCount: number;
  approvedCount: number;
}

export default function AdminReviewsPage() {
  const { adminToken } = useAdminAuth();
  const [viewMode, setViewMode] = useState<"products" | "all">("products");

  // Products with reviews
  const [productsList, setProductsList] = useState<AdminProductSummary[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductReviewGroup | null>(null);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [hiddenFilter, setHiddenFilter] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(1);

  const cachePath = selectedProduct 
    ? `/admin/products/${selectedProduct.productId}/reviews?page=${page}` 
    : `/admin/reviews?page=${page}${hiddenFilter !== undefined ? `&is_hidden=${hiddenFilter}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`;
  const cacheKey = adminToken ? `admin:${adminToken.slice(0, 10)}:${cachePath}` : "";
  const initialData = cacheKey ? clientCache.get<PaginatedResponse<AdminReview>>(cacheKey) : null;

  const [reviewsData, setReviewsData] = useState<PaginatedResponse<AdminReview> | null>(initialData);
  const [loading, setLoading] = useState(!initialData);

  // Edit / Add Modal States
  const [editing, setEditing] = useState<AdminReview | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editRating, setEditRating] = useState(5);
  const [showAddReview, setShowAddReview] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, author: "", content: "", title: "", verified: true, is_approved: true });

  // Load product catalog
  useEffect(() => {
    if (!adminToken) return;
    getAdminProducts(adminToken, { page: 1 })
      .then(res => setProductsList(res.items))
      .catch(() => {});
  }, [adminToken]);

  // Load reviews list
  async function loadReviews(isSilent = false) {
    if (!adminToken) return;
    if (!isSilent && !reviewsData) setLoading(true);
    try {
      if (selectedProduct) {
        // Fetch reviews specifically for the selected product
        const res = await getProductReviews(adminToken, selectedProduct.productId, page);
        setReviewsData(res);
      } else {
        // Fetch all reviews
        const res = await getAdminReviews(adminToken, { page, search: search || undefined, is_hidden: hiddenFilter });
        setReviewsData(res);
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { loadReviews(!!initialData); }, [adminToken, page, search, hiddenFilter, selectedProduct]);

  // Group reviews by product for Product-Wise overview
  const productGroupsMap = new Map<number, ProductReviewGroup>();

  // 1. Initialize map with all products in store
  for (const p of productsList) {
    productGroupsMap.set(p.id, {
      productId: p.id,
      productTitle: p.title,
      featuredImageUrl: p.featured_image_url || null,
      totalReviews: 0,
      avgRating: 0,
      hiddenCount: 0,
      approvedCount: 0,
    });
  }

  // 2. Aggregate reviews per product
  if (reviewsData?.items) {
    for (const r of reviewsData.items) {
      const existing = productGroupsMap.get(r.product_id);
      if (existing) {
        const newTotal = existing.totalReviews + 1;
        existing.avgRating = (existing.avgRating * existing.totalReviews + r.rating) / newTotal;
        existing.totalReviews = newTotal;
        if (r.is_hidden) existing.hiddenCount += 1;
        if (r.is_approved) existing.approvedCount += 1;
      } else {
        productGroupsMap.set(r.product_id, {
          productId: r.product_id,
          productTitle: r.product_title,
          featuredImageUrl: null,
          totalReviews: 1,
          avgRating: r.rating,
          hiddenCount: r.is_hidden ? 1 : 0,
          approvedCount: r.is_approved ? 1 : 0,
        });
      }
    }
  }

  const productGroups = Array.from(productGroupsMap.values());

  // Review Actions
  async function handleToggleHide(review: AdminReview) {
    if (!adminToken) return;
    await updateAdminReview(adminToken, review.id, { is_hidden: !review.is_hidden });
    loadReviews();
  }

  async function handleToggleApprove(review: AdminReview) {
    if (!adminToken) return;
    await updateAdminReview(adminToken, review.id, { is_approved: !review.is_approved });
    loadReviews();
  }

  async function handleSaveEdit() {
    if (!adminToken || !editing) return;
    await updateAdminReview(adminToken, editing.id, { content: editContent, rating: editRating });
    setEditing(null);
    loadReviews();
  }

  async function handleDelete(id: number) {
    if (!adminToken || !confirm("Delete this review permanently?")) return;
    await deleteAdminReview(adminToken, id);
    loadReviews();
  }

  async function handleAddReview() {
    if (!adminToken || !selectedProduct) return;
    await createAdminReview(adminToken, selectedProduct.productId, newReview);
    setNewReview({ rating: 5, author: "", content: "", title: "", verified: true, is_approved: true });
    setShowAddReview(false);
    loadReviews();
  }

  function startEdit(review: AdminReview) {
    setEditing(review);
    setEditContent(review.content);
    setEditRating(review.rating);
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">
            {selectedProduct ? `Reviews: ${selectedProduct.productTitle}` : "Reviews Moderation"}
          </h1>
          <p className="admin-page-subtitle">
            {selectedProduct
              ? `Managing ${reviewsData?.total || 0} reviews for this product`
              : "Product-wise review management & moderation"}
          </p>
        </div>

        <div className="admin-header-actions">
          {selectedProduct ? (
            <>
              <button className="admin-btn admin-btn--secondary" onClick={() => setShowAddReview(true)}>
                + Add Review
              </button>
              <button
                className="admin-btn admin-btn--ghost"
                onClick={() => { setSelectedProduct(null); setPage(1); }}
              >
                ← Back to All Products
              </button>
            </>
          ) : (
            <div className="admin-status-tabs">
              <button
                className={`admin-status-tab ${viewMode === "products" ? "admin-status-tab--active" : ""}`}
                onClick={() => setViewMode("products")}
              >
                Product-Wise View
              </button>
              <button
                className={`admin-status-tab ${viewMode === "all" ? "admin-status-tab--active" : ""}`}
                onClick={() => setViewMode("all")}
              >
                All Reviews List
              </button>
            </div>
          )}
        </div>
      </div>

      {/* VIEW MODE 1: PRODUCT-WISE CARDS GRID */}
      {viewMode === "products" && !selectedProduct && (
        <>
          {loading ? (
            <div className="admin-loading-row"><div className="admin-loading-spinner" /></div>
          ) : productGroups.length === 0 ? (
            <div className="admin-card">
              <p className="admin-empty-state">No product reviews found in system</p>
            </div>
          ) : (
            <div className="admin-form-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
              {productGroups.map(group => (
                <div key={group.productId} className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    {group.featuredImageUrl ? (
                      <Image src={group.featuredImageUrl} alt={group.productTitle} width={52} height={52} className="admin-product-thumb" />
                    ) : (
                      <div className="admin-product-thumb-placeholder" style={{ width: 52, height: 52 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {group.productTitle}
                      </h3>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <span className="admin-rating-stars">
                          {group.totalReviews > 0 ? "★".repeat(Math.round(group.avgRating)) : "☆☆☆☆☆"}
                        </span>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: group.totalReviews > 0 ? "inherit" : "var(--admin-text-muted)" }}>
                          {group.totalReviews > 0 ? `${group.avgRating.toFixed(1)} / 5.0` : "No reviews yet"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--admin-card-border)", paddingTop: 10 }}>
                    <span style={{ fontSize: "0.82rem", color: "var(--admin-text-secondary)", fontWeight: 600 }}>
                      {group.totalReviews} {group.totalReviews === 1 ? "Review" : "Reviews"}
                    </span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {group.hiddenCount > 0 && <AdminBadge label={`${group.hiddenCount} Hidden`} variant="CANCELLED" />}
                    </div>
                  </div>

                  <button
                    className="admin-btn admin-btn--primary admin-btn--full"
                    onClick={() => { setSelectedProduct(group); setPage(1); }}
                  >
                    View & Moderate Reviews ({group.totalReviews}) →
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* VIEW MODE 2 & SELECTED PRODUCT: REVIEWS TABLE */}
      {(viewMode === "all" || selectedProduct) && (
        <>
          {/* Filters Bar */}
          <div className="admin-filters-row">
            <div className="admin-status-tabs">
              <button className={`admin-status-tab ${hiddenFilter === undefined ? "admin-status-tab--active" : ""}`} onClick={() => { setHiddenFilter(undefined); setPage(1); }}>All</button>
              <button className={`admin-status-tab ${hiddenFilter === false ? "admin-status-tab--active" : ""}`} onClick={() => { setHiddenFilter(false); setPage(1); }}>Visible</button>
              <button className={`admin-status-tab ${hiddenFilter === true ? "admin-status-tab--active" : ""}`} onClick={() => { setHiddenFilter(true); setPage(1); }}>Hidden</button>
            </div>

            {!selectedProduct && (
              <form className="admin-search-bar" onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1); }}>
                <input type="text" className="admin-search-input" placeholder="Search by author or content..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
                <button type="submit" className="admin-btn admin-btn--secondary">Search</button>
              </form>
            )}
          </div>

          <div className="admin-card">
            {loading ? (
              <div className="admin-loading-row"><div className="admin-loading-spinner" /></div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {!selectedProduct && <th>Product</th>}
                      <th>Author</th>
                      <th>Rating</th>
                      <th>Content</th>
                      <th>Visibility</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!reviewsData?.items || reviewsData.items.length === 0) && (
                      <tr><td colSpan={6} className="admin-table-empty">No reviews found</td></tr>
                    )}
                    {reviewsData?.items.map(review => (
                      <tr key={review.id}>
                        {!selectedProduct && (
                          <td>
                            <div className="admin-table-name">{review.product_title}</div>
                            <div className="admin-table-sub">{review.date}</div>
                          </td>
                        )}
                        <td>
                          <div className="admin-table-name">{review.author}</div>
                          {selectedProduct && <div className="admin-table-sub">{review.date}</div>}
                        </td>
                        <td>
                          <span className="admin-rating-stars">
                            {"★".repeat(Math.round(review.rating))}{"☆".repeat(5 - Math.round(review.rating))}
                          </span>
                        </td>
                        <td>
                          <div className="admin-review-content">{review.content}</div>
                        </td>
                        <td>
                          <div className="admin-review-badges">
                            {review.is_hidden ? <AdminBadge label="Hidden" variant="CANCELLED" /> : <AdminBadge label="Visible" variant="available" />}
                            {review.is_approved ? <AdminBadge label="Approved" variant="DELIVERED" /> : <AdminBadge label="Pending" variant="PROCESSING" />}
                          </div>
                        </td>
                        <td>
                          <div className="admin-table-actions">
                            <button className="admin-icon-btn" title="Edit" onClick={() => startEdit(review)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button className="admin-icon-btn" title={review.is_hidden ? "Show" : "Hide"} onClick={() => handleToggleHide(review)}>
                              {review.is_hidden
                                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                            </button>
                            <button className="admin-icon-btn" title={review.is_approved ? "Unapprove" : "Approve"} onClick={() => handleToggleApprove(review)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                            </button>
                            <button className="admin-icon-btn admin-icon-btn--danger" title="Delete" onClick={() => handleDelete(review.id)}>
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

            {reviewsData && reviewsData.total_pages > 1 && (
              <div className="admin-pagination">
                <button className="admin-btn admin-btn--ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span className="admin-pagination-info">Page {page} of {reviewsData.total_pages}</span>
                <button className="admin-btn admin-btn--ghost" disabled={page === reviewsData.total_pages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Edit Review Modal */}
      {editing && (
        <div className="admin-modal-overlay" onClick={() => setEditing(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3 className="admin-modal-title">Edit Review</h3>
            <div className="admin-form-group">
              <label className="admin-form-label">Rating</label>
              <select className="admin-form-select" value={editRating} onChange={e => setEditRating(Number(e.target.value))}>
                {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} Stars</option>)}
              </select>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Content</label>
              <textarea className="admin-form-textarea" rows={5} value={editContent} onChange={e => setEditContent(e.target.value)} />
            </div>
            <div className="admin-modal-actions">
              <button className="admin-btn admin-btn--ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="admin-btn admin-btn--primary" onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Review Modal */}
      {showAddReview && selectedProduct && (
        <div className="admin-modal-overlay" onClick={() => setShowAddReview(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3 className="admin-modal-title">Add Review for {selectedProduct.productTitle}</h3>
            <div className="admin-form-group">
              <label className="admin-form-label">Author Name</label>
              <input type="text" className="admin-form-input" placeholder="e.g. John Doe" value={newReview.author} onChange={e => setNewReview(r => ({ ...r, author: e.target.value }))} />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Rating</label>
              <select className="admin-form-select" value={newReview.rating} onChange={e => setNewReview(r => ({ ...r, rating: Number(e.target.value) }))}>
                {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} Stars</option>)}
              </select>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Review Content</label>
              <textarea className="admin-form-textarea" rows={4} placeholder="Review text..." value={newReview.content} onChange={e => setNewReview(r => ({ ...r, content: e.target.value }))} />
            </div>
            <div className="admin-modal-actions">
              <button className="admin-btn admin-btn--ghost" onClick={() => setShowAddReview(false)}>Cancel</button>
              <button className="admin-btn admin-btn--primary" onClick={handleAddReview}>Add Review</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
