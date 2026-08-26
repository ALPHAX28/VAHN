'use client';

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
        marginTop: '-64px',
        paddingTop: '64px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: '80px',
        backgroundColor: '#111111',
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
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.2) 35%, transparent 65%)',
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
          padding: '0 16px',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 900,
            fontSize: 'clamp(1.25rem, 2.8vw, 2rem)',
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            color: '#ffffff',
            lineHeight: 1.1,
            marginBottom: '6px',
          }}
        >
          PLAY ON.
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontStyle: 'italic',
            fontSize: 'clamp(0.8125rem, 1.2vw, 0.9375rem)',
            color: '#ffffff',
            letterSpacing: '-0.01em',
            margin: '0 auto 16px',
            maxWidth: '480px',
            lineHeight: 1.4,
            opacity: 0.95,
          }}
        >
          Built for the way you play.
        </p>

        <Link
          href="/products"
          style={{
            display: 'inline-block',
            background: '#4232d9',
            color: '#ffffff',
            fontFamily: 'var(--font-body)',
            fontStyle: 'italic',
            fontSize: '0.875rem',
            padding: '7px 22px',
            borderRadius: '2px',
            textDecoration: 'none',
            letterSpacing: '-0.01em',
            transition: 'background-color 0.2s ease, transform 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#3425b8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#4232d9';
          }}
        >
          Shop Now
        </Link>
      </div>
    </section>
  );
}
