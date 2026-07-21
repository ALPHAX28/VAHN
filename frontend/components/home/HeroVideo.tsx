'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);

  return (
    <section
      className="hero"
      aria-label="Hero banner"
      style={{
        background: 'var(--color-black)',
        backgroundImage: videoError
          ? 'url(/assets/bull-banner.png)'
          : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        height: '100svh',
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      {/* Background Video */}
      {!videoError && (
        <div className="hero-media" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/assets/hero-video-poster.jpg"
            onError={() => setVideoError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          >
            <source src="/assets/hero-video.mp4" type="video/mp4" />
          </video>
        </div>
      )}

      {/* Overlay */}
      <div
        className="hero-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.1) 60%, transparent 100%)',
          zIndex: 1,
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="hero-content" style={{ position: 'relative', zIndex: 2 }}>
        <h1
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontWeight: 400,
            fontStyle: 'italic',
            textTransform: 'none',
            letterSpacing: '0.02em',
            color: 'var(--color-white)',
            marginBottom: 'var(--space-lg)',
            fontSize: 'clamp(1.5rem, 5vw, 3.5rem)',
          }}
        >
          this is where it starts
        </h1>
        <Link
          href="/collections/vahn-beginning"
          className="btn btn-white"
          style={{ letterSpacing: '0.12em' }}
        >
          Shop Collection
        </Link>
      </div>
    </section>
  );
}
