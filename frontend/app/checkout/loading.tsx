'use client';

export default function CheckoutLoading() {
  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', width: '100%', overflow: 'hidden' }}>
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

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px clamp(16px, 4vw, 48px) 80px' }}>
        {/* Checkout Steps Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '36px' }}>
          <div className="vahn-shimmer-light" style={{ width: '160px', height: '28px', borderRadius: '4px' }} />
          <div className="vahn-shimmer-light" style={{ width: '20px', height: '2px', borderRadius: '1px' }} />
          <div className="vahn-shimmer-light" style={{ width: '140px', height: '28px', borderRadius: '4px', opacity: 0.5 }} />
        </div>

        <div className="checkout-skeleton-grid">
          {/* Left: Address Selection / Form Skeleton */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="vahn-shimmer-light" style={{ width: '180px', height: '24px', borderRadius: '2px' }} />
              <div className="vahn-shimmer-light" style={{ width: '130px', height: '36px', borderRadius: '2px' }} />
            </div>

            {/* Address Cards */}
            {[1, 2].map((i) => (
              <div
                key={i}
                style={{
                  border: '1px solid #e8e8e8',
                  borderRadius: '4px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div className="vahn-shimmer-light" style={{ width: '140px', height: '18px', borderRadius: '2px' }} />
                  <div className="vahn-shimmer-light" style={{ width: '60px', height: '20px', borderRadius: '10px' }} />
                </div>
                <div className="vahn-shimmer-light" style={{ width: '80%', height: '14px', borderRadius: '2px' }} />
                <div className="vahn-shimmer-light" style={{ width: '60%', height: '14px', borderRadius: '2px' }} />
                <div className="vahn-shimmer-light" style={{ width: '120px', height: '14px', borderRadius: '2px' }} />
              </div>
            ))}

            <div className="vahn-shimmer-blue" style={{ width: '100%', height: '48px', borderRadius: '2px', marginTop: '12px' }} />
          </div>

          {/* Right: Order Summary Sidebar */}
          <div
            style={{
              background: '#f9f9fb',
              border: '1px solid #eeeeee',
              borderRadius: '4px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              height: 'fit-content',
            }}
          >
            <div className="vahn-shimmer-light" style={{ width: '140px', height: '22px', borderRadius: '2px', marginBottom: '8px' }} />

            {/* Items preview */}
            {[1, 2].map((item) => (
              <div key={item} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div className="vahn-shimmer-light" style={{ width: '54px', height: '54px', borderRadius: '2px', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                  <div className="vahn-shimmer-light" style={{ width: '75%', height: '14px', borderRadius: '2px' }} />
                  <div className="vahn-shimmer-light" style={{ width: '45%', height: '12px', borderRadius: '2px' }} />
                </div>
                <div className="vahn-shimmer-light" style={{ width: '60px', height: '14px', borderRadius: '2px', marginLeft: 'auto' }} />
              </div>
            ))}

            <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="vahn-shimmer-light" style={{ width: '60px', height: '14px', borderRadius: '2px' }} />
                <div className="vahn-shimmer-light" style={{ width: '70px', height: '14px', borderRadius: '2px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="vahn-shimmer-light" style={{ width: '70px', height: '14px', borderRadius: '2px' }} />
                <div className="vahn-shimmer-light" style={{ width: '50px', height: '14px', borderRadius: '2px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e8e8e8', paddingTop: '10px' }}>
                <div className="vahn-shimmer-light" style={{ width: '80px', height: '18px', borderRadius: '2px' }} />
                <div className="vahn-shimmer-light" style={{ width: '90px', height: '18px', borderRadius: '2px' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .checkout-skeleton-grid {
          display: grid;
          grid-template-columns: 1.35fr 0.85fr;
          gap: 48px;
        }
        @media (max-width: 900px) {
          .checkout-skeleton-grid {
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
