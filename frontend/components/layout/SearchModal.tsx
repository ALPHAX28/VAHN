'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { predictiveSearch } from '@/lib/api';
import { formatMoney } from '@/lib/utils';

interface SearchResult {
  products: { id: string; title: string; handle: string; featuredImage: { url: string; altText: string | null } | null; priceRange: { minVariantPrice: { amount: string; currencyCode: string } } }[];
  collections: { id: string; title: string; handle: string }[];
  pages: { id: string; title: string; handle: string }[];
}

interface Props { onClose: () => void; }

export default function SearchModal({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setResults(null);
        return;
      }
      setLoading(true);
      try {
        const res = await predictiveSearch(query);
        setResults(res);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, query.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      onClose();
    }
  };

  const totalResults =
    (results?.products.length ?? 0) +
    (results?.collections.length ?? 0) +
    (results?.pages.length ?? 0);

  return (
    <div className="search-modal" role="dialog" aria-label="Search">
      <div className="search-modal-overlay" onClick={onClose} />
      <div className="search-modal-panel">
        <form onSubmit={handleSubmit} className="search-modal-input-row">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <line x1="13" y1="13" x2="18" y2="18" />
          </svg>
          <input
            ref={inputRef}
            className="search-modal-input"
            placeholder="Search products, collections…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="2" y1="2" x2="16" y2="16" /><line x1="16" y1="2" x2="2" y2="16" />
              </svg>
            </button>
          )}
        </form>

        {loading && (
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
            <div className="loading-spinner" />
          </div>
        )}

        {results && totalResults === 0 && query && (
          <div style={{ padding: '24px 0', color: 'var(--color-grey-dark)', textAlign: 'center' }}>
            No results for &ldquo;{query}&rdquo;
          </div>
        )}

        {results && totalResults > 0 && (
          <div className="search-modal-results">
            {results.products.length > 0 && (
              <>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-grey-dark)', marginBottom: '8px' }}>Products</p>
                {results.products.map((p) => (
                  <Link
                    key={p.id}
                    href={`/products/${p.handle}`}
                    className="search-result-item"
                    onClick={onClose}
                  >
                    {p.featuredImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="search-result-img" src={p.featuredImage.url} alt={p.featuredImage.altText ?? p.title} />
                    )}
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{p.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-grey-dark)' }}>
                        {formatMoney(p.priceRange.minVariantPrice)}
                      </div>
                    </div>
                  </Link>
                ))}
              </>
            )}

            {results.collections.length > 0 && (
              <>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-grey-dark)', margin: '16px 0 8px' }}>Collections</p>
                {results.collections.map((c) => (
                  <Link key={c.id} href={`/collections/${c.handle}`} className="search-result-item" onClick={onClose}>
                    <div style={{ fontWeight: 500 }}>{c.title}</div>
                  </Link>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
