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
  const [isAnimating, setIsAnimating] = useState(false);
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

  // Auto-scroll / slide rotation every 4 seconds when multiple banners are active
  useEffect(() => {
    if (visibleBanners.length <= 1 || isHovered) return;

    timerRef.current = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % visibleBanners.length);
        setIsAnimating(false);
      }, 300);
    }, 4200);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visibleBanners.length, isHovered]);

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleBanners.length);
      setIsAnimating(false);
    }, 200);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + visibleBanners.length) % visibleBanners.length);
      setIsAnimating(false);
    }, 200);
  };

  const handleDismiss = (e: React.MouseEvent, bannerId: number) => {
    e.stopPropagation();
    e.preventDefault();
    // Dismiss ONLY in memory for current page view — reappears on refresh!
    setDismissedIds((prev) => [...prev, bannerId]);
  };

  // If no custom active banners or dismissed, show standard default banner
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
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: '#000000',
          fontFamily: 'var(--font-heading)',
        }}
        role="banner"
      >
        SHIPPING PAN INDIA
      </div>
    );
  }

  const currentBanner = visibleBanners[currentIndex % visibleBanners.length];
  const bg = currentBanner?.bg_color || '#000000';
  const textColor = currentBanner?.text_color || '#ffffff';

  const bannerContent = (
    <div
      className={`vahn-banner-content ${isAnimating ? 'vahn-banner-slide-out' : 'vahn-banner-slide-in'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        flexWrap: 'wrap',
        minHeight: '20px',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
      }}
    >
      <span style={{ fontWeight: 700, letterSpacing: '-0.025em' }}>{currentBanner?.message}</span>
      {currentBanner?.link_text && (
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
          {currentBanner.link_text}
          <span>→</span>
        </span>
      )}
    </div>
  );

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: bg,
        color: textColor,
        padding: visibleBanners.length > 1 ? '8px 56px' : '8px 40px 8px 16px',
        textAlign: 'center',
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '-0.025em',
        textTransform: 'uppercase',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        fontFamily: 'var(--font-heading)',
        transition: 'background-color 0.4s ease, color 0.4s ease',
        overflow: 'hidden',
        minHeight: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
          aria-label="Previous announcement"
          style={{
            position: 'absolute',
            left: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: textColor,
            opacity: 0.6,
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.2s ease, transform 0.15s ease',
            zIndex: 3,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.6';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {/* Main Content (Clickable Link or Static) */}
      <div style={{ width: '100%', overflow: 'hidden', textAlign: 'center' }}>
        {currentBanner?.link_url ? (
          <Link
            href={currentBanner.link_url}
            style={{
              color: 'inherit',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            {bannerContent}
          </Link>
        ) : (
          bannerContent
        )}
      </div>

      {/* Right Arrow Button for multiple banners */}
      {visibleBanners.length > 1 && (
        <button
          type="button"
          onClick={handleNext}
          aria-label="Next announcement"
          style={{
            position: 'absolute',
            right: currentBanner?.is_closable ? '34px' : '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: textColor,
            opacity: 0.6,
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.2s ease, transform 0.15s ease',
            zIndex: 3,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.6';
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
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: textColor,
            opacity: 0.7,
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.2s ease',
            zIndex: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* Inline styles for smooth vertical sliding marquee effect */}
      <style jsx>{`
        .vahn-banner-slide-in {
          animation: vahnSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .vahn-banner-slide-out {
          animation: vahnSlideOut 0.3s cubic-bezier(0.7, 0, 0.84, 0) forwards;
        }

        @keyframes vahnSlideIn {
          0% {
            opacity: 0;
            transform: translateY(12px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes vahnSlideOut {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-12px);
          }
        }
      `}</style>
    </div>
  );
}
