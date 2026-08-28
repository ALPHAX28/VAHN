'use client';

export default function SingleCollectionLoading() {
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

      {/* Collection Hero Banner */}
      <div
        style={{
          background: '#0d0d12',
          padding: '60px 24px 50px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div className="vahn-shimmer-dark" style={{ width: 'clamp(200px, 40vw, 360px)', height: '42px', borderRadius: '4px' }} />
        <div className="vahn-shimmer-dark" style={{ width: 'clamp(260px, 50vw, 480px)', height: '16px', borderRadius: '3px' }} />
      </div>

      {/* Products Grid */}
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '48px clamp(16px, 4vw, 48px) 80px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '36px 20px',
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="vahn-shimmer-light" style={{ width: '100%', aspectRatio: '4 / 5', borderRadius: '2px' }} />
              <div className="vahn-shimmer-light" style={{ width: '60px', height: '12px', borderRadius: '2px' }} />
              <div className="vahn-shimmer-light" style={{ width: '80%', height: '16px', borderRadius: '2px' }} />
              <div className="vahn-shimmer-light" style={{ width: '50px', height: '14px', borderRadius: '2px' }} />
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .vahn-shimmer-dark {
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.16) 50%, rgba(255, 255, 255, 0.06) 100%);
          background-size: 200% 100%;
          animation: vahn-shimmer 1.6s infinite ease-in-out;
        }
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
