'use client';

export default function OrderDetailLoading() {
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

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px clamp(16px, 4vw, 40px) 80px' }}>
        {/* Back Link & Header */}
        <div className="vahn-shimmer-light" style={{ width: '110px', height: '16px', borderRadius: '2px', marginBottom: '20px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <div className="vahn-shimmer-light" style={{ width: '220px', height: '32px', borderRadius: '4px', marginBottom: '6px' }} />
            <div className="vahn-shimmer-light" style={{ width: '160px', height: '14px', borderRadius: '2px' }} />
          </div>
          <div className="vahn-shimmer-light" style={{ width: '120px', height: '36px', borderRadius: '2px' }} />
        </div>

        {/* Status Tracker Box */}
        <div
          style={{
            border: '1px solid #e8e8e8',
            borderRadius: '4px',
            padding: '24px',
            marginBottom: '32px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {[1, 2, 3].map((step) => (
              <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '30%' }}>
                <div className="vahn-shimmer-light" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                <div className="vahn-shimmer-light" style={{ width: '80%', height: '14px', borderRadius: '2px' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Items and Details Split */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr', gap: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="vahn-shimmer-light" style={{ width: '140px', height: '22px', borderRadius: '2px' }} />
            {[1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', gap: '16px', border: '1px solid #f0f0f0', padding: '16px', borderRadius: '4px' }}>
                <div className="vahn-shimmer-light" style={{ width: '70px', height: '70px', borderRadius: '2px', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                  <div className="vahn-shimmer-light" style={{ width: '80%', height: '16px', borderRadius: '2px' }} />
                  <div className="vahn-shimmer-light" style={{ width: '40%', height: '14px', borderRadius: '2px' }} />
                  <div className="vahn-shimmer-light" style={{ width: '60px', height: '16px', borderRadius: '2px' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Delivery & Summary Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ border: '1px solid #f0f0f0', padding: '20px', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="vahn-shimmer-light" style={{ width: '130px', height: '18px', borderRadius: '2px' }} />
              <div className="vahn-shimmer-light" style={{ width: '90%', height: '14px', borderRadius: '2px' }} />
              <div className="vahn-shimmer-light" style={{ width: '60%', height: '14px', borderRadius: '2px' }} />
            </div>

            <div style={{ border: '1px solid #f0f0f0', padding: '20px', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="vahn-shimmer-light" style={{ width: '110px', height: '18px', borderRadius: '2px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="vahn-shimmer-light" style={{ width: '60px', height: '14px', borderRadius: '2px' }} />
                <div className="vahn-shimmer-light" style={{ width: '50px', height: '14px', borderRadius: '2px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="vahn-shimmer-light" style={{ width: '80px', height: '16px', borderRadius: '2px' }} />
                <div className="vahn-shimmer-light" style={{ width: '70px', height: '16px', borderRadius: '2px' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .vahn-shimmer-light {
          background: linear-gradient(90deg, #f0f0f2 0%, #f9f9fc 50%, #f0f0f2 100%);
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
