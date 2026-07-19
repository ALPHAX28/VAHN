'use client';

export default function GlobalLoading() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(255, 255, 255, 0.9)',
      zIndex: 9999,
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div className="premium-spinner" />
      <span style={{
        fontFamily: 'var(--font-heading)',
        fontSize: '1rem',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: '#000000',
        animation: 'pulse 1.5s infinite ease-in-out'
      }}>
        VAHN
      </span>
    </div>
  );
}
