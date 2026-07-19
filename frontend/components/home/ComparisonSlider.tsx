'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function ComparisonSlider() {
  const [sliderPosition, setSliderPosition] = useState(50); // 0 to 100%
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = React.useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(position);
  }, []);

  const handleTouchMove = React.useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  }, [isDragging, handleMove]);

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  }, [isDragging, handleMove]);

  const handleMouseUp = React.useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  return (
    <section
      className="home-section-padding"
      style={{
        background: 'var(--color-white)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-xl)',
      }}
      aria-label="Design comparison"
    >
      {/* Headings */}
      <div style={{ textAlign: 'center', padding: '0 var(--space-md)', maxWidth: '640px' }}>
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(2rem, 4vw, 3.5rem)',
            textTransform: 'uppercase',
            marginBottom: '12px',
            color: 'var(--color-black)',
            letterSpacing: '-0.02em',
          }}
        >
          VAHN TEAMWEAR
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.25rem',
            lineHeight: 1.6,
            color: 'var(--color-grey-dark)',
          }}
        >
          Turn your Vision into Professional Teamwear. READY FOR THE FIELD.
        </p>
      </div>

      {/* Slider Container */}
      <div
        ref={containerRef}
        className="comparison-slider-container"
        onMouseDown={(e) => {
          setIsDragging(true);
          handleMove(e.clientX);
        }}
        onTouchStart={(e) => {
          setIsDragging(true);
          handleMove(e.touches[0].clientX);
        }}
      >
        {/* Before Image (Background) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            backgroundImage: 'url(/assets/slider-before.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        {/* After Image (Foreground, clipped) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            backgroundImage: 'url(/assets/slider-after.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)`,
          }}
        />

        {/* Slider Handle Line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${sliderPosition}%`,
            width: '2px',
            background: '#ffffff',
            zIndex: 10,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
        >
          {/* Slider Handle circle button */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#ffffff',
              border: '2px solid var(--color-black)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
            </svg>
          </div>
        </div>
      </div>

      {/* Button CTA */}
      <div style={{ marginTop: '12px' }}>
        <Link href="/pages/contact" className="btn btn-primary">
          Start Your Team Order
        </Link>
      </div>
    </section>
  );
}
