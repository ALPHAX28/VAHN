import Link from 'next/link';
import Image from 'next/image';
import type { Product, Money, ColourGroup, Image as ShopifyImage } from '@/lib/api/types';
import { formatMoney } from '@/lib/utils';

interface Props {
  product: Product;
  colourGroup?: ColourGroup;
  customColour?: string;
  customHref?: string;
  customPrimaryImage?: ShopifyImage | null;
  customSecondaryImage?: ShopifyImage | null;
  customPrice?: number;
  customComparePrice?: Money | null;
  customDiscountPercent?: number;
  customIsOutOfStock?: boolean;
}

export default function ProductCard({
  product,
  colourGroup,
  customColour,
  customHref,
  customPrimaryImage,
  customSecondaryImage,
  customPrice,
  customComparePrice,
  customDiscountPercent,
  customIsOutOfStock,
}: Props) {
  const activeColour = colourGroup?.colourValue || customColour || '';

  // ── Image Resolution ──
  const primaryImage =
    customPrimaryImage ??
    (colourGroup?.images?.[0]
      ? {
          url: colourGroup.images[0].url,
          altText: colourGroup.images[0].altText || `${product.title} ${activeColour}`,
          width: 800,
          height: 800,
        }
      : null) ??
    product.featuredImage ??
    product.images?.edges?.[0]?.node ??
    null;

  const secondaryImage =
    customSecondaryImage ??
    (colourGroup?.images && colourGroup.images.length > 1
      ? {
          url: colourGroup.images[1].url,
          altText: colourGroup.images[1].altText || `${product.title} ${activeColour}`,
          width: 800,
          height: 800,
        }
      : null) ??
    null;

  // ── Target URL (Deep Link with ?colour=) ──
  const targetHref =
    customHref ??
    (activeColour
      ? `/products/${product.handle}?colour=${encodeURIComponent(activeColour)}`
      : `/products/${product.handle}`);

  // ── Variant & Pricing Calculation ──
  const allVariants = (product.variants?.edges ?? []).map((e) => e.node);
  const colourFilteredVariants = activeColour
    ? allVariants.filter((v) =>
        v.selectedOptions.some(
          (opt) =>
            (opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color') &&
            opt.value.trim().toLowerCase() === activeColour.trim().toLowerCase()
        )
      )
    : allVariants;

  const variants = colourFilteredVariants.length > 0 ? colourFilteredVariants : allVariants;

  let displayPrice = product.priceRange?.minVariantPrice ?? { amount: '0', currencyCode: 'INR' };
  let displayComparePrice: Money | null = customComparePrice !== undefined ? customComparePrice : null;
  let highestDiscountPercent = customDiscountPercent !== undefined ? customDiscountPercent : 0;

  if (customPrice !== undefined) {
    displayPrice = {
      amount: customPrice.toFixed(2),
      currencyCode: product.priceRange?.minVariantPrice?.currencyCode || 'INR',
    };
  } else if (variants.length > 0) {
    let lowestPriceVar = variants[0];
    let maxDiscountPct = 0;
    let bestComparePrice: Money | null = null;

    for (const v of variants) {
      const p = parseFloat(v.price?.amount || '0');
      if (lowestPriceVar && p < parseFloat(lowestPriceVar.price?.amount || '0')) {
        lowestPriceVar = v;
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

    displayPrice = lowestPriceVar?.price ?? product.priceRange?.minVariantPrice ?? { amount: '0', currencyCode: 'INR' };
    displayComparePrice = bestComparePrice ?? lowestPriceVar?.compareAtPrice ?? null;
    highestDiscountPercent = maxDiscountPct;
  }

  const isOnSale = Boolean(
    displayComparePrice && parseFloat(displayComparePrice.amount) > parseFloat(displayPrice.amount)
  );

  const isAllOutOfStock =
    customIsOutOfStock !== undefined
      ? customIsOutOfStock
      : !product.availableForSale ||
        (variants.length > 0 &&
          variants.every(
            (v) => !v.availableForSale || (v.quantityAvailable !== undefined && v.quantityAvailable <= 0)
          ));

  return (
    <Link
      href={targetHref}
      className="vahn-luxury-card group"
      style={{
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        color: 'inherit',
        background: '#121216',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease, box-shadow 0.3s ease',
      }}
    >
      {/* ── Media Frame ── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          background: '#0c0c0e',
          overflow: 'hidden',
        }}
      >
        {/* Badges */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {isAllOutOfStock ? (
            <span
              style={{
                fontSize: '0.625rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: '#27272a',
                color: '#f4f4f5',
                padding: '4px 8px',
                borderRadius: '3px',
              }}
            >
              Sold Out
            </span>
          ) : isOnSale && highestDiscountPercent > 0 ? (
            <span
              style={{
                fontSize: '0.625rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: '#b91c1c',
                color: '#ffffff',
                padding: '4px 8px',
                borderRadius: '3px',
                boxShadow: '0 2px 8px rgba(185, 28, 28, 0.4)',
              }}
            >
              {highestDiscountPercent}% OFF
            </span>
          ) : null}
        </div>

        {/* Product Image */}
        {primaryImage && primaryImage.url ? (
          <>
            <Image
              src={primaryImage.url}
              alt={primaryImage.altText ?? `${product.title} ${activeColour}`}
              fill
              sizes="(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 25vw"
              style={{
                objectFit: 'cover',
                objectPosition: 'center',
                transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
              }}
              className={secondaryImage ? 'group-hover:opacity-0 group-hover:scale-105' : 'group-hover:scale-105'}
            />
            {secondaryImage && secondaryImage.url && (
              <Image
                src={secondaryImage.url}
                alt={secondaryImage.altText ?? `${product.title} ${activeColour}`}
                fill
                sizes="(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 25vw"
                style={{
                  objectFit: 'cover',
                  objectPosition: 'center',
                  transition: 'opacity 0.4s ease, transform 0.5s ease',
                }}
                className="opacity-0 group-hover:opacity-100 group-hover:scale-105 absolute inset-0"
              />
            )}
          </>
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#71717a',
              fontSize: '0.75rem',
              letterSpacing: '0.04em',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <span style={{ marginTop: 6 }}>No Image</span>
          </div>
        )}

        {/* Hover Quick Action Overlay */}
        <div
          className="card-hover-action"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '8px 12px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transform: 'translateY(100%)',
            transition: 'transform 0.25s ease',
          }}
        >
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ffffff' }}>
            View Product
          </span>
          <span style={{ color: 'var(--color-gold, #c5a059)', fontSize: '0.875rem' }}>→</span>
        </div>
      </div>

      {/* ── Info Metadata ── */}
      <div
        style={{
          padding: '14px 14px 16px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'space-between',
        }}
      >
        <div>
          {/* Top Row: Colour Tag & Category */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            {activeColour ? (
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--color-gold, #c5a059)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--color-gold, #c5a059)',
                    display: 'inline-block',
                  }}
                />
                {activeColour}
              </span>
            ) : product.productType ? (
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#71717a',
                }}
              >
                {product.productType}
              </span>
            ) : (
              <span />
            )}

            {product.fit && (
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#71717a',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '2px 6px',
                  borderRadius: '3px',
                }}
              >
                {product.fit}
              </span>
            )}
          </div>

          {/* Title */}
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              lineHeight: 1.35,
              margin: '0 0 8px',
              color: '#f4f4f5',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {product.title}
          </h3>
        </div>

        {/* Price Row */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 'auto' }}>
          {isAllOutOfStock ? (
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#71717a', letterSpacing: '0.04em' }}>
              Sold Out
            </span>
          ) : isOnSale && displayComparePrice ? (
            <>
              <span style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#ffffff' }}>
                {formatMoney(displayPrice)}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#71717a', textDecoration: 'line-through' }}>
                {formatMoney(displayComparePrice)}
              </span>
            </>
          ) : (
            <span style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#ffffff' }}>
              {formatMoney(displayPrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
