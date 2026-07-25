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

export default function AdminLoginPage() {
  const { adminLogin } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { email: confirmedEmail } = await adminLogin(email, password);
      router.push(`/admin/verify-otp?email=${encodeURIComponent(confirmedEmail)}&mode=login`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
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
        <h1 className="admin-auth-title">Welcome back</h1>
        <p className="admin-auth-subtitle">Sign in to your admin account</p>

        <form onSubmit={handleSubmit} className="admin-auth-form">
          {error && <div className="admin-auth-error">{error}</div>}

          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="admin-email">Email address</label>
            <input
              id="admin-email"
              type="email"
              className="admin-form-input"
              placeholder="admin@vahn.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="admin-password">Password</label>
            <div className="admin-form-input-wrapper">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                className="admin-form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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

          <button
            type="submit"
            className="admin-auth-btn"
            disabled={loading}
          >
            {loading ? <span className="admin-btn-spinner" /> : "Send OTP & Continue"}
          </button>
        </form>

        <p className="admin-auth-footer">
          New admin?{" "}
          <Link href="/admin/register" className="admin-auth-link">
            Register with secret key
          </Link>
        </p>

        <div className="admin-auth-security-note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Secured admin portal — unauthorized access is prohibited
        </div>
      </div>
    </div>
  );
}
