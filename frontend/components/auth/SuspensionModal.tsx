"use client";

import React from "react";
import { AlertCircleIcon } from "@/components/icons/Icons";

interface SuspensionModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
  noticeType?: "suspended" | "deleted";
}

export default function SuspensionModal({ isOpen, message, onClose, noticeType }: SuspensionModalProps) {
  if (!isOpen) return null;

  const isDeleted = noticeType === "deleted" ||
    (message && (message.toLowerCase().includes("delete") || message.toLowerCase().includes("removed") || message.toLowerCase().includes("not found")));

  const title = isDeleted ? "ACCOUNT DELETED" : "ACCOUNT SUSPENDED";
  const badgeLabel = isDeleted ? "ACCOUNT DELETED NOTICE" : "ACCOUNT SUSPENDED ALERT";
  const subtitle = isDeleted
    ? "Your customer account and profile data have been permanently removed from our database by administration."
    : "Your customer account access has been suspended by administration. You have been logged out of active sessions.";

  const isGenericMessage = !message ||
    message.toLowerCase().includes("not found") ||
    message.toLowerCase().includes("user not found") ||
    message.toLowerCase().includes("account not found") ||
    message.toLowerCase().includes("status has changed");

  const showNoticeBox = message && !isGenericMessage;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.75)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10000,
      padding: 20
    }}>
      <div style={{
        background: "#ffffff",
        width: "100%",
        maxWidth: 480,
        border: "2px solid #000000",
        boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Header Bar */}
        <div style={{
          background: "#000000",
          color: "#ffffff",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 26, height: 26, background: isDeleted ? "#475569" : "#dc2626", color: "#fff",
              borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <AlertCircleIcon size={15} color="#ffffff" />
            </div>
            <span style={{
              fontSize: "0.82rem", fontWeight: 900, textTransform: "uppercase",
              letterSpacing: '-0.025em'
            }}>
              {badgeLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "#ffffff",
              cursor: "pointer", fontSize: "1.1rem", fontWeight: 800, padding: 4, lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: "32px 28px", textAlign: "center" }}>
          <div style={{
            width: 64, height: 64,
            background: isDeleted ? "#f1f5f9" : "#fef2f2",
            border: isDeleted ? "2px solid #334155" : "2px solid #dc2626",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px"
          }}>
            <AlertCircleIcon size={32} color={isDeleted ? "#334155" : "#dc2626"} />
          </div>

          <h2 style={{
            fontSize: "1.25rem", fontWeight: 900, textTransform: "uppercase",
            letterSpacing: '-0.025em', margin: "0 0 10px", color: "#000000"
          }}>
            {title}
          </h2>

          <p style={{
            fontSize: "0.88rem", color: "#555555", lineHeight: 1.6,
            margin: "0 0 24px"
          }}>
            {subtitle}
          </p>

          {/* Details / Reason Callout (Hidden for generic technical messages) */}
          {showNoticeBox && (
            <div style={{
              background: "#f8fafc",
              borderLeft: isDeleted ? "4px solid #334155" : "4px solid #dc2626",
              padding: "14px 16px", textAlign: "left", marginBottom: 28,
              fontSize: "0.83rem", color: "#334155", lineHeight: 1.5
            }}>
              <div style={{
                fontWeight: 800, textTransform: "uppercase", letterSpacing: '-0.025em',
                color: isDeleted ? "#334155" : "#dc2626", fontSize: "0.72rem", marginBottom: 4
              }}>
                Administration Notice
              </div>
              {message}
            </div>
          )}


          {/* Action Button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "100%", background: "#000000", color: "#ffffff",
              border: "none", padding: "14px 24px", fontSize: "0.85rem",
              fontWeight: 900, cursor: "pointer", textTransform: "uppercase",
              letterSpacing: '-0.025em', transition: "background 0.15s"
            }}
          >
            Understood — Return to Shop &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}

