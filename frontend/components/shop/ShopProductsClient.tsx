'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
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
    <div style={{ background: '#ffffff', color: '#000000', minHeight: '100vh', paddingBottom: '80px' }}>
      {/* ── 1. Clean Page Header ── */}
      <section
        style={{
          borderBottom: '1px solid var(--color-grey-light, #e4e4e7)',
          padding: 'clamp(28px, 4vw, 48px) 20px 24px',
          background: '#ffffff',
        }}
      >
        <div style={{ maxWidth: 'var(--page-width, 1440px)', margin: '0 auto' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Link
              href="/"
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-grey-dark, #71717a)',
                textDecoration: 'none',
              }}
            >
              Home
            </Link>
            <span style={{ color: '#a1a1aa', fontSize: '0.75rem' }}>/</span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#000000',
              }}
            >
              Shop All
            </span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
              fontWeight: 800,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              margin: '0 0 6px',
              color: '#000000',
            }}
          >
            All Products
          </h1>

          <p style={{ fontSize: '0.9375rem', color: '#71717a', margin: 0 }}>
            Explore the complete VAHN collection of performance teamwear and modern silhouettes.
          </p>
        </div>
      </section>

      {/* ── 2. Unified Filter & Controls Bar ── */}
      <section
        style={{
          position: 'sticky',
          top: 60,
          zIndex: 30,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--color-grey-light, #e4e4e7)',
          padding: '14px 20px',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--page-width, 1440px)',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '280px' }}>
            <input
              type="text"
              placeholder="Search products or colours..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                background: '#ffffff',
                border: '1px solid #d4d4d8',
                borderRadius: '4px',
                color: '#000000',
                fontSize: '0.8125rem',
                outline: 'none',
              }}
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
                  color: '#71717a',
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
              scrollbarWidth: 'none',
              alignItems: 'center',
            }}
          >
            <button
              onClick={() => setSelectedCategory('ALL')}
              style={{
                padding: '6px 14px',
                borderRadius: '3px',
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                border: selectedCategory === 'ALL' ? '1px solid #000000' : '1px solid #e4e4e7',
                background: selectedCategory === 'ALL' ? '#000000' : '#ffffff',
                color: selectedCategory === 'ALL' ? '#ffffff' : '#52525b',
                transition: 'all 0.15s ease',
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
                  padding: '6px 14px',
                  borderRadius: '3px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  border: selectedCategory === cat ? '1px solid #000000' : '1px solid #e4e4e7',
                  background: selectedCategory === cat ? '#000000' : '#ffffff',
                  color: selectedCategory === cat ? '#ffffff' : '#52525b',
                  transition: 'all 0.15s ease',
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
                  padding: '6px 12px',
                  borderRadius: '3px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  border: selectedFit === fit ? '1px solid #000000' : '1px solid #e4e4e7',
                  background: selectedFit === fit ? '#f4f4f5' : '#ffffff',
                  color: selectedFit === fit ? '#000000' : '#71717a',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {fit}
              </button>
            ))}
          </div>

          {/* Right Controls: Reset & Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Reset
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
                  padding: '6px 10px',
                  background: '#ffffff',
                  border: '1px solid #d4d4d8',
                  borderRadius: '3px',
                  color: '#000000',
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
          maxWidth: 'var(--page-width, 1440px)',
          margin: '0 auto',
          padding: '24px 20px',
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <p
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#71717a',
              margin: 0,
            }}
          >
            Showing {filteredItems.length} {filteredItems.length === 1 ? 'Product' : 'Products'}
          </p>
        </div>

        {/* Product Grid */}
        {filteredItems.length === 0 ? (
          <div
            style={{
              padding: '80px 20px',
              textAlign: 'center',
              background: '#f9f9fb',
              border: '1px solid #e4e4e7',
              borderRadius: '4px',
              marginTop: '10px',
            }}
          >
            <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#000000', marginBottom: '6px' }}>
              No products found
            </p>
            <p style={{ fontSize: '0.875rem', color: '#71717a', marginBottom: '20px' }}>
              Try adjusting your search query or removing active filters.
            </p>
            <button
              onClick={resetFilters}
              className="btn btn-primary"
              style={{ padding: '8px 20px', fontSize: '0.8125rem' }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '32px 20px',
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
