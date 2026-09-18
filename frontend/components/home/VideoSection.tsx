'use client';

import { useEffect, useRef } from 'react';

export default function VideoSection() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Ensure muted autoplay succeeds seamlessly across mobile Safari and Chromium
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {
        // Suppress autoplay policy rejection if browser pauses media in low-power mode
      });
    }
  }, []);

  return (
    <section
      aria-label="VAHN Brand Film"
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        minHeight: '420px',
        maxHeight: '85vh',
        overflow: 'hidden',
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderTop: '1px solid #ffffff',
        borderBottom: '1px solid #ffffff',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/assets/main-banner-poster.webp"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      >
        <source src="/assets/main-banner-desktop.mp4" type="video/mp4" />
        <source src="/assets/VAHN-VEGA%2026-mainfilm-01.mp4" type="video/mp4" />
      </video>
    </section>
  );
}
