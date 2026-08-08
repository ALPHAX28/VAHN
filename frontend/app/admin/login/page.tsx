"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import Image from "next/image";

// ── Icons ────────────────────────────────────────────────────
function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

type Step = "phone" | "otp";

export default function AdminLoginPage() {
  const { adminCheckPhone, adminSendOTP, adminVerifyOTP } = useAdminAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);

  const phoneRef = useRef<HTMLInputElement>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

  useEffect(() => {
    if (step !== "otp") return;
    setResendTimer(30);
    const id = setInterval(() => setResendTimer(p => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [step]);

  // ── Step 1: Phone → send OTP ──────────────────────────────
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = phone.trim();
    if (!trimmed) { setError("Please enter your phone number."); return; }

    setLoading(true);
    try {
      const { otp_token } = await adminSendOTP(trimmed);
      setOtpToken(otp_token);
      setStep("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 120);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────
  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otpDigits];
    next[idx] = val.slice(-1);
    setOtpDigits(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtpDigits(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join("");
    if (code.length < 6) { setError("Please enter all 6 digits."); return; }
    setError("");
    setLoading(true);
    try {
      await adminVerifyOTP(phone.trim(), code, otpToken);
      router.push("/admin/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError("");
    setLoading(true);
    try {
      const { otp_token } = await adminSendOTP(phone.trim());
      setOtpToken(otp_token);
      setOtpDigits(["", "", "", "", "", ""]);
      setResendTimer(30);
      otpRefs.current[0]?.focus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-auth-page">
      <div className="admin-auth-card">

        {/* Logo */}
        <div className="admin-auth-logo">
          <Image src="/assets/logo.png" alt="VAHN" width={110} height={26} style={{ objectFit: "contain", height: "auto" }} />
          <span className="admin-auth-logo-badge">Admin</span>
        </div>

        {/* ── STEP: Phone ──────────────────────────────── */}
        {step === "phone" && (
          <>
            <h1 className="admin-auth-title">Admin Access</h1>
            <p className="admin-auth-subtitle">Enter your registered phone number</p>

            {error && <div className="admin-auth-error">{error}</div>}

            <form onSubmit={handlePhoneSubmit} className="admin-auth-form">
              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="admin-phone">Phone Number</label>
                <div className="admin-form-input-wrapper">
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", display: "flex" }}>
                    <PhoneIcon />
                  </span>
                  <input
                    id="admin-phone"
                    ref={phoneRef}
                    type="tel"
                    className="admin-form-input"
                    style={{ paddingLeft: 36 }}
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    autoComplete="tel"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="admin-auth-btn" disabled={loading}>
                {loading ? <span className="admin-btn-spinner" /> : "Send Verification Code"}
              </button>
            </form>

            <div className="admin-auth-security-note">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Secured admin portal — authorized personnel only
            </div>
          </>
        )}

        {/* ── STEP: OTP ────────────────────────────────── */}
        {step === "otp" && (
          <>
            <button
              className="admin-auth-back-btn"
              onClick={() => { setStep("phone"); setError(""); setOtpDigits(["", "", "", "", "", ""]); }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", fontSize: 13, padding: 0, marginBottom: 16 }}
            >
              <BackIcon /><span>Change number</span>
            </button>

            <h1 className="admin-auth-title">Verify identity</h1>
            <p className="admin-auth-subtitle">
              Code sent to <strong>{phone}</strong>
            </p>

            {error && <div className="admin-auth-error">{error}</div>}

            <form onSubmit={handleVerify} className="admin-auth-form">
              <div className="admin-otp-row" onPaste={handleOtpPaste}>
                {otpDigits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className="admin-otp-input"
                    value={d}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    aria-label={`OTP digit ${i + 1}`}
                  />
                ))}
              </div>

              <button type="submit" className="admin-auth-btn" disabled={loading}>
                {loading ? <span className="admin-btn-spinner" /> : "Verify & Access Dashboard"}
              </button>
            </form>

            <div className="admin-auth-footer" style={{ textAlign: "center", marginTop: 16 }}>
              {resendTimer > 0 ? (
                <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
                  Resend in <strong>{resendTimer}s</strong>
                </span>
              ) : (
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--admin-accent)", fontSize: 13, textDecoration: "underline" }}
                  onClick={handleResend}
                  disabled={loading}
                >
                  Resend code
                </button>
              )}
            </div>

            <p style={{ textAlign: "center", fontSize: 12, color: "var(--color-text-muted)", marginTop: 8 }}>
              Code expires in 5 minutes
            </p>
          </>
        )}

      </div>
    </div>
  );
}
