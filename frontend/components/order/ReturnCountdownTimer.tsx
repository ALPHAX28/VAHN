'use client';

import { useEffect, useState } from 'react';
import { ClockIcon, ShieldCheckIcon } from '@/components/icons/Icons';

interface ReturnCountdownTimerProps {
  deliveredAt?: string | null;
  deliveredAtIso?: string | null;
  returnStatus?: string | null;
  isDelivered?: boolean;
  compact?: boolean;
  showIcon?: boolean;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  totalMs: number;
}

function calculateTimeRemaining(
  deliveredAtIso?: string | null,
  deliveredAt?: string | null
): TimeRemaining | null {
  let deliveryTime: number | null = null;

  if (deliveredAtIso) {
    const parsed = new Date(deliveredAtIso).getTime();
    if (!Number.isNaN(parsed)) deliveryTime = parsed;
  }

  if (!deliveryTime && deliveredAt) {
    const parsed = new Date(deliveredAt).getTime();
    if (!Number.isNaN(parsed)) deliveryTime = parsed;
  }

  if (!deliveryTime) return null;

  // Exactly 10 calendar days window from delivery timestamp
  const WINDOW_MS = 10 * 24 * 60 * 60 * 1000;
  const expiryTime = deliveryTime + WINDOW_MS;
  const now = Date.now();
  const diff = expiryTime - now;

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isExpired: true,
      totalMs: 0,
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return {
    days,
    hours,
    minutes,
    seconds,
    isExpired: false,
    totalMs: diff,
  };
}

export default function ReturnCountdownTimer({
  deliveredAt,
  deliveredAtIso,
  returnStatus,
  isDelivered = true,
  compact = false,
  showIcon = true,
}: ReturnCountdownTimerProps) {
  const [time, setTime] = useState<TimeRemaining | null>(() =>
    calculateTimeRemaining(deliveredAtIso, deliveredAt)
  );

  useEffect(() => {
    // Initial compute
    setTime(calculateTimeRemaining(deliveredAtIso, deliveredAt));

    const interval = setInterval(() => {
      const updated = calculateTimeRemaining(deliveredAtIso, deliveredAt);
      setTime(updated);
      if (updated?.isExpired) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deliveredAt, deliveredAtIso]);

  // If return/replacement already requested, the window countdown is complete
  if (returnStatus && returnStatus !== 'NONE') {
    return null;
  }

  // If not delivered yet or no delivery date available
  if (!isDelivered || !time) {
    return null;
  }

  const { days, hours, minutes, seconds, isExpired } = time;

  // Urgency color styling
  const isUrgent = days < 1;
  const isWarning = days <= 3 && !isUrgent;

  const badgeBg = isExpired ? '#f3f4f6' : isUrgent ? '#fef2f2' : isWarning ? '#fffbeb' : '#f0fdf4';

  const badgeBorder = isExpired
    ? '#e5e7eb'
    : isUrgent
      ? '#fca5a5'
      : isWarning
        ? '#fde68a'
        : '#bbf7d0';

  const badgeColor = isExpired
    ? '#6b7280'
    : isUrgent
      ? '#dc2626'
      : isWarning
        ? '#b45309'
        : '#15803d';

  const formatDigit = (n: number) => String(n).padStart(2, '0');

  if (compact) {
    if (isExpired) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: badgeBg,
            border: `1px solid ${badgeBorder}`,
            color: badgeColor,
            padding: '3px 8px',
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          }}
        >
          {showIcon && <ClockIcon size={12} color={badgeColor} />}
          10-Day Return Window Closed
        </span>
      );
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: badgeBg,
          border: `1px solid ${badgeBorder}`,
          color: badgeColor,
          padding: '4px 10px',
          fontSize: '0.75rem',
          fontWeight: 800,
          letterSpacing: '0.01em',
        }}
      >
        {showIcon && (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isUrgent ? '#dc2626' : isWarning ? '#d97706' : '#16a34a',
              animation: isUrgent ? 'pulse 1s infinite' : 'none',
              display: 'inline-block',
            }}
          />
        )}
        <span>
          10-Day Return Window:{' '}
          <strong style={{ fontFamily: 'monospace', fontWeight: 900 }}>
            {days}d {formatDigit(hours)}h {formatDigit(minutes)}m {formatDigit(seconds)}s
          </strong>
        </span>
      </span>
    );
  }

  // Full Banner Mode
  return (
    <div
      style={{
        background: badgeBg,
        border: `1px solid ${badgeBorder}`,
        padding: '14px 18px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '0px',
            background: isExpired ? '#e5e7eb' : badgeColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isExpired ? (
            <ClockIcon size={16} color="#6b7280" />
          ) : (
            <ShieldCheckIcon size={16} color="#ffffff" />
          )}
        </div>
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: badgeColor,
            }}
          >
            {isExpired
              ? '10-Day Return & Exchange Window Closed'
              : isUrgent
                ? 'Return Window Closing Soon — Final Hours'
                : '10-Day Hassle-Free Returns & Exchanges Active'}
          </div>
          <div
            style={{ fontSize: '0.8rem', color: isExpired ? '#6b7280' : '#374151', marginTop: 2 }}
          >
            {isExpired ? (
              <span>The 10-day return window from delivery has concluded.</span>
            ) : (
              <span>
                Not the right size or fit? Request an instant exchange or 100% refund with doorstep
                pickup.
              </span>
            )}
          </div>
        </div>
      </div>

      {!isExpired && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#ffffff',
            border: `1px solid ${badgeBorder}`,
            padding: '6px 14px',
          }}
        >
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: '#6b7280',
            }}
          >
            Time Remaining:
          </span>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '0.92rem',
              fontWeight: 900,
              color: badgeColor,
              letterSpacing: '0.03em',
            }}
          >
            <span>{days}d</span> : <span>{formatDigit(hours)}h</span> :{' '}
            <span>{formatDigit(minutes)}m</span> : <span>{formatDigit(seconds)}s</span>
          </div>
        </div>
      )}
    </div>
  );
}
