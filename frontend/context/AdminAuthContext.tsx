"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getApiBaseUrl } from "@/lib/api/client";

const getEndpoint = (path: string) => `${getApiBaseUrl()}${path}`;

interface AdminUser {
  id: number;
  phone?: string;
  email?: string;
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
  adminCheckPhone: (phone: string) => Promise<{ exists: boolean; is_admin: boolean }>;
  adminSendOTP: (phone: string) => Promise<{ otp_token: string }>;
  adminVerifyOTP: (phone: string, otpCode: string, otpToken: string) => Promise<void>;
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
    } catch { /* ignore */ }
    finally { setIsAdminLoading(false); }
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

  const adminCheckPhone = useCallback(async (phone: string) => {
    const res = await fetch(getEndpoint("/admin/auth/check-phone"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to check phone");
    return data as { exists: boolean; is_admin: boolean };
  }, []);

  const adminSendOTP = useCallback(async (phone: string) => {
    const res = await fetch(getEndpoint("/admin/auth/send-otp"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to send OTP");
    return data as { otp_token: string };
  }, []);

  const adminVerifyOTP = useCallback(async (phone: string, otpCode: string, otpToken: string) => {
    const res = await fetch(getEndpoint("/admin/auth/verify-otp"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp_code: otpCode, otp_token: otpToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "OTP verification failed");

    const user: AdminUser = {
      id: data.user.id,
      phone: data.user.phone,
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
      adminCheckPhone,
      adminSendOTP,
      adminVerifyOTP,
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
