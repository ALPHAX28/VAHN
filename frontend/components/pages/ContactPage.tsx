'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import TrustBadgesBar from '@/components/ui/TrustBadgesBar';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    orderNumber: '',
    subject: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 900));
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
                onClick={() => setSubmitted(false)}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', textTransform: 'uppercase', padding: '10px 24px' }}
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
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
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">Email Address *</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="input"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="phone">Phone Number</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className="input"
                    placeholder="+91"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="orderNumber">Order Number (If Applicable)</label>
                  <input
                    id="orderNumber"
                    name="orderNumber"
                    type="text"
                    className="input"
                    placeholder="e.g. ORD-123456"
                    value={formData.orderNumber}
                    onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                  />
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
                    <option value="order">Order Tracking / Status</option>
                    <option value="return">Return or Exchange</option>
                    <option value="bespoke">Bespoke Teamwear Enquiry</option>
                    <option value="product">Product &amp; Sizing Question</option>
                    <option value="other">General Feedback / Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  name="message"
                  className="input"
                  rows={5}
                  required
                  placeholder="How can we help?"
                  style={{ resize: 'vertical' }}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
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
