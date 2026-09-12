"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircleIcon, ChevronLeftIcon, ShoppingBagIcon } from "@/components/icons/Icons";

function CheckoutFailedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason") || "The payment session was declined or expired.";
  const orderId = searchParams.get("order_id") || "";

  return (
    <div
      style={{
        maxWidth: "640px",
        margin: "60px auto 100px",
        padding: "0 20px",
        fontFamily: "var(--font-ui, sans-serif)",
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid #fee2e2",
          padding: "48px 32px",
          textAlign: "center",
          boxShadow: "0 4px 12px rgba(220, 38, 38, 0.04)",
        }}
      >
        {/* Red Alert Icon */}
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "#fef2f2",
            border: "2px solid #ef4444",
            color: "#dc2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <AlertCircleIcon size={32} color="#dc2626" />
        </div>

        <span
          style={{
            display: "inline-block",
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: "0.72rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: "3px 10px",
            border: "1px solid #fecaca",
            marginBottom: "12px",
          }}
        >
          Transaction Incomplete • Cart Preserved
        </span>

        <h1
          style={{
            fontSize: "clamp(1.5rem, 3.5vw, 2rem)",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-0.03em",
            margin: "0 0 12px",
            color: "#000",
          }}
        >
          Payment Not Completed
        </h1>

        <p
          style={{
            fontSize: "0.92rem",
            color: "#555",
            maxWidth: "480px",
            margin: "0 auto 20px",
            lineHeight: 1.5,
          }}
        >
          Your payment could not be confirmed. No money was deducted from your account, and your selected items remain safely in your cart.
        </p>

        {/* Reason Box */}
        {reason && (
          <div
            style={{
              background: "#fafafa",
              border: "1px solid #f0f0f0",
              padding: "12px 16px",
              fontSize: "0.82rem",
              color: "#666",
              maxWidth: "460px",
              margin: "0 auto 28px",
              textAlign: "left",
            }}
          >
            <strong style={{ color: "#333", display: "block", marginBottom: "2px" }}>Notice:</strong>
            {reason}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "360px", margin: "0 auto" }}>
          <Link
            href="/checkout"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              background: "#000",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: "0.88rem",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Try Payment Again →
          </Link>

          <Link
            href="/cart"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "14px",
              background: "#fff",
              border: "1px solid #000",
              color: "#000",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: "0.82rem",
              textTransform: "uppercase",
            }}
          >
            <ShoppingBagIcon size={16} />
            <span>Review Cart Items</span>
          </Link>

          <Link
            href="/contact"
            style={{
              marginTop: "8px",
              color: "#666",
              fontSize: "0.78rem",
              textDecoration: "underline",
            }}
          >
            Need help? Contact VAHN Athlete Support
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutFailedPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: "80px 20px" }}>Loading...</div>}>
      <CheckoutFailedContent />
    </Suspense>
  );
}
