'use client';

import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import TrustBadgesBar from '@/components/ui/TrustBadgesBar';
import { useCart } from '@/context/CartContext';
import type { Product, ProductVariant } from '@/lib/api/types';

interface Props {
  initialProducts: Product[];
}

export interface ExpandedCardItem {
  id: string;
  product: Product;
  category: string;
  colourName: string;
  images: { url: string; altText?: string }[];
  price: string;
  isFewLeft: boolean;
  tag: string;
  title: string;
  targetHref: string;
  variants: ProductVariant[];
  productType: string;
  fit: string;
  activity: string;
}

const STANDARD_SIZE_ORDER = [
  '3XS',
  '2XS',
  'XXS',
  'XS',
  'S',
  'M',
  'L',
  'XL',
  '2XL',
  'XXL',
  '3XL',
  'XXXL',
  '4XL',
  '5XL',
  '6XL',
];

// ── FAQ Data (from mockup) ──
export const FAQ_ITEMS = [
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
    link: { label: 'Shipping & Returns Policies', href: '/pages/shipping' },
  },
];

// ── Sort Options (matching mockup) ──
export const SORT_OPTIONS = [
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

export const BRAND_COLOR = '#4232d9';

// ── Expand products → per-colourway items (same logic as FreshOutLocker) ──
export function getExpandedItems(products: Product[]): ExpandedCardItem[] {
  const items: ExpandedCardItem[] = [];

  products.forEach((product) => {
    const allVariants = (product.variants?.edges ?? []).map((e) => e.node);
    const tag =
      product.tags?.find((t) => !t.startsWith('_') && t.length < 15) ||
      product.vendor ||
      'BESTSELLER';

    function calcFewLeft(pool: ProductVariant[]) {
      return pool.some(
        (v) =>
          v.availableForSale &&
          typeof v.quantityAvailable === 'number' &&
          v.quantityAvailable > 0 &&
          v.quantityAvailable <= 5
      );
    }

    function calcPrice(pool: ProductVariant[]) {
      const lowestVar = pool.reduce<ProductVariant | null>((acc, v) => {
        if (!acc) return v;
        return parseFloat(v.price.amount) < parseFloat(acc.price.amount) ? v : acc;
      }, null);
      return lowestVar
        ? parseInt(lowestVar.price.amount, 10).toLocaleString('en-IN')
        : parseInt(product.priceRange?.minVariantPrice?.amount || '0', 10).toLocaleString('en-IN');
    }

    if (product.colourGroups && product.colourGroups.length > 0) {
      product.colourGroups.forEach((cg) => {
        const colourName = cg.colourValue.trim();
        const colourVariants = allVariants.filter((v) =>
          v.selectedOptions?.some(
            (opt) =>
              (opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color') &&
              opt.value.trim().toLowerCase() === colourName.toLowerCase()
          )
        );
        const cgImages = (cg.images || []).map((img) => ({
          url: img.url,
          altText: img.altText || `${product.title} - ${colourName}`,
        }));
        if (cgImages.length === 0) {
          const variantImg = colourVariants.find((v) => v.image?.url)?.image?.url;
          if (variantImg)
            cgImages.push({ url: variantImg, altText: `${product.title} - ${colourName}` });
          else if (product.featuredImage?.url)
            cgImages.push({ url: product.featuredImage.url, altText: product.title });
        }
        const pool = colourVariants.length > 0 ? colourVariants : allVariants;
        const cat = (
          product.category ||
          (product.title.toLowerCase().includes('wristband') ? 'ACCESSORIES' : 'TOPS')
        ).toUpperCase();
        items.push({
          id: `${product.id}-${colourName.toLowerCase().replace(/\s+/g, '-')}`,
          product,
          category: cat,
          colourName,
          images: cgImages,
          price: calcPrice(pool),
          isFewLeft: calcFewLeft(pool),
          tag,
          title: product.title,
          targetHref: `/products/${product.handle}?colour=${encodeURIComponent(colourName)}`,
          variants: pool,
          productType: (product.productType || '').trim(),
          fit: (product.fit || '').trim(),
          activity: (product.activity || '').trim(),
        });
      });
    } else {
      const variantColourSet = new Set<string>();
      allVariants.forEach((v) => {
        v.selectedOptions?.forEach((opt) => {
          if (
            (opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color') &&
            opt.value.trim()
          ) {
            variantColourSet.add(opt.value.trim());
          }
        });
      });
      const uniqueColours = Array.from(variantColourSet);

      if (uniqueColours.length > 1) {
        uniqueColours.forEach((col) => {
          const colourVariants = allVariants.filter((v) =>
            v.selectedOptions?.some(
              (opt) =>
                (opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color') &&
                opt.value.trim().toLowerCase() === col.toLowerCase()
            )
          );
          const colImages: { url: string; altText?: string }[] = [];
          colourVariants.forEach((v) => {
            if (v.image?.url && !colImages.some((img) => img.url === v.image?.url))
              colImages.push({ url: v.image.url, altText: `${product.title} - ${col}` });
          });
          if (colImages.length === 0 && product.featuredImage?.url)
            colImages.push({ url: product.featuredImage.url, altText: product.title });
          const pool = colourVariants.length > 0 ? colourVariants : allVariants;
          const cat = (
            product.category ||
            (product.title.toLowerCase().includes('wristband') ? 'ACCESSORIES' : 'TOPS')
          ).toUpperCase();
          items.push({
            id: `${product.id}-${col.toLowerCase().replace(/\s+/g, '-')}`,
            product,
            category: cat,
            colourName: col,
            images: colImages,
            price: calcPrice(pool),
            isFewLeft: calcFewLeft(pool),
            tag,
            title: product.title,
            targetHref: `/products/${product.handle}?colour=${encodeURIComponent(col)}`,
            variants: pool,
            productType: (product.productType || '').trim(),
            fit: (product.fit || '').trim(),
            activity: (product.activity || '').trim(),
          });
        });
      } else {
        const prodImages = (product.images?.edges || []).map((e) => ({
          url: e.node.url,
          altText: e.node.altText || product.title,
        }));
        if (prodImages.length === 0 && product.featuredImage?.url)
          prodImages.push({ url: product.featuredImage.url, altText: product.title });
        const cat = (
          product.category ||
          (product.title.toLowerCase().includes('wristband') ? 'ACCESSORIES' : 'TOPS')
        ).toUpperCase();
        items.push({
          id: product.id,
          product,
          category: cat,
          colourName: '',
          images: prodImages,
          price: calcPrice(allVariants),
          isFewLeft: calcFewLeft(allVariants),
          tag,
          title: product.title,
          targetHref: `/products/${product.handle}`,
          variants: allVariants,
          productType: (product.productType || '').trim(),
          fit: (product.fit || '').trim(),
          activity: (product.activity || '').trim(),
        });
      }
    }
  });
  return items;
}

// ── FAQ Accordion Item ──
function FaqItem({
  q,
  a,
  link,
  isOpen,
  onToggle,
}: {
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
          padding: '20px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          gap: '16px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.0625rem',
            fontWeight: 400,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#000000',
          }}
        >
          {q}
        </span>
        <span
          style={{
            fontSize: '1.25rem',
            fontWeight: 300,
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
        <div style={{ paddingBottom: '20px', paddingRight: '48px' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
              color: '#555555',
              lineHeight: 1.75,
              margin: 0,
              whiteSpace: 'pre-line',
            }}
          >
            {a}
            {link && (
              <Link href={link.href} style={{ color: BRAND_COLOR, textDecoration: 'none' }}>
                {link.label}
              </Link>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Product Card — identical to FreshOutLocker LockerCard, adapted for grid ──
export function ShopCard({ item }: { item: ExpandedCardItem }) {
  const { addItem } = useCart();
  const [imgIdx, setImgIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [addedVariantId, setAddedVariantId] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const images = item.images || [];
  const hasMultipleImages = images.length > 1;
  const currentImg = images[imgIdx] ?? null;
  const activeImageUrl = currentImg?.url || null;

  const sizeVariants = useMemo(() => {
    const mapped = item.variants.map((v) => {
      const sizeOpt = v.selectedOptions?.find((o) => o.name.toLowerCase() === 'size');
      const sizeLabel = sizeOpt
        ? sizeOpt.value.trim()
        : v.title !== 'Default Title'
          ? v.title
          : 'ONE SIZE';
      const isAvailable =
        v.availableForSale && (v.quantityAvailable === undefined || v.quantityAvailable > 0);
      const isFew =
        isAvailable && typeof v.quantityAvailable === 'number' && v.quantityAvailable <= 5;
      return { variant: v, sizeLabel, isAvailable, isFew };
    });

    return mapped.sort((a, b) => {
      const normA = a.sizeLabel.trim().toUpperCase();
      const normB = b.sizeLabel.trim().toUpperCase();
      const numA = parseFloat(normA);
      const numB = parseFloat(normB);
      if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
        return numA - numB;
      }
      const indexA = STANDARD_SIZE_ORDER.indexOf(normA);
      const indexB = STANDARD_SIZE_ORDER.indexOf(normB);
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return normA.localeCompare(normB);
    });
  }, [item]);

  const handleAddToCart = (v: ProductVariant) => {
    setAddedVariantId(v.id);
    addItem(
      v.id,
      1,
      {
        productTitle: item.title,
        productHandle: item.product.handle,
        variantTitle: v.title,
        price: v.price,
        image: currentImg
          ? {
              url: currentImg.url,
              altText: currentImg.altText || item.title,
              width: 800,
              height: 800,
            }
          : null,
        selectedOptions: v.selectedOptions,
        quantityAvailable: v.quantityAvailable,
      },
      true
    );
    setTimeout(() => {
      setAddedVariantId(null);
      setShowQuickAdd(false);
    }, 600);
  };

  useEffect(() => {
    if (!showQuickAdd) return;
    const handleOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setShowQuickAdd(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showQuickAdd]);

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length > 1) setImgIdx((i) => (i - 1 + images.length) % images.length);
  };
  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length > 1) setImgIdx((i) => (i + 1) % images.length);
  };

  return (
    <article
      ref={cardRef}
      className="shop-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ display: 'flex', flexDirection: 'column', position: 'relative', userSelect: 'none' }}
    >
      {/* Image Frame — 4:5 portrait ratio matching FreshOutLocker */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4 / 5',
          background: '#f5f5f7',
          overflow: 'hidden',
        }}
      >
        {/* Left Arrow — frosted circle with animated ChevronLeft */}
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous view"
          className="shop-card-arrow"
          style={{
            position: 'absolute',
            left: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 15,
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            padding: 0,
            display: hasMultipleImages ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: hasMultipleImages ? 'pointer' : 'default',
            color: '#18181b',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = BRAND_COLOR;
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#18181b';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
          }}
        >
          <ChevronLeft size={16} strokeWidth={2.5} className="chevron-anim-left" />
        </button>

        {/* Product Image Link */}
        <Link
          href={item.targetHref}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
          }}
        >
          {activeImageUrl ? (
            <Image
              src={activeImageUrl}
              alt={currentImg?.altText || item.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              style={{
                objectFit: 'cover',
                objectPosition: 'center',
                transition: 'transform 0.4s ease',
                transform: isHovered ? 'scale(1.02)' : 'scale(1)',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-heading)',
              }}
            >
              No image
            </div>
          )}
        </Link>

        {/* Right Arrow — frosted circle with animated ChevronRight */}
        <button
          type="button"
          onClick={handleNext}
          aria-label="Next view"
          className="shop-card-arrow"
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 15,
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            padding: 0,
            display: hasMultipleImages ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: hasMultipleImages ? 'pointer' : 'default',
            color: '#18181b',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = BRAND_COLOR;
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#18181b';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
          }}
        >
          <ChevronRight size={16} strokeWidth={2.5} className="chevron-anim-right" />
        </button>

        {/* Pagination Dots matching product page square style */}
        {hasMultipleImages && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              zIndex: 10,
              padding: '5px 9px',
              borderRadius: 0,
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
              pointerEvents: 'none',
            }}
          >
            {images.map((img, dotIdx) => (
              <span
                key={img.url || `dot-${dotIdx}`}
                style={{
                  width: dotIdx === imgIdx ? '22px' : '6px',
                  height: '6px',
                  borderRadius: 0,
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  background: dotIdx === imgIdx ? BRAND_COLOR : 'rgba(0, 0, 0, 0.22)',
                  transition:
                    'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.25s ease',
                }}
              />
            ))}
          </div>
        )}

        {/* Quick Size Picker Overlay */}
        {showQuickAdd && (
          <section
            aria-label="Size Selector"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(255,255,255,0.98)',
              backdropFilter: 'blur(12px)',
              borderTop: '1px solid rgba(0,0,0,0.08)',
              padding: '14px 12px 12px',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowQuickAdd(false);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '-0.025em',
                  color: '#000000',
                }}
              >
                SELECT SIZE
              </span>
            </div>
            {/* Sizes Grid — 4 equal rectangular columns matching product page */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px',
                width: '100%',
              }}
            >
              {sizeVariants.map(({ variant, sizeLabel, isAvailable }) => (
                <button
                  key={variant.id}
                  type="button"
                  disabled={!isAvailable || addedVariantId === variant.id}
                  onClick={() => {
                    if (isAvailable) handleAddToCart(variant);
                  }}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: 0,
                    background:
                      addedVariantId === variant.id
                        ? BRAND_COLOR
                        : isAvailable
                          ? '#ebedf0'
                          : '#ebedf0',
                    color:
                      addedVariantId === variant.id
                        ? '#ffffff'
                        : isAvailable
                          ? '#222222'
                          : '#888888',
                    border: addedVariantId === variant.id ? `1.5px solid ${BRAND_COLOR}` : 'none',
                    borderRadius: '0px',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    letterSpacing: '-0.025em',
                    cursor: isAvailable ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    opacity: isAvailable ? 1 : 0.45,
                    transition: 'background-color 0.15s ease, color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (isAvailable && addedVariantId !== variant.id) {
                      e.currentTarget.style.backgroundColor = BRAND_COLOR;
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isAvailable && addedVariantId !== variant.id) {
                      e.currentTarget.style.backgroundColor = '#ebedf0';
                      e.currentTarget.style.color = '#222222';
                    }
                  }}
                >
                  {addedVariantId === variant.id ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <title>Added to bag</title>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    sizeLabel
                  )}

                  {/* Out-of-stock diagonal strike across size box matching product page */}
                  {!isAvailable && (
                    <svg
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                      }}
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <line
                        x1="0"
                        y1="100"
                        x2="100"
                        y2="0"
                        stroke="#999999"
                        strokeWidth="1.2"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Product Meta Row */}
      <div
        style={{
          paddingTop: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {/* Tag / Colour */}
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.6875rem',
              fontWeight: 400,
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
              color: '#8e8e93',
            }}
          >
            {item.colourName || item.tag}
          </span>
          {/* Title */}
          <Link
            href={item.targetHref}
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.8125rem',
              fontWeight: 400,
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
              color: '#000000',
              textDecoration: 'none',
              lineHeight: 1.3,
            }}
          >
            {item.title}
          </Link>
          {/* Price */}
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.875rem',
              fontWeight: 400,
              letterSpacing: '-0.01em',
              color: BRAND_COLOR,
              marginTop: '2px',
            }}
          >
            ₹ {item.price}
          </span>
          {/* Only Few Left — dynamic, only when ≤5 in stock */}
          {item.isFewLeft && (
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.625rem',
                fontWeight: 400,
                textTransform: 'uppercase',
                letterSpacing: '-0.01em',
                color: '#a0a0b2',
                marginTop: '1px',
              }}
            >
              ONLY FEW LEFT
            </span>
          )}
        </div>

        {/* Quick Add Plus */}
        <button
          type="button"
          className="shop-plus-btn"
          onClick={() => setShowQuickAdd((prev) => !prev)}
          aria-label={showQuickAdd ? 'Close size picker' : `Select size for ${item.title}`}
          style={{
            background: showQuickAdd ? BRAND_COLOR : 'none',
            border: 'none',
            color: showQuickAdd ? '#ffffff' : isHovered ? '#3425b8' : BRAND_COLOR,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            borderRadius: showQuickAdd ? '50%' : '0',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'transform 0.25s ease, color 0.2s ease, background-color 0.2s ease',
            transform: showQuickAdd ? 'rotate(45deg)' : isHovered ? 'scale(1.2)' : 'scale(1)',
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <title>Quick Add</title>
            <line x1="12" y1="4" x2="12" y2="20" />
            <line x1="4" y1="12" x2="20" y2="12" />
          </svg>
        </button>
      </div>
    </article>
  );
}

// ── Main Client Component ──
export default function ShopProductsClient({ initialProducts }: Props) {
  const [sortBy, setSortBy] = useState('featured');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedFit, setSelectedFit] = useState('ALL');
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

  const allItems = useMemo(() => getExpandedItems(initialProducts), [initialProducts]);

  const topsItems = useMemo(
    () => allItems.filter((i) => (i.category || 'TOPS').toUpperCase() === 'TOPS'),
    [allItems]
  );
  const bottomsItems = useMemo(
    () => allItems.filter((i) => (i.category || '').toUpperCase() === 'BOTTOMS'),
    [allItems]
  );
  const accessoriesItems = useMemo(
    () => allItems.filter((i) => (i.category || '').toUpperCase() === 'ACCESSORIES'),
    [allItems]
  );

  // Derived filter options
  const _categories = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((i) => {
      if (i.productType) set.add(i.productType);
    });
    return Array.from(set).sort();
  }, [allItems]);

  const _fits = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((i) => {
      if (i.fit) set.add(i.fit.toUpperCase());
    });
    return Array.from(set).sort();
  }, [allItems]);

  // Apply filters + sort
  const filteredItems = useMemo(() => {
    let result = [...allItems];
    if (selectedCategory !== 'ALL')
      result = result.filter((i) => i.productType.toLowerCase() === selectedCategory.toLowerCase());
    if (selectedFit !== 'ALL')
      result = result.filter((i) => i.fit.toUpperCase() === selectedFit.toUpperCase());
    if (sortBy === 'price-asc')
      result.sort(
        (a, b) => parseInt(a.price.replace(/,/g, ''), 10) - parseInt(b.price.replace(/,/g, ''), 10)
      );
    else if (sortBy === 'price-desc')
      result.sort(
        (a, b) => parseInt(b.price.replace(/,/g, ''), 10) - parseInt(a.price.replace(/,/g, ''), 10)
      );
    else if (sortBy === 'name-asc') result.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === 'name-desc') result.sort((a, b) => b.title.localeCompare(a.title));
    return result;
  }, [allItems, selectedCategory, selectedFit, sortBy]);

  const selectedSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'FEATURED';
  const hasActiveFilters = selectedCategory !== 'ALL' || selectedFit !== 'ALL';

  return (
    <div style={{ background: '#ffffff', color: '#000000', minHeight: '100vh' }}>
      {/* ── Responsive styles ── */}
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
          display: inline-block;
          vertical-align: middle;
          flex-shrink: 0;
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        *:hover > .chevron-anim-right,
        button:hover .chevron-anim-right,
        a:hover .chevron-anim-right {
          transform: translateX(4px);
        }
        .chevron-anim-left {
          display: inline-block;
          vertical-align: middle;
          flex-shrink: 0;
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        *:hover > .chevron-anim-left,
        button:hover .chevron-anim-left,
        a:hover .chevron-anim-left {
          transform: translateX(-4px);
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
        .trust-badges-bar {
          background: #4232d9;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          padding-top: 24px;
          padding-bottom: 24px;
        }
        .trust-badge-item {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 0 16px;
        }
        .trust-badge-icon-wrap {
          position: relative;
          width: 32px;
          height: 32px;
          flex-shrink: 0;
        }
        .trust-badge-text {
          font-family: var(--font-heading);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #ffffff;
        }
        .shop-plus-btn svg {
          width: 26px;
          height: 26px;
        }
        .shop-card-arrow {
          opacity: 0;
        }
        @media (hover: hover) {
          .shop-card:hover .shop-card-arrow {
            opacity: 1 !important;
          }
        }
        @media (hover: none) {
          .shop-card-arrow {
            opacity: 0.9 !important;
          }
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
          .shop-card-arrow {
            opacity: 0.9 !important;
          }
          .shop-plus-btn svg {
            width: 22px;
            height: 22px;
          }
          .trust-badges-bar {
            grid-template-columns: 1fr 1fr 1fr !important;
            padding: 16px 8px !important;
            gap: 0;
          }
          .trust-badge-item {
            flex-direction: column !important;
            gap: 6px !important;
            padding: 0 4px !important;
            text-align: center !important;
          }
          .trust-badge-icon-wrap {
            width: 22px !important;
            height: 22px !important;
          }
          .trust-badge-text {
            font-size: 0.5625rem !important;
            letter-spacing: 0.02em !important;
            line-height: 1.2 !important;
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

      {/* ── Page Title ── */}
      <div className="shop-container-pad shop-title-section">
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.625rem, 3vw, 2.25rem)',
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
          Our first drop is here — limited pieces, made to move with you.
        </p>

        {/* Category Quick Jump Badges with Horizontal Mobile Scroll & Animated Chevrons */}
        <div className="category-nav-scroll" style={{ marginTop: '18px' }}>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('ALL');
              setSelectedFit('ALL');
            }}
            style={{
              padding: '8px 14px',
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              border:
                selectedCategory === 'ALL' && selectedFit === 'ALL' && sortBy === 'featured'
                  ? '1px solid #09090b'
                  : '1px solid #d4d4d8',
              background:
                selectedCategory === 'ALL' && selectedFit === 'ALL' && sortBy === 'featured'
                  ? '#09090b'
                  : '#ffffff',
              color:
                selectedCategory === 'ALL' && selectedFit === 'ALL' && sortBy === 'featured'
                  ? '#ffffff'
                  : '#27272a',
              cursor: 'pointer',
              borderRadius: 0,
              whiteSpace: 'nowrap',
              boxShadow:
                selectedCategory === 'ALL' && selectedFit === 'ALL' && sortBy === 'featured'
                  ? '0 2px 8px rgba(0,0,0,0.12)'
                  : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            ALL SECTIONS ({allItems.length})
          </button>
          <Link
            href="/products/tops"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              border: '1px solid #d4d4d8',
              background: '#ffffff',
              color: '#27272a',
              textDecoration: 'none',
              borderRadius: 0,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#18181b';
              e.currentTarget.style.background = '#f4f4f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#d4d4d8';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            <span>TOPS ({topsItems.length})</span>
            <ChevronRight size={13} className="chevron-anim-right" style={{ opacity: 0.55 }} />
          </Link>
          <Link
            href="/products/bottoms"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              border: '1px solid #d4d4d8',
              background: '#ffffff',
              color: '#27272a',
              textDecoration: 'none',
              borderRadius: 0,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#18181b';
              e.currentTarget.style.background = '#f4f4f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#d4d4d8';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            <span>BOTTOMS ({bottomsItems.length})</span>
            <ChevronRight size={13} className="chevron-anim-right" style={{ opacity: 0.55 }} />
          </Link>
          <Link
            href="/products/accessories"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              border: '1px solid #d4d4d8',
              background: '#ffffff',
              color: '#27272a',
              textDecoration: 'none',
              borderRadius: 0,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#18181b';
              e.currentTarget.style.background = '#f4f4f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#d4d4d8';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            <span>ACCESSORIES ({accessoriesItems.length})</span>
            <ChevronRight size={13} className="chevron-anim-right" style={{ opacity: 0.55 }} />
          </Link>
        </div>
      </div>

      {/* ── Sort Bar ── */}
      <div className="shop-container-pad shop-sort-section">
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
                left: 0,
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

      {/* ── Product Grid: Section-Wise (Default) OR Filtered Grid ── */}
      <main className="shop-container-pad shop-main-section">
        {hasActiveFilters || sortBy !== 'featured' ? (
          filteredItems.length === 0 ? (
            <div style={{ padding: '80px 20px', textAlign: 'center', border: '1px solid #e5e5e5' }}>
              <p
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  margin: '0 0 6px',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                No products found
              </p>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: '#666',
                  margin: 0,
                  fontFamily: 'var(--font-body)',
                }}
              >
                Try clearing your active filters or sort selection.
              </p>
            </div>
          ) : (
            <div className="shop-grid">
              {filteredItems.map((item) => (
                <ShopCard key={item.id} item={item} />
              ))}
            </div>
          )
        ) : (
          /* Default Section-Wise View: TOPS, BOTTOMS, ACCESSORIES (10-12 items each + View All link) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
            {/* Section 1: TOPS */}
            <section>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '24px',
                  borderBottom: '2px solid #111111',
                  paddingBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <h2
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 'clamp(1.15rem, 2.5vw, 1.45rem)',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '-0.01em',
                      margin: 0,
                    }}
                  >
                    TOPS
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: '#666666', fontWeight: 600 }}>
                    ({topsItems.length} ITEMS)
                  </span>
                </div>
                <Link
                  href="/products/tops"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: BRAND_COLOR,
                    textDecoration: 'none',
                    letterSpacing: '0.04em',
                  }}
                >
                  <span>VIEW ALL TOPS ({topsItems.length})</span>
                  <ChevronRight size={14} className="chevron-anim-right" />
                </Link>
              </div>

              {topsItems.length === 0 ? (
                <div
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    border: '1px solid #ebebeb',
                    background: '#fafafa',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>No tops found.</p>
                </div>
              ) : (
                <div className="shop-grid">
                  {topsItems.slice(0, 12).map((item) => (
                    <ShopCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </section>

            {/* Section 2: BOTTOMS */}
            <section>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '24px',
                  borderBottom: '2px solid #111111',
                  paddingBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <h2
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 'clamp(1.15rem, 2.5vw, 1.45rem)',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '-0.01em',
                      margin: 0,
                    }}
                  >
                    BOTTOMS
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: '#666666', fontWeight: 600 }}>
                    ({bottomsItems.length} ITEMS)
                  </span>
                </div>
                <Link
                  href="/products/bottoms"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: BRAND_COLOR,
                    textDecoration: 'none',
                    letterSpacing: '0.04em',
                  }}
                >
                  <span>VIEW ALL BOTTOMS ({bottomsItems.length})</span>
                  <ChevronRight size={14} className="chevron-anim-right" />
                </Link>
              </div>

              {bottomsItems.length === 0 ? (
                <div
                  style={{
                    padding: '48px 24px',
                    textAlign: 'center',
                    border: '1px solid #e4e4e7',
                    background: '#fafafa',
                  }}
                >
                  <h3
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '1.0625rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                      margin: '0 0 6px',
                      color: '#09090b',
                    }}
                  >
                    NO BOTTOMS CURRENTLY AVAILABLE
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.85rem',
                      color: '#71717a',
                      margin: '0 auto 16px',
                      maxWidth: '440px',
                      lineHeight: 1.5,
                    }}
                  >
                    Performance shorts, trackpants & base layers engineered with precision.
                  </p>
                  <Link
                    href="/products/bottoms"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      color: BRAND_COLOR,
                      textDecoration: 'none',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <span>EXPLORE BOTTOMS COLLECTION</span>
                    <ChevronRight size={14} className="chevron-anim-right" />
                  </Link>
                </div>
              ) : (
                <div className="shop-grid">
                  {bottomsItems.slice(0, 12).map((item) => (
                    <ShopCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </section>

            {/* Section 3: ACCESSORIES */}
            <section>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '24px',
                  borderBottom: '2px solid #111111',
                  paddingBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <h2
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 'clamp(1.15rem, 2.5vw, 1.45rem)',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '-0.01em',
                      margin: 0,
                    }}
                  >
                    ACCESSORIES
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: '#666666', fontWeight: 600 }}>
                    ({accessoriesItems.length} ITEMS)
                  </span>
                </div>
                <Link
                  href="/products/accessories"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: BRAND_COLOR,
                    textDecoration: 'none',
                    letterSpacing: '0.04em',
                  }}
                >
                  <span>VIEW ALL ACCESSORIES ({accessoriesItems.length})</span>
                  <ChevronRight size={14} className="chevron-anim-right" />
                </Link>
              </div>

              {accessoriesItems.length === 0 ? (
                <div
                  style={{
                    padding: '48px 24px',
                    textAlign: 'center',
                    border: '1px solid #e4e4e7',
                    background: '#fafafa',
                  }}
                >
                  <h3
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '1.0625rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                      margin: '0 0 6px',
                      color: '#09090b',
                    }}
                  >
                    NO ACCESSORIES CURRENTLY AVAILABLE
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.85rem',
                      color: '#71717a',
                      margin: '0 auto 16px',
                      maxWidth: '440px',
                      lineHeight: 1.5,
                    }}
                  >
                    Wristbands, sweatbands & performance gear built for movement.
                  </p>
                  <Link
                    href="/products/accessories"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      color: BRAND_COLOR,
                      textDecoration: 'none',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <span>EXPLORE ACCESSORIES COLLECTION</span>
                    <ChevronRight size={14} className="chevron-anim-right" />
                  </Link>
                </div>
              ) : (
                <div className="shop-grid">
                  {accessoriesItems.slice(0, 12).map((item) => (
                    <ShopCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </section>
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
              <FaqItem
                key={item.q}
                q={item.q}
                a={item.a}
                link={item.link}
                isOpen={openFaqIndex === idx}
                onToggle={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Badges (Always in a single 3-column row) ── */}
      <TrustBadgesBar className="shop-container-pad" />
    </div>
  );
}
