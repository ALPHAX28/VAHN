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
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load dismissed banners from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('vahn_dismissed_banners');
      if (stored) {
        setDismissedIds(JSON.parse(stored));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Fetch active banners on mount
  useEffect(() => {
    let isMounted = true;
    async function loadActiveBanners() {
      try {
        const data = await getActiveAnnouncements();
        if (isMounted && data && Array.isArray(data)) {
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

  // Filter out banners dismissed by this user
  const visibleBanners = banners.filter((b) => b.is_active && !dismissedIds.includes(b.id));

  // Auto-cycle through multiple active banners every 4 seconds
  useEffect(() => {
    if (visibleBanners.length <= 1 || isHovered) return;

    timerRef.current = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % visibleBanners.length);
        setIsAnimating(false);
      }, 200);
    }, 4000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visibleBanners.length, isHovered]);

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (visibleBanners.length <= 1) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleBanners.length);
      setIsAnimating(false);
    }, 150);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (visibleBanners.length <= 1) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + visibleBanners.length) % visibleBanners.length);
      setIsAnimating(false);
    }, 150);
  };

  const handleDismiss = (e: React.MouseEvent, bannerId: number) => {
    e.stopPropagation();
    e.preventDefault();
    const updated = [...dismissedIds, bannerId];
    setDismissedIds(updated);
    try {
      sessionStorage.setItem('vahn_dismissed_banners', JSON.stringify(updated));
    } catch {
      // Ignore
    }
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
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        flexWrap: 'wrap',
        minHeight: '20px',
        opacity: isAnimating ? 0 : 1,
        transform: isAnimating ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
      }}
    >
      <span style={{ fontWeight: 700 }}>{currentBanner?.message}</span>
      {currentBanner?.link_text && (
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '2px',
            background: 'rgba(255, 255, 255, 0.2)',
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
        padding: visibleBanners.length > 1 ? '8px 48px' : '8px 40px 8px 16px',
        textAlign: 'center',
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '-0.025em',
        textTransform: 'uppercase',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        fontFamily: 'var(--font-heading)',
        transition: 'background-color 0.4s ease, color 0.4s ease',
        overflow: 'hidden',
        userSelect: 'none',
      }}
      role="banner"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left Arrow button (if multiple active banners) */}
      {visibleBanners.length > 1 && (
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous announcement"
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: textColor,
            opacity: 0.75,
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            transition: 'opacity 0.2s ease, transform 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.75';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {/* Clickable Destination Link or Plain Content */}
      {currentBanner?.link_url ? (
        <Link
          href={currentBanner.link_url}
          style={{
            color: 'inherit',
            textDecoration: 'none',
            display: 'block',
          }}
        >
          {bannerContent}
        </Link>
      ) : (
        bannerContent
      )}

      {/* Right controls: Next Arrow + Dismiss [✕] */}
      <div
        style={{
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 10,
        }}
      >
        {/* Right Arrow button (if multiple active banners) */}
        {visibleBanners.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next announcement"
            style={{
              background: 'none',
              border: 'none',
              color: textColor,
              opacity: 0.75,
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 0.2s ease, transform 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'scale(1.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.75';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
            style={{
              background: 'none',
              border: 'none',
              color: textColor,
              opacity: 0.75,
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              lineHeight: 1,
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.75')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
