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
  UserIcon,
  PhoneIcon,
  AlertCircleIcon,
  CheckIcon
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

export default function AddressModal({ token, isOpen, onClose, onSuccess }: AddressModalProps) {
  const [activeTab, setActiveTab] = useState<"search" | "manual">("search");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Search tab state
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);

  // Dwelling type for manual entry: "apartment" | "house"
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
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${query}&countrycodes=in&limit=5`);
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

  const updateField = (field: string, val: any) => {
    setForm(f => ({ ...f, [field]: val }));
    if (error) setError("");
  };

  const handleSelectSuggestion = (place: LocationSuggestion) => {
    const addrObj = place.address || {};
    const city = addrObj.city || addrObj.town || addrObj.village || form.city;
    const stateName = INDIAN_STATES.find(s => (addrObj.state || place.display_name).toLowerCase().includes(s.toLowerCase())) || form.state;
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
    // Switch to completion view so user inputs Flat/House No, Name & Phone
    setActiveTab("manual");
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.country.trim().toLowerCase() !== "india") {
      setError("Shipping is currently only available within India.");
      return;
    }

    const pinRegex = /^[1-9][0-9]{5}$/;
    if (!pinRegex.test(form.pincode.trim())) {
      setError("Please enter a valid 6-digit Indian PIN Code (e.g. 400001).");
      return;
    }

    if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()) {
      setError("Please fill in recipient name and phone number.");
      return;
    }

    // Combine street address according to dwelling type
    let finalStreet = form.street_address.trim();
    if (dwellingType === "apartment") {
      const apartmentParts = [
        form.house_flat_no ? `Flat/Unit: ${form.house_flat_no}` : "",
        form.floor_no ? `Floor ${form.floor_no}` : "",
        form.block_wing ? `Block/Wing ${form.block_wing}` : "",
        form.building_name ? form.building_name : "",
        form.street_address ? form.street_address : ""
      ].filter(Boolean);
      finalStreet = apartmentParts.join(", ");
    } else {
      const houseParts = [
        form.house_flat_no ? `House/Plot ${form.house_flat_no}` : "",
        form.building_name ? form.building_name : "",
        form.street_address ? form.street_address : ""
      ].filter(Boolean);
      finalStreet = houseParts.join(", ");
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
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#ffffff", color: "#000000", border: "2px solid #000000",
          borderRadius: 0, width: "100%", maxWidth: 660, maxHeight: "90vh", overflowY: "auto",
          padding: 32, boxShadow: "0 20px 50px rgba(0,0,0,0.2)", position: "relative"
        }}
      >
        {/* Modal Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: "2px solid #000000", paddingBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 900, margin: 0, color: "#000000", textTransform: "uppercase", letterSpacing: "0.02em" }}>
              Add Delivery Address
            </h2>
            <p style={{ fontSize: "0.82rem", color: "#555555", margin: "4px 0 0" }}>
              Restricted to verified Indian shipping locations (6-Digit PIN Code).
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#000000", color: "#ffffff", border: "none",
              width: 32, height: 32, borderRadius: 0, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1rem", fontWeight: 900, cursor: "pointer"
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #dc2626", color: "#dc2626", padding: "12px 16px", borderRadius: 0, fontSize: "0.85rem", marginBottom: 20, display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
            <AlertCircleIcon size={16} color="#dc2626" />
            <span>{error}</span>
          </div>
        )}

        {/* Squarish Tab Headers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, marginBottom: 24, border: "2px solid #000000" }}>
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            style={{
              background: activeTab === "search" ? "#000000" : "#ffffff",
              color: activeTab === "search" ? "#ffffff" : "#000000",
              border: "none", padding: "12px", fontWeight: 900, fontSize: "0.85rem",
              textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8
            }}
          >
            <SearchIcon size={16} color={activeTab === "search" ? "#ffffff" : "#000000"} />
            Auto-Locate & Search
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            style={{
              background: activeTab === "manual" ? "#000000" : "#ffffff",
              color: activeTab === "manual" ? "#ffffff" : "#000000",
              border: "none", padding: "12px", fontWeight: 900, fontSize: "0.85rem",
              textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8
            }}
          >
            <BuildingIcon size={16} color={activeTab === "manual" ? "#ffffff" : "#000000"} />
            Manual Entry
          </button>
        </div>

        {/* TAB 1: AUTO-LOCATE & SEARCH */}
        {activeTab === "search" && (
          <div>
            <div style={{ background: "#f8fafc", border: "1px solid #000000", padding: 20, marginBottom: 20 }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 900, color: "#000000", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
                Search Area, City, or Landmark in India
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="e.g. Bandra West, Mumbai or Connaught Place, Delhi"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%", background: "#ffffff", border: "1px solid #000000", color: "#000000",
                    padding: "12px 14px", borderRadius: 0, fontSize: "0.9rem", outline: "none", fontWeight: 600
                  }}
                />
                {searching && (
                  <div style={{ position: "absolute", right: 12, top: 12, fontSize: "0.8rem", color: "#666" }}>
                    Searching...
                  </div>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {suggestions.length > 0 && (
                <div style={{ background: "#ffffff", border: "1px solid #000000", borderTop: "none", marginTop: 4, maxHeight: 220, overflowY: "auto" }}>
                  {suggestions.map(s => (
                    <div
                      key={s.place_id}
                      onClick={() => handleSelectSuggestion(s)}
                      style={{
                        padding: "12px 16px", borderBottom: "1px solid #eee", cursor: "pointer",
                        fontSize: "0.85rem", color: "#000000", display: "flex", alignItems: "center", gap: 10
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"}
                      onMouseLeave={e => e.currentTarget.style.background = "#ffffff"}
                    >
                      <MapPinIcon size={16} color="#000000" />
                      <span>{s.display_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p style={{ fontSize: "0.82rem", color: "#666666", lineHeight: 1.4 }}>
              Tip: Select a location suggestion to auto-fill street, city, state & PIN code. You can then enter your house/flat number on the next step.
            </p>
          </div>
        )}

        {/* TAB 2: MANUAL ENTRY FORM */}
        {activeTab === "manual" && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Address Tag Selector */}
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 900, color: "#000000", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
                Address Label
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ADDRESS_LABELS.map(lbl => {
                  const isActive = form.label === lbl;
                  return (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => updateField("label", lbl)}
                      style={{
                        background: isActive ? "#000000" : "#ffffff",
                        color: isActive ? "#ffffff" : "#000000",
                        border: "1px solid #000000", padding: "8px 16px", borderRadius: 0,
                        fontSize: "0.8rem", fontWeight: 800, cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: 6, textTransform: "uppercase"
                      }}
                    >
                      {lbl === "Home" ? <HomeIcon size={14} color={isActive ? "#fff" : "#000"} /> : lbl === "Work" || lbl === "Office" ? <BriefcaseIcon size={14} color={isActive ? "#fff" : "#000"} /> : <MapPinIcon size={14} color={isActive ? "#fff" : "#000"} />}
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dwelling Type Toggle: Apartment vs Independent House */}
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 900, color: "#000000", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
                Property / Dwelling Type
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setDwellingType("apartment")}
                  style={{
                    background: dwellingType === "apartment" ? "#f1f5f9" : "#ffffff",
                    border: dwellingType === "apartment" ? "2px solid #000000" : "1px solid #ccc",
                    padding: "12px", borderRadius: 0, fontWeight: 800, fontSize: "0.82rem",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#000"
                  }}
                >
                  <BuildingIcon size={16} color="#000" />
                  Flat / Apartment / Complex
                </button>

                <button
                  type="button"
                  onClick={() => setDwellingType("house")}
                  style={{
                    background: dwellingType === "house" ? "#f1f5f9" : "#ffffff",
                    border: dwellingType === "house" ? "2px solid #000000" : "1px solid #ccc",
                    padding: "12px", borderRadius: 0, fontWeight: 800, fontSize: "0.82rem",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#000"
                  }}
                >
                  <HouseIcon size={16} color="#000" />
                  Independent House / Villa
                </button>
              </div>
            </div>

            {/* Dynamic House/Flat Details */}
            {dwellingType === "apartment" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#333", display: "block", marginBottom: 6 }}>Flat / Unit / Door No. *</label>
                  <input
                    type="text" required placeholder="e.g. Flat 402" value={form.house_flat_no}
                    onChange={e => updateField("house_flat_no", e.target.value)}
                    style={{ width: "100%", background: "#fff", border: "1px solid #000", padding: "10px", borderRadius: 0, fontSize: "0.88rem" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#333", display: "block", marginBottom: 6 }}>Building / Apartment Name *</label>
                  <input
                    type="text" required placeholder="e.g. Sunshine Apartments" value={form.building_name}
                    onChange={e => updateField("building_name", e.target.value)}
                    style={{ width: "100%", background: "#fff", border: "1px solid #000", padding: "10px", borderRadius: 0, fontSize: "0.88rem" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#333", display: "block", marginBottom: 6 }}>Floor No. (Optional)</label>
                  <input
                    type="text" placeholder="e.g. 4th Floor" value={form.floor_no}
                    onChange={e => updateField("floor_no", e.target.value)}
                    style={{ width: "100%", background: "#fff", border: "1px solid #000", padding: "10px", borderRadius: 0, fontSize: "0.88rem" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#333", display: "block", marginBottom: 6 }}>Block / Wing (Optional)</label>
                  <input
                    type="text" placeholder="e.g. Wing B" value={form.block_wing}
                    onChange={e => updateField("block_wing", e.target.value)}
                    style={{ width: "100%", background: "#fff", border: "1px solid #000", padding: "10px", borderRadius: 0, fontSize: "0.88rem" }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#333", display: "block", marginBottom: 6 }}>House / Plot No. *</label>
                  <input
                    type="text" required placeholder="e.g. House No. 12" value={form.house_flat_no}
                    onChange={e => updateField("house_flat_no", e.target.value)}
                    style={{ width: "100%", background: "#fff", border: "1px solid #000", padding: "10px", borderRadius: 0, fontSize: "0.88rem" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#333", display: "block", marginBottom: 6 }}>Building / Villa Name (Optional)</label>
                  <input
                    type="text" placeholder="e.g. Rose Villa" value={form.building_name}
                    onChange={e => updateField("building_name", e.target.value)}
                    style={{ width: "100%", background: "#fff", border: "1px solid #000", padding: "10px", borderRadius: 0, fontSize: "0.88rem" }}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#333", display: "block", marginBottom: 6 }}>Street Name / Area / Locality *</label>
              <input
                type="text" required placeholder="e.g. MG Road, Near City Bank" value={form.street_address}
                onChange={e => updateField("street_address", e.target.value)}
                style={{ width: "100%", background: "#fff", border: "1px solid #000", padding: "10px", borderRadius: 0, fontSize: "0.88rem" }}
              />
            </div>

            {/* Recipient Details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#333", display: "block", marginBottom: 6 }}>First Name *</label>
                <input
                  type="text" required value={form.first_name} onChange={e => updateField("first_name", e.target.value)}
                  style={{ width: "100%", background: "#fff", border: "1px solid #000", padding: "10px", borderRadius: 0, fontSize: "0.88rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#333", display: "block", marginBottom: 6 }}>Last Name *</label>
                <input
                  type="text" required value={form.last_name} onChange={e => updateField("last_name", e.target.value)}
                  style={{ width: "100%", background: "#fff", border: "1px solid #000", padding: "10px", borderRadius: 0, fontSize: "0.88rem" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#333", display: "block", marginBottom: 6 }}>City / Town *</label>
                <input
                  type="text" required value={form.city} onChange={e => updateField("city", e.target.value)}
                  style={{ width: "100%", background: "#fff", border: "1px solid #000", padding: "10px", borderRadius: 0, fontSize: "0.88rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#333", display: "block", marginBottom: 6 }}>State *</label>
                <select
                  value={form.state} onChange={e => updateField("state", e.target.value)}
                  style={{ width: "100%", background: "#fff", border: "1px solid #000", padding: "10px", borderRadius: 0, fontSize: "0.88rem" }}
                >
                  {INDIAN_STATES.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#333", display: "block", marginBottom: 6 }}>PIN Code (6 Digits) *</label>
                <input
                  type="text" required maxLength={6} placeholder="400001" value={form.pincode}
                  onChange={e => updateField("pincode", e.target.value.replace(/\D/g, ""))}
                  style={{ width: "100%", background: "#fff", border: "1px solid #000", padding: "10px", borderRadius: 0, fontSize: "0.88rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#333", display: "block", marginBottom: 6 }}>Country *</label>
                <input
                  type="text" disabled value="India (Only India Allowed)"
                  style={{ width: "100%", background: "#f1f5f9", border: "1px solid #ccc", color: "#666", padding: "10px", borderRadius: 0, fontSize: "0.85rem", fontWeight: 700 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#333", display: "block", marginBottom: 6 }}>Mobile Phone Number *</label>
              <input
                type="tel" required placeholder="+91 98765 43210" value={form.phone} onChange={e => updateField("phone", e.target.value)}
                style={{ width: "100%", background: "#fff", border: "1px solid #000", padding: "10px", borderRadius: 0, fontSize: "0.88rem" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16, borderTop: "2px solid #000", paddingTop: 18 }}>
              <button
                type="button" onClick={onClose}
                style={{ background: "#ffffff", border: "1px solid #000", color: "#000", padding: "12px 22px", borderRadius: 0, fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", textTransform: "uppercase" }}
              >
                Cancel
              </button>
              <button
                type="submit" disabled={loading}
                style={{ background: "#000000", color: "#ffffff", border: "1px solid #000", padding: "12px 28px", borderRadius: 0, fontWeight: 900, fontSize: "0.88rem", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                {loading ? "Saving Address..." : "Save Delivery Address →"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
