'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface LookbookItem {
  id: string | number;
  imageUrl: string;
  title: string;
  description: string;
}

interface ProductLookbookProps {
  lookbook: LookbookItem[];
}

export default function ProductLookbook({ lookbook }: ProductLookbookProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollability = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    checkScrollability();
    el.addEventListener('scroll', checkScrollability, { passive: true });
    window.addEventListener('resize', checkScrollability);
    return () => {
      el.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
    };
  }, [checkScrollability, lookbook]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const card = el.querySelector('.lookbook-card') as HTMLElement;
    const cardWidth = card ? card.offsetWidth + 24 : el.clientWidth * 0.75;
    const scrollAmount = direction === 'left' ? -cardWidth : cardWidth;
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  if (!lookbook || lookbook.length === 0) return null;

  const showNavButtons = lookbook.length > 4;

  return (
    <section className="lookbook-section" style={{ position: 'relative' }}>
      <div className="container">
        {/* Header with Title and Left/Right Navigation Arrows */}
        <div
          className="section-header"
          style={{
            padding: 0,
            marginBottom: 'var(--space-md)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p className="section-title" style={{ letterSpacing: '-0.025em', textTransform: 'uppercase' }}>
              Inspiration
            </p>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', marginTop: '4px' }}>
              How He Wears It
            </h2>
          </div>

          {/* Carousel Arrows (Visible ONLY when items exceed 4) */}
          {showNavButtons && (
            <div
              className="lookbook-nav-controls"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => handleScroll('left')}
                disabled={!canScrollLeft}
                aria-label="Previous lookbook items"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  border: '1px solid var(--color-grey-mid, #e5e7eb)',
                  background: '#ffffff',
                  color: 'var(--color-black, #111827)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canScrollLeft ? 'pointer' : 'not-allowed',
                  opacity: canScrollLeft ? 1 : 0.35,
                  transition: 'all 0.2s ease',
                  boxShadow: canScrollLeft ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => handleScroll('right')}
                disabled={!canScrollRight}
                aria-label="Next lookbook items"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  border: '1px solid var(--color-grey-mid, #e5e7eb)',
                  background: '#ffffff',
                  color: 'var(--color-black, #111827)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canScrollRight ? 'pointer' : 'not-allowed',
                  opacity: canScrollRight ? 1 : 0.35,
                  transition: 'all 0.2s ease',
                  boxShadow: canScrollRight ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Lookbook Horizontal Track */}
        <div
          ref={scrollContainerRef}
          className="lookbook-carousel-track"
          style={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch',
            gap: '24px',
            paddingBottom: '16px',
            scrollbarWidth: 'none',
          }}
        >
          {lookbook.map((item) => (
            <div
              key={item.id}
              className="lookbook-card"
              style={{
                flex: '0 0 calc((100% - 72px) / 4)',
                minWidth: '270px',
                scrollSnapAlign: 'start',
              }}
            >
              <div className="lookbook-image-container" style={{ position: 'relative', width: '100%', aspectRatio: '3/4' }}>
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 576px) 50vw, 100vw"
                  className="lookbook-image"
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className="lookbook-info" style={{ padding: '16px 14px' }}>
                <h3 className="lookbook-title" style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 700 }}>
                  {item.title}
                </h3>
                <p className="lookbook-desc" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-grey-dark, #6b7280)', lineHeight: 1.5 }}>
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
