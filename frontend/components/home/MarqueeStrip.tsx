import React from 'react';

export default function MarqueeStrip() {
  const items = [
    'VAHN ✦',
    'Sport Keeps Us Fit ✦',
    'VAHN ✦',
    'Sport Keeps Us Fit ✦',
    'VAHN ✦',
    'Sport Keeps Us Fit ✦',
  ];

  return (
    <div
      className="marquee"
      style={{
        background: '#0e0f12',
        padding: '18px 0',
        overflow: 'hidden',
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
              fontSize: 'clamp(1rem, 2.5vw, 1.625rem)',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '0 var(--space-xl)',
              color: '#3a3699',
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
