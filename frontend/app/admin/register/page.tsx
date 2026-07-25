"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import Link from "next/link";
import Image from "next/image";

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function AdminRegisterPage() {
  const { adminRegister } = useAdminAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", fullName: "", adminSecret: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { email: confirmedEmail } = await adminRegister(form.email, form.password, form.fullName, form.adminSecret);
      router.push(`/admin/verify-otp?email=${encodeURIComponent(confirmedEmail)}&mode=register`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
        <h1 className="admin-auth-title">Create admin account</h1>
        <p className="admin-auth-subtitle">You need the admin secret key to proceed</p>

        <form onSubmit={handleSubmit} className="admin-auth-form">
          {error && <div className="admin-auth-error">{error}</div>}

          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="reg-name">Full name</label>
            <input
              id="reg-name"
              type="text"
              className="admin-form-input"
              placeholder="Your full name"
              value={form.fullName}
              onChange={update("fullName")}
              required
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="reg-email">Email address</label>
            <input
              id="reg-email"
              type="email"
              className="admin-form-input"
              placeholder="admin@vahn.com"
              value={form.email}
              onChange={update("email")}
              required
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="reg-password">Password</label>
            <div className="admin-form-input-wrapper">
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                className="admin-form-input"
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={update("password")}
                required
              />
              <button
                type="button"
                className="admin-form-toggle-pw"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="reg-confirm-password">Confirm Password</label>
            <div className="admin-form-input-wrapper">
              <input
                id="reg-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                className="admin-form-input"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="admin-form-toggle-pw"
                onClick={() => setShowConfirmPassword(s => !s)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="reg-secret">Admin Secret Key</label>
            <div className="admin-form-input-wrapper">
              <input
                id="reg-secret"
                type={showSecret ? "text" : "password"}
                className="admin-form-input admin-form-input--secret"
                placeholder="Enter the admin secret key"
                value={form.adminSecret}
                onChange={update("adminSecret")}
                required
              />
              <button
                type="button"
                className="admin-form-toggle-pw"
                onClick={() => setShowSecret(s => !s)}
                aria-label={showSecret ? "Hide secret key" : "Show secret key"}
              >
                {showSecret ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            <span className="admin-form-hint">This key is set by the system administrator</span>
          </div>

          <button type="submit" className="admin-auth-btn" disabled={loading}>
            {loading ? <span className="admin-btn-spinner" /> : "Register & Send OTP"}
          </button>
        </form>

        <p className="admin-auth-footer">
          Already registered?{" "}
          <Link href="/admin/login" className="admin-auth-link">Sign in</Link>
        </p>

        <div className="admin-auth-security-note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Restricted to authorized personnel only
        </div>
      </div>
    </div>
  );
}
