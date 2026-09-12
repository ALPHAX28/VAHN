"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getPublicTracking } from "@/lib/api";
import type { TrackingInfo } from "@/lib/api/types";
import {
  TruckIcon,
  CheckIcon,
  AlertCircleIcon,
  MapPinIcon,
  SearchIcon,
  PackageIcon,
  ShieldCheckIcon,
  XIcon,
} from "@/components/icons/Icons";

function TrackingContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const isSuccessRedirect = searchParams.get("success") === "1";

  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  async function handleSearch(searchCode: string) {
    const trimmed = searchCode.trim();
    if (!trimmed) return;
    setError("");
    setLoading(true);

    try {
      const data = await getPublicTracking(trimmed);
      setTracking(data);
    } catch (err: any) {
      setError(err?.message || "No tracking details found for this Order ID or AWB. Please verify the code and try again.");
      setTracking(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      handleSearch(query.trim());
    }
  }

  function handleCopyAwb(awb: string) {
    if (!awb) return;
    navigator.clipboard.writeText(awb);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Milestone mapping
  const forwardSteps = [
    { key: "PLACED", label: "Ordered", desc: "Payment Confirmed" },
    { key: "PROCESSING", label: "Packed", desc: "Ready for Pickup" },
    { key: "SHIPPED", label: "Shipped", desc: "Handed to Courier" },
    { key: "IN_TRANSIT", label: "In Transit", desc: "On the Way" },
    { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", desc: "Arriving Today" },
    { key: "DELIVERED", label: "Delivered", desc: "Package Received" },
  ];

  const returnSteps = [
    { key: "RETURN_REQUESTED", label: "Return Initiated", desc: "Reverse AWB Created" },
    { key: "RETURN_PICKED_UP", label: "Picked Up", desc: "Doorstep Collection" },
    { key: "RETURN_IN_TRANSIT", label: "In Transit", desc: "Returning to Hub" },
    { key: "REFUND_INITIATED", label: "Refund Initiated", desc: "Dispatched via Razorpay" },
    { key: "REFUNDED", label: "Refund Completed", desc: "Credited to Customer" },
  ];

  const activeSteps = tracking?.isReturn ? returnSteps : forwardSteps;
  // Backend returns snake_case: current_status, order_id, awb_code, courier_name, current_location
  // Also accept camelCase fallbacks for forward-compatibility
  const currentStatusUpper = (
    tracking?.current_status ||
    tracking?.currentStatus ||
    tracking?.shipping_status ||
    tracking?.status ||
    ""
  ).toUpperCase();
  const currentStepIndex = activeSteps.findIndex(
    (s) => s.key === currentStatusUpper || currentStatusUpper.includes(s.key)
  );

  return (
    <div
      style={{
        maxWidth: 880,
        margin: "48px auto 100px",
        padding: "0 20px",
        fontFamily: "var(--font-ui)",
      }}
    >
      {/* Checkout Success Banner */}
      {isSuccessRedirect && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            padding: "18px 24px",
            marginBottom: "36px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: "#16a34a",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <CheckIcon size={16} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 900, color: "#166534", margin: "0 0 2px", textTransform: "uppercase" }}>
              Order & Payment Confirmed
            </h2>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#15803d" }}>
              Thank you for choosing VAHN. Your prepaid payment is verified and live shipment tracking is displayed below.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "36px" }}>
        <div
          style={{
            display: "inline-block",
            background: "#f3f4f6",
            color: "#555",
            fontSize: "0.7rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "4px 12px",
            marginBottom: "12px",
          }}
        >
          VAHN Fulfillment & Tracking
        </div>
        <h1
          style={{
            fontSize: "clamp(1.75rem, 3.5vw, 2.4rem)",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-0.03em",
            margin: "0 0 10px",
            color: "#000",
          }}
        >
          Track Your Order
        </h1>
        <p style={{ color: "#666", fontSize: "0.92rem", maxWidth: 520, margin: "0 auto", lineHeight: 1.5 }}>
          Enter your Order ID or Courier AWB number below to view live delivery status and checkpoint scans.
        </p>
      </div>

      {/* Search Bar */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          border: "2px solid #000",
          background: "#fff",
          marginBottom: "40px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", paddingLeft: "16px", color: "#888" }}>
          <SearchIcon size={18} color="#666" />
        </div>
        <input
          type="text"
          placeholder="Enter Order ID (e.g. ORD-820990) or Courier AWB..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: 1,
            padding: "16px 14px",
            border: "none",
            fontSize: "0.95rem",
            fontWeight: 600,
            outline: "none",
            letterSpacing: "-0.01em",
            background: "transparent",
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setTracking(null);
              setError("");
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 12px",
              color: "#888",
              display: "flex",
              alignItems: "center",
            }}
            title="Clear search"
          >
            <XIcon size={14} color="#888" />
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            background: "#000",
            color: "#fff",
            border: "none",
            padding: "0 28px",
            fontSize: "0.85rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.2s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {loading ? (
            <span>Tracking...</span>
          ) : (
            <>
              <span>Track</span>
              <span>→</span>
            </>
          )}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            padding: "16px 20px",
            marginBottom: "32px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "#dc2626",
            fontSize: "0.88rem",
            fontWeight: 600,
          }}
        >
          <AlertCircleIcon size={18} color="#dc2626" />
          <span>{error}</span>
        </div>
      )}

      {/* Tracking Result View */}
      {tracking ? (
        <div
          style={{
            border: "1px solid #000",
            background: "#fff",
            padding: "28px 32px",
            boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
          }}
        >
          {/* Header Summary */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "18px",
              borderBottom: "1px solid #f0f0f0",
              paddingBottom: "22px",
              marginBottom: "30px",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  color: "#666",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                {tracking.isReturn ? "Return Shipment" : "Order Shipment"}
              </span>
              <h2
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 900,
                  margin: "0 0 6px",
                  letterSpacing: "-0.02em",
                }}
              >
                {/* Backend returns order_id (snake_case) */}
                {tracking.order_id || tracking.orderId}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.82rem", color: "#555", flexWrap: "wrap" }}>
                <span>
                  Courier: <strong style={{ color: "#000" }}>{tracking.courier_name || tracking.courierName || "Express Delivery"}</strong>
                </span>
                {/* Backend returns awb_code (snake_case) */}
                {(tracking.awb_code || tracking.awbCode) && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    AWB: <strong style={{ fontFamily: "monospace", color: "#000" }}>{tracking.awb_code || tracking.awbCode}</strong>
                    <button
                      type="button"
                      onClick={() => handleCopyAwb(tracking.awb_code || tracking.awbCode || "")}
                      style={{
                        background: "#f3f4f6",
                        border: "1px solid #e5e7eb",
                        fontSize: "0.7rem",
                        padding: "2px 6px",
                        cursor: "pointer",
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </span>
                )}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  display: "inline-block",
                  background:
                    (tracking.current_status || tracking.currentStatus) === "DELIVERED" || (tracking.current_status || tracking.currentStatus) === "REFUNDED"
                      ? "#16a34a"
                      : (tracking.current_status || tracking.currentStatus) === "CANCELLED"
                      ? "#dc2626"
                      : "#000",
                  color: "#fff",
                  fontSize: "0.75rem",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  padding: "6px 14px",
                  marginBottom: "6px",
                }}
              >
                {tracking.currentMilestone || tracking.current_status || tracking.currentStatus}
              </span>
              {tracking.estimatedDelivery && (
                <div style={{ fontSize: "0.78rem", color: "#666" }}>
                  Est. Delivery: <strong style={{ color: "#000" }}>{tracking.estimatedDelivery}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Backend returns current_location (snake_case) */}
          {(tracking.current_location || tracking.currentLocation) && (
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                padding: "12px 18px",
                marginBottom: "28px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "0.85rem",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563eb", display: "inline-block" }} />
              <span style={{ fontWeight: 800, color: "#1e293b" }}>Current Location:</span>
              <span style={{ color: "#334155" }}>{tracking.current_location || tracking.currentLocation}</span>
            </div>
          )}

          {/* Stepper Progress */}
          <div style={{ margin: "24px 0 36px", overflowX: "auto", paddingBottom: "10px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${activeSteps.length}, 1fr)`,
                position: "relative",
                minWidth: 540,
              }}
            >
              {/* Background connecting line */}
              <div
                style={{
                  position: "absolute",
                  top: "14px",
                  left: "6%",
                  right: "6%",
                  height: "2px",
                  background: "#e5e7eb",
                  zIndex: 0,
                }}
              />
              {/* Active line */}
              <div
                style={{
                  position: "absolute",
                  top: "14px",
                  left: "6%",
                  width: `${Math.max(0, Math.min(88, ((currentStepIndex >= 0 ? currentStepIndex : 0) / (activeSteps.length - 1)) * 88))}%`,
                  height: "2px",
                  background: "#000",
                  zIndex: 0,
                  transition: "width 0.4s ease",
                }}
              />

              {activeSteps.map((step, idx) => {
                const isPassed = currentStepIndex >= idx;
                const isCurrent = currentStepIndex === idx;

                return (
                  <div
                    key={step.key}
                    style={{
                      position: "relative",
                      zIndex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        background: isPassed ? "#000" : "#fff",
                        border: isPassed ? "2px solid #000" : "2px solid #d1d5db",
                        color: isPassed ? "#fff" : "#9ca3af",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.72rem",
                        fontWeight: 900,
                        marginBottom: "8px",
                        boxShadow: isCurrent ? "0 0 0 4px rgba(0,0,0,0.12)" : "none",
                      }}
                    >
                      {isPassed ? "✓" : idx + 1}
                    </div>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: isCurrent ? 900 : 700,
                        color: isPassed ? "#000" : "#9ca3af",
                        textTransform: "uppercase",
                      }}
                    >
                      {step.label}
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "#888", marginTop: "2px" }}>
                      {step.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Activity Checkpoints */}
          <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: "24px" }}>
            <h3
              style={{
                fontSize: "0.85rem",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.02em",
                margin: "0 0 16px",
                color: "#333",
              }}
            >
              Checkpoint Scans & Transit History
            </h3>

            {tracking.milestones && tracking.milestones.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {tracking.milestones.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "14px",
                      paddingBottom: "14px",
                      borderBottom: i < (tracking.milestones?.length || 0) - 1 ? "1px solid #f8f8f8" : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        background: i === 0 ? "#16a34a" : "#cbd5e1",
                        borderRadius: "50%",
                        marginTop: "5px",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
                        <div style={{ fontWeight: 800, fontSize: "0.88rem", textTransform: "uppercase", color: "#000" }}>
                          {m.title}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#888" }}>{m.timestamp}</div>
                      </div>
                      {m.description && (
                        <div style={{ fontSize: "0.82rem", color: "#555", marginTop: "2px" }}>
                          {m.description}
                        </div>
                      )}
                      {m.location && (
                        <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "2px" }}>
                          📍 {m.location}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "#666", fontSize: "0.85rem", padding: "12px 0" }}>
                Shipment is registered. Live checkpoints will update automatically once scanned at the dispatch hub.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty State / Helpful Information Cards */
        <div style={{ marginTop: "32px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "20px",
            }}
          >
            <div style={{ border: "1px solid #e5e7eb", padding: "24px", background: "#fafafa" }}>
              <div style={{ width: 36, height: 36, background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <TruckIcon size={18} color="#fff" />
              </div>
              <h3 style={{ fontSize: "0.92rem", fontWeight: 900, textTransform: "uppercase", margin: "0 0 6px" }}>
                Fast Express Dispatch
              </h3>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#666", lineHeight: 1.5 }}>
                Orders are processed and dispatched within 24–48 business hours with automated courier allocation.
              </p>
            </div>

            <div style={{ border: "1px solid #e5e7eb", padding: "24px", background: "#fafafa" }}>
              <div style={{ width: 36, height: 36, background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <MapPinIcon size={18} color="#fff" />
              </div>
              <h3 style={{ fontSize: "0.92rem", fontWeight: 900, textTransform: "uppercase", margin: "0 0 6px" }}>
                Live Checkpoint Scans
              </h3>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#666", lineHeight: 1.5 }}>
                Track package movements step-by-step from sorting facility to out-for-delivery with SMS alerts.
              </p>
            </div>

            <div style={{ border: "1px solid #e5e7eb", padding: "24px", background: "#fafafa" }}>
              <div style={{ width: 36, height: 36, background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <ShieldCheckIcon size={18} color="#fff" />
              </div>
              <h3 style={{ fontSize: "0.92rem", fontWeight: 900, textTransform: "uppercase", margin: "0 0 6px" }}>
                Need Help?
              </h3>
              <p style={{ margin: "0 0 10px", fontSize: "0.82rem", color: "#666", lineHeight: 1.5 }}>
                Questions regarding your shipment? Our customer support team is available to assist you.
              </p>
              <Link href="/contact" style={{ fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", color: "#000", textDecoration: "underline" }}>
                Contact Support →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div style={{ padding: "100px", textAlign: "center", color: "#666" }}>Loading tracking portal...</div>}>
      <TrackingContent />
    </Suspense>
  );
}
