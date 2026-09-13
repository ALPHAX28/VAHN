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

  // Milestone mapping (Clean, concise step titles without confusing premature sub-labels)
  const forwardSteps = [
    { key: "PLACED", label: "Ordered" },
    { key: "PROCESSING", label: "Packed" },
    { key: "SHIPPED", label: "Shipped" },
    { key: "IN_TRANSIT", label: "In Transit" },
    { key: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
    { key: "DELIVERED", label: "Delivered" },
  ];

  const returnSteps = [
    { key: "RETURN_REQUESTED", label: "Return Initiated" },
    { key: "RETURN_PICKED_UP", label: "Picked Up" },
    { key: "RETURN_IN_TRANSIT", label: "In Transit" },
    { key: "REFUND_INITIATED", label: "Refund Initiated" },
    { key: "REFUNDED", label: "Refund Completed" },
  ];

  function resolveForwardMilestone(t: TrackingInfo | null): {
    index: number;
    badgeLabel: string;
    isCancelled: boolean;
  } {
    if (!t) return { index: -1, badgeLabel: "UNKNOWN", isCancelled: false };

    const rawStatus = (t.status || "").toUpperCase().trim();
    const rawShipping = (t.shipping_status || "").toUpperCase().trim();
    const rawCurrent = (t.current_status || t.currentStatus || "").toUpperCase().trim();
    const rawMilestone = (t.currentMilestone || "").toUpperCase().trim();
    const combined = `${rawStatus} ${rawShipping} ${rawCurrent} ${rawMilestone}`.replace(/[-_]/g, " ");

    // 1. Cancelled
    if (rawStatus === "CANCELLED" || rawShipping === "CANCELLED" || combined.includes("CANCELLED")) {
      return { index: 0, badgeLabel: "CANCELLED", isCancelled: true };
    }

    // 2. Delivered
    if (Boolean(t.delivered_at) || combined.includes("DELIVERED") || combined.includes("COMPLETED")) {
      return { index: 5, badgeLabel: "DELIVERED", isCancelled: false };
    }

    // 3. Out for delivery
    if (
      combined.includes("OUT FOR DELIVERY") ||
      combined.includes("OUT FOR DISPATCH") ||
      combined.includes("OUT FOR PICKUP")
    ) {
      return { index: 4, badgeLabel: "OUT FOR DELIVERY", isCancelled: false };
    }

    // 4. In transit / reached hub
    if (
      combined.includes("IN TRANSIT") ||
      combined.includes("TRANSIT") ||
      combined.includes("REACHED DESTINATION") ||
      combined.includes("REACHED HUB") ||
      combined.includes("AT HUB") ||
      combined.includes("CONNECTED")
    ) {
      return { index: 3, badgeLabel: "IN TRANSIT", isCancelled: false };
    }

    // 5. Shipped / Handed to courier
    if (
      t.is_picked_up ||
      combined.includes("PICKED UP") ||
      combined.includes("SHIPPED") ||
      combined.includes("DISPATCHED") ||
      combined.includes("HANDED OVER") ||
      combined.includes("IN FLIGHT")
    ) {
      return { index: 2, badgeLabel: "SHIPPED", isCancelled: false };
    }

    // 6. Packed / Ready for pickup / Manifest generated / AWB assigned
    if (
      combined.includes("MANIFEST GENERATED") ||
      combined.includes("MANIFESTED") ||
      combined.includes("READY TO SHIP") ||
      combined.includes("AWB ASSIGNED") ||
      combined.includes("PICKUP SCHEDULED") ||
      combined.includes("PICKUP GENERATED") ||
      combined.includes("LABEL GENERATED") ||
      combined.includes("PACKED") ||
      Boolean(t.awb_code && t.awb_code.trim().length > 0)
    ) {
      return { index: 1, badgeLabel: "PACKED / READY FOR PICKUP", isCancelled: false };
    }

    // 7. Ordered / Placed / Unfulfilled (Default for any existing placed order)
    return { index: 0, badgeLabel: "ORDER CONFIRMED", isCancelled: false };
  }

  function resolveReturnMilestone(t: TrackingInfo | null): {
    index: number;
    badgeLabel: string;
  } {
    if (!t) return { index: -1, badgeLabel: "UNKNOWN" };

    const rawStatus = (t.status || "").toUpperCase().trim();
    const rawReturn = (t.return_status || "").toUpperCase().trim();
    const rawCurrent = (t.current_status || t.currentStatus || "").toUpperCase().trim();
    const combined = `${rawStatus} ${rawReturn} ${rawCurrent}`.replace(/[-_]/g, " ");

    if (combined.includes("REFUNDED") || combined.includes("REFUND COMPLETED")) {
      return { index: 4, badgeLabel: "REFUND COMPLETED" };
    }
    if (combined.includes("REFUND INITIATED") || combined.includes("REFUND DISPATCHED")) {
      return { index: 3, badgeLabel: "REFUND INITIATED" };
    }
    if (
      combined.includes("RETURN IN TRANSIT") ||
      combined.includes("RETURNING TO HUB") ||
      (combined.includes("IN TRANSIT") && Boolean(t.reverse_awb))
    ) {
      return { index: 2, badgeLabel: "RETURN IN TRANSIT" };
    }
    if (
      combined.includes("RETURN PICKED UP") ||
      combined.includes("PICKED UP") ||
      combined.includes("DOORSTEP COLLECTION")
    ) {
      return { index: 1, badgeLabel: "RETURN PICKED UP" };
    }
    return { index: 0, badgeLabel: "RETURN INITIATED" };
  }

  const isReturn = Boolean(
    tracking?.isReturn ||
    (tracking?.return_status && tracking.return_status !== "NONE") ||
    tracking?.reverse_awb
  );
  const activeSteps = isReturn ? returnSteps : forwardSteps;

  const {
    index: currentStepIndex,
    badgeLabel: statusBadgeLabel,
    isCancelled,
  } = isReturn
    ? { ...resolveReturnMilestone(tracking), isCancelled: false }
    : resolveForwardMilestone(tracking);

  const rawLocation = (tracking?.current_location || tracking?.currentLocation || "").trim();
  const isValidLocation = Boolean(
    rawLocation &&
    !["in transit", "transit", "unfulfilled", "processing", "manifest generated", "origin facility", "pending", "unknown", "n/a"].includes(rawLocation.toLowerCase()) &&
    !rawLocation.toLowerCase().includes("transit") &&
    !rawLocation.toLowerCase().includes("unfulfilled") &&
    !rawLocation.toLowerCase().includes("processing") &&
    !rawLocation.toLowerCase().includes("manifest")
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
                    statusBadgeLabel === "DELIVERED" || statusBadgeLabel === "REFUND COMPLETED"
                      ? "#16a34a"
                      : isCancelled
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
                {statusBadgeLabel}
              </span>
              {tracking.estimatedDelivery && (
                <div style={{ fontSize: "0.78rem", color: "#666" }}>
                  Est. Delivery: <strong style={{ color: "#000" }}>{tracking.estimatedDelivery}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Cancelled Notice Banner */}
          {isCancelled && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                padding: "14px 18px",
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: "#991b1b",
                fontSize: "0.85rem",
                fontWeight: 700,
              }}
            >
              <AlertCircleIcon size={18} color="#dc2626" />
              <span>
                This order has been cancelled. {tracking.cancellation_reason ? `Reason: ${tracking.cancellation_reason}. ` : ""}
                Prepaid payments are refunded to your original payment method.
              </span>
            </div>
          )}

          {/* Real physical location banner */}
          {isValidLocation && (
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
              <span style={{ color: "#334155" }}>{rawLocation}</span>
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
                  left: `calc(100% / (${activeSteps.length} * 2))`,
                  right: `calc(100% / (${activeSteps.length} * 2))`,
                  height: "2px",
                  background: "#e5e7eb",
                  zIndex: 0,
                }}
              />
              {/* Active connecting line */}
              <div
                style={{
                  position: "absolute",
                  top: "14px",
                  left: `calc(100% / (${activeSteps.length} * 2))`,
                  width: `calc((100% - 100% / ${activeSteps.length}) * ${
                    !isCancelled && currentStepIndex >= 0 ? currentStepIndex / (activeSteps.length - 1) : 0
                  })`,
                  height: "2px",
                  background: isCancelled ? "#dc2626" : "#000",
                  zIndex: 0,
                  transition: "width 0.4s ease",
                }}
              />

              {activeSteps.map((step, idx) => {
                const isPassed = !isCancelled && currentStepIndex >= idx;
                const isCurrent = !isCancelled && currentStepIndex === idx;

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
                        background: isCancelled
                          ? idx === 0 ? "#dc2626" : "#fff"
                          : isPassed ? "#000" : "#fff",
                        border: isCancelled
                          ? idx === 0 ? "2px solid #dc2626" : "2px solid #d1d5db"
                          : isPassed ? "2px solid #000" : "2px solid #d1d5db",
                        color: isCancelled
                          ? idx === 0 ? "#fff" : "#9ca3af"
                          : isPassed ? "#fff" : "#9ca3af",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.72rem",
                        fontWeight: 900,
                        marginBottom: "8px",
                        boxShadow: isCurrent ? "0 0 0 4px rgba(0,0,0,0.12)" : "none",
                        transition: "all 0.3s ease",
                      }}
                    >
                      {isCancelled && idx === 0 ? "✕" : isPassed ? "✓" : idx + 1}
                    </div>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: isCurrent ? 900 : 700,
                        color: isCancelled && idx === 0 ? "#dc2626" : isPassed ? "#000" : "#9ca3af",
                        textTransform: "uppercase",
                      }}
                    >
                      {step.label}
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

            {(() => {
              // Construct unified checkpoints from live scans, milestones, or synthesized order milestones
              const checkpoints: Array<{
                title: string;
                description?: string | null;
                location?: string | null;
                timestamp?: string | null;
              }> = [];

              const rawScans = isReturn
                ? (tracking?.reverse_scans && tracking.reverse_scans.length > 0 ? tracking.reverse_scans : tracking?.scans || [])
                : (tracking?.scans && tracking.scans.length > 0 ? tracking.scans : []);

              if (tracking?.milestones && tracking.milestones.length > 0) {
                tracking.milestones.forEach((m) => {
                  checkpoints.push({
                    title: m.title,
                    description: m.description,
                    location: m.location,
                    timestamp: m.timestamp,
                  });
                });
              } else if (rawScans.length > 0) {
                const reversedScans = [...rawScans].reverse();
                reversedScans.forEach((s) => {
                  checkpoints.push({
                    title: s.activity || "Shipment Scan",
                    location: s.location || undefined,
                    timestamp: s.date || undefined,
                  });
                });
              } else if (tracking) {
                if (isCancelled) {
                  checkpoints.push({
                    title: "Order Cancelled",
                    description: tracking.cancellation_reason
                      ? `Cancellation Reason: ${tracking.cancellation_reason}`
                      : "Order was cancelled. Any prepaid payment has been refunded.",
                    timestamp: tracking.created_at || "Recent",
                  });
                } else {
                  if (currentStepIndex >= 5) {
                    checkpoints.push({
                      title: "Package Delivered",
                      description: "Shipment was delivered successfully.",
                      timestamp: tracking.delivered_at || "Delivered",
                    });
                  }
                  if (currentStepIndex >= 4) {
                    checkpoints.push({
                      title: "Out for Delivery",
                      description: "Package is out for delivery with the courier agent.",
                      timestamp: "In Progress",
                    });
                  }
                  if (currentStepIndex >= 3) {
                    checkpoints.push({
                      title: "In Transit",
                      description: isValidLocation
                        ? `Package is in transit to destination facility near ${rawLocation}.`
                        : "Package is in transit to destination facility.",
                      timestamp: "In Progress",
                    });
                  }
                  if (currentStepIndex >= 2) {
                    checkpoints.push({
                      title: "Handed Over to Courier",
                      description: `Package picked up by ${tracking.courier_name || tracking.courierName || "Courier Partner"}.`,
                      timestamp: "Dispatched",
                    });
                  }
                  if (currentStepIndex >= 1) {
                    checkpoints.push({
                      title: "Packed & Ready for Pickup",
                      description: tracking.awb_code
                        ? `Assigned to ${tracking.courier_name || tracking.courierName || "Express Delivery"} (AWB: ${tracking.awb_code})`
                        : "Order is packed and awaiting courier pickup at fulfillment facility.",
                      timestamp: "Packed",
                    });
                  }
                  checkpoints.push({
                    title: "Order Placed & Payment Confirmed",
                    description: `Order #${tracking.order_id || tracking.orderId} placed successfully. Prepaid payment confirmed.`,
                    timestamp: tracking.created_at || "Recent",
                  });
                }
              }

              if (checkpoints.length === 0) {
                return (
                  <div style={{ color: "#666", fontSize: "0.85rem", padding: "12px 0" }}>
                    Shipment is registered. Live checkpoints will update automatically once scanned at the dispatch hub.
                  </div>
                );
              }

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {checkpoints.map((cp, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "14px",
                        paddingBottom: "14px",
                        borderBottom: i < checkpoints.length - 1 ? "1px solid #f8f8f8" : "none",
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          background: i === 0 ? (isCancelled ? "#dc2626" : "#16a34a") : "#cbd5e1",
                          borderRadius: "50%",
                          marginTop: "5px",
                          flexShrink: 0,
                          boxShadow: i === 0 ? `0 0 0 3px ${isCancelled ? "rgba(220,38,38,0.2)" : "rgba(22,163,74,0.2)"}` : "none",
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
                          <div style={{ fontWeight: 800, fontSize: "0.88rem", textTransform: "uppercase", color: i === 0 ? "#000" : "#444" }}>
                            {cp.title}
                          </div>
                          {cp.timestamp && (
                            <div style={{ fontSize: "0.75rem", color: "#888" }}>{cp.timestamp}</div>
                          )}
                        </div>
                        {cp.description && (
                          <div style={{ fontSize: "0.82rem", color: "#555", marginTop: "2px" }}>
                            {cp.description}
                          </div>
                        )}
                        {cp.location && (
                          <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "2px" }}>
                            📍 {cp.location}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
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
