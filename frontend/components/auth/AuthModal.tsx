'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function AuthModal() {
  const {
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
    openAuthModal,
    registerUser,
    loginUser,
    verifyOTP
  } = useAuth();

  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isAuthModalOpen) {
      setStep('form');
      setError('');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setOtpDigits(['', '', '', '', '', '']);
    }
  }, [isAuthModalOpen]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'otp' && resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  if (!isAuthModalOpen) return null;

  const handleTabChange = (mode: 'login' | 'register') => {
    setError('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    openAuthModal(mode);
  };

  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setError('Please enter a valid email address (e.g. name@example.com)');
      return;
    }

    if (authModalMode === 'register') {
      if (!fullName.trim()) {
        setError('Please enter your full name');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify.');
        return;
      }
    }

    setLoading(true);

    try {
      if (authModalMode === 'register') {
        await registerUser(email, password, fullName);
      } else {
        await loginUser(email, password);
      }
      setStep('otp');
      setResendTimer(60);
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);

    if (value && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setOtpDigits(digits);
      otpInputsRef.current[5]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otpDigits.join('');
    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits of the verification code');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await verifyOTP(email, otpCode);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setError('');
    setLoading(true);
    try {
      if (authModalMode === 'register') {
        await registerUser(email, password, fullName);
      } else {
        await loginUser(email, password);
      }
      setResendTimer(60);
      setError('A new verification code has been sent.');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={closeAuthModal}>
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="auth-modal-close" onClick={closeAuthModal} aria-label="Close modal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {step === 'form' ? (
          <>
            {/* Modal Tabs */}
            <div className="auth-modal-tabs">
              <button
                type="button"
                className={`auth-tab-btn ${authModalMode === 'login' ? 'active' : ''}`}
                onClick={() => handleTabChange('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab-btn ${authModalMode === 'register' ? 'active' : ''}`}
                onClick={() => handleTabChange('register')}
              >
                Register
              </button>
            </div>

            {error && <div className="auth-error-banner">{error}</div>}

            <form onSubmit={handleSubmitForm} className="auth-form">
              {authModalMode === 'register' && (
                <div className="auth-input-group">
                  <label className="auth-label">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="auth-input"
                  />
                </div>
              )}

              <div className="auth-input-group">
                <label className="auth-label">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                />
              </div>

              <div className="auth-input-group">
                <label className="auth-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="auth-input"
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="auth-password-toggle-btn"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {authModalMode === 'register' && (
                <div className="auth-input-group">
                  <label className="auth-label">Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="auth-input"
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="auth-password-toggle-btn"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading} className="auth-submit-btn">
                {loading
                  ? 'Processing...'
                  : authModalMode === 'register'
                  ? 'Continue to Verification'
                  : 'Sign In'}
              </button>
            </form>
          </>
        ) : (
          <>
            {/* 6-Digit OTP Verification Screen */}
            <div className="auth-otp-header">
              <h3 className="auth-otp-title">Verify Code</h3>
              <p className="auth-otp-subtitle">
                We sent a 6-digit code to <strong>{email}</strong>
              </p>
            </div>

            {error && <div className="auth-error-banner">{error}</div>}

            <form onSubmit={handleVerifyOtp} className="auth-otp-form">
              <div className="auth-otp-inputs-row">
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpInputsRef.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={handleOtpPaste}
                    className="auth-otp-digit-input"
                  />
                ))}
              </div>

              <button type="submit" disabled={loading} className="auth-submit-btn">
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>

              <div className="auth-resend-row">
                {resendTimer > 0 ? (
                  <span className="auth-timer-text">Resend code in {resendTimer}s</span>
                ) : (
                  <button type="button" onClick={handleResendOtp} className="auth-resend-btn">
                    Resend Verification Code
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
