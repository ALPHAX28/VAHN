'use client';

export default function AddressesLoading() {
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

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px clamp(16px, 4vw, 40px) 80px' }}>
        {/* Header and Add Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <div className="vahn-shimmer-light" style={{ width: '220px', height: '32px', borderRadius: '4px', marginBottom: '8px' }} />
            <div className="vahn-shimmer-light" style={{ width: '160px', height: '14px', borderRadius: '2px' }} />
          </div>
          <div className="vahn-shimmer-blue" style={{ width: '150px', height: '40px', borderRadius: '2px' }} />
        </div>

        {/* Address Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '20px' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                border: '1px solid #e8e8e8',
                borderRadius: '4px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="vahn-shimmer-light" style={{ width: '120px', height: '18px', borderRadius: '2px' }} />
                <div className="vahn-shimmer-light" style={{ width: '55px', height: '18px', borderRadius: '10px' }} />
              </div>
              <div className="vahn-shimmer-light" style={{ width: '90%', height: '14px', borderRadius: '2px' }} />
              <div className="vahn-shimmer-light" style={{ width: '60%', height: '14px', borderRadius: '2px' }} />
              <div className="vahn-shimmer-light" style={{ width: '100px', height: '14px', borderRadius: '2px' }} />

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
                <div className="vahn-shimmer-light" style={{ width: '60px', height: '28px', borderRadius: '2px' }} />
                <div className="vahn-shimmer-light" style={{ width: '60px', height: '28px', borderRadius: '2px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
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
