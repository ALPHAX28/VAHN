import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCollection } from '@/lib/api';
import ProductCard from '@/components/collection/ProductCard';
import CollectionFilters from '@/components/collection/CollectionFilters';

interface Props {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}

export async function generateStaticParams() {
  return [
    { handle: 'vahn-beginning' },
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const collection = await getCollection(handle).catch(() => null);
  if (!collection) return { title: 'Collection Not Found' };
  return {
    title: collection.seo.title ?? collection.title,
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

  const collection = await getCollection(handle, {
    first: 24,
    sortKey,
    reverse,
    filters: filters.length > 0 ? filters : undefined,
  }).catch(() => null);

  if (!collection) notFound();

  const products = collection.products.edges.map((e) => e.node);
  const availableFilters = collection.products.filters ?? [];

  // Special: catalogue page card (from collection.json)
  const isCatalogueCollection = handle === 'vahn-beginning';

  return (
    <>
      {/* Collection header */}
      <div
        style={{
          background: 'var(--color-grey-light)',
          borderBottom: '1px solid var(--color-border)',
          padding: 'var(--space-2xl) var(--space-xl)',
        }}
      >
        <div style={{ maxWidth: 'var(--page-width)', margin: '0 auto' }}>
          <p className="section-title">Collection</p>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2rem, 5vw, 5rem)', marginTop: '8px' }}>
            {collection.title}
          </h1>
          {collection.description && (
            <p style={{ marginTop: '16px', maxWidth: '600px', color: 'var(--color-grey-dark)', fontFamily: 'var(--font-body)' }}>
              {collection.description}
            </p>
          )}
        </div>
      </div>

      {/* Catalogue card for vahn-beginning */}
      {isCatalogueCollection && (
        <div style={{ maxWidth: 'var(--page-width)', margin: '24px auto 0', padding: '0 var(--space-xl)' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-grey-dark)', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>
            Our Catalogue
          </p>
          <a
            href="https://drive.google.com/file/d/1otQab6q8TzPgdPtEdZcdK3iRfv8-09c-/view?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="catalogue-card"
            style={{ maxWidth: '400px', display: 'block', marginTop: '12px' }}
          >
            <div style={{ aspectRatio: '4/3', background: 'var(--color-navy)', display: 'flex', alignItems: 'flex-end', padding: '24px', position: 'relative' }}>
              <div>
                <p className="catalogue-card-title">VAHN Bespoke Teamwear 2025</p>
                <p className="catalogue-card-desc">Click to download ↗</p>
              </div>
            </div>
          </a>
        </div>
      )}

      {/* Grid */}
      <div style={{ maxWidth: 'var(--page-width)', margin: '0 auto', padding: 'var(--space-xl) var(--space-xl)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-xl)', alignItems: 'flex-start' }}>
          {/* Filters sidebar */}
          {availableFilters.length > 0 && (
            <aside style={{ width: '240px', flexShrink: 0 }}>
              <CollectionFilters filters={availableFilters} />
            </aside>
          )}

          {/* Products */}
          <div style={{ flex: 1 }}>
            {/* Sort bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-grey-dark)' }}>
                {products.length} product{products.length !== 1 ? 's' : ''}
              </p>
              <form id="sort-form" method="get">
                <select
                  name="sort"
                  defaultValue={sortKey}
                  style={{
                    border: '1px solid var(--color-border)',
                    padding: '8px 12px',
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.875rem',
                    background: 'var(--color-white)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                  form="sort-form"
                >
                  <option value="MANUAL">Featured</option>
                  <option value="BEST_SELLING">Best Selling</option>
                  <option value="PRICE">Price: Low → High</option>
                  <option value="CREATED_AT">Newest</option>
                </select>
                <button type="submit" form="sort-form" style={{ display: 'none' }} />
              </form>
            </div>

            {products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                <p style={{ fontSize: '1.125rem', marginBottom: '8px' }}>No products found</p>
                <p style={{ color: 'var(--color-grey-dark)', fontSize: '0.875rem' }}>
                  Try adjusting your filters or browse all products.
                </p>
              </div>
            ) : (
              <div className="product-grid">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {collection.products.pageInfo.hasNextPage && (
              <div className="pagination">
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
    </>
  );
}
