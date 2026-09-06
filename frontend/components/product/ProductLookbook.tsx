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

  // Reset scroll position to beginning whenever lookbook items change (e.g. colour switched)
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [lookbook]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const firstCard = el.querySelector<HTMLElement>('.vahn-lookbook-card');
    const cardWidth = firstCard ? firstCard.offsetWidth : el.clientWidth / 2.75;
    const gap = 10;
    const scrollAmount = cardWidth + gap;
    el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };

  if (!lookbook || lookbook.length === 0) return null;

  // Show nav arrows whenever there is more content than visible
  const showNavButtons = lookbook.length > 1;

  return (
    <section
      style={{
        background: '#111111',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        paddingBottom: '52px',
      }}
    >
      {/* ── Scrollbar hide for Webkit + responsive header & mobile carousel ── */}
      <style>{`
        .vahn-lookbook-track {
          scroll-snap-type: none !important;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
        }
        .vahn-lookbook-track::-webkit-scrollbar { display: none; }
        .vahn-lookbook-card {
          scroll-snap-align: none !important;
        }
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
        @media (max-width: 767px) {
          .vahn-lookbook-strip {
            padding: 0 16px !important;
          }
          .vahn-lookbook-track {
            gap: 12px !important;
          }
          .vahn-lookbook-card {
            flex: 0 0 82vw !important;
            min-width: 82vw !important;
            max-width: 85vw !important;
            aspect-ratio: 3 / 4 !important;
            max-height: 560px !important;
          }
          .vahn-lookbook-desc {
            display: none !important;
          }
          .vahn-lookbook-caption {
            padding: 24px 16px 18px !important;
          }
          .vahn-lookbook-nav {
            display: none !important;
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
      <div className="vahn-lookbook-strip" style={{ position: 'relative', padding: '0 24px' }}>

        {/* Left Arrow — overlaid on the image strip */}
        {showNavButtons && (
          <button
            type="button"
            onClick={() => handleScroll('left')}
            disabled={!canScrollLeft}
            aria-label="Previous"
            className="vahn-lookbook-nav"
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
            className="vahn-lookbook-nav"
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

        {/* ── Scrollable image track ── */}
        <div
          ref={scrollContainerRef}
          className="vahn-lookbook-track"
          style={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'none',
            WebkitOverflowScrolling: 'touch',
            gap: '10px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {lookbook.map((item) => {
            // If length >= 3: exactly 2.75 cards visible so the 3rd card is always 75% visible and 25% hidden
            const cardWidth =
              lookbook.length >= 3
                ? 'calc((100% - 20px) / 2.75)'
                : lookbook.length === 2
                ? 'calc((100% - 10px) / 2)'
                : '100%';

            return (
              <div
                key={item.id}
                className="vahn-lookbook-card"
                style={{
                  flex: `0 0 ${cardWidth}`,
                  width: cardWidth,
                  minWidth: cardWidth,
                  maxWidth: cardWidth,
                  scrollSnapAlign: 'none',
                  position: 'relative',
                  aspectRatio: '3 / 4',
                  maxHeight: '640px',
                  overflow: 'hidden',
                  background: '#111111',
                  borderRadius: '0px',
                }}
              >
                {/* Product image — wrapped for zoom-on-hover */}
                <div className="vahn-lookbook-img">
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 85vw"
                    style={{ objectFit: 'cover' }}
                  />
                </div>

                {/* Caption — fixed-height layout on desktop, compact on mobile */}
                <div
                  className="vahn-lookbook-caption"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: '36px 20px 22px',
                    textAlign: 'center',
                    zIndex: 2,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.52) 65%, transparent 100%)',
                    pointerEvents: 'none',
                  }}
                >
                  <p
                    style={{
                      margin: '0 0 6px',
                      fontFamily: "'Hanken Grotesk', 'Inter', sans-serif",
                      fontWeight: 400,
                      fontSize: 'clamp(15px, 1.45vw, 21px)',
                      color: '#FFFFFF',
                      lineHeight: 1.25,
                      letterSpacing: '-0.02em',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.title}
                  </p>

                  {/* Fixed 3-line slot on desktop; hidden on mobile via .vahn-lookbook-desc */}
                  <div
                    className="vahn-lookbook-desc"
                    style={{
                      width: '100%',
                      fontSize: 'clamp(11px, 0.88vw, 13px)',
                      lineHeight: 1.5,
                      height: 'calc(1.5em * 3)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontFamily: "'Lora', Georgia, serif",
                        fontWeight: 400,
                        fontStyle: 'normal',
                        fontSize: 'inherit',
                        lineHeight: 1.5,
                        color: item.description ? 'rgba(255,255,255,0.75)' : 'transparent',
                        letterSpacing: '0.01em',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        textAlign: 'center',
                      }}
                    >
                      {item.description || '\u00a0'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
