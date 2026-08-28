'use client';

export default function GlobalLoading() {
  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      {/* 1. Sleek top 3px animated brand-blue glowing progress bar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          zIndex: 99999,
          background: 'rgba(66, 50, 217, 0.15)',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <div
          style={{
            height: '100%',
            width: '100%',
            background: 'linear-gradient(90deg, #4232d9 0%, #7c71f5 50%, #4232d9 100%)',
            animation: 'vahn-top-progress 1.2s infinite cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>

      {/* 2. Hero Section Skeleton — Exact 100vh dark bleed behind transparent header */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100vh',
          minHeight: '640px',
          marginTop: '-96px',
          paddingTop: '96px',
          background: '#0d0d11',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingBottom: '80px',
          overflow: 'hidden',
        }}
      >
        {/* Background dark radial glow shimmer */}
        <div
          className="vahn-hero-shimmer"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        />

        {/* Hero Title & CTA Skeleton */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          {/* "THIS IS VAHN" Skeleton */}
          <div
            className="vahn-shimmer-dark"
            style={{
              width: 'clamp(260px, 45vw, 460px)',
              height: 'clamp(46px, 6.5vw, 76px)',
              borderRadius: '4px',
            }}
          />
          {/* "Shop Now" Skeleton */}
          <div
            className="vahn-shimmer-dark"
            style={{
              width: '85px',
              height: '18px',
              borderRadius: '3px',
              opacity: 0.5,
            }}
          />
        </div>
      </div>

      {/* 3. Fresh Out of the Locker Carousel Skeleton */}
      <div
        style={{
          background: '#ffffff',
          padding: 'clamp(48px, 6vw, 80px) 0 clamp(48px, 6vw, 80px) clamp(20px, 6vw, 140px)',
        }}
      >
        {/* Title Bar Skeleton */}
        <div
          className="vahn-shimmer-light"
          style={{
            width: 'clamp(220px, 32vw, 340px)',
            height: '28px',
            borderRadius: '3px',
            marginBottom: '28px',
          }}
        />

        {/* Carousel Cards Skeleton */}
        <div
          style={{
            display: 'flex',
            gap: 'clamp(16px, 3.5vw, 36px)',
            overflow: 'hidden',
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 'clamp(280px, 75vw, 420px)',
                flex: '0 0 clamp(280px, 75vw, 420px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* Card Media Box Skeleton — 4/5 portrait ratio */}
              <div
                className="vahn-shimmer-light"
                style={{
                  width: '100%',
                  aspectRatio: '4 / 5',
                  borderRadius: '2px',
                }}
              />
              {/* Meta lines */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  className="vahn-shimmer-light"
                  style={{ width: '35%', height: '12px', borderRadius: '2px' }}
                />
                <div
                  className="vahn-shimmer-light"
                  style={{ width: '85%', height: '16px', borderRadius: '2px' }}
                />
                <div
                  className="vahn-shimmer-light"
                  style={{ width: '28%', height: '14px', borderRadius: '2px' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Pick Your Side Section Skeleton */}
      <div>
        {/* Dark header bar skeleton */}
        <div
          style={{
            background: '#111111',
            padding: 'clamp(36px, 6vw, 52px) clamp(16px, 4vw, 24px) clamp(32px, 5vw, 48px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            borderBottom: '3px solid #ffffff',
          }}
        >
          <div
            className="vahn-shimmer-dark"
            style={{ width: '36px', height: '24px', borderRadius: '4px' }}
          />
          <div
            className="vahn-shimmer-dark"
            style={{ width: 'clamp(180px, 30vw, 280px)', height: '32px', borderRadius: '4px' }}
          />
          <div
            className="vahn-shimmer-dark"
            style={{ width: 'clamp(280px, 50vw, 480px)', height: '14px', borderRadius: '2px', opacity: 0.5 }}
          />
        </div>

        {/* Two-panel blue athlete cards skeleton with 3px gap */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '3px',
            background: '#ffffff',
            paddingBottom: '3px',
          }}
        >
          <div
            className="vahn-shimmer-blue"
            style={{
              aspectRatio: '1 / 1',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: '36px',
            }}
          >
            <div
              className="vahn-shimmer-dark"
              style={{ width: '130px', height: '42px', borderRadius: '2px' }}
            />
          </div>
          <div
            className="vahn-shimmer-blue"
            style={{
              aspectRatio: '1 / 1',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: '36px',
            }}
          >
            <div
              className="vahn-shimmer-dark"
              style={{ width: '130px', height: '42px', borderRadius: '2px' }}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes vahn-top-progress {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .vahn-hero-shimmer {
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.02) 0%,
            rgba(58, 54, 153, 0.08) 50%,
            rgba(0, 0, 0, 0.4) 100%
          );
        }

        .vahn-shimmer-dark {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.06) 0%,
            rgba(255, 255, 255, 0.15) 50%,
            rgba(255, 255, 255, 0.06) 100%
          );
          background-size: 200% 100%;
          animation: vahn-shimmer 1.8s infinite ease-in-out;
        }

        .vahn-shimmer-light {
          background: linear-gradient(
            90deg,
            #eeeeef 0%,
            #fbfbfe 50%,
            #eeeeef 100%
          );
          background-size: 200% 100%;
          animation: vahn-shimmer 1.8s infinite ease-in-out;
        }

        .vahn-shimmer-blue {
          background: linear-gradient(
            90deg,
            #2e2a7a 0%,
            #3a3699 50%,
            #2e2a7a 100%
          );
          background-size: 200% 100%;
          animation: vahn-shimmer 1.8s infinite ease-in-out;
        }

        @keyframes vahn-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}
