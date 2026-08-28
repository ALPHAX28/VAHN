'use client';

export default function ProductsLoading() {
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

      {/* ── Page Title Skeleton ── */}
      <div className="shop-container-pad" style={{ paddingTop: '48px' }}>
        <div className="vahn-shimmer-light" style={{ width: 'clamp(180px, 30vw, 280px)', height: '36px', borderRadius: '4px', marginBottom: '10px' }} />
        <div className="vahn-shimmer-light" style={{ width: 'clamp(240px, 45vw, 440px)', height: '18px', borderRadius: '3px' }} />
      </div>

      {/* ── Sort Bar Skeleton ── */}
      <div className="shop-container-pad" style={{ paddingTop: '20px' }}>
        <div className="vahn-shimmer-light" style={{ width: '180px', height: '40px', borderRadius: '2px', border: '1px solid #e8e8e8' }} />
      </div>

      {/* ── Product Grid Skeleton (3 cols desktop, 2 cols mobile) ── */}
      <main className="shop-container-pad" style={{ paddingTop: '24px', paddingBottom: '80px' }}>
        <div className="shop-grid">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
              {/* 4:5 Aspect Ratio Image Card */}
              <div
                className="vahn-shimmer-light"
                style={{
                  width: '100%',
                  aspectRatio: '4 / 5',
                  borderRadius: '2px',
                  position: 'relative',
                  marginBottom: '10px',
                }}
              />

              {/* Meta row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: '2px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '70%' }}>
                  {/* Color tag shimmer */}
                  <div className="vahn-shimmer-light" style={{ width: '50px', height: '11px', borderRadius: '2px' }} />
                  {/* Product title shimmer */}
                  <div className="vahn-shimmer-light" style={{ width: '85%', height: '15px', borderRadius: '2px' }} />
                  {/* Price shimmer */}
                  <div className="vahn-shimmer-light" style={{ width: '45px', height: '14px', borderRadius: '2px' }} />
                </div>
                {/* Plus quick-add button skeleton */}
                <div className="vahn-shimmer-light" style={{ width: '24px', height: '24px', borderRadius: '2px', opacity: 0.6 }} />
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ── Trust Badges Skeleton Bar (3 Columns) ── */}
      <div className="trust-badges-bar shop-container-pad">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="trust-badge-item"
            style={{ borderLeft: i > 1 ? '1px solid rgba(255,255,255,0.25)' : 'none' }}
          >
            <div className="vahn-shimmer-blue" style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0 }} />
            <div className="vahn-shimmer-blue" style={{ width: '120px', height: '14px', borderRadius: '3px' }} />
          </div>
        ))}
      </div>

      <style jsx>{`
        .shop-container-pad {
          padding-left: clamp(48px, 8vw, 140px);
          padding-right: clamp(48px, 8vw, 140px);
        }
        .shop-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 48px 24px;
        }
        .trust-badges-bar {
          background: #4232d9;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          padding: 24px clamp(48px, 8vw, 140px);
        }
        .trust-badge-item {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 0 16px;
        }

        @media (max-width: 900px) {
          .shop-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 36px 16px;
          }
        }

        @media (max-width: 768px) {
          .shop-container-pad {
            padding-left: 16px;
            padding-right: 16px;
          }
          .shop-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 24px 12px;
          }
          .trust-badges-bar {
            grid-template-columns: 1fr 1fr 1fr !important;
            padding: 16px 8px !important;
          }
          .trust-badge-item {
            flex-direction: column !important;
            gap: 6px !important;
            padding: 0 4px !important;
          }
        }

        .vahn-shimmer-light {
          background: linear-gradient(90deg, #f0f0f2 0%, #f9f9fc 50%, #f0f0f2 100%);
          background-size: 200% 100%;
          animation: vahn-shimmer 1.6s infinite ease-in-out;
        }

        .vahn-shimmer-blue {
          background: linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.15) 100%);
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
