'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function ImageWithText() {
  return (
    <section
      style={{
        width: '100%',
        background: 'var(--color-grey-light)',
        borderTop: '1px solid var(--color-border)',
        borderBottom: '1px solid var(--color-border)',
      }}
      aria-label="Signature product banner"
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          alignItems: 'center',
          gap: 0,
        }}
      >
        {/* Left: Image */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', overflow: 'hidden' }}>
          <Image
            src="/assets/bull-banner.png"
            alt="VAHN Signature Oversized Jersey"
            fill
            sizes="50vw"
            style={{ objectFit: 'cover' }}
            priority
          />
        </div>

        {/* Right: Content */}
        <div
          style={{
            padding: 'var(--space-2xl) var(--space-2xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-lg)',
            maxWidth: '560px',
            margin: '0 auto',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.75rem, 3vw, 3rem)',
              lineHeight: 1.05,
              textTransform: 'uppercase',
              color: 'var(--color-black)',
            }}
          >
            Our signature product
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1.125rem',
              lineHeight: 1.6,
              color: 'var(--color-grey-dark)',
            }}
          >
            Made with care and unconditionally loved by our customers, this signature bestseller exceeds all expectations.
          </p>
          <Link
            href="/products/vahn-signature-oversized-jersey"
            className="btn btn-primary"
            style={{ width: 'fit-content', marginTop: '8px' }}
          >
            Shop now
          </Link>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          div {
            grid-template-columns: 1fr !important;
          }
          div div:nth-child(2) {
            padding: var(--space-xl) var(--space-md) !important;
          }
        }
      `}</style>
    </section>
  );
}
