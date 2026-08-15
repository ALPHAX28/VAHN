'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getApiBaseUrl } from '@/lib/api/client';
import SuspensionModal from '@/components/auth/SuspensionModal';

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
  // Email-first OTP flow
  checkEmail: (email: string) => Promise<{ exists: boolean }>;
  checkPhone: (phone: string) => Promise<{ exists: boolean }>;
  sendOTP: (email: string, fullName?: string, phone?: string) => Promise<{ otp_token: string; is_new_user: boolean }>;
  verifyOTP: (email: string, otpCode: string, otpToken: string) => Promise<void>;
  logout: () => void;
  updateProfile: (fullName?: string, phone?: string) => Promise<void>;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [successCallback, setSuccessCallback] = useState<(() => void) | null>(null);

  const [suspensionNotice, setSuspensionNotice] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: ""
  });

  const triggerSuspensionNotice = (message: string) => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('vahn_auth_token');
    localStorage.removeItem('vahn_auth_user');
    setSuspensionNotice({ isOpen: true, message });
  };

  const handleCloseSuspensionModal = () => {
    setSuspensionNotice({ isOpen: false, message: "" });
    if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/account') || window.location.pathname.startsWith('/checkout'))) {
      window.location.href = '/';
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('vahn_auth_token');
    const savedUser = localStorage.getItem('vahn_auth_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      try { setUser(JSON.parse(savedUser)); } catch { /* ignore */ }
    }
    setLoading(false);

    // Cross-tab logout listener (if token cleared in one tab, sync across all tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'vahn_auth_token' && !e.newValue) {
        setToken(null);
        setUser(null);
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/account')) {
          window.location.href = '/';
        }
      }
    };

    // Custom event listener for API 403 suspension responses
    const handleSuspension = (e: Event) => {
      const customEvent = e as CustomEvent<{ message?: string }>;
      const msg = customEvent.detail?.message || "Your account access has been restricted by administration.";
      triggerSuspensionNotice(msg);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('vahn_auth_suspended', handleSuspension);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('vahn_auth_suspended', handleSuspension);
    };
  }, []);

  // Periodic active session validator (polls /auth/me every 6s & on window focus)
  useEffect(() => {
    if (!token) return;

    let isChecking = false;
    const validateSession = async () => {
      if (isChecking) return;
      isChecking = true;
      try {
        const res = await fetch(getEndpoint('/auth/me'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
          if (res.status === 403 || res.status === 401 || res.status === 404) {
            let errorMsg = "Your account status has changed or has been restricted.";
            try {
              const errData = await res.json();
              if (errData && errData.detail) errorMsg = errData.detail;
            } catch { /* ignore */ }

            triggerSuspensionNotice(errorMsg);
          }
        } else {
          const freshUser = await res.json();
          setUser(freshUser);
          localStorage.setItem('vahn_auth_user', JSON.stringify(freshUser));
        }
      } catch {
        // Network error — do not log out on temporary offline state
      } finally {
        isChecking = false;
      }
    };

    validateSession();

    const onFocus = () => validateSession();
    window.addEventListener('focus', onFocus);

    const interval = setInterval(validateSession, 6000);

    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [token]);




  const openAuthModal = (onSuccess?: () => void) => {
    if (onSuccess) setSuccessCallback(() => onSuccess);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setSuccessCallback(null);
  };

function formatApiError(errData: any, defaultMsg = 'An error occurred'): string {
  if (!errData) return defaultMsg;
  if (typeof errData === 'string') return errData;
  if (typeof errData.detail === 'string') return errData.detail;
  if (Array.isArray(errData.detail) && errData.detail.length > 0) {
    return errData.detail.map((d: any) => d.msg || (typeof d === 'string' ? d : JSON.stringify(d))).join(', ');
  }
  if (typeof errData.message === 'string') return errData.message;
  if (typeof errData.error === 'string') return errData.error;
  return defaultMsg;
}

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const checkEmail = async (email: string): Promise<{ exists: boolean }> => {
    const res = await fetch(getEndpoint('/auth/check-email'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      let errMsg = 'Failed to check email';
      try {
        const err = await res.json();
        errMsg = formatApiError(err, errMsg);
      } catch {
        errMsg = `Server error (${res.status}). Please try again.`;
      }
      throw new Error(errMsg);
    }
    return res.json();
  };

  const checkPhone = async (phone: string): Promise<{ exists: boolean }> => {
    const res = await fetch(getEndpoint('/auth/check-phone'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      let errMsg = 'Failed to check phone';
      try {
        const err = await res.json();
        errMsg = formatApiError(err, errMsg);
      } catch {
        errMsg = `Server error (${res.status}). Please try again.`;
      }
      throw new Error(errMsg);
    }
    return res.json();
  };

  const sendOTP = async (email: string, fullName?: string, phone?: string): Promise<{ otp_token: string; is_new_user: boolean }> => {
    const res = await fetch(getEndpoint('/auth/send-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, full_name: fullName, phone }),
    });
    if (!res.ok) {
      let errMsg = 'Failed to send OTP';
      try {
        const err = await res.json();
        errMsg = formatApiError(err, errMsg);
      } catch {
        errMsg = `Server error (${res.status}). Please try again.`;
      }
      throw new Error(errMsg);
    }
    return res.json();
  };

  const verifyOTP = async (email: string, otpCode: string, otpToken: string): Promise<void> => {
    const res = await fetch(getEndpoint('/auth/verify-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp_code: otpCode, otp_token: otpToken }),
    });
    if (!res.ok) {
      let errMsg = 'Verification failed';
      try {
        const err = await res.json();
        errMsg = formatApiError(err, errMsg);
      } catch {
        errMsg = `Server error (${res.status}). Please try again.`;
      }
      throw new Error(errMsg);
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

  const updateProfile = async (fullName?: string, phone?: string): Promise<void> => {
    const res = await fetch(getEndpoint('/auth/profile'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ full_name: fullName, phone }),
    });
    if (!res.ok) {
      let errMsg = 'Profile update failed';
      try {
        const err = await res.json();
        errMsg = formatApiError(err, errMsg);
      } catch {
        errMsg = `Server error (${res.status}). Please try again.`;
      }
      throw new Error(errMsg);
    }
    const updatedUser = await res.json();
    setUser(updatedUser);
    localStorage.setItem('vahn_auth_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading, isAuthModalOpen,
      openAuthModal, closeAuthModal,
      checkEmail, checkPhone, sendOTP, verifyOTP,
      logout, updateProfile, getAuthHeaders,
    }}>
      {children}
      <SuspensionModal
        isOpen={suspensionNotice.isOpen}
        message={suspensionNotice.message}
        onClose={handleCloseSuspensionModal}
      />
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
