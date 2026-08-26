'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { NotificationBanner } from '@/lib/api/types';
import { getActiveAnnouncements } from '@/lib/api';

interface Props {
  initialBanners?: NotificationBanner[];
}

export default function AnnouncementBanner({ initialBanners = [] }: Props) {
  const [banners, setBanners] = useState<NotificationBanner[]>(initialBanners);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<number[]>([]); // In-memory only: resets on page refresh!
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch active banners on mount
  useEffect(() => {
    let isMounted = true;
    async function loadActiveBanners() {
      try {
        const data = await getActiveAnnouncements();
        if (isMounted && data) {
          setBanners(data);
        }
      } catch {
        // Graceful fallback
      }
    }
    loadActiveBanners();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter out banners dismissed during this page view only (resets on refresh)
  const visibleBanners = banners.filter((b) => !dismissedIds.includes(b.id));

  // Reset index if it exceeds visible count
  useEffect(() => {
    if (visibleBanners.length > 0 && currentIndex >= visibleBanners.length) {
      setCurrentIndex(0);
    }
  }, [visibleBanners.length, currentIndex]);

  // True Horizontal Auto-Slide Carousel every 4.5 seconds when multiple banners are active
  useEffect(() => {
    if (visibleBanners.length <= 1 || isHovered) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleBanners.length);
    }, 4500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visibleBanners.length, isHovered]);

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentIndex((prev) => (prev + 1) % visibleBanners.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentIndex((prev) => (prev - 1 + visibleBanners.length) % visibleBanners.length);
  };

  const handleDismiss = (e: React.MouseEvent, bannerId: number) => {
    e.stopPropagation();
    e.preventDefault();
    // Dismiss ONLY in memory for current page view — reappears on refresh!
    setDismissedIds((prev) => [...prev, bannerId]);
  };

  // If no custom active banners or all dismissed, show standard default banner
  if (visibleBanners.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '8px 16px',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '-0.025em',
          textTransform: 'uppercase',
          color: 'rgba(255, 255, 255, 0.9)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#111111',
          fontFamily: 'var(--font-heading)',
        }}
        role="banner"
      >
        SHIPPING PAN INDIA
      </div>
    );
  }

  const currentBanner = visibleBanners[currentIndex % visibleBanners.length];
  const bg = currentBanner?.bg_color || '#111111';
  const textColor = currentBanner?.text_color || '#ffffff';

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: bg,
        color: textColor,
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        fontFamily: 'var(--font-heading)',
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '-0.025em',
        textTransform: 'uppercase',
        transition: 'background-color 0.45s ease, color 0.45s ease',
        overflow: 'hidden',
        height: '36px',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
      }}
      role="banner"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left Arrow Button for multiple banners */}
      {visibleBanners.length > 1 && (
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous banner"
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: textColor,
            opacity: 0.65,
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.65';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {/* True Horizontal Slide Track */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          transform: `translateX(-${currentIndex * 100}%)`,
          transition: 'transform 0.55s cubic-bezier(0.25, 1, 0.5, 1)',
          willChange: 'transform',
        }}
      >
        {visibleBanners.map((banner) => {
          const content = (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontWeight: 700, letterSpacing: '-0.025em' }}>{banner.message}</span>
              {banner.link_text && (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '2px',
                    background: 'rgba(255, 255, 255, 0.22)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  {banner.link_text}
                  <span>→</span>
                </span>
              )}
            </div>
          );

          return (
            <div
              key={banner.id}
              style={{
                flex: '0 0 100%',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: visibleBanners.length > 1 ? '0 52px' : '0 32px',
                textAlign: 'center',
                boxSizing: 'border-box',
              }}
            >
              {banner.link_url ? (
                <Link
                  href={banner.link_url}
                  style={{
                    color: 'inherit',
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  {content}
                </Link>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>

      {/* Right Arrow Button for multiple banners */}
      {visibleBanners.length > 1 && (
        <button
          type="button"
          onClick={handleNext}
          aria-label="Next banner"
          style={{
            position: 'absolute',
            right: currentBanner?.is_closable ? '36px' : '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: textColor,
            opacity: 0.65,
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.65';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* Dismiss [✕] button if banner is configured as closable */}
      {currentBanner?.is_closable && (
        <button
          type="button"
          onClick={(e) => handleDismiss(e, currentBanner.id)}
          aria-label="Dismiss banner"
          title="Dismiss banner"
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: textColor,
            opacity: 0.75,
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.2s ease',
            zIndex: 11,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.75')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
