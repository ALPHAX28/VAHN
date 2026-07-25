"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { createAdminProduct, createColourGroup } from "@/lib/api/admin";
import AdminImageUploader, { type UploadedImage } from "@/components/admin/AdminImageUploader";
import AdminTagInput from "@/components/admin/AdminTagInput";

const STANDARD_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];

interface ColourGroupForm {
  colour_value: string;
  images: UploadedImage[];
  sizes: Record<string, { inventory_quantity: number; price_amount: number; compare_at_price_amount: string }>;
}

export default function NewProductPage() {
  const { adminToken } = useAdminAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    vendor: "VAHN",
    product_type: "Jersey",
    available_for_sale: true,
    fit: "",
    kit_type: "",
    activity: "",
  });

  // Dynamic Options lists for Fit, Kit Type, Activity
  const [fitOptions, setFitOptions] = useState(["SLIM", "REGULAR", "OVERSIZED"]);
  const [kitTypeOptions, setKitTypeOptions] = useState(["JERSEY", "HOME", "SIGNATURE"]);
  const [activityOptions, setActivityOptions] = useState(["FOOTBALL", "LIFESTYLE", "STREETWEAR", "CRICKET", "BASKETBALL"]);

  // Custom addition inputs
  const [newFitInput, setNewFitInput] = useState("");
  const [showNewFitInput, setShowNewFitInput] = useState(false);

  const [newKitTypeInput, setNewKitTypeInput] = useState("");
  const [showNewKitTypeInput, setShowNewKitTypeInput] = useState(false);

  const [newActivityInput, setNewActivityInput] = useState("");
  const [showNewActivityInput, setShowNewActivityInput] = useState(false);

  const [tags, setTags] = useState<string[]>(["jersey", "streetwear"]);
  const [featuredThumbnail, setFeaturedThumbnail] = useState<UploadedImage[]>([]);
  const [sizeFitInput, setSizeFitInput] = useState<string>(
    "Heavyweight 360gsm organic cotton blend\nBespoke relaxed oversized silhouette\nSignature embroidered branding on chest\nRibbed crewneck collar"
  );
  const [customSizeInput, setCustomSizeInput] = useState("");

  // Colour Groups hierarchy state
  const [colourGroups, setColourGroups] = useState<ColourGroupForm[]>([
    {
      colour_value: "Maroon",
      images: [],
      sizes: {
        S: { inventory_quantity: 10, price_amount: 2499, compare_at_price_amount: "" },
        M: { inventory_quantity: 15, price_amount: 2499, compare_at_price_amount: "" },
        L: { inventory_quantity: 12, price_amount: 2499, compare_at_price_amount: "" },
      },
    },
  ]);

  const updateForm = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  // Fit / Kit Type / Activity Addition Helpers
  function handleAddCustomFit() {
    const val = newFitInput.trim().toUpperCase();
    if (!val) return;
    if (!fitOptions.includes(val)) {
      setFitOptions(opts => [...opts, val]);
    }
    setForm(f => ({ ...f, fit: val }));
    setNewFitInput("");
    setShowNewFitInput(false);
  }

  function handleAddCustomKitType() {
    const val = newKitTypeInput.trim().toUpperCase();
    if (!val) return;
    if (!kitTypeOptions.includes(val)) {
      setKitTypeOptions(opts => [...opts, val]);
    }
    setForm(f => ({ ...f, kit_type: val }));
    setNewKitTypeInput("");
    setShowNewKitTypeInput(false);
  }

  function handleAddCustomActivity() {
    const val = newActivityInput.trim().toUpperCase();
    if (!val) return;
    if (!activityOptions.includes(val)) {
      setActivityOptions(opts => [...opts, val]);
    }
    setForm(f => ({ ...f, activity: val }));
    setNewActivityInput("");
    setShowNewActivityInput(false);
  }

  // Colour Group Helpers
  function addColourGroup() {
    setColourGroups(groups => [
      ...groups,
      {
        colour_value: "",
        images: [],
        sizes: {
          M: { inventory_quantity: 10, price_amount: 2499, compare_at_price_amount: "" },
        },
      },
    ]);
  }

  function removeColourGroup(groupIndex: number) {
    setColourGroups(groups => groups.filter((_, idx) => idx !== groupIndex));
  }

  function updateColourName(groupIndex: number, name: string) {
    setColourGroups(groups => groups.map((g, idx) => idx === groupIndex ? { ...g, colour_value: name } : g));
  }

  function updateColourImages(groupIndex: number, images: UploadedImage[]) {
    setColourGroups(groups => groups.map((g, idx) => idx === groupIndex ? { ...g, images } : g));
  }

  function toggleSizeForGroup(groupIndex: number, size: string) {
    setColourGroups(groups => groups.map((g, idx) => {
      if (idx !== groupIndex) return g;
      const sizes = { ...g.sizes };
      if (sizes[size]) {
        delete sizes[size];
      } else {
        sizes[size] = { inventory_quantity: 10, price_amount: 2499, compare_at_price_amount: "" };
      }
      return { ...g, sizes };
    }));
  }

  function addCustomSizeToGroup(groupIndex: number) {
    const size = customSizeInput.trim().toUpperCase();
    if (!size) return;
    setColourGroups(groups => groups.map((g, idx) => {
      if (idx !== groupIndex) return g;
      return {
        ...g,
        sizes: {
          ...g.sizes,
          [size]: { inventory_quantity: 10, price_amount: 2499, compare_at_price_amount: "" },
        },
      };
    }));
    setCustomSizeInput("");
  }

  function updateSizeMatrix(groupIndex: number, size: string, field: "inventory_quantity" | "price_amount" | "compare_at_price_amount" | "discount_percent", val: string | number) {
    setColourGroups(groups => groups.map((g, idx) => {
      if (idx !== groupIndex) return g;
      const currentMeta = g.sizes[size] || { inventory_quantity: 0, price_amount: 0, compare_at_price_amount: "" };
      let updatedPrice = currentMeta.price_amount;
      let updatedCompare = currentMeta.compare_at_price_amount;

      if (field === "inventory_quantity") {
        return { ...g, sizes: { ...g.sizes, [size]: { ...currentMeta, inventory_quantity: Number(val) } } };
      } else if (field === "price_amount") {
        updatedPrice = Number(val);
      } else if (field === "compare_at_price_amount") {
        updatedCompare = String(val);
      } else if (field === "discount_percent") {
        const discPct = Math.round(Number(val));
        if (discPct > 0 && updatedPrice > 0) {
          updatedCompare = String(Math.round(updatedPrice / (1 - discPct / 100)));
        } else if (discPct === 0) {
          updatedCompare = "";
        }
      }

      return {
        ...g,
        sizes: {
          ...g.sizes,
          [size]: {
            inventory_quantity: currentMeta.inventory_quantity,
            price_amount: updatedPrice,
            compare_at_price_amount: updatedCompare,
          },
        },
      };
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adminToken) return;
    setError("");

    if (!form.title.trim()) {
      setError("Please enter a product title.");
      return;
    }

    if (colourGroups.length === 0 || colourGroups.some(g => !g.colour_value.trim())) {
      setError("Please specify at least one valid Colour Name for your Colour Group.");
      return;
    }

    setLoading(true);

    try {
      const allColours = colourGroups.map(g => g.colour_value.trim());
      const allSizes = [...new Set(colourGroups.flatMap(g => Object.keys(g.sizes)))];

      const options = [
        { id: "colour", name: "Colour", values: allColours },
        { id: "size", name: "Size", values: allSizes },
      ];

      // Build product variants matrix
      const variants: Array<{
        title: string;
        price_amount: number;
        compare_at_price_amount: number | null;
        inventory_quantity: number;
        available_for_sale: boolean;
        image_url: string | null;
        selected_options: Array<{ name: string; value: string }>;
      }> = [];

      for (const group of colourGroups) {
        const colourName = group.colour_value.trim();
        const primaryImage = group.images[0]?.url || null;

        for (const [size, meta] of Object.entries(group.sizes)) {
          variants.push({
            title: `${colourName} / ${size}`,
            price_amount: Number(meta.price_amount) || 2499,
            compare_at_price_amount: meta.compare_at_price_amount ? Number(meta.compare_at_price_amount) : null,
            inventory_quantity: Number(meta.inventory_quantity) || 0,
            available_for_sale: form.available_for_sale,
            image_url: primaryImage,
            selected_options: [
              { name: "Colour", value: colourName },
              { name: "Size", value: size },
            ],
          });
        }
      }

      const allImages = colourGroups.flatMap(g => g.images.map(img => ({ url: img.url, altText: `${g.colour_value} image` })));
      const autoHandle = `${form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;

      const sizeFitBullets = sizeFitInput.split("\n").map(b => b.trim()).filter(Boolean);
      const descriptionHtml = `<p>${form.description}</p>${sizeFitBullets.length > 0 ? `<ul>${sizeFitBullets.map(b => `<li>${b}</li>`).join("")}</ul>` : ""}`;

      // 1. Create main Product
      const product = await createAdminProduct(adminToken, {
        title: form.title,
        handle: autoHandle,
        description: form.description,
        description_html: descriptionHtml,
        vendor: form.vendor,
        product_type: form.product_type,
        tags,
        options,
        images: allImages,
        variants,
        available_for_sale: form.available_for_sale,
        fit: form.fit || null,
        kit_type: form.kit_type || null,
        activity: form.activity || null,
        featured_image_url: featuredThumbnail[0]?.url || allImages[0]?.url || null,
        featured_image_alt: form.title,
      });

      // 2. Save Product Colour Groups into Database
      for (let i = 0; i < colourGroups.length; i++) {
        const g = colourGroups[i];
        await createColourGroup(adminToken, product.id, {
          colour_value: g.colour_value.trim(),
          images: g.images.map(img => ({ url: img.url, altText: `${g.colour_value} photo` })),
          display_order: i,
        });
      }

      router.push(`/admin/products/${product.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">New Product</h1>
          <p className="admin-page-subtitle">Configure product details, attributes, colour image groups, and size matrix</p>
        </div>
        <button onClick={() => router.back()} className="admin-btn admin-btn--ghost">← Back</button>
      </div>

      {error && <div className="admin-alert admin-alert--error">{error}</div>}

      <form onSubmit={handleSubmit} className="admin-form-layout">
        <div className="admin-form-main">
          {/* Featured Thumbnail Card */}
          <div className="admin-card">
            <h2 className="admin-card-section-title">Product Featured Thumbnail</h2>
            <p className="admin-page-subtitle" style={{ fontSize: "0.78rem", marginBottom: 12 }}>
              Upload a main thumbnail image for storefront product cards & search results (if empty, first gallery image will be used).
            </p>
            <AdminImageUploader
              endpoint="productImage"
              maxImages={1}
              label="Primary Featured Thumbnail"
              existingImages={featuredThumbnail}
              onReorderExisting={setFeaturedThumbnail}
              onUploadComplete={setFeaturedThumbnail}
            />
          </div>

          {/* Basic Info */}
          <div className="admin-card">
            <h2 className="admin-card-section-title">Basic Information</h2>
            <div className="admin-form-grid">
              <div className="admin-form-group admin-form-group--full">
                <label className="admin-form-label">Title *</label>
                <input
                  type="text"
                  className="admin-form-input"
                  placeholder="e.g. VAHN Signature Oversized Jersey"
                  value={form.title}
                  onChange={updateForm("title")}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Vendor</label>
                <input type="text" className="admin-form-input" value={form.vendor} onChange={updateForm("vendor")} />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Product Type</label>
                <input type="text" className="admin-form-input" placeholder="e.g. Jersey" value={form.product_type} onChange={updateForm("product_type")} />
              </div>

              {/* Interactive Tag Input */}
              <div className="admin-form-group admin-form-group--full">
                <label className="admin-form-label">Product Tags</label>
                <AdminTagInput tags={tags} onChange={setTags} />
              </div>

              <div className="admin-form-group admin-form-group--full">
                <label className="admin-form-label">Product Details & Story (Displayed in DETAILS Accordion)</label>
                <textarea
                  className="admin-form-textarea"
                  rows={3}
                  placeholder="e.g. Made with care and unconditionally loved by our customers. This signature bestseller exceeds all expectations..."
                  value={form.description}
                  onChange={updateForm("description")}
                />
              </div>

              <div className="admin-form-group admin-form-group--full">
                <label className="admin-form-label">Size & Fit Features (Displayed in SIZE & FIT Accordion — One bullet per line)</label>
                <textarea
                  className="admin-form-textarea"
                  rows={4}
                  placeholder="e.g.&#10;Heavyweight 360gsm organic cotton blend&#10;Bespoke relaxed oversized silhouette&#10;Signature embroidered branding on chest&#10;Ribbed crewneck collar"
                  value={sizeFitInput}
                  onChange={e => setSizeFitInput(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ATTRIBUTES SECTION */}
          <div className="admin-card">
            <h2 className="admin-card-section-title">Attributes</h2>

            <div className="admin-form-grid">
              {/* Fit with Add Custom Option */}
              <div className="admin-form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label className="admin-form-label">Fit</label>
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    style={{ fontSize: "0.72rem", padding: 0 }}
                    onClick={() => setShowNewFitInput(s => !s)}
                  >
                    {showNewFitInput ? "Cancel" : "+ Add New Fit"}
                  </button>
                </div>
                {showNewFitInput ? (
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. COMPRESSION"
                      value={newFitInput}
                      onChange={e => setNewFitInput(e.target.value)}
                    />
                    <button type="button" className="admin-btn admin-btn--secondary" onClick={handleAddCustomFit}>
                      Add
                    </button>
                  </div>
                ) : (
                  <select className="admin-form-select" value={form.fit} onChange={updateForm("fit")}>
                    <option value="">— Select fit —</option>
                    {fitOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
              </div>

              {/* Kit Type with Add Custom Option */}
              <div className="admin-form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label className="admin-form-label">Kit Type</label>
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    style={{ fontSize: "0.72rem", padding: 0 }}
                    onClick={() => setShowNewKitTypeInput(s => !s)}
                  >
                    {showNewKitTypeInput ? "Cancel" : "+ Add New Kit Type"}
                  </button>
                </div>
                {showNewKitTypeInput ? (
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. AWAY, THIRD, TRAINING"
                      value={newKitTypeInput}
                      onChange={e => setNewKitTypeInput(e.target.value)}
                    />
                    <button type="button" className="admin-btn admin-btn--secondary" onClick={handleAddCustomKitType}>
                      Add
                    </button>
                  </div>
                ) : (
                  <select className="admin-form-select" value={form.kit_type} onChange={updateForm("kit_type")}>
                    <option value="">— Select kit type —</option>
                    {kitTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
              </div>

              {/* Activity with Add Custom Option */}
              <div className="admin-form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label className="admin-form-label">Activity</label>
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    style={{ fontSize: "0.72rem", padding: 0 }}
                    onClick={() => setShowNewActivityInput(s => !s)}
                  >
                    {showNewActivityInput ? "Cancel" : "+ Add New Activity"}
                  </button>
                </div>
                {showNewActivityInput ? (
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. RUNNING, PADEL, GYM"
                      value={newActivityInput}
                      onChange={e => setNewActivityInput(e.target.value)}
                    />
                    <button type="button" className="admin-btn admin-btn--secondary" onClick={handleAddCustomActivity}>
                      Add
                    </button>
                  </div>
                ) : (
                  <select className="admin-form-select" value={form.activity} onChange={updateForm("activity")}>
                    <option value="">— Select activity —</option>
                    {activityOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Store Visibility</label>
                <label className="admin-toggle" style={{ marginTop: 6 }}>
                  <input type="checkbox" checked={form.available_for_sale} onChange={updateForm("available_for_sale")} />
                  <span className="admin-toggle-track" />
                  <span className="admin-toggle-label">Available for sale</span>
                </label>
              </div>
            </div>
          </div>

          {/* COLOUR GROUPS HIERARCHY */}
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h2 className="admin-card-section-title" style={{ margin: 0 }}>Colour Image & Size Stock Hierarchy</h2>
                <p className="admin-page-subtitle" style={{ fontSize: "0.78rem" }}>
                  Upload & rearrange 5+ images per colour. Customers will see these exact images when switching colours on storefront.
                </p>
              </div>
              <button type="button" className="admin-btn admin-btn--secondary" onClick={addColourGroup}>
                + Add Colour Group
              </button>
            </div>

            <div className="admin-variant-list">
              {colourGroups.map((group, groupIdx) => (
                <div key={groupIdx} className="admin-colour-group-card" style={{ padding: 20 }}>
                  <div className="admin-form-grid" style={{ marginBottom: 16 }}>
                    <div className="admin-form-group admin-form-group--full">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label className="admin-form-label">Colour Name *</label>
                        {colourGroups.length > 1 && (
                          <button type="button" className="admin-btn admin-btn--ghost" style={{ color: "#e53935", padding: 0 }} onClick={() => removeColourGroup(groupIdx)}>
                            Remove Colour Group ✕
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        className="admin-form-input"
                        placeholder="e.g. Maroon, Cobalt Blue, Lemon Yellow"
                        value={group.colour_value}
                        onChange={e => updateColourName(groupIdx, e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Bulk Uploader & Live Reorder for this Colour */}
                  <div style={{ marginBottom: 20 }}>
                    <AdminImageUploader
                      endpoint="productImage"
                      maxImages={10}
                      label={`Images for ${group.colour_value || "this colour"} (Bulk Upload & Reorder)`}
                      existingImages={group.images}
                      onReorderExisting={(imgs) => updateColourImages(groupIdx, imgs)}
                      onUploadComplete={(imgs) => updateColourImages(groupIdx, imgs)}
                    />
                  </div>

                  {/* Size Multi-Select for this Colour */}
                  <div>
                    <label className="admin-form-label" style={{ marginBottom: 8, display: "block" }}>Select Sizes & Quantities for {group.colour_value || "this colour"}</label>

                    <div className="admin-size-chips">
                      {STANDARD_SIZES.map(s => {
                        const isSelected = !!group.sizes[s];
                        return (
                          <button
                            key={s}
                            type="button"
                            className={`admin-size-chip ${isSelected ? "admin-size-chip--active" : ""}`}
                            onClick={() => toggleSizeForGroup(groupIdx, s)}
                          >
                            {isSelected ? `✓ ${s}` : `+ ${s}`}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Size Addition */}
                    <div style={{ display: "flex", gap: 8, maxWidth: 300, marginBottom: 16 }}>
                      <input
                        type="text"
                        className="admin-form-input"
                        placeholder="Add custom size (e.g. 4XL)"
                        value={customSizeInput}
                        onChange={e => setCustomSizeInput(e.target.value)}
                      />
                      <button type="button" className="admin-btn admin-btn--secondary" onClick={() => addCustomSizeToGroup(groupIdx)}>
                        Add
                      </button>
                    </div>

                    {/* Stock & Price Matrix Table */}
                    {Object.keys(group.sizes).length > 0 && (
                      <table className="admin-size-matrix-table">
                        <thead>
                          <tr>
                            <th>Size</th>
                            <th>Stock Quantity</th>
                            <th>Selling Price (₹)</th>
                            <th>Original Price (MRP ₹)</th>
                            <th>Discount (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(group.sizes).map(([sizeKey, meta]) => {
                            const price = meta.price_amount;
                            const compare = meta.compare_at_price_amount ? Number(meta.compare_at_price_amount) : 0;
                            const discountPct = compare > price && compare > 0 ? Math.round(((compare - price) / compare) * 100) : 0;

                            return (
                              <tr key={sizeKey}>
                                <td style={{ fontWeight: 700 }}>{sizeKey}</td>
                                <td>
                                  <input
                                    type="number"
                                    className="admin-form-input"
                                    style={{ width: 90 }}
                                    value={meta.inventory_quantity}
                                    onFocus={e => e.target.select()}
                                    onChange={e => updateSizeMatrix(groupIdx, sizeKey, "inventory_quantity", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="admin-form-input"
                                    style={{ width: 110 }}
                                    value={meta.price_amount || ""}
                                    onFocus={e => e.target.select()}
                                    onChange={e => updateSizeMatrix(groupIdx, sizeKey, "price_amount", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="admin-form-input"
                                    style={{ width: 110 }}
                                    placeholder="e.g. 2999"
                                    value={meta.compare_at_price_amount}
                                    onFocus={e => e.target.select()}
                                    onChange={e => updateSizeMatrix(groupIdx, sizeKey, "compare_at_price_amount", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <input
                                      type="number"
                                      className="admin-form-input"
                                      style={{ width: 75 }}
                                      placeholder="0"
                                      value={discountPct || ""}
                                      onFocus={e => e.target.select()}
                                      onChange={e => updateSizeMatrix(groupIdx, sizeKey, "discount_percent", e.target.value)}
                                    />
                                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#d32f2f" }}>% OFF</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar actions */}
        <div className="admin-form-sidebar">
          <div className="admin-card">
            <h2 className="admin-card-section-title">Publish Product</h2>
            <button type="submit" className="admin-btn admin-btn--primary admin-btn--full" disabled={loading}>
              {loading ? <span className="admin-btn-spinner" /> : "Save & Publish"}
            </button>
            <button type="button" className="admin-btn admin-btn--ghost admin-btn--full" style={{ marginTop: 8 }} onClick={() => router.back()}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
