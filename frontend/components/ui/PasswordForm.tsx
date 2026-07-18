'use client';

export default function PasswordForm() {
  return (
    <form
      style={{
        display: 'flex',
        gap: '0',
        width: '100%',
        maxWidth: '440px',
        borderBottom: '2px solid rgba(255,255,255,0.5)',
        paddingBottom: '8px',
      }}
      onSubmit={(e) => {
        e.preventDefault();
        alert("You're on the list!");
      }}
    >
      <input
        type="email"
        name="email"
        placeholder="Enter your email"
        required
        style={{
          flex: 1,
          background: 'none',
          border: 'none',
          outline: 'none',
          color: 'white',
          fontFamily: 'var(--font-ui)',
          fontSize: '1rem',
          padding: '4px 0',
        }}
      />
      <button
        type="submit"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'white',
          fontFamily: 'var(--font-ui)',
          fontWeight: 600,
          letterSpacing: '0.08em',
          fontSize: '0.875rem',
          textTransform: 'uppercase',
        }}
      >
        Notify Me →
      </button>
    </form>
  );
}
