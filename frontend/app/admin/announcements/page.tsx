"use client";

import { useEffect, useState, useMemo } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { NotificationBanner } from "@/lib/api/types";
import { getApiBaseUrl } from "@/lib/api/client";

const BANNER_TYPE_PRESETS: Record<
  string,
  { label: string; bg: string; text: string; icon: string; defaultMessage: string }
> = {
  ANNOUNCEMENT: {
    label: "Announcement",
    bg: "#000000",
    text: "#ffffff",
    icon: "📢",
    defaultMessage: "📢 FREE WORLDWIDE SHIPPING ON ORDERS OVER ₹1999",
  },
  SALE: {
    label: "Flash Sale / Promo",
    bg: "#3a3699",
    text: "#ffffff",
    icon: "⚡",
    defaultMessage: "⚡ FLASH SALE: USE CODE VAHN20 FOR 20% OFF | SHIPPING PAN INDIA",
  },
  ALERT: {
    label: "Alert / Urgent",
    bg: "#dc2626",
    text: "#ffffff",
    icon: "🚨",
    defaultMessage: "🚨 LIMITED STOCK: EXCLUSIVE VA-01 RELEASE SELLING FAST",
  },
  MAINTENANCE: {
    label: "Maintenance",
    bg: "#1e293b",
    text: "#f8fafc",
    icon: "🛠️",
    defaultMessage: "🛠️ SCHEDULED SYSTEM UPDATE SUNDAY 2:00 AM - 4:00 AM IST",
  },
  INFO: {
    label: "Information",
    bg: "#0f766e",
    text: "#ffffff",
    icon: "ℹ️",
    defaultMessage: "ℹ️ NEW SAME-DAY DISPATCH AVAILABLE ON ALL METRO ORDERS",
  },
};

const COLOR_PALETTE_PRESETS = [
  { name: "VAHN Blue", bg: "#3a3699", text: "#ffffff" },
  { name: "Deep Black", bg: "#000000", text: "#ffffff" },
  { name: "Crimson Red", bg: "#dc2626", text: "#ffffff" },
  { name: "Slate Charcoal", bg: "#1e293b", text: "#ffffff" },
  { name: "Amber Notice", bg: "#d97706", text: "#000000" },
  { name: "Emerald Green", bg: "#059669", text: "#ffffff" },
  { name: "Royal Purple", bg: "#6b21a8", text: "#ffffff" },
  { name: "Pure White", bg: "#ffffff", text: "#000000" },
];

export default function AdminAnnouncementsPage() {
  const { adminToken } = useAdminAuth();
  const [banners, setBanners] = useState<NotificationBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<NotificationBanner | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    link_url: "",
    link_text: "",
    banner_type: "SALE",
    bg_color: "#3a3699",
    text_color: "#ffffff",
    is_active: true,
    is_closable: false,
    display_order: 0,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchBanners = async () => {
    if (!adminToken) return;
    try {
      setLoading(true);
      const res = await fetch(`${getApiBaseUrl()}/admin/announcements`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error("Failed to load banners");
      const data = await res.json();
      setBanners(data);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to load announcement banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, [adminToken]);

  const openCreateModal = () => {
    setEditingBanner(null);
    const preset = BANNER_TYPE_PRESETS.SALE;
    setFormData({
      title: "",
      message: preset.defaultMessage,
      link_url: "/products",
      link_text: "Shop Now",
      banner_type: "SALE",
      bg_color: preset.bg,
      text_color: preset.text,
      is_active: true,
      is_closable: false,
      display_order: banners.length,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (b: NotificationBanner) => {
    setEditingBanner(b);
    setFormData({
      title: b.title,
      message: b.message,
      link_url: b.link_url || "",
      link_text: b.link_text || "",
      banner_type: b.banner_type,
      bg_color: b.bg_color || BANNER_TYPE_PRESETS[b.banner_type]?.bg || "#000000",
      text_color: b.text_color || BANNER_TYPE_PRESETS[b.banner_type]?.text || "#ffffff",
      is_active: b.is_active,
      is_closable: b.is_closable,
      display_order: b.display_order,
    });
    setIsModalOpen(true);
  };

  const handleTypeChange = (typeKey: string) => {
    const preset = BANNER_TYPE_PRESETS[typeKey];
    setFormData((prev) => ({
      ...prev,
      banner_type: typeKey,
      bg_color: preset?.bg || prev.bg_color,
      text_color: preset?.text || prev.text_color,
      message: preset?.defaultMessage || prev.message,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    if (!formData.title.trim() || !formData.message.trim()) {
      alert("Title and Banner Message are required.");
      return;
    }

    try {
      setSaving(true);
      const url = editingBanner
        ? `${getApiBaseUrl()}/admin/announcements/${editingBanner.id}`
        : `${getApiBaseUrl()}/admin/announcements`;
      const method = editingBanner ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          message: formData.message.trim(),
          link_url: formData.link_url.trim() || null,
          link_text: formData.link_text.trim() || null,
          banner_type: formData.banner_type,
          bg_color: formData.bg_color,
          text_color: formData.text_color,
          is_active: formData.is_active,
          is_closable: formData.is_closable,
          display_order: Number(formData.display_order) || 0,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || "Failed to save banner");
      }

      showToast(editingBanner ? "Banner updated successfully" : "Banner created successfully");
      setIsModalOpen(false);
      fetchBanners();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save banner");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (banner: NotificationBanner) => {
    if (!adminToken) return;
    // Optimistic UI update
    setBanners((prev) =>
      prev.map((b) => (b.id === banner.id ? { ...b, is_active: !b.is_active } : b))
    );

    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/announcements/${banner.id}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error("Toggle failed");
      const updated = await res.json();
      setBanners((prev) => prev.map((b) => (b.id === banner.id ? updated : b)));
      showToast(updated.is_active ? `"${updated.title}" activated` : `"${updated.title}" deactivated`);
    } catch {
      // Revert on error
      fetchBanners();
      alert("Failed to toggle banner status");
    }
  };

  const handleDelete = async (id: number) => {
    if (!adminToken) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/announcements/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      setBanners((prev) => prev.filter((b) => b.id !== id));
      setDeleteConfirmId(null);
      showToast("Banner deleted successfully");
    } catch {
      alert("Failed to delete banner");
    }
  };

  // Active banner count & simulation cycling
  const activeBanners = useMemo(() => banners.filter((b) => b.is_active), [banners]);
  const activeCount = activeBanners.length;
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      setPreviewIndex((prev) => (prev + 1) % activeBanners.length);
    }, 3800);
    return () => clearInterval(interval);
  }, [activeBanners.length]);

  const currentPreviewBanner = activeBanners[previewIndex % (activeBanners.length || 1)];

  return (
    <div className="admin-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "32px",
            right: "32px",
            background: "#000000",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "4px",
            fontSize: "0.85rem",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            textTransform: "uppercase",
            zIndex: 999999,
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span>✔</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Row — Standardized with other Admin tabs */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Banners &amp; Alerts</h1>
          <p className="admin-page-subtitle">
            Manage storefront top announcement banners, promotional sales, urgent notices, and maintenance alerts.
          </p>
        </div>

        <div>
          <button
            onClick={openCreateModal}
            className="admin-btn admin-btn--primary"
          >
            + Create Banner
          </button>
        </div>
      </div>

      {/* Live Storefront Preview Widget */}
      <div className="admin-card" style={{ marginBottom: "24px", padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#374151" }}>
            🖥️ Live Storefront Top-Bar Simulation ({activeCount} Active)
          </span>
          <span style={{ fontSize: "0.75rem", color: activeCount > 0 ? "#059669" : "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.025em" }}>
            {activeCount > 0 ? `● ${activeCount} Banner${activeCount > 1 ? "s" : ""} Live (Auto-Scrolling)` : "○ Default 'SHIPPING PAN INDIA'"}
          </span>
        </div>

        {/* Browser Mockup Window */}
        <div style={{ borderRadius: "6px", overflow: "hidden", border: "1px solid #e5e7eb" }}>
          {/* Mock Browser Header */}
          <div style={{ background: "#f3f4f6", padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
            <span style={{ fontSize: "0.7rem", color: "#6b7280", marginLeft: "12px", fontFamily: "monospace", fontWeight: 600 }}>https://vahnsports.com</span>
          </div>

          {/* Active Banner in Simulation with text wrapping & boundary safety */}
          {activeCount > 0 && currentPreviewBanner ? (
            <div
              style={{
                position: "relative",
                background: currentPreviewBanner.bg_color || "#000000",
                color: currentPreviewBanner.text_color || "#ffffff",
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                fontSize: "0.78rem",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                textTransform: "uppercase",
                textAlign: "center",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                whiteSpace: "normal",
                transition: "all 0.4s ease",
              }}
            >
              <span style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                {currentPreviewBanner.message}
              </span>
              {currentPreviewBanner.link_text && (
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "3px",
                    background: "rgba(255,255,255,0.22)",
                    textDecoration: "underline",
                    textUnderlineOffset: "3px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {currentPreviewBanner.link_text} →
                </span>
              )}

              {/* Dots indicator in preview */}
              {activeBanners.length > 1 && (
                <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", display: "flex", gap: "4px" }}>
                  {activeBanners.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: i === previewIndex % activeBanners.length ? currentPreviewBanner.text_color || "#ffffff" : "rgba(255,255,255,0.35)",
                        transition: "all 0.3s ease",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                background: "#000000",
                color: "rgba(255,255,255,0.9)",
                padding: "10px 16px",
                textAlign: "center",
                fontSize: "0.78rem",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                textTransform: "uppercase",
              }}
            >
              SHIPPING PAN INDIA
            </div>
          )}

          {/* Mock Store Header Bar */}
          <div style={{ background: "#0d0d0f", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#ffffff", fontWeight: 900, letterSpacing: "-0.025em", fontSize: "0.875rem" }}>VAHN</span>
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: "#374151" }} />
              <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: "#374151" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Banners List Table — Standardized Admin Card & Table */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">
            Configured Banners ({banners.length})
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
            Loading announcement banners...
          </div>
        ) : banners.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "12px" }}>📢</span>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#111827", marginBottom: "6px" }}>
              No custom banners yet
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", maxWidth: "420px", margin: "0 auto 20px" }}>
              Create your first top-bar banner to broadcast sales, discounts, maintenance alerts, or holiday shipping updates.
            </p>
            <button
              onClick={openCreateModal}
              className="admin-btn admin-btn--primary"
            >
              + Create First Banner
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: "90px" }}>Active</th>
                  <th style={{ width: "160px" }}>Type</th>
                  <th>Title &amp; Message</th>
                  <th style={{ width: "130px" }}>Colors</th>
                  <th style={{ width: "140px" }}>Link / CTA</th>
                  <th style={{ width: "130px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {banners.map((b) => {
                  const preset = BANNER_TYPE_PRESETS[b.banner_type] || BANNER_TYPE_PRESETS.ANNOUNCEMENT;
                  return (
                    <tr
                      key={b.id}
                      style={{
                        background: b.is_active ? "#ffffff" : "#fafafa",
                      }}
                    >
                      {/* Active Toggle Switch */}
                      <td>
                        <button
                          type="button"
                          onClick={() => handleToggle(b)}
                          style={{
                            width: "38px",
                            height: "22px",
                            borderRadius: "11px",
                            background: b.is_active ? "#10b981" : "#d1d5db",
                            border: "none",
                            cursor: "pointer",
                            position: "relative",
                            transition: "background-color 0.2s ease",
                            padding: "2px",
                          }}
                          aria-label={b.is_active ? "Deactivate banner" : "Activate banner"}
                        >
                          <div
                            style={{
                              width: "18px",
                              height: "18px",
                              borderRadius: "50%",
                              background: "#ffffff",
                              transform: b.is_active ? "translateX(16px)" : "translateX(0px)",
                              transition: "transform 0.2s ease",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                            }}
                          />
                        </button>
                      </td>

                      {/* Type Badge */}
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            padding: "4px 8px",
                            borderRadius: "4px",
                            background: b.bg_color || preset.bg,
                            color: b.text_color || preset.text,
                            textTransform: "uppercase",
                            letterSpacing: "-0.025em",
                          }}
                        >
                          <span>{preset.icon}</span>
                          <span>{preset.label}</span>
                        </span>
                      </td>

                      {/* Title & Message */}
                      <td>
                        <div style={{ fontWeight: 800, color: "#111827", marginBottom: "3px", letterSpacing: "-0.025em" }}>
                          {b.title}
                        </div>
                        <div style={{ color: "#4b5563", fontSize: "0.82rem", lineHeight: 1.4, wordBreak: "break-word" }}>
                          {b.message}
                        </div>
                      </td>

                      {/* Color Preview */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div
                            style={{
                              width: "22px",
                              height: "22px",
                              borderRadius: "4px",
                              background: b.bg_color || preset.bg,
                              border: "1px solid rgba(0,0,0,0.15)",
                            }}
                            title={`Background: ${b.bg_color || preset.bg}`}
                          />
                          <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#111827", fontWeight: 700 }}>
                            {b.bg_color || preset.bg}
                          </span>
                        </div>
                      </td>

                      {/* Link / CTA */}
                      <td>
                        {b.link_url ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#000000" }}>
                              {b.link_text || "Link"} →
                            </span>
                            <span style={{ fontSize: "0.7rem", color: "#6b7280", maxWidth: "130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {b.link_url}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>None</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(b)}
                            className="admin-btn admin-btn--secondary admin-btn--sm"
                          >
                            Edit
                          </button>

                          {deleteConfirmId === b.id ? (
                            <div style={{ display: "inline-flex", gap: "4px" }}>
                              <button
                                type="button"
                                onClick={() => handleDelete(b.id)}
                                className="admin-btn admin-btn--danger admin-btn--sm"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="admin-btn admin-btn--secondary admin-btn--sm"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(b.id)}
                              className="admin-btn admin-btn--danger admin-btn--sm"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: "20px",
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              maxWidth: "640px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", margin: 0 }}>
                {editingBanner ? "Edit Banner" : "Create New Announcement Banner"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#6b7280", fontWeight: 700 }}
              >
                ✕
              </button>
            </div>

            {/* Realtime Live Preview in Modal with Word Wrapping and Boundary Protection */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#374151", marginBottom: "6px" }}>
                Live Visual Preview
              </label>
              <div
                style={{
                  background: formData.bg_color || "#000000",
                  color: formData.text_color || "#ffffff",
                  padding: "10px 14px",
                  borderRadius: "4px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  textTransform: "uppercase",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                  border: "1px solid #000000",
                  minHeight: "38px",
                  maxHeight: "110px",
                  overflowY: "auto",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  whiteSpace: "normal",
                  boxSizing: "border-box",
                  transition: "all 0.2s ease",
                }}
              >
                <span style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                  {formData.message || "(Enter banner message below...)"}
                </span>
                {formData.link_text && (
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      padding: "2px 8px",
                      borderRadius: "3px",
                      background: "rgba(255,255,255,0.25)",
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {formData.link_text} →
                  </span>
                )}
                {formData.is_closable && (
                  <span style={{ opacity: 0.7, fontSize: "0.6875rem", marginLeft: "auto", flexShrink: 0 }}>✕</span>
                )}
              </div>
            </div>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Internal Title with Character Counter */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#111827" }}>
                    Internal Reference Title *
                  </label>
                  <span style={{ fontSize: "0.7rem", color: formData.title.length > 50 ? "#dc2626" : "#6b7280" }}>
                    {formData.title.length} / 60
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={60}
                  placeholder="e.g. Summer Flash Sale 20% Off"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    fontSize: "0.85rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Storefront Banner Message with Character Counter & Preset Sync */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#111827" }}>
                    Storefront Banner Message *
                  </label>
                  <span style={{ fontSize: "0.7rem", color: formData.message.length > 100 ? "#dc2626" : "#6b7280" }}>
                    {formData.message.length} / 120
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={120}
                  placeholder="e.g. ⚡ FLASH SALE: USE CODE VAHN20 FOR 20% OFF | SHIPPING PAN INDIA"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    fontSize: "0.85rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Banner Type Presets */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#111827", marginBottom: "8px" }}>
                  Banner Category &amp; Preset
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "8px" }}>
                  {Object.entries(BANNER_TYPE_PRESETS).map(([key, p]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleTypeChange(key)}
                      style={{
                        padding: "8px 6px",
                        borderRadius: "4px",
                        border: formData.banner_type === key ? "2px solid #000000" : "1px solid #d1d5db",
                        background: formData.banner_type === key ? "#000000" : "#ffffff",
                        color: formData.banner_type === key ? "#ffffff" : "#111827",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ fontSize: "1.1rem" }}>{p.icon}</span>
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.025em" }}>
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Customization & Palette Presets */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#111827", marginBottom: "6px" }}>
                  Color Presets &amp; Custom Overrides
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                  {COLOR_PALETTE_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setFormData({ ...formData, bg_color: p.bg, text_color: p.text })}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "5px 9px",
                        borderRadius: "4px",
                        border: formData.bg_color === p.bg ? "2px solid #000000" : "1px solid #d1d5db",
                        background: "#ffffff",
                        cursor: "pointer",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "-0.025em",
                      }}
                    >
                      <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: p.bg, border: "1px solid rgba(0,0,0,0.2)" }} />
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                      Background Color (Hex)
                    </label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="color"
                        value={formData.bg_color}
                        onChange={(e) => setFormData({ ...formData, bg_color: e.target.value })}
                        style={{ width: "36px", height: "36px", border: "1px solid #d1d5db", borderRadius: "4px", cursor: "pointer", padding: "2px" }}
                      />
                      <input
                        type="text"
                        value={formData.bg_color}
                        onChange={(e) => setFormData({ ...formData, bg_color: e.target.value })}
                        style={{ width: "100%", padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.8rem", fontFamily: "monospace", fontWeight: 700 }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                      Text Color (Hex)
                    </label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="color"
                        value={formData.text_color}
                        onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                        style={{ width: "36px", height: "36px", border: "1px solid #d1d5db", borderRadius: "4px", cursor: "pointer", padding: "2px" }}
                      />
                      <input
                        type="text"
                        value={formData.text_color}
                        onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                        style={{ width: "100%", padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.8rem", fontFamily: "monospace", fontWeight: 700 }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Link URL & Link Text */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#111827", marginBottom: "6px" }}>
                    Destination Link (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. /products"
                    value={formData.link_url}
                    onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.82rem", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#111827" }}>
                      Button Text (Optional)
                    </label>
                    <span style={{ fontSize: "0.6875rem", color: "#6b7280" }}>
                      {formData.link_text.length} / 30
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={30}
                    placeholder="e.g. Shop Now"
                    value={formData.link_text}
                    onChange={(e) => setFormData({ ...formData, link_text: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.82rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Checkbox Options */}
              <div style={{ display: "flex", gap: "20px", padding: "12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.025em" }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ width: "16px", height: "16px", accentColor: "#000000" }}
                  />
                  <span>Active on Storefront</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.025em" }}>
                  <input
                    type="checkbox"
                    checked={formData.is_closable}
                    onChange={(e) => setFormData({ ...formData, is_closable: e.target.checked })}
                    style={{ width: "16px", height: "16px", accentColor: "#000000" }}
                  />
                  <span>Allow Customer to Dismiss [✕]</span>
                </label>
              </div>

              {/* Form Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="admin-btn admin-btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="admin-btn admin-btn--primary"
                  style={{ opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? "Saving..." : editingBanner ? "Save Changes" : "Publish Banner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
