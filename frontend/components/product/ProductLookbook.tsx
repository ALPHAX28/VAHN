'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface LookbookItem {
  id: string | number;
  imageUrl: string;
  title: string;
  description?: string;
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
    const scrollAmount = el.clientWidth * 0.8;
    el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };

  if (!lookbook || lookbook.length === 0) return null;

  // Show nav arrows whenever there is more content than visible
  const showNavButtons = lookbook.length > 1;

  return (
    <section
      style={{
        background: '#1D1D1D',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        paddingBottom: '52px',
      }}
    >
      {/* ── Scrollbar hide for Webkit + responsive header ── */}
      <style>{`
        .vahn-lookbook-track::-webkit-scrollbar { display: none; }
        .vahn-lookbook-img { position: absolute; inset: 0; }
        .vahn-lookbook-header {
          text-align: center;
          padding: 36px 16px 28px;
        }
        .vahn-lookbook-subtext {
          margin: 0 auto;
          font-family: 'Lora', Georgia, serif;
          font-style: normal;
          font-weight: 400;
          font-size: 12px;
          color: #FFFFFF;
          line-height: 1.5;
          max-width: 92%;
          letter-spacing: 0.035em;
          white-space: normal;
        }
        @media (min-width: 768px) {
          .vahn-lookbook-header {
            padding: 52px 24px 40px;
          }
          .vahn-lookbook-subtext {
            font-size: clamp(11px, 0.85vw, 13px);
            white-space: nowrap;
            max-width: 850px;
          }
        }
      `}</style>

      {/* ── Header Block ── */}
      <div className="vahn-lookbook-header">
        {/* Eyebrow label */}
        <p
          style={{
            margin: '0 0 14px',
            fontFamily: "'Hanken Grotesk', 'Inter', sans-serif",
            fontWeight: 400,
            fontSize: '11px',
            letterSpacing: '-0.025em',
            textTransform: 'uppercase',
            color: '#FFFFFF',
            lineHeight: 1,
          }}
        >
          Nothing By Default
        </p>

        {/* Main Title */}
        <h2
          style={{
            margin: '0 0 12px',
            fontFamily: "'Hanken Grotesk', 'Inter', sans-serif",
            fontWeight: 700,
            fontSize: 'clamp(1.15rem, 2.8vw, 2rem)',
            letterSpacing: '-0.025em',
            textTransform: 'uppercase',
            color: '#FFFFFF',
            lineHeight: 1.1,
          }}
        >
          Every Choice, Deliberate.
        </h2>

        {/* Subtitle — Lora, white, responsive wrap on mobile / single line on desktop */}
        <p className="vahn-lookbook-subtext">
          Where the fabric breathes, how the crest sits, why the piece fits the way it does.
        </p>
      </div>

      {/* ── Image Strip ── */}
      <div style={{ position: 'relative', padding: '0 24px' }}>

        {/* Left Arrow — overlaid on the image strip */}
        {showNavButtons && (
          <button
            type="button"
            onClick={() => handleScroll('left')}
            disabled={!canScrollLeft}
            aria-label="Previous"
            style={{
              position: 'absolute',
              left: '32px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              width: '46px',
              height: '46px',
              background: canScrollLeft
                ? 'rgba(255,255,255,0.18)'
                : 'rgba(255,255,255,0.07)',
              border: 'none',
              borderRadius: '0px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: canScrollLeft ? 'pointer' : 'default',
              transition: 'background 0.2s',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
            onMouseEnter={e => {
              if (canScrollLeft)
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.30)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background =
                canScrollLeft ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={canScrollLeft ? '#ffffff' : 'rgba(255,255,255,0.3)'}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        {/* Right Arrow */}
        {showNavButtons && (
          <button
            type="button"
            onClick={() => handleScroll('right')}
            disabled={!canScrollRight}
            aria-label="Next"
            style={{
              position: 'absolute',
              right: '32px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              width: '46px',
              height: '46px',
              background: canScrollRight
                ? 'rgba(255,255,255,0.18)'
                : 'rgba(255,255,255,0.07)',
              border: 'none',
              borderRadius: '0px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: canScrollRight ? 'pointer' : 'default',
              transition: 'background 0.2s',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
            onMouseEnter={e => {
              if (canScrollRight)
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.30)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background =
                canScrollRight ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={canScrollRight ? '#ffffff' : 'rgba(255,255,255,0.3)'}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* ── Scrollable image track — zero gap, edge to edge ── */}
        <div
          ref={scrollContainerRef}
          className="vahn-lookbook-track"
          style={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch',
            gap: '10px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {lookbook.map((item) => {
            // ≤3 items: fill viewport equally. >3: 33.33% wide, scrollable.
            const cardWidth =
              lookbook.length <= 3
                ? `${100 / lookbook.length}%`
                : '33.333%';
            const cardMinWidth =
              lookbook.length <= 3
                ? `${100 / lookbook.length}%`
                : 'min(280px, 50vw)';

            return (
              <div
                key={item.id}
                className="vahn-lookbook-card"
                style={{
                  flex: `0 0 ${cardWidth}`,
                  minWidth: cardMinWidth,
                  scrollSnapAlign: 'start',
                  position: 'relative',
                  aspectRatio: '4 / 5',
                  maxHeight: '580px',
                  overflow: 'hidden',
                  background: '#111',
                  borderRadius: '0px',
                }}
              >
                {/* Product image — wrapped for zoom-on-hover */}
                <div className="vahn-lookbook-img">
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    style={{ objectFit: 'cover' }}
                  />
                </div>

                {/* Caption — bottom-centered */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '18px 20px 22px',
                    textAlign: 'center',
                    zIndex: 2,
                  }}
                >
                  <p
                    style={{
                      margin: item.description ? '0 0 6px' : '0',
                      fontFamily: "'Hanken Grotesk', 'Inter', sans-serif",
                      fontWeight: 400,
                      fontSize: 'clamp(17px, 1.65vw, 23px)',
                      color: '#FFFFFF',
                      lineHeight: 1.25,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {item.title}
                  </p>
                  {item.description && (
                    <p
                      style={{
                        margin: 0,
                        fontFamily: "'Lora', Georgia, serif",
                        fontWeight: 400,
                        fontStyle: 'normal',
                        fontSize: 'clamp(12px, 0.95vw, 14px)',
                        color: 'rgba(255,255,255,0.75)',
                        lineHeight: 1.45,
                        letterSpacing: '0.01em',
                      }}
                    >
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
