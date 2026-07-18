'use client';

import { useState } from 'react';

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call - in production, connect to your email service
    await new Promise((r) => setTimeout(r, 1000));
    setSubmitted(true);
    setLoading(false);
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
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div>
        <h2 style={{ marginBottom: '8px' }}>Get In Touch</h2>
        <p style={{ color: 'var(--color-grey-dark)', fontFamily: 'var(--font-body)' }}>
          Whether you&apos;re interested in bespoke teamwear, a collaboration, or just have a question — we&apos;d love to hear from you.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="firstName">First Name *</label>
          <input id="firstName" name="firstName" type="text" className="input" required />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="lastName">Last Name *</label>
          <input id="lastName" name="lastName" type="text" className="input" required />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="email">Email *</label>
        <input id="email" name="email" type="email" className="input" required />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="phone">Phone</label>
        <input id="phone" name="phone" type="tel" className="input" />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="subject">Subject *</label>
        <select id="subject" name="subject" className="input" required>
          <option value="">Select a topic</option>
          <option value="bespoke">Bespoke Teamwear Enquiry</option>
          <option value="order">Order Support</option>
          <option value="wholesale">Wholesale</option>
          <option value="other">Other</option>
        </select>
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
        />
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
