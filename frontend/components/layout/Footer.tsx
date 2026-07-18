'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

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
  {
    heading: 'Socials',
    links: [
      { label: 'Instagram', href: 'https://instagram.com/vahnteamwear' },
      { label: 'TikTok', href: 'https://tiktok.com/@vahnteamwear' },
      { label: 'Facebook', href: 'https://facebook.com/vahnteamwear' },
    ],
  },
];

export default function Footer() {
  const [logoError, setLogoError] = useState(false);

  return (
    <footer className="footer">
      <div className="footer-main">
        {/* Left: Logo + Menus */}
        <div>
          {/* Logo */}
          <Link href="/" aria-label="VAHN home" style={{ display: 'inline-block', marginBottom: '32px' }}>
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
                style={{ display: 'block' }}
                onError={() => setLogoError(true)}
              />
            )}
          </Link>

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
