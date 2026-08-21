import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getCollections } from '@/lib/api';
import type { CollectionListItem } from '@/lib/api/types';

// Always fetch fresh data — no cache so new collections appear instantly
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Collections — VAHN',
  description: 'Browse all VAHN bespoke teamwear collections. Crafted for clubs, academies and brands.',
};

export default async function CollectionsPage() {
  const collections = await getCollections();

  return (
    <>
      {/* ── Compact Sleek Header ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0a0a12 0%, #12131A 60%, #1a1040 100%)',
          padding: '40px var(--space-xl) 36px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Subtle grid overlay */}
        <div
          style={{
            position: 'absolute', inset: 0, opacity: 0.03,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.45)',
                background: 'rgba(255,255,255,0.06)',
                padding: '4px 12px',
                borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              VAHN CATALOGUE
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(2rem, 4.5vw, 3.8rem)',
              textTransform: 'uppercase',
              color: '#ffffff',
              lineHeight: 1,
              letterSpacing: '-0.025em',
              margin: '0 0 10px',
            }}
          >
            OUR COLLECTIONS
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.925rem',
              color: 'rgba(255,255,255,0.6)',
              maxWidth: 520,
              margin: '0 auto',
              lineHeight: 1.5,
            }}
          >
            Bespoke teamwear engineered for performance. Select a collection below to view items.
          </p>
        </div>
      </div>

      {/* ── Collections Grid ── */}
      <div style={{ background: '#ffffff', padding: 'var(--space-xl) var(--space-xl) var(--space-2xl)' }}>
        <div style={{ maxWidth: 'var(--page-width)', margin: '0 auto' }}>

          {/* Section label & count */}
          <div style={{ marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--color-navy)',
                  color: '#fff',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  letterSpacing: '-0.025em',
                  padding: '4px 10px',
                  minWidth: 28,
                }}
              >
                {collections.length}
              </span>
              <p
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '-0.025em',
                  textTransform: 'uppercase',
                  color: 'var(--color-grey-dark)',
                  margin: 0,
                }}
              >
                Collection{collections.length !== 1 ? 's' : ''} Available
              </p>
            </div>

            <div style={{ flex: 1, height: 1, background: 'var(--color-grey-mid)', maxWidth: 400 }} />
          </div>

          {collections.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--space-3xl) var(--space-md)',
                border: '1px dashed var(--color-border)',
                background: 'var(--color-grey-light)',
              }}
            >
              <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '1.1rem', color: 'var(--color-grey-dark)', marginBottom: 8 }}>
                New collections arriving soon.
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-grey-dark)' }}>
                Check back shortly — something extraordinary is in the making.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 440px), 1fr))',
                gap: 'var(--space-lg)',
              }}
            >
              {collections.map((c: CollectionListItem) => (
                <CollectionCard key={c.id} collection={c} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div
        style={{
          background: 'linear-gradient(180deg, #0a0a12 0%, #12131A 100%)',
          textAlign: 'center',
          padding: 'var(--space-2xl) var(--space-xl)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.4rem, 3.5vw, 2.5rem)',
            textTransform: 'uppercase',
            color: '#fff',
            marginBottom: 12,
            letterSpacing: '-0.025em',
          }}
        >
          {"Can't find what you need?"}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-body)', fontSize: '1rem', marginBottom: 28 }}>
          We offer fully custom bespoke design. Get in touch with our team.
        </p>
        <Link
          href="/pages/catalogue-page"
          style={{
            display: 'inline-block',
            background: 'var(--color-navy)',
            color: '#fff',
            padding: '14px 36px',
            fontFamily: 'var(--font-ui)',
            fontWeight: 700,
            fontSize: '0.8rem',
            letterSpacing: '-0.025em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            border: '1px solid var(--color-navy)',
          }}
        >
          Download Catalogue →
        </Link>
      </div>
    </>
  );
}

function CollectionCard({ collection }: { collection: CollectionListItem }) {
  return (
    <Link
      href={`/collections/${collection.handle}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div className="collection-card-wrapper">
        <div className="collection-card-media">
          {collection.image ? (
            <Image
              src={collection.image.url}
              alt={collection.image.altText ?? collection.title}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              style={{ objectFit: 'cover', transition: 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
              className="collection-card-img"
            />
          ) : (
            <div className="collection-card-placeholder">
              <span className="collection-card-monogram">VAHN</span>
            </div>
          )}
          <div className="collection-card-overlay">
            <span className="collection-card-cta">View Collection →</span>
          </div>
          <div className="collection-card-count">
            {collection.products_count} Product{collection.products_count !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="collection-card-info">
          <h3 className="collection-card-title">{collection.title}</h3>
          {collection.description && (
            <p className="collection-card-desc">
              {collection.description.length > 120
                ? collection.description.slice(0, 120) + '…'
                : collection.description}
            </p>
          )}
          <span className="collection-card-arrow">View Collection →</span>
        </div>
      </div>
    </Link>
  );
}
