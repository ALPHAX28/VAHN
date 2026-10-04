'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log client error to console
    console.error('App runtime error caught by boundary:', error);
  }, [error]);

  return (
    <div className="not-found" style={{ minHeight: '65vh', padding: '60px 20px' }}>
      <h1 style={{ fontSize: '3rem', letterSpacing: '0.05em' }}>SOMETHING WENT WRONG</h1>
      <div>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '12px', fontWeight: 700 }}>
          We encountered an unexpected error while loading this page.
        </h2>
        <p
          style={{
            color: 'var(--color-grey-dark)',
            fontFamily: 'var(--font-body)',
            marginBottom: '32px',
            maxWidth: '500px',
            margin: '0 auto 32px auto',
            lineHeight: 1.6,
          }}
        >
          Our team has been automatically alerted. You can try reloading this section or return to
          the homepage.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => reset()}
          className="btn btn-primary"
          style={{ cursor: 'pointer' }}
        >
          Try Again
        </button>
        <Link href="/" className="btn btn-secondary">
          ← Return to Home
        </Link>
      </div>
    </div>
  );
}
