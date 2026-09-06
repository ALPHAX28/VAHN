import React from 'react';
import Image from 'next/image';

interface TrustBadgesBarProps {
  className?: string;
}

export default function TrustBadgesBar({ className = '' }: TrustBadgesBarProps) {
  const badges = [
    { icon: '/icons/pan-india-delivery.png', label: 'PAN-INDIA DELIVERY' },
    { icon: '/icons/secure-payments.png', label: '100% SECURE PAYMENTS' },
    { icon: '/icons/made-for-the-game.png', label: 'MADE FOR THE GAME' },
  ];

  return (
    <div className={`trust-badges-bar ${className}`}>
      {badges.map((badge, i) => (
        <div
          key={i}
          className="trust-badge-item"
          style={{ borderLeft: i > 0 ? '1px solid rgba(255, 255, 255, 0.3)' : 'none' }}
        >
          <div className="trust-badge-icon-wrap">
            <Image
              src={badge.icon}
              alt={badge.label}
              fill
              sizes="(max-width: 768px) 22px, 32px"
              style={{ filter: 'brightness(0) invert(1)', objectFit: 'contain' }}
            />
          </div>
          <span className="trust-badge-text">
            {badge.label}
          </span>
        </div>
      ))}
    </div>
  );
}
