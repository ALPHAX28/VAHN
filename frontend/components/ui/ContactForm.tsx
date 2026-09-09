'use client';

import { useState } from 'react';
import { getApiBaseUrl } from '@/lib/api/client';

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

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  phone: string;
  subject: string;
  message: string;
}

const initialFormState: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  countryCode: '+91',
  phone: '',
  subject: '',
  message: '',
};

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const containsEmoji = (str: string) => /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/u.test(str);
  const containsLink = (str: string) => /(https?:\/\/|ftp:\/\/|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|org|net|io|co|in|ai|app|dev|biz|info|me|xyz|online|store|shop|site)\b)/i.test(str);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const errs: Record<string, string> = {};
    if (!formData.firstName.trim() || !/^[\p{L}\s'-]+$/u.test(formData.firstName.trim()) || containsEmoji(formData.firstName) || containsLink(formData.firstName)) {
      errs.firstName = 'Valid first name is required (letters only, no emojis or links).';
    }
    if (!formData.lastName.trim() || !/^[\p{L}\s'-]+$/u.test(formData.lastName.trim()) || containsEmoji(formData.lastName) || containsLink(formData.lastName)) {
      errs.lastName = 'Valid last name is required (letters only, no emojis or links).';
    }
    const emailTrimmed = formData.email.trim();
    if (!emailTrimmed || containsLink(emailTrimmed) || containsEmoji(emailTrimmed) || emailTrimmed.includes('..') || /\.(com|org|net|in|co)\.\1$/i.test(emailTrimmed) || !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,10})+$/.test(emailTrimmed)) {
      errs.email = 'Please enter a valid email address.';
    }
    if (formData.phone) {
      const digits = formData.phone.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15 || containsLink(formData.phone) || containsEmoji(formData.phone)) {
        errs.phone = 'Valid phone number is required (7 to 15 digits).';
      }
    }
    if (!formData.subject) {
      errs.subject = 'Please select a topic.';
    }
    if (!formData.message.trim() || formData.message.trim().length < 10) {
      errs.message = 'Message must be at least 10 characters.';
    } else if (containsLink(formData.message)) {
      errs.message = 'Links/URLs are not allowed in messages.';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          country_code: formData.countryCode,
          phone: formData.phone || null,
          subject: formData.subject,
          message: formData.message,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to submit form');
      }

      setFormData(initialFormState);
      setErrors({});
      setSubmitted(true);
    } catch (e: any) {
      setErrors({ submit: e.message || 'Error submitting message. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="contact-form" style={{ textAlign: 'center' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: 'var(--color-navy)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="white" strokeWidth="2">
            <polyline points="4,14 11,21 24,8" />
          </svg>
        </div>
        <h2>Message Sent!</h2>
        <p style={{ color: 'var(--color-grey-dark)', marginTop: '12px', fontFamily: 'var(--font-body)' }}>
          Thank you for reaching out. Our team will get back to you within 24 hours.
        </p>
        <button
          type="button"
          onClick={() => {
            setFormData(initialFormState);
            setErrors({});
            setSubmitted(false);
          }}
          className="btn btn-secondary"
          style={{ marginTop: '20px' }}
        >
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit} noValidate>
      <div>
        <h2 style={{ marginBottom: '8px' }}>Get In Touch</h2>
        <p style={{ color: 'var(--color-grey-dark)', fontFamily: 'var(--font-body)', marginBottom: '24px' }}>
          Whether you&apos;re interested in bespoke teamwear, a collaboration, or just have a question — we&apos;d love to hear from you.
        </p>
      </div>

      <div style={{
        background: 'var(--color-grey-light)',
        padding: '20px 24px',
        marginBottom: '28px',
        borderLeft: '3px solid #4232d9',
      }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9375rem', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>
          We Read Every Message
        </h3>
        <p style={{ margin: '0 0 6px', fontSize: '0.875rem', lineHeight: 1.6 }}>
          <strong>Email:</strong> <a href="mailto:support@vahnsports.com" style={{ color: '#4232d9', textDecoration: 'underline' }}>support@vahnsports.com</a><br/>
          <strong>Phone:</strong> +91 8013340567<br/>
          <strong>Support Hours:</strong> Monday to Saturday, 10:00 AM – 6:00 PM IST
        </p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-grey-dark)' }}>
          For order-related queries, please include your order number. We aim to respond to all emails within 24 hours on business days.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="firstName">First Name *</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            className="input"
            required
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
          />
          {errors.firstName && <span style={{ color: '#d93025', fontSize: '0.75rem' }}>{errors.firstName}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="lastName">Last Name *</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            className="input"
            required
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
          />
          {errors.lastName && <span style={{ color: '#d93025', fontSize: '0.75rem' }}>{errors.lastName}</span>}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="email">Email *</label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        {errors.email && <span style={{ color: '#d93025', fontSize: '0.75rem' }}>{errors.email}</span>}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="phone">Phone (Optional)</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            id="countryCode"
            name="countryCode"
            className="input"
            style={{ width: '130px', flexShrink: 0 }}
            value={formData.countryCode}
            onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          <input
            id="phone"
            name="phone"
            type="tel"
            className="input"
            placeholder="98765 43210"
            style={{ flex: 1 }}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^\d\s-]/g, '') })}
          />
        </div>
        {errors.phone && <span style={{ color: '#d93025', fontSize: '0.75rem' }}>{errors.phone}</span>}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="subject">Subject *</label>
        <select
          id="subject"
          name="subject"
          className="input"
          required
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
        >
          <option value="">Select a topic</option>
          <option value="bespoke">Bespoke Teamwear Enquiry</option>
          <option value="order">Order Support</option>
          <option value="wholesale">Wholesale</option>
          <option value="other">Other</option>
        </select>
        {errors.subject && <span style={{ color: '#d93025', fontSize: '0.75rem' }}>{errors.subject}</span>}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="message">Message *</label>
        <textarea
          id="message"
          name="message"
          className="input"
          rows={6}
          required
          style={{ resize: 'vertical' }}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
        />
        {errors.message && <span style={{ color: '#d93025', fontSize: '0.75rem' }}>{errors.message}</span>}
      </div>

      <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
        {loading ? (
          <span className="loading-spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
        ) : (
          'Send Message →'
        )}
      </button>
    </form>
  );
}
