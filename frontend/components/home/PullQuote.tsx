import React from 'react';

export default function PullQuote() {
  return (
    <section
      className="home-section-padding"
      style={{
        background: 'var(--color-grey-light)',
        borderTop: '1px solid var(--color-border)',
        borderBottom: '1px solid var(--color-border)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
      aria-label="Brand quote"
    >
      {/* Decorative quotes in background */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '10%',
          fontFamily: 'var(--font-heading)',
          fontSize: '12rem',
          color: 'rgba(0, 0, 0, 0.03)',
          lineHeight: 1,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        “
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
            lineHeight: 1.4,
            fontStyle: 'italic',
            color: 'var(--color-black)',
            marginBottom: 'var(--space-md)',
          }}
        >
          Inspired by sport, designed for everyday.
        </p>
        <p
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '1rem',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-grey-dark)',
          }}
        >
          VAHN pieces are made to transition from training to street, from routine to something new.
        </p>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '-100px',
          right: '10%',
          fontFamily: 'var(--font-heading)',
          fontSize: '12rem',
          color: 'rgba(0, 0, 0, 0.03)',
          lineHeight: 1,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        ”
      </div>
    </section>
  );
}
