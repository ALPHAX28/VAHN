import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/api/types';
import { formatMoney } from '@/lib/utils';

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const image = product.featuredImage ?? product.images.edges[0]?.node;
  const price = product.priceRange.minVariantPrice;
  const comparePrice = product.compareAtPriceRange?.minVariantPrice;
  const isOnSale =
    comparePrice && parseFloat(comparePrice.amount) > parseFloat(price.amount);

  return (
    <Link href={`/products/${product.handle}`} className="product-card">
      {/* Badge */}
      {isOnSale && <span className="product-card-badge">Sale</span>}
      {!product.availableForSale && (
        <span
          className="product-card-badge"
          style={{ background: 'var(--color-black)' }}
        >
          Sold Out
        </span>
      )}

      {/* Media */}
      <div className="product-card-media">
        {image ? (
          <Image
            src={image.url}
            alt={image.altText ?? product.title}
            width={0}
            height={0}
            sizes="(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 25vw"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              aspectRatio: '4/5',
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
          {isOnSale ? (
            <>
              <span className="sale">{formatMoney(price)}</span>
              <span className="compare">{formatMoney(comparePrice!)}</span>
            </>
          ) : (
            <span>{formatMoney(price)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
