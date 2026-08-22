'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

const ABOUT_LINKS = [
  { label: 'Our Story', href: '/pages/about' },
  { label: 'Our Policies', href: '/pages/shipping' },
];

const SUPPORT_LINKS = [
  { label: 'Order Tracking', href: '/account/orders' },
  { label: 'Shipping & Returns', href: '/pages/shipping' },
  { label: 'FAQ', href: '/pages/faqs-page' },
  { label: 'Contact Us', href: '/pages/contact' },
];

export default function Footer() {
  const [email, setEmail] = useState('');

  return (
    <footer
      style={{
        background: '#141416',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        color: '#ffffff',
      }}
    >
      {/* Main Footer Container */}
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: 'clamp(36px, 5vw, 56px) clamp(16px, 5vw, 80px) clamp(40px, 6vw, 80px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 'clamp(28px, 4vw, 64px)',
        }}
      >
        {/* Left Group: ABOUT, SUPPORT, SOCIALS */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'clamp(28px, 4vw, 64px)',
            alignItems: 'flex-start',
          }}
        >
          {/* Column 1: ABOUT */}
          <div style={{ minWidth: '100px' }}>
            <h5
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '-0.025em',
                color: '#ffffff',
                marginBottom: '14px',
              }}
            >
              ABOUT
            </h5>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {ABOUT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    style={{
                      fontFamily: 'var(--font-body), Georgia, serif',
                      fontSize: '0.875rem',
                      letterSpacing: '-0.025em',
                      color: 'rgba(255, 255, 255, 0.72)',
                      textDecoration: 'none',
                      lineHeight: 1.5,
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.72)')}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: SUPPORT */}
          <div style={{ minWidth: '130px' }}>
            <h5
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '-0.025em',
                color: '#ffffff',
                marginBottom: '14px',
              }}
            >
              SUPPORT
            </h5>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {SUPPORT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    style={{
                      fontFamily: 'var(--font-body), Georgia, serif',
                      fontSize: '0.875rem',
                      letterSpacing: '-0.025em',
                      color: 'rgba(255, 255, 255, 0.72)',
                      textDecoration: 'none',
                      lineHeight: 1.5,
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.72)')}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: SOCIALS */}
          <div style={{ minWidth: '110px' }}>
            <h5
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '-0.025em',
                color: '#ffffff',
                marginBottom: '14px',
              }}
            >
              SOCIALS
            </h5>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Instagram */}
              <a
                href="https://www.instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                style={{
                  color: 'rgba(255, 255, 255, 0.75)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s ease, transform 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
              </a>

              {/* Facebook */}
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                style={{
                  color: 'rgba(255, 255, 255, 0.75)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s ease, transform 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>

              {/* LinkedIn */}
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                style={{
                  color: 'rgba(255, 255, 255, 0.75)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s ease, transform 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect width="4" height="12" x="2" y="9" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Right Group: Logo + Early Access Text + Form */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', maxWidth: '440px' }}>
          {/* Official VAHN Logo */}
          <Link
            href="/"
            aria-label="VAHN Home"
            style={{ display: 'inline-block', marginBottom: '16px', textDecoration: 'none' }}
          >
            <Image
              src="/assets/logos/VAHN-Primary-colour-transparent.png"
              alt="VAHN"
              width={140}
              height={34}
              priority
              style={{
                height: '30px',
                width: 'auto',
                display: 'block',
                objectFit: 'contain',
              }}
            />
          </Link>

          {/* Heading */}
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: 'clamp(0.75rem, 3vw, 0.875rem)',
              textTransform: 'uppercase',
              letterSpacing: '-0.025em',
              color: '#ffffff',
              marginBottom: '14px',
            }}
          >
            JOIN TEAM VAHN TO GET EARLY ACCESS
          </p>

          {/* Email Subscription Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) {
                alert('Thank you for joining Team VAHN!');
                setEmail('');
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              aria-label="Enter your email"
              style={{
                flex: 1,
                height: '46px',
                padding: '0 16px',
                background: 'transparent',
                border: '1px solid #3b379e',
                borderRadius: '2px',
                color: '#ffffff',
                fontFamily: 'var(--font-body), Georgia, serif',
                fontSize: '0.9375rem',
                letterSpacing: '-0.025em',
                outline: 'none',
                minWidth: 0,
                width: '100%',
              }}
            />
            <button
              type="submit"
              aria-label="Subscribe"
              style={{
                width: '46px',
                height: '46px',
                background: '#4f46e5',
                border: '1px solid #4f46e5',
                borderRadius: '2px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background-color 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4338ca')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#4f46e5')}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </footer>
  );
}
