'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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

// ── FAQ Data ──
const FAQ_ITEMS = [
  {
    q: 'WHAT DOES VAHN MAKE?',
    a: 'Right now, jerseys, built for the way you actually play.\nThis is our first drop. More is coming.',
  },
  {
    q: 'ARE THE JERSEYS UNISEX?',
    a: 'Yes. Made for everyone.',
  },
  {
    q: 'HOW DOES THE FIT RUN?',
    a: "Relaxed, not oversized. If you're between sizes, we'd recommend sizing down for a fitted look or staying true to size for the intended relaxed drape.",
    link: { label: 'Size Chart', href: '/pages/size-chart' },
  },
  {
    q: 'WHAT FABRIC ARE THE JERSEYS MADE FROM?',
    a: '100% micro yarn polyester, 155 gsm. Built with moisture-wicking technology that pulls sweat away from the skin, and breathable panelling placed through the high-heat zones for airflow.',
  },
  {
    q: 'CAN I WEAR VAHN ON THE FIELD, OR IS IT STREETWEAR?',
    a: "Both. VAHN isn't gym wear and it isn't costume, it's for cricket on a Sunday, football after work, badminton with your building group. Wherever the game is, wear it there.",
  },
  {
    q: 'IS THIS A LIMITED DROP? WILL IT RESTOCK?',
    a: "Our first collection is a limited run, when it's gone, it's gone. That's the drop,\nnot a shortage. Follow us for what's next.",
  },
  {
    q: 'DO YOU SHIP ACROSS INDIA? HOW LONG DOES DELIVERY TAKE?',
    a: 'Yes, pan-India shipping. 5–7 business days.',
  },
  {
    q: "WHAT'S YOUR RETURN/EXCHANGE POLICY?",
    a: 'Refer to our ',
    link: { label: 'Shipping & Returns Policies', href: '/policies/refund-policy' },
  },
];

// ── Sort Options (matching mockup dropdown) ──
const SORT_OPTIONS = [
  { value: 'featured', label: 'FEATURED' },
  { value: 'most-relevant', label: 'MOST RELEVANT' },
  { value: 'best-selling', label: 'BEST SELLING' },
  { value: 'name-asc', label: 'ALPHABETICALLY, A-Z' },
  { value: 'name-desc', label: 'ALPHABETICALLY, Z-A' },
  { value: 'price-asc', label: 'PRICE, LOW TO HIGH' },
  { value: 'price-desc', label: 'PRICE, HIGH TO LOW' },
  { value: 'date-new', label: 'DATE, NEW TO OLD' },
  { value: 'date-old', label: 'DATE, OLD TO NEW' },
];

// ── FAQ Accordion Item ──
function FaqItem({ q, a, link, isOpen, onToggle }: {
  q: string;
  a: string;
  link?: { label: string; href: string };
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ borderBottom: '1px solid #e5e5e5' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '22px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.8125rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: '#000000',
          }}
        >
          {q}
        </span>
        {/* X / + icon */}
        <span
          style={{
            color: '#3a3699',
            fontSize: '1.125rem',
            lineHeight: 1,
            flexShrink: 0,
            marginLeft: '16px',
            fontWeight: 400,
          }}
        >
          {isOpen ? '×' : '+'}
        </span>
      </button>

      {isOpen && (
        <div style={{ paddingBottom: '22px' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
              color: '#444444',
              lineHeight: 1.7,
              margin: 0,
              whiteSpace: 'pre-line',
            }}
          >
            {a}
            {link && (
              <Link
                href={link.href}
                style={{ color: '#3a3699', textDecoration: 'none' }}
              >
                {link.label}
              </Link>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ShopProductsClient({ initialProducts }: Props) {
  const [sortBy, setSortBy] = useState<string>('featured');
  const [sortOpen, setSortOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedFit, setSelectedFit] = useState<string>('ALL');
  const [selectedActivity, setSelectedActivity] = useState<string>('ALL');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── 1. Expand products into distinct colourway cards ──
  const expandedItems: ExpandedCardItem[] = useMemo(() => {
    const items: ExpandedCardItem[] = [];

    initialProducts.forEach((product) => {
      const allVariants = (product.variants?.edges ?? []).map((e) => e.node);

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

          let primaryImg: ShopifyImage | null = null;
          if (cg.images && cg.images.length > 0 && cg.images[0].url) {
            primaryImg = { url: cg.images[0].url, altText: cg.images[0].altText || `${product.title} - ${colourName}`, width: 800, height: 800 };
          } else {
            const variantWithImage = colourVariants.find((v) => v.image && v.image.url);
            primaryImg = variantWithImage?.image ?? product.featuredImage ?? product.images?.edges?.[0]?.node ?? null;
          }

          let secondaryImg: ShopifyImage | null = null;
          if (cg.images && cg.images.length > 1 && cg.images[1].url) {
            secondaryImg = { url: cg.images[1].url, altText: cg.images[1].altText || `${product.title} - ${colourName}`, width: 800, height: 800 };
          }

          let priceNum = parseFloat(product.priceRange?.minVariantPrice?.amount || '0');
          let bestComparePrice: Money | null = null;
          let maxDiscountPct = 0;
          let isOutOfStock = false;

          const pool = colourVariants.length > 0 ? colourVariants : allVariants;
          if (pool.length > 0) {
            let lowestVar = pool[0];
            for (const v of pool) {
              const p = parseFloat(v.price?.amount || '0');
              if (lowestVar && p < parseFloat(lowestVar.price?.amount || '0')) lowestVar = v;
              const c = v.compareAtPrice ? parseFloat(v.compareAtPrice.amount) : null;
              if (c && c > p) {
                const pct = Math.round(((c - p) / c) * 100);
                if (pct > maxDiscountPct) { maxDiscountPct = pct; bestComparePrice = v.compareAtPrice; }
              }
            }
            priceNum = parseFloat(lowestVar?.price?.amount || '0');
            isOutOfStock = pool.every((v) => !v.availableForSale || (v.quantityAvailable !== undefined && v.quantityAvailable <= 0));
          }

          items.push({
            id: `${product.id}-${colourName.toLowerCase().replace(/\s+/g, '-')}`,
            product, colourGroup: cg as ColourGroup, colourName,
            primaryImage: primaryImg, secondaryImage: secondaryImg,
            price: priceNum, compareAtPrice: bestComparePrice, discountPercent: maxDiscountPct, isOutOfStock,
            productType: (product.productType || '').trim(),
            fit: (product.fit || '').trim(),
            activity: (product.activity || '').trim(),
            kitType: (product.kitType || '').trim(),
            targetHref: `/products/${product.handle}?colour=${encodeURIComponent(colourName)}`,
          });
        });
      } else {
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
          uniqueColours.forEach((col) => {
            const colourVariants = allVariants.filter((v) =>
              v.selectedOptions.some((opt) =>
                (opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color') &&
                opt.value.trim().toLowerCase() === col.toLowerCase()
              )
            );
            const variantWithImg = colourVariants.find((v) => v.image && v.image.url);
            const primaryImg = variantWithImg?.image ?? product.featuredImage ?? product.images?.edges?.[0]?.node ?? null;

            let priceNum = parseFloat(product.priceRange?.minVariantPrice?.amount || '0');
            let bestComparePrice: Money | null = null;
            let maxDiscountPct = 0;

            if (colourVariants.length > 0) {
              let lowestVar = colourVariants[0];
              for (const v of colourVariants) {
                const p = parseFloat(v.price?.amount || '0');
                if (lowestVar && p < parseFloat(lowestVar.price?.amount || '0')) lowestVar = v;
                const c = v.compareAtPrice ? parseFloat(v.compareAtPrice.amount) : null;
                if (c && c > p) {
                  const pct = Math.round(((c - p) / c) * 100);
                  if (pct > maxDiscountPct) { maxDiscountPct = pct; bestComparePrice = v.compareAtPrice; }
                }
              }
              priceNum = parseFloat(lowestVar?.price?.amount || '0');
            }

            const isOutOfStock = colourVariants.length > 0 && colourVariants.every((v) => !v.availableForSale || (v.quantityAvailable !== undefined && v.quantityAvailable <= 0));

            items.push({
              id: `${product.id}-${col.toLowerCase().replace(/\s+/g, '-')}`,
              product, colourName: col, primaryImage: primaryImg, secondaryImage: null,
              price: priceNum, compareAtPrice: bestComparePrice, discountPercent: maxDiscountPct, isOutOfStock,
              productType: (product.productType || '').trim(),
              fit: (product.fit || '').trim(),
              activity: (product.activity || '').trim(),
              kitType: (product.kitType || '').trim(),
              targetHref: `/products/${product.handle}?colour=${encodeURIComponent(col)}`,
            });
          });
        } else {
          const priceNum = parseFloat(product.priceRange?.minVariantPrice?.amount || '0');
          const isOutOfStock = !product.availableForSale || (allVariants.length > 0 && allVariants.every((v) => !v.availableForSale || (v.quantityAvailable !== undefined && v.quantityAvailable <= 0)));

          items.push({
            id: product.id, product, colourName: uniqueColours[0] || undefined,
            primaryImage: product.featuredImage ?? product.images?.edges?.[0]?.node ?? null,
            secondaryImage: product.images?.edges?.[1]?.node ?? null,
            price: priceNum, compareAtPrice: product.compareAtPriceRange?.minVariantPrice ?? null,
            discountPercent: 0, isOutOfStock,
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

  // ── 2. Apply Sorting ──
  const filteredItems = useMemo(() => {
    let result = [...expandedItems];
    if (selectedCategory !== 'ALL') result = result.filter((i) => i.productType.toLowerCase() === selectedCategory.toLowerCase());
    if (selectedFit !== 'ALL') result = result.filter((i) => i.fit.toUpperCase() === selectedFit.toUpperCase());
    if (selectedActivity !== 'ALL') result = result.filter((i) => i.activity.toUpperCase() === selectedActivity.toUpperCase());

    if (sortBy === 'price-asc') result.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price-desc') result.sort((a, b) => b.price - a.price);
    else if (sortBy === 'name-asc') result.sort((a, b) => a.product.title.localeCompare(b.product.title));
    else if (sortBy === 'name-desc') result.sort((a, b) => b.product.title.localeCompare(a.product.title));

    return result;
  }, [expandedItems, selectedCategory, selectedFit, selectedActivity, sortBy]);

  const selectedSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'FEATURED';

  return (
    <div style={{ background: '#ffffff', color: '#000000', minHeight: '100vh' }}>

      {/* ── Page Title Area ── */}
      <div style={{ padding: '60px clamp(24px, 5vw, 80px) 0' }}>
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
            fontWeight: 900,
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            color: '#000000',
            margin: '0 0 6px',
            lineHeight: 1.1,
          }}
        >
          ALL PRODUCTS
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.9375rem',
            color: '#444444',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Our first drop is here &nbsp;limited pieces, made to move with you.
        </p>
      </div>

      {/* ── Sort + Filter Bar ── */}
      <div
        style={{
          padding: '20px clamp(24px, 5vw, 80px) 0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Sort Dropdown */}
        <div ref={sortRef} style={{ position: 'relative' }}>
          <button
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
              minWidth: '160px',
              justifyContent: 'space-between',
            }}
          >
            <span>{selectedSortLabel}</span>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1L5 5L9 1" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {sortOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                zIndex: 50,
                background: '#ffffff',
                border: '1px solid #c0c0c0',
                borderTop: 'none',
                minWidth: '200px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
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
                    color: sortBy === opt.value ? '#3a3699' : '#222222',
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

        {/* Filters Button */}
        <button
          onClick={() => setFiltersOpen((p) => !p)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            background: '#3a3699',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-heading)',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: '#ffffff',
            textTransform: 'uppercase',
          }}
        >
          FILTERS
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span>
        </button>
      </div>

      {/* ── Filter Drawer (when open) ── */}
      {filtersOpen && (
        <div
          style={{
            padding: '16px clamp(24px, 5vw, 80px)',
            background: '#f9f9f9',
            borderBottom: '1px solid #e5e5e5',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#666', marginRight: '4px' }}>Category:</span>
          {['ALL', ...Array.from(new Set(expandedItems.map((i) => i.productType).filter(Boolean)))].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '5px 12px',
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                border: '1px solid',
                borderColor: selectedCategory === cat ? '#3a3699' : '#d0d0d0',
                background: selectedCategory === cat ? '#3a3699' : '#ffffff',
                color: selectedCategory === cat ? '#ffffff' : '#444',
                cursor: 'pointer',
              }}
            >
              {cat === 'ALL' ? 'All' : cat}
            </button>
          ))}
        </div>
      )}

      {/* ── Product Grid ── */}
      <main style={{ padding: '32px clamp(24px, 5vw, 80px) 64px' }}>
        {filteredItems.length === 0 ? (
          <div style={{ padding: '80px 20px', textAlign: 'center', border: '1px solid #e5e5e5' }}>
            <p style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 6px' }}>No products found</p>
            <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>Check back soon for new drops.</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '40px 24px',
            }}
          >
            {filteredItems.map((item) => (
              <MockupProductCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      {/* ── FAQ Section ── */}
      <section style={{ padding: '80px clamp(24px, 10vw, 200px)' }}>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.25rem, 2vw, 1.5rem)',
            fontWeight: 900,
            textTransform: 'uppercase',
            textAlign: 'center',
            letterSpacing: '0.02em',
            margin: '0 0 48px',
            lineHeight: 1.2,
          }}
        >
          FREQUENTLY ASKED<br />QUESTIONS
        </h2>

        <div style={{ borderTop: '1px solid #e5e5e5' }}>
          {FAQ_ITEMS.map((item, idx) => (
            <FaqItem
              key={idx}
              q={item.q}
              a={item.a}
              link={item.link}
              isOpen={openFaqIndex === idx}
              onToggle={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
            />
          ))}
        </div>
      </section>

      {/* ── Trust Badges ── */}
      <div
        style={{
          background: '#3a3699',
          padding: '28px clamp(24px, 5vw, 80px)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
        }}
      >
        {[
          { icon: '/icons/pan-india-delivery.png', label: 'PAN-INDIA DELIVERY' },
          { icon: '/icons/secure-payments.png', label: '100% SECURE PAYMENTS' },
          { icon: '/icons/made-for-the-game.png', label: 'MADE FOR THE GAME' },
        ].map((badge, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.35)' : 'none',
              padding: '0 20px',
            }}
          >
            <Image src={badge.icon} alt={badge.label} width={28} height={28} style={{ filter: 'brightness(0) invert(1)', objectFit: 'contain' }} />
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#ffffff',
              }}
            >
              {badge.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Play On Marquee ── */}
      <div
        style={{
          background: '#111111',
          overflow: 'hidden',
          borderTop: '1px solid #222222',
          borderBottom: '1px solid #222222',
          padding: '14px 0',
        }}
      >
        <style>{`
          @keyframes marquee-shop {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
        <div
          style={{
            display: 'flex',
            whiteSpace: 'nowrap',
            animation: 'marquee-shop 18s linear infinite',
          }}
        >
          {Array.from({ length: 20 }).map((_, i) => (
            <span
              key={i}
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.875rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: '#3a3699',
                paddingRight: '48px',
              }}
            >
              Play On.
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Mockup-style Product Card ──
function MockupProductCard({ item }: { item: ExpandedCardItem }) {
  const { product, colourName, primaryImage, price, isOutOfStock } = item;

  // Format price as ₹ X,XXX
  const formattedPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

  // Determine "few left" — show when low stock but not out of stock
  const showFewLeft = !isOutOfStock;

  // Collection tag — from product type or colourName
  const collectionTag = (colourName || product.productType || '').toUpperCase() || 'VEGA 2026';

  const targetHref = item.targetHref;

  return (
    <Link href={targetHref} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      {/* Image container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          background: '#e8e8e8',
          overflow: 'hidden',
        }}
      >
        {primaryImage?.url ? (
          <Image
            src={primaryImage.url}
            alt={primaryImage.altText ?? product.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            style={{ objectFit: 'cover', objectPosition: 'center' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            No image
          </div>
        )}

        {/* Left arrow */}
        <button
          onClick={(e) => e.preventDefault()}
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.85)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#000',
          }}
        >
          ‹
        </button>
        {/* Right arrow */}
        <button
          onClick={(e) => e.preventDefault()}
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.85)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#000',
          }}
        >
          ›
        </button>
      </div>

      {/* Product Info */}
      <div style={{ marginTop: '14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Collection/colour label */}
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.625rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#888888',
              margin: '0 0 4px',
            }}
          >
            {collectionTag}
          </p>

          {/* Product title */}
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              color: '#000000',
              margin: '0 0 6px',
              lineHeight: 1.3,
            }}
          >
            {product.title}
          </p>

          {/* Price */}
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: '#3a3699',
              margin: '0 0 4px',
            }}
          >
            {formattedPrice}
          </p>

          {/* Stock label */}
          {showFewLeft && (
            <p
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.625rem',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#999999',
                margin: 0,
              }}
            >
              {isOutOfStock ? 'OUT OF STOCK' : 'ONLY FEW LEFT'}
            </p>
          )}
        </div>

        {/* Plus button */}
        <div
          style={{
            width: '28px',
            height: '28px',
            border: '1px solid #3a3699',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginLeft: '10px',
            marginTop: '16px',
          }}
        >
          <span style={{ color: '#3a3699', fontSize: '1.125rem', lineHeight: 1, fontWeight: 300 }}>+</span>
        </div>
      </div>
    </Link>
  );
}
