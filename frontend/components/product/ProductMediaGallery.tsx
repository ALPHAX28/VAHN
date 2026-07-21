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
  const gridRef = useRef<HTMLDivElement>(null);
  const [collapsedHeight, setCollapsedHeight] = useState<number | null>(null);

  // Measure exact 2x2 grid height when collapsed to lock outer container height when expanded
  useEffect(() => {
    if (!showAllImages && gridRef.current) {
      const h = gridRef.current.clientHeight;
      if (h > 0) {
        setCollapsedHeight(h);
      }
    }
  }, [showAllImages]);

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
        {/* Desktop: Adidas-style 2-Column Grid */}
        <div className="adidas-gallery-desktop">
          <div
            ref={gridRef}
            className="adidas-grid-container"
            style={
              showAllImages && collapsedHeight
                ? {
                    maxHeight: `${collapsedHeight}px`,
                    overflowY: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  }
                : {}
            }
          >
            {displayImages.map((img, i) => (
              <div
                key={i}
                className="adidas-grid-item"
                onClick={() => openLightbox(i)}
                style={{ cursor: 'pointer' }}
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

          {/* "Show More" Button for Desktop Grid */}
          {images.length > 4 && (
            <div className="adidas-show-more-wrapper">
              <button
                className="adidas-show-more-btn"
                onClick={() => setShowAllImages(!showAllImages)}
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

        {/* Mobile: Carousel View */}
        <div className="adidas-gallery-mobile">
          <div className="product-gallery-main-container">
            <div
              className="gallery-strip"
              style={{ transform: `translateX(-${mobileActiveIndex * 100}%)` }}
            >
              {images.map((img, i) => (
                <div
                  key={i}
                  className="gallery-strip-slide"
                  onClick={() => openLightbox(i)}
                >
                  <Image
                    src={img.url}
                    alt={img.altText ?? `${productTitle} view ${i + 1}`}
                    fill
                    sizes="100vw"
                    className="product-gallery-main"
                    priority={i === 0}
                    style={{ objectFit: 'cover' }}
                  />
                </div>
              ))}
            </div>

            {images.length > 1 && (
              <>
                <button
                  className="gallery-nav-btn gallery-nav-btn--prev"
                  onClick={() => setMobileActiveIndex((mobileActiveIndex - 1 + images.length) % images.length)}
                  aria-label="Previous image"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  className="gallery-nav-btn gallery-nav-btn--next"
                  onClick={() => setMobileActiveIndex((mobileActiveIndex + 1) % images.length)}
                  aria-label="Next image"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </>
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
