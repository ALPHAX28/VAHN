export default function BrandStatement() {
  const BRAND_BLUE = '#4232d9';

  return (
    <section
      style={{
        background: BRAND_BLUE,
        padding: 'clamp(60px, 8vw, 100px) clamp(24px, 6vw, 80px)',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 900,
            fontSize: 'clamp(1.625rem, 4vw, 3rem)',
            textTransform: 'uppercase',
            letterSpacing: '-0.025em',
            color: '#ffffff',
            lineHeight: 1.1,
            marginBottom: '28px',
          }}
        >
          BUILT FOR THE WAY YOU PLAY.
        </h2>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1rem',
            lineHeight: 1.75,
            letterSpacing: '-0.025em',
            color: 'rgba(255,255,255,0.92)',
            marginBottom: '16px',
            fontWeight: 500,
          }}
        >
          Not just performance. Not just fashion.
        </p>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.9375rem',
            lineHeight: 1.75,
            letterSpacing: '-0.025em',
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          VAHN sits somewhere in between — made for movement, built with intent, and designed to stay with you long after the game is over.
        </p>
      </div>
    </section>
  );
}
