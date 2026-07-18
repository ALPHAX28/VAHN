import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="not-found">
      <h1>404</h1>
      <div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Page not found</h2>
        <p style={{ color: 'var(--color-grey-dark)', fontFamily: 'var(--font-body)', marginBottom: '32px' }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/" className="btn btn-primary">
          ← Back to Home
        </Link>
        <Link href="/collections/vahn-beginning" className="btn btn-secondary">
          Shop Collection
        </Link>
      </div>
    </div>
  );
}
