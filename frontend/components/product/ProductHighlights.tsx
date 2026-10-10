'use client';

import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { type AttributeOption, getAttributeOptions } from '@/lib/api/admin';
import type { Product } from '@/lib/api/types';

interface Props {
  product: Product;
}

/**
 * Maps product fit value to the exact brand illustration icon.
 */
function getFitIconSrc(fitValue: string, customIcon?: string | null, category?: string): string {
  if (customIcon) return customIcon;
  const n = fitValue.trim().toUpperCase();
  const isBottoms = category?.toUpperCase() === 'BOTTOMS';

  if (isBottoms) {
    if (n.includes('SLIM') || n.includes('COMPRESSION') || n.includes('TAPERED'))
      return '/icons/highlights/fits/bottoms-slim.png';
    if (n.includes('REGULAR')) return '/icons/highlights/fits/bottoms-regular.png';
    if (n.includes('RELAXED') || n.includes('LOOSE')) return '/icons/highlights/fits/bottoms-relaxed.png';
    return '/icons/highlights/fits/bottoms-regular.png';
  }

  if (n.includes('SLIM') || n.includes('COMPRESSION')) return '/icons/highlights/fits/slim.png';
  if (n.includes('REGULAR')) return '/icons/highlights/fits/regular.png';
  if (n.includes('RELAXED') || n.includes('LOOSE')) return '/icons/highlights/fits/relaxed-fit.png';
  if (n.includes('ATHLETIC') || n.includes('PERFORMANCE'))
    return '/icons/highlights/fits/athletic-performance.png';
  return '/icons/highlights/fits/oversized.png';
}

/**
 * Maps product kit type value to the exact brand illustration icon.
 */
function getKitTypeIconSrc(kitTypeValue: string, customIcon?: string | null): string {
  if (customIcon) return customIcon;
  const n = kitTypeValue.trim().toUpperCase();
  if (n.includes('HOME')) return '/icons/highlights/kit_types/home.png';
  if (n.includes('AWAY')) return '/icons/highlights/kit_types/away.png';
  if (n.includes('JERSEY')) return '/icons/highlights/kit_types/jersey.png';
  if (n.includes('THIRD') || n.includes('ALT')) return '/icons/highlights/kit_types/third-alt.png';
  if (n.includes('TRAINING')) return '/icons/highlights/kit_types/training.png';
  return '/icons/highlights/kit_types/signature.png';
}

/**
 * Maps product activity value to the exact brand illustration icon.
 */
function getActivityIconSrc(activityValue: string, customIcon?: string | null): string {
  if (customIcon) return customIcon;
  const n = activityValue.trim().toUpperCase();
  if (n.includes('FOOTBALL') || n.includes('SOCCER'))
    return '/icons/highlights/activities/football-soccer.png';
  if (n.includes('STREETWEAR') || n.includes('URBAN'))
    return '/icons/highlights/activities/streetwear.png';
  if (n.includes('CRICKET')) return '/icons/highlights/activities/cricket.png';
  if (n.includes('BASKETBALL')) return '/icons/highlights/activities/basketball.png';
  if (n.includes('RUNNING') || n.includes('ATHLETICS'))
    return '/icons/highlights/activities/running-athletics.png';
  if (n.includes('GYM') || n.includes('FITNESS'))
    return '/icons/highlights/activities/gym-fitness.png';
  return '/icons/highlights/activities/lifestyle.png';
}

interface HighlightBadge {
  id: string;
  label: string;
  value: string;
  iconSrc: string;
}

export default function ProductHighlights({ product }: Props) {
  const [dbOptions, setDbOptions] = useState<AttributeOption[]>([]);
  const category = (product.category || 'TOPS').toUpperCase();

  useEffect(() => {
    getAttributeOptions(category)
      .then(setDbOptions)
      .catch(() => {});
  }, [category]);

  const findCustomIcon = (type: string, val?: string | null): string | null => {
    if (!val) return null;
    const clean = val.trim().toLowerCase();
    const match = dbOptions.find(
      (opt) =>
        opt.attribute_type === type &&
        (opt.name.toLowerCase() === clean || opt.code.toLowerCase() === clean)
    );
    return match?.icon_url || null;
  };

  const badges: HighlightBadge[] = [];

  // 1. Fit Badge: Applicable to TOPS and BOTTOMS (hidden for ACCESSORIES)
  if (category !== 'ACCESSORIES') {
    const rawFit =
      product.fit ??
      product.tags
        ?.find((t) => ['slim', 'oversized', 'regular'].includes(t.toLowerCase()))
        ?.toUpperCase();
    if (rawFit) {
      badges.push({
        id: 'fit',
        label: 'Fit',
        value: rawFit,
        iconSrc: getFitIconSrc(rawFit, findCustomIcon('FIT', rawFit), category),
      });
    }
  }

  // 2. Kit Type Badge: Applicable strictly to TOPS (hidden for BOTTOMS and ACCESSORIES)
  if (category === 'TOPS') {
    const rawKit = product.kitType;
    if (rawKit) {
      badges.push({
        id: 'kit_type',
        label: 'Kit Type',
        value: rawKit,
        iconSrc: getKitTypeIconSrc(rawKit, findCustomIcon('KIT_TYPE', rawKit)),
      });
    }
  }

  // 3. Activity Badge: Universal across all categories if defined
  const rawActivity = product.activity ?? (category === 'TOPS' ? 'LIFESTYLE' : null);
  if (rawActivity) {
    badges.push({
      id: 'activity',
      label: 'Activity',
      value: rawActivity,
      iconSrc: getActivityIconSrc(rawActivity, findCustomIcon('ACTIVITY', rawActivity)),
    });
  }

  // If no attributes exist, don't render empty highlight block
  if (badges.length === 0) return null;

  return (
    <section className="product-highlights-section">
      <div className="container">
        <div
          className="product-highlights-grid"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '24px',
          }}
        >
          {badges.map((b) => (
            <div
              key={b.id}
              className="highlight-item"
              style={{
                flex:
                  badges.length === 1
                    ? '0 1 240px'
                    : badges.length === 2
                      ? '0 1 220px'
                      : '1 1 180px',
                maxWidth: '280px',
              }}
            >
              <div className="highlight-icon">
                <Image
                  src={b.iconSrc}
                  alt={b.value}
                  width={48}
                  height={48}
                  style={{ objectFit: 'contain', width: 'auto', height: '100%', maxHeight: 46 }}
                  priority
                  unoptimized={b.iconSrc.startsWith('http')}
                />
              </div>
              <div className="highlight-meta">
                <span className="highlight-label">{b.label}</span>
                <strong className="highlight-value">{b.value}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
