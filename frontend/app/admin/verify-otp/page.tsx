"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import Image from "next/image";

function AdminVerifyOtpInner() {
  const { adminVerifyOtp } = useAdminAuth();
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";
  const mode = (params.get("mode") || "login") as "login" | "register";

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function handleChange(idx: number, val: string) {
    const cleaned = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = cleaned;
    setDigits(next);
    if (cleaned && idx < 5) refs.current[idx + 1]?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
    e.preventDefault();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const otp = digits.join("");
    if (otp.length < 6) { setError("Please enter all 6 digits."); return; }
    setError("");
    setLoading(true);
    try {
      await adminVerifyOtp(email, otp, mode);
      router.push("/admin/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-auth-page">
      <div className="admin-auth-card">
        <div className="admin-auth-logo">
          <Image src="/assets/logo.png" alt="VAHN" width={110} height={26} style={{ objectFit: "contain", height: "auto" }} />
          <span className="admin-auth-logo-badge">Admin</span>
        </div>
        <h1 className="admin-auth-title">Verify your identity</h1>
        <p className="admin-auth-subtitle">
          We sent a 6-digit code to <strong>{email}</strong>
        </p>

        <form onSubmit={handleSubmit} className="admin-auth-form">
          {error && <div className="admin-auth-error">{error}</div>}

          <div className="admin-otp-row" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { refs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className="admin-otp-input"
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                aria-label={`OTP digit ${i + 1}`}
              />
            ))}
          </div>

          <button type="submit" className="admin-auth-btn" disabled={loading}>
            {loading ? <span className="admin-btn-spinner" /> : "Verify & Access Dashboard"}
          </button>
        </form>

        <p className="admin-auth-footer">
          Didn&apos;t receive it? Check your spam folder or{" "}
          <button
            className="admin-auth-link"
            onClick={() => router.back()}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            go back to resend
          </button>
        </p>
      </div>
    </div>
  );
}

export default function AdminVerifyOtpPage() {
  return (
    <Suspense fallback={<div className="admin-auth-page"><div className="admin-auth-card" /></div>}>
      <AdminVerifyOtpInner />
    </Suspense>
  );
}
