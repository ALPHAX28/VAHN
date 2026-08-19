'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Product, ProductVariant, Money } from '@/lib/api/types';
import { useCart, type AddItemDisplayData } from '@/context/CartContext';
import { formatMoney } from '@/lib/utils';
import { createRestockSubscription } from '@/lib/api';
import { fetchPublicSizeGuide, type SizeGuideType } from '@/lib/api/sizeGuide';



interface Props {
  product: Product;
  initialColour?: string;
  // SCRUM-33: Optional callback to update parent gallery when colour changes
  onColourChange?: (colourValue: string) => void;
}

const STANDARD_SIZE_ORDER = [
  '3XS', '2XS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL', '6XL'
];

function sortSizeValues(sizeValues: string[]): string[] {
  return [...sizeValues].sort((a, b) => {
    const normA = a.trim().toUpperCase();
    const normB = b.trim().toUpperCase();

    const numA = parseFloat(normA);
    const numB = parseFloat(normB);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }

    const indexA = STANDARD_SIZE_ORDER.indexOf(normA);
    const indexB = STANDARD_SIZE_ORDER.indexOf(normB);

    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    return normA.localeCompare(normB);
  });
}

function getVariantFromOptions(
  variants: ProductVariant[],
  selectedOptions: Record<string, string>
): ProductVariant | undefined {
  const activeEntries = Object.entries(selectedOptions).filter(([_, v]) => Boolean(v && v.trim()));
  if (activeEntries.length === 0) return undefined;

  return variants.find((v) =>
    activeEntries.every(([optName, optValue]) =>
      v.selectedOptions.some(
        (o) =>
          o.name.trim().toLowerCase() === optName.trim().toLowerCase() &&
          o.value.trim().toLowerCase() === optValue.trim().toLowerCase()
      )
    )
  );
}


export default function ProductInfo({ product, initialColour, onColourChange }: Props) {
  const router = useRouter();
  const variants = product.variants.edges.map((e) => e.node);
  const { addItem, updateItem, closeCart, lines } = useCart();
  const [adding, setAdding] = useState(false);
  const [addedMessage, setAddedMessage] = useState('');
  const [buyingNow, setBuyingNow] = useState(false);

  const [isDescOpen, setIsDescOpen] = useState(true); // Open by default like PDF spec
  const [isFitOpen, setIsFitOpen] = useState(false);
  const [isCareOpen, setIsCareOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  // Dynamic size guide types fetched from the API
  const [sgTypes, setSgTypes] = useState<SizeGuideType[]>([]);
  const [sgActiveIdx, setSgActiveIdx] = useState(0);

  useEffect(() => {
    fetchPublicSizeGuide()
      .then((data) => {
        let filtered: SizeGuideType[] = [];
        if (product.sizeGuideTypeIds && product.sizeGuideTypeIds.length > 0) {
          const idsSet = new Set(product.sizeGuideTypeIds);
          filtered = data.filter((sg) => idsSet.has(sg.id));
        }
        setSgTypes(filtered);
        setSgActiveIdx(0);
      })
      .catch(() => { setSgTypes([]); });
  }, [product.sizeGuideTypeIds]);

  const { detailsHtml, fitHtml } = (() => {
    // Strip empty <p> and <p> tags that contain only whitespace
    const rawHtml = (product.descriptionHtml || '').replace(/<p>\s*<\/p>/gi, '').trim();
    let listIndex = rawHtml.indexOf('<ul');
    if (listIndex === -1) {
      listIndex = rawHtml.indexOf('<ol');
    }
    if (listIndex === -1) {
      return { detailsHtml: rawHtml, fitHtml: '' };
    }
    const details = rawHtml.substring(0, listIndex).trim();
    const fit = rawHtml.substring(listIndex).trim();
    return { detailsHtml: details, fitHtml: fit };
  })();

  // Resolve content for the 4 dynamic accordions
  const descriptionContent = (product.description || '').trim() || detailsHtml;
  const sizeFitContent = (product.sizeFitDetails || product.size_fit_details || '').trim() || fitHtml || (product.fit ? `Fit: ${product.fit}` : '');
  const careContent = (product.careInstructions || product.care_instructions || '').trim() || 'Machine wash cold delicate cycle inside out. Do not bleach. Tumble dry low. Cool iron if needed.';
  const detailsContent = (product.productDetails || product.product_details || '').trim() || (product.vendor ? `${product.vendor} ${product.productType || 'Apparel'}` : '');

  // Restock Notification Modal State
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [restockEmail, setRestockEmail] = useState('');
  const [restockSuccess, setRestockSuccess] = useState(false);
  const [restockSubmitting, setRestockSubmitting] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll when Size Guide or Restock Modal is open
  useEffect(() => {
    if (restockModalOpen || sizeGuideOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [restockModalOpen, sizeGuideOpen]);

  // Initialize selected options (Color pre-selected matching initialColour, Size unselected by default)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    const opts: Record<string, string> = {};
    (product.options ?? []).forEach((opt) => {
      const isSize = opt.name.toLowerCase() === 'size';
      const isColour = opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color';
      if (isColour && initialColour) {
        const match = opt.values.find((v) => v.trim().toLowerCase() === initialColour.trim().toLowerCase());
        opts[opt.name] = match || opt.values[0] || initialColour;
      } else if (!isSize && opt.values.length > 0) {
        opts[opt.name] = opt.values[0];
      } else {
        opts[opt.name] = ''; // Start unselected for size
      }
    });
    return opts;
  });

  // Sync state if initialColour prop updates
  useEffect(() => {
    if (initialColour) {
      setSelectedOptions((prev) => {
        const updated = { ...prev };
        let changed = false;
        (product.options ?? []).forEach((opt) => {
          const isColour = opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color';
          if (isColour) {
            const match = opt.values.find((v) => v.trim().toLowerCase() === initialColour.trim().toLowerCase());
            const target = match || initialColour;
            if (updated[opt.name] !== target) {
              updated[opt.name] = target;
              changed = true;
            }
          }
        });
        return changed ? updated : prev;
      });
      onColourChange?.(initialColour);
    }
  }, [initialColour, product.options, onColourChange]);

  const hasSizeOption = (product.options ?? []).some((o) => o.name.toLowerCase() === 'size');
  const selectedSizeValue = selectedOptions['Size'] || selectedOptions['size'] || '';
  const isSizeSelected = !hasSizeOption || Boolean(selectedSizeValue);

  const selectedVariant = isSizeSelected ? getVariantFromOptions(variants, selectedOptions) : undefined;
  
  // ── Dynamic Price Calculation ──
  const activeColour = selectedOptions['Colour'] || selectedOptions['Color'] || selectedOptions['colour'] || selectedOptions['color'] || '';
  const colourVariants = variants.filter(
    (v) => !activeColour || v.selectedOptions.some((opt) => (opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color') && opt.value.trim().toLowerCase() === activeColour.trim().toLowerCase())
  );
  const poolVariants = colourVariants.length > 0 ? colourVariants : variants;

  let price = selectedVariant?.price ?? product.priceRange.minVariantPrice;
  let comparePrice: Money | null = selectedVariant?.compareAtPrice ?? null;
  let discountPct = 0;

  if (isSizeSelected && selectedVariant) {
    price = selectedVariant.price;
    comparePrice = selectedVariant.compareAtPrice;
    if (comparePrice && parseFloat(comparePrice.amount) > parseFloat(price.amount)) {
      discountPct = Math.round(
        ((parseFloat(comparePrice.amount) - parseFloat(price.amount)) / parseFloat(comparePrice.amount)) * 100
      );
    }
  } else {
    // When NO size is selected: Find lowest price & highest discount among variants
    let lowestPriceVar = poolVariants[0];
    let highestDiscountPct = 0;
    let bestComparePrice: Money | null = null;

    for (const v of poolVariants) {
      const p = parseFloat(v.price.amount);
      if (lowestPriceVar && p < parseFloat(lowestPriceVar.price.amount)) {
        lowestPriceVar = v;
      }
      const c = v.compareAtPrice ? parseFloat(v.compareAtPrice.amount) : null;
      if (c && c > p) {
        const pct = Math.round(((c - p) / c) * 100);
        if (pct > highestDiscountPct) {
          highestDiscountPct = pct;
          bestComparePrice = v.compareAtPrice;
        }
      }
    }

    price = lowestPriceVar?.price ?? product.priceRange.minVariantPrice;
    comparePrice = bestComparePrice ?? lowestPriceVar?.compareAtPrice ?? null;
    discountPct = highestDiscountPct;

    if (!discountPct && comparePrice && parseFloat(comparePrice.amount) > parseFloat(price.amount)) {
      discountPct = Math.round(
        ((parseFloat(comparePrice.amount) - parseFloat(price.amount)) / parseFloat(comparePrice.amount)) * 100
      );
    }
  }

  const isOnSale = comparePrice && parseFloat(comparePrice.amount) > parseFloat(price.amount);
  
  // ── Out-of-Stock Check for Selected Colour & Variant ──
  // SCRUM-34/24: If the whole product is marked unavailable, treat as out of stock immediately
  const isColourOutOfStock = !product.availableForSale || (colourVariants.length > 0
    ? colourVariants.every((v) => !v.availableForSale || (v.quantityAvailable !== undefined && v.quantityAvailable <= 0))
    : !product.availableForSale);

  const isSelectedVariantOutOfStock = !product.availableForSale || (isSizeSelected
    ? (selectedVariant
        ? (!selectedVariant.availableForSale || (selectedVariant.quantityAvailable !== undefined && selectedVariant.quantityAvailable <= 0))
        : isColourOutOfStock)
    : isColourOutOfStock);

  const isCurrentSelectionOutOfStock = isSelectedVariantOutOfStock;
  const available = product.availableForSale && !isCurrentSelectionOutOfStock && isSizeSelected && Boolean(selectedVariant && selectedVariant.availableForSale);
  const cartItem = selectedVariant ? lines.find((l) => l.merchandise.id === selectedVariant.id) : undefined;

  // ── Sync Active Colour Gallery via Effect (SCRUM-33) ──
  useEffect(() => {
    if (activeColour && onColourChange) {
      onColourChange(activeColour);
    }
  }, [activeColour, onColourChange]);

  const handleOptionSelect = useCallback(
    (optionName: string, value: string) => {
      setSelectedOptions((prev) => {
        const next = { ...prev, [optionName]: value };
        const isColour = optionName.toLowerCase() === 'colour' || optionName.toLowerCase() === 'color';
        
        // If Colour changed, check if current selected Size is valid for new Colour
        if (isColour && prev['Size']) {
          const validSizesForNewColour = variants
            .filter((v) => v.selectedOptions.some((opt) => (opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color') && opt.value === value))
            .flatMap((v) => v.selectedOptions.filter((opt) => opt.name.toLowerCase() === 'size').map((opt) => opt.value));

          if (!validSizesForNewColour.includes(prev['Size'])) {
            next['Size'] = ''; // Reset size so user selects a valid size for the new colour
          }
        }

        return next;
      });
    },
    [variants]
  );

  const isValueAvailable = (optionName: string, value: string) => {
    if (!product.availableForSale) return false;

    const isColourOpt = optionName.toLowerCase() === 'colour' || optionName.toLowerCase() === 'color';
    const isSizeOpt = optionName.toLowerCase() === 'size';

    const relevantVariants = variants.filter((v) =>
      v.selectedOptions.some(
        (opt) => opt.name.toLowerCase() === optionName.toLowerCase() && opt.value.trim().toLowerCase() === value.trim().toLowerCase()
      )
    );
    if (relevantVariants.length === 0) return false;

    // For Colour swatches: a colour is available if ANY variant in that colour is available in stock!
    if (isColourOpt) {
      return relevantVariants.some(
        (v) => v.availableForSale && (v.quantityAvailable === undefined || v.quantityAvailable > 0)
      );
    }

    // For Size buttons: check availability of this size for the currently selected Colour
    const selectedColour = selectedOptions['Colour'] || selectedOptions['Color'] || selectedOptions['colour'] || selectedOptions['color'] || '';
    if (isSizeOpt && selectedColour) {
      const colourAndSizeVariants = relevantVariants.filter((v) =>
        v.selectedOptions.some(
          (opt) => (opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color') && opt.value.trim().toLowerCase() === selectedColour.trim().toLowerCase()
        )
      );
      if (colourAndSizeVariants.length > 0) {
        return colourAndSizeVariants.some(
          (v) => v.availableForSale && (v.quantityAvailable === undefined || v.quantityAvailable > 0)
        );
      }
    }

    return relevantVariants.some(
      (v) => v.availableForSale && (v.quantityAvailable === undefined || v.quantityAvailable > 0)
    );
  };

  const handleAddToCart = () => {
    if (!isSizeSelected) return;
    if (!selectedVariant || !available || adding) return;

    // Build full display data so the cart drawer shows real info instantly
    const displayData: AddItemDisplayData = {
      productTitle: product.title,
      productHandle: product.handle,
      variantTitle: selectedVariant.title !== 'Default Title' ? selectedVariant.title : product.title,
      price: selectedVariant.price,
      image: selectedVariant.image ?? product.featuredImage,
      selectedOptions: selectedVariant.selectedOptions,
      quantityAvailable: selectedVariant.quantityAvailable,
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

  const handleBuyNow = async () => {
    if (!isSizeSelected) return;
    if (!selectedVariant || !available || buyingNow) return;

    try {
      setBuyingNow(true);
      // If item is not in cart yet, add 1 quantity without opening drawer
      if (!cartItem || cartItem.quantity === 0) {
        const displayData: AddItemDisplayData = {
          productTitle: product.title,
          productHandle: product.handle,
          variantTitle: selectedVariant.title !== 'Default Title' ? selectedVariant.title : product.title,
          price: selectedVariant.price,
          image: selectedVariant.image ?? product.featuredImage,
          selectedOptions: selectedVariant.selectedOptions,
          quantityAvailable: selectedVariant.quantityAvailable,
        };
        await addItem(selectedVariant.id, 1, displayData, false);
      }
      closeCart();
      router.push('/checkout');
    } catch (err) {
      console.error('Error during buy now checkout:', err);
      closeCart();
      router.push('/checkout');
    } finally {
      setBuyingNow(false);
    }
  };

  const reviewsList = product.reviews ?? [];
  const avgRating = reviewsList.length > 0 
    ? (reviewsList.reduce((sum, r) => sum + r.rating, 0) / reviewsList.length).toFixed(1) 
    : '5.0';
  const totalReviews = reviewsList.length;

  // Guarantee option order: COLOUR first, SIZE second, then others
  const sortedOptions = [...(product.options ?? [])].sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const isAColor = aName === 'colour' || aName === 'color';
    const isBColor = bName === 'colour' || bName === 'color';
    const isASize = aName === 'size';
    const isBSize = bName === 'size';

    if (isAColor) return -1;
    if (isBColor) return 1;
    if (isASize) return -1;
    if (isBSize) return 1;
    return 0;
  });

  return (
    <div className="product-info" style={{ height: 'auto', maxHeight: 'none', overflow: 'visible', overflowY: 'visible' }}>
      {/* Vendor */}
      <p className="product-vendor">{product.vendor}</p>

      {/* Reviews Summary (Stars ABOVE Title) */}
      <div
        className="product-rating-summary"
        onClick={() => {
          const el = document.getElementById('product-reviews');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', cursor: 'pointer', margin: '4px 0 6px' }}
        title="Jump to Customer Reviews"
      >
        <div className="rating-stars" style={{ display: 'flex', gap: '3px' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <svg
              key={star}
              viewBox="0 0 24 24"
              width="20"
              height="20"
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

      {/* Title (h2) */}
      <h2 className="product-title-h2">{product.title}</h2>

      {/* Price & Discount */}
      <div className="product-price-display" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', gap: '2px', margin: '4px 0 10px', width: '100%' }}>
        {isCurrentSelectionOutOfStock ? (
          <span
            style={{
              background: '#d32f2f',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 800,
              padding: '5px 12px',
              borderRadius: 0,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              display: 'inline-block',
              width: 'fit-content',
              lineHeight: 1
            }}
          >
            SOLD OUT
          </span>
        ) : (
          <>
            <span className="price-sale" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#000000', letterSpacing: '-0.01em', lineHeight: 1 }}>
              {formatMoney(price)}
            </span>
            {isOnSale && comparePrice && (
              <span className="price-compare" style={{ fontSize: '0.72rem', color: '#888888', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.2 }}>
                <span style={{ textDecoration: 'line-through' }}>{formatMoney(comparePrice)}</span> ORIGINAL PRICE {discountPct > 0 ? `-${discountPct}%` : ''}
              </span>
            )}
          </>
        )}
      </div>

      {/* Variant Picker */}
      {sortedOptions.length > 0 &&
        !(sortedOptions.length === 1 && sortedOptions[0].values.length === 1 && sortedOptions[0].values[0] === 'Default Title') && (
          <div className="variant-picker">
            {sortedOptions.map((option) => {
              const isColour = option.name.toLowerCase() === 'colour' || option.name.toLowerCase() === 'color';

              // Only show sizes that exist for the selected Colour
              const displayValues = (() => {
                if (isColour) {
                  return option.values;
                }
                const selectedColour = selectedOptions['Colour'] || selectedOptions['Color'] || selectedOptions['colour'] || selectedOptions['color'];
                if (selectedColour) {
                  const matchingVariants = variants.filter((v) =>
                    v.selectedOptions.some(
                      (opt) => (opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color') && opt.value.trim().toLowerCase() === selectedColour.trim().toLowerCase()
                    )
                  );
                  const validOptionValues = new Set<string>();
                  matchingVariants.forEach((v) => {
                    v.selectedOptions.forEach((opt) => {
                      if (opt.name.toLowerCase() === option.name.toLowerCase()) {
                        validOptionValues.add(opt.value);
                      }
                    });
                  });
                  if (validOptionValues.size > 0) {
                    return sortSizeValues(Array.from(validOptionValues));
                  }
                }
                return sortSizeValues(option.values);
              })();


              // Inline stock info for size option (shown when size selected and ≤5 remaining)
              const sizeStockLabel = (() => {
                if (!isColour && selectedOptions[option.name]) {
                  const v = getVariantFromOptions(variants, selectedOptions);
                  if (v && v.availableForSale && v.quantityAvailable !== undefined && v.quantityAvailable > 0 && v.quantityAvailable <= 5) {
                    return `ONLY ${v.quantityAvailable} LEFT IN STOCK`;
                  }
                }
                return '';
              })();

              return (
                <div
                  key={option.id}
                  style={{
                    padding: 0,
                    borderBottom: 'none',
                  }}
                >
                  {/* Option label row */}
                  <p className="variant-label" style={{ marginBottom: '6px' }}>
                    {option.name}:{' '}
                    <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                      {selectedOptions[option.name] || (option.name.toLowerCase() === 'size' ? 'Select Size' : '')}
                    </span>
                    {sizeStockLabel && (
                      <span style={{ fontWeight: 700, color: '#c62828', marginLeft: '10px', fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {sizeStockLabel}
                      </span>
                    )}
                  </p>

                  {/* Option buttons */}
                  <div
                    className="variant-options"
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: isColour ? '8px' : '4px',
                      width: '100%',
                    }}
                  >
                    {displayValues.map((value) => {
                      const isAvail = isValueAvailable(option.name, value);

                      // Find colour group image or variant image for colour swatch
                      let colorImgUrl = '';
                      if (isColour) {
                        const colourGroup = product.colourGroups?.find(
                          (cg) => cg.colourValue.trim().toLowerCase() === value.trim().toLowerCase()
                        );
                        const groupImgUrl = colourGroup?.images?.[0]?.url;
                        const variantForColor = variants.find((v) =>
                          v.selectedOptions.some((opt) => (opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color') && opt.value.trim().toLowerCase() === value.trim().toLowerCase()) && v.image?.url
                        );
                        colorImgUrl = groupImgUrl ?? variantForColor?.image?.url ?? product.featuredImage?.url ?? '';
                      }

                      const isOutOfStock = !isAvail;
                      const isSelected = selectedOptions[option.name] === value;

                      return (
                        <div key={value} className="size-option-wrap" style={{ flex: 'none' }}>
                          <button
                            type="button"
                            className={`variant-option ${isSelected ? 'active' : ''} ${isOutOfStock ? 'unavailable out-of-stock' : ''} ${isColour ? 'colour-swatch' : 'size-btn'}`}
                            onClick={() => handleOptionSelect(option.name, value)}
                            aria-pressed={isSelected}
                            aria-label={`${option.name}: ${value}${isOutOfStock ? ' (unavailable)' : ''}`}
                            style={
                              isColour && colorImgUrl
                                ? {
                                    padding: 0,
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '0px',
                                    overflow: 'hidden',
                                    border: isSelected ? '2px solid #000000' : '1px solid var(--color-border)',
                                    cursor: 'pointer',
                                    position: 'relative',
                                  }
                                : !isColour
                                ? {
                                    width: '100px',
                                    height: '42px',
                                    background: isSelected ? '#000000' : '#ebedf0',
                                    color: isSelected ? '#ffffff' : '#333333',
                                    border: 'none',
                                    borderRadius: '0px',
                                    fontWeight: 600,
                                    fontSize: '0.8125rem',
                                    cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    letterSpacing: '0.04em',
                                    padding: 0,
                                    position: 'relative',
                                    opacity: isOutOfStock ? 0.45 : 1,
                                  }
                                : {}
                            }
                          >
                            {isColour && colorImgUrl ? (
                              <Image
                                src={colorImgUrl}
                                alt={value}
                                fill
                                sizes="64px"
                                style={{ objectFit: 'cover' }}
                              />
                            ) : (
                              value
                            )}

                            {/* Out-of-stock overlay for colour swatches */}
                            {isOutOfStock && isColour && (
                              <span className="colour-oos-overlay" aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#d32f2f" strokeWidth="2.5" strokeLinecap="round">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </span>
                            )}

                            {/* Out-of-stock diagonal line for size buttons */}
                            {isOutOfStock && !isColour && (
                              <span className="size-oos-overlay" aria-hidden="true">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>


                  {/* SIZE GUIDE link — below size buttons, maroon underlined */}
                  {option.name.toLowerCase() === 'size' && sgTypes.length > 0 && (
                    <button

                      onClick={() => setSizeGuideOpen(true)}
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-black)',
                        fontFamily: 'var(--font-ui)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        padding: 0,
                        marginTop: '6px',
                        display: 'block',
                      }}
                    >
                      SIZE GUIDE
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

      {/* Out of Stock warning (Only when size is explicitly selected and variant is out of stock) */}
      {isSizeSelected && (!available || (selectedVariant && selectedVariant.quantityAvailable === 0)) && (
        <div className="stock-warning" style={{ color: '#c62828', fontWeight: 700, fontSize: '0.85rem', margin: '14px 0 8px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(229, 57, 53, 0.08)', border: '1px solid rgba(229, 57, 53, 0.2)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          Out of Stock: Size {selectedSizeValue} is currently out of stock.
        </div>
      )}



      {/* Add to cart / Restock alert / Buy now buttons */}
      <div className="product-add-to-cart-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {isCurrentSelectionOutOfStock ? (
          <button
            type="button"
            onClick={() => setRestockModalOpen(true)}
            style={{
              width: '100%',
              padding: '1.15rem 2rem',
              background: '#000000',
              color: '#ffffff',
              border: '2px solid #000000',
              borderRadius: '0px',
              fontWeight: 800,
              fontSize: '0.875rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'background 0.2s ease, opacity 0.2s ease'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span style={{ color: '#ffffff', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.875rem' }}>
              Notify Me When Restocked
            </span>
          </button>
        ) : (
          <>
            {/* Primary Action: Add to Cart (or Qty Selector if in cart) */}
            {cartItem && cartItem.quantity > 0 ? (
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
                className={`btn-add-to-cart ${!isSizeSelected || !available || adding ? 'disabled' : ''}`}
                onClick={handleAddToCart}
                disabled={!isSizeSelected || !available || adding}
                aria-label={!isSizeSelected ? 'Select a size' : available ? 'Add to cart' : 'Sold out'}
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
                  ) : !isSizeSelected ? (
                    isColourOutOfStock ? 'OUT OF STOCK' : 'Select a Size'
                  ) : available ? (
                    'Add to Cart'
                  ) : (
                    'OUT OF STOCK'
                  )}
                </span>
              </button>
            )}

            {/* Secondary Action: Buy Now / Proceed to Checkout button */}
            <button
              type="button"
              className={`btn-buy-it-now ${!isSizeSelected || !available || buyingNow ? 'disabled' : ''}`}
              onClick={handleBuyNow}
              disabled={!isSizeSelected || !available || buyingNow}
              aria-label={cartItem && cartItem.quantity > 0 ? 'Proceed to Checkout' : 'Buy Now'}
            >
              <span className="btn-buy-it-now-text">
                {buyingNow ? (
                  <span className="loading-spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white', width: '16px', height: '16px', display: 'inline-block' }} />
                ) : cartItem && cartItem.quantity > 0 ? (
                  <>
                    <span>Proceed to Checkout</span>
                    <svg className="btn-checkout-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                ) : (
                  <>
                    <span>Buy Now</span>
                    <svg className="btn-checkout-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </span>
            </button>
          </>
        )}
      </div>

      {/* Dynamic 4-Field Product Accordions (Description, Size and fit, Care, Details) */}
      <div className="product-accordions-wrapper" style={{ marginTop: '24px' }}>
        {[
          {
            id: 'description',
            title: 'Description',
            content: descriptionContent,
            isOpen: isDescOpen,
            toggle: () => setIsDescOpen(!isDescOpen),
          },
          {
            id: 'fit',
            title: 'Size and fit',
            content: sizeFitContent,
            isOpen: isFitOpen,
            toggle: () => setIsFitOpen(!isFitOpen),
          },
          {
            id: 'care',
            title: 'Care',
            content: careContent,
            isOpen: isCareOpen,
            toggle: () => setIsCareOpen(!isCareOpen),
          },
          {
            id: 'details',
            title: 'Details',
            content: detailsContent,
            isOpen: isDetailsOpen,
            toggle: () => setIsDetailsOpen(!isDetailsOpen),
          },
        ].map((acc) => {
          if (!acc.content || !acc.content.trim()) return null;
          const isHtml = acc.content.includes('<') && acc.content.includes('>');

          return (
            <div
              key={acc.id}
              className="product-details-accordion"
              style={{
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <button
                type="button"
                onClick={acc.toggle}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  padding: '16px 0',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--color-black)',
                }}
                aria-expanded={acc.isOpen}
              >
                <span>{acc.title}</span>
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
                    transform: acc.isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {acc.isOpen && (
                <div
                  className="product-description"
                  style={{
                    paddingBottom: '16px',
                    fontSize: '0.9375rem',
                    lineHeight: 1.6,
                    color: 'var(--color-black)',
                    whiteSpace: isHtml ? 'normal' : 'pre-line',
                  }}
                >
                  {isHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: acc.content }} />
                  ) : (
                    <span>{acc.content}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>


      {/* Tags */}
      {product.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
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

      {mounted && sizeGuideOpen && createPortal(
        <div className="size-guide-modal-overlay" onClick={() => setSizeGuideOpen(false)}>
          <div className="size-guide-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="size-guide-close-btn" onClick={() => setSizeGuideOpen(false)} aria-label="Close size guide">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <h3 className="size-guide-title">Size Guide</h3>

            {/* Dynamic tabs — one per measurement type */}
            {sgTypes.length > 1 && (
              <div className="size-guide-unit-toggle">
                {sgTypes.map((sg, i) => (
                  <button
                    key={sg.id}
                    type="button"
                    className={`unit-toggle-btn ${sgActiveIdx === i ? 'active' : ''}`}
                    onClick={() => setSgActiveIdx(i)}
                  >
                    {sg.name}
                  </button>
                ))}
              </div>
            )}

            {sgTypes.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#888' }}>
                Size guide data is not configured yet.
              </div>
            ) : (() => {
              const sg = sgTypes[sgActiveIdx] ?? sgTypes[0];
              return (
                <div className="size-guide-body">
                  {/* Left Column: Uploaded image or fallback SVG */}
                  <div className="size-guide-graphic">
                    {sg.diagram_image_url ? (
                      <Image
                        src={sg.diagram_image_url}
                        alt={`${sg.name} diagram`}
                        width={280}
                        height={280}
                        style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                      />
                    ) : (
                      <svg viewBox="0 0 200 240" className="size-guide-jersey-svg" width="100%" height="100%">
                        <path
                          d="M 60 40 L 40 48 L 20 80 L 45 92 L 55 75 L 55 210 L 145 210 L 145 75 L 155 92 L 180 80 L 160 48 L 140 40 C 130 52 110 52 100 52 C 90 52 70 52 60 40 Z"
                          fill="none" stroke="var(--color-black)" strokeWidth="2.5" strokeLinejoin="round"
                        />
                        <path d="M 60 40 C 70 52 90 52 100 52 C 110 52 130 52 140 40" fill="none" stroke="var(--color-black)" strokeWidth="1.5" />
                        <line x1="55" y1="120" x2="145" y2="120" stroke="var(--color-maroon)" strokeWidth="2" strokeDasharray="4,4" />
                        <path d="M 55 120 L 60 116 M 55 120 L 60 124 M 145 120 L 140 116 M 145 120 L 140 124" stroke="var(--color-maroon)" strokeWidth="1.5" />
                        <text x="100" y="112" textAnchor="middle" fill="var(--color-maroon)" fontSize="10" fontWeight="bold">A: CHEST</text>
                        <line x1="100" y1="52" x2="100" y2="210" stroke="var(--color-maroon)" strokeWidth="2" strokeDasharray="4,4" />
                        <path d="M 100 52 L 96 57 M 100 52 L 104 57 M 100 210 L 96 205 M 100 210 L 104 205" stroke="var(--color-maroon)" strokeWidth="1.5" />
                        <text x="94" y="140" textAnchor="end" fill="var(--color-maroon)" fontSize="10" fontWeight="bold" transform="rotate(-90 94 140)">B: LENGTH</text>
                        <line x1="140" y1="40" x2="180" y2="80" stroke="var(--color-maroon)" strokeWidth="2" strokeDasharray="4,4" />
                        <path d="M 140 40 L 146 42 M 140 40 L 141 46 M 180 80 L 174 78 M 180 80 L 179 74" stroke="var(--color-maroon)" strokeWidth="1.5" />
                        <text x="150" y="55" fill="var(--color-maroon)" fontSize="9" fontWeight="bold">C: SLEEVE</text>
                      </svg>
                    )}
                  </div>

                  {/* Right Column: Dynamic Table + Tips */}
                  <div className="size-guide-table-column">
                    {sg.columns.length > 0 && sg.rows.length > 0 ? (
                      <table className="size-guide-table">
                        <thead>
                          <tr>
                            {sg.columns.map((col) => (
                              <th key={col}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sg.rows.map((row, ri) => (
                            <tr key={ri}>
                              {sg.columns.map((col, ci) => (
                                <td key={col}>
                                  {ci === 0 ? <strong>{row[col] ?? ''}</strong> : row[col] ?? ''}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ color: '#888', fontSize: '0.875rem' }}>No table data configured.</p>
                    )}

                    {sg.measuring_tips.length > 0 && (
                      <div className="size-guide-help-text">
                        <p><strong>Measuring Tips:</strong></p>
                        <ul>
                          {sg.measuring_tips.map((tip, ti) => (
                            <li key={ti}><strong>{tip.title}:</strong> {tip.description}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}


      {/* Restock Notification Modal */}
      {mounted && restockModalOpen && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => { setRestockModalOpen(false); setRestockSuccess(false); }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 0,
              maxWidth: '440px',
              width: '100%',
              padding: '28px 24px',
              position: 'relative',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              border: '2px solid var(--color-black)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => { setRestockModalOpen(false); setRestockSuccess(false); }}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                fontSize: '1.2rem',
                cursor: 'pointer',
                color: 'var(--color-black)',
                padding: '4px',
                lineHeight: 1,
                fontWeight: 700
              }}
              aria-label="Close modal"
            >
              ✕
            </button>

            {restockSuccess ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: 0, background: 'var(--color-black)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '1.4rem', fontWeight: 'bold' }}>
                  ✓
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', color: 'var(--color-black)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>You&apos;re on the list!</h3>
                <p style={{ fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.5, marginBottom: '20px' }}>
                  We will send an instant email notification to <strong style={{ color: 'var(--color-black)' }}>{restockEmail}</strong> as soon as <strong style={{ color: 'var(--color-black)' }}>{product.title}</strong> {activeColour ? `(${activeColour})` : ''} is back in stock.
                </p>
                <button
                  type="button"
                  onClick={() => { setRestockModalOpen(false); setRestockSuccess(false); setRestockEmail(''); }}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: 'var(--color-black)',
                    color: 'var(--color-white)',
                    border: 'none',
                    borderRadius: 0,
                    fontWeight: 800,
                    fontSize: '0.875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!restockEmail.trim()) return;
                  setRestockSubmitting(true);
                  try {
                    const numericId = parseInt(product.id.replace(/\D/g, '')) || 1;
                    await createRestockSubscription({
                      email: restockEmail.trim(),
                      product_id: numericId,
                      product_title: product.title,
                      product_handle: product.handle,
                      colour_value: activeColour || undefined,
                      variant_id: selectedVariant?.id || undefined,
                    });
                    setRestockSuccess(true);
                  } catch (err) {
                    console.error('Restock subscription error:', err);
                    setRestockSuccess(true);
                  } finally {
                    setRestockSubmitting(false);
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', color: 'var(--color-black)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: 0, background: '#f3f4f6', border: '1px solid var(--color-black)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notify Me On Restock</h3>
                </div>

                <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '20px', lineHeight: 1.45 }}>
                  Enter your email address to be notified the moment <strong style={{ color: 'var(--color-black)' }}>{product.title}</strong> {activeColour ? `(${activeColour})` : ''} is back in stock.
                </p>

                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', color: 'var(--color-black)' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. alex@example.com"
                    value={restockEmail}
                    onChange={(e) => setRestockEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 0,
                      border: '1.5px solid var(--color-black)',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={restockSubmitting}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: 'var(--color-black)',
                    color: 'var(--color-white)',
                    border: 'none',
                    borderRadius: 0,
                    fontWeight: 800,
                    fontSize: '0.875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    cursor: 'pointer'
                  }}
                >
                  {restockSubmitting ? 'Adding to List...' : 'Send Me Restock Alert'}
                </button>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
