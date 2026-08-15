'use client';

import React from 'react';
import Image from 'next/image';
import type { Product } from '@/lib/api/types';

interface Props {
  product: Product;
}

/**
 * Maps product fit value to the exact extracted brand illustration icon.
 */
function getFitIconSrc(fitValue: string): string {
  const n = fitValue.trim().toUpperCase();
  if (n.includes('SLIM') || n.includes('COMPRESSION')) return '/icons/highlights/fits/slim.png';
  if (n.includes('REGULAR')) return '/icons/highlights/fits/regular.png';
  if (n.includes('RELAXED') || n.includes('LOOSE')) return '/icons/highlights/fits/relaxed-fit.png';
  if (n.includes('ATHLETIC') || n.includes('PERFORMANCE')) return '/icons/highlights/fits/athletic-performance.png';
  return '/icons/highlights/fits/oversized.png';
}

/**
 * Maps product kit type value to the exact extracted brand illustration icon.
 */
function getKitTypeIconSrc(kitTypeValue: string): string {
  const n = kitTypeValue.trim().toUpperCase();
  if (n.includes('HOME')) return '/icons/highlights/kit_types/home.png';
  if (n.includes('AWAY')) return '/icons/highlights/kit_types/away.png';
  if (n.includes('JERSEY')) return '/icons/highlights/kit_types/jersey.png';
  if (n.includes('THIRD') || n.includes('ALT')) return '/icons/highlights/kit_types/third-alt.png';
  if (n.includes('TRAINING')) return '/icons/highlights/kit_types/training.png';
  return '/icons/highlights/kit_types/signature.png';
}

/**
 * Maps product activity value to the exact extracted brand illustration icon.
 */
function getActivityIconSrc(activityValue: string): string {
  const n = activityValue.trim().toUpperCase();
  if (n.includes('FOOTBALL') || n.includes('SOCCER')) return '/icons/highlights/activities/football-soccer.png';
  if (n.includes('STREETWEAR') || n.includes('URBAN')) return '/icons/highlights/activities/streetwear.png';
  if (n.includes('CRICKET')) return '/icons/highlights/activities/cricket.png';
  if (n.includes('BASKETBALL')) return '/icons/highlights/activities/basketball.png';
  if (n.includes('RUNNING') || n.includes('ATHLETICS')) return '/icons/highlights/activities/running-athletics.png';
  if (n.includes('GYM') || n.includes('FITNESS')) return '/icons/highlights/activities/gym-fitness.png';
  return '/icons/highlights/activities/lifestyle.png';
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
              <Image
                src={getFitIconSrc(fitValue)}
                alt={fitValue}
                width={48}
                height={48}
                style={{ objectFit: 'contain', width: 'auto', height: '100%', maxHeight: 46 }}
                priority
              />
            </div>
            <div className="highlight-meta">
              <span className="highlight-label">Fit</span>
              <strong className="highlight-value">{fitValue}</strong>
            </div>
          </div>

          {/* Kit Type Item */}
          <div className="highlight-item">
            <div className="highlight-icon">
              <Image
                src={getKitTypeIconSrc(kitTypeValue)}
                alt={kitTypeValue}
                width={48}
                height={48}
                style={{ objectFit: 'contain', width: 'auto', height: '100%', maxHeight: 46 }}
                priority
              />
            </div>
            <div className="highlight-meta">
              <span className="highlight-label">Kit Type</span>
              <strong className="highlight-value">{kitTypeValue}</strong>
            </div>
          </div>

          {/* Activity Item */}
          <div className="highlight-item">
            <div className="highlight-icon">
              <Image
                src={getActivityIconSrc(activityValue)}
                alt={activityValue}
                width={48}
                height={48}
                style={{ objectFit: 'contain', width: 'auto', height: '100%', maxHeight: 46 }}
                priority
              />
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
