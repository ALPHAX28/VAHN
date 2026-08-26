'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product, ProductVariant } from '@/lib/api/types';
import { useCart } from '@/context/CartContext';

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
  variants: ProductVariant[];
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
          variants: pool,
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
            variants: pool,
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
          variants: allVariants,
        });
      }
    }
  });

  return items;
}

function LockerCard({
  item,
}: {
  item: ExpandedLockerItem;
}) {
  const { addItem } = useCart();
  const [imgIdx, setImgIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [addedVariantId, setAddedVariantId] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const images = item?.images || [];
  const hasMultipleImages = images.length > 1;
  const currentImg = images[imgIdx] ?? null;

  const activeImageUrl = currentImg?.url || null;
  const title = item?.title || 'VAHN SIGNATURE RELAXED FIT JERSEY';
  const tag = item?.tag || 'BESTSELLER';
  const price = item?.price || '2,000';
  const isFewLeft = item?.isFewLeft ?? false;
  const targetHref = item?.targetHref || '/products';

  const BRAND_COLOR = '#4232d9';

  // Extract distinct sizes from variants for this colorway
  const sizeVariants = useMemo(() => {
    const vars = item?.variants || [];
    return vars.map((v) => {
      const sizeOpt = v.selectedOptions?.find(
        (o) => o.name.toLowerCase() === 'size'
      );
      const sizeLabel = sizeOpt ? sizeOpt.value.trim() : v.title !== 'Default Title' ? v.title : 'ONE SIZE';
      const isAvailable = v.availableForSale && (v.quantityAvailable === undefined || v.quantityAvailable > 0);
      const isFew = isAvailable && typeof v.quantityAvailable === 'number' && v.quantityAvailable <= 5;
      return {
        variant: v,
        sizeLabel,
        isAvailable,
        isFew,
      };
    });
  }, [item]);

  // Handle Quick Add to Cart
  const handleAddToCart = (v: ProductVariant) => {
    if (!item) return;
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
          ? { url: currentImg.url, altText: currentImg.altText || item.title, width: 800, height: 800 }
          : null,
        selectedOptions: v.selectedOptions,
        quantityAvailable: v.quantityAvailable,
      },
      true // open drawer immediately!
    );

    setTimeout(() => {
      setAddedVariantId(null);
      setShowQuickAdd(false);
    }, 600);
  };

  // Close size picker on outside click
  useEffect(() => {
    if (!showQuickAdd) return;
    const handleOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowQuickAdd(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showQuickAdd]);

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
      ref={cardRef}
      className="locker-card-wrapper"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: 'clamp(280px, 75vw, 420px)',
        flex: '0 0 clamp(280px, 75vw, 420px)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* 1. Media Frame — Elongated portrait (4/5 ratio) with edge-to-edge cover */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4 / 5',
          background: '#f5f5f7',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Left Arrow Button — Pure VAHN Blue Arrow, regular weight */}
        {hasMultipleImages && (
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous view"
            className="locker-card-arrow"
            style={{
              position: 'absolute',
              left: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 15,
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
              transition: 'transform 0.2s ease, color 0.2s ease, opacity 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#3425b8';
              e.currentTarget.style.transform = 'translateY(-50%) scale(1.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = BRAND_COLOR;
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
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
                objectPosition: 'center',
                transition: 'transform 0.4s ease',
                transform: isHovered ? 'scale(1.02)' : 'scale(1)',
              }}
            />
          ) : (
            <Image
              src="/assets/product-card.png"
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, 420px"
              style={{
                objectFit: 'cover',
                objectPosition: 'center',
                transition: 'transform 0.4s ease',
                transform: isHovered ? 'scale(1.02)' : 'scale(1)',
              }}
            />
          )}
        </Link>

        {/* Right Arrow Button — Pure VAHN Blue Arrow, regular weight */}
        {hasMultipleImages && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next view"
            className="locker-card-arrow"
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 15,
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
              transition: 'transform 0.2s ease, color 0.2s ease, opacity 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#3425b8';
              e.currentTarget.style.transform = 'translateY(-50%) scale(1.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = BRAND_COLOR;
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* Image Pagination Dots if multiple photos exist */}
        {hasMultipleImages && (
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            {images.map((_, dotIdx) => (
              <span
                key={dotIdx}
                style={{
                  width: dotIdx === imgIdx ? '16px' : '5px',
                  height: '5px',
                  borderRadius: '3px',
                  background: dotIdx === imgIdx ? BRAND_COLOR : 'rgba(255, 255, 255, 0.7)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  transition: 'all 0.25s ease',
                }}
              />
            ))}
          </div>
        )}

        {/* Quick Size Selector Slide-up Overlay */}
        {showQuickAdd && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(12px)',
              borderTop: '1px solid rgba(0, 0, 0, 0.08)',
              padding: '14px 12px 12px',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.12)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                aria-label="Close size picker"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  color: '#888888',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Sizes Grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {sizeVariants.map(({ variant, sizeLabel, isAvailable }) => (
                <button
                  key={variant.id}
                  type="button"
                  disabled={!isAvailable || addedVariantId === variant.id}
                  onClick={() => {
                    if (isAvailable) {
                      handleAddToCart(variant);
                    }
                  }}
                  style={{
                    flex: sizeVariants.length === 1 ? '1 0 100%' : '1 0 calc(25% - 6px)',
                    minWidth: '40px',
                    height: '36px',
                    padding: '0 6px',
                    background: addedVariantId === variant.id ? BRAND_COLOR : isAvailable ? '#ffffff' : '#f5f5f7',
                    color: addedVariantId === variant.id ? '#ffffff' : isAvailable ? '#000000' : '#b0b0b5',
                    border: addedVariantId === variant.id
                      ? `1.5px solid ${BRAND_COLOR}`
                      : isAvailable
                      ? '1.5px solid #000000'
                      : '1px solid rgba(0,0,0,0.12)',
                    borderRadius: '2px',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    letterSpacing: '-0.025em',
                    cursor: isAvailable ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    textDecoration: isAvailable ? 'none' : 'line-through',
                    opacity: isAvailable ? 1 : 0.6,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (isAvailable && addedVariantId !== variant.id) {
                      e.currentTarget.style.backgroundColor = BRAND_COLOR;
                      e.currentTarget.style.borderColor = BRAND_COLOR;
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isAvailable && addedVariantId !== variant.id) {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.borderColor = '#000000';
                      e.currentTarget.style.color = '#000000';
                    }
                  }}
                >
                  {addedVariantId === variant.id ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    sizeLabel
                  )}
                </button>
              ))}
            </div>
          </div>
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
        {/* Left Side: Tag, Title, Price, Stock Info — All Regular (Non-Bold) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {/* Tag */}
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
            {tag}
          </span>

          {/* Title — Regular Weight */}
          <Link
            href={targetHref}
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
            {title}
          </Link>

          {/* Price — Regular Weight in VAHN Blue */}
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
            ₹ {price}
          </span>

          {/* Stock Notice — Only shown when quantity is low (≤ 5) */}
          {isFewLeft && (
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

        {/* Right Side: Quick Add Plus Button — Regular Weight in VAHN Blue */}
        <button
          type="button"
          onClick={() => {
            setShowQuickAdd((prev) => !prev);
          }}
          aria-label={showQuickAdd ? 'Close size picker' : `Select size for ${title}`}
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
            transition: 'transform 0.25s ease, color 0.2s ease, background-color 0.2s ease',
            transform: showQuickAdd ? 'rotate(45deg)' : isHovered ? 'scale(1.2)' : 'scale(1)',
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          >
            <line x1="12" y1="4" x2="12" y2="20" />
            <line x1="4" y1="12" x2="20" y2="12" />
          </svg>
        </button>
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

  // If no products exist, hide section completely
  if (!displayItems || displayItems.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        background: '#ffffff',
        padding: 'clamp(48px, 6vw, 80px) 0 clamp(48px, 6vw, 80px) clamp(20px, 6vw, 140px)',
      }}
    >
      <div style={{ maxWidth: '100%' }}>
        {/* Header Row: Title & Subtitle on Left, Carousel Navigation Arrows on Right for Desktop Mouse users */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: '28px',
            paddingRight: 'clamp(20px, 6vw, 80px)',
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 900,
                fontSize: 'clamp(1.25rem, 2.5vw, 1.875rem)',
                textTransform: 'uppercase',
                letterSpacing: '-0.025em',
                color: '#000000',
                margin: 0,
                marginBottom: '6px',
              }}
            >
              THE DROP IS HERE.
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontStyle: 'italic',
                fontSize: '0.9375rem',
                color: '#444444',
                margin: 0,
                letterSpacing: '-0.01em',
                lineHeight: 1.4,
              }}
            >
              Made to move. Built to last. Designed for those who don&apos;t switch off when the game does.
            </p>
          </div>

          {/* Mouse Navigation Controls: Only display if more than 3 items exist */}
          {displayItems.length > 3 && (
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
                    e.currentTarget.style.borderColor = '#4232d9';
                    e.currentTarget.style.color = '#4232d9';
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
                    e.currentTarget.style.borderColor = '#4232d9';
                    e.currentTarget.style.color = '#4232d9';
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
          )}
        </div>

        {/* Horizontal scrollable track */}
        <div
          ref={scrollContainerRef}
          style={{
            display: 'flex',
            gap: 'clamp(16px, 3.5vw, 36px)',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            paddingBottom: '8px',
            alignItems: 'flex-start',
          }}
        >
          {displayItems.map((item) => (
            <LockerCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
