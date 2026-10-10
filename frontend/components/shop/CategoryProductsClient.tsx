'use client';

import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
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
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
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

  // Derived filter options for this category
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
    <div style={{ background: '#ffffff', color: '#000000', minHeight: '100vh', width: '100%' }}>
      {/* ── Scoped Fallback Styles ── */}
      <style>{`
        .shop-container-pad {
          padding-left: clamp(16px, 4.5vw, 64px);
          padding-right: clamp(16px, 4.5vw, 64px);
          max-width: 1680px;
          margin-left: auto;
          margin-right: auto;
          width: 100%;
          box-sizing: border-box;
        }
        .shop-title-section {
          padding-top: 36px;
        }
        .shop-sort-section {
          padding-top: 20px;
        }
        .shop-main-section {
          padding-top: 28px;
          padding-bottom: 80px;
        }
        .shop-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 36px 20px;
          width: 100%;
          box-sizing: border-box;
        }
        .chevron-anim-right {
          opacity: 0;
          max-width: 0;
          transform: translateX(-10px);
          transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), margin 0.25s ease;
          margin-left: 0;
          display: inline-block;
          vertical-align: middle;
          pointer-events: none;
          flex-shrink: 0;
        }
        *:hover > .chevron-anim-right,
        button:hover .chevron-anim-right,
        a:hover .chevron-anim-right {
          opacity: 1;
          max-width: 20px;
          transform: translateX(0);
          margin-left: 6px;
        }
        @media (hover: none) {
          .chevron-anim-right {
            opacity: 1;
            max-width: 20px;
            transform: translateX(0);
            margin-left: 6px;
          }
        }
        .chevron-anim-left {
          opacity: 0;
          max-width: 0;
          transform: translateX(10px);
          transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), margin 0.25s ease;
          margin-right: 0;
          display: inline-block;
          vertical-align: middle;
          pointer-events: none;
          flex-shrink: 0;
        }
        *:hover > .chevron-anim-left,
        button:hover .chevron-anim-left,
        a:hover .chevron-anim-left {
          opacity: 1;
          max-width: 20px;
          transform: translateX(0);
          margin-right: 6px;
        }
        @media (hover: none) {
          .chevron-anim-left {
            opacity: 1;
            max-width: 20px;
            transform: translateX(0);
            margin-right: 6px;
          }
        }
        .category-nav-scroll {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow-x: auto;
          white-space: nowrap;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding-bottom: 4px;
        }
        .category-nav-scroll::-webkit-scrollbar {
          display: none;
        }
        @media (max-width: 1200px) {
          .shop-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 28px 16px;
          }
        }
        @media (max-width: 860px) {
          .shop-title-section {
            padding-top: 24px;
          }
          .shop-sort-section {
            padding-top: 14px;
          }
          .shop-main-section {
            padding-top: 20px;
            padding-bottom: 60px;
          }
          .shop-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 20px 12px;
          }
        }
        @media (max-width: 640px) {
          .shop-container-pad {
            padding-left: 14px;
            padding-right: 14px;
          }
          .shop-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px 10px;
          }
        }
      `}</style>

      {/* ── Breadcrumb Bar with animated Chevrons ── */}
      <nav
        aria-label="Breadcrumb"
        className="shop-container-pad"
        style={{
          paddingTop: '20px',
          paddingBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#777777',
          flexWrap: 'wrap',
        }}
      >
        <Link
          href="/"
          style={{
            color: '#777777',
            textDecoration: 'none',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#111111';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#777777';
          }}
        >
          HOME
        </Link>
        <ChevronRight size={12} style={{ opacity: 0.45, flexShrink: 0 }} />
        <Link
          href="/products"
          style={{
            color: '#777777',
            textDecoration: 'none',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#111111';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#777777';
          }}
        >
          ALL PRODUCTS
        </Link>
        <ChevronRight size={12} style={{ opacity: 0.45, flexShrink: 0 }} />
        <span style={{ color: '#111111', fontWeight: 800 }}>{categoryTitle}</span>
      </nav>

      {/* ── Page Header ── */}
      <header className="shop-container-pad shop-title-section">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: '20px',
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
                maxWidth: '680px',
              }}
            >
              {categorySubtitle}
            </p>
          </div>

          {/* Luxury Category Pills with Horizontal Mobile Scroll & Animated Chevrons */}
          <div className="category-nav-scroll">
            <Link
              href="/products"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                padding: '8px 14px',
                border: '1px solid #d4d4d8',
                textDecoration: 'none',
                color: '#27272a',
                background: '#fafafa',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#18181b';
                e.currentTarget.style.background = '#f4f4f5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#d4d4d8';
                e.currentTarget.style.background = '#fafafa';
              }}
            >
              <ChevronLeft size={14} strokeWidth={2.5} className="chevron-anim-left" />
              <span>ALL PRODUCTS</span>
            </Link>

            {(['TOPS', 'BOTTOMS', 'ACCESSORIES'] as const).map((cat) => {
              const isActive = cat === category;
              return (
                <Link
                  key={cat}
                  href={`/products/${cat.toLowerCase()}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '8px 14px',
                    border: isActive ? '1px solid #09090b' : '1px solid #d4d4d8',
                    background: isActive ? '#09090b' : '#ffffff',
                    color: isActive ? '#ffffff' : '#27272a',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = '#18181b';
                      e.currentTarget.style.background = '#f4f4f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = '#d4d4d8';
                      e.currentTarget.style.background = '#ffffff';
                    }
                  }}
                >
                  <span>{cat}</span>
                  {!isActive && (
                    <ChevronRight size={14} strokeWidth={2.5} className="chevron-anim-right" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Filter & Sort Bar ── */}
      <section
        className="shop-container-pad shop-sort-section"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          borderBottom: '1px solid #ebebeb',
          paddingBottom: '16px',
        }}
      >
        {/* Dynamic Category Filters (Fit / Activity) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {category !== 'ACCESSORIES' && fits.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#71717a',
                }}
              >
                FIT:
              </span>
              <select
                value={selectedFit}
                onChange={(e) => setSelectedFit(e.target.value)}
                style={{
                  padding: '7px 12px',
                  border: '1px solid #d4d4d8',
                  background: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  cursor: 'pointer',
                  borderRadius: 0,
                  outline: 'none',
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
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#71717a',
                }}
              >
                ACTIVITY:
              </span>
              <select
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                style={{
                  padding: '7px 12px',
                  border: '1px solid #d4d4d8',
                  background: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  cursor: 'pointer',
                  borderRadius: 0,
                  outline: 'none',
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
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#dc2626',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
                padding: '4px 0',
              }}
            >
              Clear Filters ✕
            </button>
          )}

          <span
            style={{
              fontSize: '0.75rem',
              color: '#71717a',
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            ({filteredItems.length} {filteredItems.length === 1 ? 'ITEM' : 'ITEMS'})
          </span>
        </div>

        {/* Sort Dropdown with animated ChevronDown */}
        <div ref={sortRef} style={{ position: 'relative', display: 'inline-block' }}>
          <button
            type="button"
            onClick={() => setSortOpen((p) => !p)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 14px',
              border: '1px solid #d4d4d8',
              background: '#ffffff',
              cursor: 'pointer',
              fontFamily: 'var(--font-heading)',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: '#09090b',
              minWidth: '180px',
              justifyContent: 'space-between',
              borderRadius: 0,
              transition: 'border-color 0.15s ease',
            }}
          >
            <span>{selectedSortLabel}</span>
            <ChevronDown
              size={14}
              style={{
                transform: sortOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                flexShrink: 0,
              }}
            />
          </button>
          {sortOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                zIndex: 50,
                background: '#ffffff',
                border: '1px solid #d4d4d8',
                borderTop: 'none',
                minWidth: '220px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
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
                    background: sortBy === opt.value ? '#f4f4f5' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.75rem',
                    fontWeight: sortBy === opt.value ? 800 : 500,
                    color: sortBy === opt.value ? BRAND_COLOR : '#18181b',
                    textAlign: 'left',
                    letterSpacing: '0.02em',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Product Grid or Clean Empty State (NO NEXT DROP / NO DROP COMING SOON) ── */}
      <main className="shop-container-pad shop-main-section">
        {filteredItems.length === 0 ? (
          <div
            style={{
              padding: '72px 24px',
              textAlign: 'center',
              border: '1px solid #e4e4e7',
              background: '#fafafa',
              maxWidth: '560px',
              margin: '24px auto',
            }}
          >
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 900,
                margin: '0 0 10px',
                fontFamily: 'var(--font-heading)',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                color: '#09090b',
              }}
            >
              {hasActiveFilters
                ? 'NO MATCHING PRODUCTS FOUND'
                : `${categoryTitle} — DROP COMING SOON`}
            </h2>
            <p
              style={{
                fontSize: '0.875rem',
                color: '#71717a',
                margin: '0 auto 24px',
                maxWidth: '440px',
                lineHeight: 1.6,
                fontFamily: 'var(--font-body)',
              }}
            >
              {hasActiveFilters
                ? 'Try adjusting or clearing your active filters to view all pieces in this collection.'
                : 'We engineer pieces drop by drop. Stay notified for release dates and priority access.'}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedFit('ALL');
                  setSelectedActivity('ALL');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 26px',
                  backgroundColor: '#09090b',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                CLEAR ALL FILTERS
              </button>
            ) : (
              <Link
                href="/products"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 26px',
                  backgroundColor: BRAND_COLOR,
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <span>EXPLORE ALL PRODUCTS</span>
                <ChevronRight size={15} strokeWidth={2.5} className="chevron-anim-right" />
              </Link>
            )}
          </div>
        ) : (
          <div className="shop-grid">
            {filteredItems.map((item) => (
              <ShopCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      {/* ── FAQ Section with animated Chevrons ── */}
      <section
        className="shop-container-pad"
        style={{ paddingBottom: 'clamp(48px, 8vw, 80px)', background: '#ffffff' }}
      >
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
              fontWeight: 900,
              textTransform: 'uppercase',
              textAlign: 'center',
              letterSpacing: '0.02em',
              margin: '0 0 36px',
              lineHeight: 1.25,
            }}
          >
            FREQUENTLY ASKED
            <br />
            QUESTIONS
          </h2>
          <div style={{ borderTop: '1px solid #e5e5e5' }}>
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={item.q} style={{ borderBottom: '1px solid #e5e5e5' }}>
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
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
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                      color: '#000000',
                      gap: '16px',
                    }}
                  >
                    <span>{item.q}</span>
                    <span
                      style={{
                        fontSize: '1.75rem',
                        fontWeight: 400,
                        color: BRAND_COLOR,
                        lineHeight: 1,
                        flexShrink: 0,
                        userSelect: 'none',
                      }}
                    >
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen && (
                    <div
                      style={{
                        paddingBottom: '20px',
                        fontSize: '0.875rem',
                        lineHeight: 1.7,
                        color: '#444444',
                        fontFamily: 'var(--font-body)',
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {item.a}
                      {item.link && (
                        <Link
                          href={item.link.href}
                          style={{
                            color: BRAND_COLOR,
                            textDecoration: 'underline',
                            marginLeft: '4px',
                          }}
                        >
                          {item.link.label}
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Trust Badges ── */}
      <TrustBadgesBar className="shop-container-pad" />
    </div>
  );
}
