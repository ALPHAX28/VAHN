'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

const SOCIALS = [
  {
    label: 'Instagram',
    href: 'https://instagram.com/vahnteamwear',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
      </svg>
    ),
  },
  {
    label: 'TikTok',
    href: 'https://tiktok.com/@vahnteamwear',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>
      </svg>
    ),
  },
  {
    label: 'Facebook',
    href: 'https://facebook.com/vahnteamwear',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
      { label: 'Sustainability', href: '/pages/sustainability' },
      { label: 'Careers', href: '/pages/careers' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'FAQs', href: '/pages/faqs-page' },
      { label: 'Contact Us', href: '/pages/contact' },
      { label: 'Shipping & Returns', href: '/pages/shipping' },
      { label: 'Size Guide', href: '/pages/size-guide' },
    ],
  },
];

export default function Footer() {
  const [logoError, setLogoError] = useState(false);

  return (
    <footer className="footer">
      <div className="footer-main">
        {/* Left: Logo + Socials + Menus */}
        <div>
          <div className="footer-header">
            {/* Logo */}
            <Link href="/" aria-label="VAHN home" style={{ display: 'inline-block' }}>
              {logoError ? (
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-black)' }}>
                  VAHN
                </span>
              ) : (
                <Image
                  src="/assets/logo.png"
                  alt="VAHN"
                  width={100}
                  height={24}
                  style={{ display: 'block', height: '24px', width: 'auto' }}
                  onError={() => setLogoError(true)}
                />
              )}
            </Link>

            {/* Social Icons */}
            <div className="footer-socials-row">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          <div className="footer-menus">
            {FOOTER_MENUS.map((menu) => (
              <div key={menu.heading} className="footer-menu">
                <h5>{menu.heading}</h5>
                <ul>
                  {menu.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        {...(link.href.startsWith('https') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Newsletter */}
        <div className="footer-newsletter">
          <h5>Join the Beginning</h5>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-grey-dark)', marginBottom: '16px', fontFamily: 'var(--font-body)' }}>
            Be the first to know about new drops, exclusive offers, and bespoke teamwear.
          </p>
          <form
            className="footer-newsletter-form"
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.elements.namedItem('email') as HTMLInputElement);
              if (input.value) {
                alert('Thank you for subscribing!');
                input.value = '';
              }
            }}
          >
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              required
              aria-label="Email address"
            />
            <button type="submit" aria-label="Subscribe">
              →
            </button>
          </form>
        </div>
      </div>

      {/* Copyright bar */}
      <div className="footer-bar">
        <p>© {new Date().getFullYear()} VAHN. All rights reserved. Premium bespoke teamwear.</p>
      </div>
    </footer>
  );
}
