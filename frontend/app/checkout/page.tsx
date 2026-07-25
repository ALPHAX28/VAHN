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
  CheckIcon,
  AlertCircleIcon
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

  // Calculate pricing
  const cartLines = cart?.lines.edges.map(e => e.node) || [];
  const subtotal = cartLines.reduce((sum, line) => sum + (parseFloat(line.merchandise.price.amount) * line.quantity), 0);
  const shippingFee = subtotal >= 1999 || subtotal === 0 ? 0 : 99;
  const estimatedTax = Math.round(subtotal * 0.12);
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
      <div style={{ maxWidth: 800, margin: "80px auto", padding: 24, color: "#000000", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 900, textTransform: "uppercase" }}>Please Sign In to Complete Checkout</h2>
        <p style={{ color: "#555555", marginTop: 8 }}>Log in to access your saved delivery addresses & order history.</p>
        <Link href="/account/login" style={{ display: "inline-block", background: "#000000", color: "#ffffff", padding: "12px 28px", borderRadius: 0, fontWeight: 900, marginTop: 16, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Sign In Now →
        </Link>
      </div>
    );
  }

  if (!cartLines.length && step === "address") {
    return (
      <div style={{ maxWidth: 800, margin: "80px auto", padding: 24, color: "#000000", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 900, textTransform: "uppercase" }}>Your Cart is Empty</h2>
        <p style={{ color: "#555555", marginTop: 8 }}>Add products to your cart before checking out.</p>
        <Link href="/collections/vahn-beginning" style={{ display: "inline-block", background: "#000000", color: "#ffffff", padding: "12px 28px", borderRadius: 0, fontWeight: 900, marginTop: 16, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Explore Collection →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px", color: "#000000" }}>
      {/* Checkout Header Timeline Stepper */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36, borderBottom: "2px solid #000000", paddingBottom: 20, flexWrap: "wrap", gap: 16 }}>
        <div>
          <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#666666", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            VAHN ENTERPRISE CHECKOUT
          </span>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 900, margin: "4px 0 0", textTransform: "uppercase", letterSpacing: "-0.01em" }}>
            {step === "address" ? "Select Delivery Address" : "Order Summary & Confirmation"}
          </h1>
        </div>

        {/* Steps indicator */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setStep("address")}
            style={{
              background: step === "address" ? "#000000" : "#ffffff",
              color: step === "address" ? "#ffffff" : "#000000",
              border: "1px solid #000000",
              padding: "8px 16px", borderRadius: 0, fontSize: "0.8rem", fontWeight: 900, cursor: "pointer",
              textTransform: "uppercase", letterSpacing: "0.05em"
            }}
          >
            1. Address
          </button>
          <span style={{ color: "#000000", fontWeight: 900 }}>→</span>
          <span style={{
            background: step === "review" ? "#000000" : "#f1f5f9",
            color: step === "review" ? "#ffffff" : "#64748b",
            border: "1px solid #000000",
            padding: "8px 16px", borderRadius: 0, fontSize: "0.8rem", fontWeight: 900,
            textTransform: "uppercase", letterSpacing: "0.05em"
          }}>
            2. Review & Pay
          </span>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #dc2626", color: "#dc2626", padding: "14px 18px", borderRadius: 0, fontSize: "0.88rem", marginBottom: 28, display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
          <AlertCircleIcon size={18} color="#dc2626" />
          <span>{error}</span>
        </div>
      )}

      <div className="vahn-checkout-grid" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 32, alignItems: "start" }}>
        {/* Main Content Area */}
        <div>
          {step === "address" ? (
            <form onSubmit={handleProceedToReview}>
              <div style={{ background: "#ffffff", border: "2px solid #000000", borderRadius: 0, padding: 28 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 900, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", color: "#000000" }}>
                    Select Shipping Location
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddressModal(true)}
                    style={{
                      background: "#000000", color: "#ffffff", border: "none",
                      padding: "10px 18px", borderRadius: 0, fontSize: "0.8rem", fontWeight: 900,
                      cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em"
                    }}
                  >
                    + Add New Address
                  </button>
                </div>

                {loadingAddresses ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#666666", fontWeight: 600 }}>Loading saved addresses...</div>
                ) : addresses.length === 0 ? (
                  <div style={{ border: "1px solid #000000", padding: 36, textAlign: "center", background: "#f8fafc" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                      <MapPinIcon size={32} color="#000000" />
                    </div>
                    <h4 style={{ fontSize: "1.1rem", fontWeight: 900, margin: "0 0 6px", textTransform: "uppercase" }}>No Saved Delivery Addresses</h4>
                    <p style={{ fontSize: "0.88rem", color: "#555555", margin: "0 0 20px" }}>Please add an Indian delivery address to proceed with checkout.</p>
                    <button
                      type="button"
                      onClick={() => setShowAddressModal(true)}
                      style={{ background: "#000000", color: "#ffffff", border: "none", padding: "12px 24px", borderRadius: 0, fontWeight: 900, fontSize: "0.85rem", cursor: "pointer", textTransform: "uppercase" }}
                    >
                      + Add Delivery Address Now
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {addresses.map(addr => {
                      const isSelected = selectedAddressId === addr.id;
                      return (
                        <div
                          key={addr.id}
                          onClick={() => setSelectedAddressId(addr.id)}
                          style={{
                            background: isSelected ? "#ffffff" : "#f8fafc",
                            border: isSelected ? "2px solid #000000" : "1px solid #e5e5e5",
                            borderRadius: 0, padding: 20, cursor: "pointer", transition: "all 0.2s ease",
                            display: "flex", gap: 16, alignItems: "flex-start"
                          }}
                        >
                          <div style={{
                            width: 22, height: 22, border: isSelected ? "6px solid #000000" : "2px solid #94a3b8",
                            borderRadius: "50%", marginTop: 2, background: "#ffffff", flexShrink: 0
                          }} />

                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: "1.05rem", fontWeight: 900, color: "#000000" }}>{addr.first_name} {addr.last_name}</span>
                              <span style={{
                                background: "#000000", color: "#ffffff", padding: "3px 8px",
                                borderRadius: 0, fontSize: "0.68rem", fontWeight: 900, textTransform: "uppercase",
                                display: "inline-flex", alignItems: "center", gap: 4
                              }}>
                                {addr.label === "Home" ? <HomeIcon size={10} color="#fff" /> : addr.label === "Work" || addr.label === "Office" ? <BriefcaseIcon size={10} color="#fff" /> : <MapPinIcon size={10} color="#fff" />}
                                {addr.label}
                              </span>
                              {addr.is_default && (
                                <span style={{ background: "#f1f5f9", border: "1px solid #000000", color: "#000000", padding: "2px 6px", fontSize: "0.65rem", fontWeight: 900 }}>
                                  DEFAULT
                                </span>
                              )}
                            </div>

                            <p style={{ fontSize: "0.88rem", color: "#333333", margin: "0 0 4px", lineHeight: 1.5 }}>
                              {addr.street_address}{addr.apartment ? `, ${addr.apartment}` : ""}
                            </p>
                            <p style={{ fontSize: "0.85rem", color: "#555555", margin: 0 }}>
                              {addr.city}, {addr.state} — <strong style={{ color: "#000000" }}>{addr.pincode}</strong> | <PhoneIcon size={12} color="#666" /> {addr.phone}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  disabled={!selectedAddressId || addresses.length === 0}
                  style={{
                    background: selectedAddressId && addresses.length > 0 ? "#000000" : "#ccc",
                    color: "#ffffff", border: "none", padding: "16px 32px", borderRadius: 0,
                    fontWeight: 900, fontSize: "0.95rem", cursor: selectedAddressId && addresses.length > 0 ? "pointer" : "not-allowed",
                    textTransform: "uppercase", letterSpacing: "0.05em"
                  }}
                >
                  Continue to Order Review →
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: REVIEW & PAY */
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Selected Address Card */}
              <div style={{ background: "#ffffff", border: "2px solid #000000", borderRadius: 0, padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <MapPinIcon size={18} color="#000000" />
                    <h3 style={{ fontSize: "0.9rem", fontWeight: 900, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", color: "#000000" }}>
                      Delivery Address
                    </h3>
                  </div>
                  <button
                    onClick={() => setStep("address")}
                    style={{ background: "none", border: "none", color: "#000000", fontSize: "0.85rem", fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}
                  >
                    Edit Address
                  </button>
                </div>

                {selectedAddr && (
                  <div>
                    <div style={{ fontWeight: 900, fontSize: "1.05rem", color: "#000000" }}>
                      {selectedAddr.first_name} {selectedAddr.last_name}
                      <span style={{ background: "#000000", color: "#ffffff", padding: "3px 8px", borderRadius: 0, fontSize: "0.68rem", fontWeight: 900, marginLeft: 10, textTransform: "uppercase" }}>
                        {selectedAddr.label}
                      </span>
                    </div>
                    <div style={{ color: "#333333", fontSize: "0.9rem", marginTop: 6 }}>
                      {selectedAddr.street_address}{selectedAddr.apartment ? `, ${selectedAddr.apartment}` : ""}
                    </div>
                    <div style={{ color: "#555555", fontSize: "0.88rem", marginTop: 2 }}>
                      {selectedAddr.city}, {selectedAddr.state} — <strong>{selectedAddr.pincode}</strong> | India
                    </div>
                    <div style={{ color: "#666666", fontSize: "0.85rem", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      <PhoneIcon size={14} color="#666666" /> <span>{selectedAddr.phone}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Items List Breakdown */}
              <div style={{ background: "#ffffff", border: "2px solid #000000", borderRadius: 0, padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                  <ShoppingBagIcon size={18} color="#000000" />
                  <h3 style={{ fontSize: "0.9rem", fontWeight: 900, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", color: "#000000" }}>
                    Ordered Items ({cartLines.length})
                  </h3>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {cartLines.map(line => {
                    const price = parseFloat(line.merchandise.price.amount);
                    return (
                      <div key={line.id} style={{ display: "flex", gap: 16, alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: 16 }}>
                        {line.merchandise.product.featuredImage ? (
                          <Image src={line.merchandise.product.featuredImage.url} alt={line.merchandise.product.title} width={64} height={64} style={{ borderRadius: 0, objectFit: "cover", border: "1px solid #eee" }} />
                        ) : (
                          <div style={{ width: 64, height: 64, background: "#f8fafc", borderRadius: 0, border: "1px solid #eee" }} />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 900, fontSize: "1rem", color: "#000000" }}>{line.merchandise.product.title}</div>
                          <div style={{ fontSize: "0.85rem", color: "#555555", marginTop: 2 }}>
                            Variant: {line.merchandise.title} | Qty: <strong>{line.quantity}</strong>
                          </div>
                        </div>
                        <div style={{ fontWeight: 900, fontSize: "1.05rem", color: "#000000" }}>
                          ₹{(price * line.quantity).toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", gap: 14 }}>
                <button
                  type="button"
                  onClick={() => setStep("address")}
                  style={{ background: "#ffffff", border: "1px solid #000000", color: "#000000", padding: "14px 22px", borderRadius: 0, fontWeight: 900, fontSize: "0.85rem", cursor: "pointer", textTransform: "uppercase" }}
                >
                  ← Back to Address
                </button>
                <button
                  type="button"
                  disabled={placingOrder}
                  onClick={handleConfirmOrder}
                  style={{
                    flex: 1, background: "#000000", color: "#ffffff", border: "none",
                    padding: "16px 28px", borderRadius: 0, fontWeight: 900, fontSize: "0.95rem",
                    cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em"
                  }}
                >
                  {placingOrder ? "Placing Order..." : "Confirm & Place Order →"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar Order Pricing Breakdown Card */}
        <div style={{ background: "#ffffff", border: "2px solid #000000", borderRadius: 0, padding: 28, position: "sticky", top: 100 }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 900, margin: "0 0 20px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#000000" }}>
            Order Summary
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: "0.88rem", borderBottom: "1px solid #eee", paddingBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#333333" }}>
              <span>Items Subtotal</span>
              <span style={{ fontWeight: 800, color: "#000000" }}>₹{subtotal.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#333333" }}>
              <span>Shipping (India)</span>
              <span>{shippingFee === 0 ? <strong style={{ color: "#16a34a" }}>FREE</strong> : `₹${shippingFee}`}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#666666", fontSize: "0.82rem" }}>
              <span>Estimated GST (12% Included)</span>
              <span>₹{estimatedTax.toLocaleString()}</span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 4 }}>
            <div>
              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#000000", textTransform: "uppercase" }}>Total Payable</div>
              <div style={{ fontSize: "0.75rem", color: "#666666" }}>Includes taxes & express shipping</div>
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#000000" }}>
              ₹{grandTotal.toLocaleString()}
            </div>
          </div>

          <div style={{ marginTop: 24, background: "#f8fafc", border: "1px solid #000000", borderRadius: 0, padding: 14, fontSize: "0.78rem", color: "#000000", display: "flex", gap: 10, alignItems: "center" }}>
            <ShieldCheckIcon size={18} color="#000000" />
            <span style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.02em" }}>256-Bit Encrypted Enterprise Checkout</span>
          </div>
        </div>
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
