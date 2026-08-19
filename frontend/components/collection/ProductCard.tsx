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
    <Link href={targetHref} className="product-card group" style={{ textDecoration: 'none', color: 'inherit' }}>
      {/* ── Media Frame ── */}
      <div
        className="product-card-media"
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          background: '#f4f4f5',
          overflow: 'hidden',
          borderRadius: 0,
        }}
      >
        {/* Badges */}
        {isAllOutOfStock ? (
          <span
            className="product-card-badge"
            style={{
              background: '#000000',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.6875rem',
              letterSpacing: '0.06em',
            }}
          >
            OUT OF STOCK
          </span>
        ) : isOnSale && highestDiscountPercent > 0 ? (
          <span
            className="product-card-badge"
            style={{
              background: '#d32f2f',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.6875rem',
              letterSpacing: '0.06em',
            }}
          >
            {highestDiscountPercent}% OFF
          </span>
        ) : null}

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
                transition: 'transform 0.4s ease, opacity 0.3s ease',
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
                  transition: 'opacity 0.4s ease, transform 0.4s ease',
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
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-grey-dark, #71717a)',
              fontSize: '0.8125rem',
            }}
          >
            No image
          </div>
        )}
      </div>

      {/* ── Info Metadata ── */}
      <div className="product-card-info" style={{ marginTop: '12px' }}>
        {/* Colourway Badge / Label */}
        {activeColour && (
          <p
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-grey-dark, #71717a)',
              marginBottom: '3px',
            }}
          >
            {activeColour}
          </p>
        )}

        <p className="product-card-title">{product.title}</p>

        <div className="product-card-price" style={{ marginTop: '4px' }}>
          {isAllOutOfStock ? (
            <span style={{ color: '#d32f2f', fontWeight: 700, fontSize: '0.8125rem', letterSpacing: '0.04em' }}>
              OUT OF STOCK
            </span>
          ) : isOnSale && displayComparePrice ? (
            <>
              <span className="sale">{formatMoney(displayPrice)}</span>
              <span className="compare">{formatMoney(displayComparePrice)}</span>
            </>
          ) : (
            <span>{formatMoney(displayPrice)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
