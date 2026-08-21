import React from 'react';

export default function MarqueeStrip() {
  const items = [
    'Play On.',
    'Play On.',
    'Play On.',
    'Play On.',
    'Play On.',
    'Play On.',
    'Play On.',
    'Play On.',
    'Play On.',
    'Play On.',
  ];

  return (
    <div
      className="marquee"
      style={{
        background: '#0d0d0f',
        padding: '10px 0',
        overflow: 'hidden',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      }}
      aria-hidden="true"
    >
      <div className="marquee-track" style={{ display: 'inline-flex' }}>
        {[...items, ...items, ...items].map((item, i) => (
          <span
            key={i}
            className="marquee-item"
            style={{
              fontFamily: 'var(--font-body), Georgia, serif',
              fontSize: 'clamp(0.8125rem, 1.2vw, 1rem)',
              fontWeight: 400,
              textTransform: 'none',
              letterSpacing: '-0.025em',
              padding: '0 clamp(16px, 2.5vw, 32px)',
              color: '#3b379e',
              whiteSpace: 'nowrap',
            }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
