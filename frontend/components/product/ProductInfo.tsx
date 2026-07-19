'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product, ProductVariant } from '@/lib/api/types';
import { useCart, type AddItemDisplayData } from '@/context/CartContext';
import { formatMoney } from '@/lib/utils';

interface Props { product: Product; }

function getVariantFromOptions(
  variants: ProductVariant[],
  selectedOptions: Record<string, string>
): ProductVariant | undefined {
  return variants.find((v) =>
    v.selectedOptions.every((o) => selectedOptions[o.name] === o.value)
  );
}

export default function ProductInfo({ product }: Props) {
  const variants = product.variants.edges.map((e) => e.node);
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);
  const [addedMessage, setAddedMessage] = useState('');

  // Initialize selected options from first available variant
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    const opts: Record<string, string> = {};
    (variants[0]?.selectedOptions ?? []).forEach((o) => { opts[o.name] = o.value; });
    return opts;
  });

  const selectedVariant = getVariantFromOptions(variants, selectedOptions);
  const price = selectedVariant?.price ?? product.priceRange.minVariantPrice;
  const comparePrice = selectedVariant?.compareAtPrice;
  const isOnSale = comparePrice && parseFloat(comparePrice.amount) > parseFloat(price.amount);
  const available = selectedVariant?.availableForSale ?? false;

  const handleOptionSelect = useCallback(
    (optionName: string, value: string) => {
      setSelectedOptions((prev) => ({ ...prev, [optionName]: value }));
    },
    []
  );

  const isValueAvailable = (optionName: string, value: string) => {
    const testOptions = { ...selectedOptions, [optionName]: value };
    const variant = getVariantFromOptions(variants, testOptions);
    return variant?.availableForSale ?? false;
  };

  const handleAddToCart = () => {
    if (!selectedVariant || !available || adding) return;

    // Build full display data so the cart drawer shows real info instantly
    const displayData: AddItemDisplayData = {
      productTitle: product.title,
      productHandle: product.handle,
      variantTitle: selectedVariant.title !== 'Default Title' ? selectedVariant.title : product.title,
      price: selectedVariant.price,
      image: selectedVariant.image ?? product.featuredImage,
      selectedOptions: selectedVariant.selectedOptions,
    };

    setAdding(true);
    setAddedMessage('Added to Cart');
    // Fire-and-forget: addItem opens the drawer instantly with real data
    addItem(selectedVariant.id, 1, displayData);
    setTimeout(() => {
      setAdding(false);
      setAddedMessage('');
    }, 2000);
  };

  const reviewsList = product.reviews ?? [];
  const avgRating = reviewsList.length > 0 
    ? (reviewsList.reduce((sum, r) => sum + r.rating, 0) / reviewsList.length).toFixed(1) 
    : '5.0';
  const totalReviews = reviewsList.length;

  return (
    <div className="product-info">
      {/* Vendor */}
      <p className="product-vendor">{product.vendor}</p>

      {/* Title */}
      <h1 className="product-title-h1">{product.title}</h1>

      {/* Reviews Summary */}
      <div className="product-rating-summary" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
        <div className="rating-stars" style={{ display: 'flex', gap: '3px' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <svg
              key={star}
              viewBox="0 0 24 24"
              width="26"
              height="26"
              fill={star <= Math.round(parseFloat(avgRating)) ? '#1056d1' : '#e0e0e0'}
              style={{ display: 'inline-block' }}
            >
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
          ))}
        </div>
        <span style={{ fontWeight: 600, color: 'var(--color-black)' }}>{avgRating}</span>
        <span style={{ color: 'var(--color-grey-dark)' }}>|</span>
        <span style={{ color: 'var(--color-grey-dark)', textDecoration: 'underline' }}>{totalReviews} reviews</span>
      </div>

      {/* Price */}
      <div className="product-price-display">
        {isOnSale ? (
          <>
            <span className="product-price-sale">{formatMoney(price)}</span>
            <span className="product-price-compare">{formatMoney(comparePrice!)}</span>
          </>
        ) : (
          <span>{formatMoney(price)}</span>
        )}
      </div>

      {/* Variant Picker */}
      {product.options.length > 0 &&
        !(product.options.length === 1 && product.options[0].values.length === 1 && product.options[0].values[0] === 'Default Title') && (
          <div className="variant-picker">
            {product.options.map((option) => (
              <div key={option.id}>
                <p className="variant-label">
                  {option.name}: <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{selectedOptions[option.name]}</span>
                </p>
                <div className="variant-options" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {option.values.map((value) => {
                    const isAvail = isValueAvailable(option.name, value);
                    const isColour = option.name.toLowerCase() === 'colour' || option.name.toLowerCase() === 'color';
                    
                    // Find variant image for colour swatch
                    let colorImgUrl = '';
                    if (isColour) {
                      const variantForColor = variants.find((v) =>
                        v.selectedOptions.some((opt) => opt.name === option.name && opt.value === value)
                      );
                      colorImgUrl = variantForColor?.image?.url ?? '';
                    }

                    // Get quantity for this option value (only for non-colour options)
                    let qty: number | undefined;
                    if (!isColour) {
                      const variantForQty = variants.find((v) =>
                        v.selectedOptions.some((opt) => opt.name === option.name && opt.value === value)
                      );
                      qty = variantForQty?.quantityAvailable;
                    }
                    const isLowStock = !isColour && isAvail && qty !== undefined && qty > 0 && qty < 5;
                    const isOutOfStock = !isAvail;

                    return (
                      <div key={value} className={`size-option-wrap${isLowStock ? ' size-option-wrap--has-label' : ''}`}>
                        <button
                          className={`variant-option ${selectedOptions[option.name] === value ? 'active' : ''} ${isOutOfStock ? 'unavailable out-of-stock' : ''} ${isColour ? 'colour-swatch' : ''}`}
                          onClick={() => isAvail && handleOptionSelect(option.name, value)}
                          aria-pressed={selectedOptions[option.name] === value}
                          aria-label={`${option.name}: ${value}${isOutOfStock ? ' (unavailable)' : ''}`}
                          style={isColour && colorImgUrl ? {
                            padding: 0,
                            width: '48px',
                            height: '48px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: selectedOptions[option.name] === value ? '2px solid var(--color-black)' : '1px solid var(--color-border)',
                            cursor: 'pointer',
                            position: 'relative'
                          } : {}}
                        >
                          {isColour && colorImgUrl ? (
                            <Image
                              src={colorImgUrl}
                              alt={value}
                              fill
                              sizes="48px"
                              style={{ objectFit: 'cover' }}
                            />
                          ) : (
                            value
                          )}

                          {/* Out-of-stock X overlay */}
                          {isOutOfStock && !isColour && (
                            <span className="size-oos-overlay" aria-hidden="true">
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </span>
                          )}
                        </button>

                        {/* Low stock label */}
                        {isLowStock && (
                          <span className="size-low-stock-label">Only {qty} left</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Stock warning */}
      {available && selectedVariant && selectedVariant.quantityAvailable !== undefined && selectedVariant.quantityAvailable <= 3 && (
        <div className="stock-warning">
          <div className="stock-warning-text" style={{ fontSize: '0.875rem', color: '#D93939', fontWeight: 600 }}>
            Hurry, only {selectedVariant.quantityAvailable} item{selectedVariant.quantityAvailable > 1 ? 's' : ''} left in stock!
          </div>
          <div className="stock-warning-bar" style={{ width: '100%', height: '6px', background: '#F0F0F0', borderRadius: '3px', overflow: 'hidden', marginTop: '6px' }}>
            <div 
              className="stock-warning-progress" 
              style={{ 
                width: `${(selectedVariant.quantityAvailable / 3) * 100}%`, 
                height: '100%', 
                background: '#D93939',
                transition: 'width 0.3s ease'
              }} 
            />
          </div>
        </div>
      )}

      {/* Add to cart */}
      <div className="product-add-to-cart-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          className={`btn-add-to-cart ${!available || adding ? 'disabled' : ''}`}
          onClick={handleAddToCart}
          disabled={!available || adding}
          aria-label={available ? 'Add to cart' : 'Sold out'}
        >
          <span className="btn-add-to-cart-text">
            {adding ? (
              <span className="loading-spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white', width: '16px', height: '16px', display: 'inline-block' }} />
            ) : addedMessage ? (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: '4px' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {addedMessage}
              </>
            ) : available ? (
              'Add to Cart'
            ) : (
              'Sold Out'
            )}
          </span>
        </button>
      </div>

      {/* Description */}
      {product.descriptionHtml && (
        <div
          className="product-description"
          dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
        />
      )}

      {/* Tags */}
      {product.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-lg)' }}>
          {product.tags.map((tag) => (
            <Link
              key={tag}
              href={`/search?q=${encodeURIComponent(tag)}`}
              style={{
                fontSize: '0.75rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '4px 10px',
                border: '1px solid var(--color-border)',
                color: 'var(--color-grey-dark)',
              }}
            >
              {tag}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
