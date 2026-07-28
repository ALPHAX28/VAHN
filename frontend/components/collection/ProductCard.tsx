import Link from 'next/link';
import Image from 'next/image';
import type { Product, Money } from '@/lib/api/types';
import { formatMoney } from '@/lib/utils';

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const image = product.featuredImage ?? product.images.edges[0]?.node;

  // ── Dynamic Price & Discount Calculation across all variants ──
  const variants = (product.variants?.edges ?? []).map((e) => e.node);

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
  const isAllOutOfStock = !product.availableForSale || (variants.length > 0 && variants.every((v) => !v.availableForSale || (v.quantityAvailable !== undefined && v.quantityAvailable <= 0)));

  return (
    <Link href={`/products/${product.handle}`} className="product-card">
      {/* Badge */}
      {isAllOutOfStock ? (
        <span className="product-card-badge" style={{ background: '#d32f2f', color: '#ffffff', fontWeight: 800 }}>
          OUT OF STOCK
        </span>
      ) : isOnSale && highestDiscountPercent > 0 ? (
        <span className="product-card-badge" style={{ background: '#d32f2f', color: '#ffffff', fontWeight: 800 }}>
          {highestDiscountPercent}% OFF
        </span>
      ) : null}

      {/* Media */}
      <div className="product-card-media" style={{ aspectRatio: '4/5', position: 'relative', overflow: 'hidden', background: '#f5f5f5', borderRadius: '10px' }}>
        {image ? (
          <Image
            src={image.url}
            alt={image.altText ?? product.title}
            fill
            sizes="(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 25vw"
            style={{ objectFit: 'cover', objectPosition: 'center', transition: 'transform 0.4s ease' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--color-grey-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-grey-dark)',
              fontSize: '0.8125rem',
            }}
          >
            No image
          </div>
        )}
      </div>

      {/* Info */}
      <div className="product-card-info">
        <p className="product-card-title">{product.title}</p>
        <div className="product-card-price">
          {isAllOutOfStock ? (
            <span style={{ color: '#d32f2f', fontWeight: 700, fontSize: '0.8125rem', letterSpacing: '0.04em' }}>OUT OF STOCK</span>
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
