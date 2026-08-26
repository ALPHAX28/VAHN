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
        background: '#111111',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        color: '#ffffff',
      }}
    >
      {/* Main Footer Container */}
      <div
        style={{
          maxWidth: '100%',
          margin: '0 auto',
          padding: 'clamp(44px, 5vw, 60px) clamp(24px, 4.5vw, 64px) clamp(70px, 9vw, 110px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 'clamp(32px, 5vw, 80px)',
        }}
      >
        {/* Left Group: ABOUT, SUPPORT, SOCIALS */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'clamp(40px, 6vw, 96px)',
            alignItems: 'flex-start',
          }}
        >
          {/* Column 1: ABOUT */}
          <div style={{ minWidth: '100px' }}>
            <h5
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: '0.8125rem',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                color: '#ffffff',
                marginBottom: '18px',
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
                gap: '10px',
              }}
            >
              {ABOUT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    style={{
                      fontFamily: 'var(--font-body), Georgia, serif',
                      fontSize: '0.8125rem',
                      letterSpacing: '-0.01em',
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
                fontSize: '0.8125rem',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                color: '#ffffff',
                marginBottom: '18px',
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
                gap: '10px',
              }}
            >
              {SUPPORT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    style={{
                      fontFamily: 'var(--font-body), Georgia, serif',
                      fontSize: '0.8125rem',
                      letterSpacing: '-0.01em',
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
                fontSize: '0.8125rem',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                color: '#ffffff',
                marginBottom: '18px',
              }}
            >
              SOCIALS
            </h5>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Instagram */}
              <a
                href="https://www.instagram.com/vahnforall/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.85,
                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.85';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Image
                  src="/icons/instagram-01.png"
                  alt="Instagram"
                  width={20}
                  height={20}
                  style={{ width: '20px', height: '20px', objectFit: 'contain', display: 'block' }}
                />
              </a>

              {/* LinkedIn */}
              <a
                href="https://www.linkedin.com/company/vahnsports/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.85,
                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.85';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Image
                  src="/icons/linkedin.png"
                  alt="LinkedIn"
                  width={20}
                  height={20}
                  style={{ width: '20px', height: '20px', objectFit: 'contain', display: 'block' }}
                />
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
            style={{ display: 'inline-block', marginBottom: '14px', textDecoration: 'none' }}
          >
            <Image
              src="/assets/logos/VAHN-Primary-colour-transparent.png"
              alt="VAHN"
              width={110}
              height={26}
              priority
              style={{
                height: '23px',
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
            DON&apos;T HEAR ABOUT THE NEXT DROP. BE FIRST IN.
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
                border: '1px solid #4232d9',
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
                background: '#4232d9',
                border: '1px solid #4232d9',
                borderRadius: '2px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background-color 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3425b8')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#4232d9')}
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
