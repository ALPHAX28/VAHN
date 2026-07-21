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
  const { addItem, updateItem, lines } = useCart();
  const [adding, setAdding] = useState(false);
  const [addedMessage, setAddedMessage] = useState('');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isFitOpen, setIsFitOpen] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [unit, setUnit] = useState<'cm' | 'in'>('cm');

  const sizeData = {
    cm: [
      { size: 'S', chest: '102 cm', length: '68 cm', sleeve: '22 cm' },
      { size: 'M', chest: '108 cm', length: '70 cm', sleeve: '23 cm' },
      { size: 'L', chest: '114 cm', length: '72 cm', sleeve: '24 cm' },
      { size: 'XL', chest: '120 cm', length: '74 cm', sleeve: '25 cm' },
    ],
    in: [
      { size: 'S', chest: '40.2 in', length: '26.8 in', sleeve: '8.7 in' },
      { size: 'M', chest: '42.5 in', length: '27.6 in', sleeve: '9.1 in' },
      { size: 'L', chest: '44.9 in', length: '28.3 in', sleeve: '9.4 in' },
      { size: 'XL', chest: '47.2 in', length: '29.1 in', sleeve: '9.8 in' },
    ]
  };

  const { detailsHtml, fitHtml } = (() => {
    const html = product.descriptionHtml || '';
    let listIndex = html.indexOf('<ul');
    if (listIndex === -1) {
      listIndex = html.indexOf('<ol');
    }
    if (listIndex === -1) {
      return { detailsHtml: html, fitHtml: '' };
    }
    const details = html.substring(0, listIndex).trim();
    const fit = html.substring(listIndex).trim();
    return { detailsHtml: details, fitHtml: fit };
  })();

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
  const cartItem = selectedVariant ? lines.find((l) => l.merchandise.id === selectedVariant.id) : undefined;

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                  <p className="variant-label" style={{ marginBottom: 0 }}>
                    {option.name}: <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{selectedOptions[option.name]}</span>
                  </p>
                  {option.name.toLowerCase() === 'size' && (
                    <button
                      onClick={() => setSizeGuideOpen(true)}
                      className="size-guide-trigger-btn"
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-black)',
                        fontFamily: 'var(--font-ui)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      Size Guide
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </button>
                  )}
                </div>
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
                            borderRadius: '0px',
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
        {cartItem ? (
          <div className="btn-qty-selector">
            <button
              onClick={() => updateItem(cartItem.id, cartItem.quantity - 1)}
              className="btn-qty-selector-btn"
              aria-label="Decrease quantity"
            >
              —
            </button>
            <span className="btn-qty-selector-value">
              {cartItem.quantity}
            </span>
            <button
              onClick={() => {
                if (selectedVariant?.quantityAvailable !== undefined && cartItem.quantity >= selectedVariant.quantityAvailable) {
                  return;
                }
                updateItem(cartItem.id, cartItem.quantity + 1);
              }}
              className={`btn-qty-selector-btn ${selectedVariant?.quantityAvailable !== undefined && cartItem.quantity >= selectedVariant.quantityAvailable ? 'disabled' : ''}`}
              disabled={selectedVariant?.quantityAvailable !== undefined && cartItem.quantity >= selectedVariant.quantityAvailable}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        ) : (
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
        )}
      </div>

      {/* Dedicated Fixed-Height Accordions Scroll Container */}
      {(detailsHtml || fitHtml) && (
        <div className="product-accordions-wrapper">
          {/* Details Accordion */}
          {detailsHtml && (
            <div 
              className="product-details-accordion" 
              style={{ 
                borderBottom: fitHtml ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <button
                onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  padding: '14px 0',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--color-black)',
                }}
                aria-expanded={isDetailsOpen}
              >
                <span>Details</span>
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: isDetailsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              
              {isDetailsOpen && (
                <div
                  className="product-description"
                  dangerouslySetInnerHTML={{ __html: detailsHtml }}
                  style={{
                    paddingBottom: '16px',
                    fontSize: '0.9375rem',
                    lineHeight: 1.6,
                  }}
                />
              )}
            </div>
          )}

          {/* Size & Fit Accordion */}
          {fitHtml && (
            <div className="product-details-accordion">
              <button
                onClick={() => setIsFitOpen(!isFitOpen)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  padding: '14px 0',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--color-black)',
                }}
                aria-expanded={isFitOpen}
              >
                <span>Size & Fit</span>
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: isFitOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              
              {isFitOpen && (
                <div
                  className="product-description"
                  dangerouslySetInnerHTML={{ __html: fitHtml }}
                  style={{
                    paddingBottom: '16px',
                    fontSize: '0.9375rem',
                    lineHeight: 1.6,
                  }}
                />
              )}
            </div>
          )}
        </div>
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

      {sizeGuideOpen && (
        <div className="size-guide-modal-overlay" onClick={() => setSizeGuideOpen(false)}>
          <div className="size-guide-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="size-guide-close-btn" onClick={() => setSizeGuideOpen(false)} aria-label="Close size guide">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            
            <h3 className="size-guide-title">Size Guide</h3>
            
            <div className="size-guide-unit-toggle">
              <button 
                type="button"
                className={`unit-toggle-btn ${unit === 'cm' ? 'active' : ''}`}
                onClick={() => setUnit('cm')}
              >
                Metric (CM)
              </button>
              <button 
                type="button"
                className={`unit-toggle-btn ${unit === 'in' ? 'active' : ''}`}
                onClick={() => setUnit('in')}
              >
                Imperial (IN)
              </button>
            </div>

            <div className="size-guide-body">
              {/* Left Column: Vector Graphic */}
              <div className="size-guide-graphic">
                <svg viewBox="0 0 200 240" className="size-guide-jersey-svg" width="100%" height="100%">
                  <path 
                    d="M 60 40 L 40 48 L 20 80 L 45 92 L 55 75 L 55 210 L 145 210 L 145 75 L 155 92 L 180 80 L 160 48 L 140 40 C 130 52 110 52 100 52 C 90 52 70 52 60 40 Z" 
                    fill="none" 
                    stroke="var(--color-black)" 
                    strokeWidth="2.5" 
                    strokeLinejoin="round" 
                  />
                  <path d="M 60 40 C 70 52 90 52 100 52 C 110 52 130 52 140 40" fill="none" stroke="var(--color-black)" strokeWidth="1.5" />
                  
                  {/* Chest line */}
                  <line x1="55" y1="120" x2="145" y2="120" stroke="var(--color-maroon)" strokeWidth="2" strokeDasharray="4,4" />
                  <path d="M 55 120 L 60 116 M 55 120 L 60 124 M 145 120 L 140 116 M 145 120 L 140 124" stroke="var(--color-maroon)" strokeWidth="1.5" />
                  <text x="100" y="112" textAnchor="middle" fill="var(--color-maroon)" fontSize="10" fontWeight="bold">A: CHEST</text>

                  {/* Length line */}
                  <line x1="100" y1="52" x2="100" y2="210" stroke="var(--color-maroon)" strokeWidth="2" strokeDasharray="4,4" />
                  <path d="M 100 52 L 96 57 M 100 52 L 104 57 M 100 210 L 96 205 M 100 210 L 104 205" stroke="var(--color-maroon)" strokeWidth="1.5" />
                  <text x="94" y="140" textAnchor="end" fill="var(--color-maroon)" fontSize="10" fontWeight="bold" transform="rotate(-90 94 140)">B: LENGTH</text>

                  {/* Sleeve line */}
                  <line x1="140" y1="40" x2="180" y2="80" stroke="var(--color-maroon)" strokeWidth="2" strokeDasharray="4,4" />
                  <path d="M 140 40 L 146 42 M 140 40 L 141 46 M 180 80 L 174 78 M 180 80 L 179 74" stroke="var(--color-maroon)" strokeWidth="1.5" />
                  <text x="150" y="55" fill="var(--color-maroon)" fontSize="9" fontWeight="bold">C: SLEEVE</text>
                </svg>
              </div>

              {/* Right Column: Table and Details */}
              <div className="size-guide-table-column">
                <table className="size-guide-table">
                  <thead>
                    <tr>
                      <th>Size</th>
                      <th>A: Chest</th>
                      <th>B: Length</th>
                      <th>C: Sleeve</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sizeData[unit].map((row) => (
                      <tr key={row.size}>
                        <td><strong>{row.size}</strong></td>
                        <td>{row.chest}</td>
                        <td>{row.length}</td>
                        <td>{row.sleeve}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="size-guide-help-text">
                  <p><strong>Measuring Tips:</strong></p>
                  <ul>
                    <li><strong>Chest:</strong> Measure around the fullest part of your chest, keeping the tape horizontal.</li>
                    <li><strong>Length:</strong> Measure from the highest point of the shoulder down to the hem.</li>
                    <li><strong>Sleeve:</strong> Measure from the neck collar point along the shoulder line down to the sleeve hem.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
