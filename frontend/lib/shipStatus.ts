/**
 * shipStatus.ts
 * Human-readable label mappings for Shiprocket raw status strings.
 *
 * Shiprocket returns technical internal codes (e.g. "MANIFEST_GENERATED",
 * "AWB CANCELLED BY USER") that must never be shown verbatim to customers.
 * This module converts them to clean, brand-consistent labels.
 */

// ─── Shipping status (stored in our DB) ──────────────────────────────────────

const SHIP_STATUS_MAP: Record<string, string> = {
  // Pre-dispatch
  PROCESSING: "Order Processing",
  CONFIRMED: "Order Confirmed",
  PENDING: "Awaiting Confirmation",
  PENDING_PAYMENT: "Awaiting Payment",
  UNFULFILLED: "Order Processing",
  MANIFEST_GENERATED: "Packed & Ready for Pickup",
  LABEL_GENERATED: "Packed & Ready for Pickup",
  AWB_ASSIGNED: "Packed & Ready for Pickup",
  PICKUP_GENERATED: "Pickup Scheduled",
  PICKUP_SCHEDULED: "Pickup Scheduled",
  READY_TO_SHIP: "Packed & Ready for Pickup",
  PICKUP_PENDING: "Awaiting Pickup",
  // In transit
  SHIPPED: "Shipped",
  PICKED_UP: "Picked Up by Courier",
  IN_TRANSIT: "In Transit",
  REACHED_HUB: "Reached Transit Hub",
  REACHED_DESTINATION: "Reached Destination Hub",
  AT_HUB: "At Courier Hub",
  CONNECTED: "In Transit",
  // Out for delivery
  OUT_FOR_DELIVERY: "Out for Delivery",
  OUT_FOR_PICKUP: "Out for Pickup",
  // Terminal
  DELIVERED: "Delivered",
  RTO: "Return to Origin",
  RTO_INITIATED: "Return to Origin Initiated",
  RTO_DELIVERED: "Returned to Sender",
  LOST: "Shipment Lost — Contact Support",
  DAMAGED: "Damaged in Transit",
  // Cancellation states
  CANCELLED: "Cancelled",
  CANCELED: "Cancelled",
  SHIPMENT_CANCELLED: "Shipment Cancelled",
  CANCELLED_BY_SHIPPER: "Cancelled by Seller",
  CANCELLED_BY_SELLER: "Cancelled by Seller",
  SELLER_CANCELLED: "Cancelled by Seller",
  SHIPMENT_REVOKED: "Shipment Revoked",
  REVOKED: "Shipment Revoked",
  // Refund/Return
  REFUNDED: "Refund Completed",
  REFUND_INITIATED: "Refund Initiated",
  RETURN: "Return Requested",
  RETURN_INITIATED: "Return Initiated",
  RETURN_PICKED_UP: "Return Picked Up",
  RETURN_IN_TRANSIT: "Return In Transit",
  RETURN_DELIVERED: "Return Received",
  // Payment states
  PAYMENT_FAILED: "Payment Failed",
  FAILED: "Payment Failed",
};

/**
 * Convert a raw DB/Shiprocket shipping_status value to a clean customer label.
 * Falls back to title-casing the raw string if no mapping found.
 */
export function prettifyShipStatus(raw: string | null | undefined): string {
  if (!raw) return "Processing";
  const key = raw.trim().toUpperCase().replace(/[- ]/g, "_");
  if (SHIP_STATUS_MAP[key]) return SHIP_STATUS_MAP[key];
  // Try with spaces normalized to underscores
  const spacedKey = raw.trim().toUpperCase().replace(/_/g, " ");
  for (const [k, v] of Object.entries(SHIP_STATUS_MAP)) {
    if (k.replace(/_/g, " ") === spacedKey) return v;
  }
  // Fallback: title-case the raw value
  return raw
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Courier scan activity labels ─────────────────────────────────────────────

/**
 * Normalised lookup: strip punctuation, lowercase, collapse spaces.
 */
function normActivity(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

// Ordered from most-specific to least-specific (substring matching)
const ACTIVITY_PATTERNS: Array<{ pattern: string; label: string }> = [
  // Cancellation events
  { pattern: "seller cancelled the order", label: "Order Cancelled by Seller" },
  { pattern: "seller canceled the order", label: "Order Cancelled by Seller" },
  { pattern: "seller cancelled", label: "Order Cancelled by Seller" },
  { pattern: "seller canceled", label: "Order Cancelled by Seller" },
  { pattern: "cancelled by seller", label: "Order Cancelled by Seller" },
  { pattern: "canceled by seller", label: "Order Cancelled by Seller" },
  { pattern: "cancelled by shipper", label: "Order Cancelled by Seller" },
  { pattern: "canceled by shipper", label: "Order Cancelled by Seller" },
  { pattern: "awb cancelled by user", label: "Shipment Cancelled" },
  { pattern: "awb canceled by user", label: "Shipment Cancelled" },
  { pattern: "shipment revoked", label: "Shipment Revoked" },
  { pattern: "shipment cancelled", label: "Shipment Cancelled" },
  { pattern: "shipment canceled", label: "Shipment Cancelled" },
  { pattern: "cancelled before dispatch", label: "Cancelled Before Dispatch" },
  { pattern: "order cancelled", label: "Order Cancelled" },
  { pattern: "order canceled", label: "Order Cancelled" },
  // Manifesting / pre-dispatch
  { pattern: "manifested", label: "Order Manifested & Packed" },
  { pattern: "manifest generated", label: "Manifest Generated" },
  { pattern: "label generated", label: "Shipping Label Generated" },
  { pattern: "awb assigned", label: "Shipment Registered with Courier" },
  { pattern: "ready to ship", label: "Packed & Ready for Pickup" },
  { pattern: "pickup generated", label: "Courier Pickup Scheduled" },
  { pattern: "pickup scheduled", label: "Courier Pickup Scheduled" },
  // Pickup
  { pattern: "picked up", label: "Picked Up by Courier" },
  { pattern: "shipment picked up", label: "Picked Up by Courier" },
  // Transit
  { pattern: "in transit", label: "In Transit" },
  { pattern: "reached hub", label: "Arrived at Transit Hub" },
  { pattern: "reached destination hub", label: "Arrived at Destination Hub" },
  { pattern: "reached destination", label: "Arrived at Destination" },
  { pattern: "connected scan", label: "Transferred to Next Hub" },
  { pattern: "connected", label: "Transferred to Next Hub" },
  { pattern: "out for delivery", label: "Out for Delivery" },
  { pattern: "out for dispatch", label: "Out for Delivery" },
  // Delivery
  { pattern: "delivered", label: "Package Delivered" },
  { pattern: "delivery attempted", label: "Delivery Attempted" },
  { pattern: "delivery failed", label: "Delivery Attempted — Rescheduling" },
  { pattern: "undelivered", label: "Delivery Attempted — Rescheduling" },
  { pattern: "rto initiated", label: "Return to Origin Initiated" },
  { pattern: "rto", label: "Return to Origin" },
  // Payment
  { pattern: "payment confirmed", label: "Payment Confirmed" },
  { pattern: "payment failed", label: "Payment Failed" },
  // Generic order
  { pattern: "order placed", label: "Order Placed" },
  { pattern: "order confirmed", label: "Order Confirmed" },
  { pattern: "shipment booked", label: "Shipment Booked with Courier" },
  { pattern: "lost", label: "Shipment Lost — Contact Support" },
];

/**
 * Convert a raw Shiprocket courier scan activity string to a clean customer label.
 * Falls back to sanitised title-case of the original string if no pattern matches.
 */
export function prettifyActivityLabel(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "Shipment Update";
  const normed = normActivity(raw);

  for (const { pattern, label } of ACTIVITY_PATTERNS) {
    if (normed.includes(pattern)) return label;
  }

  // Fallback: sanitise and title-case the raw string
  // Remove internal codes like "Manifested - SELLER CANCELLED THE ORDER"
  // by stripping anything that reads like an ALL-CAPS technical phrase after a dash
  const cleaned = raw
    .replace(/\s*-\s*[A-Z][A-Z\s]+$/, "") // strip " - ALL CAPS SUFFIX"
    .replace(/[_]/g, " ")
    .trim();

  return cleaned
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
