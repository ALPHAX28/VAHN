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
          Shop Now
        </Link>
      </div>
    </section>
  );
}
