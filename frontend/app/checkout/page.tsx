"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { getUserAddresses, checkoutCart } from "@/lib/api";
import type { UserAddress, OrderDetail } from "@/lib/api/types";
import AddressModal from "@/components/address/AddressModal";
import Image from "next/image";
import Link from "next/link";
import {
  MapPinIcon,
  ShoppingBagIcon,
  ShieldCheckIcon,
  PhoneIcon,
  HomeIcon,
  BriefcaseIcon,
  AlertCircleIcon,
  CheckIcon,
  TruckIcon
} from "@/components/icons/Icons";

export default function CheckoutPage() {
  const { user, token } = useAuth();
  const { cart, clearCart } = useCart();
  const router = useRouter();

  const [step, setStep] = useState<"address" | "review">("address");
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);

  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (token) {
      loadAddresses();
    } else {
      setLoadingAddresses(false);
    }
  }, [token]);

  async function loadAddresses() {
    if (!token) return;
    setLoadingAddresses(true);
    try {
      const data = await getUserAddresses(token);
      setAddresses(data);
      if (data.length > 0) {
        const defaultAddr = data.find(a => a.is_default) || data[0];
        setSelectedAddressId(defaultAddr.id);
      }
    } catch {
      // Error loading addresses
    } finally {
      setLoadingAddresses(false);
    }
  }

  // Calculate pricing dynamically per product
  const cartLines = cart?.lines.edges.map(e => e.node) || [];
  const subtotal = cartLines.reduce((sum, line) => sum + (parseFloat(line.merchandise.price.amount) * line.quantity), 0);
  const customShippingRate = cartLines.reduce((max, line) => {
    const rate = line.merchandise.product.shippingRate;
    return rate != null ? Math.max(max, rate) : max;
  }, -1);
  const shippingFee = customShippingRate >= 0 ? customShippingRate : (subtotal >= 1999 || subtotal === 0 ? 0 : 99);
  const estimatedTax = Math.round(cartLines.reduce((taxSum, line) => {
    const price = parseFloat(line.merchandise.price.amount);
    const lineTotal = price * line.quantity;
    const gstPct = line.merchandise.product.gstPercent ?? 12;
    return taxSum + (lineTotal * (gstPct / (100 + gstPct)));
  }, 0));
  const grandTotal = subtotal + shippingFee;

  const selectedAddr = addresses.find(a => a.id === selectedAddressId);

  function handleProceedToReview(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!selectedAddressId || !selectedAddr) {
      setError("Please select or add a delivery address.");
      return;
    }

    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleConfirmOrder() {
    if (!token || !cart || !selectedAddressId) return;
    setPlacingOrder(true);
    setError("");

    try {
      const resultOrder: OrderDetail = await checkoutCart(token, cart.id, selectedAddressId);
      clearCart();
      router.push(`/account/orders/${resultOrder.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to place order.");
      setPlacingOrder(false);
    }
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 560, margin: "100px auto", padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <ShoppingBagIcon size={28} color="#fff" />
        </div>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.02em", margin: "0 0 10px" }}>
          Sign In to Checkout
        </h2>
        <p style={{ color: "#555", fontSize: "0.9rem", margin: "0 0 24px", lineHeight: 1.6 }}>
          Log in to access your saved delivery addresses and order history.
        </p>
        <Link href="/account/login" style={{
          display: "inline-block", background: "#000", color: "#fff",
          padding: "14px 32px", fontWeight: 900, textDecoration: "none",
          textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.85rem"
        }}>
          Sign In Now →
        </Link>
      </div>
    );
  }

  if (!cartLines.length && step === "address") {
    return (
      <div style={{ maxWidth: 560, margin: "100px auto", padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, background: "#f3f4f6", border: "1px solid #000", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <ShoppingBagIcon size={28} color="#000" />
        </div>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.02em", margin: "0 0 10px" }}>
          Your Cart is Empty
        </h2>
        <p style={{ color: "#555", fontSize: "0.9rem", margin: "0 0 24px", lineHeight: 1.6 }}>
          Add products to your cart before checking out.
        </p>
        <Link href="/collections/vahn-beginning" style={{
          display: "inline-block", background: "#000", color: "#fff",
          padding: "14px 32px", fontWeight: 900, textDecoration: "none",
          textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.85rem"
        }}>
          Explore Collection →
        </Link>
      </div>
    );
  }

  return (
    <div className="vahn-checkout-container" style={{ maxWidth: step === "address" ? 840 : 1100, margin: "40px auto", color: "#000", transition: "max-width 0.25s ease" }}>

      {/* Step Indicator Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 8 }}>
          {/* Step 1 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32,
              background: step === "address" ? "#000" : "#000",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.8rem", fontWeight: 900, flexShrink: 0
            }}>
              {step === "review" ? <CheckIcon size={14} color="#fff" /> : "1"}
            </div>
            <span style={{
              fontSize: "0.82rem", fontWeight: step === "address" ? 900 : 700,
              color: "#000", textTransform: "uppercase", letterSpacing: "0.06em"
            }}>
              Delivery Address
            </span>
          </div>

          {/* Connector */}
          <div style={{ flex: 1, height: 2, background: step === "review" ? "#000" : "#d1d5db", margin: "0 16px", minWidth: 24 }} />

          {/* Step 2 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32,
              background: step === "review" ? "#000" : "#f3f4f6",
              border: step === "review" ? "none" : "1px solid #d1d5db",
              color: step === "review" ? "#fff" : "#9ca3af",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.8rem", fontWeight: 900, flexShrink: 0
            }}>
              2
            </div>
            <span style={{
              fontSize: "0.82rem", fontWeight: step === "review" ? 900 : 600,
              color: step === "review" ? "#000" : "#9ca3af",
              textTransform: "uppercase", letterSpacing: "0.06em"
            }}>
              Review & Pay
            </span>
          </div>
        </div>

        <h1 style={{ fontSize: "1.75rem", fontWeight: 900, margin: "12px 0 0", textTransform: "uppercase", letterSpacing: "-0.01em", borderBottom: "2px solid #000", paddingBottom: 16 }}>
          {step === "address" ? "Select Delivery Address" : "Order Review & Confirmation"}
        </h1>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          borderLeft: "4px solid #dc2626", background: "#fef2f2", color: "#dc2626",
          padding: "14px 18px", fontSize: "0.875rem", marginBottom: 28,
          display: "flex", alignItems: "center", gap: 10, fontWeight: 700
        }}>
          <AlertCircleIcon size={18} color="#dc2626" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className={`vahn-checkout-grid ${step === "review" ? "vahn-checkout-grid-review" : ""}`}>

        {/* Left: Main Content */}
        <div>
          {step === "address" ? (
            <form onSubmit={handleProceedToReview}>
              <div style={{ background: "#fff", border: "2px solid #000" }}>
                {/* Card Header */}
                <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <MapPinIcon size={18} color="#000" />
                    <span style={{ fontSize: "0.85rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Shipping Location
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddressModal(true)}
                    style={{
                      background: "#000", color: "#fff", border: "none",
                      padding: "8px 18px", fontSize: "0.78rem", fontWeight: 900,
                      cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em",
                      display: "flex", alignItems: "center", gap: 6
                    }}
                  >
                    + Add New
                  </button>
                </div>

                {/* Address List */}
                <div className="vahn-checkout-card-body">
                  {loadingAddresses ? (
                    <div style={{ textAlign: "center", padding: "48px 0", color: "#888" }}>
                      <div style={{ width: 32, height: 32, border: "3px solid #000", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Loading addresses...</span>
                    </div>
                  ) : addresses.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "48px 24px", background: "#f8fafc", border: "1px dashed #000" }}>
                      <div style={{ width: 52, height: 52, background: "#fff", border: "2px solid #000", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                        <MapPinIcon size={24} color="#000" />
                      </div>
                      <h4 style={{ fontSize: "1rem", fontWeight: 900, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        No Saved Addresses
                      </h4>
                      <p style={{ fontSize: "0.85rem", color: "#666", margin: "0 0 20px", lineHeight: 1.5 }}>
                        Add a delivery address to proceed with checkout.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAddressModal(true)}
                        style={{
                          background: "#000", color: "#fff", border: "none",
                          padding: "12px 28px", fontWeight: 900, fontSize: "0.85rem",
                          cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em"
                        }}
                      >
                        + Add Address Now
                      </button>
                    </div>
                  ) : (
                    <div className="vahn-address-scroll-container">
                      <div className="vahn-address-select-grid">
                        {addresses.map(addr => {
                          const isSelected = selectedAddressId === addr.id;
                          return (
                            <div
                              key={addr.id}
                              onClick={() => setSelectedAddressId(addr.id)}
                              style={{
                                border: isSelected ? "2px solid #000" : "1px solid #e5e5e5",
                                background: isSelected ? "#fff" : "#fafafa",
                                boxShadow: isSelected ? "3px 3px 0px #000" : "none",
                                padding: "18px 20px",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                display: "flex", gap: 14, alignItems: "flex-start",
                                position: "relative",
                                maxWidth: "100%",
                                boxSizing: "border-box"
                              }}
                            >
                              {/* Radio dot */}
                              <div style={{
                                width: 20, height: 20, borderRadius: "50%",
                                border: isSelected ? "6px solid #000" : "2px solid #bbb",
                                background: "#fff", flexShrink: 0, marginTop: 2, transition: "all 0.15s"
                              }} />

                              <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Name + label row */}
                                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: 900, fontSize: "0.95rem", color: "#000" }}>
                                    {addr.first_name} {addr.last_name}
                                  </span>
                                  <span style={{
                                    background: "#000", color: "#fff",
                                    padding: "2px 8px", fontSize: "0.65rem", fontWeight: 900,
                                    textTransform: "uppercase", letterSpacing: "0.06em",
                                    display: "inline-flex", alignItems: "center", gap: 4
                                  }}>
                                    {addr.label === "Home" ? <HomeIcon size={10} color="#fff" /> : addr.label === "Work" || addr.label === "Office" ? <BriefcaseIcon size={10} color="#fff" /> : <MapPinIcon size={10} color="#fff" />}
                                    {addr.label}
                                  </span>
                                  {addr.is_default && (
                                    <span style={{ background: "#f0fdf4", border: "1px solid #16a34a", color: "#15803d", padding: "2px 7px", fontSize: "0.62rem", fontWeight: 900, letterSpacing: "0.06em" }}>
                                      DEFAULT
                                    </span>
                                  )}
                                </div>

                                {/* Address lines */}
                                <p style={{ fontSize: "0.875rem", color: "#333", margin: "0 0 3px", lineHeight: 1.5 }}>
                                  {addr.street_address}{addr.apartment ? `, ${addr.apartment}` : ""}
                                </p>
                                <p style={{ fontSize: "0.82rem", color: "#666", margin: 0 }}>
                                  {addr.city}, {addr.state} — <strong style={{ color: "#000" }}>{addr.pincode}</strong>
                                </p>
                                <p style={{ fontSize: "0.8rem", color: "#888", margin: "4px 0 0", display: "flex", alignItems: "center", gap: 5 }}>
                                  <PhoneIcon size={12} color="#888" />
                                  {addr.phone}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Integrated Card Footer: Continue Button */}
                <div style={{ padding: "20px 24px", borderTop: "1px solid #e5e5e5", background: "#fafafa" }}>
                  <button
                    type="submit"
                    disabled={!selectedAddressId || addresses.length === 0}
                    style={{
                      width: "100%",
                      background: selectedAddressId && addresses.length > 0 ? "#000" : "#ccc",
                      color: "#fff", border: "none",
                      padding: "16px", fontWeight: 900, fontSize: "0.9rem",
                      cursor: selectedAddressId && addresses.length > 0 ? "pointer" : "not-allowed",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: "background 0.2s"
                    }}
                  >
                    <TruckIcon size={16} color="#fff" />
                    Continue to Order Review →
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* STEP 2: REVIEW & PAY */
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Delivery Address confirmation */}
              <div className="vahn-card-box">
                <div className="vahn-card-box-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <MapPinIcon size={16} color="#000" />
                    <span style={{ fontSize: "0.82rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Delivery Address
                    </span>
                  </div>
                  <button
                    onClick={() => setStep("address")}
                    style={{ background: "none", border: "1px solid #000", color: "#000", padding: "6px 14px", fontSize: "0.75rem", fontWeight: 900, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em" }}
                  >
                    Edit
                  </button>
                </div>

                {selectedAddr && (
                  <div className="vahn-card-box-body">
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 900, fontSize: "1rem", color: "#000" }}>
                        {selectedAddr.first_name} {selectedAddr.last_name}
                      </span>
                      <span style={{ background: "#000", color: "#fff", padding: "2px 8px", fontSize: "0.65rem", fontWeight: 900, textTransform: "uppercase" }}>
                        {selectedAddr.label}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.875rem", color: "#333", margin: "0 0 3px", lineHeight: 1.5 }}>
                      {selectedAddr.street_address}{selectedAddr.apartment ? `, ${selectedAddr.apartment}` : ""}
                    </p>
                    <p style={{ fontSize: "0.85rem", color: "#555", margin: "0 0 6px" }}>
                      {selectedAddr.city}, {selectedAddr.state} — <strong>{selectedAddr.pincode}</strong>
                    </p>
                    <p style={{ fontSize: "0.82rem", color: "#777", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      <PhoneIcon size={13} color="#777" />
                      {selectedAddr.phone}
                    </p>
                  </div>
                )}
              </div>

              {/* Items in order */}
              <div className="vahn-card-box">
                <div className="vahn-card-box-header" style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <ShoppingBagIcon size={16} color="#000" />
                  <span style={{ fontSize: "0.82rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Ordered Items ({cartLines.length})
                  </span>
                </div>

                <div className="vahn-card-box-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {cartLines.map(line => {
                    const price = parseFloat(line.merchandise.price.amount);
                    return (
                      <div key={line.id} style={{ display: "flex", gap: 14, alignItems: "center", borderBottom: "1px solid #f3f4f6", paddingBottom: 16 }}>
                        {line.merchandise.product.featuredImage ? (
                          <Image
                            src={line.merchandise.product.featuredImage.url}
                            alt={line.merchandise.product.title}
                            width={64} height={64}
                            style={{ objectFit: "cover", border: "1px solid #e5e5e5", flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{ width: 64, height: 64, background: "#f3f4f6", border: "1px solid #e5e5e5", flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: "0.92rem", color: "#000", marginBottom: 3, lineHeight: 1.35 }}>
                            {line.merchandise.product.title}
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "#666" }}>
                            {line.merchandise.title}
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "#999", marginTop: 2 }}>
                            Qty: <strong style={{ color: "#333" }}>{line.quantity}</strong>
                          </div>
                        </div>
                        <div style={{ fontWeight: 900, fontSize: "0.95rem", color: "#000", flexShrink: 0 }}>
                          ₹{(price * line.quantity).toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setStep("address")}
                  style={{
                    background: "#fff", border: "2px solid #000", color: "#000",
                    padding: "14px 20px", fontWeight: 900, fontSize: "0.82rem",
                    cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0
                  }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={placingOrder}
                  onClick={handleConfirmOrder}
                  style={{
                    flex: 1, background: placingOrder ? "#555" : "#000", color: "#fff",
                    border: "none", padding: "14px", fontWeight: 900, fontSize: "0.9rem",
                    cursor: placingOrder ? "not-allowed" : "pointer",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    transition: "background 0.2s"
                  }}
                >
                  {placingOrder ? "Placing Order..." : "Confirm & Place Order →"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Order Summary (Only shown in Step 2: Order Review & Confirmation) */}
        {step === "review" && (
          <div className="vahn-checkout-sidebar">
            <div style={{ padding: "16px 22px", borderBottom: "1px solid #e5e5e5", display: "flex", alignItems: "center", gap: 9 }}>
              <ShoppingBagIcon size={16} color="#000" />
              <h3 style={{ fontSize: "0.82rem", fontWeight: 900, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Order Summary
              </h3>
            </div>

            {/* Item thumbnails strip */}
            {cartLines.length > 0 && (
              <div style={{ padding: "14px 22px", display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid #f3f4f6" }}>
                {cartLines.slice(0, 4).map(line => (
                  <div key={line.id} style={{ position: "relative" }}>
                    {line.merchandise.product.featuredImage ? (
                      <Image
                        src={line.merchandise.product.featuredImage.url}
                        alt={line.merchandise.product.title}
                        width={48} height={48}
                        style={{ objectFit: "cover", border: "1px solid #e5e5e5" }}
                      />
                    ) : (
                      <div style={{ width: 48, height: 48, background: "#f3f4f6", border: "1px solid #e5e5e5" }} />
                    )}
                    {line.quantity > 1 && (
                      <span style={{
                        position: "absolute", top: -6, right: -6,
                        background: "#000", color: "#fff", fontSize: "0.6rem",
                        fontWeight: 900, width: 16, height: 16, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        {line.quantity}
                      </span>
                    )}
                  </div>
                ))}
                {cartLines.length > 4 && (
                  <div style={{ width: 48, height: 48, background: "#f3f4f6", border: "1px solid #e5e5e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 900, color: "#666" }}>
                    +{cartLines.length - 4}
                  </div>
                )}
              </div>
            )}

            {/* Price breakdown */}
            <div style={{ padding: "18px 22px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: "0.875rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#555" }}>Subtotal</span>
                  <span style={{ fontWeight: 800, color: "#000" }}>₹{subtotal.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#555" }}>Shipping</span>
                  <span>
                    {shippingFee === 0
                      ? <strong style={{ color: "#16a34a", fontWeight: 800 }}>FREE</strong>
                      : <span style={{ fontWeight: 700 }}>₹{shippingFee}</span>
                    }
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#888", fontSize: "0.8rem" }}>
                  <span>Est. GST (12% incl.)</span>
                  <span>₹{estimatedTax.toLocaleString()}</span>
                </div>
              </div>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "2px solid #000", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#555" }}>Total Payable</div>
                  <div style={{ fontSize: "0.72rem", color: "#999", marginTop: 2 }}>Incl. taxes & shipping</div>
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#000" }}>
                  ₹{grandTotal.toLocaleString()}
                </div>
              </div>

              {/* Free shipping progress */}
              {subtotal < 1999 && subtotal > 0 && (
                <div style={{ marginTop: 14, background: "#f8fafc", border: "1px solid #e5e5e5", padding: 12 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#555", marginBottom: 6 }}>
                    Add ₹{(1999 - subtotal).toLocaleString()} more for <strong style={{ color: "#000" }}>FREE shipping</strong>
                  </div>
                  <div style={{ height: 4, background: "#e5e5e5", width: "100%" }}>
                    <div style={{ height: 4, background: "#000", width: `${Math.min((subtotal / 1999) * 100, 100)}%`, transition: "width 0.4s" }} />
                  </div>
                </div>
              )}
            </div>

            {/* Security note */}
            <div style={{ margin: "0 22px 22px", background: "#f8fafc", border: "1px solid #e5e5e5", padding: "10px 14px", display: "flex", gap: 8, alignItems: "center" }}>
              <ShieldCheckIcon size={16} color="#555" />
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                256-bit Encrypted & Secure
              </span>
            </div>
          </div>
        )}
      </div>

      {token && (
        <AddressModal
          token={token}
          isOpen={showAddressModal}
          onClose={() => setShowAddressModal(false)}
          onSuccess={(newAddr) => {
            loadAddresses();
            setSelectedAddressId(newAddr.id);
          }}
        />
      )}
    </div>
  );
}
