'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getApiBaseUrl } from '@/lib/api/client';

const getEndpoint = (path: string) => `${getApiBaseUrl()}${path}`;

export interface User {
  id: string;
  phone?: string;
  email?: string;
  full_name: string;
  is_verified: boolean;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: (onSuccess?: () => void) => void;
  closeAuthModal: () => void;
  // Phone-first OTP flow
  checkPhone: (phone: string) => Promise<{ exists: boolean }>;
  sendOTP: (phone: string, fullName?: string, email?: string) => Promise<{ otp_token: string; is_new_user: boolean }>;
  verifyOTP: (phone: string, otpCode: string, otpToken: string) => Promise<void>;
  logout: () => void;
  updateProfile: (fullName: string) => Promise<void>;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [successCallback, setSuccessCallback] = useState<(() => void) | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('vahn_auth_token');
    const savedUser = localStorage.getItem('vahn_auth_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      try { setUser(JSON.parse(savedUser)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const openAuthModal = (onSuccess?: () => void) => {
    if (onSuccess) setSuccessCallback(() => onSuccess);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setSuccessCallback(null);
  };

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const checkPhone = async (phone: string): Promise<{ exists: boolean }> => {
    const res = await fetch(getEndpoint('/auth/check-phone'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to check phone');
    }
    return res.json();
  };

  const sendOTP = async (phone: string, fullName?: string, email?: string): Promise<{ otp_token: string; is_new_user: boolean }> => {
    const res = await fetch(getEndpoint('/auth/send-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, full_name: fullName, email }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to send OTP');
    }
    return res.json();
  };

  const verifyOTP = async (phone: string, otpCode: string, otpToken: string): Promise<void> => {
    const res = await fetch(getEndpoint('/auth/verify-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp_code: otpCode, otp_token: otpToken }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Verification failed');
    }
    const data = await res.json();
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('vahn_auth_token', data.access_token);
    localStorage.setItem('vahn_auth_user', JSON.stringify(data.user));
    closeAuthModal();
    if (successCallback) {
      setTimeout(() => { successCallback(); setSuccessCallback(null); }, 100);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('vahn_auth_token');
    localStorage.removeItem('vahn_auth_user');
  };

  const updateProfile = async (fullName: string): Promise<void> => {
    const res = await fetch(getEndpoint('/auth/profile'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ full_name: fullName }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Profile update failed');
    }
    const updatedUser = await res.json();
    setUser(updatedUser);
    localStorage.setItem('vahn_auth_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading, isAuthModalOpen,
      openAuthModal, closeAuthModal,
      checkPhone, sendOTP, verifyOTP,
      logout, updateProfile, getAuthHeaders,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
