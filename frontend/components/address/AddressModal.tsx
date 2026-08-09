import React, { useState, useEffect } from "react";
import type { UserAddress } from "@/lib/api/types";
import { createUserAddress, updateUserAddress } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
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
  initialAddress?: UserAddress | null;
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

export default function AddressModal({ token, isOpen, onClose, onSuccess, initialAddress }: AddressModalProps) {
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const [activeTab, setActiveTab] = useState<"search" | "manual">("search");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [autofilled, setAutofilled] = useState(false);

  const [dwellingType, setDwellingType] = useState<"apartment" | "house">("apartment");

  const [form, setForm] = useState({
    label: "Home",
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    house_flat_no: "",
    floor_no: "",
    building_name: "",
    block_wing: "",
    street_address: "",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "",
    country: "India",
    is_default: true,
  });

  // Populate form if initialAddress (edit mode) or auto-fill user info (create mode)
  useEffect(() => {
    if (isOpen && initialAddress) {
      let hNo = initialAddress.house_flat_no || "";
      let bName = initialAddress.building_name || initialAddress.apartment || "";
      let flNo = initialAddress.floor_no || "";
      let bWing = initialAddress.block_wing || "";
      let sAddr = initialAddress.street_address || "";

      // Parse legacy concatenated street_address into individual input fields if not stored separately
      if (!hNo && sAddr) {
        const flatMatch = sAddr.match(/(?:Flat|House No\.)\s*([^,]+)/i);
        if (flatMatch) {
          hNo = flatMatch[1].trim();
          sAddr = sAddr.replace(/(?:Flat|House No\.)\s*([^,]+)(?:,\s*)?/i, "");
        }

        const floorMatch = sAddr.match(/Floor\s*([^,]+)/i);
        if (floorMatch) {
          flNo = floorMatch[1].trim();
          sAddr = sAddr.replace(/Floor\s*([^,]+)(?:,\s*)?/i, "");
        }

        const wingMatch = sAddr.match(/Wing\s*([^,]+)/i);
        if (wingMatch) {
          bWing = wingMatch[1].trim();
          sAddr = sAddr.replace(/Wing\s*([^,]+)(?:,\s*)?/i, "");
        }

        if (bName && sAddr.toLowerCase().includes(bName.toLowerCase())) {
          const escBName = bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          sAddr = sAddr.replace(new RegExp(escBName + '(?:,\\s*)?', 'i'), "");
        }

        sAddr = sAddr.replace(/^[,\s]+|[,\s]+$/g, "");
      }

      setForm({
        label: initialAddress.label || "Home",
        first_name: initialAddress.first_name || "",
        last_name: initialAddress.last_name || "",
        phone: initialAddress.phone || "",
        email: initialAddress.email || "",
        house_flat_no: hNo,
        floor_no: flNo,
        building_name: bName,
        block_wing: bWing,
        street_address: sAddr,
        city: initialAddress.city || "Mumbai",
        state: initialAddress.state || "Maharashtra",
        pincode: initialAddress.pincode || "",
        country: "India",
        is_default: initialAddress.is_default,
      });
      setActiveTab("manual");
    } else if (isOpen && user) {
      setForm(f => {
        let fName = f.first_name;
        let lName = f.last_name;
        if (!fName && user.full_name) {
          const parts = user.full_name.trim().split(" ");
          fName = parts[0] || "";
          lName = parts.slice(1).join(" ") || "";
        }
        return {
          ...f,
          phone: f.phone || user.phone || "",
          email: f.email || user.email || "",
          first_name: fName,
          last_name: lName,
        };
      });
    }
  }, [isOpen, initialAddress, user]);

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
      const payload = {
        label: form.label,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        street_address: finalStreet,
        apartment: dwellingType === "apartment" ? form.building_name.trim() : "",
        house_flat_no: form.house_flat_no.trim() || undefined,
        building_name: form.building_name.trim() || undefined,
        floor_no: form.floor_no.trim() || undefined,
        block_wing: form.block_wing.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        country: "India",
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        is_default: form.is_default
      };

      const result = initialAddress
        ? await updateUserAddress(token, initialAddress.id, payload)
        : await createUserAddress(token, payload);
      onSuccess(result);
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
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "2px solid #000",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          position: "sticky", top: 0, background: "#fff", zIndex: 10
        }}>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>
              {initialAddress ? "Edit Delivery Address" : "Add Delivery Address"}
            </h2>
            <p style={{ fontSize: "0.75rem", color: "#666", margin: "2px 0 0" }}>
              Shipping restricted to Indian locations only.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#000", border: "none", color: "#fff",
              width: 32, height: 32, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", transition: "opacity 0.15s"
            }}
          >
            <XIcon size={18} color="#fff" />
          </button>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          {error && (
            <div style={{
              background: "#fee2e2", border: "1px solid #ef4444", color: "#991b1b",
              padding: "10px 14px", fontSize: "0.82rem", fontWeight: 700,
              display: "flex", alignItems: "center", gap: 8
            }}>
              <AlertCircleIcon size={16} color="#991b1b" />
              {error}
            </div>
          )}

          <div style={{ display: "flex", borderBottom: "2px solid #e5e7eb" }}>
            <button
              type="button"
              onClick={() => setActiveTab("search")}
              style={{
                flex: 1, padding: "10px", fontSize: "0.82rem", fontWeight: 900,
                textTransform: "uppercase", letterSpacing: "0.05em", background: "none", border: "none",
                borderBottom: activeTab === "search" ? "3px solid #000" : "3px solid transparent",
                color: activeTab === "search" ? "#000" : "#888", cursor: "pointer", transition: "all 0.15s",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8
              }}
            >
              <SearchIcon size={15} color={activeTab === "search" ? "#000" : "#888"} />
              Search Locality
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("manual")}
              style={{
                flex: 1, padding: "10px", fontSize: "0.82rem", fontWeight: 900,
                textTransform: "uppercase", letterSpacing: "0.05em", background: "none", border: "none",
                borderBottom: activeTab === "manual" ? "3px solid #000" : "3px solid transparent",
                color: activeTab === "manual" ? "#000" : "#888", cursor: "pointer", transition: "all 0.15s",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8
              }}
            >
              <BuildingIcon size={15} color={activeTab === "manual" ? "#000" : "#888"} />
              Enter Manually
            </button>

          </div>

          {activeTab === "search" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ position: "relative" }}>
                <label style={labelStyle}>Search Area / Landmark / PIN Code</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="e.g. Bandra West, Mumbai or 400050..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ ...inputStyle, paddingLeft: 38 }}
                  />
                  <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
                    <SearchIcon size={16} color="#666" />
                  </div>
                </div>

                {searching && (
                  <div style={{ fontSize: "0.78rem", color: "#666", marginTop: 6, fontWeight: 600 }}>
                    Searching locations across India...
                  </div>
                )}

                {suggestions.length > 0 && (
                  <div style={{
                    position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4,
                    background: "#fff", border: "2px solid #000", zIndex: 50,
                    boxShadow: "0 10px 25px rgba(0,0,0,0.15)", maxHeight: 240, overflowY: "auto"
                  }}>
                    {suggestions.map((sugg) => (
                      <button
                        key={sugg.place_id}
                        type="button"
                        onClick={() => handleSelectSuggestion(sugg)}
                        style={{
                          width: "100%", textAlign: "left", padding: "12px 14px",
                          background: "#fff", border: "none", borderBottom: "1px solid #eee",
                          fontSize: "0.82rem", color: "#000", cursor: "pointer", fontWeight: 600,
                          display: "flex", alignItems: "flex-start", gap: 10, transition: "background 0.1s"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#f8fafc"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
                      >
                        <MapPinIcon size={16} color="#000" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{sugg.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{
                background: "#f8fafc", border: "1px solid #e2e8f0", padding: 14,
                display: "flex", gap: 10, alignItems: "flex-start"
              }}>
                <MapPinIcon size={16} color="#000" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: "0.78rem", color: "#475569", lineHeight: 1.45 }}>
                  <strong>How auto-fill works:</strong> Select your area above to automatically fill city, state, PIN code, and locality, then complete your flat/house details in the next step.
                </div>
              </div>

              {autofilled && (
                <button
                  type="button"
                  onClick={() => setActiveTab("manual")}
                  style={{
                    background: "#000", color: "#fff", border: "none", padding: "12px",
                    fontWeight: 900, fontSize: "0.85rem", cursor: "pointer",
                    textTransform: "uppercase", letterSpacing: "0.05em", width: "100%"
                  }}
                >
                  Continue to Complete Address Details →
                </button>
              )}
            </div>
          )}

          {activeTab === "manual" && (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <input
                    type="text" required placeholder="e.g. Rahul" value={form.first_name}
                    onChange={e => updateField("first_name", e.target.value)}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = "#000"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Last Name *</label>
                  <input
                    type="text" required placeholder="e.g. Sharma" value={form.last_name}
                    onChange={e => updateField("last_name", e.target.value)}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = "#000"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                <div>
                  <label style={labelStyle}>Email Address (for order updates)</label>
                  <input
                    type="email" placeholder="name@example.com"
                    value={form.email}
                    onChange={e => updateField("email", e.target.value)}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = "#000"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                  />
                </div>
              </div>

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
                    </div>
                  </button>
                </div>
              </div>

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
                      type="text" required placeholder="e.g. 12"
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
                  {loading ? "Saving..." : initialAddress ? "Update Address →" : "Save Address →"}
                </button>

              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
