"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_verified: boolean;
}

interface AdminAuthState {
  adminUser: AdminUser | null;
  adminToken: string | null;
  isAdminLoading: boolean;
  isAdminAuthenticated: boolean;
}

interface AdminAuthContextValue extends AdminAuthState {
  adminLogin: (email: string, password: string) => Promise<{ email: string }>;
  adminRegister: (email: string, password: string, fullName: string, adminSecret: string) => Promise<{ email: string }>;
  adminVerifyOtp: (email: string, otp: string, mode: "login" | "register") => Promise<void>;
  adminLogout: () => void;
  getAdminHeaders: () => { Authorization: string; "Content-Type": string };
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

const ADMIN_TOKEN_KEY = "vahn_admin_token";
const ADMIN_USER_KEY = "vahn_admin_user";

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [isAdminLoading, setIsAdminLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(ADMIN_TOKEN_KEY);
      const savedUser = localStorage.getItem(ADMIN_USER_KEY);
      if (savedToken && savedUser) {
        setAdminToken(savedToken);
        setAdminUser(JSON.parse(savedUser));
      }
    } catch {
      // ignore
    } finally {
      setIsAdminLoading(false);
    }
  }, []);

  const persistAdmin = useCallback((token: string, user: AdminUser) => {
    setAdminToken(token);
    setAdminUser(user);
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  }, []);

  const adminLogout = useCallback(() => {
    setAdminToken(null);
    setAdminUser(null);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
  }, []);

  const getAdminHeaders = useCallback(() => ({
    Authorization: `Bearer ${adminToken || ""}`,
    "Content-Type": "application/json",
  }), [adminToken]);

  const adminRegister = useCallback(async (email: string, password: string, fullName: string, adminSecret: string) => {
    const res = await fetch(`${API_URL}/admin/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name: fullName, admin_secret: adminSecret }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Registration failed");
    return { email: data.email };
  }, []);

  const adminLogin = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Login failed");
    return { email: data.email };
  }, []);

  const adminVerifyOtp = useCallback(async (email: string, otp: string, mode: "login" | "register") => {
    const endpoint = mode === "login"
      ? `${API_URL}/admin/auth/login-verify-otp`
      : `${API_URL}/admin/auth/verify-otp`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp_code: otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "OTP verification failed");

    const user: AdminUser = {
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.full_name,
      role: "admin",
      is_verified: data.user.is_verified,
    };
    persistAdmin(data.access_token, user);
  }, [persistAdmin]);

  return (
    <AdminAuthContext.Provider value={{
      adminUser,
      adminToken,
      isAdminLoading,
      isAdminAuthenticated: !!adminToken && !!adminUser,
      adminLogin,
      adminRegister,
      adminVerifyOtp,
      adminLogout,
      getAdminHeaders,
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
