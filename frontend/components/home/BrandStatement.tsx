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
          VAHN for Performance, Style &amp; Innovation
        </h2>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.9375rem',
            lineHeight: 1.75,
            letterSpacing: '-0.025em',
            color: 'rgba(255,255,255,0.88)',
            marginBottom: '20px',
          }}
        >
          Sport keeps us fit. Keeps you mindful. Brings us together. Through sport, we have the power to change lives—through stories of inspiring athletes, innovative technology, and by helping you get up and move.
        </p>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.9375rem',
            lineHeight: 1.75,
            letterSpacing: '-0.025em',
            color: 'rgba(255,255,255,0.88)',
          }}
        >
          Find the right gear and focus on the game. Whether you&rsquo;re a runner, a basketball player, a footballer, or someone who just loves to stay active, VAHN is here to help you train harder, recover, and go further with products that keep up with your movement and support your goals.
        </p>
      </div>
    </section>
  );
}
