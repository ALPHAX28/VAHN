'use client';

import { useState } from 'react';
import Link from 'next/link';

interface CategoryData {
  label: string;
  href: string | null;
  active: boolean;
  subLabel: string;
}

const CATEGORIES: CategoryData[] = [
  {
    label: 'TOPS',
    href: '/products',
    active: true,
    subLabel: 'Explore',
  },
  {
    label: 'BOTTOMS',
    href: null,
    active: false,
    subLabel: 'Coming Soon',
  },
  {
    label: 'ACCESSORIES',
    href: null,
    active: false,
    subLabel: 'Coming Soon',
  },
];

function CategoryCard({ cat }: { cat: CategoryData }) {
  const [isHovered, setIsHovered] = useState(false);
  const isHighlighted = cat.active && isHovered;

  const cardContent = (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        border: isHighlighted ? '1px solid #111111' : '1px solid #ebebeb',
        background: isHighlighted ? '#111111' : '#f9f9f9',
        padding: 'clamp(32px, 4vw, 42px) clamp(24px, 4vw, 36px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        borderRadius: '2px',
        transition: 'background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease, box-shadow 0.25s ease',
        boxShadow: isHighlighted ? '0 8px 24px rgba(0, 0, 0, 0.12)' : 'none',
        cursor: cat.active ? 'pointer' : 'default',
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 400,
          fontSize: 'clamp(1rem, 2vw, 1.25rem)',
          textTransform: 'uppercase',
          letterSpacing: '-0.01em',
          color: isHighlighted ? '#ffffff' : cat.active ? '#000000' : '#888888',
          margin: 0,
          transition: 'color 0.25s ease',
        }}
      >
        {cat.label}
      </h3>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontStyle: 'normal',
          fontSize: '0.875rem',
          fontWeight: 400,
          letterSpacing: '-0.01em',
          color: isHighlighted ? '#ffffff' : cat.active ? '#666666' : '#888888',
          textTransform: 'none',
          transition: 'color 0.25s ease',
        }}
      >
        {cat.subLabel}
      </span>
    </div>
  );

  if (cat.active && cat.href) {
    return (
      <Link
        href={cat.href}
        style={{ textDecoration: 'none', display: 'block' }}
        aria-label={`Explore ${cat.label}`}
      >
        {cardContent}
      </Link>
    );
  }

  return <div>{cardContent}</div>;
}

export default function ExploreCategories() {
  return (
    <section
      style={{
        background: '#ffffff',
        padding: 'clamp(48px, 6vw, 72px) clamp(20px, 6vw, 80px)',
      }}
    >
      <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 900,
            fontSize: 'clamp(1.25rem, 2.5vw, 1.875rem)',
            textTransform: 'uppercase',
            letterSpacing: '-0.025em',
            color: '#000000',
            marginBottom: '28px',
          }}
        >
          EXPLORE CATEGORIES
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {CATEGORIES.map((cat) => (
            <CategoryCard key={cat.label} cat={cat} />
          ))}
        </div>
      </div>
    </section>
  );
}
