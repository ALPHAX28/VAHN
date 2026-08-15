"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { getAdminProducts, createAdminProduct, createColourGroup } from "@/lib/api/admin";
import { adminListSizeGuide, type SizeGuideType } from "@/lib/api/sizeGuide";
import AdminImageUploader, { type UploadedImage, uploadPendingImages } from "@/components/admin/AdminImageUploader";
import AdminTagInput from "@/components/admin/AdminTagInput";
import AdminLookbookManager, { type LookbookItem, uploadPendingLookbookImages } from "@/components/admin/AdminLookbookManager";

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
  const [allSizeGuides, setAllSizeGuides] = useState<SizeGuideType[]>([]);
  const [selectedSizeGuideIds, setSelectedSizeGuideIds] = useState<number[]>([]);
  const [lookbookItems, setLookbookItems] = useState<LookbookItem[]>([]);


  const [form, setForm] = useState({
    title: "",
    description: "",
    size_fit_details: "",
    care_instructions: "",
    product_details: "",
    vendor: "VAHN",
    product_type: "Jersey",
    available_for_sale: true,
    fit: "",
    kit_type: "",
    activity: "",
    gst_percent: 12,
    shipping_rate: null as number | null,
  });


  // Dynamic Options lists for Product Type, Fit, Kit Type, Activity
  const [productTypeOptions, setProductTypeOptions] = useState(["Jersey", "T-Shirt", "Hoodie", "Sweatshirt", "Pants", "Shorts", "Jacket", "Accessories", "Streetwear", "Footwear"]);
  const [fitOptions, setFitOptions] = useState(["SLIM", "REGULAR", "RELAXED FIT", "OVERSIZED"]);

  const [kitTypeOptions, setKitTypeOptions] = useState(["JERSEY", "HOME", "SIGNATURE"]);
  const [activityOptions, setActivityOptions] = useState(["FOOTBALL", "LIFESTYLE", "STREETWEAR", "CRICKET", "BASKETBALL"]);

  // Custom addition inputs
  const [newProductTypeInput, setNewProductTypeInput] = useState("");
  const [showNewProductTypeInput, setShowNewProductTypeInput] = useState(false);

  const [newFitInput, setNewFitInput] = useState("");
  const [showNewFitInput, setShowNewFitInput] = useState(false);

  const [newKitTypeInput, setNewKitTypeInput] = useState("");
  const [showNewKitTypeInput, setShowNewKitTypeInput] = useState(false);

  const [newActivityInput, setNewActivityInput] = useState("");
  const [showNewActivityInput, setShowNewActivityInput] = useState(false);

  function handleAddCustomProductType() {
    const val = newProductTypeInput.trim();
    if (!val) return;
    if (!productTypeOptions.includes(val)) {
      setProductTypeOptions(opts => [...opts, val]);
    }
    setForm(f => ({ ...f, product_type: val }));
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

    if (form.product_type === typeToDelete) {
      setForm(f => ({ ...f, product_type: "" }));
    }
  }

  // Load existing Product Types, Fits, Kit Types, Activities from DB
  useEffect(() => {
    if (!adminToken) return;
    adminListSizeGuide(adminToken)
      .then((list) => {
        setAllSizeGuides(list);
        const visible = list.filter((s) => s.is_visible);
        if (visible.length > 0) {
          setSelectedSizeGuideIds(visible.map((s) => s.id));
        }
      })
      .catch(() => {});

    getAdminProducts(adminToken)

      .then(res => {
        let deletedTypes: string[] = [];
        try {
          deletedTypes = JSON.parse(localStorage.getItem("vahn_deleted_product_types") || "[]");
        } catch (e) { console.error(e); }

        const defaultTypes = ["Jersey", "T-Shirt", "Hoodie", "Sweatshirt", "Pants", "Shorts", "Jacket", "Accessories", "Streetwear", "Footwear"];
        const dbTypes = (res.items || []).map(item => item.product_type).filter((t): t is string => Boolean(t && t.trim()));
        const merged = Array.from(new Set([...defaultTypes, ...dbTypes]));
        const filtered = merged.filter(t => !deletedTypes.some(dt => dt.toLowerCase() === t.toLowerCase()));
        setProductTypeOptions(filtered);

        const defaultFits = ["SLIM", "REGULAR", "RELAXED FIT", "OVERSIZED"];

        const dbFits = (res.items || []).map(item => item.fit).filter((f): f is string => Boolean(f && f.trim()));
        setFitOptions(Array.from(new Set([...defaultFits, ...dbFits])));

        const defaultKits = ["JERSEY", "HOME", "SIGNATURE"];
        const dbKits = (res.items || []).map(item => item.kit_type).filter((k): k is string => Boolean(k && k.trim()));
        setKitTypeOptions(Array.from(new Set([...defaultKits, ...dbKits])));

        const defaultActivities = ["FOOTBALL", "LIFESTYLE", "STREETWEAR", "CRICKET", "BASKETBALL"];
        const dbActivities = (res.items || []).map(item => item.activity).filter((a): a is string => Boolean(a && a.trim()));
        setActivityOptions(Array.from(new Set([...defaultActivities, ...dbActivities])));
      })
      .catch(() => {});
  }, [adminToken]);

  const [tags, setTags] = useState<string[]>([]);
  const [featuredThumbnail, setFeaturedThumbnail] = useState<UploadedImage[]>([]);
  const [sizeFitInput, setSizeFitInput] = useState<string>("");
  const [customSizeInput, setCustomSizeInput] = useState("");

  // Colour Groups hierarchy state (SCRUM-19: Start with no pre-selected sizes by default)
  const [colourGroups, setColourGroups] = useState<ColourGroupForm[]>([
    {
      colour_value: "Maroon",
      images: [],
      sizes: {},
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
        sizes: {}, // SCRUM-19: No pre-selected sizes
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
        // SCRUM-21: Start with clean 0 / empty values instead of pre-filled defaults
        sizes[size] = { inventory_quantity: 0, price_amount: 0, compare_at_price_amount: "" };
      }
      return { ...g, sizes };
    }));
  }

  // SCRUM-20: Remove added size record directly from size matrix
  function removeSizeFromGroup(groupIndex: number, size: string) {
    setColourGroups(groups => groups.map((g, idx) => {
      if (idx !== groupIndex) return g;
      const sizes = { ...g.sizes };
      delete sizes[size];
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
          // SCRUM-21: Start with clean 0 / empty values instead of pre-filled defaults
          [size]: { inventory_quantity: 0, price_amount: 0, compare_at_price_amount: "" },
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
        // SCRUM-21: Prevent negative stock quantity
        const qtyVal = Math.max(0, Number(val) || 0);
        return { ...g, sizes: { ...g.sizes, [size]: { ...currentMeta, inventory_quantity: qtyVal } } };
      } else if (field === "price_amount") {
        // SCRUM-21: Prevent negative price
        updatedPrice = Math.max(0, Number(val) || 0);
      } else if (field === "compare_at_price_amount") {
        if (val === "" || val === null || val === undefined) {
          updatedCompare = "";
        } else {
          // SCRUM-21: Prevent negative compare price
          updatedCompare = String(Math.max(0, Number(val) || 0));
        }
      } else if (field === "discount_percent") {
        const discPct = Math.round(Math.max(0, Number(val) || 0));
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

    const activeGuides = allSizeGuides.filter((s) => s.is_visible);
    if (activeGuides.length > 0 && selectedSizeGuideIds.length === 0) {
      setError("Please select at least one Size Guide for this product.");
      return;
    }

    if (!form.gst_percent && form.gst_percent !== 0) {

      setError("GST Rate is required. Please select a GST percentage.");
      return;
    }

    if (colourGroups.length === 0 || colourGroups.some(g => !g.colour_value.trim())) {
      setError("Please specify at least one valid Colour Name for your Colour Group.");
      return;
    }

    // SCRUM-21 & SCRUM-22 Validation Checks across all colour groups and sizes
    for (const group of colourGroups) {
      for (const [size, meta] of Object.entries(group.sizes)) {
        const sellingPrice = Number(meta.price_amount) || 0;
        const comparePrice = meta.compare_at_price_amount ? Number(meta.compare_at_price_amount) : 0;
        const qty = Number(meta.inventory_quantity) || 0;

        // SCRUM-21: Negative check
        if (sellingPrice < 0 || comparePrice < 0 || qty < 0) {
          setError(`Price and quantity cannot be negative for size '${size}' in ${group.colour_value || 'Colour Group'}.`);
          return;
        }

        // SCRUM-22: Compare price cannot be less than selling price
        if (comparePrice > 0 && comparePrice < sellingPrice) {
          setError(`Original Price (MRP ₹${comparePrice}) cannot be less than Selling Price (₹${sellingPrice}) for size '${size}' in ${group.colour_value || 'Colour Group'}.`);
          return;
        }
      }
    }

    setLoading(true);

    try {
      // 1. Upload any pending Featured Thumbnail image to S3
      const uploadedFeatured = await uploadPendingImages(featuredThumbnail, "products", adminToken);

      // 2. Upload any pending Colour Group images to S3
      const uploadedColourGroups: ColourGroupForm[] = [];
      for (const group of colourGroups) {
        const uploadedGroupImages = await uploadPendingImages(group.images, "products", adminToken);
        uploadedColourGroups.push({
          ...group,
          images: uploadedGroupImages,
        });
      }

      // 3. Upload any pending Lookbook image files to S3
      const uploadedLookbook = await uploadPendingLookbookImages(lookbookItems);

      const allColours = uploadedColourGroups.map(g => g.colour_value.trim());
      const allSizes = [...new Set(uploadedColourGroups.flatMap(g => Object.keys(g.sizes)))];

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

      for (const group of uploadedColourGroups) {
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

      const allImages = uploadedColourGroups.flatMap(g => g.images.map(img => ({ url: img.url, altText: `${g.colour_value} image` })));
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
        lookbook: uploadedLookbook,
        variants,
        available_for_sale: form.available_for_sale,
        fit: form.fit || null,
        kit_type: form.kit_type || null,
        activity: form.activity || null,
        featured_image_url: uploadedFeatured[0]?.url || allImages[0]?.url || null,
        featured_image_alt: form.title,
        gst_percent: form.gst_percent,
        shipping_rate: form.shipping_rate,
        size_guide_type_ids: selectedSizeGuideIds,
        size_fit_details: form.size_fit_details,
        care_instructions: form.care_instructions,
        product_details: form.product_details,
      });

      // 2. Save Product Colour Groups into Database
      for (let i = 0; i < uploadedColourGroups.length; i++) {
        const g = uploadedColourGroups[i];
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
          <button
            type="button"
            onClick={() => router.back()}
            className="admin-btn-inline-link"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8, fontSize: "0.8125rem", color: "var(--admin-text-secondary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}
          >
            ← Back to Products
          </button>
          <h1 className="admin-page-title">New Product</h1>
          <p className="admin-page-subtitle">Configure product details, attributes, colour image groups, and size matrix</p>
        </div>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, minHeight: 18 }}>
                  <label className="admin-form-label" style={{ marginBottom: 0 }}>Vendor</label>
                </div>
                <input type="text" className="admin-form-input" value={form.vendor} onChange={updateForm("vendor")} />
              </div>

              <div className="admin-form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, minHeight: 18 }}>
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
                      value={form.product_type}
                      onChange={updateForm("product_type")}
                    >
                      <option value="">— Select Product Type —</option>
                      {productTypeOptions.map(pt => (
                        <option key={pt} value={pt}>{pt}</option>
                      ))}
                    </select>
                    {form.product_type && (
                      <div style={{ marginTop: 4, display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteProductType(form.product_type)}
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
                          ✕ Delete "{form.product_type}" from options
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Interactive Tag Input */}
              <div className="admin-form-group admin-form-group--full">
                <label className="admin-form-label">Product Tags</label>
                <AdminTagInput tags={tags} onChange={setTags} />
              </div>
            </div>
          </div>

          {/* Product Accordions Section */}
          <div className="admin-card">
            <h2 className="admin-card-section-title">Product Information Accordions</h2>
            <p className="admin-page-subtitle" style={{ marginBottom: 16, fontSize: "0.8rem" }}>
              Configure content for the four expandable accordions on the Product Details Page (PDP).
            </p>
            <div className="admin-form-grid">
              <div className="admin-form-group admin-form-group--full">
                <label className="admin-form-label">1. Description (Displayed in DESCRIPTION Accordion)</label>
                <textarea
                  className="admin-form-textarea"
                  rows={4}
                  placeholder="e.g. A classic training tee ready for everything from cardio to weights. No matter how intense the workout, you'll stay dry and focused..."
                  value={form.description}
                  onChange={updateForm("description")}
                />
              </div>

              <div className="admin-form-group admin-form-group--full">
                <label className="admin-form-label">2. Size & Fit Details (Displayed in SIZE & FIT Accordion)</label>
                <textarea
                  className="admin-form-textarea"
                  rows={4}
                  placeholder="e.g. Slim fit design. Model is 6'1 wearing size L. Fits true to size with tailored shoulder seams..."
                  value={form.size_fit_details}
                  onChange={updateForm("size_fit_details")}
                />
              </div>

              <div className="admin-form-group admin-form-group--full">
                <label className="admin-form-label">3. Care Instructions (Displayed in CARE Accordion)</label>
                <textarea
                  className="admin-form-textarea"
                  rows={3}
                  placeholder="e.g. Machine wash cold delicate cycle. Do not bleach. Do not tumble dry. Touch up with cool iron..."
                  value={form.care_instructions}
                  onChange={updateForm("care_instructions")}
                />
              </div>

              <div className="admin-form-group admin-form-group--full">
                <label className="admin-form-label">4. Details & Specifications (Displayed in DETAILS Accordion)</label>
                <textarea
                  className="admin-form-textarea"
                  rows={4}
                  placeholder="e.g. 100% Recycled Polyester. AEROREADY moisture-wicking technology. Crewneck collar. Imported."
                  value={form.product_details}
                  onChange={updateForm("product_details")}
                />
              </div>
            </div>
          </div>


          {/* PRICING & TAX */}
          <div className="admin-card">
            <h2 className="admin-card-section-title">Pricing & Tax</h2>
            <p className="admin-page-subtitle" style={{ marginBottom: 16, fontSize: "0.8rem" }}>
              GST is calculated <strong>inclusively</strong> from the variant selling price. Select the applicable GST slab for this product category.
              Leave Shipping Rate blank to use the global rule (free ≥ ₹1999, else ₹99).
            </p>
            <div className="admin-form-grid">
              <div className="admin-form-group">
                <label className="admin-form-label">GST Rate (%) *</label>
                <select
                  className="admin-form-select"
                  value={String(form.gst_percent)}
                  onChange={e => setForm(f => ({ ...f, gst_percent: Number(e.target.value) }))}
                  required
                >
                  <option value="0">0% — Exempt (Books, raw food)</option>
                  <option value="5">5% — Reduced rate</option>
                  <option value="12">12% — Standard (Garments ≤₹1000 MRP)</option>
                  <option value="18">18% — Standard (Garments &gt;₹1000 MRP)</option>
                  <option value="28">28% — Luxury / sin goods</option>
                </select>
                {form.gst_percent > 0 && (
                  <div style={{ marginTop: 6, fontSize: "0.75rem", color: "var(--admin-text-secondary)", background: "rgba(25,118,210,0.07)", border: "1px solid rgba(25,118,210,0.2)", padding: "6px 10px" }}>
                    Example: On a ₹2,499 price — GST portion = <strong>₹{Math.round((2499 * form.gst_percent) / (100 + form.gst_percent)).toLocaleString()}</strong>
                    &nbsp;·&nbsp; Base (ex-GST) = ₹{(2499 - Math.round((2499 * form.gst_percent) / (100 + form.gst_percent))).toLocaleString()}
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
                    value={form.shipping_rate ?? ""}
                    onFocus={e => e.target.select()}
                    onChange={e => setForm(f => ({ ...f, shipping_rate: e.target.value === "" ? null : Number(e.target.value) }))}
                  />
                </div>
                <div style={{ marginTop: 6, fontSize: "0.75rem", color: "var(--admin-text-secondary)" }}>
                  {form.shipping_rate === null
                    ? "Global rule: Free ≥ ₹1,999 · ₹99 otherwise"
                    : form.shipping_rate === 0
                    ? "✓ Free shipping for all orders of this product"
                    : `₹${form.shipping_rate} flat shipping rate`}
                </div>
              </div>
            </div>
          </div>

          {/* SIZE GUIDES SECTION */}
          <div className="admin-card">
            <h2 className="admin-card-section-title">Size Guides</h2>
            <p className="admin-page-subtitle" style={{ fontSize: "0.78rem", marginBottom: 12 }}>
              Select which size guides (measurement types) to display for this product on the storefront.
            </p>
            {allSizeGuides.filter((sg) => sg.is_visible).length === 0 ? (
              <p style={{ fontSize: "0.8125rem", color: "var(--admin-text-secondary)" }}>
                No active size guides configured in system.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {allSizeGuides
                    .filter((sg) => sg.is_visible)
                    .map((sg) => {
                      const isSelected = selectedSizeGuideIds.includes(sg.id);
                      return (
                        <label
                          key={sg.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 14px",
                            borderRadius: 6,
                            border: isSelected
                              ? "2px solid var(--admin-primary)"
                              : "1px solid var(--admin-card-border)",
                            background: isSelected
                              ? "rgba(58, 54, 153, 0.05)"
                              : "var(--admin-bg-page)",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            userSelect: "none",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelectedSizeGuideIds((prev) =>
                                checked ? [...prev, sg.id] : prev.filter((id) => id !== sg.id)
                              );
                            }}
                            style={{ accentColor: "var(--admin-primary)", width: 16, height: 16 }}
                          />
                          <span>{sg.name}</span>
                        </label>
                      );
                    })}
                </div>
                {selectedSizeGuideIds.length === 0 && (
                  <div style={{ fontSize: "0.75rem", color: "#d32f2f", fontWeight: 600, marginTop: 4 }}>
                    ⚠️ At least one size guide must be selected for this product.
                  </div>
                )}
              </div>
            )}
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
                            <th style={{ width: 60, textAlign: "center" }}>Action</th>
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
                                    min="0"
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
                                    min="0"
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
                                    min="0"
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
                                      min="0"
                                      max="99"
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
                                <td style={{ textAlign: "center" }}>
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn--ghost"
                                    style={{ color: "#e53935", padding: "2px 8px", fontSize: "0.8rem" }}
                                    title={`Remove size ${sizeKey}`}
                                    onClick={() => removeSizeFromGroup(groupIdx, sizeKey)}
                                  >
                                    ✕ Remove
                                  </button>
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

          {/* LOOKBOOK SECTION ("HOW HE WEARS IT") */}
          <div className="admin-card">
            <AdminLookbookManager
              items={lookbookItems}
              onChange={setLookbookItems}
            />
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
