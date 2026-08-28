'use client';

export default function CartLoading() {
  return (
    <div style={{ background: '#ffffff', minHeight: '80vh', width: '100%', overflow: 'hidden' }}>
      {/* Top 3px progress bar */}
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

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px clamp(16px, 4vw, 40px) 80px' }}>
        {/* Title */}
        <div className="vahn-shimmer-light" style={{ width: '220px', height: '36px', borderRadius: '4px', marginBottom: '36px' }} />

        <div className="cart-skeleton-grid">
          {/* Left: Cart Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {[1, 2].map((i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 1fr',
                  gap: '20px',
                  paddingBottom: '24px',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <div className="vahn-shimmer-light" style={{ width: '100px', height: '100px', borderRadius: '2px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="vahn-shimmer-light" style={{ width: '65%', height: '18px', borderRadius: '2px' }} />
                  <div className="vahn-shimmer-light" style={{ width: '40%', height: '14px', borderRadius: '2px' }} />
                  <div className="vahn-shimmer-light" style={{ width: '80px', height: '16px', borderRadius: '2px', marginTop: 'auto' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Right: Summary Box */}
          <div
            style={{
              background: '#f9f9fb',
              padding: '24px',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              height: 'fit-content',
            }}
          >
            <div className="vahn-shimmer-light" style={{ width: '140px', height: '20px', borderRadius: '2px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div className="vahn-shimmer-light" style={{ width: '70px', height: '14px', borderRadius: '2px' }} />
              <div className="vahn-shimmer-light" style={{ width: '60px', height: '14px', borderRadius: '2px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div className="vahn-shimmer-light" style={{ width: '90px', height: '14px', borderRadius: '2px' }} />
              <div className="vahn-shimmer-light" style={{ width: '50px', height: '14px', borderRadius: '2px' }} />
            </div>
            <div className="vahn-shimmer-blue" style={{ width: '100%', height: '46px', borderRadius: '2px', marginTop: '12px' }} />
          </div>
        </div>
      </div>

      <style jsx>{`
        .cart-skeleton-grid {
          display: grid;
          grid-template-columns: 1.4fr 0.8fr;
          gap: 48px;
        }
        @media (max-width: 860px) {
          .cart-skeleton-grid {
            grid-template-columns: 1fr;
            gap: 32px;
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
