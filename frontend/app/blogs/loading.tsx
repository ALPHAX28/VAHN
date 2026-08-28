'use client';

export default function BlogsLoading() {
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
        <div className="vahn-shimmer-light" style={{ width: '260px', height: '36px', borderRadius: '4px', marginBottom: '40px' }} />

        {/* Article Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '36px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="vahn-shimmer-light" style={{ width: '100%', aspectRatio: '16 / 10', borderRadius: '2px' }} />
              <div className="vahn-shimmer-light" style={{ width: '90px', height: '12px', borderRadius: '2px' }} />
              <div className="vahn-shimmer-light" style={{ width: '85%', height: '22px', borderRadius: '2px' }} />
              <div className="vahn-shimmer-light" style={{ width: '100%', height: '14px', borderRadius: '2px' }} />
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
