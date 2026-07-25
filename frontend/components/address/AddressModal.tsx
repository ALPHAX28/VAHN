"use client";

import React, { useState, useEffect } from "react";
import type { UserAddress } from "@/lib/api/types";
import { createUserAddress } from "@/lib/api";
import {
  MapPinIcon,
  SearchIcon,
  HomeIcon,
  BriefcaseIcon,
  BuildingIcon,
  HouseIcon,
  PhoneIcon,
  AlertCircleIcon,
  XIcon
} from "@/components/icons/Icons";

const ADDRESS_LABELS = ["Home", "Work", "Office", "Studio", "Other"];

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry", "Chandigarh"
];

interface AddressModalProps {
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newAddress: UserAddress) => void;
}

interface LocationSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
  };
}

// Reusable form input styling
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#fff",
  border: "1px solid #d1d5db",
  color: "#000",
  padding: "10px 12px",
  fontSize: "0.875rem",
  outline: "none",
  fontFamily: "inherit",
  transition: "border-color 0.15s",
  boxSizing: "border-box"
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 800,
  color: "#555",
  textTransform: "uppercase" as const,
  letterSpacing: "0.07em",
  display: "block",
  marginBottom: 6
};

export default function AddressModal({ token, isOpen, onClose, onSuccess }: AddressModalProps) {
  const [activeTab, setActiveTab] = useState<"search" | "manual">("search");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Search tab state
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [autofilled, setAutofilled] = useState(false);

  // Dwelling type for manual entry
  const [dwellingType, setDwellingType] = useState<"apartment" | "house">("apartment");

  // Form State
  const [form, setForm] = useState({
    label: "Home",
    first_name: "",
    last_name: "",
    house_flat_no: "",
    floor_no: "",
    building_name: "",
    block_wing: "",
    street_address: "",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "",
    country: "India",
    phone: "",
    is_default: true,
  });

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const query = encodeURIComponent(`${searchQuery.trim()}, India`);
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${query}&countrycodes=in&limit=6`);
        const data = await res.json();
        setSuggestions(data || []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!isOpen) return null;

  const updateField = (field: string, val: string | boolean) => {
    setForm(f => ({ ...f, [field]: val }));
    if (error) setError("");
  };

  const handleSelectSuggestion = (place: LocationSuggestion) => {
    const addrObj = place.address || {};
    const city = addrObj.city || addrObj.town || addrObj.village || form.city;
    const stateName = INDIAN_STATES.find(s =>
      (addrObj.state || place.display_name).toLowerCase().includes(s.toLowerCase())
    ) || form.state;
    const postcode = addrObj.postcode || form.pincode;

    const parts = place.display_name.split(",").map(s => s.trim());
    const streetLocality = parts.slice(0, 3).join(", ");

    setForm(f => ({
      ...f,
      street_address: streetLocality,
      city,
      state: stateName,
      pincode: postcode || f.pincode,
    }));

    setSuggestions([]);
    setSearchQuery(place.display_name);
    setAutofilled(true);
    // Switch to manual tab for house/flat number completion
    setActiveTab("manual");
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const pinRegex = /^[1-9][0-9]{5}$/;
    if (!pinRegex.test(form.pincode.trim())) {
      setError("Please enter a valid 6-digit Indian PIN Code (e.g. 400001).");
      return;
    }

    if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()) {
      setError("Please fill in recipient name and phone number.");
      return;
    }

    // Combine street address
    let finalStreet = form.street_address.trim();
    if (dwellingType === "apartment") {
      const parts = [
        form.house_flat_no ? `Flat ${form.house_flat_no}` : "",
        form.floor_no ? `Floor ${form.floor_no}` : "",
        form.block_wing ? `Wing ${form.block_wing}` : "",
        form.building_name || "",
        form.street_address || ""
      ].filter(Boolean);
      finalStreet = parts.join(", ");
    } else {
      const parts = [
        form.house_flat_no ? `House No. ${form.house_flat_no}` : "",
        form.building_name || "",
        form.street_address || ""
      ].filter(Boolean);
      finalStreet = parts.join(", ");
    }

    if (!finalStreet.trim()) {
      setError("Please enter house/flat details or street address.");
      return;
    }

    setLoading(true);
    try {
      const created = await createUserAddress(token, {
        label: form.label,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        street_address: finalStreet,
        apartment: dwellingType === "apartment" ? form.building_name : "",
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        country: "India",
        phone: form.phone.trim(),
        is_default: form.is_default
      });
      onSuccess(created);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save delivery address.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", color: "#000",
          border: "2px solid #000",
          width: "100%", maxWidth: 620, maxHeight: "92vh", overflowY: "auto",
          position: "relative", display: "flex", flexDirection: "column"
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "2px solid #000",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          position: "sticky", top: 0, background: "#fff", zIndex: 10
        }}>
          <div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 900, margin: 0, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Add Delivery Address
            </h2>
            <p style={{ fontSize: "0.78rem", color: "#888", margin: "3px 0 0" }}>
              Shipping restricted to Indian locations only.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#000", color: "#fff", border: "none",
              width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0, transition: "background 0.15s"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#333"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#000"; }}
          >
            <XIcon size={16} color="#fff" />
          </button>
        </div>

        <div style={{ padding: "20px 24px 24px", flex: 1 }}>
          {/* Error Banner */}
          {error && (
            <div style={{
              borderLeft: "4px solid #dc2626", background: "#fef2f2", color: "#dc2626",
              padding: "12px 14px", fontSize: "0.84rem", marginBottom: 18,
              display: "flex", alignItems: "center", gap: 8, fontWeight: 700
            }}>
              <AlertCircleIcon size={15} color="#dc2626" />
              <span>{error}</span>
            </div>
          )}

          {/* Tab Bar */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "2px solid #000", marginBottom: 22 }}>
            <button
              type="button"
              onClick={() => setActiveTab("search")}
              style={{
                background: activeTab === "search" ? "#000" : "#fff",
                color: activeTab === "search" ? "#fff" : "#000",
                border: "none",
                borderRight: "1px solid #000",
                padding: "12px 8px", fontWeight: 900, fontSize: "0.78rem",
                textTransform: "uppercase", letterSpacing: "0.06em",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                transition: "all 0.15s"
              }}
            >
              <SearchIcon size={14} color={activeTab === "search" ? "#fff" : "#000"} />
              Auto-Search
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("manual")}
              style={{
                background: activeTab === "manual" ? "#000" : "#fff",
                color: activeTab === "manual" ? "#fff" : "#000",
                border: "none",
                padding: "12px 8px", fontWeight: 900, fontSize: "0.78rem",
                textTransform: "uppercase", letterSpacing: "0.06em",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                transition: "all 0.15s"
              }}
            >
              <BuildingIcon size={14} color={activeTab === "manual" ? "#fff" : "#000"} />
              Manual Entry
            </button>
          </div>

          {/* TAB 1: AUTO-SEARCH */}
          {activeTab === "search" && (
            <div>
              <label style={labelStyle}>Search area, city or landmark in India</label>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <SearchIcon size={15} color="#9ca3af" />
                </div>
                <input
                  type="text"
                  placeholder="e.g. Bandra West Mumbai, Connaught Place Delhi..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 38, border: "1px solid #000" }}
                  onFocus={e => { e.currentTarget.style.outline = "2px solid #000"; e.currentTarget.style.outlineOffset = "1px"; }}
                  onBlur={e => { e.currentTarget.style.outline = "none"; }}
                />
                {searching && (
                  <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
                    <div style={{ width: 16, height: 16, border: "2px solid #000", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  </div>
                )}
              </div>

              {/* Suggestions dropdown */}
              {suggestions.length > 0 && (
                <div style={{ border: "1px solid #000", borderTop: "none", maxHeight: 220, overflowY: "auto" }}>
                  {suggestions.map(s => (
                    <div
                      key={s.place_id}
                      onClick={() => handleSelectSuggestion(s)}
                      style={{
                        padding: "11px 14px", borderBottom: "1px solid #f3f4f6",
                        cursor: "pointer", fontSize: "0.85rem", color: "#000",
                        display: "flex", alignItems: "flex-start", gap: 10, transition: "background 0.1s"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#f8fafc"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
                    >
                      <MapPinIcon size={15} color="#666" style={{ marginTop: 1, flexShrink: 0 } as React.CSSProperties} />
                      <span style={{ lineHeight: 1.4 }}>{s.display_name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Info callout */}
              <div style={{
                marginTop: 16, background: "#f0f9ff", border: "1px solid #0ea5e9",
                padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start"
              }}>
                <div style={{ width: 18, height: 18, background: "#0ea5e9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <span style={{ color: "#fff", fontSize: "0.7rem", fontWeight: 900 }}>i</span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "#0369a1", margin: 0, lineHeight: 1.5 }}>
                  Select a suggestion to auto-fill street, city, state & PIN code. You'll then enter your flat/house number in the next step.
                </p>
              </div>

              {autofilled && (
                <div style={{
                  marginTop: 12, background: "#f0fdf4", border: "1px solid #16a34a",
                  padding: "12px 14px", display: "flex", gap: 10, alignItems: "center"
                }}>
                  <div style={{ width: 18, height: 18, background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ color: "#fff", fontSize: "0.75rem", fontWeight: 900 }}>✓</span>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "#15803d", margin: 0, fontWeight: 700 }}>
                    Location auto-filled! Switch to Manual Entry to add your flat/house number.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MANUAL ENTRY */}
          {activeTab === "manual" && (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Address Label */}
              <div>
                <label style={labelStyle}>Address Label</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {ADDRESS_LABELS.map(lbl => {
                    const isActive = form.label === lbl;
                    return (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => updateField("label", lbl)}
                        style={{
                          background: isActive ? "#000" : "#fff",
                          color: isActive ? "#fff" : "#000",
                          border: isActive ? "1px solid #000" : "1px solid #d1d5db",
                          padding: "7px 14px", fontSize: "0.78rem", fontWeight: 800,
                          cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em",
                          display: "inline-flex", alignItems: "center", gap: 6,
                          transition: "all 0.15s"
                        }}
                      >
                        {lbl === "Home" ? <HomeIcon size={13} color={isActive ? "#fff" : "#000"} /> :
                          lbl === "Work" || lbl === "Office" ? <BriefcaseIcon size={13} color={isActive ? "#fff" : "#000"} /> :
                          <MapPinIcon size={13} color={isActive ? "#fff" : "#000"} />}
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dwelling Type Toggle */}
              <div>
                <label style={labelStyle}>Property Type</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setDwellingType("apartment")}
                    style={{
                      border: dwellingType === "apartment" ? "2px solid #000" : "1px solid #d1d5db",
                      background: dwellingType === "apartment" ? "#f8fafc" : "#fff",
                      padding: "12px 14px", fontWeight: 800, fontSize: "0.8rem",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#000",
                      transition: "all 0.15s"
                    }}
                  >
                    <BuildingIcon size={16} color="#000" />
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 900, textTransform: "uppercase" }}>Flat / Apartment</div>
                      <div style={{ fontSize: "0.65rem", color: "#888", fontWeight: 600 }}>Complex / Society</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDwellingType("house")}
                    style={{
                      border: dwellingType === "house" ? "2px solid #000" : "1px solid #d1d5db",
                      background: dwellingType === "house" ? "#f8fafc" : "#fff",
                      padding: "12px 14px", fontWeight: 800, fontSize: "0.8rem",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#000",
                      transition: "all 0.15s"
                    }}
                  >
                    <HouseIcon size={16} color="#000" />
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 900, textTransform: "uppercase" }}>House / Villa</div>
                      <div style={{ fontSize: "0.65rem", color: "#888", fontWeight: 600 }}>Independent property</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Flat/House Details */}
              {dwellingType === "apartment" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Flat / Unit No. *</label>
                    <input
                      type="text" required placeholder="e.g. 402"
                      value={form.house_flat_no}
                      onChange={e => updateField("house_flat_no", e.target.value)}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = "#000"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Building / Apt Name *</label>
                    <input
                      type="text" required placeholder="e.g. Sunshine Apartments"
                      value={form.building_name}
                      onChange={e => updateField("building_name", e.target.value)}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = "#000"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Floor No. (optional)</label>
                    <input
                      type="text" placeholder="e.g. 4th Floor"
                      value={form.floor_no}
                      onChange={e => updateField("floor_no", e.target.value)}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = "#000"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Block / Wing (optional)</label>
                    <input
                      type="text" placeholder="e.g. Wing B"
                      value={form.block_wing}
                      onChange={e => updateField("block_wing", e.target.value)}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = "#000"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>House / Plot No. *</label>
                    <input
                      type="text" required placeholder="e.g. 12 or Plot 5"
                      value={form.house_flat_no}
                      onChange={e => updateField("house_flat_no", e.target.value)}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = "#000"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Villa / House Name (opt.)</label>
                    <input
                      type="text" placeholder="e.g. Rose Villa"
                      value={form.building_name}
                      onChange={e => updateField("building_name", e.target.value)}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = "#000"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                    />
                  </div>
                </div>
              )}

              {/* Street / Area */}
              <div>
                <label style={labelStyle}>Street / Area / Locality *</label>
                <input
                  type="text" required placeholder="e.g. MG Road, Near City Mall"
                  value={form.street_address}
                  onChange={e => updateField("street_address", e.target.value)}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = "#000"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                />
              </div>

              {/* Recipient Name */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <input
                    type="text" required value={form.first_name}
                    onChange={e => updateField("first_name", e.target.value)}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = "#000"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Last Name *</label>
                  <input
                    type="text" required value={form.last_name}
                    onChange={e => updateField("last_name", e.target.value)}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = "#000"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                  />
                </div>
              </div>

              {/* City + State */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>City / Town *</label>
                  <input
                    type="text" required value={form.city}
                    onChange={e => updateField("city", e.target.value)}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = "#000"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>State *</label>
                  <select
                    value={form.state}
                    onChange={e => updateField("state", e.target.value)}
                    style={{ ...inputStyle, cursor: "pointer" }}
                    onFocus={e => { e.currentTarget.style.borderColor = "#000"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                  >
                    {INDIAN_STATES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
              </div>

              {/* PIN + Phone */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>PIN Code (6 digits) *</label>
                  <input
                    type="text" required maxLength={6} placeholder="400001"
                    value={form.pincode}
                    onChange={e => updateField("pincode", e.target.value.replace(/\D/g, ""))}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = "#000"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <PhoneIcon size={11} color="#555" /> Mobile Number *
                    </span>
                  </label>
                  <input
                    type="tel" required placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={e => updateField("phone", e.target.value)}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = "#000"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                  />
                </div>
              </div>

              {/* India-only note */}
              <div style={{
                background: "#fafafa", border: "1px solid #e5e5e5",
                padding: "10px 14px", display: "flex", gap: 8, alignItems: "center"
              }}>
                <MapPinIcon size={13} color="#888" />
                <span style={{ fontSize: "0.75rem", color: "#888", fontWeight: 700 }}>
                  Shipping available within India only · 6-digit PIN Code required
                </span>
              </div>

              {/* Form Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
                <button
                  type="button" onClick={onClose}
                  style={{
                    background: "#fff", border: "2px solid #000", color: "#000",
                    padding: "12px 22px", fontWeight: 900, fontSize: "0.82rem",
                    cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em",
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={loading}
                  style={{
                    background: loading ? "#666" : "#000", color: "#fff",
                    border: "none", padding: "12px 28px", fontWeight: 900, fontSize: "0.85rem",
                    cursor: loading ? "not-allowed" : "pointer",
                    textTransform: "uppercase", letterSpacing: "0.05em", transition: "background 0.2s"
                  }}
                >
                  {loading ? "Saving..." : "Save Address →"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
