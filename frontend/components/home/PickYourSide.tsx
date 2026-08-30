'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function PickYourSide() {
  const BRAND_BLUE = '#4232d9';

  return (
    <section style={{ background: '#fff' }}>
      {/* Dark header strip */}
      <div
        style={{
          background: '#111111',
          padding: 'clamp(36px, 6vw, 52px) clamp(16px, 4vw, 24px) clamp(32px, 5vw, 48px)',
          textAlign: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
        }}
      >
        {/* Official VAHN Symbol 'V' Logo in Blue from drive_logos */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
          <Image
            src="/assets/logos/VAHN-Symbol-colour-transparent.png"
            alt="VAHN"
            width={40}
            height={30}
            style={{ height: '28px', width: 'auto', display: 'block', objectFit: 'contain' }}
          />
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 900,
            fontSize: 'clamp(1.25rem, 2.8vw, 2rem)',
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            color: '#ffffff',
            lineHeight: 1.1,
            marginBottom: '10px',
          }}
        >
          PICK YOUR SIDE.
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontStyle: 'normal',
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.85)',
            maxWidth: '560px',
            margin: '0 auto',
            lineHeight: 1.5,
            letterSpacing: '-0.01em',
          }}
        >
          Two jerseys. Two expressions. One mindset. Wear the one that feels like you.
        </p>
      </div>

      {/* Two-panel image section — 2 columns on desktop, stacks vertically on mobile */}
      <div className="pick-your-side-grid">
        {/* Left Panel */}
        <div
          className="pick-your-side-panel"
          style={{
            background: '#1a1f64',
          }}
        >
          {/* Real Athlete Image Card 01 — White Jersey */}
          <Image
            src="/assets/pick-your-side-01.webp"
            alt="Pick Your Side — White"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="pick-your-side-img"
          />

          {/* Gradient overlay for CTA contrast */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 35%)',
              zIndex: 1,
            }}
            aria-hidden="true"
          />

          {/* BUY NOW button */}
          <Link
            href="/products"
            style={{
              position: 'relative',
              zIndex: 2,
              background: BRAND_BLUE,
              color: '#ffffff',
              border: 'none',
              borderRadius: '2px',
              padding: '12px 40px',
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: '0.8125rem',
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
              textDecoration: 'none',
              display: 'inline-block',
              transition: 'background-color 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#3425b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = BRAND_BLUE;
            }}
          >
            Buy Now
          </Link>
        </div>

        {/* Right Panel */}
        <div
          className="pick-your-side-panel"
          style={{
            background: '#1a1a66',
          }}
        >
          {/* Real Athlete Image Card 02 — Black Jersey */}
          <Image
            src="/assets/pick-your-side-02.webp"
            alt="Pick Your Side — Black"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="pick-your-side-img"
          />

          {/* Gradient overlay for CTA contrast */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 35%)',
              zIndex: 1,
            }}
            aria-hidden="true"
          />

          {/* BUY NOW button */}
          <Link
            href="/products"
            style={{
              position: 'relative',
              zIndex: 2,
              background: BRAND_BLUE,
              color: '#ffffff',
              border: 'none',
              borderRadius: '2px',
              padding: '12px 40px',
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: '0.8125rem',
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
              textDecoration: 'none',
              display: 'inline-block',
              transition: 'background-color 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#3425b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = BRAND_BLUE;
            }}
          >
            Buy Now
          </Link>
        </div>
      </div>
    </section>
  );
}
