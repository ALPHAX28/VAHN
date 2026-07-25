"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserAddresses, setDefaultAddress, deleteUserAddress } from "@/lib/api";
import type { UserAddress } from "@/lib/api/types";
import AddressModal from "@/components/address/AddressModal";
import Link from "next/link";
import { MapPinIcon, HomeIcon, BriefcaseIcon, PhoneIcon } from "@/components/icons/Icons";

export default function AccountAddressesPage() {
  const { user, token } = useAuth();
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    loadAddresses();
  }, [token]);

  async function loadAddresses() {
    if (!token) return;
    setLoading(true);
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
    await setDefaultAddress(token, id);
    loadAddresses();
  }

  async function handleDelete(id: number) {
    if (!token || !confirm("Are you sure you want to delete this address?")) return;
    await deleteUserAddress(token, id);
    loadAddresses();
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 960, margin: "60px auto", padding: 20, color: "#000", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 900 }}>Please Sign In to Access Saved Addresses</h2>
        <Link href="/account/login" style={{ color: "#000", fontWeight: 800, textDecoration: "underline", marginTop: 16, display: "inline-block" }}>
          Sign In / Register →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "40px auto", padding: "0 20px", color: "#000000" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16, borderBottom: "1px solid #000000", paddingBottom: 20 }}>
        <div>
          <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#666666", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            ACCOUNT / MANAGEMENT
          </span>
          <h1 style={{ fontSize: "2rem", fontWeight: 900, margin: "4px 0 0", color: "#000000", letterSpacing: "-0.01em", textTransform: "uppercase" }}>
            Saved Delivery Addresses
          </h1>
          <p style={{ fontSize: "0.88rem", color: "#555555", margin: "4px 0 0" }}>
            Manage multiple delivery addresses in India with custom labels and PIN code verification.
          </p>
        </div>
        {addresses.length > 0 && (
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: "#000000", color: "#ffffff", border: "1px solid #000000", padding: "12px 24px",
              borderRadius: 0, fontWeight: 800, fontSize: "0.85rem", cursor: "pointer",
              textTransform: "uppercase", letterSpacing: "0.05em", transition: "all 0.2s ease"
            }}
          >
            + Add New Address
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#666666", fontWeight: 600 }}>Loading saved addresses...</div>
      ) : addresses.length === 0 ? (
        <div style={{
          background: "#ffffff", border: "1px solid #000000",
          borderRadius: 0, padding: "54px 24px", textAlign: "center"
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <MapPinIcon size={36} color="#000000" />
          </div>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 900, color: "#000000", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            No Saved Delivery Addresses
          </h3>
          <p style={{ fontSize: "0.88rem", color: "#555555", margin: "8px 0 24px" }}>
            Add your primary Indian delivery address for faster enterprise checkout.
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: "#000000", color: "#ffffff", border: "none", padding: "14px 28px",
              borderRadius: 0, fontWeight: 800, fontSize: "0.9rem", cursor: "pointer",
              textTransform: "uppercase", letterSpacing: "0.05em"
            }}
          >
            + Add Address Now
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
          {addresses.map(addr => (
            <div
              key={addr.id}
              style={{
                background: "#ffffff",
                border: addr.is_default ? "2px solid #000000" : "1px solid #e5e5e5",
                borderRadius: 0, padding: 24, display: "flex", flexDirection: "column",
                justifyContent: "space-between", transition: "all 0.2s ease"
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{
                    background: "#000000", color: "#ffffff",
                    padding: "4px 10px", borderRadius: 0, fontSize: "0.72rem", fontWeight: 800,
                    textTransform: "uppercase", letterSpacing: "0.05em", display: "inline-flex", alignItems: "center", gap: 6
                  }}>
                    {addr.label === "Home" ? <HomeIcon size={12} color="#ffffff" /> : addr.label === "Work" || addr.label === "Office" ? <BriefcaseIcon size={12} color="#ffffff" /> : <MapPinIcon size={12} color="#ffffff" />}
                    {addr.label}
                  </span>
                  {addr.is_default && (
                    <span style={{ background: "#f3f4f6", color: "#000000", border: "1px solid #000000", padding: "2px 8px", borderRadius: 0, fontSize: "0.68rem", fontWeight: 900, letterSpacing: "0.05em" }}>
                      DEFAULT
                    </span>
                  )}
                </div>

                <h3 style={{ fontSize: "1.1rem", fontWeight: 900, margin: "0 0 6px", color: "#000000", letterSpacing: "-0.01em" }}>
                  {addr.first_name} {addr.last_name}
                </h3>
                <p style={{ fontSize: "0.88rem", color: "#333333", margin: "0 0 4px", lineHeight: 1.5 }}>
                  {addr.street_address}{addr.apartment ? `, ${addr.apartment}` : ""}
                </p>
                <p style={{ fontSize: "0.85rem", color: "#555555", margin: "0 0 6px" }}>
                  {addr.city}, {addr.state} — <strong>{addr.pincode}</strong>
                </p>
                <p style={{ fontSize: "0.82rem", color: "#666666", margin: "10px 0 0", display: "flex", gap: 6, alignItems: "center" }}>
                  <span>India</span> | <PhoneIcon size={12} color="#666666" /> <span>{addr.phone}</span>
                </p>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24, paddingTop: 16, borderTop: "1px solid #eee", alignItems: "center" }}>
                {!addr.is_default && (
                  <button
                    onClick={() => handleSetDefault(addr.id)}
                    style={{ background: "none", border: "none", color: "#000000", fontSize: "0.8rem", fontWeight: 800, cursor: "pointer", padding: 0, textDecoration: "underline" }}
                  >
                    Set as Default
                  </button>
                )}
                <button
                  onClick={() => handleDelete(addr.id)}
                  style={{ background: "none", border: "none", color: "#dc2626", fontSize: "0.8rem", fontWeight: 800, cursor: "pointer", padding: 0, marginLeft: "auto" }}
                >
                  Delete Address ✕
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
          onClose={() => setShowModal(false)}
          onSuccess={() => loadAddresses()}
        />
      )}
    </div>
  );
}
