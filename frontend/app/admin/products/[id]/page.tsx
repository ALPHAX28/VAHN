"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import {
  getAdminProducts, getAdminProduct, updateAdminProduct, addVariant, updateVariant, deleteVariant,
  createColourGroup, updateColourGroup, deleteColourGroup, type AdminProductDetail, type AdminVariant, type ColourGroup,
  createAdminReview, getProductReviews, deleteAdminReview, updateAdminReview, type AdminReview
} from "@/lib/api/admin";
import { useUnsavedChanges } from "@/context/UnsavedChangesContext";
import AdminImageUploader, { type UploadedImage } from "@/components/admin/AdminImageUploader";
import AdminBadge from "@/components/admin/AdminBadge";
import Link from "next/link";
import Image from "next/image";

const TABS = ["Details", "Variants", "Colour Groups", "Images", "Reviews"];
const FIT_OPTIONS = ["SLIM", "REGULAR", "OVERSIZED"];
const KIT_OPTIONS = ["JERSEY", "HOME", "SIGNATURE"];
const ACTIVITY_OPTIONS = ["FOOTBALL", "LIFESTYLE", "STREETWEAR", "CRICKET", "BASKETBALL"];
const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "FREE SIZE"];


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
  const [productTypeOptions, setProductTypeOptions] = useState(["Jersey", "T-Shirt", "Hoodie", "Sweatshirt", "Pants", "Shorts", "Jacket", "Accessories", "Streetwear", "Footwear"]);
  const [newProductTypeInput, setNewProductTypeInput] = useState("");
  const [showNewProductTypeInput, setShowNewProductTypeInput] = useState(false);

  function handleAddCustomProductType() {
    const val = newProductTypeInput.trim();
    if (!val) return;
    if (!productTypeOptions.includes(val)) {
      setProductTypeOptions(opts => [...opts, val]);
    }
    setEditForm(f => ({ ...f, product_type: val }));
    setNewProductTypeInput("");
    setShowNewProductTypeInput(false);
  }

  function handleDeleteProductType(typeToDelete: string) {
    if (!typeToDelete) return;
    if (!confirm(`Remove "${typeToDelete}" from Product Type options?`)) return;

    setProductTypeOptions(prev => prev.filter(t => t.toLowerCase() !== typeToDelete.toLowerCase()));

    try {
      const storedDeleted = JSON.parse(localStorage.getItem("vahn_deleted_product_types") || "[]");
      if (!storedDeleted.some((dt: string) => dt.toLowerCase() === typeToDelete.toLowerCase())) {
        storedDeleted.push(typeToDelete);
        localStorage.setItem("vahn_deleted_product_types", JSON.stringify(storedDeleted));
      }
    } catch (e) { console.error(e); }

    if (editForm.product_type === typeToDelete) {
      setEditForm(f => ({ ...f, product_type: "" }));
    }
  }

  // Unsaved changes navigation guard modal state
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error && alertRef.current) {
      alertRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  // Variant state
  const [newVariant, setNewVariant] = useState({ title: "", colour: "", size: "", price_amount: 0, compare_at_price_amount: "", inventory_quantity: 0, available_for_sale: true, image_url: "" });
  const [editingVariant, setEditingVariant] = useState<string | null>(null);
  const [variantEdits, setVariantEdits] = useState<Record<string, Partial<AdminVariant>>>({});
  const [addingVariant, setAddingVariant] = useState(false);
  const [savingVariant, setSavingVariant] = useState<string | null>(null);

  // Colour group state
  const [newGroup, setNewGroup] = useState({ colour_value: "", display_order: 0 });
  const [newGroupImages, setNewGroupImages] = useState<{ url: string; altText: string }[]>([]);

  // Buffered Local States for Colour Groups & Gallery Images (0 backend calls until Save!)
  const [localGroups, setLocalGroups] = useState<ColourGroup[]>([]);
  const [deletedGroupIds, setDeletedGroupIds] = useState<Set<number>>(new Set());
  const [localGallery, setLocalGallery] = useState<UploadedImage[]>([]);

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
      const [p, allProdsRes] = await Promise.all([
        getAdminProduct(adminToken, productId),
        getAdminProducts(adminToken).catch(() => ({ items: [], total: 0, page: 1, pages: 1, limit: 100 }))
      ]);
      setProduct(p);
      setEditForm({
        title: p.title,
        description: p.description || "",
        vendor: p.vendor,
        product_type: p.product_type || "",
        tags: p.tags || [],
        available_for_sale: p.available_for_sale,
        fit: p.fit || "",
        kit_type: p.kit_type || "",
        activity: p.activity || "",
        gst_percent: p.gst_percent ?? 12,
        shipping_rate: p.shipping_rate ?? null,
      });
      setEditSizeFitInput(extractBullets(p.description_html || ""));
      setLocalGroups(p.colour_groups || []);
      setDeletedGroupIds(new Set());
      setLocalGallery((p.images || []).map((img, i) => ({ url: img.url, key: img.url, name: `Image ${i + 1}` })));

      // Dynamically accumulate all Product Types from DB (excluding deleted ones)
      let deletedTypes: string[] = [];
      try {
        deletedTypes = JSON.parse(localStorage.getItem("vahn_deleted_product_types") || "[]");
      } catch (e) { console.error(e); }

      const defaultTypes = ["Jersey", "T-Shirt", "Hoodie", "Sweatshirt", "Pants", "Shorts", "Jacket", "Accessories", "Streetwear", "Footwear"];
      const dbTypes = (allProdsRes?.items || []).map(item => item.product_type).filter((t): t is string => Boolean(t && t.trim()));
      const allTypes = Array.from(new Set([...defaultTypes, ...dbTypes, p.product_type].filter((t): t is string => Boolean(t && t.trim()))));
      const filteredTypes = allTypes.filter(t => !deletedTypes.some(dt => dt.toLowerCase() === t.toLowerCase()) || t.toLowerCase() === p.product_type?.toLowerCase());
      setProductTypeOptions(filteredTypes);
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

  // Compute dirty state for Details tab
  const initialBullets = product ? extractBullets(product.description_html || "") : "";

  const isDetailsDirty = useMemo(() => {
    if (!product) return false;
    const titleChanged = editForm.title !== undefined && editForm.title.trim() !== product.title;
    const descChanged = editForm.description !== undefined && editForm.description !== (product.description || "");
    const vendorChanged = editForm.vendor !== undefined && editForm.vendor !== product.vendor;
    const typeChanged = editForm.product_type !== undefined && editForm.product_type !== (product.product_type || "");
    const fitChanged = editForm.fit !== undefined && editForm.fit !== (product.fit || "");
    const kitChanged = editForm.kit_type !== undefined && editForm.kit_type !== (product.kit_type || "");
    const actChanged = editForm.activity !== undefined && editForm.activity !== (product.activity || "");
    const availChanged = editForm.available_for_sale !== undefined && editForm.available_for_sale !== product.available_for_sale;
    const gstChanged = editForm.gst_percent !== undefined && editForm.gst_percent !== (product.gst_percent ?? 12);
    const shipChanged = editForm.shipping_rate !== undefined && editForm.shipping_rate !== (product.shipping_rate ?? null);
    const bulletsChanged = editSizeFitInput.trim() !== initialBullets.trim();

    return Boolean(
      titleChanged || descChanged || vendorChanged || typeChanged ||
      fitChanged || kitChanged || actChanged || availChanged ||
      gstChanged || shipChanged || bulletsChanged
    );
  }, [product, editForm, editSizeFitInput, initialBullets]);

  const isVariantsDirty = useMemo(() => {
    return Boolean(
      newVariant.colour.trim() !== "" ||
      newVariant.size !== "" ||
      newVariant.price_amount > 0 ||
      newVariant.compare_at_price_amount !== "" ||
      newVariant.inventory_quantity > 0 ||
      editingVariant !== null
    );
  }, [newVariant, editingVariant]);

  const isGroupsDirty = useMemo(() => {
    if (!product) return false;
    const isNewGroupDirty = newGroup.colour_value.trim() !== "" || newGroupImages.length > 0;
    const isDeletedDirty = deletedGroupIds.size > 0;
    const origGroupsStr = JSON.stringify((product.colour_groups || []).map(g => ({ id: g.id, val: g.colour_value, imgs: g.images })));
    const localGroupsStr = JSON.stringify((localGroups || []).map(g => ({ id: g.id, val: g.colour_value, imgs: g.images })));
    return isNewGroupDirty || isDeletedDirty || (origGroupsStr !== localGroupsStr);
  }, [product, localGroups, deletedGroupIds, newGroup, newGroupImages]);

  const isImagesDirty = useMemo(() => {
    if (!product) return false;
    const origUrls = (product.images || []).map(i => i.url);
    const localUrls = (localGallery || []).map(i => i.url);
    return JSON.stringify(origUrls) !== JSON.stringify(localUrls);
  }, [product, localGallery]);

  const isReviewsDirty = useMemo(() => {
    return Boolean(newReview.author.trim() !== "" || newReview.content.trim() !== "");
  }, [newReview]);

  const isPageDirty = isDetailsDirty || isVariantsDirty || isGroupsDirty || isImagesDirty || isReviewsDirty;

  const isCurrentTabDirty = useMemo(() => {
    if (activeTab === "Details") return isDetailsDirty;
    if (activeTab === "Variants") return isVariantsDirty;
    if (activeTab === "Colour Groups") return isGroupsDirty;
    if (activeTab === "Images") return isImagesDirty;
    if (activeTab === "Reviews") return isReviewsDirty;
    return false;
  }, [activeTab, isDetailsDirty, isVariantsDirty, isGroupsDirty, isImagesDirty, isReviewsDirty]);

  const handleDiscardChanges = useCallback(() => {
    setError("");
    setSuccess("");
    if (!product) return;
    setEditForm({
      title: product.title,
      description: product.description || "",
      vendor: product.vendor,
      product_type: product.product_type || "",
      tags: product.tags || [],
      available_for_sale: product.available_for_sale,
      fit: product.fit || "",
      kit_type: product.kit_type || "",
      activity: product.activity || "",
      gst_percent: product.gst_percent ?? 12,
      shipping_rate: product.shipping_rate ?? null,
    });
    setEditSizeFitInput(extractBullets(product.description_html || ""));
    setLocalGroups(product.colour_groups || []);
    setDeletedGroupIds(new Set());
    setLocalGallery((product.images || []).map((img, i) => ({ url: img.url, key: img.url, name: `Image ${i + 1}` })));
    setNewVariant({ title: "", colour: "", size: "", price_amount: 0, compare_at_price_amount: "", inventory_quantity: 0, available_for_sale: true, image_url: "" });
    setEditingVariant(null);
    setVariantEdits({});
    setNewGroup({ colour_value: "", display_order: 0 });
    setNewGroupImages([]);
    setNewReview({ rating: 5, author: "", content: "", title: "", verified: true, is_approved: true });
  }, [product]);

  const handleSave = useCallback(async () => {
    if (!adminToken || !product) return false;
    setSaving(true);
    setError(""); setSuccess("");
    try {
      const bullets = editSizeFitInput.split("\n").map(b => b.trim()).filter(Boolean);
      const descPart = editForm.description?.trim() ? `<p>${editForm.description.trim()}</p>` : "";
      const fitPart = bullets.length > 0 ? `<ul>${bullets.map(b => `<li>${b}</li>`).join("")}</ul>` : "";
      const description_html = descPart + fitPart;

      const imagesPayload = isImagesDirty ? localGallery.map((img, i) => ({ url: img.url, altText: product.title })) : undefined;

      await updateAdminProduct(adminToken, productId, {
        ...editForm,
        description_html,
        ...(imagesPayload ? { images: imagesPayload } : {}),
        tags: Array.isArray(editForm.tags) ? editForm.tags : (editForm.tags as unknown as string || "").split(",").map((t: string) => t.trim()),
      });

      // Persist deleted colour groups
      for (const gid of Array.from(deletedGroupIds)) {
        try { await deleteColourGroup(adminToken, productId, gid); } catch (e) { console.error(e); }
      }

      // Persist updated colour group images/names
      for (const g of localGroups) {
        const origGroup = product.colour_groups.find(og => og.id === g.id);
        if (!origGroup || JSON.stringify(origGroup.images) !== JSON.stringify(g.images) || origGroup.colour_value !== g.colour_value) {
          await updateColourGroup(adminToken, productId, g.id, { colour_value: g.colour_value, images: g.images });
        }
      }

      // Persist new colour group if filled
      if (newGroup.colour_value.trim()) {
        await createColourGroup(adminToken, productId, {
          colour_value: newGroup.colour_value.trim(),
          images: newGroupImages,
          display_order: newGroup.display_order
        });
        setNewGroup({ colour_value: "", display_order: 0 });
        setNewGroupImages([]);
      }

      await loadProduct();
      setSuccess("Product and image changes saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      return true;
    } finally {
      setSaving(false);
    }
  }, [adminToken, product, productId, editForm, editSizeFitInput, isImagesDirty, localGallery, deletedGroupIds, localGroups, newGroup, newGroupImages]);

  // Sync with global UnsavedChangesContext
  useEffect(() => {
    setDirtyState(isPageDirty, handleSave, handleDiscardChanges);
  }, [isPageDirty, setDirtyState, handleSave, handleDiscardChanges]);

  function handleTabClick(nextTab: string) {
    if (nextTab === activeTab) return;
    if (isCurrentTabDirty) {
      setPendingTab(nextTab);
      setShowUnsavedModal(true);
    } else {
      setError("");
      setSuccess("");
      setActiveTab(nextTab);
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
    setError("");
    setSuccess("");
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
    setShowUnsavedModal(false);
  }

  // Variant CRUD
  async function handleAddVariant() {
    if (!adminToken || !product || addingVariant) return;

    // ── Field validations ──
    if (!newVariant.colour.trim() && !newVariant.size.trim()) {
      setError("Please provide at least a Colour or a Size for the variant.");
      return;
    }
    if (!newVariant.price_amount || newVariant.price_amount <= 0) {
      setError("Selling price must be greater than ₹0.");
      return;
    }
    const compareNum = newVariant.compare_at_price_amount ? Number(newVariant.compare_at_price_amount) : null;
    if (compareNum !== null && compareNum < newVariant.price_amount) {
      setError("Selling price cannot be greater than Original Price (MRP).");
      return;
    }

    // ── Duplicate variant detection ──
    const isDuplicate = product.variants.some(v => {
      const vColour = v.selected_options.find(o => o.name === "Colour")?.value ?? "";
      const vSize = v.selected_options.find(o => o.name === "Size")?.value ?? "";
      return (
        vColour.toLowerCase() === newVariant.colour.trim().toLowerCase() &&
        vSize.toLowerCase() === newVariant.size.trim().toLowerCase()
      );
    });
    if (isDuplicate) {
      setError(`A variant with Colour "${newVariant.colour.trim()}" and Size "${newVariant.size.trim()}" already exists.`);
      return;
    }

    const selectedOptions: { name: string; value: string }[] = [];
    if (newVariant.colour.trim()) selectedOptions.push({ name: "Colour", value: newVariant.colour.trim() });
    if (newVariant.size.trim()) selectedOptions.push({ name: "Size", value: newVariant.size.trim() });

    setAddingVariant(true);
    setError("");
    try {
      await addVariant(adminToken, productId, {
        title: newVariant.title || [newVariant.colour, newVariant.size].filter(Boolean).join(" / ") || "Default",
        price_amount: Number(newVariant.price_amount),
        compare_at_price_amount: compareNum,
        inventory_quantity: Number(newVariant.inventory_quantity),
        available_for_sale: newVariant.available_for_sale,
        image_url: newVariant.image_url || null,
        selected_options: selectedOptions,
      });
      setNewVariant({ title: "", colour: "", size: "", price_amount: 0, compare_at_price_amount: "", inventory_quantity: 0, available_for_sale: true, image_url: "" });
      await loadProduct();
      setSuccess("Variant added!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to add variant"); }
    finally { setAddingVariant(false); }
  }

  async function handleSaveVariant(variantId: string) {
    if (!adminToken || !product) return;
    const patch = variantEdits[variantId];
    if (!patch) return;

    const targetVariant = product.variants.find(v => v.id === variantId);
    if (!targetVariant) return;

    const updatedOptions = patch.selected_options ?? targetVariant.selected_options;
    const editColour = updatedOptions.find(o => o.name === "Colour")?.value ?? "";
    const editSize = updatedOptions.find(o => o.name === "Size")?.value ?? "";

    // ── Check if updated options collide with another existing variant ──
    const isDuplicate = product.variants.some(other => {
      if (other.id === variantId) return false;
      const oColour = other.selected_options.find(o => o.name === "Colour")?.value ?? "";
      const oSize = other.selected_options.find(o => o.name === "Size")?.value ?? "";
      return (
        oColour.trim().toLowerCase() === editColour.trim().toLowerCase() &&
        oSize.trim().toLowerCase() === editSize.trim().toLowerCase()
      );
    });

    if (isDuplicate) {
      setError(`Cannot save: A variant with Colour "${editColour}" and Size "${editSize}" already exists.`);
      return;
    }

    // ── Price validation ──
    const editPrice = patch.price_amount !== undefined ? patch.price_amount : targetVariant.price_amount;
    const editCompare = patch.compare_at_price_amount !== undefined ? patch.compare_at_price_amount : targetVariant.compare_at_price_amount;

    if (editPrice <= 0) {
      setError("Selling price must be greater than ₹0.");
      return;
    }
    if (editCompare !== null && editCompare !== undefined && editCompare < editPrice) {
      setError("Selling price cannot be greater than Original Price (MRP).");
      return;
    }

    // Auto-update title based on options
    const newTitle = [editColour, editSize].filter(Boolean).join(" / ") || targetVariant.title;

    const finalPatch: Partial<AdminVariant> = {
      ...patch,
      title: newTitle,
      selected_options: updatedOptions,
    };

    setSavingVariant(variantId);
    setError("");
    try {
      await updateVariant(adminToken, productId, variantId, finalPatch);
      setEditingVariant(null);
      await loadProduct();
      setSuccess("Variant updated!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to update variant"); }
    finally { setSavingVariant(null); }
  }

  async function handleDeleteVariant(variantId: string) {
    if (!adminToken || !confirm("Delete this variant?")) return;
    try {
      await deleteVariant(adminToken, productId, variantId);
      await loadProduct();
      setSuccess("Variant deleted!");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to delete variant"); }
  }

  // Colour Group Local State Handlers (Buffered locally, saved only when clicking Save Changes!)
  function handleUpdateGroupImagesLocal(groupId: number, images: { url: string; key?: string; name?: string }[]) {
    const formatted = images.map((img, i) => ({ url: img.url, altText: `Photo ${i + 1}` }));
    setLocalGroups(prev =>
      prev.map(g => (g.id === groupId ? { ...g, images: formatted } : g))
    );
  }

  function handleDeleteGroupLocal(groupId: number) {
    setLocalGroups(prev => prev.filter(g => g.id !== groupId));
    setDeletedGroupIds(prev => new Set(prev).add(groupId));
  }

  async function handleAddGroup() {
    if (!adminToken || !newGroup.colour_value.trim()) {
      setError("Please enter a colour name.");
      return;
    }
    // Duplicate colour group check in local state
    const exists = localGroups.some(
      g => g.colour_value.toLowerCase() === newGroup.colour_value.trim().toLowerCase()
    );
    if (exists) {
      setError(`A colour group for "${newGroup.colour_value.trim()}" already exists.`);
      return;
    }
    try {
      await createColourGroup(adminToken, productId, {
        colour_value: newGroup.colour_value.trim(),
        images: newGroupImages,
        display_order: newGroup.display_order
      });
      setNewGroup({ colour_value: "", display_order: 0 });
      setNewGroupImages([]);
      await loadProduct();
      setSuccess("New colour group saved to database!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to add colour group"); }
  }

  // Reviews CRUD
  async function handleAddReview() {
    if (!adminToken) return;
    if (!newReview.author.trim()) {
      setError("Author name is required.");
      return;
    }
    if (!newReview.content.trim()) {
      setError("Review content is required.");
      return;
    }
    try {
      await createAdminReview(adminToken, productId, newReview);
      setNewReview({ rating: 5, author: "", content: "", title: "", verified: true, is_approved: true });
      await loadReviews();
      setSuccess("Review added!");
      setTimeout(() => setSuccess(""), 3000);
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

      {error && (
        <div ref={alertRef} className="admin-alert admin-alert--error" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1rem", fontWeight: 700, padding: "0 4px" }} title="Dismiss">
            ✕
          </button>
        </div>
      )}
      {success && (
        <div className="admin-alert admin-alert--success" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{success}</span>
          <button onClick={() => setSuccess("")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1rem", fontWeight: 700, padding: "0 4px" }} title="Dismiss">
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="admin-tabs">
        {TABS.map(tab => {
          const isTabDirty =
            (tab === "Details" && isDetailsDirty) ||
            (tab === "Variants" && isVariantsDirty) ||
            (tab === "Colour Groups" && isGroupsDirty) ||
            (tab === "Reviews" && isReviewsDirty);
          return (
            <button key={tab} className={`admin-tab ${activeTab === tab ? "admin-tab--active" : ""}`} onClick={() => handleTabClick(tab)}>
              {tab}
              {isTabDirty && <span className="admin-tab-dirty-dot" title="Unsaved inputs" />}
            </button>
          );
        })}
      </div>

      {/* ===== DETAILS TAB ===== */}
      {activeTab === "Details" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* — IDENTIFICATION — */}
          <div className="admin-card">
            <h2 className="admin-card-section-title">Product Identity</h2>
            <div className="admin-form-grid">
              <div className="admin-form-group admin-form-group--full">
                <label className="admin-form-label">Title *</label>
                <input type="text" className="admin-form-input" value={editForm.title || ""} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              {/* Handle — read-only display */}
              <div className="admin-form-group admin-form-group--full">
                <label className="admin-form-label">URL Handle <span style={{ fontWeight: 400, fontSize: "0.72rem", color: "var(--admin-text-secondary)" }}>(permanent — cannot be changed)</span></label>
                <div style={{
                  background: "var(--admin-bg-page)", border: "1px solid var(--admin-card-border)",
                  padding: "9px 14px", fontFamily: "monospace", fontSize: "0.875rem",
                  color: "var(--admin-text-secondary)", letterSpacing: "0.02em"
                }}>
                  {product?.handle}
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Vendor</label>
                <input type="text" className="admin-form-input" value={editForm.vendor || ""} onChange={e => setEditForm(f => ({ ...f, vendor: e.target.value }))} />
              </div>
              <div className="admin-form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label className="admin-form-label" style={{ marginBottom: 0 }}>Product Type</label>
                  <button
                    type="button"
                    className="admin-btn-inline-link"
                    onClick={() => setShowNewProductTypeInput(!showNewProductTypeInput)}
                    style={{ fontSize: "0.72rem", color: "var(--admin-primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}
                  >
                    {showNewProductTypeInput ? "Cancel" : "+ Add New Type"}
                  </button>
                </div>

                {showNewProductTypeInput ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. Tank Top"
                      value={newProductTypeInput}
                      onChange={e => setNewProductTypeInput(e.target.value)}
                    />
                    <button type="button" className="admin-btn admin-btn--primary" style={{ padding: "6px 12px", fontSize: "0.78rem" }} onClick={handleAddCustomProductType}>
                      Add
                    </button>
                  </div>
                ) : (
                  <>
                    <select
                      className="admin-form-select"
                      value={editForm.product_type || ""}
                      onChange={e => setEditForm(f => ({ ...f, product_type: e.target.value }))}
                    >
                      <option value="">— Select Product Type —</option>
                      {productTypeOptions.map(pt => (
                        <option key={pt} value={pt}>{pt}</option>
                      ))}
                    </select>
                    {editForm.product_type && (
                      <div style={{ marginTop: 4, display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteProductType(editForm.product_type!)}
                          style={{
                            color: "#d32f2f",
                            fontSize: "0.72rem",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: 600,
                            padding: 0,
                            textDecoration: "underline"
                          }}
                        >
                          ✕ Delete "{editForm.product_type}" from options
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="admin-form-group admin-form-group--full">
                <label className="admin-form-label">Tags (comma separated)</label>
                <input type="text" className="admin-form-input" value={Array.isArray(editForm.tags) ? editForm.tags.join(", ") : ""} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value.split(",").map(t => t.trim()) }))} />
              </div>
            </div>
          </div>

          {/* — PRICING & TAX — */}
          <div className="admin-card">
            <h2 className="admin-card-section-title">Pricing & Tax</h2>
            <p className="admin-page-subtitle" style={{ marginBottom: 16, fontSize: "0.8rem" }}>
              GST is calculated <strong>inclusively</strong> from the variant price (e.g. at 12% GST: ₹2499 price → ₹268 GST included). Leave Shipping Rate blank to use the global rule (free ≥ ₹1999, else ₹99).
            </p>
            <div className="admin-form-grid">
              <div className="admin-form-group">
                <label className="admin-form-label">GST Rate (%) *</label>
                <select
                  className="admin-form-select"
                  value={String(editForm.gst_percent ?? 12)}
                  onChange={e => setEditForm(f => ({ ...f, gst_percent: Number(e.target.value) }))}
                  required
                >
                  <option value="0">0% — Exempt (Books, essentials)</option>
                  <option value="5">5% — Reduced rate</option>
                  <option value="12">12% — Standard (Garments ≤₹1000 MRP)</option>
                  <option value="18">18% — Standard (Garments &gt;₹1000 MRP)</option>
                  <option value="28">28% — Luxury goods</option>
                </select>
                {editForm.gst_percent != null && editForm.gst_percent > 0 && (
                  <div style={{ marginTop: 6, fontSize: "0.75rem", color: "var(--admin-text-secondary)", background: "rgba(25,118,210,0.07)", border: "1px solid rgba(25,118,210,0.2)", padding: "6px 10px" }}>
                    Example: On a ₹2,499 product — GST included = <strong>₹{Math.round((2499 * (editForm.gst_percent ?? 12)) / (100 + (editForm.gst_percent ?? 12))).toLocaleString()}</strong> · Base price = ₹{(2499 - Math.round((2499 * (editForm.gst_percent ?? 12)) / (100 + (editForm.gst_percent ?? 12)))).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Shipping Rate (₹) — Per Product Override</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: "0.9rem", fontWeight: 700, color: "var(--admin-text-secondary)" }}>₹</span>
                  <input
                    type="number"
                    className="admin-form-input"
                    style={{ paddingLeft: 26 }}
                    placeholder="Leave blank for global rule"
                    min={0}
                    value={editForm.shipping_rate ?? ""}
                    onFocus={e => e.target.select()}
                    onChange={e => setEditForm(f => ({ ...f, shipping_rate: e.target.value === "" ? null : Number(e.target.value) }))}
                  />
                </div>
                <div style={{ marginTop: 6, fontSize: "0.75rem", color: "var(--admin-text-secondary)" }}>
                  {editForm.shipping_rate === null || editForm.shipping_rate === undefined
                    ? "Using global rule: Free ≥ ₹1,999 · ₹99 otherwise"
                    : editForm.shipping_rate === 0
                    ? "✓ Free shipping for this product"
                    : `₹${editForm.shipping_rate} flat shipping for this product`}
                </div>
              </div>
            </div>
          </div>

          {/* — ATTRIBUTES — */}
          <div className="admin-card">
            <h2 className="admin-card-section-title">Attributes</h2>
            <div className="admin-form-grid">
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
            </div>
          </div>

          {/* — CONTENT — */}
          <div className="admin-card">
            <h2 className="admin-card-section-title">Content & Story</h2>
            <div className="admin-form-grid">
              <div className="admin-form-group admin-form-group--full">
                <label className="admin-form-label">Product Details & Story <span style={{ fontWeight: 400, fontSize: "0.72rem" }}>(Displayed in DETAILS Accordion)</span></label>
                <textarea className="admin-form-textarea" rows={4} placeholder="Product description & story..." value={editForm.description || ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="admin-form-group admin-form-group--full">
                <label className="admin-form-label">Size & Fit Features <span style={{ fontWeight: 400, fontSize: "0.72rem" }}>(Displayed in SIZE & FIT Accordion — One bullet per line)</span></label>
                <textarea className="admin-form-textarea" rows={5} placeholder="One bullet per line..." value={editSizeFitInput} onChange={e => setEditSizeFitInput(e.target.value)} />
              </div>
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
                        {editingVariant === v.id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {/* Colour Dropdown tied to Colour Groups */}
                            <select
                              className="admin-form-select"
                              style={{ width: 120, padding: "4px 6px", fontSize: "0.78rem" }}
                              value={variantEdits[v.id]?.selected_options?.find(o => o.name === "Colour")?.value ?? v.selected_options.find(o => o.name === "Colour")?.value ?? ""}
                              onChange={e => {
                                const newColour = e.target.value;
                                setVariantEdits(ed => {
                                  const existingOpts = ed[v.id]?.selected_options ?? v.selected_options.map(o => ({ ...o }));
                                  const updated = existingOpts.map(o => o.name === "Colour" ? { ...o, value: newColour } : o);
                                  if (!updated.find(o => o.name === "Colour") && newColour) updated.push({ name: "Colour", value: newColour });
                                  return { ...ed, [v.id]: { ...ed[v.id], selected_options: updated } };
                                });
                              }}
                            >
                              <option value="">— Colour —</option>
                              {product.colour_groups.map(g => (
                                <option key={g.id} value={g.colour_value}>{g.colour_value}</option>
                              ))}
                            </select>

                            <select
                              className="admin-form-select"
                              style={{ width: 120, padding: "4px 6px", fontSize: "0.78rem" }}
                              value={variantEdits[v.id]?.selected_options?.find(o => o.name === "Size")?.value ?? v.selected_options.find(o => o.name === "Size")?.value ?? ""}
                              onChange={e => {
                                const newSize = e.target.value;
                                setVariantEdits(ed => {
                                  const existingOpts = ed[v.id]?.selected_options ?? v.selected_options.map(o => ({ ...o }));
                                  const updated = existingOpts.map(o => o.name === "Size" ? { ...o, value: newSize } : o);
                                  if (!updated.find(o => o.name === "Size") && newSize) updated.push({ name: "Size", value: newSize });
                                  return { ...ed, [v.id]: { ...ed[v.id], selected_options: updated } };
                                });
                              }}
                            >
                              <option value="">— Size —</option>
                              {SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        ) : (
                          v.selected_options.map((o, idx) => (
                            <span key={idx} className="admin-table-sub" style={{ marginRight: 8 }}>{o.name}: {o.value}</span>
                          ))
                        )}
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
                                const valStr = e.target.value.trim();
                                if (!valStr || valStr === "0") {
                                  setVariantEdits(ed => ({
                                    ...ed,
                                    [v.id]: { ...ed[v.id], compare_at_price_amount: null }
                                  }));
                                  return;
                                }
                                const rawPct = Number(valStr);
                                if (isNaN(rawPct) || rawPct <= 0 || rawPct >= 100) {
                                  setVariantEdits(ed => ({
                                    ...ed,
                                    [v.id]: { ...ed[v.id], compare_at_price_amount: null }
                                  }));
                                  return;
                                }
                                const discPct = Math.round(rawPct);

                                if (currentCompare && currentCompare > 0) {
                                  const calcSelling = Math.round(currentCompare * (1 - discPct / 100));
                                  setVariantEdits(ed => ({
                                    ...ed,
                                    [v.id]: { ...ed[v.id], price_amount: calcSelling }
                                  }));
                                } else if (currentPrice && currentPrice > 0) {
                                  const calcCompare = Math.round(currentPrice / (1 - discPct / 100));
                                  const safeCompare = isFinite(calcCompare) && calcCompare >= currentPrice ? calcCompare : null;
                                  setVariantEdits(ed => ({
                                    ...ed,
                                    [v.id]: { ...ed[v.id], compare_at_price_amount: safeCompare }
                                  }));
                                }
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
                          <div style={{ display: "flex", gap: 6 }}>
                             <button
                               className="admin-btn admin-btn--primary"
                               style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                               onClick={() => handleSaveVariant(v.id)}
                               disabled={savingVariant === v.id}
                             >
                               {savingVariant === v.id ? <span className="admin-btn-spinner" /> : "Save"}
                             </button>
                             <button
                               className="admin-btn admin-btn--ghost"
                               style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                               onClick={() => { setEditingVariant(null); }}
                             >
                               ✕
                             </button>
                           </div>
                        ) : (
                          <div className="admin-table-actions">
                            <button className="admin-icon-btn" title="Edit" onClick={() => { setEditingVariant(v.id); setVariantEdits(ed => ({ ...ed, [v.id]: { price_amount: v.price_amount, compare_at_price_amount: v.compare_at_price_amount, inventory_quantity: v.inventory_quantity, available_for_sale: v.available_for_sale, selected_options: v.selected_options.map(o => ({ ...o })) } })); }}>
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
              {/* Computed duplicate flag */}
              {(() => {
                const isDup = Boolean(
                  product &&
                  newVariant.colour.trim() &&
                  newVariant.size.trim() &&
                  product.variants.some(v => {
                    const vColour = v.selected_options.find(o => o.name === "Colour")?.value ?? "";
                    const vSize = v.selected_options.find(o => o.name === "Size")?.value ?? "";
                    return (
                      vColour.trim().toLowerCase() === newVariant.colour.trim().toLowerCase() &&
                      vSize.trim().toLowerCase() === newVariant.size.trim().toLowerCase()
                    );
                  })
                );
                return (
                  <>
                    <div className="admin-form-group">
                      <label className="admin-form-label">Colour *</label>
                      <select
                        className="admin-form-select"
                        style={isDup ? { borderColor: "#d32f2f", backgroundColor: "rgba(211,47,47,0.04)" } : {}}
                        value={newVariant.colour}
                        onChange={e => setNewVariant(v => ({ ...v, colour: e.target.value }))}
                      >
                        <option value="">— Select Colour —</option>
                        {product?.colour_groups.map(g => (
                          <option key={g.id} value={g.colour_value}>{g.colour_value}</option>
                        ))}
                      </select>
                      {(!product?.colour_groups || product.colour_groups.length === 0) && (
                        <span style={{ fontSize: "0.72rem", color: "#d32f2f", fontWeight: 700, marginTop: 4, display: "block" }}>
                          ⚠️ No Colour Groups found. Please add a Colour Group in the "Colour Groups" tab first.
                        </span>
                      )}
                    </div>
                    <div className="admin-form-group">
                      <label className="admin-form-label">Size *</label>
                      <select
                        className="admin-form-select"
                        style={isDup ? { borderColor: "#d32f2f", backgroundColor: "rgba(211,47,47,0.04)" } : {}}
                        value={newVariant.size}
                        onChange={e => setNewVariant(v => ({ ...v, size: e.target.value }))}
                      >
                        <option value="">— Select Size —</option>
                        {SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {isDup && (
                        <span style={{ fontSize: "0.72rem", color: "#d32f2f", fontWeight: 700, marginTop: 4, display: "block" }}>
                          ⚠️ {newVariant.colour.trim()} / {newVariant.size.trim()} already exists in table above
                        </span>
                      )}
                    </div>
                  </>
                );
              })()}
              <div className="admin-form-group">
                <label className="admin-form-label">Selling Price (₹) *</label>
                <input
                  type="number"
                  className="admin-form-input"
                  style={newVariant.compare_at_price_amount && newVariant.price_amount > Number(newVariant.compare_at_price_amount) ? { borderColor: "#d32f2f", backgroundColor: "rgba(211,47,47,0.04)" } : {}}
                  placeholder="e.g. 1500"
                  value={newVariant.price_amount || ""}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const price = e.target.value ? Number(e.target.value) : 0;
                    setNewVariant(v => ({ ...v, price_amount: price }));
                  }}
                />
                <span style={{ fontSize: "0.72rem", color: "var(--admin-text-secondary)", marginTop: 4, display: "block" }}>Price customer pays at checkout</span>
                {Boolean(newVariant.compare_at_price_amount && newVariant.price_amount > Number(newVariant.compare_at_price_amount)) && (
                  <span style={{ fontSize: "0.72rem", color: "#d32f2f", fontWeight: 700, marginTop: 4, display: "block" }}>
                    ⚠️ Selling price cannot be greater than Original Price (₹{newVariant.compare_at_price_amount})
                  </span>
                )}
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Original Price (MRP ₹)</label>
                <input
                  type="number"
                  className="admin-form-input"
                  placeholder="e.g. 2500"
                  value={newVariant.compare_at_price_amount}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const compareStr = e.target.value;
                    setNewVariant(v => ({ ...v, compare_at_price_amount: compareStr }));
                  }}
                />
                <span style={{ fontSize: "0.72rem", color: "var(--admin-text-secondary)", marginTop: 4, display: "block" }}>Original MRP before discount</span>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Discount % (Auto-Calc Price)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="number"
                    className="admin-form-input"
                    placeholder="e.g. 40"
                    min="1"
                    max="99"
                    value={
                      newVariant.compare_at_price_amount && Number(newVariant.compare_at_price_amount) > newVariant.price_amount && newVariant.price_amount > 0
                        ? Math.min(99, Math.max(1, Math.round(((Number(newVariant.compare_at_price_amount) - newVariant.price_amount) / Number(newVariant.compare_at_price_amount)) * 100))) || ""
                        : ""
                    }
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const valStr = e.target.value.trim();
                      if (!valStr || valStr === "0") {
                        setNewVariant(v => ({ ...v, compare_at_price_amount: "" }));
                        return;
                      }
                      const rawPct = Number(valStr);
                      if (isNaN(rawPct) || rawPct <= 0 || rawPct >= 100) {
                        setNewVariant(v => ({ ...v, compare_at_price_amount: "" }));
                        return;
                      }
                      const discPct = Math.round(rawPct);

                      const compareVal = newVariant.compare_at_price_amount ? Number(newVariant.compare_at_price_amount) : 0;
                      if (compareVal > 0) {
                        const calcSelling = Math.round(compareVal * (1 - discPct / 100));
                        setNewVariant(v => ({ ...v, price_amount: calcSelling }));
                      } else if (newVariant.price_amount > 0) {
                        const calcCompare = Math.round(newVariant.price_amount / (1 - discPct / 100));
                        const safeValue = (isFinite(calcCompare) && calcCompare >= newVariant.price_amount) ? String(calcCompare) : "";
                        setNewVariant(v => ({ ...v, compare_at_price_amount: safeValue }));
                      }
                    }}
                  />
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#d32f2f" }}>%</span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "var(--admin-text-secondary)", marginTop: 4, display: "block" }}>Auto-calculates Selling Price if MRP is set (or MRP if Selling Price is set)</span>
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
            {(() => {
              const isDup = Boolean(
                product &&
                newVariant.colour.trim() &&
                newVariant.size.trim() &&
                product.variants.some(v => {
                  const vColour = v.selected_options.find(o => o.name === "Colour")?.value ?? "";
                  const vSize = v.selected_options.find(o => o.name === "Size")?.value ?? "";
                  return (
                    vColour.trim().toLowerCase() === newVariant.colour.trim().toLowerCase() &&
                    vSize.trim().toLowerCase() === newVariant.size.trim().toLowerCase()
                  );
                })
              );
              return (
                <button
                  className="admin-btn admin-btn--primary"
                  style={{ marginTop: 12, ...(isDup ? { backgroundColor: "#9e9e9e", cursor: "not-allowed", opacity: 0.7 } : {}) }}
                  onClick={handleAddVariant}
                  disabled={addingVariant || isDup}
                >
                  {addingVariant ? <><span className="admin-btn-spinner" /> Adding...</> : isDup ? "Duplicate Variant (Already Exists)" : "+ Add Variant"}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* Colour Groups Tab */}
      {activeTab === "Colour Groups" && (
        <div className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {localGroups.map(g => (
            <div key={g.id} style={{ border: "1px solid var(--admin-card-border)", padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Colour: {g.colour_value}</h3>
                <button className="admin-btn admin-btn--ghost" style={{ color: "var(--admin-danger)" }} onClick={() => handleDeleteGroupLocal(g.id)}>Delete Group</button>
              </div>

              <AdminImageUploader
                endpoint="productImage"
                label={`Images for ${g.colour_value} (Bulk Drag & Drop / Reorder)`}
                existingImages={g.images.map(img => ({ url: img.url, key: img.url, name: g.colour_value }))}
                onReorderExisting={imgs => handleUpdateGroupImagesLocal(g.id, imgs)}
                onUploadComplete={imgs => handleUpdateGroupImagesLocal(g.id, imgs)}
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
            existingImages={localGallery}
            onReorderExisting={imgs => setLocalGallery(imgs)}
            onUploadComplete={imgs => setLocalGallery(imgs)}
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
      {isPageDirty && (
        <div className="admin-unsaved-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem", fontWeight: 600 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffb74d" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            {isDetailsDirty
              ? "You have unsaved changes in Details tab"
              : isVariantsDirty
              ? "You have unsubmitted inputs in Variants tab"
              : isGroupsDirty
              ? "You have unsubmitted inputs in Colour Groups tab"
              : "You have unsubmitted inputs in Reviews tab"}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="admin-btn-discard" onClick={handleDiscardChanges}>
              Discard / Clear
            </button>
            {isDetailsDirty && (
              <button className="admin-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* UNSAVED CHANGES TAB SWITCH WARNING MODAL */}
      {showUnsavedModal && (
        <div className="admin-modal-overlay" onClick={() => setShowUnsavedModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 className="admin-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Unsaved Inputs Warning
            </h3>
            <p style={{ fontSize: "0.88rem", color: "var(--admin-text-secondary)", margin: "12px 0 20px" }}>
              You have unsubmitted inputs on the <strong>{activeTab}</strong> tab. Would you like to save or discard your changes before switching to <strong>{pendingTab}</strong>?
            </p>
            <div className="admin-modal-actions" style={{ flexDirection: "column", gap: 8 }}>
              {activeTab === "Details" && (
                <button className="admin-btn admin-btn--primary" style={{ width: "100%" }} onClick={handleModalSaveAndProceed}>
                  Save Changes & Continue →
                </button>
              )}
              <button className="admin-btn admin-btn--danger" style={{ width: "100%" }} onClick={handleModalDiscardAndProceed}>
                Discard & Continue →
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
