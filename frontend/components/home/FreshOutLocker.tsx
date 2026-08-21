'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/api/types';
import { formatMoney } from '@/lib/utils';

interface Props {
  products: Product[];
}

function LockerProductCard({ product }: { product: Product }) {
  const images = product.images?.edges?.map((e) => e.node) ?? [];
  const [imgIdx, setImgIdx] = useState(0);
  const activeImage = images[imgIdx] ?? product.featuredImage ?? null;

  const variants = product.variants?.edges?.map((e) => e.node) ?? [];
  const lowestVariant = variants.reduce<(typeof variants)[0] | null>((acc, v) => {
    if (!acc) return v;
    return parseFloat(v.price.amount) < parseFloat(acc.price.amount) ? v : acc;
  }, null);

  const displayPrice = lowestVariant?.price ?? product.priceRange?.minVariantPrice;
  const totalQty = variants.reduce((s, v) => s + (v.quantityAvailable ?? 0), 0);
  const isLowStock = totalQty > 0 && totalQty <= 10;

  const vendorLabel = product.vendor || 'VAHN';
  const collectionLabel = product.tags?.find((t) => t.startsWith('s:')) ?? vendorLabel;

  return (
    <div
      style={{
        flex: '0 0 320px',
        width: '320px',
        background: '#fff',
        borderRight: '1px solid #ebebeb',
      }}
    >
      {/* Image area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          background: '#f4f4f4',
          overflow: 'hidden',
        }}
      >
        {/* Prev Arrow */}
        {images.length > 1 && (
          <button
            onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
            aria-label="Previous image"
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 2,
              background: 'rgba(255,255,255,0.8)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            ‹
          </button>
        )}

        {/* Product Image */}
        {activeImage ? (
          <Image
            src={activeImage.url}
            alt={activeImage.altText || product.title}
            fill
            style={{ objectFit: 'cover' }}
          />
        ) : (
          /* Image placeholder */
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '8px',
              opacity: 0.3,
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            <span style={{ fontFamily: 'sans-serif', fontSize: '0.6875rem', color: '#333' }}>PRODUCT IMAGE</span>
          </div>
        )}

        {/* Next Arrow */}
        {images.length > 1 && (
          <button
            onClick={() => setImgIdx((i) => (i + 1) % images.length)}
            aria-label="Next image"
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 2,
              background: 'rgba(255,255,255,0.8)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            ›
          </button>
        )}

        {/* Quick-add "+" button */}
        <Link
          href={`/products/${product.handle}`}
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            width: '32px',
            height: '32px',
            background: '#000',
            color: '#fff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            fontWeight: 300,
            zIndex: 2,
            textDecoration: 'none',
          }}
          aria-label={`Add ${product.title} to cart`}
        >
          +
        </Link>
      </div>

      {/* Product info */}
      <div style={{ padding: '14px 16px 20px' }}>
        {/* Collection / vendor label */}
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#888',
            marginBottom: '4px',
          }}
        >
          {collectionLabel}
        </p>

        {/* Product name */}
        <Link
          href={`/products/${product.handle}`}
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.8125rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: '#000',
            textDecoration: 'none',
            display: 'block',
            marginBottom: '6px',
            lineHeight: 1.3,
          }}
        >
          {product.title}
        </Link>

        {/* Price */}
        {displayPrice && (
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: '#3a3699',
              marginBottom: '6px',
            }}
          >
            ₹{' '}
            {parseInt(displayPrice.amount, 10).toLocaleString('en-IN')}
          </p>
        )}

        {/* Low stock badge */}
        {isLowStock && (
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#e02424',
            }}
          >
            Only {totalQty} left
          </p>
        )}
      </div>
    </div>
  );
}

/* Placeholder card when no products */
function PlaceholderCard({ index }: { index: number }) {
  return (
    <div
      style={{
        flex: '0 0 320px',
        width: '320px',
        background: '#fff',
        borderRight: '1px solid #ebebeb',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          background: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {/* Placeholder arrows */}
        <span
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '1.5rem',
            color: '#bbb',
            cursor: 'default',
          }}
        >
          ‹
        </span>
        <div style={{ opacity: 0.3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          <span style={{ fontFamily: 'sans-serif', fontSize: '0.6875rem', color: '#333' }}>PRODUCT IMAGE</span>
        </div>
        <span
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '1.5rem',
            color: '#bbb',
            cursor: 'default',
          }}
        >
          ›
        </span>
        {/* + button */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            width: '32px',
            height: '32px',
            background: '#000',
            color: '#fff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            fontWeight: 300,
          }}
        >
          +
        </div>
      </div>
      {/* Info */}
      <div style={{ padding: '14px 16px 20px' }}>
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#888',
            marginBottom: '4px',
          }}
        >
          VAHN S{index + 5}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.8125rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: '#000',
            marginBottom: '6px',
            lineHeight: 1.3,
          }}
        >
          VAHN SIGNATURE RELAXED FIT JERSEY
        </p>
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.875rem',
            fontWeight: 700,
            color: '#3a3699',
            marginBottom: '6px',
          }}
        >
          ₹ 3,000
        </p>
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: '#e02424',
          }}
        >
          Only {5 - index} left
        </p>
      </div>
    </div>
  );
}

export default function FreshOutLocker({ products }: Props) {
  const [scrollPos, setScrollPos] = useState(0);

  const handleScroll = (dir: 'left' | 'right') => {
    const container = document.getElementById('locker-carousel');
    if (!container) return;
    const step = 336;
    const next = dir === 'right' ? container.scrollLeft + step : container.scrollLeft - step;
    container.scrollTo({ left: next, behavior: 'smooth' });
    setScrollPos(next);
  };

  const displayProducts = products.length > 0 ? products : [];
  const showPlaceholders = displayProducts.length === 0;

  return (
    <section
      style={{
        background: '#fff',
        padding: '60px 0 0',
        borderTop: '1px solid #ebebeb',
      }}
    >
      {/* Section heading */}
      <div style={{ padding: '0 40px 32px' }}>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 900,
            fontSize: 'clamp(1.25rem, 3vw, 2rem)',
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            color: '#000',
          }}
        >
          Fresh Out of the Locker
        </h2>
      </div>

      {/* Carousel wrapper */}
      <div style={{ position: 'relative' }}>
        {/* Scrollable track */}
        <div
          id="locker-carousel"
          style={{
            display: 'flex',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            borderTop: '1px solid #ebebeb',
          }}
        >
          {showPlaceholders
            ? [0, 1, 2, 3].map((i) => <PlaceholderCard key={i} index={i} />)
            : displayProducts.map((p) => <LockerProductCard key={p.id} product={p} />)}
        </div>

        {/* Prev / Next scroll buttons */}
        <div
          style={{
            display: 'flex',
            gap: '0',
            borderTop: '1px solid #ebebeb',
            borderBottom: '1px solid #ebebeb',
          }}
        >
          <button
            onClick={() => handleScroll('left')}
            style={{
              flex: 1,
              padding: '16px',
              background: '#fff',
              border: 'none',
              borderRight: '1px solid #ebebeb',
              cursor: 'pointer',
              fontFamily: 'var(--font-heading)',
              fontSize: '1rem',
              color: '#000',
            }}
            aria-label="Scroll left"
          >
            ‹
          </button>
          <button
            onClick={() => handleScroll('right')}
            style={{
              flex: 1,
              padding: '16px',
              background: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-heading)',
              fontSize: '1rem',
              color: '#000',
            }}
            aria-label="Scroll right"
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}
