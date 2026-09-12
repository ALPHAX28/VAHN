"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import {
  getAdminWarehouses,
  createAdminWarehouse,
  setPrimaryAdminWarehouse,
  deleteAdminWarehouse
} from "@/lib/api/admin";
import type { WarehouseLocation } from "@/lib/api/types";

export default function AdminWarehousesPage() {
  const { adminToken } = useAdminAuth();

  const [warehouses, setWarehouses] = useState<WarehouseLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    pickup_location: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    address_2: "",
    city: "",
    state: "",
    country: "India",
    pin_code: "",
    is_primary: false,
  });

  useEffect(() => {
    if (adminToken) {
      loadWarehouses();
    }
  }, [adminToken]);

  async function loadWarehouses() {
    if (!adminToken) return;
    setLoading(true);
    setError("");
    try {
      const data = await getAdminWarehouses(adminToken);
      setWarehouses(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load warehouse locations");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPrimary(id: number) {
    if (!adminToken) return;
    setError("");
    setSuccess("");
    try {
      await setPrimaryAdminWarehouse(adminToken, id);
      setSuccess("Primary warehouse updated successfully! All order pickups & returns will now route to this location.");
      await loadWarehouses();
      setTimeout(() => setSuccess(""), 4000);
    } catch (e: any) {
      setError(e?.message || "Failed to update primary warehouse");
    }
  }

  async function handleDelete(id: number, nickname: string) {
    if (!adminToken) return;
    if (!confirm(`Are you sure you want to remove warehouse "${nickname}"?`)) return;
    setError("");
    setSuccess("");
    try {
      await deleteAdminWarehouse(adminToken, id);
      setSuccess(`Warehouse "${nickname}" removed successfully.`);
      await loadWarehouses();
      setTimeout(() => setSuccess(""), 4000);
    } catch (e: any) {
      setError(e?.message || "Failed to delete warehouse");
    }
  }

  async function handleCreateWarehouse(e: React.FormEvent) {
    e.preventDefault();
    if (!adminToken) return;
    if (!formData.pickup_location.trim() || !formData.name.trim() || !formData.phone.trim() || !formData.address.trim() || !formData.pin_code.trim()) {
      setError("Please fill in all required fields (Location Nickname, Contact Name, Phone, Address, PIN Code).");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await createAdminWarehouse(adminToken, formData);
      setSuccess(`Warehouse "${formData.pickup_location}" registered and synchronized with Shiprocket!`);
      setShowModal(false);
      setFormData({
        pickup_location: "",
        name: "",
        email: "",
        phone: "",
        address: "",
        address_2: "",
        city: "",
        state: "",
        country: "India",
        pin_code: "",
        is_primary: false,
      });
      await loadWarehouses();
      setTimeout(() => setSuccess(""), 5000);
    } catch (e: any) {
      setError(e?.message || "Failed to register warehouse in Shiprocket");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto", fontFamily: "var(--font-ui)" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", margin: 0 }}>
            Warehouses & Pickup Locations
          </h1>
          <p style={{ color: "#666", fontSize: "0.9rem", margin: "6px 0 0" }}>
            Origin facilities for all forward courier dispatches and destination hubs for automated reverse returns via Shiprocket.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          style={{
            background: "#000",
            color: "#fff",
            border: "none",
            padding: "12px 24px",
            fontWeight: 800,
            fontSize: "0.85rem",
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderRadius: "0px",
          }}
        >
          <span>+</span> Add Warehouse Location
        </button>
      </div>

      {/* Shiprocket Sync Status Card */}
      <div
        style={{
          background: "#f9f9fb",
          border: "1px solid #e0e0e0",
          padding: "16px 20px",
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#52c41a",
              boxShadow: "0 0 6px #52c41a",
            }}
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.85rem", textTransform: "uppercase" }}>
              Shiprocket Logistics Connected
            </div>
            <div style={{ fontSize: "0.8rem", color: "#666" }}>
              Live 2-Way Sync Active • Primary warehouse automatically used for AWB generation & reverse returns
            </div>
          </div>
        </div>

        <button
          onClick={loadWarehouses}
          disabled={loading}
          style={{
            background: "#fff",
            border: "1px solid #ccc",
            padding: "6px 14px",
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Syncing..." : "Sync from Shiprocket ⟳"}
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ background: "#fff2f0", border: "1px solid #ffccc7", padding: "12px 16px", marginBottom: 20, color: "#cf1322", fontSize: "0.85rem", fontWeight: 600 }}>
          ✕ {error}
        </div>
      )}
      {success && (
        <div style={{ background: "#f6ffed", border: "1px solid #b7eb8f", padding: "12px 16px", marginBottom: 20, color: "#389e0d", fontSize: "0.85rem", fontWeight: 700 }}>
          ✓ {success}
        </div>
      )}

      {/* Warehouses List */}
      {loading && warehouses.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#888" }}>
          Loading warehouse locations from Shiprocket...
        </div>
      ) : warehouses.length === 0 ? (
        <div style={{ border: "2px dashed #e0e0e0", padding: "60px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: 8 }}>No Warehouses Configured</div>
          <p style={{ color: "#666", fontSize: "0.85rem", maxWidth: 460, margin: "0 auto 20px" }}>
            Add your warehouse location below to enable dynamic courier serviceability, automated AWB generation, and returns.
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{ background: "#000", color: "#fff", border: "none", padding: "10px 20px", fontWeight: 800, fontSize: "0.8rem", textTransform: "uppercase", cursor: "pointer" }}
          >
            + Add Warehouse Location
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 24 }}>
          {warehouses.map((wh) => (
            <div
              key={wh.id}
              style={{
                border: wh.is_primary ? "2px solid #000" : "1px solid #e0e0e0",
                background: "#fff",
                padding: "24px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                {/* Header & Badges */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      LOCATION NICKNAME
                    </span>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 900, margin: "2px 0 0", textTransform: "uppercase" }}>
                      {wh.pickup_location}
                    </h3>
                  </div>
                  {wh.is_primary ? (
                    <span
                      style={{
                        background: "#000",
                        color: "#fff",
                        fontSize: "0.65rem",
                        fontWeight: 900,
                        padding: "4px 8px",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                      }}
                    >
                      ★ PRIMARY HUB
                    </span>
                  ) : (
                    <span
                      style={{
                        background: "#f0f0f0",
                        color: "#666",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        padding: "4px 8px",
                        textTransform: "uppercase",
                      }}
                    >
                      SECONDARY
                    </span>
                  )}
                </div>

                {/* Details */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.85rem", color: "#444", marginBottom: 20 }}>
                  <div>
                    <strong style={{ color: "#000" }}>Contact:</strong> {wh.name}
                  </div>
                  <div>
                    <strong style={{ color: "#000" }}>Phone:</strong> {wh.phone} • <strong style={{ color: "#000" }}>Email:</strong> {wh.email}
                  </div>
                  <div>
                    <strong style={{ color: "#000" }}>Address:</strong> {wh.address}{wh.address_2 ? `, ${wh.address_2}` : ""}, {wh.city}, {wh.state} — <strong style={{ color: "#4232d9" }}>PIN: {wh.pin_code}</strong>
                  </div>
                  {wh.shiprocket_pickup_id && (
                    <div style={{ fontSize: "0.75rem", color: "#888" }}>
                      Shiprocket ID: {wh.shiprocket_pickup_id}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f0f0f0", paddingTop: 16, marginTop: 12 }}>
                {!wh.is_primary ? (
                  <button
                    onClick={() => handleSetPrimary(wh.id)}
                    style={{
                      background: "#fff",
                      border: "1px solid #000",
                      color: "#000",
                      padding: "6px 14px",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    ★ Set as Primary
                  </button>
                ) : (
                  <span style={{ fontSize: "0.75rem", color: "#52c41a", fontWeight: 800 }}>
                    ✓ Default for all orders & returns
                  </span>
                )}

                {warehouses.length > 1 && (
                  <button
                    onClick={() => handleDelete(wh.id, wh.pickup_location)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#cf1322",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Warehouse Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: 580,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "28px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid #eee", paddingBottom: 12 }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 900, textTransform: "uppercase", margin: 0 }}>
                Add Warehouse Location
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", fontWeight: 700 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWarehouse}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>
                    Pickup Location Nickname * (e.g. Primary, Mumbai-Warehouse)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VAHN-Hub-1"
                    value={formData.pickup_location}
                    onChange={(e) => setFormData({ ...formData, pickup_location: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", fontSize: "0.85rem", outline: "none" }}
                  />
                  <span style={{ fontSize: "0.7rem", color: "#888" }}>
                    Must match or will be registered as a pickup nickname in your Shiprocket account.
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>
                      Contact Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Abhinandan Mitra"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", fontSize: "0.85rem", outline: "none" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>
                      Phone (10 Digits) *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "") })}
                      style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", fontSize: "0.85rem", outline: "none" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="abhinandan.mitra@vahnsports.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", fontSize: "0.85rem", outline: "none" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>
                    Address Line 1 *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Building, Street, Area"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", fontSize: "0.85rem", outline: "none" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>
                    Address Line 2 (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Floor, Unit, Landmark"
                    value={formData.address_2}
                    onChange={(e) => setFormData({ ...formData, address_2: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", fontSize: "0.85rem", outline: "none" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mumbai"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", fontSize: "0.85rem", outline: "none" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>
                      State *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maharashtra"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", fontSize: "0.85rem", outline: "none" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>
                      PIN Code *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="400001"
                      value={formData.pin_code}
                      onChange={(e) => setFormData({ ...formData, pin_code: e.target.value.replace(/\D/g, "") })}
                      style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", fontSize: "0.85rem", outline: "none" }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={formData.is_primary}
                      onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                    />
                    Set as Primary Warehouse (Used for all order dispatches & customer returns)
                  </label>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{ background: "#f0f0f0", border: "none", padding: "10px 20px", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      background: saving ? "#666" : "#000",
                      color: "#fff",
                      border: "none",
                      padding: "10px 24px",
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      cursor: saving ? "not-allowed" : "pointer"
                    }}
                  >
                    {saving ? "Registering in Shiprocket..." : "Save Warehouse →"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
