'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Image as ShopifyImage } from '@/lib/api/types';

interface Props {
  images: ShopifyImage[];
  productTitle: string;
}

export default function ProductMediaGallery({ images, productTitle }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  const navigate = (newIndex: number) => {
    setActiveIndex(newIndex);
  };

  const prev = () => navigate((activeIndex - 1 + images.length) % images.length);
  const next = () => navigate((activeIndex + 1) % images.length);
  const goTo = (i: number) => navigate(i);

  if (!images.length) {
    return (
      <div
        className="product-gallery"
        style={{ background: 'var(--color-grey-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <span style={{ color: 'var(--color-grey-dark)' }}>No image</span>
      </div>
    );
  }

  return (
    <div className="product-gallery">
      {/* Main image carousel */}
      <div className="product-gallery-main-container">
        {/* Sliding strip — all images in a row */}
        <div
          className="gallery-strip"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {images.slice(0, 8).map((img, i) => (
            <div key={i} className="gallery-strip-slide">
              <Image
                src={img.url}
                alt={img.altText ?? `${productTitle} view ${i + 1}`}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
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
              onClick={prev}
              aria-label="Previous image"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              className="gallery-nav-btn gallery-nav-btn--next"
              onClick={next}
              aria-label="Next image"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {/* Dot indicators */}
            <div className="gallery-dots">
              {images.slice(0, 8).map((_, i) => (
                <button
                  key={i}
                  className={`gallery-dot ${i === activeIndex ? 'active' : ''}`}
                  onClick={() => goTo(i)}
                  aria-label={`Go to image ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="product-gallery-thumbs">
          {images.slice(0, 8).map((img, i) => (
            <Image
              key={i}
              src={img.url}
              alt={img.altText ?? `${productTitle} view ${i + 1}`}
              width={64}
              height={64}
              className={`product-gallery-thumb ${i === activeIndex ? 'active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
