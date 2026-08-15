'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';

// ── Icons ────────────────────────────────────────────────────
function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

// ── Step machine ─────────────────────────────────────────────
type Step = 'email' | 'details' | 'otp';

export default function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, checkEmail, sendOTP, verifyOTP } = useAuth();

  // State
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [showExtraFields, setShowExtraFields] = useState(false);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const emailRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (isAuthModalOpen) {
      document.body.style.overflow = 'hidden';
      setStep('email');
      setEmail('');
      setFullName('');
      setPhone('');
      setOtpToken('');
      setOtpDigits(['', '', '', '', '', '']);
      setError('');
      setLoading(false);
      setShowExtraFields(false);
      setTimeout(() => emailRef.current?.focus(), 120);
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isAuthModalOpen]);

  // Resend timer
  useEffect(() => {
    if (step !== 'otp') return;
    setResendTimer(30);
    const id = setInterval(() => setResendTimer(p => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [step]);

  if (!isAuthModalOpen) return null;

  // ── Step 1 — Email entry ──────────────────────────────────
  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const result = await checkEmail(trimmed);
      if (result.exists) {
        // Existing user — send OTP to email directly
        const { otp_token } = await sendOTP(trimmed);
        setOtpToken(otp_token);
        setIsNewUser(false);
        setStep('otp');
        setTimeout(() => otpRefs.current[0]?.focus(), 120);
      } else {
        // New user — prompt for Full Name AND Phone (required)
        setIsNewUser(true);
        setShowExtraFields(true);
        setStep('details');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 — New user details + send OTP ─────────────────
  const handleDetailsSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedName = fullName.trim();
    const cleanDigits = phone.replace(/\D/g, '');

    if (!trimmedName) {
      setError('Please enter your full name.');
      return;
    }
    if (!cleanDigits) {
      setError('Please enter your phone number.');
      return;
    }
    if (cleanDigits.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = '+91' + cleanDigits;
      const { otp_token } = await sendOTP(email.trim().toLowerCase(), trimmedName, formattedPhone);
      setOtpToken(otp_token);
      setStep('otp');
      setTimeout(() => otpRefs.current[0]?.focus(), 120);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3 — OTP verify ───────────────────────────────────
  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otpDigits];
    next[idx] = val.slice(-1);
    setOtpDigits(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtpDigits(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < 6) { setError('Please enter all 6 digits.'); return; }
    setError('');
    setLoading(true);
    try {
      await verifyOTP(email.trim().toLowerCase(), code, otpToken);
      // success — modal closes automatically via context
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError('');
    setLoading(true);
    try {
      let formattedPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
      if (/^\d{10}$/.test(formattedPhone)) {
        formattedPhone = '+91' + formattedPhone;
      } else if (/^91\d{10}$/.test(formattedPhone)) {
        formattedPhone = '+' + formattedPhone;
      }
      const { otp_token } = await sendOTP(
        email.trim().toLowerCase(),
        isNewUser ? fullName.trim() : undefined,
        isNewUser ? formattedPhone : undefined,
      );
      setOtpToken(otp_token);
      setOtpDigits(['', '', '', '', '', '']);
      setResendTimer(30);
      otpRefs.current[0]?.focus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="auth-modal-overlay" onClick={closeAuthModal}>
      <div className="auth-modal-card" onClick={e => e.stopPropagation()}>

        {/* Close button */}
        <button className="auth-modal-close" onClick={closeAuthModal} aria-label="Close">
          <CloseIcon />
        </button>

        {/* Logo */}
        <div className="auth-modal-logo">
          <Image src="/assets/logo.png" alt="VAHN" width={90} height={22} style={{ objectFit: 'contain', height: 'auto' }} />
        </div>

        {/* ── STEP: Email ──────────────────────────────── */}
        {step === 'email' && (
          <>
            <h2 className="auth-modal-title">Sign in to VAHN</h2>
            <p className="auth-modal-subtitle">Enter your email address to continue</p>

            {error && <div className="auth-error-banner">{error}</div>}

            <form onSubmit={handleEmailContinue} className="auth-form">
              <div className="auth-input-group">
                <label className="auth-label" htmlFor="auth-email">Email Address</label>
                <div className="auth-input-icon-wrapper">
                  <span className="auth-input-icon"><MailIcon /></span>
                  <input
                    id="auth-email"
                    ref={emailRef}
                    type="email"
                    className="auth-input auth-input--with-icon"
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <span className="auth-input-hint">We'll send a verification code to this email</span>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? <span className="auth-spinner" /> : (
                  <><span>Continue</span><ArrowRightIcon /></>
                )}
              </button>
            </form>
          </>
        )}

        {/* ── STEP: Details (new user) ──────────────── */}
        {step === 'details' && (
          <>
            <button className="auth-back-btn" onClick={() => { setStep('email'); setError(''); setShowExtraFields(false); }}>
              <BackIcon /><span>Change email</span>
            </button>

            <h2 className="auth-modal-title">Create your account</h2>
            <p className="auth-modal-subtitle">
              <strong>{email}</strong> is new to VAHN — please complete your details
            </p>

            {error && <div className="auth-error-banner">{error}</div>}

            <div className={`auth-extra-fields ${showExtraFields ? 'auth-extra-fields--visible' : ''}`}>
              <form onSubmit={handleDetailsSend} className="auth-form">
                <div className="auth-input-group">
                  <label className="auth-label" htmlFor="auth-name">Full Name *</label>
                  <input
                    id="auth-name"
                    type="text"
                    className="auth-input"
                    placeholder="Your full name"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div className="auth-input-group">
                  <label className="auth-label" htmlFor="auth-phone">Phone Number *</label>
                  <div className="auth-input-icon-wrapper">
                    <span className="auth-input-icon"><PhoneIcon /></span>
                    <input
                      id="auth-phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      className="auth-input auth-input--with-icon"
                      placeholder="10-digit mobile number"
                      value={phone}
                      onChange={e => {
                        const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setPhone(digitsOnly);
                        if (error) setError('');
                      }}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading ? <span className="auth-spinner" /> : (
                    <><span>Send Verification Code</span><ArrowRightIcon /></>
                  )}
                </button>
              </form>
            </div>
          </>
        )}

        {/* ── STEP: OTP ────────────────────────────────── */}
        {step === 'otp' && (
          <>
            <button className="auth-back-btn" onClick={() => { setStep(isNewUser ? 'details' : 'email'); setError(''); setOtpDigits(['', '', '', '', '', '']); }}>
              <BackIcon /><span>Go back</span>
            </button>

            <h2 className="auth-modal-title">Enter verification code</h2>
            <p className="auth-modal-subtitle">
              A 6-digit code was sent to <strong>{email}</strong>
            </p>

            {error && <div className="auth-error-banner">{error}</div>}

            <form onSubmit={handleVerify} className="auth-otp-form">
              <div className="auth-otp-inputs-row" onPaste={handleOtpPaste}>
                {otpDigits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className="auth-otp-digit-input"
                    value={d}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    aria-label={`OTP digit ${i + 1}`}
                  />
                ))}
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? <span className="auth-spinner" /> : 'Verify & Sign In'}
              </button>

              <div className="auth-resend-row">
                {resendTimer > 0 ? (
                  <span className="auth-timer-text">Resend code in <strong>{resendTimer}s</strong></span>
                ) : (
                  <button type="button" className="auth-resend-btn" onClick={handleResend} disabled={loading}>
                    Resend verification code
                  </button>
                )}
              </div>

              <p className="auth-otp-note">
                Code expires in 5 minutes. Please check your email inbox.
              </p>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
