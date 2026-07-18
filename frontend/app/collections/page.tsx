import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getCollections } from '@/lib/api';

export const metadata: Metadata = {
  title: 'All Collections',
  description: 'Browse all VAHN teamwear collections.',
};

export default async function CollectionsPage() {
  const collections = await getCollections().catch(() => []);

  return (
    <div style={{ maxWidth: 'var(--page-width)', margin: '0 auto', padding: 'var(--space-2xl) var(--space-xl)' }}>
      <h1 style={{ fontSize: 'clamp(2rem, 5vw, 5rem)', marginBottom: 'var(--space-2xl)', textAlign: 'center' }}>
        All Collections
      </h1>

      {collections.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-grey-dark)' }}>No collections found.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 'var(--space-lg)',
          }}
        >
          {collections.map((c) => (
            <Link
              key={c.id}
              href={`/collections/${c.handle}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div
                style={{
                  aspectRatio: '4/3',
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'var(--color-grey-light)',
                  marginBottom: '12px',
                }}
              >
                {c.image ? (
                  <Image
                    src={c.image.url}
                    alt={c.image.altText ?? c.title}
                    fill
                    sizes="(max-width: 600px) 100vw, 33vw"
                    style={{ objectFit: 'cover', transition: 'transform 0.4s ease' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'var(--color-navy)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', color: 'white', letterSpacing: '0.2em' }}>VAHN</span>
                  </div>
                )}
              </div>
              <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: '1rem', fontWeight: 600 }}>{c.title}</h3>
              {c.description && (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-grey-dark)', marginTop: '4px' }}>
                  {c.description.slice(0, 100)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
