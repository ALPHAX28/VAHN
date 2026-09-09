'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import TrustBadgesBar from '@/components/ui/TrustBadgesBar';
import PolicyTabs from '@/components/ui/PolicyTabs';

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  phone: string;
  orderNumber: string;
  subject: string;
  message: string;
}

type ValidatedField = 'firstName' | 'lastName' | 'email' | 'phone' | 'orderNumber' | 'subject' | 'message';

type FormErrors = Partial<Record<ValidatedField, string>>;

const initialFormData: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  countryCode: '+91',
  phone: '',
  orderNumber: '',
  subject: '',
  message: '',
};

const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91 (IN)' },
  { code: '+1', label: '🇺🇸 +1 (US/CA)' },
  { code: '+44', label: '🇬🇧 +44 (UK)' },
  { code: '+971', label: '🇦🇪 +971 (AE)' },
  { code: '+61', label: '🇦🇺 +61 (AU)' },
  { code: '+65', label: '🇸🇬 +65 (SG)' },
  { code: '+49', label: '🇩🇪 +49 (DE)' },
  { code: '+33', label: '🇫🇷 +33 (FR)' },
  { code: '+81', label: '🇯🇵 +81 (JP)' },
  { code: '+966', label: '🇸🇦 +966 (SA)' },
  { code: '+974', label: '🇶🇦 +974 (QA)' },
  { code: '+965', label: '🇰🇼 +965 (KW)' },
  { code: '+64', label: '🇳🇿 +64 (NZ)' },
  { code: '+880', label: '🇧🇩 +880 (BD)' },
  { code: '+977', label: '🇳🇵 +977 (NP)' },
  { code: '+94', label: '🇱🇰 +94 (LK)' },
  { code: '+86', label: '🇨🇳 +86 (CN)' },
  { code: '+39', label: '🇮🇹 +39 (IT)' },
  { code: '+34', label: '🇪🇸 +34 (ES)' },
  { code: '+31', label: '🇳🇱 +31 (NL)' },
];

const containsEmoji = (str: string): boolean => {
  return /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/u.test(str);
};

const containsLink = (str: string): boolean => {
  if (!str) return false;
  return /(https?:\/\/|ftp:\/\/|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|org|net|io|co|in|ai|app|dev|biz|info|me|xyz|online|store|shop|site|page)\b)/i.test(str);
};

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormState>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  const validateField = (name: keyof FormState, value: string): string | undefined => {
    const trimmed = value.trim();

    switch (name) {
      case 'firstName':
      case 'lastName': {
        const label = name === 'firstName' ? 'First name' : 'Last name';
        if (!trimmed) return `${label} is required.`;
        if (containsLink(trimmed)) return 'Links and URLs are not permitted.';
        if (containsEmoji(trimmed)) return 'Emojis are not permitted.';
        if (!/^[\p{L}\s'-]+$/u.test(trimmed)) {
          return `${label} can only contain letters, spaces, hyphens, and apostrophes (no numbers or special characters).`;
        }
        if (trimmed.length < 2) return `${label} must be at least 2 characters.`;
        return undefined;
      }

      case 'email': {
        if (!trimmed) return 'Email address is required.';
        if (/(https?:\/\/|ftp:\/\/|www\.)/i.test(trimmed)) {
          return 'Please enter a valid email address, not a website link.';
        }
        if (containsEmoji(trimmed)) return 'Emojis are not permitted in email address.';
        if (trimmed.includes('..')) return 'Email contains invalid consecutive dots.';
        if (/\.(com|org|net|in|co|io|edu|gov)\.\1$/i.test(trimmed)) {
          return 'Invalid domain suffix in email address.';
        }
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,10})+$/;
        if (!emailRegex.test(trimmed)) {
          return 'Please enter a valid email address (e.g. name@example.com).';
        }
        return undefined;
      }

      case 'phone': {
        if (!trimmed) return undefined; // Phone is optional
        if (containsLink(trimmed)) return 'Links and URLs are not permitted in phone number.';
        if (containsEmoji(trimmed)) return 'Emojis are not permitted in phone number.';
        const digitsOnly = trimmed.replace(/\D/g, '');
        if (digitsOnly.length < 7 || digitsOnly.length > 15) {
          return 'Please enter a valid phone number (7 to 15 digits).';
        }
        return undefined;
      }

      case 'orderNumber': {
        if (!trimmed) return undefined; // Optional
        if (containsLink(trimmed)) return 'Links and URLs are not permitted in order number.';
        if (containsEmoji(trimmed)) return 'Emojis are not permitted in order number.';
        if (!/^[a-zA-Z0-9#\s-]+$/.test(trimmed)) {
          return 'Order number can only contain letters, numbers, hyphens, and #.';
        }
        return undefined;
      }

      case 'subject': {
        if (!trimmed) return 'Please select a topic.';
        return undefined;
      }

      case 'message': {
        if (!trimmed) return 'Message is required.';
        if (containsLink(trimmed)) {
          return 'Links and website URLs are not allowed in your message. Please remove any website links.';
        }
        if (trimmed.length < 10) return 'Message must be at least 10 characters long.';
        return undefined;
      }

      default:
        return undefined;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strictly strip any alphabets, emojis, and special characters other than digits, spaces, hyphens
    const filtered = e.target.value.replace(/[^\d\s-]/g, '');
    setFormData((prev) => ({ ...prev, phone: filtered }));
    if (errors.phone) {
      const err = validateField('phone', filtered);
      setErrors((prev) => ({ ...prev, phone: err }));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as ValidatedField]) {
      const err = validateField(name as keyof FormState, value);
      setErrors((prev) => ({ ...prev, [name]: err }));
    }
  };

  const handleBlur = (field: ValidatedField) => {
    const err = validateField(field, formData[field]);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate all fields
    const newErrors: FormErrors = {};
    const fieldsToValidate: ValidatedField[] = ['firstName', 'lastName', 'email', 'phone', 'orderNumber', 'subject', 'message'];
    for (const field of fieldsToValidate) {
      const err = validateField(field, formData[field]);
      if (err) newErrors[field] = err;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 900));

    // SCRUM-74: Reset all form fields data to blank
    setFormData(initialFormData);
    setErrors({});
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', color: '#111111' }}>
      {/* ── Page Header ── */}
      <section
        style={{
          background: '#0d0d0d',
          color: '#ffffff',
          padding: 'clamp(52px, 7vw, 84px) clamp(24px, 5vw, 64px) clamp(40px, 5vw, 64px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#4232d9',
              marginBottom: '16px',
            }}
          >
            Customer Care &bull; Support
          </p>

          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.85rem, 4vw, 3.25rem)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              textTransform: 'uppercase',
              lineHeight: 1.15,
              margin: '0 0 18px',
              color: '#ffffff',
            }}
          >
            Get In Touch
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-body), Georgia, serif',
              fontSize: 'clamp(0.95rem, 1.2vw, 1.125rem)',
              color: 'rgba(255, 255, 255, 0.75)',
              maxWidth: '640px',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            We read every message. Whether you have an order question, teamwear enquiry, or design feedback, our team is here to assist.
          </p>
        </div>
      </section>

      {/* ── Subnav Tabs Bar (SCRUM-75) ── */}
      <PolicyTabs activeHandle="contact" />

      {/* ── 2-Column Main Content ── */}
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: 'clamp(44px, 6vw, 72px) clamp(20px, 4vw, 40px)',
          display: 'grid',
          gridTemplateColumns: 'clamp(300px, 35vw, 400px) minmax(0, 1fr)',
          gap: 'clamp(36px, 5vw, 64px)',
          alignItems: 'flex-start',
        }}
        className="vahn-contact-grid"
      >
        {/* Left Column: Direct Support Channels */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            style={{
              background: '#fbfbfb',
              border: '1px solid var(--color-border)',
              borderLeft: '3px solid #4232d9',
              padding: 'clamp(24px, 3.5vw, 36px)',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.9375rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#111111',
                margin: '0 0 20px',
              }}
            >
              Direct Support Channels
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#888',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Direct Email
                </span>
                <a
                  href="mailto:support@vahnsports.com"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#4232d9',
                    textDecoration: 'none',
                  }}
                >
                  support@vahnsports.com
                </a>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#666' }}>
                  Response guaranteed within 24 hours on business days.
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#888',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Phone &amp; WhatsApp
                </span>
                <a
                  href="tel:+918013340567"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#111111',
                    textDecoration: 'none',
                  }}
                >
                  +91 8013340567
                </a>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#666' }}>
                  Monday to Saturday, 10:00 AM – 6:00 PM IST
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#888',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Studio &amp; Operations
                </span>
                <p style={{ margin: 0, fontSize: '0.9375rem', color: '#111', fontWeight: 600 }}>
                  VAHN STUDIOS
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#666' }}>
                  New Delhi, India
                </p>
              </div>
            </div>
          </div>

          {/* Helpful Quick Links Card */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--color-border)',
              padding: '24px',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                margin: '0 0 12px',
                color: '#111111',
              }}
            >
              Self-Service Shortcuts
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8125rem' }}>
              <Link href="/account/orders" style={{ color: '#4232d9', textDecoration: 'underline' }}>
                Track My Order &rarr;
              </Link>
              <Link href="/pages/shipping" style={{ color: '#4232d9', textDecoration: 'underline' }}>
                Returns &amp; Exchange Policy &rarr;
              </Link>
              <Link href="/pages/terms-and-conditions" style={{ color: '#4232d9', textDecoration: 'underline' }}>
                View Terms &amp; Conditions &rarr;
              </Link>
            </div>
          </div>
        </aside>

        {/* Right Column: Premium Contact Form */}
        <main
          style={{
            background: '#ffffff',
            border: '1px solid var(--color-border)',
            padding: 'clamp(28px, 4.5vw, 48px)',
          }}
        >
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: '#4232d9',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px',
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px' }}>
                Message Received
              </h2>
              <p style={{ fontFamily: 'var(--font-body), Georgia, serif', color: 'var(--color-grey-dark)', fontSize: '1.05rem', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto 28px' }}>
                Thank you for reaching out. Our support team will review your inquiry and respond to your email within 24 hours on business days.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFormData(initialFormData);
                  setErrors({});
                  setSubmitted(false);
                }}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', textTransform: 'uppercase', padding: '10px 24px' }}
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div style={{ marginBottom: '28px' }}>
                <h2
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '-0.02em',
                    margin: '0 0 8px',
                    color: '#111',
                  }}
                >
                  Send a Message
                </h2>
                <p style={{ fontFamily: 'var(--font-body), Georgia, serif', fontSize: '0.9375rem', color: '#666', margin: 0 }}>
                  Fill in the details below and our team will get back to you promptly.
                </p>
              </div>

              {Object.keys(errors).length > 0 && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fee2e2',
                    borderLeft: '4px solid #d93025',
                    padding: '12px 16px',
                    marginBottom: '20px',
                    fontSize: '0.8125rem',
                    color: '#991b1b',
                  }}
                >
                  Please review and correct the highlighted fields below.
                </div>
              )}

              {/* First Name & Last Name */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="firstName">First Name *</label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    className="input"
                    required
                    style={{
                      borderColor: errors.firstName ? '#d93025' : undefined,
                      boxShadow: errors.firstName ? '0 0 0 1px #d93025' : undefined,
                    }}
                    value={formData.firstName}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('firstName')}
                  />
                  {errors.firstName && (
                    <span style={{ display: 'block', color: '#d93025', fontSize: '0.75rem', marginTop: '4px', fontWeight: 500, fontFamily: 'var(--font-ui)' }}>
                      {errors.firstName}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="lastName">Last Name *</label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    className="input"
                    required
                    style={{
                      borderColor: errors.lastName ? '#d93025' : undefined,
                      boxShadow: errors.lastName ? '0 0 0 1px #d93025' : undefined,
                    }}
                    value={formData.lastName}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('lastName')}
                  />
                  {errors.lastName && (
                    <span style={{ display: 'block', color: '#d93025', fontSize: '0.75rem', marginTop: '4px', fontWeight: 500, fontFamily: 'var(--font-ui)' }}>
                      {errors.lastName}
                    </span>
                  )}
                </div>
              </div>

              {/* Email & Phone with Country Code */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">Email Address *</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="input"
                    required
                    style={{
                      borderColor: errors.email ? '#d93025' : undefined,
                      boxShadow: errors.email ? '0 0 0 1px #d93025' : undefined,
                    }}
                    value={formData.email}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('email')}
                  />
                  {errors.email && (
                    <span style={{ display: 'block', color: '#d93025', fontSize: '0.75rem', marginTop: '4px', fontWeight: 500, fontFamily: 'var(--font-ui)' }}>
                      {errors.email}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="phone">Phone Number (Optional)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      id="countryCode"
                      name="countryCode"
                      className="input"
                      style={{
                        width: '135px',
                        flexShrink: 0,
                        padding: '0 8px',
                        fontSize: '0.8125rem',
                        background: '#ffffff',
                        cursor: 'pointer',
                      }}
                      value={formData.countryCode}
                      onChange={(e) => setFormData((prev) => ({ ...prev, countryCode: e.target.value }))}
                      aria-label="Country Code"
                    >
                      {COUNTRY_CODES.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      className="input"
                      placeholder="98765 43210"
                      style={{
                        flex: 1,
                        borderColor: errors.phone ? '#d93025' : undefined,
                        boxShadow: errors.phone ? '0 0 0 1px #d93025' : undefined,
                      }}
                      value={formData.phone}
                      onChange={handlePhoneChange}
                      onBlur={() => handleBlur('phone')}
                    />
                  </div>
                  {errors.phone && (
                    <span style={{ display: 'block', color: '#d93025', fontSize: '0.75rem', marginTop: '4px', fontWeight: 500, fontFamily: 'var(--font-ui)' }}>
                      {errors.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Order Number & Subject */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="orderNumber">Order Number (If Applicable)</label>
                  <input
                    id="orderNumber"
                    name="orderNumber"
                    type="text"
                    className="input"
                    placeholder="e.g. ORD-123456"
                    style={{
                      borderColor: errors.orderNumber ? '#d93025' : undefined,
                      boxShadow: errors.orderNumber ? '0 0 0 1px #d93025' : undefined,
                    }}
                    value={formData.orderNumber}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('orderNumber')}
                  />
                  {errors.orderNumber && (
                    <span style={{ display: 'block', color: '#d93025', fontSize: '0.75rem', marginTop: '4px', fontWeight: 500, fontFamily: 'var(--font-ui)' }}>
                      {errors.orderNumber}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="subject">Subject *</label>
                  <select
                    id="subject"
                    name="subject"
                    className="input"
                    required
                    style={{
                      borderColor: errors.subject ? '#d93025' : undefined,
                      boxShadow: errors.subject ? '0 0 0 1px #d93025' : undefined,
                    }}
                    value={formData.subject}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('subject')}
                  >
                    <option value="">Select a topic</option>
                    <option value="order">Order Tracking / Status</option>
                    <option value="return">Return or Exchange</option>
                    <option value="bespoke">Bespoke Teamwear Enquiry</option>
                    <option value="product">Product &amp; Sizing Question</option>
                    <option value="other">General Feedback / Other</option>
                  </select>
                  {errors.subject && (
                    <span style={{ display: 'block', color: '#d93025', fontSize: '0.75rem', marginTop: '4px', fontWeight: 500, fontFamily: 'var(--font-ui)' }}>
                      {errors.subject}
                    </span>
                  )}
                </div>
              </div>

              {/* Message */}
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  name="message"
                  className="input"
                  rows={5}
                  required
                  placeholder="How can we help? (Please do not include website links)"
                  style={{
                    resize: 'vertical',
                    borderColor: errors.message ? '#d93025' : undefined,
                    boxShadow: errors.message ? '0 0 0 1px #d93025' : undefined,
                  }}
                  value={formData.message}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur('message')}
                />
                {errors.message && (
                  <span style={{ display: 'block', color: '#d93025', fontSize: '0.75rem', marginTop: '4px', fontWeight: 500, fontFamily: 'var(--font-ui)' }}>
                    {errors.message}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={loading}
                style={{
                  background: '#4232d9',
                  borderColor: '#4232d9',
                  padding: '14px 28px',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Sending Message...' : 'Send Message →'}
              </button>
            </form>
          )}
        </main>
      </div>

      {/* ── Bottom Trust Badges ── */}
      <TrustBadgesBar />
    </div>
  );
}
