import Link from 'next/link';

export default function PickYourSide() {
  const BRAND_BLUE = '#3a3699';

  return (
    <section style={{ background: '#fff' }}>
      {/* Dark header strip */}
      <div
        style={{
          background: '#111111',
          padding: '52px 24px 48px',
          textAlign: 'center',
        }}
      >
        {/* VAHN Shield Icon */}
        <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill={BRAND_BLUE} xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L3 6.5V12C3 16.5 7 20.5 12 22C17 20.5 21 16.5 21 12V6.5L12 2Z" />
          </svg>
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 900,
            fontSize: 'clamp(1.5rem, 4vw, 2.75rem)',
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            color: '#ffffff',
            marginBottom: '14px',
          }}
        >
          Pick Your Side
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.9375rem',
            color: '#aaaaaa',
            maxWidth: '520px',
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          Sport keeps us fit. Keeps you mindful. Brings us together. Through sport, we have the power to change lives—through stories of inspiring athletes, innovative technology, and by helping you get up and move.
        </p>
      </div>

      {/* Two-panel image section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {/* Left Panel */}
        <div
          style={{
            position: 'relative',
            background: BRAND_BLUE,
            aspectRatio: '1 / 1',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: '32px',
            overflow: 'hidden',
          }}
        >
          {/* Image placeholder */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '8px',
              opacity: 0.15,
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            <span style={{ fontFamily: 'sans-serif', fontSize: '0.6875rem', color: '#fff' }}>ATHLETE IMAGE</span>
          </div>

          {/* BUY NOW button */}
          <Link
            href="/products"
            style={{
              position: 'relative',
              zIndex: 2,
              background: BRAND_BLUE,
              color: '#fff',
              border: '2px solid rgba(255,255,255,0.5)',
              padding: '12px 40px',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '0.8125rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Buy Now
          </Link>
        </div>

        {/* Right Panel */}
        <div
          style={{
            position: 'relative',
            background: '#5b58c4',
            aspectRatio: '1 / 1',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: '32px',
            overflow: 'hidden',
          }}
        >
          {/* Image placeholder */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '8px',
              opacity: 0.15,
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            <span style={{ fontFamily: 'sans-serif', fontSize: '0.6875rem', color: '#fff' }}>ATHLETE IMAGE</span>
          </div>

          {/* BUY NOW button */}
          <Link
            href="/products"
            style={{
              position: 'relative',
              zIndex: 2,
              background: BRAND_BLUE,
              color: '#fff',
              border: '2px solid rgba(255,255,255,0.5)',
              padding: '12px 40px',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '0.8125rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Buy Now
          </Link>
        </div>
      </div>
    </section>
  );
}
