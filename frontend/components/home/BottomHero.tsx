'use client';

import React from 'react';

export default function BottomHero() {
  return (
    <section
      className="bottom-hero-section"
      style={{
        backgroundImage: 'url(/assets/courtyard-jersey.png)',
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

      <div className="bottom-hero-grid">
        {/* Left column: Headings */}
        <div>
          <p
            style={{
              fontFamily: "'Instrument Serif', serif",
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

    </section>
  );
}
