"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { getApiBaseUrl } from "@/lib/api/client";

interface ContactMessage {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  country_code: string;
  phone: string | null;
  order_number: string | null;
  subject: string;
  message: string;
  status: "NEW" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED";
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageCounts {
  all: number;
  new: number;
  in_progress: number;
  resolved: number;
  archived: number;
}

export default function AdminSupportPage() {
  const { adminToken } = useAdminAuth();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [counts, setCounts] = useState<MessageCounts>({ all: 0, new: 0, in_progress: 0, resolved: 0, archived: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [notesInput, setNotesInput] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const url = new URL(`${getApiBaseUrl()}/admin/contact-messages`);
      if (activeTab !== "ALL") {
        url.searchParams.set("status", activeTab);
      }
      if (searchQuery.trim()) {
        url.searchParams.set("search", searchQuery.trim());
      }

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(data.items || []);
        setCounts(data.counts || { all: 0, new: 0, in_progress: 0, resolved: 0, archived: 0 });
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load contact messages:", err);
    } finally {
      setLoading(false);
    }
  }, [adminToken, activeTab, searchQuery]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSelectMessage = (msg: ContactMessage) => {
    setSelectedMessage(msg);
    setNotesInput(msg.admin_notes || "");
  };

  const handleUpdateStatus = async (newStatus: ContactMessage["status"]) => {
    if (!selectedMessage || !adminToken) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/contact-messages/${selectedMessage.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedMessage(updated);
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        fetchMessages();
      }
    } catch (err) {
      console.error("Failed to update message status:", err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedMessage || !adminToken) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/contact-messages/${selectedMessage.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ admin_notes: notesInput }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedMessage(updated);
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      }
    } catch (err) {
      console.error("Failed to save admin notes:", err);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDeleteMessage = async (id: number) => {
    if (!adminToken) return;
    if (!confirm("Are you sure you want to permanently delete this customer inquiry?")) return;

    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/contact-messages/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (res.ok) {
        if (selectedMessage?.id === id) {
          setSelectedMessage(null);
        }
        fetchMessages();
      }
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  const getStatusBadge = (status: ContactMessage["status"]) => {
    const styles: Record<ContactMessage["status"], { bg: string; color: string; label: string }> = {
      NEW: { bg: "#ede9fe", color: "#6d28d9", label: "New" },
      IN_PROGRESS: { bg: "#e0f2fe", color: "#0369a1", label: "In Progress" },
      RESOLVED: { bg: "#dcfce7", color: "#15803d", label: "Resolved" },
      ARCHIVED: { bg: "#f3f4f6", color: "#6b7280", label: "Archived" },
    };
    const s = styles[status] || styles.NEW;
    return (
      <span
        style={{
          background: s.bg,
          color: s.color,
          padding: "3px 8px",
          borderRadius: "4px",
          fontSize: "0.6875rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {s.label}
      </span>
    );
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div style={{ padding: "32px 24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* ── Page Header ── */}
      <div style={{ marginBottom: "28px" }}>
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "1.75rem",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            textTransform: "uppercase",
            margin: "0 0 6px",
            color: "#111",
          }}
        >
          Customer Inquiries
        </h1>
        <p style={{ margin: 0, color: "#666", fontSize: "0.875rem" }}>
          Inbound messages and support tickets submitted via the VAHN storefront Contact page.
        </p>
      </div>

      {/* ── Filter Tabs & Search Bar ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "20px",
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: "16px",
        }}
      >
        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
          {[
            { key: "ALL", label: "All", count: counts.all },
            { key: "NEW", label: "New", count: counts.new },
            { key: "IN_PROGRESS", label: "In Progress", count: counts.in_progress },
            { key: "RESOLVED", label: "Resolved", count: counts.resolved },
            { key: "ARCHIVED", label: "Archived", count: counts.archived },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "0.8125rem",
                  fontWeight: isActive ? 700 : 500,
                  background: isActive ? "#111" : "#f3f4f6",
                  color: isActive ? "#fff" : "#4b5563",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    background: isActive ? "rgba(255,255,255,0.2)" : "#e5e7eb",
                    color: isActive ? "#fff" : "#374151",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    fontSize: "0.6875rem",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ width: "300px" }}>
          <input
            type="text"
            placeholder="Search inquiries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input"
            style={{ fontSize: "0.8125rem", padding: "8px 12px" }}
          />
        </div>
      </div>

      {/* ── Inquiries List & Detail Split View ── */}
      <div style={{ display: "grid", gridTemplateColumns: selectedMessage ? "1fr 450px" : "1fr", gap: "24px" }}>
        {/* Left: Messages Table */}
        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#666" }}>Loading inquiries...</div>
          ) : messages.length === 0 ? (
            <div style={{ padding: "64px 24px", textAlign: "center", color: "#888" }}>
              <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: "1rem" }}>No inquiries found</p>
              <p style={{ margin: 0, fontSize: "0.8125rem" }}>Customer messages will appear here once submitted.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", color: "#6b7280" }}>
                    <th style={{ padding: "12px 16px", fontWeight: 600 }}>Customer</th>
                    <th style={{ padding: "12px 16px", fontWeight: 600 }}>Topic / Subject</th>
                    <th style={{ padding: "12px 16px", fontWeight: 600 }}>Order #</th>
                    <th style={{ padding: "12px 16px", fontWeight: 600 }}>Status</th>
                    <th style={{ padding: "12px 16px", fontWeight: 600 }}>Date</th>
                    <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((msg) => {
                    const isSelected = selectedMessage?.id === msg.id;
                    return (
                      <tr
                        key={msg.id}
                        onClick={() => handleSelectMessage(msg)}
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          background: isSelected ? "#f5f3ff" : "#fff",
                          cursor: "pointer",
                          transition: "background 0.1s ease",
                        }}
                      >
                        <td style={{ padding: "14px 16px" }}>
                          <strong style={{ display: "block", color: "#111" }}>
                            {msg.first_name} {msg.last_name}
                          </strong>
                          <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>{msg.email}</span>
                        </td>
                        <td style={{ padding: "14px 16px", maxWidth: "260px" }}>
                          <span style={{ fontWeight: 600, color: "#374151", display: "block" }}>{msg.subject}</span>
                          <span
                            style={{
                              color: "#6b7280",
                              fontSize: "0.75rem",
                              display: "-webkit-box",
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {msg.message}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", color: msg.order_number ? "#4232d9" : "#9ca3af" }}>
                          {msg.order_number || "—"}
                        </td>
                        <td style={{ padding: "14px 16px" }}>{getStatusBadge(msg.status)}</td>
                        <td style={{ padding: "14px 16px", color: "#6b7280", whiteSpace: "nowrap" }}>
                          {formatDate(msg.created_at)}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectMessage(msg);
                            }}
                            style={{
                              padding: "4px 10px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: "#f3f4f6",
                              border: "1px solid #d1d5db",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Message Detail Panel */}
        {selectedMessage && (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              position: "sticky",
              top: "24px",
              height: "fit-content",
            }}
          >
            {/* Detail Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#888", textTransform: "uppercase" }}>
                  Inquiry #{selectedMessage.id}
                </span>
                <h2 style={{ fontSize: "1.125rem", margin: "4px 0", color: "#111" }}>
                  {selectedMessage.first_name} {selectedMessage.last_name}
                </h2>
                <span style={{ fontSize: "0.75rem", color: "#666" }}>{formatDate(selectedMessage.created_at)}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.25rem",
                  color: "#9ca3af",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Status Selector */}
            <div style={{ background: "#f9fafb", padding: "12px 16px", borderRadius: "6px" }}>
              <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", marginBottom: "6px", color: "#6b7280" }}>
                Status
              </label>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {(["NEW", "IN_PROGRESS", "RESOLVED", "ARCHIVED"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleUpdateStatus(s)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      fontSize: "0.6875rem",
                      fontWeight: selectedMessage.status === s ? 700 : 500,
                      border: "1px solid",
                      borderColor: selectedMessage.status === s ? "#4232d9" : "#d1d5db",
                      background: selectedMessage.status === s ? "#4232d9" : "#fff",
                      color: selectedMessage.status === s ? "#fff" : "#374151",
                      cursor: "pointer",
                    }}
                  >
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Info */}
            <div style={{ fontSize: "0.8125rem", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 600 }}>
                  Email Address
                </span>
                <a href={`mailto:${selectedMessage.email}`} style={{ color: "#4232d9", textDecoration: "underline", fontWeight: 600 }}>
                  {selectedMessage.email}
                </a>
              </div>

              {selectedMessage.phone && (
                <div>
                  <span style={{ color: "#6b7280", display: "block", fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 600 }}>
                    Phone / WhatsApp
                  </span>
                  <a href={`tel:${selectedMessage.country_code}${selectedMessage.phone}`} style={{ color: "#111", textDecoration: "none" }}>
                    {selectedMessage.country_code} {selectedMessage.phone}
                  </a>
                </div>
              )}

              {selectedMessage.order_number && (
                <div>
                  <span style={{ color: "#6b7280", display: "block", fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 600 }}>
                    Associated Order Number
                  </span>
                  <span style={{ fontWeight: 600, color: "#111" }}>{selectedMessage.order_number}</span>
                </div>
              )}

              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 600 }}>
                  Topic / Subject
                </span>
                <span style={{ fontWeight: 600, color: "#111" }}>{selectedMessage.subject}</span>
              </div>
            </div>

            {/* Message Body */}
            <div>
              <span style={{ color: "#6b7280", display: "block", fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 600, marginBottom: "6px" }}>
                Customer Message
              </span>
              <div
                style={{
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderLeft: "3px solid #4232d9",
                  padding: "12px 16px",
                  borderRadius: "4px",
                  fontSize: "0.875rem",
                  lineHeight: 1.6,
                  color: "#1f2937",
                  whiteSpace: "pre-wrap",
                  maxHeight: "220px",
                  overflowY: "auto",
                }}
              >
                {selectedMessage.message}
              </div>
            </div>

            {/* Action Buttons: Reply */}
            <div style={{ display: "flex", gap: "8px" }}>
              <a
                href={`mailto:${selectedMessage.email}?subject=Re:%20${encodeURIComponent(selectedMessage.subject)}%20-%20VAHN%20Support`}
                style={{
                  flex: 1,
                  textAlign: "center",
                  background: "#4232d9",
                  color: "#fff",
                  padding: "10px 16px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Reply via Email &rarr;
              </a>
              {selectedMessage.phone && (
                <a
                  href={`https://wa.me/${selectedMessage.country_code.replace("+", "")}${selectedMessage.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: "#25D366",
                    color: "#fff",
                    padding: "10px 16px",
                    borderRadius: "6px",
                    textDecoration: "none",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  WhatsApp
                </a>
              )}
            </div>

            {/* Internal Admin Notes */}
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
              <label
                htmlFor="adminNotes"
                style={{
                  display: "block",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  marginBottom: "6px",
                  color: "#6b7280",
                }}
              >
                Internal Admin Notes
              </label>
              <textarea
                id="adminNotes"
                rows={3}
                placeholder="Add staff notes or resolution log..."
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                className="input"
                style={{ fontSize: "0.8125rem", resize: "vertical", marginBottom: "8px" }}
              />
              <button
                type="button"
                disabled={savingNotes}
                onClick={handleSaveNotes}
                style={{
                  padding: "6px 14px",
                  background: "#111",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {savingNotes ? "Saving..." : "Save Notes"}
              </button>
            </div>

            {/* Delete Inquiry Button */}
            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "12px", textAlign: "right" }}>
              <button
                type="button"
                onClick={() => handleDeleteMessage(selectedMessage.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#dc2626",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Delete Inquiry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
