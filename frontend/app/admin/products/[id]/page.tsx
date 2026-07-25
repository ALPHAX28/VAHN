"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import {
  getAdminProduct, updateAdminProduct, addVariant, updateVariant, deleteVariant,
  createColourGroup, updateColourGroup, deleteColourGroup, type AdminProductDetail, type AdminVariant, type ColourGroup,
  createAdminReview, getProductReviews, deleteAdminReview, updateAdminReview, type AdminReview
} from "@/lib/api/admin";
import { useUnsavedChanges } from "@/context/UnsavedChangesContext";
import AdminImageUploader from "@/components/admin/AdminImageUploader";
import AdminBadge from "@/components/admin/AdminBadge";
import Link from "next/link";
import Image from "next/image";

const TABS = ["Details", "Variants", "Colour Groups", "Images", "Reviews"];
const FIT_OPTIONS = ["SLIM", "REGULAR", "OVERSIZED"];
const KIT_OPTIONS = ["JERSEY", "HOME", "SIGNATURE"];
const ACTIVITY_OPTIONS = ["FOOTBALL", "LIFESTYLE", "STREETWEAR", "CRICKET", "BASKETBALL"];

export default function AdminProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const productId = parseInt(id, 10);
  const { adminToken } = useAdminAuth();
  const router = useRouter();

  const [product, setProduct] = useState<AdminProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("Details");

  // Edit state
  const [editForm, setEditForm] = useState<Partial<AdminProductDetail>>({});
  const [editSizeFitInput, setEditSizeFitInput] = useState<string>("");

  // Unsaved changes navigation guard modal state
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  // Variant state
  const [newVariant, setNewVariant] = useState({ title: "", colour: "", size: "", price_amount: 0, compare_at_price_amount: "", inventory_quantity: 0, available_for_sale: true, image_url: "" });
  const [editingVariant, setEditingVariant] = useState<string | null>(null);
  const [variantEdits, setVariantEdits] = useState<Record<string, Partial<AdminVariant>>>({});

  // Colour group state
  const [newGroup, setNewGroup] = useState({ colour_value: "", display_order: 0 });
  const [newGroupImages, setNewGroupImages] = useState<{ url: string; altText: string }[]>([]);

  // Reviews
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [newReview, setNewReview] = useState({ rating: 5, author: "", content: "", title: "", verified: true, is_approved: true });

  function extractBullets(html: string): string {
    if (!html) return "";
    const matches = html.match(/<li[^>]*>(.*?)<\/li>/gi);
    if (!matches) return "";
    return matches.map(m => m.replace(/<\/?li[^>]*>/gi, "").trim()).join("\n");
  }

  async function loadProduct() {
    if (!adminToken) return;
    try {
      const p = await getAdminProduct(adminToken, productId);
      setProduct(p);
      setEditForm({
        title: p.title,
        handle: p.handle,
        description: p.description || "",
        vendor: p.vendor,
        product_type: p.product_type || "",
        tags: p.tags || [],
        available_for_sale: p.available_for_sale,
        fit: p.fit || "",
        kit_type: p.kit_type || "",
        activity: p.activity || ""
      });
      setEditSizeFitInput(extractBullets(p.description_html || ""));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load product");
    } finally {
      setLoading(false);
    }
  }

  async function loadReviews() {
    if (!adminToken) return;
    const res = await getProductReviews(adminToken, productId);
    setReviews(res.items);
  }

  useEffect(() => { loadProduct(); loadReviews(); }, [adminToken, productId]);

  const { setDirtyState } = useUnsavedChanges();

  // Compute dirty form state
  const initialBullets = product ? extractBullets(product.description_html || "") : "";
  const isFormDirty = Boolean(
    product && (
      (editForm.title !== undefined && editForm.title !== product.title) ||
      (editForm.handle !== undefined && editForm.handle !== product.handle) ||
      (editForm.description !== undefined && editForm.description !== (product.description || "")) ||
      (editForm.vendor !== undefined && editForm.vendor !== product.vendor) ||
      (editForm.product_type !== undefined && editForm.product_type !== (product.product_type || "")) ||
      (editForm.fit !== undefined && editForm.fit !== (product.fit || "")) ||
      (editForm.kit_type !== undefined && editForm.kit_type !== (product.kit_type || "")) ||
      (editForm.activity !== undefined && editForm.activity !== (product.activity || "")) ||
      (editForm.available_for_sale !== undefined && editForm.available_for_sale !== product.available_for_sale) ||
      editSizeFitInput !== initialBullets
    )
  );

  // Sync with global UnsavedChangesContext
  useEffect(() => {
    setDirtyState(isFormDirty, handleSave, handleDiscardChanges);
  }, [isFormDirty]);

  function handleDiscardChanges() {
    if (!product) return;
    setEditForm({
      title: product.title,
      handle: product.handle,
      description: product.description || "",
      vendor: product.vendor,
      product_type: product.product_type || "",
      tags: product.tags || [],
      available_for_sale: product.available_for_sale,
      fit: product.fit || "",
      kit_type: product.kit_type || "",
      activity: product.activity || ""
    });
    setEditSizeFitInput(extractBullets(product.description_html || ""));
  }

  function handleTabClick(nextTab: string) {
    if (nextTab === activeTab) return;
    if (isFormDirty) {
      setPendingTab(nextTab);
      setShowUnsavedModal(true);
    } else {
      setActiveTab(nextTab);
    }
  }

  async function handleSave() {
    if (!adminToken || !product) return;
    setSaving(true);
    setError(""); setSuccess("");
    try {
      const bullets = editSizeFitInput.split("\n").map(b => b.trim()).filter(Boolean);
      const description_html = `<p>${editForm.description || ""}</p>${bullets.length > 0 ? `<ul>${bullets.map(b => `<li>${b}</li>`).join("")}</ul>` : ""}`;

      const updated = await updateAdminProduct(adminToken, productId, {
        ...editForm,
        description_html,
        tags: Array.isArray(editForm.tags) ? editForm.tags : (editForm.tags as unknown as string || "").split(",").map((t: string) => t.trim()),
      });
      setProduct(updated);
      setSuccess("Product saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleModalSaveAndProceed() {
    const ok = await handleSave();
    if (ok && pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
      setShowUnsavedModal(false);
    }
  }

  function handleModalDiscardAndProceed() {
    handleDiscardChanges();
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
    setShowUnsavedModal(false);
  }

  // Variant CRUD
  async function handleAddVariant() {
    if (!adminToken || !product) return;
    const selectedOptions: { name: string; value: string }[] = [];
    if (newVariant.colour) selectedOptions.push({ name: "Colour", value: newVariant.colour });
    if (newVariant.size) selectedOptions.push({ name: "Size", value: newVariant.size });
    try {
      await addVariant(adminToken, productId, {
        title: newVariant.title || [newVariant.colour, newVariant.size].filter(Boolean).join(" / ") || "Default",
        price_amount: Number(newVariant.price_amount),
        compare_at_price_amount: newVariant.compare_at_price_amount ? Number(newVariant.compare_at_price_amount) : null,
        inventory_quantity: Number(newVariant.inventory_quantity),
        available_for_sale: newVariant.available_for_sale,
        image_url: newVariant.image_url || null,
        selected_options: selectedOptions,
      });
      setNewVariant({ title: "", colour: "", size: "", price_amount: 0, compare_at_price_amount: "", inventory_quantity: 0, available_for_sale: true, image_url: "" });
      await loadProduct();
      setSuccess("Variant added!");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to add variant"); }
  }

  async function handleSaveVariant(variantId: string) {
    if (!adminToken) return;
    const patch = variantEdits[variantId];
    if (!patch) return;
    try {
      await updateVariant(adminToken, productId, variantId, patch);
      setEditingVariant(null);
      await loadProduct();
      setSuccess("Variant updated!");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to update variant"); }
  }

  async function handleDeleteVariant(variantId: string) {
    if (!adminToken || !confirm("Delete this variant?")) return;
    try {
      await deleteVariant(adminToken, productId, variantId);
      await loadProduct();
      setSuccess("Variant deleted!");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to delete variant"); }
  }

  // Colour Group CRUD
  async function handleAddGroup() {
    if (!adminToken || !newGroup.colour_value.trim()) return;
    try {
      await createColourGroup(adminToken, productId, {
        colour_value: newGroup.colour_value.trim(),
        images: newGroupImages,
        display_order: newGroup.display_order
      });
      setNewGroup({ colour_value: "", display_order: 0 });
      setNewGroupImages([]);
      await loadProduct();
      setSuccess("Colour group added!");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to add colour group"); }
  }

  async function handleUpdateGroupImages(groupId: number, images: { url: string; key?: string; name?: string }[]) {
    if (!adminToken) return;
    const formatted = images.map((img, i) => ({ url: img.url, altText: `Photo ${i + 1}` }));
    try {
      await updateColourGroup(adminToken, productId, groupId, { images: formatted });
      await loadProduct();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to update group images"); }
  }

  async function handleDeleteGroup(groupId: number) {
    if (!adminToken || !confirm("Delete colour group?")) return;
    try {
      await deleteColourGroup(adminToken, productId, groupId);
      await loadProduct();
      setSuccess("Group deleted!");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to delete group"); }
  }

  // Reviews CRUD
  async function handleAddReview() {
    if (!adminToken) return;
    try {
      await createAdminReview(adminToken, productId, newReview);
      setNewReview({ rating: 5, author: "", content: "", title: "", verified: true, is_approved: true });
      await loadReviews();
      setSuccess("Review added!");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleToggleReviewHide(review: AdminReview) {
    if (!adminToken) return;
    await updateAdminReview(adminToken, review.id, { is_hidden: !review.is_hidden });
    await loadReviews();
  }

  async function handleDeleteReview(id: number) {
    if (!adminToken || !confirm("Delete review?")) return;
    await deleteAdminReview(adminToken, id);
    await loadReviews();
  }

  if (loading) return <div className="admin-page"><div className="admin-loading-row"><div className="admin-loading-spinner" /><span>Loading product...</span></div></div>;
  if (!product) return <div className="admin-page"><div className="admin-alert admin-alert--error">Product not found</div></div>;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{product.title}</h1>
          <p className="admin-page-subtitle">
            <code className="admin-code">{product.handle}</code> &nbsp;·&nbsp;
            <AdminBadge label={product.available_for_sale ? "available" : "unavailable"} variant={product.available_for_sale ? "available" : "unavailable"} />
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href={`/products/${product.handle}`} target="_blank" className="admin-btn admin-btn--ghost">View on store ↗</Link>
          <button className="admin-btn admin-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? <span className="admin-btn-spinner" /> : "Save Changes"}
          </button>
        </div>
      </div>

      {error && <div className="admin-alert admin-alert--error">{error}</div>}
      {success && <div className="admin-alert admin-alert--success">{success}</div>}

      {/* Tabs */}
      <div className="admin-tabs">
        {TABS.map(tab => (
          <button key={tab} className={`admin-tab ${activeTab === tab ? "admin-tab--active" : ""}`} onClick={() => handleTabClick(tab)}>
            {tab}
            {tab === "Details" && isFormDirty && <span className="admin-tab-dirty-dot" title="Unsaved changes" />}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {activeTab === "Details" && (
        <div className="admin-card">
          <div className="admin-form-grid">
            <div className="admin-form-group admin-form-group--full">
              <label className="admin-form-label">Title</label>
              <input type="text" className="admin-form-input" value={editForm.title || ""} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="admin-form-group admin-form-group--full">
              <label className="admin-form-label">Handle</label>
              <input type="text" className="admin-form-input" value={editForm.handle || ""} onChange={e => setEditForm(f => ({ ...f, handle: e.target.value }))} />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Vendor</label>
              <input type="text" className="admin-form-input" value={editForm.vendor || ""} onChange={e => setEditForm(f => ({ ...f, vendor: e.target.value }))} />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Product Type</label>
              <input type="text" className="admin-form-input" value={editForm.product_type || ""} onChange={e => setEditForm(f => ({ ...f, product_type: e.target.value }))} />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Fit</label>
              <select className="admin-form-select" value={editForm.fit || ""} onChange={e => setEditForm(f => ({ ...f, fit: e.target.value }))}>
                <option value="">—</option>
                {FIT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Kit Type</label>
              <select className="admin-form-select" value={editForm.kit_type || ""} onChange={e => setEditForm(f => ({ ...f, kit_type: e.target.value }))}>
                <option value="">—</option>
                {KIT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Activity</label>
              <select className="admin-form-select" value={editForm.activity || ""} onChange={e => setEditForm(f => ({ ...f, activity: e.target.value }))}>
                <option value="">—</option>
                {ACTIVITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Availability</label>
              <label className="admin-toggle">
                <input type="checkbox" checked={editForm.available_for_sale ?? true} onChange={e => setEditForm(f => ({ ...f, available_for_sale: e.target.checked }))} />
                <span className="admin-toggle-track" />
                <span className="admin-toggle-label">Available for sale</span>
              </label>
            </div>
            <div className="admin-form-group admin-form-group--full">
              <label className="admin-form-label">Tags (comma separated)</label>
              <input type="text" className="admin-form-input" value={Array.isArray(editForm.tags) ? editForm.tags.join(", ") : ""} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value.split(",").map(t => t.trim()) }))} />
            </div>
            <div className="admin-form-group admin-form-group--full">
              <label className="admin-form-label">Product Details & Story (Displayed in DETAILS Accordion)</label>
              <textarea className="admin-form-textarea" rows={4} placeholder="Product description & story..." value={editForm.description || ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="admin-form-group admin-form-group--full">
              <label className="admin-form-label">Size & Fit Features (Displayed in SIZE & FIT Accordion — One bullet per line)</label>
              <textarea className="admin-form-textarea" rows={5} placeholder="One bullet per line..." value={editSizeFitInput} onChange={e => setEditSizeFitInput(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Variants Tab */}
      {activeTab === "Variants" && (
        <div className="admin-card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Options</th>
                  <th>Selling Price (₹)</th>
                  <th>Original Price (MRP ₹)</th>
                  <th>Discount (%)</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {product.variants.map(v => {
                  const currentEdit = variantEdits[v.id];
                  const currentPrice = currentEdit?.price_amount ?? v.price_amount;
                  const currentCompare = currentEdit?.compare_at_price_amount !== undefined
                    ? (currentEdit.compare_at_price_amount ? Number(currentEdit.compare_at_price_amount) : null)
                    : v.compare_at_price_amount;
                  const discountPct = (currentCompare && currentCompare > currentPrice)
                    ? Math.round(((currentCompare - currentPrice) / currentCompare) * 100)
                    : 0;

                  return (
                    <tr key={v.id}>
                      <td><strong>{v.title}</strong></td>
                      <td>
                        {v.selected_options.map((o, idx) => (
                          <span key={idx} className="admin-table-sub" style={{ marginRight: 8 }}>{o.name}: {o.value}</span>
                        ))}
                      </td>
                      <td>
                        {editingVariant === v.id ? (
                          <input
                            type="number"
                            className="admin-form-input"
                            style={{ width: 90 }}
                            value={currentPrice || ""}
                            onFocus={e => e.target.select()}
                            onChange={e => {
                              const newPrice = e.target.value ? Number(e.target.value) : 0;
                              setVariantEdits(ed => ({
                                ...ed,
                                [v.id]: { ...ed[v.id], price_amount: newPrice }
                              }));
                            }}
                          />
                        ) : (
                          `₹${v.price_amount.toLocaleString()}`
                        )}
                      </td>
                      <td>
                        {editingVariant === v.id ? (
                          <input
                            type="number"
                            className="admin-form-input"
                            style={{ width: 100 }}
                            placeholder="e.g. 2999"
                            value={currentCompare ?? ""}
                            onFocus={e => e.target.select()}
                            onChange={e => {
                              const newCompare = e.target.value ? Number(e.target.value) : null;
                              setVariantEdits(ed => ({
                                ...ed,
                                [v.id]: { ...ed[v.id], compare_at_price_amount: newCompare }
                              }));
                            }}
                          />
                        ) : (
                          v.compare_at_price_amount ? `₹${v.compare_at_price_amount.toLocaleString()}` : "—"
                        )}
                      </td>
                      <td>
                        {editingVariant === v.id ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              type="number"
                              className="admin-form-input"
                              style={{ width: 65 }}
                              placeholder="0"
                              value={discountPct || ""}
                              onFocus={e => e.target.select()}
                              onChange={e => {
                                const discPct = Math.round(Number(e.target.value));
                                const calcCompare = (discPct > 0 && currentPrice > 0)
                                  ? Math.round(currentPrice / (1 - discPct / 100))
                                  : null;
                                setVariantEdits(ed => ({
                                  ...ed,
                                  [v.id]: { ...ed[v.id], compare_at_price_amount: calcCompare }
                                }));
                              }}
                            />
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#d32f2f" }}>%</span>
                          </div>
                        ) : (
                          discountPct > 0 ? (
                            <span style={{ background: "rgba(211, 47, 47, 0.1)", color: "#d32f2f", fontSize: "0.75rem", fontWeight: 700, padding: "2px 6px" }}>
                              {discountPct}% OFF
                            </span>
                          ) : "—"
                        )}
                      </td>
                      <td>
                        {editingVariant === v.id ? (
                          <input
                            type="number"
                            className="admin-form-input"
                            style={{ width: 80 }}
                            value={variantEdits[v.id]?.inventory_quantity ?? v.inventory_quantity}
                            onFocus={e => e.target.select()}
                            onChange={e => setVariantEdits(ed => ({ ...ed, [v.id]: { ...ed[v.id], inventory_quantity: Number(e.target.value) } }))}
                          />
                        ) : (
                          v.inventory_quantity
                        )}
                      </td>
                      <td>
                        {editingVariant === v.id ? (
                          <select
                            className="admin-form-select"
                            style={{ padding: "4px 8px", fontSize: "0.8rem", width: 115 }}
                            value={(variantEdits[v.id]?.available_for_sale ?? v.available_for_sale) ? "true" : "false"}
                            onChange={e => setVariantEdits(ed => ({ ...ed, [v.id]: { ...ed[v.id], available_for_sale: e.target.value === "true" } }))}
                          >
                            <option value="true">Available</option>
                            <option value="false">Unavailable</option>
                          </select>
                        ) : (
                          <AdminBadge label={v.available_for_sale ? "available" : "unavailable"} variant={v.available_for_sale ? "available" : "unavailable"} />
                        )}
                      </td>
                      <td>
                        {editingVariant === v.id ? (
                          <button className="admin-btn admin-btn--primary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => handleSaveVariant(v.id)}>Save</button>
                        ) : (
                          <div className="admin-table-actions">
                            <button className="admin-icon-btn" title="Edit" onClick={() => { setEditingVariant(v.id); setVariantEdits(ed => ({ ...ed, [v.id]: { price_amount: v.price_amount, compare_at_price_amount: v.compare_at_price_amount, inventory_quantity: v.inventory_quantity, available_for_sale: v.available_for_sale } })); }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button className="admin-icon-btn admin-icon-btn--danger" title="Delete" onClick={() => handleDeleteVariant(v.id)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--admin-card-border)" }}>
            <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 12 }}>Add New Variant</h3>
            <div className="admin-form-grid">
              <div className="admin-form-group">
                <label className="admin-form-label">Colour</label>
                <input type="text" className="admin-form-input" placeholder="e.g. Blue" value={newVariant.colour} onChange={e => setNewVariant(v => ({ ...v, colour: e.target.value }))} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Size</label>
                <input type="text" className="admin-form-input" placeholder="e.g. M" value={newVariant.size} onChange={e => setNewVariant(v => ({ ...v, size: e.target.value }))} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Selling Price (₹)</label>
                <input
                  type="number"
                  className="admin-form-input"
                  placeholder="e.g. 2499"
                  value={newVariant.price_amount || ""}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const price = e.target.value ? Number(e.target.value) : 0;
                    setNewVariant(v => ({ ...v, price_amount: price }));
                  }}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Compare Price (MRP ₹)</label>
                <input
                  type="number"
                  className="admin-form-input"
                  placeholder="e.g. 2999"
                  value={newVariant.compare_at_price_amount}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const compareStr = e.target.value;
                    setNewVariant(v => ({ ...v, compare_at_price_amount: compareStr }));
                  }}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Discount % (Auto-Calc MRP)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="number"
                    className="admin-form-input"
                    placeholder="0"
                    value={
                      newVariant.compare_at_price_amount && Number(newVariant.compare_at_price_amount) > newVariant.price_amount && newVariant.price_amount > 0
                        ? Math.round(((Number(newVariant.compare_at_price_amount) - newVariant.price_amount) / Number(newVariant.compare_at_price_amount)) * 100)
                        : ""
                    }
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const discPct = Math.round(Number(e.target.value));
                      if (discPct > 0 && newVariant.price_amount > 0) {
                        const calcCompare = Math.round(newVariant.price_amount / (1 - discPct / 100));
                        setNewVariant(v => ({ ...v, compare_at_price_amount: String(calcCompare) }));
                      } else {
                        setNewVariant(v => ({ ...v, compare_at_price_amount: "" }));
                      }
                    }}
                  />
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#d32f2f" }}>%</span>
                </div>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Stock</label>
                <input
                  type="number"
                  className="admin-form-input"
                  value={newVariant.inventory_quantity}
                  onFocus={e => e.target.select()}
                  onChange={e => setNewVariant(v => ({ ...v, inventory_quantity: Number(e.target.value) }))}
                />
              </div>
            </div>
            <button className="admin-btn admin-btn--primary" style={{ marginTop: 12 }} onClick={handleAddVariant}>+ Add Variant</button>
          </div>
        </div>
      )}

      {/* Colour Groups Tab */}
      {activeTab === "Colour Groups" && (
        <div className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {product.colour_groups.map(g => (
            <div key={g.id} style={{ border: "1px solid var(--admin-card-border)", padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Colour: {g.colour_value}</h3>
                <button className="admin-btn admin-btn--ghost" style={{ color: "var(--admin-danger)" }} onClick={() => handleDeleteGroup(g.id)}>Delete Group</button>
              </div>

              <AdminImageUploader
                endpoint="productImage"
                label={`Images for ${g.colour_value} (Bulk Drag & Drop / Reorder)`}
                existingImages={g.images.map(img => ({ url: img.url, key: img.url, name: g.colour_value }))}
                onReorderExisting={imgs => handleUpdateGroupImages(g.id, imgs)}
                onUploadComplete={imgs => handleUpdateGroupImages(g.id, imgs)}
              />
            </div>
          ))}

          <div style={{ paddingTop: 16, borderTop: "1px solid var(--admin-card-border)" }}>
            <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 12 }}>+ Add New Colour Group</h3>
            <div className="admin-form-group" style={{ maxWidth: 320 }}>
              <label className="admin-form-label">Colour Name</label>
              <input type="text" className="admin-form-input" placeholder="e.g. Yellow" value={newGroup.colour_value} onChange={e => setNewGroup(g => ({ ...g, colour_value: e.target.value }))} />
            </div>
            <div style={{ marginTop: 12 }}>
              <AdminImageUploader
                endpoint="productImage"
                label="Upload Initial Images for New Group"
                onUploadComplete={imgs => setNewGroupImages(imgs.map(img => ({ url: img.url, altText: newGroup.colour_value })))}
              />
            </div>
            <button className="admin-btn admin-btn--primary" style={{ marginTop: 12 }} onClick={handleAddGroup}>Save New Colour Group</button>
          </div>
        </div>
      )}

      {/* Images Tab */}
      {activeTab === "Images" && (
        <div className="admin-card">
          <AdminImageUploader
            endpoint="productImage"
            label="Product Gallery (All Images)"
            existingImages={product.images.map(img => ({ url: img.url, key: img.url, name: product.title }))}
            onUploadComplete={() => loadProduct()}
          />
        </div>
      )}

      {/* Reviews Tab */}
      {activeTab === "Reviews" && (
        <div className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <h2 className="admin-card-section-title">Product Customer Reviews ({reviews.length})</h2>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Rating</th>
                  <th>Content</th>
                  <th>Visibility</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.length === 0 && (
                  <tr><td colSpan={5} className="admin-table-empty">No reviews yet for this product</td></tr>
                )}
                {reviews.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.author}</strong><div className="admin-table-sub">{r.date}</div></td>
                    <td><span className="admin-rating-stars">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span></td>
                    <td>{r.content}</td>
                    <td>
                      {r.is_hidden ? <AdminBadge label="Hidden" variant="CANCELLED" /> : <AdminBadge label="Visible" variant="available" />}
                    </td>
                    <td>
                      <div className="admin-table-actions">
                        <button className="admin-icon-btn" title={r.is_hidden ? "Show" : "Hide"} onClick={() => handleToggleReviewHide(r)}>
                          {r.is_hidden
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                        </button>
                        <button className="admin-icon-btn admin-icon-btn--danger" title="Delete" onClick={() => handleDeleteReview(r.id)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ paddingTop: 16, borderTop: "1px solid var(--admin-card-border)" }}>
            <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 12 }}>+ Add Customer Review</h3>
            <div className="admin-form-grid">
              <div className="admin-form-group">
                <label className="admin-form-label">Author Name</label>
                <input type="text" className="admin-form-input" value={newReview.author} onChange={e => setNewReview(r => ({ ...r, author: e.target.value }))} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Rating (1-5 Stars)</label>
                <select className="admin-form-select" value={newReview.rating} onChange={e => setNewReview(r => ({ ...r, rating: Number(e.target.value) }))}>
                  {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} Stars</option>)}
                </select>
              </div>
              <div className="admin-form-group admin-form-group--full">
                <label className="admin-form-label">Content</label>
                <textarea className="admin-form-textarea" rows={3} value={newReview.content} onChange={e => setNewReview(r => ({ ...r, content: e.target.value }))} />
              </div>
            </div>
            <button className="admin-btn admin-btn--primary" style={{ marginTop: 12 }} onClick={handleAddReview}>Add Review</button>
          </div>
        </div>
      )}

      {/* FLOATING UNSAVED CHANGES BAR */}
      {isFormDirty && (
        <div className="admin-unsaved-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem", fontWeight: 600 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffb74d" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            You have unsaved changes in Details tab
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="admin-btn admin-btn--ghost" style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.3)" }} onClick={handleDiscardChanges}>
              Discard
            </button>
            <button className="admin-btn" style={{ background: "#ffffff", color: "#111118", fontWeight: 700, border: "none", padding: "8px 16px" }} onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* UNSAVED CHANGES TAB SWITCH WARNING MODAL */}
      {showUnsavedModal && (
        <div className="admin-modal-overlay" onClick={() => setShowUnsavedModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 className="admin-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Unsaved Changes
            </h3>
            <p style={{ fontSize: "0.88rem", color: "var(--admin-text-secondary)", margin: "12px 0 20px" }}>
              You have unsaved changes on the <strong>{activeTab}</strong> tab. Would you like to save your changes or discard them before switching to <strong>{pendingTab}</strong>?
            </p>
            <div className="admin-modal-actions" style={{ flexDirection: "column", gap: 8 }}>
              <button className="admin-btn admin-btn--primary" style={{ width: "100%" }} onClick={handleModalSaveAndProceed}>
                Save Changes & Continue →
              </button>
              <button className="admin-btn admin-btn--danger" style={{ width: "100%" }} onClick={handleModalDiscardAndProceed}>
                Discard Changes & Continue
              </button>
              <button className="admin-btn admin-btn--ghost" style={{ width: "100%", marginTop: 4 }} onClick={() => setShowUnsavedModal(false)}>
                Cancel (Stay Here)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
