"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { getAdminProducts, deleteAdminProduct, type AdminProductSummary, type PaginatedResponse } from "@/lib/api/admin";
import AdminBadge from "@/components/admin/AdminBadge";
import Link from "next/link";
import Image from "next/image";

export default function AdminProductsPage() {
  const { adminToken } = useAdminAuth();
  const [data, setData] = useState<PaginatedResponse<AdminProductSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");

  async function load() {
    if (!adminToken) return;
    setLoading(true);
    try {
      const res = await getAdminProducts(adminToken, { page, search: search || undefined });
      setData(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [adminToken, page, search]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  async function handleDeactivate(id: number) {
    if (!adminToken || !confirm("Deactivate this product?")) return;
    await deleteAdminProduct(adminToken, id, false);
    load();
  }

  async function handleDelete(id: number) {
    if (!adminToken || !confirm("Permanently DELETE this product? This cannot be undone.")) return;
    await deleteAdminProduct(adminToken, id, true);
    load();
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Products</h1>
          <p className="admin-page-subtitle">{data?.total || 0} products in catalogue</p>
        </div>
        <Link href="/admin/products/new" className="admin-btn admin-btn--primary">
          + Add Product
        </Link>
      </div>

      {/* Search */}
      <form className="admin-search-bar" onSubmit={handleSearch}>
        <input
          type="text"
          className="admin-search-input"
          placeholder="Search products by title..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
        <button type="submit" className="admin-btn admin-btn--secondary">Search</button>
        {search && <button type="button" className="admin-btn admin-btn--ghost" onClick={() => { setSearch(""); setSearchInput(""); }}>Clear</button>}
      </form>

      <div className="admin-card">
        {loading ? (
          <div className="admin-loading-row"><div className="admin-loading-spinner" /><span>Loading...</span></div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Handle</th>
                  <th>Type</th>
                  <th>Variants</th>
                  <th>Status</th>
                  <th>Tags</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(!data?.items || data.items.length === 0) && (
                  <tr><td colSpan={7} className="admin-table-empty">No products found</td></tr>
                )}
                {data?.items.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="admin-table-product">
                        {p.featured_image_url ? (
                          <Image src={p.featured_image_url} alt={p.title} width={40} height={40} className="admin-product-thumb" />
                        ) : (
                          <div className="admin-product-thumb-placeholder" />
                        )}
                        <div>
                          <Link href={`/admin/products/${p.id}`} className="admin-table-link">{p.title}</Link>
                          <div className="admin-table-sub">{p.vendor}</div>
                        </div>
                      </div>
                    </td>
                    <td><code className="admin-code">{p.handle}</code></td>
                    <td>{p.product_type || "—"}</td>
                    <td>{p.variants_count}</td>
                    <td>
                      <AdminBadge
                        label={p.available_for_sale ? "available" : "unavailable"}
                        variant={p.available_for_sale ? "available" : "unavailable"}
                      />
                    </td>
                    <td>
                      <div className="admin-tags-cell">
                        {(p.tags || []).slice(0, 2).map(t => (
                          <span key={t} className="admin-tag">{t}</span>
                        ))}
                        {(p.tags || []).length > 2 && <span className="admin-tag">+{p.tags.length - 2}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="admin-table-actions">
                        <Link href={`/admin/products/${p.id}`} className="admin-icon-btn" title="Edit">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </Link>
                        <button className="admin-icon-btn admin-icon-btn--warning" title="Deactivate" onClick={() => handleDeactivate(p.id)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                        </button>
                        <button className="admin-icon-btn admin-icon-btn--danger" title="Delete permanently" onClick={() => handleDelete(p.id)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
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
