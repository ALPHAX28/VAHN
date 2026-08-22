'use client';

export default function GlobalLoading() {
  return (
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
      `}</style>
    </div>
  );
}
