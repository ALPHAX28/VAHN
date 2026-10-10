'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import TrustBadgesBar from '@/components/ui/TrustBadgesBar';
import type { Product } from '@/lib/api/types';
import {
  BRAND_COLOR,
  FAQ_ITEMS,
  getExpandedItems,
  ShopCard,
  SORT_OPTIONS,
} from './ShopProductsClient';

interface Props {
  initialProducts: Product[];
  category: 'TOPS' | 'BOTTOMS' | 'ACCESSORIES';
  categoryTitle: string;
  categorySubtitle: string;
}

export default function CategoryProductsClient({
  initialProducts,
  category,
  categoryTitle,
  categorySubtitle,
}: Props) {
  const [sortBy, setSortBy] = useState('featured');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedFit, setSelectedFit] = useState('ALL');
  const [selectedActivity, setSelectedActivity] = useState('ALL');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const allItems = useMemo(() => {
    const expanded = getExpandedItems(initialProducts);
    return expanded.filter((item) => {
      const itemCat = (item.category || 'TOPS').toUpperCase();
      return itemCat === category;
    });
  }, [initialProducts, category]);

  // Derived filter options for this specific category
  const fits = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((i) => {
      if (i.fit) set.add(i.fit.toUpperCase());
    });
    return Array.from(set).sort();
  }, [allItems]);

  const activities = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((i) => {
      if (i.activity) set.add(i.activity.toUpperCase());
    });
    return Array.from(set).sort();
  }, [allItems]);

  // Apply filters + sort
  const filteredItems = useMemo(() => {
    let result = [...allItems];
    if (selectedFit !== 'ALL') {
      result = result.filter((i) => i.fit.toUpperCase() === selectedFit.toUpperCase());
    }
    if (selectedActivity !== 'ALL') {
      result = result.filter((i) => i.activity.toUpperCase() === selectedActivity.toUpperCase());
    }

    if (sortBy === 'price-asc') {
      result.sort(
        (a, b) => parseInt(a.price.replace(/,/g, ''), 10) - parseInt(b.price.replace(/,/g, ''), 10)
      );
    } else if (sortBy === 'price-desc') {
      result.sort(
        (a, b) => parseInt(b.price.replace(/,/g, ''), 10) - parseInt(a.price.replace(/,/g, ''), 10)
      );
    } else if (sortBy === 'name-asc') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'name-desc') {
      result.sort((a, b) => b.title.localeCompare(a.title));
    }
    return result;
  }, [allItems, selectedFit, selectedActivity, sortBy]);

  const selectedSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'FEATURED';
  const hasActiveFilters = selectedFit !== 'ALL' || selectedActivity !== 'ALL';

  return (
    <div style={{ background: '#ffffff', color: '#000000', minHeight: '100vh' }}>
      {/* ── Breadcrumb Bar ── */}
      <div
        className="shop-container-pad"
        style={{
          paddingTop: '24px',
          paddingBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: '#777777',
        }}
      >
        <Link href="/" style={{ color: '#777777', textDecoration: 'none' }}>
          HOME
        </Link>
        <span>/</span>
        <Link href="/products" style={{ color: '#777777', textDecoration: 'none' }}>
          ALL PRODUCTS
        </Link>
        <span>/</span>
        <span style={{ color: '#111111', fontWeight: 700 }}>{categoryTitle}</span>
      </div>

      {/* ── Page Header ── */}
      <div className="shop-container-pad shop-title-section">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
                fontWeight: 900,
                letterSpacing: '-0.02em',
                textTransform: 'uppercase',
                color: '#000000',
                margin: '0 0 6px',
                lineHeight: 1.1,
              }}
            >
              {categoryTitle}
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.9375rem',
                color: '#555555',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {categorySubtitle}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Link
              href="/products"
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '8px 14px',
                border: '1px solid #e0e0e0',
                textDecoration: 'none',
                color: '#333333',
                background: '#fafafa',
              }}
            >
              ← ALL PRODUCTS
            </Link>
            {(['TOPS', 'BOTTOMS', 'ACCESSORIES'] as const).map((cat) => (
              <Link
                key={cat}
                href={`/products/${cat.toLowerCase()}`}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '8px 14px',
                  border: cat === category ? '1px solid #111111' : '1px solid #e0e0e0',
                  background: cat === category ? '#111111' : '#ffffff',
                  color: cat === category ? '#ffffff' : '#333333',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filter & Sort Bar ── */}
      <div
        className="shop-container-pad shop-sort-section"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Dynamic Category Filters (Fit / Activity) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {category !== 'ACCESSORIES' && fits.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#777777',
                }}
              >
                FIT:
              </span>
              <select
                value={selectedFit}
                onChange={(e) => setSelectedFit(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #c0c0c0',
                  background: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  borderRadius: 0,
                }}
              >
                <option value="ALL">ALL FITS</option>
                {fits.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activities.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#777777',
                }}
              >
                ACTIVITY:
              </span>
              <select
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #c0c0c0',
                  background: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  borderRadius: 0,
                }}
              >
                <option value="ALL">ALL ACTIVITIES</option>
                {activities.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSelectedFit('ALL');
                setSelectedActivity('ALL');
              }}
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: '#d32f2f',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Clear Filters ✕
            </button>
          )}

          <span style={{ fontSize: '0.75rem', color: '#888888', fontWeight: 600 }}>
            ({filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'})
          </span>
        </div>

        {/* Sort Dropdown */}
        <div ref={sortRef} style={{ position: 'relative', display: 'inline-block' }}>
          <button
            type="button"
            onClick={() => setSortOpen((p) => !p)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              border: '1px solid #c0c0c0',
              background: '#ffffff',
              cursor: 'pointer',
              fontFamily: 'var(--font-heading)',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.03em',
              color: '#000000',
              minWidth: '180px',
              justifyContent: 'space-between',
              borderRadius: 0,
            }}
          >
            <span>{selectedSortLabel}</span>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <title>Chevron</title>
              <path
                d="M1 1L5 5L9 1"
                stroke="#000000"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {sortOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                zIndex: 50,
                background: '#ffffff',
                border: '1px solid #c0c0c0',
                borderTop: 'none',
                minWidth: '210px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setSortBy(opt.value);
                    setSortOpen(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 14px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.75rem',
                    fontWeight: sortBy === opt.value ? 700 : 400,
                    color: sortBy === opt.value ? BRAND_COLOR : '#222222',
                    textAlign: 'left',
                    letterSpacing: '0.02em',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Product Grid or Drop Coming Soon State ── */}
      <main className="shop-container-pad shop-main-section">
        {filteredItems.length === 0 ? (
          <div
            style={{
              padding: '96px 24px',
              textAlign: 'center',
              border: '1px solid #e0e0e0',
              background: '#fafafa',
              borderRadius: 0,
            }}
          >
            <div
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                backgroundColor: '#111111',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '16px',
              }}
            >
              NEXT DROP
            </div>
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 900,
                margin: '0 0 10px',
                fontFamily: 'var(--font-heading)',
                textTransform: 'uppercase',
                letterSpacing: '-0.02em',
              }}
            >
              {categoryTitle} — DROP COMING SOON
            </h2>
            <p
              style={{
                fontSize: '0.9rem',
                color: '#666666',
                margin: '0 auto 24px',
                maxWidth: '480px',
                lineHeight: 1.5,
              }}
            >
              We engineer pieces drop by drop. Stay notified for release dates and priority access.
            </p>
            <Link
              href="/products"
              style={{
                display: 'inline-block',
                padding: '12px 28px',
                backgroundColor: BRAND_COLOR,
                color: '#ffffff',
                fontSize: '0.8125rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              EXPLORE AVAILABLE DROPS
            </Link>
          </div>
        ) : (
          <div className="shop-grid">
            {filteredItems.map((item) => (
              <ShopCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      {/* ── FAQ Section ── */}
      <section
        className="shop-container-pad"
        style={{ paddingBottom: 'clamp(48px, 8vw, 80px)', background: '#ffffff' }}
      >
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
              fontWeight: 900,
              textTransform: 'uppercase',
              textAlign: 'center',
              letterSpacing: '0.02em',
              margin: '0 0 40px',
              lineHeight: 1.25,
            }}
          >
            FREQUENTLY ASKED
            <br />
            QUESTIONS
          </h2>
          <div style={{ borderTop: '1px solid #e5e5e5' }}>
            {FAQ_ITEMS.map((item, idx) => (
              <div key={idx} style={{ borderBottom: '1px solid #e5e5e5' }}>
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                  style={{
                    width: '100%',
                    padding: '20px 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                    color: '#000000',
                  }}
                >
                  <span>{item.q}</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 300, color: BRAND_COLOR }}>
                    {openFaqIndex === idx ? '−' : '+'}
                  </span>
                </button>
                {openFaqIndex === idx && (
                  <div
                    style={{
                      paddingBottom: '20px',
                      fontSize: '0.875rem',
                      lineHeight: 1.6,
                      color: '#444444',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {item.a}
                    {item.link && (
                      <Link
                        href={item.link.href}
                        style={{ color: BRAND_COLOR, textDecoration: 'underline' }}
                      >
                        {item.link.label}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Badges ── */}
      <TrustBadgesBar className="shop-container-pad" />
    </div>
  );
}
