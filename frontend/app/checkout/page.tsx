"use client";

import { useEffect, useState } from "react";
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
  AlertCircleIcon,
  TruckIcon,
  CheckIcon,
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

  // Delivery Pincode Check state
  const [pincodeInput, setPincodeInput] = useState("");
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
        if (defaultAddr.pincode) {
          setPincodeInput(defaultAddr.pincode);
          handleCheckPincode(defaultAddr.pincode);
        }
      }
    } catch {
      // Ignored
    } finally {
      setLoadingAddresses(false);
    }
  }

  // Live Pincode Serviceability Check with Shiprocket
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
        courier_name: "Standard Express Courier",
        estimated_days: "3-5 business days",
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

    let shippingPayload: any = null;
    let customerName = "";
    let customerEmail = "";
    let customerPhone = "";

    if (user && token && selectedAddr) {
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
    } else if (pincodeInput.trim().length === 6) {
      shippingPayload = {
        pincode: pincodeInput.trim(),
        country: "India",
      };
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
              // Fallback
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
            // Silently reset placingOrder state so user can retry without an alarming red banner
            setPlacingOrder(false);
            if (typeof document !== "undefined") {
              document.body.style.overflow = "auto";
              document.documentElement.style.overflow = "auto";
              document.querySelectorAll(".razorpay-container").forEach((el) => el.remove());
            }
          },
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on("payment.failed", async function (response: any) {
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
        maxWidth: 720,
        margin: "40px auto 100px",
        padding: "0 20px",
        fontFamily: "var(--font-ui)",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "2px solid #000",
          paddingBottom: "16px",
          marginBottom: "32px",
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
              fontSize: "clamp(1.5rem, 3vw, 2rem)",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "-0.03em",
              margin: 0,
            }}
          >
            Secure Checkout
          </h1>
          <p style={{ color: "#666", fontSize: "0.85rem", margin: "4px 0 0" }}>
            1-Click Magic Checkout • Shiprocket Automated Logistics
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
              Sign In
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
            <div style={{ fontWeight: 700, color: "#cf1322", fontSize: "0.9rem" }}>Checkout Notice</div>
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

      {/* Main Order Review Card */}
      <div
        style={{
          border: "1px solid #e0e0e0",
          borderRadius: "0px",
          padding: "28px",
          background: "#fff",
          boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
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
            maxHeight: "340px",
            overflowY: "auto",
            marginBottom: "24px",
            paddingRight: "4px",
          }}
        >
          {cartLines.map((line) => (
            <div
              key={line.id}
              style={{
                display: "flex",
                gap: "14px",
                alignItems: "center",
                borderBottom: "1px solid #f5f5f5",
                paddingBottom: "14px",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: 58,
                  height: 58,
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
                    sizes="58px"
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
                    fontWeight: 800,
                    fontSize: "0.9rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {line.merchandise.product.title}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#666", marginTop: "2px" }}>
                  {line.merchandise.title !== "Default Title" ? line.merchandise.title : ""} • Qty:{" "}
                  {line.quantity}
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: "0.95rem", whiteSpace: "nowrap" }}>
                ₹{(parseFloat(line.merchandise.price.amount) * line.quantity).toLocaleString("en-IN")}
              </div>
            </div>
          ))}
        </div>

        {/* Logged-In User Delivery Address Switcher */}
        {user && addresses.length > 0 && (
          <div
            style={{
              background: "#fafafa",
              border: "1px solid #eee",
              padding: "14px 16px",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.85rem" }}>
              <MapPinIcon size={18} color="#4232d9" />
              <div>
                <div style={{ fontWeight: 800 }}>
                  Delivering to: {selectedAddr ? `${selectedAddr.first_name} ${selectedAddr.last_name}` : "Selected Address"}
                </div>
                {selectedAddr && (
                  <div style={{ fontSize: "0.78rem", color: "#666" }}>
                    {selectedAddr.street_address}, {selectedAddr.city} — {selectedAddr.pincode}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingAddress(null);
                setShowAddressModal(true);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#4232d9",
                fontWeight: 800,
                fontSize: "0.75rem",
                textTransform: "uppercase",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Change
            </button>
          </div>
        )}

        {/* Live Shiprocket Delivery Speed Checker */}
        <div
          style={{
            background: "#f8f9fc",
            border: "1px solid #e4e7eb",
            padding: "16px 18px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase" }}>
              <TruckIcon size={16} color="#000" />
              <span>Check Delivery Speed & Courier</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              maxLength={6}
              placeholder="Enter 6-digit delivery PIN (e.g. 560001)"
              value={pincodeInput}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setPincodeInput(val);
                if (val.length === 6) {
                  handleCheckPincode(val);
                }
              }}
              style={{
                flex: 1,
                padding: "9px 12px",
                border: "1px solid #ccc",
                fontSize: "0.85rem",
                outline: "none",
                borderRadius: "0px",
              }}
            />
            <button
              type="button"
              onClick={() => handleCheckPincode(pincodeInput)}
              disabled={checkingPincode || pincodeInput.length !== 6}
              style={{
                background: "#000",
                color: "#fff",
                border: "none",
                padding: "9px 18px",
                fontSize: "0.78rem",
                fontWeight: 800,
                textTransform: "uppercase",
                cursor: checkingPincode || pincodeInput.length !== 6 ? "not-allowed" : "pointer",
              }}
            >
              {checkingPincode ? "Checking..." : "Check ETA"}
            </button>
          </div>

          {checkingPincode && (
            <div style={{ fontSize: "0.78rem", color: "#666", marginTop: "8px" }}>
              Fetching real-time courier serviceability from Shiprocket...
            </div>
          )}

          {serviceability && !checkingPincode && (
            <div
              style={{
                marginTop: "10px",
                padding: "8px 12px",
                fontSize: "0.8rem",
                fontWeight: 700,
                background: serviceability.serviceable ? "#f6ffed" : "#fff2f0",
                border: `1px solid ${serviceability.serviceable ? "#b7eb8f" : "#ffccc7"}`,
                color: serviceability.serviceable ? "#389e0d" : "#cf1322",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {serviceability.serviceable ? (
                <span>
                  ✓ Available by <strong>{serviceability.courier_name || "Express Courier"}</strong> • Est. Delivery:{" "}
                  <strong>{serviceability.estimated_days || `${serviceability.estimated_delivery_days || 3-5} days`}</strong>
                </span>
              ) : (
                <span>✕ {serviceability.message || "Delivery not serviceable to this PIN code by courier partners."}</span>
              )}
            </div>
          )}
        </div>

        {/* Pricing Calculations */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            fontSize: "0.88rem",
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
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#888" }}>
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
            fontSize: "1.3rem",
            marginBottom: "20px",
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
              fontSize: "0.78rem",
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
            padding: "18px",
            fontSize: "1rem",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            cursor: placingOrder ? "not-allowed" : "pointer",
            borderRadius: "0px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "background 0.2s ease",
            boxShadow: "0 4px 12px rgba(66, 50, 217, 0.25)",
          }}
        >
          {placingOrder ? (
            <span>Connecting to Gateway...</span>
          ) : (
            <span>⚡ Pay ₹{grandTotal.toLocaleString("en-IN")} via Magic Checkout →</span>
          )}
        </button>

        {/* Magic Checkout 1-Click Explainer */}
        <div
          style={{
            background: "#f9f9fb",
            border: "1px solid #eef0f4",
            padding: "12px 16px",
            marginTop: "16px",
            fontSize: "0.78rem",
            color: "#555",
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          <strong>⚡ 1-Click Delivery & Payment:</strong> Your saved address and preferred payment methods from Razorpay&apos;s 100M+ shopper network will load instantly inside the modal. No manual form typing required.
        </div>

        {/* Trust Badges */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            marginTop: "16px",
            fontSize: "0.78rem",
            color: "#555",
          }}
        >
          <ShieldCheckIcon size={16} color="#52c41a" />
          <span>256-Bit SSL Encrypted Razorpay Gateway • RBI Compliant</span>
        </div>

        <div
          style={{
            textAlign: "center",
            marginTop: "6px",
            fontSize: "0.72rem",
            color: "#888",
          }}
        >
          7-Day Returns • Automated Shiprocket Reverse Logistics
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
