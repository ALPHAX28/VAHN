import Link from 'next/link';

const CATEGORIES = [
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {CATEGORIES.map((cat, i) => {
            const isLast = i === CATEGORIES.length - 1;
            const content = (
              <div
                style={{
                  border: '1px solid #ebebeb',
                  borderBottom: isLast ? '1px solid #ebebeb' : 'none',
                  background: cat.active ? '#111111' : '#f9f9f9',
                  padding: '24px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'background-color 0.2s ease',
                  cursor: cat.active ? 'pointer' : 'default',
                }}
              >
                <h3
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 900,
                    fontSize: 'clamp(1rem, 2vw, 1.375rem)',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.025em',
                    color: cat.active ? '#ffffff' : '#666666',
                    margin: 0,
                  }}
                >
                  {cat.label}
                </h3>
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    letterSpacing: '-0.025em',
                    color: cat.active ? '#4f46e5' : '#aaaaaa',
                    textTransform: 'uppercase',
                  }}
                >
                  {cat.subLabel} {cat.active ? '→' : ''}
                </span>
              </div>
            );

            return cat.active && cat.href ? (
              <Link
                key={cat.label}
                href={cat.href}
                style={{ textDecoration: 'none', display: 'block' }}
                aria-label={`Explore ${cat.label}`}
              >
                {content}
              </Link>
            ) : (
              <div key={cat.label}>{content}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
