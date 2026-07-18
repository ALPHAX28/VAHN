'use client';

import React from 'react';

export default function BottomHero() {
  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        height: 'auto',
        aspectRatio: '16/9',
        backgroundImage: 'url(/assets/courtyard-jersey.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'flex-end',
        overflow: 'hidden',
        marginBottom: 'var(--space-2xl)',
      }}
      aria-label="New arrivals banner"
    >
      {/* Gradient Overlay for bottom aligned text contrast */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.2) 50%, transparent 100%)',
          zIndex: 1,
        }}
        aria-hidden="true"
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: 'var(--page-width)',
          margin: '0 auto',
          padding: 'var(--space-2xl) var(--space-xl)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          alignItems: 'end',
          gap: 'var(--space-xl)',
          color: 'var(--color-white)',
        }}
      >
        {/* Left column: Headings */}
        <div>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1.25rem',
              fontStyle: 'italic',
              textTransform: 'none',
              marginBottom: '4px',
              color: 'rgba(255, 255, 255, 0.9)',
            }}
          >
            Introducing
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(2.5rem, 5vw, 5rem)',
              textTransform: 'uppercase',
              lineHeight: 0.95,
              color: 'var(--color-white)',
            }}
          >
            New arrivals
          </h2>
        </div>

        {/* Right column: Description paragraph */}
        <div style={{ maxWidth: '420px', justifySelf: 'end' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1.125rem',
              lineHeight: 1.6,
              color: 'rgba(255, 255, 255, 0.95)',
            }}
          >
            We make things that work better and last longer. Our products solve real problems with clean design and honest materials.
          </p>
        </div>
      </div>

      <style jsx>{`
        section {
          height: auto;
          aspect-ratio: 16/9;
        }
        @media (max-width: 768px) {
          section {
            height: 520px !important;
            aspect-ratio: auto !important;
          }
          div {
            grid-template-columns: 1fr !important;
            text-align: left !important;
            gap: var(--space-md) !important;
            padding: var(--space-xl) var(--space-md) !important;
          }
          div div {
            justify-self: start !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </section>
  );
}
