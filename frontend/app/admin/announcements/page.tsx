"use client";

import { useEffect, useState, useMemo } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { NotificationBanner } from "@/lib/api/types";
import { getApiBaseUrl } from "@/lib/api/client";
import Link from "next/link";

const BANNER_TYPE_PRESETS: Record<string, { label: string; bg: string; text: string; badgeClass: string; icon: string }> = {
  ANNOUNCEMENT: {
    label: "Announcement",
    bg: "#000000",
    text: "#ffffff",
    badgeClass: "badge-dark",
    icon: "📢",
  },
  SALE: {
    label: "Flash Sale / Promo",
    bg: "#3a3699",
    text: "#ffffff",
    badgeClass: "badge-blue",
    icon: "⚡",
  },
  ALERT: {
    label: "Alert / Urgent",
    bg: "#dc2626",
    text: "#ffffff",
    badgeClass: "badge-red",
    icon: "🚨",
  },
  MAINTENANCE: {
    label: "Maintenance",
    bg: "#1e293b",
    text: "#f8fafc",
    badgeClass: "badge-slate",
    icon: "🛠️",
  },
  INFO: {
    label: "Information",
    bg: "#0f766e",
    text: "#ffffff",
    badgeClass: "badge-teal",
    icon: "ℹ️",
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
  const [error, setError] = useState<string | null>(null);
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
    banner_type: "ANNOUNCEMENT",
    bg_color: "#000000",
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
    } catch (err: any) {
      setError(err.message || "Failed to load announcement banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, [adminToken]);

  const openCreateModal = () => {
    setEditingBanner(null);
    setFormData({
      title: "",
      message: "⚡ FLASH SALE: USE CODE VAHN20 FOR 20% OFF | SHIPPING PAN INDIA",
      link_url: "/products",
      link_text: "Shop Now",
      banner_type: "SALE",
      bg_color: "#3a3699",
      text_color: "#ffffff",
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
    } catch (err: any) {
      alert(err.message || "Failed to save banner");
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
    } catch (err) {
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
    } catch (err) {
      alert("Failed to delete banner");
    }
  };

  // Active banner count
  const activeCount = useMemo(() => banners.filter((b) => b.is_active).length, [banners]);

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", paddingBottom: "60px" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "32px",
            right: "32px",
            background: "#111111",
            color: "#ffffff",
            padding: "14px 24px",
            borderRadius: "6px",
            fontSize: "0.875rem",
            fontWeight: 600,
            zIndex: 999999,
            boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            animation: "slideUpToast 0.25s ease-out",
          }}
        >
          <span>✔</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.75rem",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              color: "#000000",
              margin: 0,
            }}
          >
            Banners &amp; Alerts
          </h1>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              color: "#6b7280",
              marginTop: "4px",
              marginBottom: 0,
            }}
          >
            Manage storefront top announcement banners, promotional sales, urgent notices, and maintenance alerts.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={openCreateModal}
            style={{
              background: "#3a3699",
              color: "#ffffff",
              border: "none",
              padding: "10px 20px",
              borderRadius: "4px",
              fontFamily: "var(--font-heading)",
              fontSize: "0.8125rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "background-color 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#2a267a")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#3a3699")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>+ Create Banner</span>
          </button>
        </div>
      </div>

      {/* Live Storefront Preview Widget */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
          padding: "20px",
          marginBottom: "28px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#374151" }}>
            🖥️ Live Storefront Top-Bar Simulation ({activeCount} Active)
          </span>
          <span style={{ fontSize: "0.6875rem", color: activeCount > 0 ? "#059669" : "#6b7280", fontWeight: 700 }}>
            {activeCount > 0 ? `● ${activeCount} Banner${activeCount > 1 ? "s" : ""} Live on Customer Storefront` : "○ No Custom Banners Active (Showing Default 'SHIPPING PAN INDIA')"}
          </span>
        </div>

        {/* Browser Mockup Window */}
        <div style={{ borderRadius: "6px", overflow: "hidden", border: "1px solid #d1d5db" }}>
          {/* Mock Browser Header */}
          <div style={{ background: "#f3f4f6", padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }} />
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }} />
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }} />
            <span style={{ fontSize: "0.6875rem", color: "#9ca3af", marginLeft: "12px", fontFamily: "monospace" }}>https://vahnsports.com</span>
          </div>

          {/* Active Banner in Simulation */}
          {activeCount > 0 ? (
            <div
              style={{
                background: banners.find((b) => b.is_active)?.bg_color || "#000000",
                color: banners.find((b) => b.is_active)?.text_color || "#ffffff",
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                textAlign: "center",
                transition: "all 0.3s ease",
              }}
            >
              <span>{banners.find((b) => b.is_active)?.message}</span>
              {banners.find((b) => b.is_active)?.link_text && (
                <span
                  style={{
                    fontSize: "0.6875rem",
                    padding: "2px 8px",
                    borderRadius: "3px",
                    background: "rgba(255,255,255,0.2)",
                    textDecoration: "underline",
                    textUnderlineOffset: "3px",
                  }}
                >
                  {banners.find((b) => b.is_active)?.link_text} →
                </span>
              )}
            </div>
          ) : (
            <div
              style={{
                background: "#000000",
                color: "rgba(255,255,255,0.9)",
                padding: "10px 16px",
                textAlign: "center",
                fontSize: "0.75rem",
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
              <div style={{ width: "40px", height: "6px", borderRadius: "3px", background: "#374151" }} />
              <div style={{ width: "40px", height: "6px", borderRadius: "3px", background: "#374151" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Banners List Table */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 800, letterSpacing: "-0.025em", color: "#111827", margin: 0 }}>
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
            <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#111827", marginBottom: "6px" }}>
              No custom banners yet
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", maxWidth: "420px", margin: "0 auto 20px" }}>
              Create your first top-bar banner to broadcast sales, discounts, maintenance alerts, or holiday shipping updates.
            </p>
            <button
              onClick={openCreateModal}
              style={{
                background: "#3a3699",
                color: "#ffffff",
                border: "none",
                padding: "8px 18px",
                borderRadius: "4px",
                fontWeight: 700,
                fontSize: "0.8125rem",
                cursor: "pointer",
              }}
            >
              + Create First Banner
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", color: "#4b5563", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "-0.025em" }}>
                  <th style={{ padding: "12px 16px", width: "90px" }}>Active</th>
                  <th style={{ padding: "12px 16px", width: "130px" }}>Type</th>
                  <th style={{ padding: "12px 16px" }}>Title &amp; Message</th>
                  <th style={{ padding: "12px 16px", width: "140px" }}>Colors</th>
                  <th style={{ padding: "12px 16px", width: "120px" }}>Link / CTA</th>
                  <th style={{ padding: "12px 16px", width: "110px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {banners.map((b) => {
                  const preset = BANNER_TYPE_PRESETS[b.banner_type] || BANNER_TYPE_PRESETS.ANNOUNCEMENT;
                  return (
                    <tr
                      key={b.id}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        background: b.is_active ? "#ffffff" : "#fafafa",
                        transition: "background 0.15s ease",
                      }}
                    >
                      {/* Toggle */}
                      <td style={{ padding: "14px 16px" }}>
                        <button
                          type="button"
                          onClick={() => handleToggle(b)}
                          style={{
                            width: "42px",
                            height: "22px",
                            borderRadius: "12px",
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
                              transform: b.is_active ? "translateX(20px)" : "translateX(0px)",
                              transition: "transform 0.2s ease",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                            }}
                          />
                        </button>
                      </td>

                      {/* Type Badge */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "0.6875rem",
                            fontWeight: 800,
                            padding: "3px 8px",
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
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 800, color: "#111827", marginBottom: "2px", letterSpacing: "-0.025em" }}>
                          {b.title}
                        </div>
                        <div style={{ color: "#4b5563", fontSize: "0.8125rem", lineHeight: 1.4 }}>
                          {b.message}
                        </div>
                      </td>

                      {/* Color Preview */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "4px",
                              background: b.bg_color || preset.bg,
                              border: "1px solid rgba(0,0,0,0.15)",
                              boxShadow: "inset 0 0 2px rgba(0,0,0,0.2)",
                            }}
                            title={`Background: ${b.bg_color || preset.bg}`}
                          />
                          <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#6b7280" }}>
                            {b.bg_color || preset.bg}
                          </span>
                        </div>
                      </td>

                      {/* Link / CTA */}
                      <td style={{ padding: "14px 16px" }}>
                        {b.link_url ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#3a3699" }}>
                              {b.link_text || "Link"} →
                            </span>
                            <span style={{ fontSize: "0.6875rem", color: "#9ca3af", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {b.link_url}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>None</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(b)}
                            style={{
                              background: "none",
                              border: "1px solid #d1d5db",
                              borderRadius: "4px",
                              padding: "4px 8px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: "#374151",
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>

                          {deleteConfirmId === b.id ? (
                            <div style={{ display: "inline-flex", gap: "4px" }}>
                              <button
                                type="button"
                                onClick={() => handleDelete(b.id)}
                                style={{
                                  background: "#dc2626",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "4px",
                                  padding: "4px 8px",
                                  fontSize: "0.6875rem",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                }}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                style={{
                                  background: "#f3f4f6",
                                  color: "#374151",
                                  border: "none",
                                  borderRadius: "4px",
                                  padding: "4px 6px",
                                  fontSize: "0.6875rem",
                                  cursor: "pointer",
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(b.id)}
                              style={{
                                background: "none",
                                border: "1px solid #fee2e2",
                                borderRadius: "4px",
                                padding: "4px 8px",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                color: "#dc2626",
                                cursor: "pointer",
                              }}
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
              borderRadius: "10px",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "28px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.025em", margin: 0 }}>
                {editingBanner ? "Edit Banner" : "Create New Announcement Banner"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#6b7280" }}
              >
                ✕
              </button>
            </div>

            {/* Realtime Live Preview in Modal */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#4b5563", marginBottom: "6px" }}>
                Live Visual Preview
              </label>
              <div
                style={{
                  background: formData.bg_color || "#000000",
                  color: formData.text_color || "#ffffff",
                  padding: "10px 16px",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  border: "1px solid rgba(0,0,0,0.1)",
                  minHeight: "38px",
                  transition: "all 0.2s ease",
                }}
              >
                <span>{formData.message || "(Enter banner message below...)"}</span>
                {formData.link_text && (
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      padding: "2px 8px",
                      borderRadius: "3px",
                      background: "rgba(255,255,255,0.25)",
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                    }}
                  >
                    {formData.link_text} →
                  </span>
                )}
                {formData.is_closable && (
                  <span style={{ opacity: 0.7, fontSize: "0.6875rem", marginLeft: "auto" }}>✕</span>
                )}
              </div>
            </div>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Internal Title */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#374151", marginBottom: "6px" }}>
                  Internal Reference Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer Flash Sale 20% Off"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              {/* Message */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#374151", marginBottom: "6px" }}>
                  Storefront Banner Message *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ⚡ FLASH SALE: USE CODE VAHN20 FOR 20% OFF | SHIPPING PAN INDIA"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              {/* Banner Type Presets */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#374151", marginBottom: "8px" }}>
                  Banner Category &amp; Preset
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(115px, 1fr))", gap: "8px" }}>
                  {Object.entries(BANNER_TYPE_PRESETS).map(([key, p]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleTypeChange(key)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "4px",
                        border: formData.banner_type === key ? "2px solid #3a3699" : "1px solid #e5e7eb",
                        background: formData.banner_type === key ? "#f5f3ff" : "#ffffff",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: "1.125rem" }}>{p.icon}</span>
                      <span style={{ fontSize: "0.6875rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: formData.banner_type === key ? "#3a3699" : "#4b5563" }}>
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Customization & Palette Presets */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#374151", marginBottom: "6px" }}>
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
                        padding: "4px 8px",
                        borderRadius: "4px",
                        border: formData.bg_color === p.bg ? "2px solid #3a3699" : "1px solid #d1d5db",
                        background: "#ffffff",
                        cursor: "pointer",
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                      }}
                    >
                      <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: p.bg, border: "1px solid rgba(0,0,0,0.2)" }} />
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.6875rem", color: "#6b7280", marginBottom: "4px" }}>
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
                        style={{ width: "100%", padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.8125rem", fontFamily: "monospace" }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.6875rem", color: "#6b7280", marginBottom: "4px" }}>
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
                        style={{ width: "100%", padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.8125rem", fontFamily: "monospace" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Link URL & Link Text */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#374151", marginBottom: "6px" }}>
                    Destination Link (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. /products or /collections/jersey"
                    value={formData.link_url}
                    onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.8125rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.025em", color: "#374151", marginBottom: "6px" }}>
                    Button / CTA Text (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shop Now"
                    value={formData.link_text}
                    onChange={(e) => setFormData({ ...formData, link_text: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.8125rem" }}
                  />
                </div>
              </div>

              {/* Checkbox Options */}
              <div style={{ display: "flex", gap: "24px", padding: "12px", background: "#f9fafb", borderRadius: "6px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ width: "16px", height: "16px", accentColor: "#3a3699" }}
                  />
                  <span>Active on Storefront</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={formData.is_closable}
                    onChange={(e) => setFormData({ ...formData, is_closable: e.target.checked })}
                    style={{ width: "16px", height: "16px", accentColor: "#3a3699" }}
                  />
                  <span>Allow Customer to Dismiss [✕]</span>
                </label>
              </div>

              {/* Form Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "4px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    fontWeight: 700,
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "4px",
                    border: "none",
                    background: "#3a3699",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: "0.8125rem",
                    textTransform: "uppercase",
                    letterSpacing: "-0.025em",
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                  }}
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
