import Link from 'next/link';

export default function HeroSection() {
  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        minHeight: '640px',
        marginTop: '-60px',
        paddingTop: '60px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: '80px',
      }}
    >
      {/* Placeholder background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #2a2e38 0%, #1a1c22 40%, #0e0f12 100%)',
          zIndex: 0,
        }}
        aria-hidden="true"
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundImage:
              'repeating-linear-gradient(0deg,rgba(255,255,255,0.03) 0 1px,transparent 1px 60px),repeating-linear-gradient(90deg,rgba(255,255,255,0.03) 0 1px,transparent 1px 60px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            textAlign: 'center',
            opacity: 0.2,
            pointerEvents: 'none',
          }}
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          <p style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: '0.75rem', marginTop: '8px' }}>
            HERO IMAGE PLACEHOLDER
          </p>
        </div>
      </div>

      {/* Gradient overlay from bottom */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 40%, transparent 70%)',
          zIndex: 1,
        }}
        aria-hidden="true"
      />

      {/* Hero Text */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          color: '#fff',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 900,
            fontSize: 'clamp(2.5rem, 7vw, 6rem)',
            textTransform: 'uppercase',
            letterSpacing: '-0.025em',
            color: '#ffffff',
            lineHeight: 1,
            marginBottom: '12px',
          }}
        >
          THIS IS VAHN
        </h1>
        <Link
          href="/products"
          style={{
            fontFamily: 'var(--font-body)',
            fontStyle: 'italic',
            fontSize: '1.0625rem',
            color: '#ffffff',
            textDecoration: 'none',
            letterSpacing: '-0.025em',
            opacity: 0.9,
            display: 'inline-block',
          }}
        >
          Shop Now
        </Link>
      </div>
    </section>
  );
}
