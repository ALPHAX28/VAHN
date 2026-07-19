'use client';

import React from 'react';

const COLUMNS = [
  {
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    title: 'Designed for Movement',
    description: 'Lightweight, breathable, made for when you’re just getting started, and not stopping',
  },
  {
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    title: 'Made to Be Seen',
    description: 'Performance meets fashion. Built to stand out, on and off the field',
  },
  {
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2c0 0-6 3.5-6 10a6 6 0 0 0 12 0c0-6.5-6-10-6-10z" />
        <path d="M12 6c0 0-3 2-3 6a3 3 0 0 0 6 0c0-4-3-6-3-6z" />
      </svg>
    ),
    title: 'Everyday Athlete Energy',
    description: 'Not just for game day. For day one, day two, and everything after',
  },
];

export default function IconsWithText() {
  return (
    <section className="icons-with-text-section" aria-label="Features">
      <div className="icons-with-text-grid">
        {COLUMNS.map((col, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-md)',
              padding: 'var(--space-md)',
            }}
          >
            <div
              style={{
                color: 'var(--color-black)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.03)',
              }}
            >
              {col.icon}
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '1.125rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-black)',
              }}
            >
              {col.title}
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
                color: 'var(--color-grey-dark)',
                lineHeight: 1.5,
                maxWidth: '300px',
              }}
            >
              {col.description}
            </p>
          </div>
        ))}
      </div>

    </section>
  );
}
