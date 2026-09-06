'use client';

import React from 'react';
import Link from 'next/link';
import type { ShopifyPage } from '@/lib/api/types';
import TrustBadgesBar from '@/components/ui/TrustBadgesBar';

interface PolicyPageLayoutProps {
  page: ShopifyPage;
  currentHandle: string;
}

const POLICY_TABS = [
  { label: 'Privacy Policy', handle: 'privacy-policy', href: '/pages/privacy-policy' },
  { label: 'Terms & Conditions', handle: 'terms-and-conditions', href: '/pages/terms-and-conditions' },
  { label: 'Shipping & Returns', handle: 'shipping', href: '/pages/shipping' },
  { label: 'Contact Support', handle: 'contact', href: '/pages/contact' },
];

export default function PolicyPageLayout({ page, currentHandle }: PolicyPageLayoutProps) {
  const isPrivacy = currentHandle === 'privacy-policy' || currentHandle === 'privacy';
  const isTerms = currentHandle === 'terms-and-conditions' || currentHandle === 'terms' || currentHandle === 'terms-of-service';
  const isShipping = currentHandle === 'shipping' || currentHandle === 'shipping-policy' || currentHandle === 'returns';

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
            VAHN Studios &bull; Legal &amp; Policies
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
            {page.title}
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-body), Georgia, serif',
              fontSize: 'clamp(0.95rem, 1.2vw, 1.125rem)',
              color: 'rgba(255, 255, 255, 0.72)',
              maxWidth: '680px',
              margin: '0 auto 24px',
              lineHeight: 1.6,
            }}
          >
            {page.bodySummary || 'Official policies and customer agreements governing your experience with VAHN.'}
          </p>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '16px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '6px 16px',
              borderRadius: '2px',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-ui)',
              color: 'rgba(255, 255, 255, 0.65)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <span>Last Updated: 02.09.2026</span>
            <span style={{ opacity: 0.4 }}>&bull;</span>
            <span>Applies Pan-India</span>
          </div>
        </div>
      </section>

      {/* ── Subnav Tabs Bar ── */}
      <nav
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
              (tab.handle === 'shipping' && isShipping);

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

      {/* ── Main Content Layout ── */}
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: 'clamp(40px, 5vw, 64px) clamp(20px, 4vw, 40px)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) clamp(260px, 25vw, 320px)',
          gap: ' clamp(32px, 5vw, 64px)',
          alignItems: 'flex-start',
        }}
        className="vahn-policy-grid"
      >
        {/* Main Content Area */}
        <main
          style={{
            background: '#ffffff',
          }}
        >
          {/* Quick Highlight Box */}
          {isPrivacy && (
            <div
              style={{
                background: '#f6f7fb',
                border: '1px solid #e2e4f0',
                borderLeft: '4px solid #4232d9',
                padding: '20px 24px',
                marginBottom: '36px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
              }}
            >
              <div style={{ width: '28px', height: '28px', flexShrink: 0, marginTop: '2px', color: '#4232d9' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <strong style={{ fontFamily: 'var(--font-heading)', textTransform: 'uppercase', fontSize: '0.8125rem', letterSpacing: '0.04em', display: 'block', marginBottom: '4px', color: '#111' }}>
                  Privacy Guarantee
                </strong>
                <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.6, color: '#444' }}>
                  We do not sell your personal data. All payment details are processed under strict PCI-DSS standards directly by authorized gateway partners.
                </p>
              </div>
            </div>
          )}

          {isShipping && (
            <div
              style={{
                background: '#f6f7fb',
                border: '1px solid #e2e4f0',
                borderLeft: '4px solid #4232d9',
                padding: '20px 24px',
                marginBottom: '36px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
              }}
            >
              <div>
                <strong style={{ fontFamily: 'var(--font-heading)', textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '0.04em', display: 'block', marginBottom: '4px', color: '#4232d9' }}>
                  10-Day Returns
                </strong>
                <span style={{ fontSize: '0.8125rem', color: '#555', lineHeight: 1.5 }}>
                  Unworn, unwashed items eligible for return within 10 days of delivery.
                </span>
              </div>
              <div>
                <strong style={{ fontFamily: 'var(--font-heading)', textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '0.04em', display: 'block', marginBottom: '4px', color: '#4232d9' }}>
                  Free Reverse Pickup
                </strong>
                <span style={{ fontSize: '0.8125rem', color: '#555', lineHeight: 1.5 }}>
                  Doorstep courier pickup arranged at your registered address.
                </span>
              </div>
              <div>
                <strong style={{ fontFamily: 'var(--font-heading)', textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '0.04em', display: 'block', marginBottom: '4px', color: '#4232d9' }}>
                  Pan-India Delivery
                </strong>
                <span style={{ fontSize: '0.8125rem', color: '#555', lineHeight: 1.5 }}>
                  Dispatched in 2 business days via BlueDart, Delhivery, XpressBees.
                </span>
              </div>
            </div>
          )}

          {isTerms && (
            <div
              style={{
                background: '#f6f7fb',
                border: '1px solid #e2e4f0',
                borderLeft: '4px solid #4232d9',
                padding: '20px 24px',
                marginBottom: '36px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
              }}
            >
              <div style={{ width: '28px', height: '28px', flexShrink: 0, marginTop: '2px', color: '#4232d9' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <strong style={{ fontFamily: 'var(--font-heading)', textTransform: 'uppercase', fontSize: '0.8125rem', letterSpacing: '0.04em', display: 'block', marginBottom: '4px', color: '#111' }}>
                  Transparent Terms
                </strong>
                <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.6, color: '#444' }}>
                  All orders are verified and protected under Indian Consumer Protection regulations. Prepaid transactions only for maximum security.
                </p>
              </div>
            </div>
          )}

          {/* Render HTML Body */}
          <div
            className="vahn-page-content"
            style={{
              fontSize: '1rem',
              lineHeight: 1.8,
              color: '#222222',
            }}
            dangerouslySetInnerHTML={{ __html: page.body }}
          />
        </main>

        {/* Sidebar Support & Quick Links Card */}
        <aside
          style={{
            position: 'sticky',
            top: '80px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Help Box */}
          <div
            style={{
              background: '#fbfbfb',
              border: '1px solid var(--color-border)',
              padding: '28px 24px',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.875rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                margin: '0 0 14px',
                color: '#111111',
              }}
            >
              Need Clarification?
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-body), Georgia, serif',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                color: 'var(--color-grey-dark)',
                margin: '0 0 20px',
              }}
            >
              Our support team is available Monday to Saturday to answer any questions regarding your orders or these terms.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8125rem' }}>
              <div>
                <span style={{ display: 'block', fontWeight: 600, color: '#111', textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.06em' }}>Direct Email</span>
                <a href="mailto:support@vahnsports.com" style={{ color: '#4232d9', textDecoration: 'underline' }}>
                  support@vahnsports.com
                </a>
              </div>
              <div>
                <span style={{ display: 'block', fontWeight: 600, color: '#111', textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.06em' }}>Phone Support</span>
                <a href="tel:+918013340567" style={{ color: '#111', textDecoration: 'none' }}>
                  +91 8013340567
                </a>
              </div>
              <div>
                <span style={{ display: 'block', fontWeight: 600, color: '#111', textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.06em' }}>Operating Hours</span>
                <span style={{ color: '#666' }}>10:00 AM &ndash; 6:00 PM IST</span>
              </div>
            </div>

            <Link
              href="/pages/contact"
              className="btn btn-primary"
              style={{
                display: 'block',
                textAlign: 'center',
                marginTop: '24px',
                background: '#4232d9',
                borderColor: '#4232d9',
                fontSize: '0.78rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '10px 16px',
              }}
            >
              Contact Support →
            </Link>
          </div>

          {/* Quick Track Orders Card */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--color-border)',
              padding: '24px',
            }}
          >
            <h4
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                margin: '0 0 8px',
                color: '#111111',
              }}
            >
              Track an Order
            </h4>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.8125rem',
                color: '#666',
                margin: '0 0 16px',
                lineHeight: 1.5,
              }}
            >
              Check dispatch milestones and real-time courier updates.
            </p>
            <Link
              href="/account/orders"
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#4232d9',
                textDecoration: 'underline',
              }}
            >
              View My Orders &rarr;
            </Link>
          </div>
        </aside>
      </div>

      {/* ── Bottom Trust Badges ── */}
      <TrustBadgesBar />
    </div>
  );
}
