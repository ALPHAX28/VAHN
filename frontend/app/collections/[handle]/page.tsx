import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getCollection, getCollections } from '@/lib/api';
import ProductCard from '@/components/collection/ProductCard';
import CollectionFilters from '@/components/collection/CollectionFilters';
import type { CollectionListItem } from '@/lib/api/types';

export const revalidate = 60;

interface Props {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const collection = await getCollection(handle).catch(() => null);
  if (!collection) return { title: 'Collection Not Found' };
  return {
    title: `${collection.seo.title ?? collection.title} — VAHN`,
    description: collection.seo.description ?? collection.description.slice(0, 160),
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { handle } = await params;
  const sp = await searchParams;

  const sortKey = (sp.sort as string) ?? 'MANUAL';
  const reverse = sp.reverse === 'true';

  // Build filter array from search params
  const filters: Record<string, string>[] = [];
  Object.entries(sp).forEach(([key, value]) => {
    if (key.startsWith('filter.')) {
      const values = Array.isArray(value) ? value : [value];
      values.forEach((v) => filters.push({ [key]: v }));
    }
  });

  const [collection, allCollections] = await Promise.all([
    getCollection(handle, {
      first: 24,
      sortKey,
      reverse,
      filters: filters.length > 0 ? filters : undefined,
    }).catch(() => null),
    getCollections().catch(() => []),
  ]);

  if (!collection) notFound();

  const products = collection.products.edges.map((e) => e.node);
  const availableFilters = collection.products.filters ?? [];
  const hasImage = !!collection.image;
  const otherCollections = allCollections.filter((c: CollectionListItem) => c.handle !== handle);

  return (
    <>
      {/* ── Immersive Collection Header ── */}
      <div
        style={{
          position: 'relative',
          minHeight: 340,
          display: 'flex',
          alignItems: 'flex-end',
          overflow: 'hidden',
          background: hasImage ? undefined : 'linear-gradient(135deg, #0a0a12 0%, #12131A 60%, #1a1040 100%)',
        }}
      >
        {/* Background image */}
        {hasImage && collection.image && (
          <Image
            src={collection.image.url}
            alt={collection.image.altText ?? collection.title}
            fill
            priority
            sizes="100vw"
            style={{ objectFit: 'cover', objectPosition: 'center 30%' }}
          />
        )}

        {/* Dark gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: hasImage
              ? 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.1) 100%)'
              : 'none',
          }}
        />

        {/* Grid overlay for no-image state */}
        {!hasImage && (
          <div
            style={{
              position: 'absolute', inset: 0, opacity: 0.04,
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        )}

        {/* Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            maxWidth: 'var(--page-width)',
            width: '100%',
            margin: '0 auto',
            padding: 'var(--space-2xl) var(--space-xl) var(--space-xl)',
          }}
        >
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Link
              href="/collections"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.72rem',
                fontWeight: 600,
                letterSpacing: '-0.025em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.5)',
                textDecoration: 'none',
              }}
            >
              Shop
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem' }}>›</span>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.72rem',
                fontWeight: 600,
                letterSpacing: '-0.025em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              {collection.title}
            </span>
          </div>

          {/* Collection title */}
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(2.2rem, 6vw, 5rem)',
              textTransform: 'uppercase',
              color: '#ffffff',
              lineHeight: 1,
              letterSpacing: '-0.025em',
              marginBottom: collection.description ? 16 : 0,
            }}
          >
            {collection.title}
          </h1>

          {collection.description && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
                color: 'rgba(255,255,255,0.65)',
                maxWidth: 560,
                lineHeight: 1.65,
                marginBottom: 0,
              }}
            >
              {collection.description}
            </p>
          )}
        </div>
      </div>

      {/* ── Products Section ── */}
      <div style={{ maxWidth: 'var(--page-width)', margin: '0 auto', padding: 'var(--space-xl) var(--space-xl)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-xl)', alignItems: 'flex-start' }}>

          {/* Filters sidebar */}
          {availableFilters.length > 0 && (
            <aside style={{ width: 240, flexShrink: 0 }}>
              <CollectionFilters filters={availableFilters} />
            </aside>
          )}

          {/* Products column */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Sort / count bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-lg)',
                paddingBottom: 'var(--space-md)',
                borderBottom: '1px solid var(--color-grey-mid)',
              }}
            >
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
                    minWidth: 32,
                  }}
                >
                  {products.length}
                </span>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.82rem', color: 'var(--color-grey-dark)', margin: 0 }}>
                  Product{products.length !== 1 ? 's' : ''} in this collection
                </p>
              </div>

              <form id="sort-form" method="get">
                <select
                  name="sort"
                  defaultValue={sortKey}
                  form="sort-form"
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 2,
                    padding: '8px 12px',
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    background: 'var(--color-white)',
                    cursor: 'pointer',
                    outline: 'none',
                    color: 'var(--color-black)',
                    letterSpacing: '-0.025em',
                  }}
                >
                  <option value="MANUAL">Featured</option>
                  <option value="BEST_SELLING">Best Selling</option>
                  <option value="PRICE">Price: Low → High</option>
                  <option value="CREATED_AT">Newest</option>
                </select>
                <button type="submit" form="sort-form" style={{ display: 'none' }} />
              </form>
            </div>

            {/* Products grid or empty state */}
            {products.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: 'var(--space-3xl) var(--space-md)',
                  border: '1px dashed var(--color-border)',
                  background: 'var(--color-grey-light)',
                }}
              >
                <div
                  style={{
                    width: 56, height: 56,
                    background: 'var(--color-grey-mid)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>
                  No products found in this collection
                </p>
                <p style={{ color: 'var(--color-grey-dark)', fontSize: '0.875rem', marginBottom: 24 }}>
                  Add products from the Admin Panel or explore our other collections below.
                </p>
                <Link
                  href="/collections"
                  style={{
                    display: 'inline-block',
                    background: 'var(--color-navy)',
                    color: '#fff',
                    padding: '10px 24px',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    letterSpacing: '-0.025em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                  }}
                >
                  View All Collections →
                </Link>
              </div>
            ) : (
              <div className="product-grid collection-product-grid">
                {products.map((p, i) => (
                  <div
                    key={p.id}
                    className="collection-product-item"
                    style={{ animationDelay: `${Math.min(i * 0.05, 0.4)}s` }}
                  >
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {collection.products.pageInfo.hasNextPage && (
              <div className="pagination" style={{ marginTop: 'var(--space-xl)' }}>
                <Link
                  href={`?after=${collection.products.pageInfo.endCursor}`}
                  className="pagination-btn"
                >
                  Load More →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Explore Other Collections ── */}
      {otherCollections.length > 0 && (
        <div style={{ background: '#f8f8fc', borderTop: '1px solid var(--color-grey-mid)', padding: 'var(--space-2xl) var(--space-xl)' }}>
          <div style={{ maxWidth: 'var(--page-width)', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xl)' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '-0.025em', textTransform: 'uppercase', color: 'var(--color-grey-dark)', margin: 0 }}>
                  Explore More
                </p>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', textTransform: 'uppercase', margin: '4px 0 0', letterSpacing: '-0.025em' }}>
                  Other Collections
                </h2>
              </div>
              <Link
                href="/collections"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '-0.025em',
                  textTransform: 'uppercase',
                  color: 'var(--color-navy)',
                  textDecoration: 'none',
                }}
              >
                All Collections ({allCollections.length}) →
              </Link>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))',
                gap: 'var(--space-lg)',
              }}
            >
              {otherCollections.map((c: CollectionListItem) => (
                <Link
                  key={c.id}
                  href={`/collections/${c.handle}`}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--color-grey-mid)',
                      padding: 20,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    }}
                    className="other-collection-card"
                  >
                    <div style={{ width: 80, height: 80, position: 'relative', overflow: 'hidden', background: 'var(--color-navy)', flexShrink: 0 }}>
                      {c.image ? (
                        <Image src={c.image.url} alt={c.title} fill style={{ objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-heading)', fontSize: '1.1rem' }}>
                          VAHN
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', margin: '0 0 4px', letterSpacing: '-0.025em' }}>
                        {c.title}
                      </h3>
                      <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.78rem', color: 'var(--color-grey-dark)', margin: 0 }}>
                        {c.products_count} Product{c.products_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span style={{ fontSize: '1.2rem', color: 'var(--color-navy)' }}>→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
