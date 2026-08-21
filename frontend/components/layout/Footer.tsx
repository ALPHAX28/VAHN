'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

const SOCIALS = [
  {
    label: 'Instagram',
    href: 'https://instagram.com/vahnteamwear',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com/company/vahnteamwear',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
        <rect x="2" y="9" width="4" height="12"></rect>
        <circle cx="4" cy="4" r="2"></circle>
      </svg>
    ),
  },
  {
    label: 'Facebook',
    href: 'https://facebook.com/vahnteamwear',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
      </svg>
    ),
  },
];

const FOOTER_MENUS = [
  {
    heading: 'About',
    links: [
      { label: 'Our Story', href: '/pages/about' },
      { label: 'Our Products', href: '/products' },
      { label: 'Our Partners', href: '/pages/about' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Order Tracking', href: '/account/orders' },
      { label: 'Shipping & Returns', href: '/pages/shipping' },
      { label: 'FAQ', href: '/pages/faqs-page' },
      { label: 'Contact Us', href: '/pages/contact' },
    ],
  },
];

const BRAND_BLUE = '#3a3699';
const FOOTER_BG = '#0e0f12';

export default function Footer() {
  const [logoError, setLogoError] = useState(false);
  const [email, setEmail] = useState('');

  return (
    <footer style={{ background: FOOTER_BG, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Main Footer Grid */}
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: 'clamp(48px, 6vw, 80px) clamp(20px, 4vw, 48px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr) auto',
          gap: '48px',
          alignItems: 'start',
        }}
      >
        {/* ABOUT column */}
        <div>
          <h5
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: '#ffffff',
              marginBottom: '16px',
            }}
          >
            About
          </h5>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {FOOTER_MENUS[0].links.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.8125rem',
                    color: 'rgba(255,255,255,0.55)',
                    textDecoration: 'none',
                    letterSpacing: '0.01em',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* SUPPORT column */}
        <div>
          <h5
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: '#ffffff',
              marginBottom: '16px',
            }}
          >
            Support
          </h5>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {FOOTER_MENUS[1].links.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.8125rem',
                    color: 'rgba(255,255,255,0.55)',
                    textDecoration: 'none',
                    letterSpacing: '0.01em',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* SOCIALS column */}
        <div>
          <h5
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: '#ffffff',
              marginBottom: '16px',
            }}
          >
            Socials
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: 'rgba(255,255,255,0.55)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-heading)',
                  fontSize: '0.8125rem',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                aria-label={s.label}
              >
                {s.icon}
                {s.label}
              </a>
            ))}
          </div>
        </div>

        {/* JOIN TEAM VAHN — email signup */}
        <div style={{ minWidth: '260px' }}>
          {/* Logo */}
          <Link href="/" aria-label="VAHN home" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={BRAND_BLUE}>
              <path d="M12 2L3 6.5V12C3 16.5 7 20.5 12 22C17 20.5 21 16.5 21 12V6.5L12 2Z" />
            </svg>
            {logoError ? (
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.125rem',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                VAHN
              </span>
            ) : (
              <Image
                src="/assets/logo-white.png"
                alt="VAHN"
                width={80}
                height={20}
                style={{ display: 'block', height: '20px', width: 'auto' }}
                onError={() => setLogoError(true)}
              />
            )}
          </Link>

          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#ffffff',
              marginBottom: '14px',
              lineHeight: 1.4,
            }}
          >
            Join Team VAHN to get Early Access
          </p>

          {/* Email form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) {
                alert('Welcome to Team VAHN!');
                setEmail('');
              }
            }}
            style={{ display: 'flex' }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              aria-label="Email address"
              style={{
                flex: 1,
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRight: 'none',
                color: '#fff',
                fontFamily: 'var(--font-heading)',
                fontSize: '0.8125rem',
                outline: 'none',
                minWidth: 0,
              }}
            />
            <button
              type="submit"
              aria-label="Subscribe"
              style={{
                background: BRAND_BLUE,
                border: 'none',
                color: '#fff',
                padding: '10px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
              }}
            >
              →
            </button>
          </form>
        </div>
      </div>

      {/* Copyright bar */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '16px clamp(20px, 4vw, 48px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.3)',
            margin: 0,
          }}
        >
          © {new Date().getFullYear()} VAHN. All rights reserved.
        </p>
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.3)',
            margin: 0,
          }}
        >
          EST. 2026 ✦ Crafted for the bold
        </p>
      </div>
    </footer>
  );
}
