'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import type { Image as ShopifyImage } from '@/lib/api/types';

interface Props {
  images: ShopifyImage[];
  productTitle: string;
}

export default function ProductMediaGallery({ images, productTitle }: Props) {
  const [showAllImages, setShowAllImages] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // Drag tracking refs
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentDeltaXRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const activeIndexRef = useRef(0);

  // Keep activeIndexRef in sync with state
  useEffect(() => {
    activeIndexRef.current = mobileActiveIndex;
  }, [mobileActiveIndex]);

  // Synchronize CSS transform whenever mobileActiveIndex changes (when not actively dragging)
  useEffect(() => {
    if (stripRef.current && !isDraggingRef.current) {
      stripRef.current.style.transition = 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)';
      stripRef.current.style.transform = `translateX(-${mobileActiveIndex * 100}%)`;
    }
  }, [mobileActiveIndex]);

  // Reset to slide 0 when images change
  useEffect(() => {
    setMobileActiveIndex(0);
    activeIndexRef.current = 0;
    if (stripRef.current) {
      stripRef.current.style.transition = 'none';
      stripRef.current.style.transform = 'translateX(0%)';
    }
  }, [images]);

  // Drag start
  const handleDragStart = (clientX: number, clientY: number) => {
    if (!stripRef.current) return;
    isDraggingRef.current = true;
    isHorizontalSwipeRef.current = null;
    startXRef.current = clientX;
    startYRef.current = clientY;
    currentDeltaXRef.current = 0;
    stripRef.current.style.transition = 'none';
  };

  // Drag move (reactive 1:1 finger tracking: both images visible side-by-side!)
  const handleDragMove = (clientX: number, clientY: number, e?: TouchEvent | React.MouseEvent) => {
    if (!isDraggingRef.current || !stripRef.current) return;
    const deltaX = clientX - startXRef.current;
    const deltaY = clientY - startYRef.current;

    // Detect gesture orientation on first move > 6px
    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        isHorizontalSwipeRef.current = Math.abs(deltaX) >= Math.abs(deltaY);
      }
    }

    if (!isHorizontalSwipeRef.current) {
      return;
    }

    // Lock out vertical scroll during horizontal gallery swipe
    if (e && 'cancelable' in e && e.cancelable) {
      e.preventDefault();
    }

    const containerWidth = containerRef.current?.clientWidth || stripRef.current.clientWidth || 360;
    let effectiveDeltaX = deltaX;

    // Rubber-band resistance when dragging beyond first or last slide
    const currentIndex = activeIndexRef.current;
    if (
      (currentIndex === 0 && deltaX > 0) ||
      (currentIndex === images.length - 1 && deltaX < 0)
    ) {
      effectiveDeltaX = deltaX * 0.3;
    }

    currentDeltaXRef.current = effectiveDeltaX;

    // Direct 1:1 translation: both images slide side-by-side in real-time!
    const basePercent = -currentIndex * 100;
    const deltaPercent = (effectiveDeltaX / containerWidth) * 100;
    stripRef.current.style.transform = `translateX(${basePercent + deltaPercent}%)`;
  };

  // Drag end (snaps to next/prev slide or springs back)
  const handleDragEnd = () => {
    if (!isDraggingRef.current || !stripRef.current) return;
    isDraggingRef.current = false;

    if (!isHorizontalSwipeRef.current) {
      isHorizontalSwipeRef.current = null;
      return;
    }
    isHorizontalSwipeRef.current = null;

    const containerWidth = containerRef.current?.clientWidth || stripRef.current.clientWidth || 360;
    const deltaX = currentDeltaXRef.current;
    currentDeltaXRef.current = 0;

    const threshold = Math.min(containerWidth * 0.16, 50); // 16% of width or 50px
    const currentIndex = activeIndexRef.current;
    let targetIndex = currentIndex;

    if (deltaX < -threshold && currentIndex < images.length - 1) {
      targetIndex = currentIndex + 1;
    } else if (deltaX > threshold && currentIndex > 0) {
      targetIndex = currentIndex - 1;
    }

    // Animate smoothly to target
    stripRef.current.style.transition = 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)';
    stripRef.current.style.transform = `translateX(-${targetIndex * 100}%)`;
    setMobileActiveIndex(targetIndex);
  };

  // Attach touch listeners to container with passive: false for smooth non-blocking horizontal swipe
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY, e);
    };

    const onTouchEnd = () => {
      handleDragEnd();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [images.length]);

  // Mouse drag support for desktop/DevTools
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    handleDragMove(e.clientX, e.clientY, e);
  };

  const onMouseUp = () => {
    handleDragEnd();
  };

  const gridRef = useRef<HTMLDivElement>(null);
  const toggleShowMore = () => {
    if (!showAllImages) {
      setShowAllImages(true);
      setTimeout(() => {
        // Smoothly scroll down slightly to bring the newly expanded images into immediate view
        window.scrollBy({ top: 380, behavior: 'smooth' });
      }, 60);
    } else {
      setShowAllImages(false);
      gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const displayImages = showAllImages ? images : images.slice(0, 4);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  const nextLightboxImage = useCallback(() => {
    if (lightboxIndex !== null && images.length > 0) {
      setLightboxIndex((lightboxIndex + 1) % images.length);
    }
  }, [lightboxIndex, images.length]);

  const prevLightboxImage = useCallback(() => {
    if (lightboxIndex !== null && images.length > 0) {
      setLightboxIndex((lightboxIndex - 1 + images.length) % images.length);
    }
  }, [lightboxIndex, images.length]);

  // Keyboard navigation for Lightbox Modal
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextLightboxImage();
      if (e.key === 'ArrowLeft') prevLightboxImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, nextLightboxImage, prevLightboxImage]);

  if (!images.length) {
    return (
      <div
        className="product-gallery"
        style={{ background: 'var(--color-grey-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <span style={{ color: 'var(--color-grey-dark)' }}>No image</span>
      </div>
    );
  }

  return (
    <>
      <div className="product-gallery">
        {/* Desktop: 2-Column Grid with Portrait 3:4 Aspect Ratio */}
        <div className="adidas-gallery-desktop">
          <div ref={gridRef} className="adidas-grid-container">
            {displayImages.map((img, i) => (
              <div
                key={i}
                className="adidas-grid-item"
                onClick={() => openLightbox(i)}
                style={{
                  cursor: 'pointer',
                  animation: i >= 4 ? 'fadeIn 0.35s ease-out' : undefined,
                }}
              >
                <Image
                  src={img.url}
                  alt={img.altText ?? `${productTitle} view ${i + 1}`}
                  fill
                  sizes="(min-width: 768px) 30vw, 50vw"
                  className="adidas-grid-image"
                  priority={i === 0}
                />
              </div>
            ))}
          </div>

          {/* "Show More / Show Less" Button for Desktop Grid */}
          {images.length > 4 && (
            <div className="adidas-show-more-wrapper">
              <button
                className="adidas-show-more-btn"
                onClick={toggleShowMore}
                aria-expanded={showAllImages}
              >
                <span>{showAllImages ? 'Show less' : 'Show more'}</span>
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
                    transform: showAllImages ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Mobile: 1:1 Reactive Finger-Tracking Carousel with Pill Dots */}
        <div className="adidas-gallery-mobile">
          <div
            ref={containerRef}
            className="product-gallery-main-container"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <div
              ref={stripRef}
              className="gallery-strip"
            >
              {images.map((img, i) => (
                <div
                  key={i}
                  className="gallery-strip-slide"
                >
                  <Image
                    src={img.url}
                    alt={img.altText ?? `${productTitle} view ${i + 1}`}
                    fill
                    sizes="100vw"
                    className="product-gallery-main"
                    priority={i === 0}
                    draggable={false}
                    style={{ objectFit: 'cover' }}
                  />
                </div>
              ))}
            </div>

            {images.length > 1 && (
              <div
                className="mobile-gallery-dots"
                role="tablist"
                aria-label="Product image slides"
              >
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    role="tab"
                    aria-selected={idx === mobileActiveIndex}
                    aria-label={`Go to slide ${idx + 1} of ${images.length}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMobileActiveIndex(idx);
                    }}
                    className={`mobile-gallery-dot ${idx === mobileActiveIndex ? 'active' : ''}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-Screen Lightbox Carousel Modal */}
      {lightboxIndex !== null && (
        <div className="lightbox-modal-overlay" onClick={closeLightbox}>
          <div className="lightbox-modal-container" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              className="lightbox-close-btn"
              onClick={closeLightbox}
              aria-label="Close Lightbox"
            >
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Back Arrow */}
            {images.length > 1 && (
              <button
                className="lightbox-nav-btn lightbox-nav-btn--prev"
                onClick={prevLightboxImage}
                aria-label="Previous Image"
              >
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}

            {/* Main Lightbox Image View */}
            <div className="lightbox-image-wrapper">
              <Image
                src={images[lightboxIndex].url}
                alt={images[lightboxIndex].altText ?? `${productTitle} preview`}
                fill
                sizes="100vw"
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>

            {/* Forward Arrow */}
            {images.length > 1 && (
              <button
                className="lightbox-nav-btn lightbox-nav-btn--next"
                onClick={nextLightboxImage}
                aria-label="Next Image"
              >
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}

            {/* Bottom Carousel Thumbnails Track */}
            {images.length > 1 && (
              <div className="lightbox-thumbs-track">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    className={`lightbox-thumb-btn ${idx === lightboxIndex ? 'active' : ''}`}
                    onClick={() => setLightboxIndex(idx)}
                  >
                    <Image
                      src={img.url}
                      alt={`Thumbnail ${idx + 1}`}
                      width={54}
                      height={54}
                      style={{ objectFit: 'cover' }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
