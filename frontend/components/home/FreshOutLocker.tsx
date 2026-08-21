'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/api/types';

interface Props {
  products: Product[];
}

interface ExpandedLockerItem {
  id: string;
  product: Product;
  colourName: string;
  images: { url: string; altText?: string }[];
  price: string;
  isFewLeft: boolean;
  tag: string;
  title: string;
  targetHref: string;
}

function getExpandedLockerItems(products: Product[]): ExpandedLockerItem[] {
  const items: ExpandedLockerItem[] = [];

  products.forEach((product) => {
    const allVariants = (product.variants?.edges ?? []).map((e) => e.node);
    const tag =
      product.tags?.find((t) => !t.startsWith('_') && t.length < 15) ||
      product.vendor ||
      'BESTSELLER';

    // 1. Explicit Colour Groups configured on product
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
          if (variantImg) {
            cgImages.push({ url: variantImg, altText: `${product.title} - ${colourName}` });
          } else if (product.featuredImage?.url) {
            cgImages.push({ url: product.featuredImage.url, altText: product.title });
          }
        }

        const pool = colourVariants.length > 0 ? colourVariants : allVariants;
        const lowestVar = pool.reduce<(typeof pool)[0] | null>((acc, v) => {
          if (!acc) return v;
          return parseFloat(v.price.amount) < parseFloat(acc.price.amount) ? v : acc;
        }, null);

        const priceNum = lowestVar
          ? parseInt(lowestVar.price.amount, 10).toLocaleString('en-IN')
          : parseInt(product.priceRange?.minVariantPrice?.amount || '0', 10).toLocaleString('en-IN');

        const isFewLeft = pool.some(
          (v) =>
            v.availableForSale &&
            typeof v.quantityAvailable === 'number' &&
            v.quantityAvailable > 0 &&
            v.quantityAvailable <= 5
        );

        items.push({
          id: `${product.id}-${colourName.toLowerCase().replace(/\s+/g, '-')}`,
          product,
          colourName,
          images: cgImages,
          price: priceNum,
          isFewLeft,
          tag,
          title: product.title,
          targetHref: `/products/${product.handle}?colour=${encodeURIComponent(colourName)}`,
        });
      });
    } else {
      // 2. Extract unique colours from variants
      const variantColourSet = new Set<string>();
      allVariants.forEach((v) => {
        v.selectedOptions?.forEach((opt) => {
          if ((opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color') && opt.value.trim()) {
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
            if (v.image?.url && !colImages.some((img) => img.url === v.image?.url)) {
              colImages.push({ url: v.image.url, altText: `${product.title} - ${col}` });
            }
          });

          if (colImages.length === 0 && product.featuredImage?.url) {
            colImages.push({ url: product.featuredImage.url, altText: product.title });
          }

          const pool = colourVariants.length > 0 ? colourVariants : allVariants;
          const lowestVar = pool.reduce<(typeof pool)[0] | null>((acc, v) => {
            if (!acc) return v;
            return parseFloat(v.price.amount) < parseFloat(acc.price.amount) ? v : acc;
          }, null);

          const priceNum = lowestVar
            ? parseInt(lowestVar.price.amount, 10).toLocaleString('en-IN')
            : parseInt(product.priceRange?.minVariantPrice?.amount || '0', 10).toLocaleString('en-IN');

          const isFewLeft = pool.some(
            (v) =>
              v.availableForSale &&
              typeof v.quantityAvailable === 'number' &&
              v.quantityAvailable > 0 &&
              v.quantityAvailable <= 5
          );

          items.push({
            id: `${product.id}-${col.toLowerCase().replace(/\s+/g, '-')}`,
            product,
            colourName: col,
            images: colImages,
            price: priceNum,
            isFewLeft,
            tag,
            title: product.title,
            targetHref: `/products/${product.handle}?colour=${encodeURIComponent(col)}`,
          });
        });
      } else {
        // 3. Single product card fallback
        const prodImages = (product.images?.edges || []).map((e) => ({
          url: e.node.url,
          altText: e.node.altText || product.title,
        }));
        if (prodImages.length === 0 && product.featuredImage?.url) {
          prodImages.push({ url: product.featuredImage.url, altText: product.title });
        }

        const lowestVar = allVariants.reduce<(typeof allVariants)[0] | null>((acc, v) => {
          if (!acc) return v;
          return parseFloat(v.price.amount) < parseFloat(acc.price.amount) ? v : acc;
        }, null);

        const priceNum = lowestVar
          ? parseInt(lowestVar.price.amount, 10).toLocaleString('en-IN')
          : parseInt(product.priceRange?.minVariantPrice?.amount || '0', 10).toLocaleString('en-IN');

        const isFewLeft = allVariants.some(
          (v) =>
            v.availableForSale &&
            typeof v.quantityAvailable === 'number' &&
            v.quantityAvailable > 0 &&
            v.quantityAvailable <= 5
        );

        items.push({
          id: product.id,
          product,
          colourName: '',
          images: prodImages,
          price: priceNum,
          isFewLeft,
          tag,
          title: product.title,
          targetHref: `/products/${product.handle}`,
        });
      }
    }
  });

  return items;
}

function LockerCard({
  item,
  fallbackIndex,
}: {
  item?: ExpandedLockerItem;
  fallbackIndex: number;
}) {
  const [imgIdx, setImgIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const images = item?.images || [];
  const hasMultipleImages = images.length > 1;
  const currentImg = images[imgIdx] ?? null;

  const activeImageUrl = currentImg?.url || null;
  const title = item?.title || 'VAHN SIGNATURE RELAXED FIT JERSEY';
  const tag = item?.tag || 'BESTSELLER';
  const price = item?.price || '2,000';
  const isFewLeft = item?.isFewLeft ?? false;
  const targetHref = item?.targetHref || '/products';

  const BRAND_COLOR = '#3b379e';

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length > 1) {
      setImgIdx((i) => (i - 1 + images.length) % images.length);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length > 1) {
      setImgIdx((i) => (i + 1) % images.length);
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: 'clamp(300px, 26vw, 420px)',
        flex: '0 0 clamp(300px, 26vw, 420px)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* 1. Media Frame — Clean borderless container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          background: '#ffffff',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Left Arrow Button — Pure Blue Arrow, appears on hover */}
        {hasMultipleImages && (
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous view"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: `translateY(-50%) ${isHovered ? 'scale(1.1)' : 'scale(0.85)'}`,
              zIndex: 10,
              background: 'transparent',
              border: 'none',
              borderRadius: 0,
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: BRAND_COLOR,
              boxShadow: 'none',
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? 'auto' : 'none',
              transition: 'opacity 0.2s ease, transform 0.2s ease, color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#262272')}
            onMouseLeave={(e) => (e.currentTarget.style.color = BRAND_COLOR)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        {/* Product Image Link */}
        <Link
          href={targetHref}
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
              alt={currentImg?.altText || title}
              fill
              sizes="(max-width: 768px) 100vw, 420px"
              style={{
                objectFit: 'cover',
                transition: 'transform 0.4s ease',
                transform: isHovered ? 'scale(1.02)' : 'scale(1)',
              }}
            />
          ) : (
            <Image
              src="/assets/locker_jersey_only.png"
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, 420px"
              style={{
                objectFit: 'contain',
                transition: 'transform 0.4s ease',
                transform: isHovered ? 'scale(1.02)' : 'scale(1)',
              }}
            />
          )}
        </Link>

        {/* Right Arrow Button — Pure Blue Arrow, appears on hover */}
        {hasMultipleImages && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next view"
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: `translateY(-50%) ${isHovered ? 'scale(1.1)' : 'scale(0.85)'}`,
              zIndex: 10,
              background: 'transparent',
              border: 'none',
              borderRadius: 0,
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: BRAND_COLOR,
              boxShadow: 'none',
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? 'auto' : 'none',
              transition: 'opacity 0.2s ease, transform 0.2s ease, color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#262272')}
            onMouseLeave={(e) => (e.currentTarget.style.color = BRAND_COLOR)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>

      {/* 2. Product Meta Row below image */}
      <div
        style={{
          paddingTop: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        {/* Left Side: Tag, Title, Price, Stock Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {/* Tag */}
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '-0.025em',
              color: '#8e8e93',
            }}
          >
            {tag}
          </span>

          {/* Title */}
          <Link
            href={targetHref}
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.8125rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '-0.025em',
              color: '#000000',
              textDecoration: 'none',
              lineHeight: 1.3,
            }}
          >
            {title}
          </Link>

          {/* Price */}
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.875rem',
              fontWeight: 900,
              letterSpacing: '-0.025em',
              color: BRAND_COLOR,
              marginTop: '2px',
            }}
          >
            ₹ {price}
          </span>

          {/* Stock Notice — Only shown when quantity is low (≤ 5) */}
          {isFewLeft && (
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.625rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '-0.025em',
                color: '#a0a0b2',
                marginTop: '1px',
              }}
            >
              ONLY FEW LEFT
            </span>
          )}
        </div>

        {/* Right Side: Plus Button in brand purple/blue (Highlights on hover) */}
        <Link
          href={targetHref}
          aria-label={`View ${title}`}
          style={{
            color: isHovered ? '#262272' : BRAND_COLOR,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            textDecoration: 'none',
            transition: 'transform 0.2s ease, color 0.2s ease',
            transform: isHovered ? 'scale(1.25)' : 'scale(1)',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="12" y1="4" x2="12" y2="20" />
            <line x1="4" y1="12" x2="20" y2="12" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

export default function FreshOutLocker({ products }: Props) {
  const displayItems = useMemo(() => getExpandedLockerItems(products), [products]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll positions
  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [displayItems]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = Math.min(el.clientWidth * 0.75, 450);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section
      style={{
        background: '#ffffff',
        padding: 'clamp(48px, 6vw, 80px) 0 clamp(48px, 6vw, 80px) clamp(24px, 8vw, 140px)',
      }}
    >
      <div style={{ maxWidth: '1440px' }}>
        {/* Header Row: Title on Left, Carousel Navigation Arrows on Right for Desktop Mouse users */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '28px',
            paddingRight: 'clamp(24px, 6vw, 80px)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 900,
              fontSize: 'clamp(1.25rem, 2.5vw, 1.875rem)',
              textTransform: 'uppercase',
              letterSpacing: '-0.025em',
              color: '#000000',
              margin: 0,
            }}
          >
            FRESH OUT OF THE LOCKER
          </h2>

          {/* Mouse Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleScroll('left')}
              disabled={!canScrollLeft}
              aria-label="Scroll products left"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '1px solid rgba(0, 0, 0, 0.15)',
                background: canScrollLeft ? '#ffffff' : '#f5f5f7',
                color: canScrollLeft ? '#000000' : '#c4c4c8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: canScrollLeft ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                boxShadow: canScrollLeft ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (canScrollLeft) {
                  e.currentTarget.style.borderColor = '#3b379e';
                  e.currentTarget.style.color = '#3b379e';
                }
              }}
              onMouseLeave={(e) => {
                if (canScrollLeft) {
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
                  e.currentTarget.style.color = '#000000';
                }
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => handleScroll('right')}
              disabled={!canScrollRight}
              aria-label="Scroll products right"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '1px solid rgba(0, 0, 0, 0.15)',
                background: canScrollRight ? '#ffffff' : '#f5f5f7',
                color: canScrollRight ? '#000000' : '#c4c4c8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: canScrollRight ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                boxShadow: canScrollRight ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (canScrollRight) {
                  e.currentTarget.style.borderColor = '#3b379e';
                  e.currentTarget.style.color = '#3b379e';
                }
              }}
              onMouseLeave={(e) => {
                if (canScrollRight) {
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
                  e.currentTarget.style.color = '#000000';
                }
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Horizontal scrollable track */}
        <div
          ref={scrollContainerRef}
          style={{
            display: 'flex',
            gap: 'clamp(20px, 3.5vw, 36px)',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            paddingBottom: '8px',
            alignItems: 'flex-start',
          }}
        >
          {displayItems.length > 0 ? (
            displayItems.map((item, idx) => (
              <LockerCard key={item.id} item={item} fallbackIndex={idx} />
            ))
          ) : (
            <>
              <LockerCard fallbackIndex={0} />
              <LockerCard fallbackIndex={1} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
