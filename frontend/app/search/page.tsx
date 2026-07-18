import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchAPI } from '@/lib/api/client';
import ProductCard from '@/components/collection/ProductCard';
import type { Product } from '@/lib/api/types';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search VAHN products and collections.',
};

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  let products: Product[] = [];
  let totalCount = 0;

  if (query) {
    try {
      const allProducts = await fetchAPI<Product[]>('/products');
      products = allProducts.filter((p) =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.description.toLowerCase().includes(query.toLowerCase())
      );
      totalCount = products.length;
    } catch {
      // ignore search errors
    }
  }

  return (
    <div style={{ maxWidth: 'var(--page-width)', margin: '0 auto', padding: 'var(--space-2xl) var(--space-xl)' }}>
      {/* Search bar */}
      <div style={{ maxWidth: '640px', margin: '0 auto 48px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '32px', fontSize: 'clamp(2rem, 5vw, 4rem)' }}>
          {query ? `Results for "${query}"` : 'Search'}
        </h1>
        <form
          action="/search"
          method="GET"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            borderBottom: '2px solid var(--color-black)',
            paddingBottom: '8px',
          }}
        >
          <input
            name="q"
            defaultValue={query}
            placeholder="Type to search..."
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '1.25rem',
              fontFamily: 'var(--font-ui)',
            }}
          />
          <button type="submit" style={{ fontSize: '1.25rem' }}>🔍</button>
        </form>
      </div>

      {query && (
        <div>
          {products.length > 0 ? (
            <div>
              <p style={{ color: 'var(--color-grey-dark)', marginBottom: '24px', fontSize: '0.875rem' }}>
                Found {totalCount} {totalCount === 1 ? 'item' : 'items'} matching your query.
              </p>
              <div className="product-grid">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <p style={{ fontSize: '1.25rem', fontFamily: 'var(--font-body)', fontStyle: 'italic', marginBottom: '16px' }}>
                No products found matching your search.
              </p>
              <Link href="/collections/vahn-beginning" className="btn btn-navy">
                Explore The Collection
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
