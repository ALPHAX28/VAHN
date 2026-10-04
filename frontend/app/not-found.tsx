import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="not-found">
      <h1>404</h1>
      <div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Page not found</h2>
        <p
          style={{
            color: 'var(--color-grey-dark)',
            fontFamily: 'var(--font-body)',
            marginBottom: '32px',
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/" className="btn btn-primary">
          ← Back to Home
        </Link>
        <Link
          href="/products"
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span>Explore Products</span>
          <svg
            className="btn-checkout-arrow"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
