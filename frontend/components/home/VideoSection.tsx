export default function VideoSection() {
  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        minHeight: '420px',
        overflow: 'hidden',
        background: '#1a1c22',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Background image placeholder */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #2a2e38 0%, #1a1c22 100%)',
          zIndex: 0,
        }}
        aria-hidden="true"
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundImage:
              'repeating-linear-gradient(0deg,rgba(255,255,255,0.02) 0 1px,transparent 1px 80px),repeating-linear-gradient(90deg,rgba(255,255,255,0.02) 0 1px,transparent 1px 80px)',
          }}
        />
        {/* Athlete image placeholder hint */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.1,
            pointerEvents: 'none',
          }}
        >
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="0.75">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </div>
      </div>

      {/* Dark overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 1,
        }}
        aria-hidden="true"
      />

      {/* VIDEO placeholder label — replace with <video> element when asset is ready */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          pointerEvents: 'none',
        }}
        aria-label="Video placeholder"
      >
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 900,
            fontSize: 'clamp(2rem, 6vw, 5rem)',
            textTransform: 'uppercase',
            letterSpacing: '-0.025em',
            color: '#e8475f',
          }}
        >
          (VIDEO)
        </span>
      </div>

      {/* Play button icon hint */}
      <div
        style={{
          position: 'absolute',
          zIndex: 2,
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          opacity: 0.5,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.75rem',
            color: '#fff',
            letterSpacing: '-0.025em',
            textTransform: 'uppercase',
          }}
        >
          Video goes here
        </span>
      </div>
    </section>
  );
}
