'use client';

import React from 'react';
import type { Product } from '@/lib/api/types';
import { 
  FaShirt, 
  FaPlane, 
  FaShieldHalved, 
  FaCrown, 
  FaHouse, 
  FaPersonRunning, 
  FaFutbol, 
  FaCompass, 
  FaGlasses, 
  FaDumbbell,
  FaBasketball,
  FaFire,
  FaWandMagicSparkles,
  FaAward,
  FaTrophy
} from 'react-icons/fa6';

import {
  GiRunningShoe,
  GiCricketBat,
  GiTrophyCup
} from 'react-icons/gi';

import {
  TbShirtSport,
  TbCompass,
  TbTargetArrow
} from 'react-icons/tb';

interface Props {
  product: Product;
}

/**
 * High-Precision Dynamic Fit Icon Renderer
 * Matches Image 1 (Slim fit t-shirt with > < arrows) & Image 2 (Oversized)
 */
function renderFitIcon(fitValue: string) {
  const normalized = fitValue.trim().toUpperCase();

  if (normalized.includes('SLIM') || normalized.includes('COMPRESSION')) {
    // Detailed Athletic T-Shirt with inward tapered fit arrows (> <) (Image 1)
    return (
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 48 48" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Crew Collar & Athletic Sleeves */}
          <path d="M17 10 C21 13, 27 13, 31 10" />
          <path d="M17 10 L8 14 L11 20 L15 18 L15 39 L33 39 L33 18 L37 20 L40 14 L32 10" />
          {/* Fit Arrows > < */}
          <path d="M19 25 L21 27 L19 29" strokeWidth="2.4" />
          <path d="M29 25 L27 27 L29 29" strokeWidth="2.4" />
        </svg>
      </div>
    );
  }

  if (normalized.includes('OVERSIZED') || normalized.includes('RELAXED') || normalized.includes('LOOSE')) {
    // Drop-shoulder wide boxy jersey silhouette (Image 2)
    return (
      <svg viewBox="0 0 48 48" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 10 C20 13, 28 13, 34 10" />
        <path d="M14 10 L4 15 L8 24 L13 21 L13 40 L35 40 L35 21 L40 24 L44 15 L34 10" />
        <path d="M20 27 H16 M16 24 V30" strokeWidth="2" />
        <path d="M28 27 H32 M32 24 V30" strokeWidth="2" />
      </svg>
    );
  }

  if (normalized.includes('ATHLETIC') || normalized.includes('PERFORMANCE')) {
    return <TbShirtSport size={38} strokeWidth={2} color="currentColor" />;
  }

  // Default Jersey Shirt Icon
  return <FaShirt size={34} color="currentColor" />;
}

/**
 * High-Precision Dynamic Kit Type Icon Renderer
 * Matches Image 1 (Away Kit Jersey with Airplane) & Image 2 (Signature Shield (+))
 */
function renderKitTypeIcon(kitTypeValue: string) {
  const normalized = kitTypeValue.trim().toUpperCase();

  if (normalized.includes('AWAY')) {
    // Away Kit: Short-sleeve jersey with an airplane flying out at bottom right (Image 1)
    return (
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 48 48" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {/* Jersey Body */}
          <path d="M16 10 C20 13, 28 13, 32 10" />
          <path d="M16 10 L8 14 L11 20 L15 18 L15 38 L27 38 M33 18 L37 20 L40 14 L32 10" />
          <circle cx="20" cy="17" r="1.8" fill="currentColor" />
          {/* Flying Airplane Badge */}
          <path d="M29 32 L41 27 L38 37 L34 34 L32 37 L31 34 L27 33 Z" strokeWidth="1.8" fill="currentColor" fillOpacity="0.1" />
        </svg>
      </div>
    );
  }

  if (normalized.includes('HOME')) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <FaHouse size={32} color="currentColor" />
      </div>
    );
  }

  if (normalized.includes('SIGNATURE') || normalized.includes('COLLECTOR') || normalized.includes('LIMITED')) {
    // Signature Emblem Shield with (+) Center (Image 2)
    return <FaShieldHalved size={34} color="currentColor" />;
  }

  if (normalized.includes('THIRD') || normalized.includes('ALT')) {
    return <FaWandMagicSparkles size={34} color="currentColor" />;
  }

  if (normalized.includes('TRAINING')) {
    return <FaFire size={34} color="currentColor" />;
  }

  // Default Trophy Cup / Jersey Badge
  return <FaTrophy size={34} color="currentColor" />;
}

/**
 * High-Precision Dynamic Activity Icon Renderer
 * Matches Image 1 (Running Football Player & Ball) & Image 2 (Compass)
 */
function renderActivityIcon(activityValue: string) {
  const normalized = activityValue.trim().toUpperCase();

  if (normalized.includes('FOOTBALL') || normalized.includes('SOCCER')) {
    // High-Detail Running Football Player with Soccer Ball at Feet (Image 1)
    return (
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 48 48" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {/* Player Head */}
          <circle cx="28" cy="8" r="3.2" fill="currentColor" fillOpacity="0.2" />
          {/* Running Arms */}
          <path d="M28 11.2 L22 17.5 L14 14.5" />
          <path d="M22 17.5 L30 22 L36 18" />
          {/* Running Stance Legs */}
          <path d="M22 17.5 L18 28.5 L11 35.5" />
          <path d="M18 28.5 L26 34.5 L22 41" />
          {/* Football Ball at Feet */}
          <circle cx="34" cy="38" r="4.5" strokeWidth="2" />
          <polygon points="34,35 36,37 35,39.5 33,39.5 32,37" strokeWidth="1.2" fill="currentColor" />
        </svg>
      </div>
    );
  }

  if (normalized.includes('STREETWEAR') || normalized.includes('URBAN')) {
    return <FaGlasses size={34} color="currentColor" />;
  }

  if (normalized.includes('LIFESTYLE') || normalized.includes('CASUAL')) {
    // Compass Lifestyle Pointer (Image 2)
    return <TbCompass size={36} strokeWidth={1.8} color="currentColor" />;
  }

  if (normalized.includes('BASKETBALL')) {
    return <FaBasketball size={34} color="currentColor" />;
  }

  if (normalized.includes('CRICKET')) {
    return <GiCricketBat size={36} color="currentColor" />;
  }

  if (normalized.includes('RUNNING') || normalized.includes('ATHLETICS')) {
    return <GiRunningShoe size={36} color="currentColor" />;
  }

  if (normalized.includes('GYM') || normalized.includes('FITNESS')) {
    return <FaDumbbell size={34} color="currentColor" />;
  }

  // Default Activity Compass
  return <FaCompass size={34} color="currentColor" />;
}

export default function ProductHighlights({ product }: Props) {
  // Extract backend DB fields with dynamic fallbacks
  const fitValue = product.fit ?? (product.tags.find(t => ['slim', 'oversized', 'regular'].includes(t.toLowerCase()))?.toUpperCase() || 'OVERSIZED');
  const kitTypeValue = product.kitType ?? (product.productType ? product.productType.toUpperCase() : 'SIGNATURE');
  const activityValue = product.activity ?? 'LIFESTYLE';

  return (
    <section className="product-highlights-section">
      <div className="container">
        <div className="product-highlights-grid">
          {/* Fit Item */}
          <div className="highlight-item">
            <div className="highlight-icon">
              {renderFitIcon(fitValue)}
            </div>
            <div className="highlight-meta">
              <span className="highlight-label">Fit</span>
              <strong className="highlight-value">{fitValue}</strong>
            </div>
          </div>

          {/* Kit Type Item */}
          <div className="highlight-item">
            <div className="highlight-icon">
              {renderKitTypeIcon(kitTypeValue)}
            </div>
            <div className="highlight-meta">
              <span className="highlight-label">Kit Type</span>
              <strong className="highlight-value">{kitTypeValue}</strong>
            </div>
          </div>

          {/* Activity Item */}
          <div className="highlight-item">
            <div className="highlight-icon">
              {renderActivityIcon(activityValue)}
            </div>
            <div className="highlight-meta">
              <span className="highlight-label">Activity</span>
              <strong className="highlight-value">{activityValue}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
