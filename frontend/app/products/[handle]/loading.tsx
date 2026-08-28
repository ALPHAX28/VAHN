'use client';

export default function ProductDetailLoading() {
  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', width: '100%', overflow: 'hidden' }}>
      {/* Top 3px animated glowing progress bar */}
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

      {/* ── Product Page 2-Column Split Skeleton ── */}
      <div className="pdp-skeleton-container">
        {/* Left: Gallery Skeleton */}
        <div className="pdp-gallery-col">
          <div
            className="vahn-shimmer-light pdp-main-img"
            style={{
              width: '100%',
              aspectRatio: '3 / 4',
              borderRadius: '2px',
              marginBottom: '16px',
            }}
          />
          {/* Thumbnails Row */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {[1, 2, 3, 4].map((t) => (
              <div
                key={t}
                className="vahn-shimmer-light"
                style={{ width: '70px', height: '90px', borderRadius: '2px' }}
              />
            ))}
          </div>
        </div>

        {/* Right: Product Info Skeleton */}
        <div className="pdp-info-col">
          {/* Brand/Category Tag */}
          <div className="vahn-shimmer-light" style={{ width: '60px', height: '12px', borderRadius: '2px', marginBottom: '8px' }} />

          {/* Product Title */}
          <div className="vahn-shimmer-light" style={{ width: '85%', height: '32px', borderRadius: '3px', marginBottom: '12px' }} />

          {/* Price */}
          <div className="vahn-shimmer-light" style={{ width: '90px', height: '22px', borderRadius: '2px', marginBottom: '6px' }} />
          <div className="vahn-shimmer-light" style={{ width: '130px', height: '11px', borderRadius: '2px', marginBottom: '28px' }} />

          {/* Colour Section */}
          <div className="vahn-shimmer-light" style={{ width: '80px', height: '14px', borderRadius: '2px', marginBottom: '10px' }} />
          <div style={{ display: 'flex', gap: '10px', marginBottom: '28px' }}>
            {[1, 2, 3].map((c) => (
              <div key={c} className="vahn-shimmer-light" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
            ))}
          </div>

          {/* Size Section */}
          <div className="vahn-shimmer-light" style={{ width: '70px', height: '14px', borderRadius: '2px', marginBottom: '10px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '32px' }}>
            {['XS', 'S', 'M', 'L', 'XL'].map((s) => (
              <div key={s} className="vahn-shimmer-light" style={{ height: '42px', borderRadius: '2px' }} />
            ))}
          </div>

          {/* Add to Cart CTA Button Skeleton */}
          <div
            className="vahn-shimmer-blue"
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '2px',
              marginBottom: '28px',
            }}
          />

          {/* Accordion list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid #eeeeee', paddingTop: '20px' }}>
            {[1, 2, 3].map((acc) => (
              <div key={acc} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' }}>
                <div className="vahn-shimmer-light" style={{ width: '140px', height: '16px', borderRadius: '2px' }} />
                <div className="vahn-shimmer-light" style={{ width: '16px', height: '16px', borderRadius: '2px' }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .pdp-skeleton-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 32px clamp(20px, 4vw, 48px) 80px;
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: clamp(32px, 5vw, 64px);
        }

        .pdp-gallery-col {
          display: flex;
          flex-direction: column;
        }

        .pdp-info-col {
          display: flex;
          flex-direction: column;
        }

        @media (max-width: 900px) {
          .pdp-skeleton-container {
            grid-template-columns: 1fr;
            padding: 16px 16px 56px;
            gap: 28px;
          }
        }

        .vahn-shimmer-light {
          background: linear-gradient(90deg, #f0f0f2 0%, #f9f9fc 50%, #f0f0f2 100%);
          background-size: 200% 100%;
          animation: vahn-shimmer 1.6s infinite ease-in-out;
        }

        .vahn-shimmer-blue {
          background: linear-gradient(90deg, #4232d9 0%, #6355eb 50%, #4232d9 100%);
          background-size: 200% 100%;
          animation: vahn-shimmer 1.6s infinite ease-in-out;
        }

        @keyframes vahn-top-progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }

        @keyframes vahn-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
