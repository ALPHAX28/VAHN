"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserAddresses, setDefaultAddress, deleteUserAddress } from "@/lib/api";
import type { UserAddress } from "@/lib/api/types";
import AddressModal from "@/components/address/AddressModal";
import Link from "next/link";
import {
  MapPinIcon, HomeIcon, BriefcaseIcon, PhoneIcon,
  CheckIcon, TrashIcon, StarIcon, EditIcon
} from "@/components/icons/Icons";

import { clientCache } from "@/lib/api/cache";

export default function AccountAddressesPage() {
  const { user, token, openAuthModal } = useAuth();


  const cacheKey = token ? `storefront:/users/me/addresses` : "";
  const initialAddresses = cacheKey ? clientCache.get<UserAddress[]>(cacheKey) : null;

  const [addresses, setAddresses] = useState<UserAddress[]>(initialAddresses || []);
  const [loading, setLoading] = useState(!initialAddresses);
  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<number | null>(null);


  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    loadAddresses(!!initialAddresses);
  }, [token]);

  async function loadAddresses(isSilent = false) {
    if (!token) return;
    if (!isSilent && addresses.length === 0) setLoading(true);
    try {
      const data = await getUserAddresses(token);
      setAddresses(data);
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  }

  async function handleSetDefault(id: number) {
    if (!token) return;
    setSettingDefaultId(id);
    try {
      await setDefaultAddress(token, id);
      await loadAddresses();
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function handleDelete(id: number) {
    if (!token || !confirm("Are you sure you want to delete this address?")) return;
    setDeletingId(id);
    try {
      await deleteUserAddress(token, id);
      await loadAddresses();
    } finally {
      setDeletingId(null);
    }
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 560, margin: "100px auto", padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
          <MapPinIcon size={24} color="#fff" />
        </div>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 900, textTransform: "uppercase", margin: "0 0 10px" }}>
          Sign In to View Addresses
        </h2>
        <button
          type="button"
          onClick={() => openAuthModal()}
          style={{
            display: "inline-block", background: "#000", color: "#fff",
            padding: "12px 28px", fontWeight: 900, border: "none", cursor: "pointer",
            textTransform: "uppercase", letterSpacing: '-0.025em', fontSize: "0.82rem", marginTop: 8
          }}
        >
          Sign In →
        </button>

      </div>
    );
  }

  return (
    <div className="account-page-container">

      {/* Page Header */}
      <div className="account-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#888", letterSpacing: '-0.025em', textTransform: "uppercase", marginBottom: 4 }}>
            Account / My Addresses
          </div>
          <h1 className="account-title" style={{ textTransform: "uppercase" }}>
            Saved Addresses
          </h1>
          <p className="account-subtitle">
            Manage your delivery locations for fast checkout.
          </p>
        </div>

        {addresses.length > 0 && (
          <button
            onClick={() => {
              setEditingAddress(null);
              setShowModal(true);
            }}
            style={{
              background: "#000", color: "#fff", border: "none",
              padding: "12px 22px", fontWeight: 900, fontSize: "0.82rem",
              cursor: "pointer", textTransform: "uppercase", letterSpacing: '-0.025em',
              display: "inline-flex", alignItems: "center", gap: 8,
              transition: "background 0.15s"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#222"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#000"; }}
          >
            + Add New Address
          </button>
        )}
      </div>

      {/* Main Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "#888" }}>
          <div style={{ width: 32, height: 32, border: "3px solid #000", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <span style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: '-0.025em' }}>Loading saved addresses...</span>
        </div>
      ) : addresses.length === 0 ? (
        <div style={{
          background: "#fff", border: "2px solid #000",
          padding: "48px 24px", textAlign: "center"
        }}>
          <div style={{
            width: 60, height: 60, border: "2px solid #000", background: "#f8fafc",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px"
          }}>
            <MapPinIcon size={28} color="#000" />
          </div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 900, color: "#000", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: '-0.025em' }}>
            No Saved Addresses
          </h3>
          <p style={{ fontSize: "0.875rem", color: "#666", margin: "0 0 28px", lineHeight: 1.6, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
            Add your primary Indian delivery address for faster checkout and order tracking.
          </p>
          <button
            onClick={() => {
              setEditingAddress(null);
              setShowModal(true);
            }}
            style={{
              background: "#000", color: "#fff", border: "none",
              padding: "14px 32px", fontWeight: 900, fontSize: "0.875rem",
              cursor: "pointer", textTransform: "uppercase", letterSpacing: '-0.025em'
            }}
          >
            + Add Your First Address
          </button>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 20
        }}>
          {addresses.map(addr => (
            <div
              key={addr.id}
              style={{
                background: "#fff",
                border: addr.is_default ? "2px solid #000" : "1px solid #e5e7eb",
                boxShadow: addr.is_default ? "3px 3px 0px #000" : "none",
                display: "flex", flexDirection: "column",
                position: "relative", transition: "all 0.15s ease"
              }}
            >
              <div style={{ padding: "20px 20px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{
                    background: "#000", color: "#fff",
                    padding: "4px 12px", fontSize: "0.7rem", fontWeight: 900,
                    textTransform: "uppercase", letterSpacing: '-0.025em',
                    display: "inline-flex", alignItems: "center", gap: 6
                  }}>
                    {addr.label === "Home"
                      ? <HomeIcon size={12} color="#fff" />
                      : addr.label === "Work" || addr.label === "Office"
                      ? <BriefcaseIcon size={12} color="#fff" />
                      : <MapPinIcon size={12} color="#fff" />}
                    {addr.label}
                  </span>

                  {addr.is_default && (
                    <span style={{
                      background: "#f0fdf4", color: "#15803d", border: "1px solid #16a34a",
                      padding: "3px 9px", fontSize: "0.65rem", fontWeight: 900,
                      letterSpacing: '-0.025em', textTransform: "uppercase",
                      display: "inline-flex", alignItems: "center", gap: 4
                    }}>
                      <CheckIcon size={10} color="#15803d" />
                      Default
                    </span>
                  )}
                </div>

                <h3 style={{ fontSize: "1.05rem", fontWeight: 900, margin: "0 0 8px", color: "#000" }}>
                  {addr.first_name} {addr.last_name}
                </h3>

                <p style={{ fontSize: "0.875rem", color: "#333", margin: "0 0 3px", lineHeight: 1.5 }}>
                  {addr.street_address}{addr.apartment ? `, ${addr.apartment}` : ""}
                </p>
                <p style={{ fontSize: "0.85rem", color: "#555", margin: "0 0 8px" }}>
                  {addr.city}, {addr.state} — <strong style={{ color: "#000" }}>{addr.pincode}</strong>
                </p>
                <p style={{ fontSize: "0.82rem", color: "#777", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 5 }}>
                  <PhoneIcon size={12} color="#888" />
                  {addr.phone}
                </p>
              </div>

              {/* Actions footer */}
              <div style={{
                marginTop: "auto", padding: "14px 20px",
                borderTop: "1px solid #f0f0f0",
                display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"
              }}>
                <button
                  onClick={() => {
                    setEditingAddress(addr);
                    setShowModal(true);
                  }}
                  style={{
                    background: "none", border: "1px solid #000", color: "#000",
                    padding: "7px 14px", fontSize: "0.75rem", fontWeight: 800,
                    cursor: "pointer", textTransform: "uppercase", letterSpacing: '-0.025em',
                    display: "inline-flex", alignItems: "center", gap: 5,
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >
                  <EditIcon size={13} color="#000" />
                  Edit
                </button>

                {!addr.is_default && (
                  <button
                    onClick={() => handleSetDefault(addr.id)}
                    disabled={settingDefaultId === addr.id}
                    style={{
                      background: "none", border: "1px solid #000", color: "#000",
                      padding: "7px 14px", fontSize: "0.75rem", fontWeight: 800,
                      cursor: "pointer", textTransform: "uppercase", letterSpacing: '-0.025em',
                      display: "inline-flex", alignItems: "center", gap: 5,
                      transition: "background 0.15s"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                  >
                    <StarIcon size={13} color="#000" />
                    {settingDefaultId === addr.id ? "Setting..." : "Set Default"}
                  </button>
                )}

                <button
                  onClick={() => handleDelete(addr.id)}
                  disabled={deletingId === addr.id}
                  style={{
                    marginLeft: "auto",
                    background: "none", border: "1px solid #fca5a5", color: "#dc2626",
                    padding: "7px 14px", fontSize: "0.75rem", fontWeight: 800,
                    cursor: "pointer", textTransform: "uppercase", letterSpacing: '-0.025em',
                    display: "inline-flex", alignItems: "center", gap: 5,
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >
                  <TrashIcon size={13} color="#dc2626" />
                  {deletingId === addr.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {token && (
        <AddressModal
          token={token}
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingAddress(null);
          }}
          onSuccess={() => loadAddresses()}
          initialAddress={editingAddress}
        />
      )}
    </div>
  );
}
