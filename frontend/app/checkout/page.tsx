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
  LockIcon,
  SparklesIcon,
  PackageIcon,
  UserIcon,
} from "@/components/icons/Icons";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CheckoutPage() {
  const { user, token, openAuthModal, loading: isAuthLoading } = useAuth();
  const { cart, clearCart } = useCart();
  const router = useRouter();

  // Logged-in address state
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);

  // Guest checkout state
  const [guestPincodeInput, setGuestPincodeInput] = useState("");

  // Serviceability check state
  const [serviceability, setServiceability] = useState<ServiceabilityResponse | null>(null);
  const [checkingPincode, setCheckingPincode] = useState(false);

  // Process & Error states
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");
  const [rzpLoaded, setRzpLoaded] = useState(false);



  // Load appropriate Razorpay SDK (magic-checkout.js for guests, checkout.js for logged in athletes)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isAuthLoading) return; // Wait for auth resolution to prevent loading guest SDK for logged-in users

    const isGuest = !user;
    const targetScriptSrc = isGuest
      ? "https://checkout.razorpay.com/v1/magic-checkout.js"
      : "https://checkout.razorpay.com/v1/checkout.js";

    const allScripts = Array.from(document.querySelectorAll<HTMLScriptElement>("script[src*='checkout.razorpay.com']"));
    const currentScript = allScripts.find((s) => s.src === targetScriptSrc);

    if (currentScript && window.Razorpay) {
      setRzpLoaded(true);
      return;
    }

    allScripts.forEach((s) => s.remove());
    try {
      delete (window as any).Razorpay;
    } catch {
      (window as any).Razorpay = undefined;
    }

    setRzpLoaded(false);
    const script = document.createElement("script");
    script.id = "rzp-checkout-script";
    script.src = targetScriptSrc;
    script.async = true;
    script.onload = () => {
      setRzpLoaded(true);
    };
    script.onerror = () => {
      console.warn("Primary SDK load failed, falling back to standard checkout.js");
      const fallbackScript = document.createElement("script");
      fallbackScript.id = "rzp-checkout-script";
      fallbackScript.src = "https://checkout.razorpay.com/v1/checkout.js";
      fallbackScript.async = true;
      fallbackScript.onload = () => setRzpLoaded(true);
      document.body.appendChild(fallbackScript);
    };
    document.body.appendChild(script);
  }, [user, isAuthLoading]);

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
    return rate != null && rate <= 500 ? Math.max(max, rate) : max;
  }, -1);
  const shippingFee =
    subtotal >= 1999 || subtotal === 0
      ? 0
      : customShippingRate >= 0
      ? customShippingRate
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
    if (placingOrder) return;
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
      // Guest: Razorpay Magic Checkout collects all contact & address details.
      // Backend fetches name, email, phone, and shipping address from the Razorpay
      // order/payment after the user completes payment — no local form needed.
      customerName = "";
      customerEmail = "";
      customerPhone = "";
      shippingPayload = null;
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

      const isGuest = !user;

      // 2. Open Razorpay modal
      const options: any = {
        key: rzpOrder.key_id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency || "INR",
        name: "VAHN Sports",
        description: `Order Payment (${cartLines.length} item${cartLines.length > 1 ? "s" : ""})`,
        image: "https://vahn.s3.ap-south-2.amazonaws.com/logo.png",
        order_id: rzpOrder.razorpay_order_id,
        one_click_checkout: isGuest, // True for guest (Razorpay Magic Checkout Gateway), False for logged-in athletes
        show_coupons: isGuest,
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
              // Guest checkout verification
              const guestOrder = await createMagicCheckoutOrder({
                cart_id: cart.id,
                guest_name: customerName,
                guest_email: customerEmail,
                guest_phone: customerPhone,
                shipping_address: shippingPayload,
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
              router.push("/account/orders");
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
                    customer_name: customerName,
                    customer_email: customerEmail,
                    customer_phone: customerPhone,
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
          contact: customerPhone || undefined,
        },
        notes: {
          cart_id: cart.id,
          is_guest: isGuest ? "true" : "false",
          customer_name: customerName || "Guest Athlete",
          customer_email: customerEmail || "",
          customer_phone: customerPhone || "",
          delivery_address: shippingPayload
            ? `${shippingPayload.address}, ${shippingPayload.city}, ${shippingPayload.state} - ${shippingPayload.pincode}`
            : "Collected via Razorpay Magic Checkout",
          store: "VAHN Sports Official",
        },
        theme: {
          color: "#4232d9",
        },
        modal: {
          confirm_close: true,
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
      className="checkout-container"
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
            100% Secure Prepaid Payment
          </p>
        </div>
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

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 980px) {
          .checkout-main-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
        }
        @media (max-width: 640px) {
          .checkout-container {
            margin: 20px auto 60px !important;
            padding: 0 14px !important;
          }
          .checkout-card {
            padding: 18px 14px !important;
          }
          .checkout-pincode-form {
            flex-direction: column !important;
            max-width: 100% !important;
          }
          .checkout-pincode-btn {
            width: 100% !important;
            padding: 12px !important;
          }
          .checkout-signin-strip {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
            padding: 14px !important;
          }
          .checkout-summary-card {
            position: static !important;
            top: auto !important;
            padding: 18px 14px !important;
          }
          .checkout-pay-btn {
            padding: 16px 14px !important;
            font-size: 0.88rem !important;
          }
        }
      `}</style>

      {/* Main Grid: Responsive 2-column layout on desktop (1fr 420px), single-column on mobile */}
      <div
        className="checkout-main-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 420px",
          gap: "36px",
          alignItems: "start",
        }}
      >
        {/* Left Column: Logged-in Address Manager OR Revamped Guest Checkout Hub */}
        {user ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* 1. Delivery Details Section */}
            <div
              className="checkout-card"
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
              </div>

              {/* Saved Address Selector */}
              {loadingAddresses ? (
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
              )}

              {/* Logged-In Pincode Serviceability Indicator */}
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
                        ? `Delivery available by ${serviceability.courier_name || "Express Courier"} (Est. ${serviceability.estimated_delivery_days || 3}–${Number(serviceability.estimated_delivery_days || 3) + 2} days)`
                        : "Delivery may require extra transit days to this PIN code"}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          /* Simple & Elegant Guest Checkout Details */
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Interactive Delivery Speed & PIN Code Estimator */}
            <div
              className="checkout-card"
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: "0px",
                padding: "24px",
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <TruckIcon size={18} color="#000" />
                <h3
                  style={{
                    fontSize: "1.05rem",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "-0.02em",
                    margin: 0,
                  }}
                >
                  Estimated Delivery Timeline
                </h3>
              </div>
              <p style={{ fontSize: "0.82rem", color: "#666", margin: "0 0 14px" }}>
                Check courier transit days and serviceability for your postal PIN code:
              </p>

              <div className="checkout-pincode-form" style={{ display: "flex", gap: "10px", maxWidth: "420px", marginBottom: "12px" }}>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit PIN code"
                  value={guestPincodeInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setGuestPincodeInput(val);
                    if (val.length === 6) {
                      handleCheckPincode(val);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    border: "1px solid #ccc",
                    fontSize: "0.9rem",
                    outline: "none",
                    borderRadius: "0px",
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleCheckPincode(guestPincodeInput)}
                  disabled={checkingPincode || guestPincodeInput.length !== 6}
                  className="checkout-pincode-btn"
                  style={{
                    background: guestPincodeInput.length === 6 ? "#000" : "#999",
                    color: "#fff",
                    border: "none",
                    padding: "10px 20px",
                    fontSize: "0.8rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                    cursor: guestPincodeInput.length === 6 ? "pointer" : "not-allowed",
                    borderRadius: "0px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {checkingPincode ? "Checking..." : "Check Delivery"}
                </button>
              </div>

              {/* Serviceability Result */}
              {checkingPincode ? (
                <div style={{ fontSize: "0.82rem", color: "#666", fontStyle: "italic" }}>
                  Checking Shiprocket courier coverage...
                </div>
              ) : serviceability ? (
                <div
                  style={{
                    padding: "12px 14px",
                    background: serviceability.serviceable ? "#f6ffed" : "#fffbe6",
                    border: `1px solid ${serviceability.serviceable ? "#b7eb8f" : "#ffe58f"}`,
                    fontSize: "0.82rem",
                    color: serviceability.serviceable ? "#237804" : "#d48806",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <CheckIcon size={16} color={serviceability.serviceable ? "#52c41a" : "#d48806"} />
                  <div>
                    <span style={{ fontWeight: 700 }}>
                      {serviceability.serviceable
                        ? `Delivery available to PIN ${serviceability.pincode} via ${serviceability.courier_name || "Express Courier"} (Est. ${serviceability.estimated_delivery_days || 3}–${Number(serviceability.estimated_delivery_days || 3) + 2} days)`
                        : `Delivery to PIN ${serviceability.pincode} may require extra transit days`}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* 3. Returning Athlete Sign-In Strip */}
            <div
              className="checkout-signin-strip"
              style={{
                border: "1px solid #e0e0e0",
                background: "#fafafa",
                padding: "14px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "0.82rem", color: "#555" }}>
                Already have a VAHN Athlete account?
              </span>
              <button
                type="button"
                onClick={() => openAuthModal()}
                style={{
                  background: "none",
                  border: "none",
                  color: "#4232d9",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                Sign In for Saved Addresses →
              </button>
            </div>
          </div>
        )}

        {/* Right Column: Order Summary & Pay CTA */}
        <div>
          <div
            className="checkout-card checkout-summary-card"
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

            {/* Free Shipping Progress Bar */}
            <div
              style={{
                background: subtotal >= 1999 ? "#f6ffed" : "#fbfbfe",
                border: `1px solid ${subtotal >= 1999 ? "#b7eb8f" : "#ecebf8"}`,
                padding: "14px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  marginBottom: "8px",
                  color: subtotal >= 1999 ? "#237804" : "#333",
                }}
              >
                <span>{subtotal >= 1999 ? "✓ Free Express Shipping Unlocked" : "Free Express Shipping"}</span>
                <span style={{ color: "#4232d9" }}>
                  {subtotal >= 1999 ? "FREE" : `₹${subtotal.toLocaleString("en-IN")} / ₹1,999`}
                </span>
              </div>
              <div
                style={{
                  height: "6px",
                  width: "100%",
                  background: "#e8e7f2",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, Math.round((subtotal / 1999) * 100))}%`,
                    background: subtotal >= 1999 ? "#52c41a" : "#4232d9",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <div style={{ fontSize: "0.73rem", color: "#666", marginTop: "7px", textAlign: "center" }}>
                {subtotal >= 1999 ? (
                  <span style={{ color: "#237804", fontWeight: 700 }}>
                    Your order qualifies for complimentary priority express shipping!
                  </span>
                ) : (
                  <>
                    Add <strong>₹{(1999 - subtotal).toLocaleString("en-IN")}</strong> more to unlock <strong>FREE SHIPPING</strong>
                  </>
                )}
              </div>
            </div>

            {/* Pay Button */}
            <button
              type="button"
              onClick={handleInitiatePayment}
              disabled={placingOrder}
              className="checkout-pay-btn"
              style={{
                width: "100%",
                background: placingOrder ? "#666" : "#4232d9",
                color: "#fff",
                border: "none",
                padding: "16px 20px",
                fontSize: "0.95rem",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.02em",
                cursor: placingOrder ? "not-allowed" : "pointer",
                borderRadius: "0px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                boxShadow: "0 4px 14px rgba(66, 50, 217, 0.25)",
                transition: "all 0.2s ease",
              }}
            >
              {placingOrder ? (
                <span>Connecting to Gateway...</span>
              ) : user ? (
                <span>Pay ₹{grandTotal.toLocaleString("en-IN")} via Razorpay →</span>
              ) : (
                <>
                  <SparklesIcon size={18} color="#fff" />
                  <span>Pay ₹{grandTotal.toLocaleString("en-IN")} with Magic Checkout</span>
                </>
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
              <span>
                {user
                  ? "256-Bit SSL Encrypted Razorpay Gateway (Cards, UPI, Netbanking)"
                  : "1-Click Razorpay Magic Checkout — SSL Encrypted"}
              </span>
            </div>

            {/* Trust badges */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "8px",
                marginTop: "14px",
              }}
            >
              {[
                { icon: <LockIcon size={14} color="#4232d9" />, label: "Secure Payment" },
                { icon: <TruckIcon size={14} color="#4232d9" />, label: "Pan India Shipping" },
                { icon: <PackageIcon size={14} color="#4232d9" />, label: "10-Day Returns" },
              ].map(({ icon, label }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "5px",
                    padding: "10px 6px",
                    background: "#f7f6ff",
                    border: "1px solid #e8e4ff",
                    borderRadius: "4px",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    color: "#333",
                    textAlign: "center",
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                  }}
                >
                  {icon}
                  <span>{label}</span>
                </div>
              ))}
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
