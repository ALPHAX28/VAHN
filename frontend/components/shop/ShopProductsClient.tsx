'use client';

import { useState, useMemo } from 'react';
import type { Product, ColourGroup, Image as ShopifyImage, Money } from '@/lib/api/types';
import ProductCard from '@/components/collection/ProductCard';

interface Props {
  initialProducts: Product[];
}

interface ExpandedCardItem {
  id: string;
  product: Product;
  colourGroup?: ColourGroup;
  colourName?: string;
  primaryImage: ShopifyImage | null;
  secondaryImage: ShopifyImage | null;
  price: number;
  compareAtPrice: Money | null;
  discountPercent: number;
  isOutOfStock: boolean;
  productType: string;
  fit: string;
  activity: string;
  kitType: string;
  targetHref: string;
}

export default function ShopProductsClient({ initialProducts }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedFit, setSelectedFit] = useState<string>('ALL');
  const [selectedActivity, setSelectedActivity] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('featured');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ── 1. Expand products into distinct colourway cards ──
  const expandedItems: ExpandedCardItem[] = useMemo(() => {
    const items: ExpandedCardItem[] = [];

    initialProducts.forEach((product) => {
      const allVariants = (product.variants?.edges ?? []).map((e) => e.node);

      // Method A: Explicit colour groups configured on product
      if (product.colourGroups && product.colourGroups.length > 0) {
        product.colourGroups.forEach((cg) => {
          const colourName = cg.colourValue.trim();
          const colourVariants = allVariants.filter((v) =>
            v.selectedOptions.some(
              (opt) =>
                (opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color') &&
                opt.value.trim().toLowerCase() === colourName.toLowerCase()
            )
          );

          // Find primary image for this colour
          let primaryImg: ShopifyImage | null = null;
          if (cg.images && cg.images.length > 0 && cg.images[0].url) {
            primaryImg = {
              url: cg.images[0].url,
              altText: cg.images[0].altText || `${product.title} - ${colourName}`,
              width: 800,
              height: 800,
            };
          } else {
            // Fallback to variant image
            const variantWithImage = colourVariants.find((v) => v.image && v.image.url);
            if (variantWithImage && variantWithImage.image) {
              primaryImg = variantWithImage.image;
            } else {
              primaryImg = product.featuredImage ?? product.images?.edges?.[0]?.node ?? null;
            }
          }

          // Find secondary image for hover
          let secondaryImg: ShopifyImage | null = null;
          if (cg.images && cg.images.length > 1 && cg.images[1].url) {
            secondaryImg = {
              url: cg.images[1].url,
              altText: cg.images[1].altText || `${product.title} - ${colourName}`,
              width: 800,
              height: 800,
            };
          }

          // Pricing and stock calculation for this colour
          let priceNum = parseFloat(product.priceRange?.minVariantPrice?.amount || '0');
          let bestComparePrice: Money | null = null;
          let maxDiscountPct = 0;
          let isOutOfStock = false;

          const pool = colourVariants.length > 0 ? colourVariants : allVariants;
          if (pool.length > 0) {
            let lowestVar = pool[0];
            for (const v of pool) {
              const p = parseFloat(v.price?.amount || '0');
              if (lowestVar && p < parseFloat(lowestVar.price?.amount || '0')) {
                lowestVar = v;
              }
              const c = v.compareAtPrice ? parseFloat(v.compareAtPrice.amount) : null;
              if (c && c > p) {
                const pct = Math.round(((c - p) / c) * 100);
                if (pct > maxDiscountPct) {
                  maxDiscountPct = pct;
                  bestComparePrice = v.compareAtPrice;
                }
              }
            }
            priceNum = parseFloat(lowestVar?.price?.amount || '0');
            isOutOfStock = pool.every(
              (v) => !v.availableForSale || (v.quantityAvailable !== undefined && v.quantityAvailable <= 0)
            );
          }

          items.push({
            id: `${product.id}-${colourName.toLowerCase().replace(/\s+/g, '-')}`,
            product,
            colourGroup: cg as ColourGroup,
            colourName,
            primaryImage: primaryImg,
            secondaryImage: secondaryImg,
            price: priceNum,
            compareAtPrice: bestComparePrice,
            discountPercent: maxDiscountPct,
            isOutOfStock,
            productType: (product.productType || '').trim(),
            fit: (product.fit || '').trim(),
            activity: (product.activity || '').trim(),
            kitType: (product.kitType || '').trim(),
            targetHref: `/products/${product.handle}?colour=${encodeURIComponent(colourName)}`,
          });
        });
      } else {
        // Method B: Extract unique colours from variants
        const variantColourSet = new Set<string>();
        allVariants.forEach((v) => {
          v.selectedOptions.forEach((opt) => {
            if ((opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color') && opt.value.trim()) {
              variantColourSet.add(opt.value.trim());
            }
          });
        });

        const uniqueColours = Array.from(variantColourSet);

        if (uniqueColours.length > 1) {
          // Multiple variant colours found -> split into separate cards!
          uniqueColours.forEach((col) => {
            const colourVariants = allVariants.filter((v) =>
              v.selectedOptions.some(
                (opt) =>
                  (opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color') &&
                  opt.value.trim().toLowerCase() === col.toLowerCase()
              )
            );

            // Find variant image for this colour
            const variantWithImg = colourVariants.find((v) => v.image && v.image.url);
            const primaryImg =
              variantWithImg?.image ?? product.featuredImage ?? product.images?.edges?.[0]?.node ?? null;

            let priceNum = parseFloat(product.priceRange?.minVariantPrice?.amount || '0');
            let bestComparePrice: Money | null = null;
            let maxDiscountPct = 0;

            if (colourVariants.length > 0) {
              let lowestVar = colourVariants[0];
              for (const v of colourVariants) {
                const p = parseFloat(v.price?.amount || '0');
                if (lowestVar && p < parseFloat(lowestVar.price?.amount || '0')) {
                  lowestVar = v;
                }
                const c = v.compareAtPrice ? parseFloat(v.compareAtPrice.amount) : null;
                if (c && c > p) {
                  const pct = Math.round(((c - p) / c) * 100);
                  if (pct > maxDiscountPct) {
                    maxDiscountPct = pct;
                    bestComparePrice = v.compareAtPrice;
                  }
                }
              }
              priceNum = parseFloat(lowestVar?.price?.amount || '0');
            }

            const isOutOfStock =
              colourVariants.length > 0 &&
              colourVariants.every(
                (v) => !v.availableForSale || (v.quantityAvailable !== undefined && v.quantityAvailable <= 0)
              );

            items.push({
              id: `${product.id}-${col.toLowerCase().replace(/\s+/g, '-')}`,
              product,
              colourName: col,
              primaryImage: primaryImg,
              secondaryImage: null,
              price: priceNum,
              compareAtPrice: bestComparePrice,
              discountPercent: maxDiscountPct,
              isOutOfStock,
              productType: (product.productType || '').trim(),
              fit: (product.fit || '').trim(),
              activity: (product.activity || '').trim(),
              kitType: (product.kitType || '').trim(),
              targetHref: `/products/${product.handle}?colour=${encodeURIComponent(col)}`,
            });
          });
        } else {
          // Single card for standard product
          const priceNum = parseFloat(product.priceRange?.minVariantPrice?.amount || '0');
          const isOutOfStock =
            !product.availableForSale ||
            (allVariants.length > 0 &&
              allVariants.every(
                (v) => !v.availableForSale || (v.quantityAvailable !== undefined && v.quantityAvailable <= 0)
              ));

          items.push({
            id: product.id,
            product,
            colourName: uniqueColours[0] || undefined,
            primaryImage: product.featuredImage ?? product.images?.edges?.[0]?.node ?? null,
            secondaryImage: product.images?.edges?.[1]?.node ?? null,
            price: priceNum,
            compareAtPrice: product.compareAtPriceRange?.minVariantPrice ?? null,
            discountPercent: 0,
            isOutOfStock,
            productType: (product.productType || '').trim(),
            fit: (product.fit || '').trim(),
            activity: (product.activity || '').trim(),
            kitType: (product.kitType || '').trim(),
            targetHref: `/products/${product.handle}`,
          });
        }
      }
    });

    return items;
  }, [initialProducts]);

  // ── 2. Derive Unique Filters ──
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
  }, [expandedItems, searchQuery, selectedCategory, selectedFit, selectedActivity, sortBy]);

  const hasActiveFilters =
    selectedCategory !== 'ALL' ||
    selectedFit !== 'ALL' ||
    selectedActivity !== 'ALL' ||
    Boolean(searchQuery.trim());

  function resetFilters() {
    setSelectedCategory('ALL');
    setSelectedFit('ALL');
    setSelectedActivity('ALL');
    setSearchQuery('');
    setSortBy('featured');
  }

  return (
    <div
      style={{
        background: '#09090b',
        color: '#f4f4f5',
        minHeight: '100vh',
        paddingBottom: '80px',
      }}
    >
      {/* ── 1. Luxury Editorial Header ── */}
      <section
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: 'clamp(40px, 5vw, 64px) 24px 32px',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(197, 160, 89, 0.08) 0%, rgba(9, 9, 11, 0) 70%), #09090b',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.6875rem',
              fontWeight: 800,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--color-gold, #c5a059)',
              marginBottom: '12px',
            }}
          >
            <span>✦</span>
            <span>VAHN ATHLETIC DIVISION</span>
            <span>✦</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 900,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              margin: '0 0 10px',
              color: '#ffffff',
              lineHeight: 1.1,
            }}
          >
            SHOP THE SILHOUETTES
          </h1>

          <p
            style={{
              fontSize: '0.9375rem',
              color: '#a1a1aa',
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Engineered teamwear and modern silhouettes tailored with precision.
          </p>
        </div>
      </section>

      {/* ── 2. Unified Filter & Controls Bar ── */}
      <section
        style={{
          position: 'sticky',
          top: 60,
          zIndex: 30,
          background: 'rgba(9, 9, 11, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '16px 20px',
        }}
      >
        <div
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Search Bar */}
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '320px' }}>
            <input
              type="text"
              placeholder="Search silhouettes or colours..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 34px',
                background: '#141418',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.8125rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--color-gold, #c5a059)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)')}
            />
            <svg
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 14,
                height: 14,
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
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#a1a1aa',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '2px',
              scrollbarWidth: 'none',
              alignItems: 'center',
            }}
          >
            <button
              onClick={() => setSelectedCategory('ALL')}
              style={{
                padding: '7px 14px',
                borderRadius: '4px',
                fontSize: '0.6875rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                border: selectedCategory === 'ALL' ? '1px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.1)',
                background: selectedCategory === 'ALL' ? '#ffffff' : '#141418',
                color: selectedCategory === 'ALL' ? '#000000' : '#a1a1aa',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              All Items
            </button>

            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? 'ALL' : cat)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '4px',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  border: selectedCategory === cat ? '1px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: selectedCategory === cat ? '#ffffff' : '#141418',
                  color: selectedCategory === cat ? '#000000' : '#a1a1aa',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat}
              </button>
            ))}

            {/* Fit Pill Filters */}
            {fits.map((fit) => (
              <button
                key={fit}
                onClick={() => setSelectedFit(selectedFit === fit ? 'ALL' : fit)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '4px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  border:
                    selectedFit === fit
                      ? '1px solid var(--color-gold, #c5a059)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                  background: selectedFit === fit ? 'rgba(197, 160, 89, 0.15)' : 'transparent',
                  color: selectedFit === fit ? 'var(--color-gold, #c5a059)' : '#71717a',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                {fit}
              </button>
            ))}
          </div>

          {/* Right Controls: Sort & Reset */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Reset All
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', fontWeight: 600 }}>
                Sort:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '7px 10px',
                  background: '#141418',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '4px',
                  color: '#f4f4f5',
                  fontSize: '0.75rem',
                  fontWeight: 600,
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
      </section>

      {/* ── 3. Product Counter & Grid Container ── */}
      <main
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '24px 20px',
        }}
      >
        {/* Counter bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <p
            style={{
              fontSize: '0.6875rem',
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#71717a',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#22c55e',
                display: 'inline-block',
              }}
            />
            Showing {filteredItems.length} {filteredItems.length === 1 ? 'Silhouette' : 'Silhouettes'}
          </p>
        </div>

        {/* Product Grid */}
        {filteredItems.length === 0 ? (
          <div
            style={{
              padding: '90px 24px',
              textAlign: 'center',
              background: '#121216',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              marginTop: '10px',
            }}
          >
            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
              No Silhouettes Found
            </p>
            <p style={{ fontSize: '0.875rem', color: '#71717a', marginBottom: '24px' }}>
              No products match your active search or filter criteria.
            </p>
            <button
              onClick={resetFilters}
              className="btn btn-primary"
              style={{ padding: '10px 24px', fontSize: '0.75rem', letterSpacing: '0.08em' }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '20px',
            }}
          >
            {filteredItems.map((item) => (
              <ProductCard
                key={item.id}
                product={item.product}
                colourGroup={item.colourGroup}
                customColour={item.colourName}
                customHref={item.targetHref}
                customPrimaryImage={item.primaryImage}
                customSecondaryImage={item.secondaryImage}
                customPrice={item.price}
                customComparePrice={item.compareAtPrice}
                customDiscountPercent={item.discountPercent}
                customIsOutOfStock={item.isOutOfStock}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
