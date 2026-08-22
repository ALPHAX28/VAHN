'use client';

export default function GlobalLoading() {
  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      {/* 1. Sleek top 3px animated glowing progress bar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          zIndex: 99999,
          background: 'rgba(58, 54, 153, 0.12)',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <div
          style={{
            height: '100%',
            width: '100%',
            background: 'linear-gradient(90deg, #3a3699 0%, #6366f1 50%, #3a3699 100%)',
            animation: 'vahn-top-progress 1.2s infinite cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>

      {/* 2. Hero Section Skeleton — 100vh dark with shimmering gradient */}
      <div
        className="vahn-skeleton-dark"
        style={{
          position: 'relative',
          width: '100%',
          height: '100vh',
          minHeight: '640px',
          marginTop: '-60px',
          paddingTop: '60px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingBottom: '80px',
        }}
      >
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          {/* Headline Skeleton */}
          <div
            className="vahn-shimmer-dark"
            style={{
              width: 'clamp(240px, 45vw, 420px)',
              height: 'clamp(42px, 6vw, 72px)',
              borderRadius: '4px',
            }}
          />
          {/* Subtext / CTA Skeleton */}
          <div
            className="vahn-shimmer-dark"
            style={{
              width: '100px',
              height: '18px',
              borderRadius: '3px',
              opacity: 0.6,
            }}
          />
        </div>
      </div>

      {/* 3. Fresh Out of the Locker Section Skeleton */}
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
            width: 'clamp(200px, 30vw, 320px)',
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
                  style={{ width: '40%', height: '12px', borderRadius: '2px' }}
                />
                <div
                  className="vahn-shimmer-light"
                  style={{ width: '80%', height: '16px', borderRadius: '2px' }}
                />
                <div
                  className="vahn-shimmer-light"
                  style={{ width: '30%', height: '14px', borderRadius: '2px' }}
                />
              </div>
            </div>
          ))}
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

        .vahn-skeleton-dark {
          background: #15171c;
        }

        .vahn-shimmer-dark {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.04) 0%,
            rgba(255, 255, 255, 0.12) 50%,
            rgba(255, 255, 255, 0.04) 100%
          );
          background-size: 200% 100%;
          animation: vahn-shimmer 1.8s infinite ease-in-out;
        }

        .vahn-shimmer-light {
          background: linear-gradient(
            90deg,
            #f0f0f3 0%,
            #fafafc 50%,
            #f0f0f3 100%
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
