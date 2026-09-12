"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import {
  getUserAddresses,
  checkShippingServiceability,
  createRazorpayOrder,
  verifyRazorpayPayment,
  createMagicCheckoutOrder,
  recordRazorpayPaymentFailure,
} from "@/lib/api";
import type { UserAddress, ServiceabilityResponse } from "@/lib/api/types";
import AddressModal from "@/components/address/AddressModal";
import {
  MapPinIcon,
  ShoppingBagIcon,
  ShieldCheckIcon,
  PhoneIcon,
  HomeIcon,
  BriefcaseIcon,
  AlertCircleIcon,
  CheckIcon,
  TruckIcon,
  EditIcon,
} from "@/components/icons/Icons";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CheckoutPage() {
  const { user, token, openAuthModal } = useAuth();
  const { cart, clearCart } = useCart();
  const router = useRouter();

  // Logged-in address state
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);

  // Guest address state
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestStreet, setGuestStreet] = useState("");
  const [guestApartment, setGuestApartment] = useState("");
  const [guestCity, setGuestCity] = useState("");
  const [guestState, setGuestState] = useState("");
  const [guestPincode, setGuestPincode] = useState("");
  const [showManualAddress, setShowManualAddress] = useState(false);

  // Serviceability check state
  const [serviceability, setServiceability] = useState<ServiceabilityResponse | null>(null);
  const [checkingPincode, setCheckingPincode] = useState(false);

  // Process & Error states
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");
  const [rzpLoaded, setRzpLoaded] = useState(false);

  // Load Razorpay Magic Checkout SDK
  useEffect(() => {
    if (typeof window !== "undefined") {
      const existingScript = document.querySelector('script[src*="razorpay.com"]');
      if (!existingScript || !existingScript.getAttribute("src")?.includes("magic-checkout.js")) {
        if (existingScript) existingScript.remove();
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/magic-checkout.js";
        script.async = true;
        script.onload = () => setRzpLoaded(true);
        document.body.appendChild(script);
      } else {
        setRzpLoaded(true);
      }
    }
  }, []);

  // Load addresses if logged in
  useEffect(() => {
    if (token) {
      loadAddresses();
    }
  }, [token]);

  async function loadAddresses() {
    if (!token) return;
    setLoadingAddresses(true);
    try {
      const data = await getUserAddresses(token);
      setAddresses(data);
      if (data.length > 0) {
        const defaultAddr = data.find((a) => a.is_default) || data[0];
        setSelectedAddressId(defaultAddr.id);
        handleCheckPincode(defaultAddr.pincode);
      }
    } catch {
      // Ignored
    } finally {
      setLoadingAddresses(false);
    }
  }

  // Live Pincode Serviceability Check
  async function handleCheckPincode(pin: string) {
    const cleanPin = pin.trim();
    if (cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
      setServiceability(null);
      return;
    }
    setCheckingPincode(true);
    try {
      const res = await checkShippingServiceability(cleanPin);
      setServiceability(res);
    } catch {
      setServiceability({
        pincode: cleanPin,
        serviceable: true,
        courier_name: "Standard Express Delivery",
        estimated_delivery_days: 4,
        shipping_rate: 0,
        cod_available: false,
      });
    } finally {
      setCheckingPincode(false);
    }
  }

  // Calculate pricing
  const cartLines = cart?.lines.edges.map((e) => e.node) || [];
  const subtotal = cartLines.reduce(
    (sum, line) => sum + parseFloat(line.merchandise.price.amount) * line.quantity,
    0
  );
  const customShippingRate = cartLines.reduce((max, line) => {
    const rate = line.merchandise.product.shippingRate;
    return rate != null ? Math.max(max, rate) : max;
  }, -1);
  const shippingFee =
    customShippingRate >= 0
      ? customShippingRate
      : subtotal >= 1999 || subtotal === 0
      ? 0
      : 99;

  const estimatedTax = Math.round(
    cartLines.reduce((taxSum, line) => {
      const price = parseFloat(line.merchandise.price.amount);
      const lineTotal = price * line.quantity;
      const gstPct = line.merchandise.product.gstPercent ?? 12;
      return taxSum + lineTotal * (gstPct / (100 + gstPct));
    }, 0)
  );

  const grandTotal = subtotal + shippingFee;
  const selectedAddr = addresses.find((a) => a.id === selectedAddressId);

  // Trigger Razorpay Checkout
  async function handleInitiatePayment() {
    setError("");

    if (!cart?.id || cartLines.length === 0) {
      setError("Your cart is empty. Please add items before checking out.");
      return;
    }

    // Validation
    let shippingPayload: any = null;
    let customerName = "";
    let customerEmail = "";
    let customerPhone = "";

    if (user && token) {
      if (!selectedAddressId || !selectedAddr) {
        setError("Please select a delivery address.");
        return;
      }
      customerName = `${selectedAddr.first_name} ${selectedAddr.last_name}`.trim() || user.full_name;
      customerEmail = selectedAddr.email || user.email || "";
      customerPhone = selectedAddr.phone || user.phone || "";
      shippingPayload = {
        name: customerName,
        phone: customerPhone,
        address: `${selectedAddr.house_flat_no || ""} ${selectedAddr.street_address}`.trim(),
        apartment: selectedAddr.apartment || selectedAddr.building_name || "",
        city: selectedAddr.city,
        state: selectedAddr.state,
        pincode: selectedAddr.pincode,
        country: selectedAddr.country || "India",
      };
    } else {
      // Guest Magic Checkout flow:
      // Contact & address are handled seamlessly by Razorpay Magic Checkout (OPC)
      customerName = guestName.trim();
      customerEmail = guestEmail.trim();
      customerPhone = guestPhone.trim();

      if (guestStreet.trim() || guestPincode.trim()) {
        shippingPayload = {
          name: customerName || "Athlete",
          email: customerEmail || undefined,
          phone: customerPhone || undefined,
          address: `${guestApartment ? guestApartment + ", " : ""}${guestStreet}`.trim(),
          city: guestCity.trim() || undefined,
          state: guestState.trim() || undefined,
          pincode: guestPincode.trim() || undefined,
          country: "India",
        };
      }
    }

    setPlacingOrder(true);

    try {
      // 1. Create Razorpay order on backend
      const rzpOrder = await createRazorpayOrder(
        {
          cart_id: cart.id,
          address_id: selectedAddressId || undefined,
          shipping_address: shippingPayload,
        },
        token || undefined
      );

      // Check if window.Razorpay is loaded
      if (typeof window.Razorpay === "undefined") {
        throw new Error("Razorpay gateway is initializing. Please try again in a few moments.");
      }

      // 2. Open Razorpay Magic Checkout modal
      const options = {
        key: rzpOrder.key_id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency || "INR",
        name: "VAHN Sports",
        description: `Order Payment (${cartLines.length} item${cartLines.length > 1 ? "s" : ""})`,
        image: "https://vahn.s3.ap-south-2.amazonaws.com/logo.png",
        order_id: rzpOrder.razorpay_order_id,
        one_click_checkout: true, // Crucial: Activates Razorpay Magic Checkout One Page Checkout (OPC)
        show_coupons: true,
        handler: async function (response: any) {
          try {
            let confirmedId = "";
            if (user && token) {
              const verifiedOrder = await verifyRazorpayPayment(
                {
                  cart_id: cart.id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  address_id: selectedAddressId || undefined,
                  shipping_address: shippingPayload,
                },
                token
              );
              confirmedId = (verifiedOrder as any)?.id || (verifiedOrder as any)?.order_id || (verifiedOrder as any)?.orderId || "";
            } else {
              // Guest checkout verification:
              // Backend fetches full customer contact & shipping address from Razorpay Magic Checkout order!
              const guestOrder = await createMagicCheckoutOrder({
                cart_id: cart.id,
                guest_name: customerName || undefined,
                guest_email: customerEmail || undefined,
                guest_phone: customerPhone || undefined,
                shipping_address: shippingPayload || undefined,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
              confirmedId = (guestOrder as any)?.id || (guestOrder as any)?.order_id || (guestOrder as any)?.orderId || "";
            }
            clearCart();
            if (confirmedId) {
              router.push(`/checkout/success?order_id=${confirmedId}`);
            } else {
              router.push("/checkout/success");
            }
          } catch (verifyErr: any) {
            const verifyMsg = verifyErr?.message || "Payment verification failed. Please contact VAHN support.";
            if (typeof document !== "undefined") {
              document.body.style.overflow = "auto";
              document.documentElement.style.overflow = "auto";
              document.querySelectorAll(".razorpay-container").forEach((el) => el.remove());
            }
            try {
              if (typeof recordRazorpayPaymentFailure === "function") {
                const failedOrder = await recordRazorpayPaymentFailure(
                  {
                    cart_id: cart.id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    error_description: verifyMsg,
                    customer_name: customerName || undefined,
                    customer_email: customerEmail || undefined,
                    customer_phone: customerPhone || undefined,
                    shipping_address: shippingPayload,
                  },
                  token || undefined
                );
                const failedOrderId = (failedOrder as any)?.id || (failedOrder as any)?.order_id || "";
                router.push(`/checkout/failed?order_id=${failedOrderId}&reason=${encodeURIComponent(verifyMsg)}`);
                return;
              }
            } catch {
              // Fallback to simple query string
            }
            router.push(`/checkout/failed?reason=${encodeURIComponent(verifyMsg)}`);
          } finally {
            setPlacingOrder(false);
          }
        },
        prefill: {
          name: customerName || undefined,
          email: customerEmail || undefined,
          contact: customerPhone ? (customerPhone.startsWith("+") ? customerPhone : `+91${customerPhone.replace(/\D/g, "")}`) : undefined,
        },
        notes: {
          cart_id: cart.id,
          store: "VAHN Sports Official",
        },
        theme: {
          color: "#4232d9",
        },
        modal: {
          ondismiss: function () {
            setPlacingOrder(false);
            if (typeof document !== "undefined") {
              document.body.style.overflow = "auto";
              document.documentElement.style.overflow = "auto";
              document.querySelectorAll(".razorpay-container").forEach((el) => el.remove());
            }
            setError("Payment was cancelled or closed. You can retry anytime — your cart items are preserved.");
          },
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on("payment.failed", async function (response: any) {
        // Immediately dismiss and tear down Razorpay's modal so our failure page is visible
        try {
          rzpInstance.close();
        } catch {
          // Ignore
        }
        if (typeof document !== "undefined") {
          document.body.style.overflow = "auto";
          document.documentElement.style.overflow = "auto";
          document.querySelectorAll(".razorpay-container").forEach((el) => el.remove());
        }

        const errorDesc =
          response?.error?.description || response?.error?.reason || "Transaction declined by bank.";
        const errorCode = response?.error?.code || "";
        const rzpOrderId = response?.error?.metadata?.order_id || rzpOrder.razorpay_order_id;
        const rzpPaymentId = response?.error?.metadata?.payment_id || "";

        try {
          if (typeof recordRazorpayPaymentFailure === "function") {
            const failedOrder = await recordRazorpayPaymentFailure(
              {
                cart_id: cart.id,
                razorpay_order_id: rzpOrderId,
                razorpay_payment_id: rzpPaymentId,
                error_code: errorCode,
                error_description: errorDesc,
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone,
                shipping_address: shippingPayload,
              },
              token || undefined
            );
            const failedOrderId = (failedOrder as any)?.id || (failedOrder as any)?.order_id || "";
            router.push(`/checkout/failed?order_id=${failedOrderId}&reason=${encodeURIComponent(errorDesc)}`);
            return;
          }
        } catch (recErr) {
          console.error("Could not record failure order:", recErr);
        }
        router.push(`/checkout/failed?reason=${encodeURIComponent(errorDesc)}`);
        setPlacingOrder(false);
      });
      rzpInstance.open();
    } catch (err: any) {
      setError(err?.message || "Failed to initiate payment. Please try again.");
      setPlacingOrder(false);
    }
  }

  if (!cartLines.length) {
    return (
      <div style={{ maxWidth: 560, margin: "100px auto", padding: "0 24px", textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            background: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            borderRadius: "0px",
          }}
        >
          <ShoppingBagIcon size={28} color="#fff" />
        </div>
        <h2
          style={{
            fontSize: "1.4rem",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-0.025em",
            margin: "0 0 10px",
            fontFamily: "var(--font-ui)",
          }}
        >
          Your Cart is Empty
        </h2>
        <p style={{ color: "#666", fontSize: "0.9rem", margin: "0 0 24px" }}>
          Add high-performance gear to your cart before proceeding to checkout.
        </p>
        <Link
          href="/products"
          style={{
            display: "inline-block",
            background: "#4232d9",
            color: "#fff",
            padding: "14px 32px",
            fontWeight: 800,
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "-0.025em",
            fontSize: "0.85rem",
            borderRadius: "0px",
          }}
        >
          Explore Collection →
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "40px auto 100px",
        padding: "0 24px",
        fontFamily: "var(--font-ui)",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "2px solid #000",
          paddingBottom: "16px",
          marginBottom: "36px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "-0.03em",
              margin: 0,
            }}
          >
            Secure Checkout
          </h1>
          <p style={{ color: "#666", fontSize: "0.85rem", margin: "4px 0 0" }}>
            100% Secure Prepaid Payment • Shiprocket Automated Logistics
          </p>
        </div>
        {!user && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem" }}>
            <span style={{ color: "#666" }}>Returning Athlete?</span>
            <button
              onClick={() => openAuthModal()}
              style={{
                background: "none",
                border: "none",
                color: "#4232d9",
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
              }}
            >
              Sign In for Saved Addresses
            </button>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            background: "#fff5f5",
            border: "1px solid #ff4d4f",
            borderRadius: "0px",
            padding: "16px 20px",
            marginBottom: "28px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <AlertCircleIcon size={20} color="#ff4d4f" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#cf1322", fontSize: "0.9rem" }}>Payment Alert</div>
            <div style={{ fontSize: "0.85rem", color: "#434343", marginTop: "2px" }}>{error}</div>
          </div>
          <button
            onClick={() => setError("")}
            style={{
              background: "none",
              border: "none",
              color: "#999",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "40px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Shipping & Payment */}
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {/* 1. Delivery Details Section */}
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "0px",
              padding: "24px",
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                borderBottom: "1px solid #f0f0f0",
                paddingBottom: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <MapPinIcon size={20} color="#000" />
                <h2
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "-0.02em",
                    margin: 0,
                  }}
                >
                  Delivery Address
                </h2>
              </div>
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAddress(null);
                    setShowAddressModal(true);
                  }}
                  style={{
                    background: "#000",
                    color: "#fff",
                    border: "none",
                    padding: "6px 14px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    cursor: "pointer",
                    borderRadius: "0px",
                  }}
                >
                  + Add New Address
                </button>
              )}
            </div>

            {/* If Logged In: Show Address Selector */}
            {user ? (
              loadingAddresses ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
                  Loading saved addresses...
                </div>
              ) : addresses.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center" }}>
                  <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "16px" }}>
                    No saved addresses found. Add an address to proceed.
                  </p>
                  <button
                    onClick={() => {
                      setEditingAddress(null);
                      setShowAddressModal(true);
                    }}
                    style={{
                      background: "#4232d9",
                      color: "#fff",
                      border: "none",
                      padding: "10px 24px",
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      cursor: "pointer",
                      borderRadius: "0px",
                    }}
                  >
                    Add Delivery Address
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {addresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id;
                    return (
                      <div
                        key={addr.id}
                        onClick={() => {
                          setSelectedAddressId(addr.id);
                          handleCheckPincode(addr.pincode);
                        }}
                        style={{
                          border: isSelected ? "2px solid #4232d9" : "1px solid #e0e0e0",
                          background: isSelected ? "rgba(66, 50, 217, 0.03)" : "#fff",
                          borderRadius: "0px",
                          padding: "16px",
                          cursor: "pointer",
                          transition: "border 0.2s ease",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "6px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                              type="radio"
                              name="selected_address"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedAddressId(addr.id);
                                handleCheckPincode(addr.pincode);
                              }}
                              style={{ accentColor: "#4232d9", cursor: "pointer" }}
                            />
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: "0.9rem",
                                textTransform: "uppercase",
                              }}
                            >
                              {addr.first_name} {addr.last_name}
                            </span>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                background: "#f0f0f0",
                                padding: "2px 6px",
                                textTransform: "uppercase",
                              }}
                            >
                              {addr.label || "HOME"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingAddress(addr);
                              setShowAddressModal(true);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#666",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              textDecoration: "underline",
                            }}
                          >
                            Edit
                          </button>
                        </div>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "#444",
                            lineHeight: 1.5,
                            marginLeft: "24px",
                          }}
                        >
                          {addr.house_flat_no ? `${addr.house_flat_no}, ` : ""}
                          {addr.street_address}
                          {addr.apartment ? `, ${addr.apartment}` : ""}
                          <br />
                          {addr.city}, {addr.state} - <strong>{addr.pincode}</strong>
                          <br />
                          <span style={{ color: "#777" }}>Phone: {addr.phone}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Guest Magic Checkout Experience */
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* 1-Click Magic Checkout Banner */}
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(66, 50, 217, 0.06) 0%, rgba(66, 50, 217, 0.01) 100%)",
                    border: "1.5px solid #4232d9",
                    padding: "20px",
                    borderRadius: "0px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "8px",
                      marginBottom: "10px",
                    }}
                  >
                    <span
                      style={{
                        background: "#4232d9",
                        color: "#fff",
                        fontSize: "0.7rem",
                        fontWeight: 900,
                        textTransform: "uppercase",
                        padding: "3px 8px",
                        letterSpacing: "0.05em",
                      }}
                    >
                      ⚡ Razorpay Magic Checkout • 1-Click OPC
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#555", fontWeight: 600 }}>
                      No typing or account creation needed
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "-0.02em",
                      margin: "0 0 6px",
                      color: "#000",
                    }}
                  >
                    Instant 1-Click Delivery & Payment
                  </h3>

                  <p style={{ fontSize: "0.82rem", color: "#555", margin: "0 0 16px", lineHeight: 1.5 }}>
                    Your saved delivery addresses and payment methods from Razorpay&apos;s 100M+ buyer network
                    will be securely loaded inside the checkout modal.
                  </p>

                  {/* Optional mobile prefill */}
                  <div style={{ marginBottom: "16px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        marginBottom: "6px",
                        color: "#333",
                      }}
                    >
                      Mobile Number (Optional — to auto-load saved addresses)
                    </label>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span
                        style={{
                          background: "#eee",
                          padding: "10px 12px",
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          border: "1px solid #ccc",
                          borderRight: "none",
                        }}
                      >
                        +91
                      </span>
                      <input
                        type="tel"
                        placeholder="10-digit mobile number"
                        value={guestPhone}
                        maxLength={10}
                        onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, ""))}
                        style={{
                          flex: 1,
                          padding: "10px 12px",
                          border: "1px solid #ccc",
                          fontSize: "0.9rem",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>

                  {/* 1-Click Buy Button */}
                  <button
                    type="button"
                    onClick={handleInitiatePayment}
                    disabled={placingOrder}
                    style={{
                      width: "100%",
                      background: placingOrder ? "#666" : "#4232d9",
                      color: "#fff",
                      border: "none",
                      padding: "14px",
                      fontSize: "0.9rem",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "-0.02em",
                      cursor: placingOrder ? "not-allowed" : "pointer",
                      borderRadius: "0px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      transition: "background 0.2s ease",
                    }}
                  >
                    {placingOrder ? (
                      <span>Opening Magic Checkout...</span>
                    ) : (
                      <span>⚡ Proceed with Magic 1-Click Checkout →</span>
                    )}
                  </button>

                  <div style={{ textAlign: "center", marginTop: "12px" }}>
                    <button
                      type="button"
                      onClick={() => setShowManualAddress(!showManualAddress)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#4232d9",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        textDecoration: "underline",
                        padding: 0,
                      }}
                    >
                      {showManualAddress
                        ? "▲ Hide manual address form"
                        : "▼ Or enter delivery address manually on this page"}
                    </button>
                  </div>
                </div>

                {/* Collapsible Manual Address Form */}
                {showManualAddress && (
                  <div
                    style={{
                      background: "#fafafa",
                      border: "1px solid #e0e0e0",
                      padding: "18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    <div style={{ fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", color: "#333" }}>
                      Manual Delivery Address
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            marginBottom: "4px",
                          }}
                        >
                          Full Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Rahul Sharma"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            border: "1px solid #ccc",
                            borderRadius: "0px",
                            fontSize: "0.9rem",
                            outline: "none",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            marginBottom: "4px",
                          }}
                        >
                          Email Address
                        </label>
                        <input
                          type="email"
                          placeholder="order.updates@example.com"
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            border: "1px solid #ccc",
                            borderRadius: "0px",
                            fontSize: "0.9rem",
                            outline: "none",
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          marginBottom: "4px",
                        }}
                      >
                        Flat / House No / Building Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Flat 402, Tower B"
                        value={guestApartment}
                        onChange={(e) => setGuestApartment(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid #ccc",
                          borderRadius: "0px",
                          fontSize: "0.9rem",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          marginBottom: "4px",
                        }}
                      >
                        Street Address & Locality
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 100 Feet Road, Indiranagar"
                        value={guestStreet}
                        onChange={(e) => setGuestStreet(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid #ccc",
                          borderRadius: "0px",
                          fontSize: "0.9rem",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            marginBottom: "4px",
                          }}
                        >
                          PIN Code
                        </label>
                        <input
                          type="text"
                          placeholder="6 Digits"
                          maxLength={6}
                          value={guestPincode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            setGuestPincode(val);
                            if (val.length === 6) {
                              handleCheckPincode(val);
                            }
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            border: "1px solid #ccc",
                            borderRadius: "0px",
                            fontSize: "0.9rem",
                            outline: "none",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            marginBottom: "4px",
                          }}
                        >
                          City
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Bengaluru"
                          value={guestCity}
                          onChange={(e) => setGuestCity(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            border: "1px solid #ccc",
                            borderRadius: "0px",
                            fontSize: "0.9rem",
                            outline: "none",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            marginBottom: "4px",
                          }}
                        >
                          State
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Karnataka"
                          value={guestState}
                          onChange={(e) => setGuestState(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            border: "1px solid #ccc",
                            borderRadius: "0px",
                            fontSize: "0.9rem",
                            outline: "none",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pincode Serviceability Indicator */}
            <div style={{ marginTop: "16px" }}>
              {checkingPincode ? (
                <div style={{ fontSize: "0.8rem", color: "#666" }}>
                  Verifying courier serviceability with Shiprocket...
                </div>
              ) : serviceability ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    background: serviceability.serviceable ? "#f6ffed" : "#fffbe6",
                    border: `1px solid ${serviceability.serviceable ? "#b7eb8f" : "#ffe58f"}`,
                    fontSize: "0.8rem",
                    color: serviceability.serviceable ? "#389e0d" : "#d48806",
                    fontWeight: 600,
                  }}
                >
                  <TruckIcon size={16} />
                  <span>
                    {serviceability.serviceable
                      ? `✓ Delivery available by ${serviceability.courier_name || "Express Courier"} (Est. ${serviceability.estimated_delivery_days || 3-5} days)`
                      : "Delivery may require extra transit days to this PIN code"}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Pay CTA */}
        <div>
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "0px",
              padding: "24px",
              background: "#fff",
              position: "sticky",
              top: "100px",
            }}
          >
            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
                margin: "0 0 16px",
                borderBottom: "1px solid #f0f0f0",
                paddingBottom: "12px",
              }}
            >
              Order Summary ({cartLines.length} item{cartLines.length > 1 ? "s" : ""})
            </h2>

            {/* Cart Items list */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                maxHeight: "320px",
                overflowY: "auto",
                marginBottom: "20px",
                paddingRight: "4px",
              }}
            >
              {cartLines.map((line) => (
                <div
                  key={line.id}
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                    borderBottom: "1px solid #f5f5f5",
                    paddingBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: 54,
                      height: 54,
                      flexShrink: 0,
                      background: "#f7f7f7",
                      border: "1px solid #eee",
                    }}
                  >
                    {line.merchandise.product.featuredImage ? (
                      <Image
                        src={line.merchandise.product.featuredImage.url}
                        alt={line.merchandise.product.title}
                        fill
                        sizes="54px"
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.65rem",
                          color: "#999",
                        }}
                      >
                        VAHN
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {line.merchandise.product.title}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>
                      {line.merchandise.title !== "Default Title" ? line.merchandise.title : ""} • Qty:{" "}
                      {line.quantity}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                    ₹{(parseFloat(line.merchandise.price.amount) * line.quantity).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </div>

            {/* Calculations */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                fontSize: "0.85rem",
                color: "#555",
                borderBottom: "1px solid #f0f0f0",
                paddingBottom: "16px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal</span>
                <span>₹{subtotal.toLocaleString("en-IN")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Shipping</span>
                <span style={{ color: shippingFee === 0 ? "#52c41a" : "#000", fontWeight: 700 }}>
                  {shippingFee === 0 ? "FREE" : `₹${shippingFee.toLocaleString("en-IN")}`}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#888" }}>
                <span>Estimated GST Included</span>
                <span>₹{estimatedTax.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Total */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                fontWeight: 900,
                fontSize: "1.2rem",
                marginBottom: "24px",
              }}
            >
              <span style={{ textTransform: "uppercase" }}>Total</span>
              <span style={{ color: "#4232d9" }}>₹{grandTotal.toLocaleString("en-IN")}</span>
            </div>

            {/* Free Shipping Progress */}
            {subtotal < 1999 && (
              <div
                style={{
                  background: "#f9f9f9",
                  padding: "10px",
                  fontSize: "0.75rem",
                  color: "#666",
                  marginBottom: "20px",
                  textAlign: "center",
                }}
              >
                Add ₹{(1999 - subtotal).toLocaleString("en-IN")} more to unlock <strong>FREE SHIPPING</strong>
              </div>
            )}

            {/* Pay Button */}
            <button
              type="button"
              onClick={handleInitiatePayment}
              disabled={placingOrder}
              style={{
                width: "100%",
                background: placingOrder ? "#666" : "#4232d9",
                color: "#fff",
                border: "none",
                padding: "16px",
                fontSize: "0.95rem",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
                cursor: placingOrder ? "not-allowed" : "pointer",
                borderRadius: "0px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "background 0.2s ease",
              }}
            >
              {placingOrder ? (
                <span>Connecting to Gateway...</span>
              ) : (
                <span>⚡ Pay ₹{grandTotal.toLocaleString("en-IN")} via Magic Checkout →</span>
              )}
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                marginTop: "14px",
                fontSize: "0.74rem",
                color: "#555",
              }}
            >
              <ShieldCheckIcon size={15} color="#52c41a" />
              <span>256-Bit SSL Encrypted Razorpay Gateway</span>
            </div>

            <div
              style={{
                textAlign: "center",
                marginTop: "6px",
                fontSize: "0.7rem",
                color: "#888",
              }}
            >
              7-Day Returns • Automated Shiprocket Reverse Logistics
            </div>
          </div>
        </div>
      </div>

      {/* Address Modal (for logged-in users) */}
      {showAddressModal && token && (
        <AddressModal
          token={token}
          isOpen={showAddressModal}
          initialAddress={editingAddress}
          onClose={() => setShowAddressModal(false)}
          onSuccess={() => {
            setShowAddressModal(false);
            loadAddresses();
          }}
        />
      )}
    </div>
  );
}
