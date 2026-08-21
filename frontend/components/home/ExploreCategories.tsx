import Link from 'next/link';

const CATEGORIES = [
  {
    label: 'Tops',
    href: '/collections/tops',
    active: true,
    subLabel: 'Explore',
  },
  {
    label: 'Bottoms',
    href: null,
    active: false,
    subLabel: 'Coming Soon',
  },
  {
    label: 'Accessories',
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
        padding: '64px 40px',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 900,
          fontSize: 'clamp(1.125rem, 2.5vw, 1.75rem)',
          textTransform: 'uppercase',
          letterSpacing: '-0.01em',
          color: '#000',
          marginBottom: '28px',
        }}
      >
        Explore Categories
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {CATEGORIES.map((cat, i) => (
          <div
            key={cat.label}
            style={{
              border: '1px solid #ebebeb',
              borderBottom: i < CATEGORIES.length - 1 ? 'none' : '1px solid #ebebeb',
              background: cat.active ? '#111111' : '#f9f9f9',
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                fontSize: 'clamp(1rem, 2vw, 1.375rem)',
                textTransform: 'uppercase',
                letterSpacing: '-0.01em',
                color: cat.active ? '#ffffff' : '#555555',
                margin: 0,
              }}
            >
              {cat.label}
            </h3>
            {cat.active && cat.href ? (
              <Link
                href={cat.href}
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  color: '#3a3699',
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                }}
              >
                {cat.subLabel} →
              </Link>
            ) : (
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  letterSpacing: '0.04em',
                  color: '#aaaaaa',
                  textTransform: 'uppercase',
                }}
              >
                {cat.subLabel}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
