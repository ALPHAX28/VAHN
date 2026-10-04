'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="hero-banner-section">
      {/* Real Top Banner Hero Image */}
      <div className="hero-banner-image-container">
        <Image
          src="/assets/top-banner.png"
          alt="THIS IS VAHN"
          fill
          priority
          unoptimized
          className="hero-banner-img"
        />
      </div>

      {/* Subtle bottom gradient for hero text legibility */}
      <div className="hero-banner-gradient" aria-hidden="true" />

      {/* Hero Text */}
      <div className="hero-banner-content">
        <h1 className="hero-banner-title">PLAY ON.</h1>

        <p className="hero-banner-subtitle">Built for the way you play.</p>

        <Link href="/products" className="hero-banner-btn">
          <span>Shop Now</span>
          <svg
            className="btn-checkout-arrow"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
