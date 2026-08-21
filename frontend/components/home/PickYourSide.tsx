import Link from 'next/link';
import Image from 'next/image';

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
            fontSize: 'clamp(1.5rem, 4vw, 2.75rem)',
            textTransform: 'uppercase',
            letterSpacing: '-0.025em',
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
            letterSpacing: '-0.025em',
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
              fontWeight: 900,
              fontSize: '0.8125rem',
              textTransform: 'uppercase',
              letterSpacing: '-0.025em',
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
              fontWeight: 900,
              fontSize: '0.8125rem',
              textTransform: 'uppercase',
              letterSpacing: '-0.025em',
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
