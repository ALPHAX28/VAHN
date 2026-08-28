'use client';

export default function ArticleLoading() {
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

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px clamp(16px, 4vw, 40px) 100px' }}>
        <div className="vahn-shimmer-light" style={{ width: '100px', height: '14px', borderRadius: '2px', marginBottom: '16px' }} />
        <div className="vahn-shimmer-light" style={{ width: '90%', height: '42px', borderRadius: '4px', marginBottom: '12px' }} />
        <div className="vahn-shimmer-light" style={{ width: '140px', height: '14px', borderRadius: '2px', marginBottom: '32px' }} />

        {/* Featured Image */}
        <div className="vahn-shimmer-light" style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: '4px', marginBottom: '36px' }} />

        {/* Content Paragraphs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="vahn-shimmer-light" style={{ width: '100%', height: '16px', borderRadius: '2px' }} />
          <div className="vahn-shimmer-light" style={{ width: '98%', height: '16px', borderRadius: '2px' }} />
          <div className="vahn-shimmer-light" style={{ width: '92%', height: '16px', borderRadius: '2px' }} />
          <div className="vahn-shimmer-light" style={{ width: '60%', height: '16px', borderRadius: '2px' }} />
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
