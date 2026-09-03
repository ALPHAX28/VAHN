'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/api/types';

interface PickYourSideProps {
  products?: Product[];
}

export default function PickYourSide({ products = [] }: PickYourSideProps) {
  const BRAND_BLUE = '#4232d9';

  // 1. Identify the exact featured product:
  // - Priority 1: Product explicitly tagged with 'pick-your-side'
  // - Priority 2: Product whose handle or title contains 'jersey'
  // - Priority 3: First available product as a safe fallback
  const featuredProduct = useMemo(() => {
    if (!products || products.length === 0) return null;
    return (
      products.find((p) =>
        p.tags?.some((t) => t.toLowerCase().trim() === 'pick-your-side')
      ) ||
      products.find((p) =>
        p.handle.toLowerCase().includes('jersey') || p.title.toLowerCase().includes('jersey')
      ) ||
      products[0]
    );
  }, [products]);

  // 2. Resolve the exact colours for Left (White) and Right (Black) cards from THAT product's colour groups
  const { leftColour, rightColour } = useMemo(() => {
    if (!featuredProduct) return { leftColour: '', rightColour: '' };

    // Support optional tag-based custom colour overrides: e.g. "pick-your-side:White:Black"
    const customTag = featuredProduct.tags?.find((t) =>
      t.toLowerCase().startsWith('pick-your-side:')
    );
    if (customTag) {
      const parts = customTag.split(':');
      if (parts.length >= 3) {
        return { leftColour: parts[1].trim(), rightColour: parts[2].trim() };
      }
    }

    // Collect all unique colour values from the product's colour groups
    const colourList: string[] = [];
    if (featuredProduct.colourGroups && featuredProduct.colourGroups.length > 0) {
      featuredProduct.colourGroups.forEach((cg) => {
        const val = cg.colourValue?.trim();
        if (val && !colourList.includes(val)) colourList.push(val);
      });
    }

    // Fallback to variant selected options if colourGroups is empty
    if (colourList.length === 0 && featuredProduct.variants?.edges) {
      featuredProduct.variants.edges.forEach((e) => {
        const opt = e.node.selectedOptions?.find(
          (o) => o.name.toLowerCase() === 'colour' || o.name.toLowerCase() === 'color'
        );
        if (opt?.value?.trim() && !colourList.includes(opt.value.trim())) {
          colourList.push(opt.value.trim());
        }
      });
    }

    // Left Panel (Athlete in White / Light / Grey jersey):
    // Match 'white', 'light', 'cream', 'home', 'grey', 'gray' or default to 1st colour
    const whiteMatch = colourList.find((c) => {
      const lower = c.toLowerCase();
      return (
        lower.includes('white') ||
        lower.includes('light') ||
        lower.includes('cream') ||
        lower.includes('home') ||
        lower.includes('grey') ||
        lower.includes('gray')
      );
    });
    const left = whiteMatch || colourList[0] || 'White';

    // Right Panel (Athlete in Black jersey):
    // Must pick a different colour from Left if multiple colours exist.
    // Match 'black', 'dark', 'navy', 'blue', 'away' or default to next available colour
    const remainingColours = colourList.filter((c) => c.toLowerCase() !== left.toLowerCase());
    const blackMatch = remainingColours.find((c) => {
      const lower = c.toLowerCase();
      return (
        lower.includes('black') ||
        lower.includes('dark') ||
        lower.includes('navy') ||
        lower.includes('blue') ||
        lower.includes('away')
      );
    });
    const right = blackMatch || remainingColours[0] || colourList[1] || 'Black';

    return { leftColour: left, rightColour: right };
  }, [featuredProduct]);

  // Construct dynamic product URLs with ?colour query param
  const leftHref = featuredProduct
    ? `/products/${featuredProduct.handle}${leftColour ? `?colour=${encodeURIComponent(leftColour)}` : ''}`
    : '/products';

  const rightHref = featuredProduct
    ? `/products/${featuredProduct.handle}${rightColour ? `?colour=${encodeURIComponent(rightColour)}` : ''}`
    : '/products';

  return (
    <section style={{ background: '#fff' }}>
      {/* Dark header strip */}
      <div
        style={{
          background: '#111111',
          padding: 'clamp(36px, 6vw, 52px) clamp(16px, 4vw, 24px) clamp(32px, 5vw, 48px)',
          textAlign: 'center',
          borderBottom: '1px solid #ffffff',
        }}
      >
        {/* Official VAHN Symbol 'V' Logo in Blue from drive_logos */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
          <Image
            src="/assets/logos/VAHN-Symbol-colour-transparent.png"
            alt="VAHN"
            width={40}
            height={30}
            style={{ height: '28px', width: 'auto', display: 'block', objectFit: 'contain' }}
          />
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 900,
            fontSize: 'clamp(1.25rem, 2.8vw, 2rem)',
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            color: '#ffffff',
            lineHeight: 1.1,
            marginBottom: '10px',
          }}
        >
          PICK YOUR SIDE.
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontStyle: 'normal',
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.85)',
            maxWidth: '560px',
            margin: '0 auto',
            lineHeight: 1.5,
            letterSpacing: '-0.01em',
          }}
        >
          Two jerseys. Two expressions. One mindset. Wear the one that feels like you.
        </p>
      </div>

      {/* Two-panel image section — 2 columns on desktop, stacks vertically on mobile */}
      <div className="pick-your-side-grid">
        {/* Left Panel */}
        <div
          className="pick-your-side-panel"
          style={{
            background: '#1a1f64',
          }}
        >
          {/* Real Athlete Image Card 01 — White Jersey */}
          <Image
            src="/assets/pick-your-side-01.webp"
            alt="Pick Your Side — White"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="pick-your-side-img"
          />

          {/* Gradient overlay for CTA contrast */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 35%)',
              zIndex: 1,
            }}
            aria-hidden="true"
          />

          {/* BUY NOW button */}
          <Link
            href={leftHref}
            style={{
              position: 'relative',
              zIndex: 2,
              background: BRAND_BLUE,
              color: '#ffffff',
              border: 'none',
              borderRadius: '2px',
              padding: '12px 40px',
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: '0.8125rem',
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
              textDecoration: 'none',
              display: 'inline-block',
              transition: 'background-color 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#3425b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = BRAND_BLUE;
            }}
          >
            Buy Now
          </Link>
        </div>

        {/* Right Panel */}
        <div
          className="pick-your-side-panel"
          style={{
            background: '#1a1a66',
          }}
        >
          {/* Real Athlete Image Card 02 — Black Jersey */}
          <Image
            src="/assets/pick-your-side-02.webp"
            alt="Pick Your Side — Black"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="pick-your-side-img"
          />

          {/* Gradient overlay for CTA contrast */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 35%)',
              zIndex: 1,
            }}
            aria-hidden="true"
          />

          {/* BUY NOW button */}
          <Link
            href={rightHref}
            style={{
              position: 'relative',
              zIndex: 2,
              background: BRAND_BLUE,
              color: '#ffffff',
              border: 'none',
              borderRadius: '2px',
              padding: '12px 40px',
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: '0.8125rem',
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
              textDecoration: 'none',
              display: 'inline-block',
              transition: 'background-color 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#3425b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = BRAND_BLUE;
            }}
          >
            Buy Now
          </Link>
        </div>
      </div>
    </section>
  );
}
