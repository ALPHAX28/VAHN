import Link from 'next/link';
import Image from 'next/image';

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
      {/* Real Top Banner Hero Image */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
        }}
      >
        <Image
          src="/assets/top-banner.png"
          alt="THIS IS VAHN"
          fill
          priority
          sizes="100vw"
          style={{
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
      </div>

      {/* Subtle bottom gradient for hero text legibility */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.2) 40%, transparent 70%)',
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
            fontSize: 'clamp(1.75rem, 4.2vw, 3.25rem)',
            textTransform: 'uppercase',
            letterSpacing: '-0.025em',
            color: '#ffffff',
            lineHeight: 1.05,
            marginBottom: '8px',
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
            letterSpacing: '0.01em',
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
