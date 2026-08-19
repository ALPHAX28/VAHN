import Link from 'next/link';
import Image from 'next/image';
import type { Product, Money, ColourGroup, Image as ShopifyImage } from '@/lib/api/types';
import { formatMoney } from '@/lib/utils';

interface Props {
  product: Product;
  colourGroup?: ColourGroup;
  customColour?: string;
  customHref?: string;
  customImage?: ShopifyImage;
}

export default function ProductCard({
  product,
  colourGroup,
  customColour,
  customHref,
  customImage,
}: Props) {
  const activeColour = colourGroup?.colourValue || customColour || '';

  // ── Image Resolution ──
  const primaryImage =
    colourGroup?.images?.[0] ??
    customImage ??
    product.featuredImage ??
    product.images.edges[0]?.node;

  const secondaryImage =
    colourGroup?.images?.[1] ??
    (product.images.edges.length > 1 ? product.images.edges[1].node : null);

  // ── Target URL (Deep Link with ?colour=) ──
  const targetHref =
    customHref ??
    (activeColour
      ? `/products/${product.handle}?colour=${encodeURIComponent(activeColour)}`
      : `/products/${product.handle}`);

  // ── Filter Variants for this specific colourway (if applicable) ──
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

  // ── Dynamic Price & Discount Calculation ──
  let displayPrice = product.priceRange.minVariantPrice;
  let displayComparePrice: Money | null = null;
  let highestDiscountPercent = 0;

  if (variants.length > 0) {
    let lowestPriceVar = variants[0];
    let maxDiscountPct = 0;
    let bestComparePrice: Money | null = null;

    for (const v of variants) {
      const p = parseFloat(v.price.amount);
      if (lowestPriceVar && p < parseFloat(lowestPriceVar.price.amount)) {
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

    displayPrice = lowestPriceVar?.price ?? product.priceRange.minVariantPrice;
    displayComparePrice = bestComparePrice ?? lowestPriceVar?.compareAtPrice ?? null;
    highestDiscountPercent = maxDiscountPct;
  } else {
    displayComparePrice = product.compareAtPriceRange?.minVariantPrice ?? null;
    if (displayComparePrice && parseFloat(displayComparePrice.amount) > parseFloat(displayPrice.amount)) {
      highestDiscountPercent = Math.round(
        ((parseFloat(displayComparePrice.amount) - parseFloat(displayPrice.amount)) / parseFloat(displayComparePrice.amount)) * 100
      );
    }
  }

  const isOnSale = Boolean(displayComparePrice && parseFloat(displayComparePrice.amount) > parseFloat(displayPrice.amount));
  const isAllOutOfStock =
    !product.availableForSale ||
    (variants.length > 0 &&
      variants.every(
        (v) => !v.availableForSale || (v.quantityAvailable !== undefined && v.quantityAvailable <= 0)
      ));

  return (
    <Link href={targetHref} className="product-card group">
      {/* Discount / Stock Badges */}
      {isAllOutOfStock ? (
        <span className="product-card-badge" style={{ background: '#d32f2f', color: '#ffffff', fontWeight: 800 }}>
          OUT OF STOCK
        </span>
      ) : isOnSale && highestDiscountPercent > 0 ? (
        <span className="product-card-badge" style={{ background: '#d32f2f', color: '#ffffff', fontWeight: 800 }}>
          {highestDiscountPercent}% OFF
        </span>
      ) : null}

      {/* Media Gallery with Smooth Hover Transition */}
      <div
        className="product-card-media"
        style={{
          aspectRatio: '1 / 1',
          position: 'relative',
          overflow: 'hidden',
          background: '#141416',
          borderRadius: 0,
        }}
      >
        {primaryImage ? (
          <>
            <Image
              src={primaryImage.url}
              alt={primaryImage.altText ?? `${product.title} ${activeColour}`}
              fill
              sizes="(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 25vw"
              style={{
                objectFit: 'cover',
                objectPosition: 'center',
                transition: 'opacity 0.4s ease, transform 0.5s ease',
              }}
              className={secondaryImage ? 'group-hover:opacity-0 group-hover:scale-105' : 'group-hover:scale-105'}
            />
            {secondaryImage && (
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
              background: '#1e1e24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#888',
              fontSize: '0.8125rem',
            }}
          >
            No image
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="product-card-info" style={{ marginTop: '12px' }}>
        {/* Colourway Label (if multi-colour) */}
        {activeColour && (
          <p
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-gold, #c5a059)',
              marginBottom: '4px',
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
