'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product, ProductVariant } from '@/lib/api/types';
import { useCart } from '@/context/CartContext';


interface Props {
  initialProducts: Product[];
}

interface ExpandedCardItem {
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
  productType: string;
  fit: string;
  activity: string;
}

// ── FAQ Data (from mockup) ──
const FAQ_ITEMS = [
  {
    q: 'WHAT DOES VAHN MAKE?',
    a: 'Right now, jerseys, built for the way you actually play.\nThis is our first drop. More is coming.',
  },
  {
    q: 'ARE THE JERSEYS UNISEX?',
    a: 'Yes. Made for everyone.',
  },
  {
    q: 'HOW DOES THE FIT RUN?',
    a: "Relaxed, not oversized. If you're between sizes, we'd recommend sizing down for a fitted look or staying true to size for the intended relaxed drape.",
    link: { label: 'Size Chart', href: '/pages/size-chart' },
  },
  {
    q: 'WHAT FABRIC ARE THE JERSEYS MADE FROM?',
    a: '100% micro yarn polyester, 155 gsm. Built with moisture-wicking technology that pulls sweat away from the skin, and breathable panelling placed through the high-heat zones for airflow.',
  },
  {
    q: 'CAN I WEAR VAHN ON THE FIELD, OR IS IT STREETWEAR?',
    a: "Both. VAHN isn't gym wear and it isn't costume, it's for cricket on a Sunday, football after work, badminton with your building group. Wherever the game is, wear it there.",
  },
  {
    q: 'IS THIS A LIMITED DROP? WILL IT RESTOCK?',
    a: "Our first collection is a limited run, when it's gone, it's gone. That's the drop,\nnot a shortage. Follow us for what's next.",
  },
  {
    q: 'DO YOU SHIP ACROSS INDIA? HOW LONG DOES DELIVERY TAKE?',
    a: 'Yes, pan-India shipping. 5–7 business days.',
  },
  {
    q: "WHAT'S YOUR RETURN/EXCHANGE POLICY?",
    a: 'Refer to our ',
    link: { label: 'Shipping & Returns Policies', href: '/policies/refund-policy' },
  },
];

// ── Sort Options (matching mockup) ──
const SORT_OPTIONS = [
  { value: 'featured', label: 'FEATURED' },
  { value: 'most-relevant', label: 'MOST RELEVANT' },
  { value: 'best-selling', label: 'BEST SELLING' },
  { value: 'name-asc', label: 'ALPHABETICALLY, A-Z' },
  { value: 'name-desc', label: 'ALPHABETICALLY, Z-A' },
  { value: 'price-asc', label: 'PRICE, LOW TO HIGH' },
  { value: 'price-desc', label: 'PRICE, HIGH TO LOW' },
  { value: 'date-new', label: 'DATE, NEW TO OLD' },
  { value: 'date-old', label: 'DATE, OLD TO NEW' },
];

const BRAND_COLOR = '#4232d9';

// ── Expand products → per-colourway items (same logic as FreshOutLocker) ──
function getExpandedItems(products: Product[]): ExpandedCardItem[] {
  const items: ExpandedCardItem[] = [];

  products.forEach((product) => {
    const allVariants = (product.variants?.edges ?? []).map((e) => e.node);
    const tag =
      product.tags?.find((t) => !t.startsWith('_') && t.length < 15) ||
      product.vendor ||
      'BESTSELLER';

    function calcFewLeft(pool: ProductVariant[]) {
      return pool.some(
        (v) =>
          v.availableForSale &&
          typeof v.quantityAvailable === 'number' &&
          v.quantityAvailable > 0 &&
          v.quantityAvailable <= 5
      );
    }

    function calcPrice(pool: ProductVariant[]) {
      const lowestVar = pool.reduce<ProductVariant | null>((acc, v) => {
        if (!acc) return v;
        return parseFloat(v.price.amount) < parseFloat(acc.price.amount) ? v : acc;
      }, null);
      return lowestVar
        ? parseInt(lowestVar.price.amount, 10).toLocaleString('en-IN')
        : parseInt(product.priceRange?.minVariantPrice?.amount || '0', 10).toLocaleString('en-IN');
    }

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
          if (variantImg) cgImages.push({ url: variantImg, altText: `${product.title} - ${colourName}` });
          else if (product.featuredImage?.url) cgImages.push({ url: product.featuredImage.url, altText: product.title });
        }
        const pool = colourVariants.length > 0 ? colourVariants : allVariants;
        items.push({
          id: `${product.id}-${colourName.toLowerCase().replace(/\s+/g, '-')}`,
          product, colourName, images: cgImages,
          price: calcPrice(pool), isFewLeft: calcFewLeft(pool),
          tag, title: product.title,
          targetHref: `/products/${product.handle}?colour=${encodeURIComponent(colourName)}`,
          variants: pool,
          productType: (product.productType || '').trim(),
          fit: (product.fit || '').trim(),
          activity: (product.activity || '').trim(),
        });
      });
    } else {
      const variantColourSet = new Set<string>();
      allVariants.forEach((v) =>
        v.selectedOptions?.forEach((opt) => {
          if ((opt.name.toLowerCase() === 'colour' || opt.name.toLowerCase() === 'color') && opt.value.trim())
            variantColourSet.add(opt.value.trim());
        })
      );
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
            if (v.image?.url && !colImages.some((img) => img.url === v.image?.url))
              colImages.push({ url: v.image.url, altText: `${product.title} - ${col}` });
          });
          if (colImages.length === 0 && product.featuredImage?.url)
            colImages.push({ url: product.featuredImage.url, altText: product.title });
          const pool = colourVariants.length > 0 ? colourVariants : allVariants;
          items.push({
            id: `${product.id}-${col.toLowerCase().replace(/\s+/g, '-')}`,
            product, colourName: col, images: colImages,
            price: calcPrice(pool), isFewLeft: calcFewLeft(pool),
            tag, title: product.title,
            targetHref: `/products/${product.handle}?colour=${encodeURIComponent(col)}`,
            variants: pool,
            productType: (product.productType || '').trim(),
            fit: (product.fit || '').trim(),
            activity: (product.activity || '').trim(),
          });
        });
      } else {
        const prodImages = (product.images?.edges || []).map((e) => ({
          url: e.node.url,
          altText: e.node.altText || product.title,
        }));
        if (prodImages.length === 0 && product.featuredImage?.url)
          prodImages.push({ url: product.featuredImage.url, altText: product.title });
        items.push({
          id: product.id,
          product, colourName: '', images: prodImages,
          price: calcPrice(allVariants), isFewLeft: calcFewLeft(allVariants),
          tag, title: product.title,
          targetHref: `/products/${product.handle}`,
          variants: allVariants,
          productType: (product.productType || '').trim(),
          fit: (product.fit || '').trim(),
          activity: (product.activity || '').trim(),
        });
      }
    }
  });
  return items;
}

// ── FAQ Accordion Item ──
function FaqItem({
  q, a, link, isOpen, onToggle,
}: {
  q: string; a: string;
  link?: { label: string; href: string };
  isOpen: boolean; onToggle: () => void;
}) {
  return (
    <div style={{ borderBottom: '1px solid #e5e5e5' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '20px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          gap: '16px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.0625rem',
            fontWeight: 400,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#000000',
          }}
        >
          {q}
        </span>
        <span
          style={{
            color: BRAND_COLOR,
            fontSize: '1.25rem',
            lineHeight: 1,
            flexShrink: 0,
            fontWeight: 300,
          }}
        >
          {isOpen ? '×' : '+'}
        </span>
      </button>

      {isOpen && (
        <div style={{ paddingBottom: '20px' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
              color: '#555555',
              lineHeight: 1.75,
              margin: 0,
              whiteSpace: 'pre-line',
            }}
          >
            {a}
            {link && (
              <Link href={link.href} style={{ color: BRAND_COLOR, textDecoration: 'none' }}>
                {link.label}
              </Link>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Product Card — identical to FreshOutLocker LockerCard, adapted for grid ──
function ShopCard({ item }: { item: ExpandedCardItem }) {
  const { addItem } = useCart();
  const [imgIdx, setImgIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [addedVariantId, setAddedVariantId] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const images = item.images || [];
  const hasMultipleImages = images.length > 1;
  const currentImg = images[imgIdx] ?? null;
  const activeImageUrl = currentImg?.url || null;

  const sizeVariants = useMemo(() => {
    return item.variants.map((v) => {
      const sizeOpt = v.selectedOptions?.find((o) => o.name.toLowerCase() === 'size');
      const sizeLabel = sizeOpt ? sizeOpt.value.trim() : v.title !== 'Default Title' ? v.title : 'ONE SIZE';
      const isAvailable = v.availableForSale && (v.quantityAvailable === undefined || v.quantityAvailable > 0);
      const isFew = isAvailable && typeof v.quantityAvailable === 'number' && v.quantityAvailable <= 5;
      return { variant: v, sizeLabel, isAvailable, isFew };
    });
  }, [item]);

  const handleAddToCart = (v: ProductVariant) => {
    setAddedVariantId(v.id);
    addItem(v.id, 1, {
      productTitle: item.title,
      productHandle: item.product.handle,
      variantTitle: v.title,
      price: v.price,
      image: currentImg ? { url: currentImg.url, altText: currentImg.altText || item.title, width: 800, height: 800 } : null,
      selectedOptions: v.selectedOptions,
      quantityAvailable: v.quantityAvailable,
    }, true);
    setTimeout(() => { setAddedVariantId(null); setShowQuickAdd(false); }, 600);
  };

  useEffect(() => {
    if (!showQuickAdd) return;
    const handleOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setShowQuickAdd(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showQuickAdd]);

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (images.length > 1) setImgIdx((i) => (i - 1 + images.length) % images.length);
  };
  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (images.length > 1) setImgIdx((i) => (i + 1) % images.length);
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ display: 'flex', flexDirection: 'column', position: 'relative', userSelect: 'none' }}
    >
      {/* Image Frame — 4:5 portrait ratio matching FreshOutLocker */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4 / 5',
          background: '#f5f5f7',
          overflow: 'hidden',
        }}
      >
        {/* Left Arrow — only on hover, same as FreshOutLocker */}
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous view"
          style={{
            position: 'absolute',
            left: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 15,
            background: 'transparent',
            border: 'none',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: hasMultipleImages ? 'pointer' : 'default',
            color: BRAND_COLOR,
            opacity: isHovered ? 1 : 0,
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Product Image Link */}
        <Link
          href={item.targetHref}
          style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
        >
          {activeImageUrl ? (
            <Image
              src={activeImageUrl}
              alt={currentImg?.altText || item.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 420px"
              style={{
                objectFit: 'cover',
                objectPosition: 'center',
                transition: 'transform 0.4s ease',
                transform: isHovered ? 'scale(1.02)' : 'scale(1)',
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.8125rem', fontFamily: 'var(--font-heading)' }}>
              No image
            </div>
          )}
        </Link>

        {/* Right Arrow — only on hover */}
        <button
          type="button"
          onClick={handleNext}
          aria-label="Next view"
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 15,
            background: 'transparent',
            border: 'none',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: hasMultipleImages ? 'pointer' : 'default',
            color: BRAND_COLOR,
            opacity: isHovered ? 1 : 0,
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Pagination Dots */}
        {hasMultipleImages && (
          <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '5px', zIndex: 10, pointerEvents: 'none' }}>
            {images.map((_, dotIdx) => (
              <span key={dotIdx} style={{ width: dotIdx === imgIdx ? '16px' : '5px', height: '5px', borderRadius: '3px', background: dotIdx === imgIdx ? BRAND_COLOR : 'rgba(255,255,255,0.7)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'all 0.25s ease' }} />
            ))}
          </div>
        )}

        {/* Quick Size Picker Overlay */}
        {showQuickAdd && (
          <div
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(0,0,0,0.08)', padding: '14px 12px 12px', zIndex: 20, display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 -4px 20px rgba(0,0,0,0.12)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '-0.025em', color: '#000000' }}>SELECT SIZE</span>
              <button type="button" onClick={() => setShowQuickAdd(false)} style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {sizeVariants.map(({ variant, sizeLabel, isAvailable }) => (
                <button
                  key={variant.id}
                  type="button"
                  disabled={!isAvailable || addedVariantId === variant.id}
                  onClick={() => { if (isAvailable) handleAddToCart(variant); }}
                  style={{
                    flex: sizeVariants.length === 1 ? '1 0 100%' : '1 0 calc(25% - 6px)',
                    minWidth: '40px', height: '36px', padding: '0 6px',
                    background: addedVariantId === variant.id ? BRAND_COLOR : isAvailable ? '#ffffff' : '#f5f5f7',
                    color: addedVariantId === variant.id ? '#ffffff' : isAvailable ? '#000000' : '#b0b0b5',
                    border: addedVariantId === variant.id ? `1.5px solid ${BRAND_COLOR}` : isAvailable ? '1.5px solid #000000' : '1px solid rgba(0,0,0,0.12)',
                    borderRadius: '2px',
                    fontFamily: 'var(--font-heading)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '-0.025em',
                    cursor: isAvailable ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    textDecoration: isAvailable ? 'none' : 'line-through',
                    opacity: isAvailable ? 1 : 0.6,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { if (isAvailable && addedVariantId !== variant.id) { e.currentTarget.style.backgroundColor = BRAND_COLOR; e.currentTarget.style.borderColor = BRAND_COLOR; e.currentTarget.style.color = '#ffffff'; } }}
                  onMouseLeave={(e) => { if (isAvailable && addedVariantId !== variant.id) { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#000000'; e.currentTarget.style.color = '#000000'; } }}
                >
                  {addedVariantId === variant.id ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : sizeLabel}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Product Meta Row */}
      <div style={{ paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {/* Tag / Colour */}
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.6875rem', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '-0.01em', color: '#8e8e93' }}>
            {item.colourName || item.tag}
          </span>
          {/* Title */}
          <Link href={item.targetHref} style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8125rem', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '-0.01em', color: '#000000', textDecoration: 'none', lineHeight: 1.3 }}>
            {item.title}
          </Link>
          {/* Price */}
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.875rem', fontWeight: 400, letterSpacing: '-0.01em', color: BRAND_COLOR, marginTop: '2px' }}>
            ₹ {item.price}
          </span>
          {/* Only Few Left — dynamic, only when ≤5 in stock */}
          {item.isFewLeft && (
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.625rem', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '-0.01em', color: '#a0a0b2', marginTop: '1px' }}>
              ONLY FEW LEFT
            </span>
          )}
        </div>

        {/* Quick Add Plus */}
        <button
          type="button"
          onClick={() => setShowQuickAdd((prev) => !prev)}
          aria-label={showQuickAdd ? 'Close size picker' : `Select size for ${item.title}`}
          style={{
            background: showQuickAdd ? BRAND_COLOR : 'none',
            border: 'none',
            color: showQuickAdd ? '#ffffff' : isHovered ? '#3425b8' : BRAND_COLOR,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '4px',
            borderRadius: showQuickAdd ? '50%' : '0',
            cursor: 'pointer',
            transition: 'transform 0.25s ease, color 0.2s ease, background-color 0.2s ease',
            transform: showQuickAdd ? 'rotate(45deg)' : isHovered ? 'scale(1.2)' : 'scale(1)',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="12" y1="4" x2="12" y2="20" />
            <line x1="4" y1="12" x2="20" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Main Client Component ──
export default function ShopProductsClient({ initialProducts }: Props) {
  const [sortBy, setSortBy] = useState('featured');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedFit, setSelectedFit] = useState('ALL');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const allItems = useMemo(() => getExpandedItems(initialProducts), [initialProducts]);

  // Derived filter options
  const categories = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((i) => { if (i.productType) set.add(i.productType); });
    return Array.from(set).sort();
  }, [allItems]);

  const fits = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((i) => { if (i.fit) set.add(i.fit.toUpperCase()); });
    return Array.from(set).sort();
  }, [allItems]);

  // Apply filters + sort
  const filteredItems = useMemo(() => {
    let result = [...allItems];
    if (selectedCategory !== 'ALL') result = result.filter((i) => i.productType.toLowerCase() === selectedCategory.toLowerCase());
    if (selectedFit !== 'ALL') result = result.filter((i) => i.fit.toUpperCase() === selectedFit.toUpperCase());
    if (sortBy === 'price-asc') result.sort((a, b) => parseInt(a.price.replace(/,/g, ''), 10) - parseInt(b.price.replace(/,/g, ''), 10));
    else if (sortBy === 'price-desc') result.sort((a, b) => parseInt(b.price.replace(/,/g, ''), 10) - parseInt(a.price.replace(/,/g, ''), 10));
    else if (sortBy === 'name-asc') result.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === 'name-desc') result.sort((a, b) => b.title.localeCompare(a.title));
    return result;
  }, [allItems, selectedCategory, selectedFit, sortBy]);

  const selectedSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'FEATURED';
  const hasActiveFilters = selectedCategory !== 'ALL' || selectedFit !== 'ALL';

  return (
    <div style={{ background: '#ffffff', color: '#000000', minHeight: '100vh' }}>

      {/* ── Page Title ── */}
      <div style={{ padding: '48px clamp(40px, 7vw, 120px) 0' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', fontWeight: 900, letterSpacing: '-0.01em', textTransform: 'uppercase', color: '#000000', margin: '0 0 6px', lineHeight: 1.1 }}>
          ALL PRODUCTS
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: '#444444', margin: 0, lineHeight: 1.5 }}>
          Our first drop is here — limited pieces, made to move with you.
        </p>
      </div>

      {/* ── Sort + Filters ── */}
      <div style={{ padding: '16px clamp(40px, 7vw, 120px) 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Row 1: Sort dropdown */}
        <div ref={sortRef} style={{ position: 'relative', alignSelf: 'flex-start' }}>
          <button
            onClick={() => setSortOpen((p) => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px',
              border: '1px solid #c0c0c0',
              background: '#ffffff',
              cursor: 'pointer',
              fontFamily: 'var(--font-heading)', fontSize: '0.75rem', fontWeight: 600,
              letterSpacing: '0.03em', color: '#000000',
              minWidth: '180px', justifyContent: 'space-between',
            }}
          >
            <span>{selectedSortLabel}</span>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1L5 5L9 1" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {sortOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: '#ffffff', border: '1px solid #c0c0c0', borderTop: 'none', minWidth: '210px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '10px 14px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-heading)', fontSize: '0.75rem',
                    fontWeight: sortBy === opt.value ? 700 : 400,
                    color: sortBy === opt.value ? BRAND_COLOR : '#222222',
                    textAlign: 'left', letterSpacing: '0.02em',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Row 2: Category + Fit pills + Clear */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Category pills */}
          {categories.length > 0 && (
            <>
              <button
                onClick={() => setSelectedCategory('ALL')}
                style={{
                  padding: '7px 14px', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.04em',
                  textTransform: 'uppercase', fontFamily: 'var(--font-heading)',
                  border: '1px solid', borderColor: selectedCategory === 'ALL' ? '#000000' : '#d0d0d0',
                  background: selectedCategory === 'ALL' ? '#000000' : '#ffffff',
                  color: selectedCategory === 'ALL' ? '#ffffff' : '#666666',
                  cursor: 'pointer',
                }}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? 'ALL' : cat)}
                  style={{
                    padding: '7px 14px', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.04em',
                    textTransform: 'uppercase', fontFamily: 'var(--font-heading)',
                    border: '1px solid', borderColor: selectedCategory === cat ? '#000000' : '#d0d0d0',
                    background: selectedCategory === cat ? '#000000' : '#ffffff',
                    color: selectedCategory === cat ? '#ffffff' : '#666666',
                    cursor: 'pointer',
                  }}
                >
                  {cat}
                </button>
              ))}
            </>
          )}

          {/* Fit pills */}
          {fits.map((fit) => (
            <button
              key={fit}
              onClick={() => setSelectedFit(selectedFit === fit ? 'ALL' : fit)}
              style={{
                padding: '7px 14px', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.04em',
                textTransform: 'uppercase', fontFamily: 'var(--font-heading)',
                border: '1px solid', borderColor: selectedFit === fit ? BRAND_COLOR : '#d0d0d0',
                background: selectedFit === fit ? BRAND_COLOR : '#ffffff',
                color: selectedFit === fit ? '#ffffff' : '#666666',
                cursor: 'pointer',
              }}
            >
              {fit}
            </button>
          ))}

          {hasActiveFilters && (
            <button
              onClick={() => { setSelectedCategory('ALL'); setSelectedFit('ALL'); }}
              style={{ fontFamily: 'var(--font-heading)', fontSize: '0.6875rem', fontWeight: 600, color: '#888', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', letterSpacing: '0.02em' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Responsive styles ── */}
      <style>{`
        .shop-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 48px 24px;
        }
        .trust-badges-bar {
          background: #3a3699;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          padding: 28px clamp(40px, 7vw, 120px);
        }
        .trust-badge-item {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 0 20px;
        }
        @media (max-width: 900px) {
          .shop-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 36px 16px;
          }
        }
        @media (max-width: 540px) {
          .shop-grid {
            grid-template-columns: 1fr;
            gap: 28px 12px;
          }
          .trust-badges-bar {
            grid-template-columns: 1fr;
            gap: 0;
            padding: 0 20px;
          }
          .trust-badge-item {
            border-left: none !important;
            border-top: 1px solid rgba(255,255,255,0.2);
            padding: 16px 0 !important;
            justify-content: flex-start;
          }
          .trust-badge-item:first-child {
            border-top: none;
          }
        }
      `}</style>

      {/* ── Product Grid ── */}
      <main style={{ padding: '24px clamp(40px, 7vw, 120px) 80px' }}>
        {filteredItems.length === 0 ? (
          <div style={{ padding: '80px 20px', textAlign: 'center', border: '1px solid #e5e5e5' }}>
            <p style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 6px', fontFamily: 'var(--font-heading)' }}>No products found</p>
            <p style={{ fontSize: '0.875rem', color: '#666', margin: 0, fontFamily: 'var(--font-body)' }}>Check back soon for new drops.</p>
          </div>
        ) : (
          <div className="shop-grid">
            {filteredItems.map((item) => (
              <ShopCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      {/* ── FAQ Section ── */}
      <section style={{ padding: 'clamp(48px, 8vw, 80px) clamp(40px, 7vw, 120px)', background: '#ffffff' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 900, textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.02em', margin: '0 0 40px', lineHeight: 1.25 }}>
            FREQUENTLY ASKED<br />QUESTIONS
          </h2>
          <div style={{ borderTop: '1px solid #e5e5e5' }}>
            {FAQ_ITEMS.map((item, idx) => (
              <FaqItem
                key={idx}
                q={item.q}
                a={item.a}
                link={item.link}
                isOpen={openFaqIndex === idx}
                onToggle={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Badges ── */}
      <div className="trust-badges-bar">
        {[
          { icon: '/icons/pan-india-delivery.png', label: 'PAN-INDIA DELIVERY' },
          { icon: '/icons/secure-payments.png', label: '100% SECURE PAYMENTS' },
          { icon: '/icons/made-for-the-game.png', label: 'MADE FOR THE GAME' },
        ].map((badge, i) => (
          <div
            key={i}
            className="trust-badge-item"
            style={{ borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.35)' : 'none' }}
          >
            <Image src={badge.icon} alt={badge.label} width={26} height={26} style={{ filter: 'brightness(0) invert(1)', objectFit: 'contain', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ffffff' }}>
              {badge.label}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}
