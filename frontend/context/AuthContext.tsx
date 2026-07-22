'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_verified: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';
  openAuthModal: (mode?: 'login' | 'register', onLoginSuccess?: () => void) => void;
  closeAuthModal: () => void;
  registerUser: (email: string, pass: string, fullName: string) => Promise<void>;
  loginUser: (email: string, pass: string) => Promise<void>;
  verifyOTP: (email: string, otp: string) => Promise<void>;
  logout: () => void;
  updateProfile: (fullName: string) => Promise<void>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '');

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [successCallback, setSuccessCallback] = useState<(() => void) | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('vahn_auth_token');
    const savedUser = localStorage.getItem('vahn_auth_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('vahn_auth_user');
      }
    }
    setLoading(false);
  }, []);

  const openAuthModal = (mode: 'login' | 'register' = 'login', onLoginSuccess?: () => void) => {
    setAuthModalMode(mode);
    if (onLoginSuccess) {
      setSuccessCallback(() => onLoginSuccess);
    } else {
      setSuccessCallback(null);
    }
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setSuccessCallback(null);
  };

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const registerUser = async (email: string, pass: string, fullName: string) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, full_name: fullName })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Registration failed');
    }
  };

  const loginUser = async (email: string, pass: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Login failed');
    }
  };

  const verifyOTP = async (email: string, otp: string) => {
    const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp_code: otp })
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
      setTimeout(() => {
        successCallback();
        setSuccessCallback(null);
      }, 100);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('vahn_auth_token');
    localStorage.removeItem('vahn_auth_user');
  };

  const updateProfile = async (fullName: string) => {
    const res = await fetch(`${API_BASE}/api/auth/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ full_name: fullName })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Profile update failed');
    }
    const updatedUser = await res.json();
    setUser(updatedUser);
    localStorage.setItem('vahn_auth_user', JSON.stringify(updatedUser));
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    const res = await fetch(`${API_BASE}/api/auth/change-password`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ current_password: currentPass, new_password: newPass })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Password change failed');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        registerUser,
        loginUser,
        verifyOTP,
        logout,
        updateProfile,
        changePassword,
        getAuthHeaders
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
