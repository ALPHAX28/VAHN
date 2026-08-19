'use client';

import { useState, useMemo } from 'react';
import type { Product, ColourGroup } from '@/lib/api/types';
import ProductCard from '@/components/collection/ProductCard';

interface Props {
  initialProducts: Product[];
}

interface ExpandedCardItem {
  id: string;
  product: Product;
  colourGroup?: ColourGroup;
  colourName?: string;
  price: number;
  productType: string;
  fit: string;
  activity: string;
  kitType: string;
}

export default function ShopProductsClient({ initialProducts }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedFit, setSelectedFit] = useState<string>('ALL');
  const [selectedActivity, setSelectedActivity] = useState<string>('ALL');
  const [selectedKitType, setSelectedKitType] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('featured');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ── 1. Expand products by colour groups into individual cards ──
  const expandedItems: ExpandedCardItem[] = useMemo(() => {
    const items: ExpandedCardItem[] = [];

    initialProducts.forEach((product) => {
      const allVariants = (product.variants?.edges ?? []).map((e) => e.node);

      if (product.colourGroups && product.colourGroups.length > 0) {
        // Multi-colour expansion: Each colour group gets its own distinct card
        product.colourGroups.forEach((cg) => {
          const colourVariants = allVariants.filter((v) =>
            v.selectedOptions.some(
              (opt) =>
                (opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color') &&
                opt.value.trim().toLowerCase() === cg.colourValue.trim().toLowerCase()
            )
          );

          let priceNum = parseFloat(product.priceRange?.minVariantPrice?.amount || '0');
          if (colourVariants.length > 0) {
            const minVarPrice = Math.min(...colourVariants.map((v) => parseFloat(v.price.amount)));
            if (!isNaN(minVarPrice)) priceNum = minVarPrice;
          }

          items.push({
            id: `${product.id}-${cg.colourValue.toLowerCase().replace(/\s+/g, '-')}`,
            product,
            colourGroup: cg as ColourGroup,
            colourName: cg.colourValue,
            price: priceNum,
            productType: (product.productType || '').trim(),
            fit: (product.fit || '').trim(),
            activity: (product.activity || '').trim(),
            kitType: (product.kitType || '').trim(),
          });
        });
      } else {
        // Single card for products without colour groups
        const priceNum = parseFloat(product.priceRange?.minVariantPrice?.amount || '0');
        items.push({
          id: product.id,
          product,
          price: priceNum,
          productType: (product.productType || '').trim(),
          fit: (product.fit || '').trim(),
          activity: (product.activity || '').trim(),
          kitType: (product.kitType || '').trim(),
        });
      }
    });

    return items;
  }, [initialProducts]);

  // ── 2. Derive unique filter options from actual products ──
  const categories = useMemo(() => {
    const set = new Set<string>();
    initialProducts.forEach((p) => {
      if (p.productType?.trim()) set.add(p.productType.trim());
    });
    return Array.from(set).sort();
  }, [initialProducts]);

  const fits = useMemo(() => {
    const set = new Set<string>();
    initialProducts.forEach((p) => {
      if (p.fit?.trim()) set.add(p.fit.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [initialProducts]);

  const activities = useMemo(() => {
    const set = new Set<string>();
    initialProducts.forEach((p) => {
      if (p.activity?.trim()) set.add(p.activity.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [initialProducts]);

  // ── 3. Apply Filters and Sorting ──
  const filteredItems = useMemo(() => {
    let result = expandedItems.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = item.product.title.toLowerCase().includes(query);
        const matchesColour = (item.colourName || '').toLowerCase().includes(query);
        const matchesType = item.productType.toLowerCase().includes(query);
        const matchesTags = (item.product.tags || []).some((t) => t.toLowerCase().includes(query));
        if (!matchesTitle && !matchesColour && !matchesType && !matchesTags) {
          return false;
        }
      }

      // Category
      if (selectedCategory !== 'ALL') {
        if (item.productType.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
      }

      // Fit
      if (selectedFit !== 'ALL') {
        if (item.fit.toUpperCase() !== selectedFit.toUpperCase()) {
          return false;
        }
      }

      // Activity
      if (selectedActivity !== 'ALL') {
        if (item.activity.toUpperCase() !== selectedActivity.toUpperCase()) {
          return false;
        }
      }

      // Kit Type
      if (selectedKitType !== 'ALL') {
        if (item.kitType.toUpperCase() !== selectedKitType.toUpperCase()) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'name-asc') {
      result.sort((a, b) => a.product.title.localeCompare(b.product.title));
    }

    return result;
  }, [expandedItems, searchQuery, selectedCategory, selectedFit, selectedActivity, selectedKitType, sortBy]);

  const hasActiveFilters =
    selectedCategory !== 'ALL' ||
    selectedFit !== 'ALL' ||
    selectedActivity !== 'ALL' ||
    selectedKitType !== 'ALL' ||
    Boolean(searchQuery.trim());

  function resetFilters() {
    setSelectedCategory('ALL');
    setSelectedFit('ALL');
    setSelectedActivity('ALL');
    setSelectedKitType('ALL');
    setSearchQuery('');
    setSortBy('featured');
  }

  return (
    <div className="shop-catalog-container" style={{ minHeight: '80vh', paddingBottom: 'var(--space-3xl)' }}>
      {/* ── 1. Hero Header ── */}
      <div
        style={{
          background: 'linear-gradient(180deg, #09090b 0%, #121216 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: 'clamp(48px, 6vw, 72px) 24px 36px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <p
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--color-gold, #c5a059)',
              marginBottom: '8px',
            }}
          >
            VAHN STOREFRONT
          </p>
          <h1
            style={{
              fontSize: 'clamp(2rem, 4.5vw, 3.25rem)',
              fontWeight: 900,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              margin: '0 0 12px',
              color: '#ffffff',
            }}
          >
            ALL SILHOUETTES
          </h1>
          <p
            style={{
              fontSize: 'clamp(0.875rem, 1.5vw, 1.0625rem)',
              color: '#a1a1aa',
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Bespoke teamwear & lifestyle silhouettes engineered for peak performance and modern aesthetics.
          </p>
        </div>
      </div>

      {/* ── 2. Filters & Search Bar ── */}
      <div
        style={{
          maxWidth: 'var(--page-width, 1400px)',
          margin: '0 auto',
          padding: '24px 20px',
        }}
      >
        {/* Top Control Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '360px' }}>
            <input
              type="text"
              placeholder="Search products or colours..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 36px',
                background: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
            <svg
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 16,
                height: 16,
                fill: 'none',
                stroke: '#71717a',
                strokeWidth: 2,
              }}
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#a1a1aa',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort & Count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '0.875rem', color: '#71717a' }}>
              <strong style={{ color: '#fff' }}>{filteredItems.length}</strong> {filteredItems.length === 1 ? 'item' : 'items'}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="shop-sort" style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>
                Sort:
              </label>
              <select
                id="shop-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '8px 12px',
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="featured">Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name-asc">Alphabetical</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '24px' }}>
          <button
            onClick={() => setSelectedCategory('ALL')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              border: selectedCategory === 'ALL' ? '1px solid #fff' : '1px solid #27272a',
              background: selectedCategory === 'ALL' ? '#ffffff' : '#18181b',
              color: selectedCategory === 'ALL' ? '#000000' : '#a1a1aa',
              transition: 'all 0.2s',
            }}
          >
            All Products
          </button>

          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? 'ALL' : cat)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                border: selectedCategory === cat ? '1px solid #fff' : '1px solid #27272a',
                background: selectedCategory === cat ? '#ffffff' : '#18181b',
                color: selectedCategory === cat ? '#000000' : '#a1a1aa',
                transition: 'all 0.2s',
              }}
            >
              {cat}
            </button>
          ))}

          {/* Fits Filters */}
          {fits.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto', flexWrap: 'wrap' }}>
              {fits.map((fit) => (
                <button
                  key={fit}
                  onClick={() => setSelectedFit(selectedFit === fit ? 'ALL' : fit)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    border: selectedFit === fit ? '1px solid var(--color-gold, #c5a059)' : '1px solid #27272a',
                    background: selectedFit === fit ? 'rgba(197, 160, 89, 0.15)' : 'transparent',
                    color: selectedFit === fit ? 'var(--color-gold, #c5a059)' : '#71717a',
                    transition: 'all 0.2s',
                  }}
                >
                  {fit}
                </button>
              ))}
            </div>
          )}

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              style={{
                padding: '4px 10px',
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* ── 3. Product Cards Grid ── */}
        {filteredItems.length === 0 ? (
          <div
            style={{
              padding: '80px 20px',
              textAlign: 'center',
              background: '#121216',
              border: '1px solid #27272a',
              borderRadius: '8px',
              marginTop: '20px',
            }}
          >
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
              No products found
            </p>
            <p style={{ fontSize: '0.875rem', color: '#71717a', marginBottom: '20px' }}>
              Try adjusting your search query or removing active filters.
            </p>
            <button
              onClick={resetFilters}
              className="btn btn-primary"
              style={{ padding: '10px 24px', fontSize: '0.875rem' }}
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div
            className="product-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '24px 16px',
            }}
          >
            {filteredItems.map((item) => (
              <ProductCard
                key={item.id}
                product={item.product}
                colourGroup={item.colourGroup}
                customColour={item.colourName}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
