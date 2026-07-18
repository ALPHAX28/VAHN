import React from 'react';

export default function MarqueeStrip() {
  const items = [
    'FOR EVERY BEGINING!',
    'FOR EVERY BEGINING!',
    'FOR EVERY BEGINING!',
    'FOR EVERY BEGINING!',
    'FOR EVERY BEGINING!',
    'FOR EVERY BEGINING!'
  ];

  return (
    <div
      className="marquee"
      style={{
        background: 'var(--color-black)',
        color: 'var(--color-white)',
        padding: '16px 0',
        borderTop: '1px solid var(--color-border)',
        borderBottom: '1px solid var(--color-border)',
      }}
      aria-hidden="true"
    >
      <div className="marquee-track" style={{ display: 'inline-flex' }}>
        {[...items, ...items, ...items].map((item, i) => (
          <span
            key={i}
            className="marquee-item"
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              padding: '0 var(--space-xl)',
              color: 'var(--color-white)',
            }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
