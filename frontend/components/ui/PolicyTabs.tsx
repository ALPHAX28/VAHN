'use client';

import React from 'react';
import Link from 'next/link';

export interface PolicyTabsProps {
  activeHandle: string;
}

export const POLICY_TABS = [
  { label: 'Privacy Policy', handle: 'privacy-policy', href: '/pages/privacy-policy' },
  { label: 'Terms & Conditions', handle: 'terms-and-conditions', href: '/pages/terms-and-conditions' },
  { label: 'Shipping & Returns', handle: 'shipping', href: '/pages/shipping' },
  { label: 'Contact Support', handle: 'contact', href: '/pages/contact' },
];

export default function PolicyTabs({ activeHandle }: PolicyTabsProps) {
  const normalized = (activeHandle || '').toLowerCase().trim();

  const isPrivacy = normalized === 'privacy-policy' || normalized === 'privacy';
  const isTerms = normalized === 'terms-and-conditions' || normalized === 'terms' || normalized === 'terms-of-service';
  const isShipping = normalized === 'shipping' || normalized === 'shipping-policy' || normalized === 'returns';
  const isContact = normalized === 'contact' || normalized === 'contact-us';

  return (
    <nav
      aria-label="Policy and Support Navigation"
      style={{
        background: '#ffffff',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          overflowX: 'auto',
          gap: '8px',
          scrollbarWidth: 'none',
        }}
      >
        {POLICY_TABS.map((tab) => {
          const isActive =
            (tab.handle === 'privacy-policy' && isPrivacy) ||
            (tab.handle === 'terms-and-conditions' && isTerms) ||
            (tab.handle === 'shipping' && isShipping) ||
            (tab.handle === 'contact' && isContact);

          return (
            <Link
              key={tab.handle}
              href={tab.href}
              style={{
                padding: '16px 20px',
                fontFamily: 'var(--font-heading)',
                fontSize: '0.8125rem',
                fontWeight: isActive ? 700 : 500,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: isActive ? '#4232d9' : 'var(--color-grey-dark)',
                textDecoration: 'none',
                borderBottom: isActive ? '2.5px solid #4232d9' : '2.5px solid transparent',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s ease, border-color 0.15s ease',
                marginTop: '1px',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
