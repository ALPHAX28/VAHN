'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';

interface GeoState {
  countryCode: string;
  countryName: string;
  countryFlag: string;
  isServiceable: boolean;
  source?: string;
}

const STORAGE_KEY = 'vahn_geo_status';
const PREVIEW_KEY = 'vahn_geo_preview';

export default function GeoGate() {
  const pathname = usePathname();

  const [geoState, setGeoState] = useState<GeoState | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 1. Skip completely for admin routes and search bots
  const isAdmin = pathname.startsWith('/admin');

  useEffect(() => {
    if (isAdmin) return;

    // Check search bot user agents
    if (typeof navigator !== 'undefined') {
      const ua = (navigator.userAgent || '').toLowerCase();
      if (
        ua.includes('googlebot') ||
        ua.includes('bingbot') ||
        ua.includes('slurp') ||
        ua.includes('duckduckbot') ||
        ua.includes('baiduspider') ||
        ua.includes('yandexbot')
      ) {
        return;
      }
    }

    // Check preview mode in session
    if (typeof sessionStorage !== 'undefined') {
      setIsPreviewMode(sessionStorage.getItem(PREVIEW_KEY) === 'true');
    }

    // Check query param override: ?test_geo=US or ?test_geo=IN without CSR bailout
    const searchParams =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const testGeoParam = searchParams?.get('test_geo');

    // Check session storage first
    let cachedGeo: GeoState | null = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        cachedGeo = JSON.parse(raw);
      }
    } catch {
      // Ignore session storage errors
    }

    // If test query param is explicitly passed, always re-fetch with test override
    if (testGeoParam) {
      fetchGeoCheck(testGeoParam);
      return;
    }

    // If cached in session, use cached geo
    if (cachedGeo) {
      setGeoState(cachedGeo);
      return;
    }

    // Otherwise, perform background geo check
    fetchGeoCheck(null);
  }, [isAdmin]);

  const fetchGeoCheck = async (testGeo: string | null) => {
    try {
      const url = testGeo ? `/api/geo/check?test_geo=${encodeURIComponent(testGeo)}` : '/api/geo/check';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data: GeoState = await res.json();
        setGeoState(data);
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch {
          // ignore
        }
      } else {
        // Fail open
        setGeoState({
          countryCode: 'IN',
          countryName: 'India',
          countryFlag: '🇮🇳',
          isServiceable: true,
          source: 'api_fallback_open',
        });
      }
    } catch {
      // Fail open on network error or timeout
      setGeoState({
        countryCode: 'IN',
        countryName: 'India',
        countryFlag: '🇮🇳',
        isServiceable: true,
        source: 'catch_fail_open',
      });
    }
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/geo/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          countryCode: geoState?.countryCode || 'INTL',
          countryName: geoState?.countryName || 'International',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsSubmitted(true);
        toast.success(data.message || 'You have been added to the priority waitlist!');
      } else {
        toast.error(data.message || 'Could not register email. Please try again.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnterPreviewMode = () => {
    setIsPreviewMode(true);
    try {
      sessionStorage.setItem(PREVIEW_KEY, 'true');
    } catch {
      // ignore
    }
    toast.info('Store catalog is in Preview Mode. Checkout is reserved for India.');
  };

  const handleExitPreviewMode = () => {
    setIsPreviewMode(false);
    try {
      sessionStorage.removeItem(PREVIEW_KEY);
    } catch {
      // ignore
    }
  };

  const handleSwitchGeoTest = (code: string) => {
    startTransition(() => {
      fetchGeoCheck(code);
      setIsPreviewMode(false);
      try {
        sessionStorage.removeItem(PREVIEW_KEY);
      } catch {
        // ignore
      }
    });
  };

  // If on admin or check hasn't run yet or user is in India -> do not render modal
  if (isAdmin || !geoState || geoState.isServiceable) {
    return null;
  }

  // If outside India and in Preview Mode -> show persistent luxury top banner
  if (isPreviewMode) {
    return (
      <aside
        id="geo-preview-mode-banner"
        aria-label="International Preview Mode"
        style={{
          background: 'linear-gradient(90deg, #09090b 0%, #18181b 50%, #09090b 100%)',
          color: '#f4f4f5',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '8px 16px',
          fontSize: '0.8rem',
          position: 'sticky',
          top: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
          <span style={{ fontSize: '1rem' }}>{geoState.countryFlag || '🌐'}</span>
          <span>
            Browsing from <strong>{geoState.countryName}</strong> · Fulfilling exclusively in India
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={handleExitPreviewMode}
            style={{
              background: '#ffffff',
              color: '#000000',
              border: 'none',
              borderRadius: '2px',
              padding: '4px 10px',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Launch Waitlist →
          </button>
        </div>
      </aside>
    );
  }

  // Full-screen, premium non-serviceable takeover modal
  return (
    <div
      id="geo-restriction-modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="geo-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(5, 5, 5, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'linear-gradient(180deg, #111113 0%, #09090b 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(255, 255, 255, 0.05)',
          borderRadius: '4px',
          padding: '40px 32px',
          textAlign: 'center',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        {/* Animated Globe & Location Icon */}
        <div
          style={{
            margin: '0 auto 24px auto',
            width: '84px',
            height: '84px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 70%)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Subtle pulsating outer ring */}
          <div
            style={{
              position: 'absolute',
              inset: '-6px',
              borderRadius: '50%',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              animation: 'spin 24s linear infinite',
            }}
          />
          <svg
            width="42"
            height="42"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: '#ffffff' }}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
        </div>

        {/* Location Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 14px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '100px',
            fontSize: '0.78rem',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#a1a1aa',
            marginBottom: '18px',
          }}
        >
          <span style={{ fontSize: '1rem' }}>{geoState.countryFlag || '📍'}</span>
          <span>
            Detected Location:{' '}
            <strong style={{ color: '#ffffff', fontWeight: 700 }}>{geoState.countryName}</strong>
          </span>
        </div>

        {/* Headline */}
        <h2
          id="geo-modal-title"
          style={{
            fontSize: '1.45rem',
            fontWeight: 900,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            margin: '0 0 12px 0',
            lineHeight: 1.25,
            color: '#ffffff',
          }}
        >
          Currently Shipping Exclusively in India
        </h2>

        {/* Body Text */}
        <p
          style={{
            fontSize: '0.88rem',
            lineHeight: 1.65,
            color: '#a1a1aa',
            margin: '0 auto 28px auto',
            maxWidth: '440px',
          }}
        >
          VAHN bespoke sportswear is currently handcrafted and dispatched exclusively for athletes
          and clubs across India. We are expanding rapidly, and international delivery to{' '}
          <strong style={{ color: '#ffffff' }}>{geoState.countryName}</strong> is launching soon.
        </p>

        {/* Waitlist Form or Success Message */}
        {!isSubmitted ? (
          <form onSubmit={handleWaitlistSubmit} style={{ marginBottom: 20 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                maxWidth: '420px',
                margin: '0 auto',
              }}
            >
              <input
                id="geo-waitlist-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email for launch access..."
                style={{
                  width: '100%',
                  background: '#09090b',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  borderRadius: '2px',
                  padding: '13px 16px',
                  color: '#ffffff',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                id="btn-geo-waitlist-submit"
                type="submit"
                disabled={isSubmitting || isPending}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '2px',
                  padding: '13px 20px',
                  fontSize: '0.82rem',
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              >
                {isSubmitting ? 'Adding to Waitlist...' : 'Notify Me on Launch →'}
              </button>
            </div>
          </form>
        ) : (
          <div
            style={{
              padding: '18px 20px',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: '2px',
              marginBottom: 24,
              maxWidth: '420px',
              margin: '0 auto 24px auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#4ade80', fontWeight: 800, fontSize: '0.9rem', marginBottom: 4 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>YOU ARE ON THE PRIORITY LIST</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#86efac' }}>
              We will reach out to <strong>{email}</strong> the moment shipping to {geoState.countryName} is unlocked.
            </p>
          </div>
        )}

        {/* Preview Catalog Option */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            id="btn-geo-preview-catalog"
            type="button"
            onClick={handleEnterPreviewMode}
            style={{
              background: 'transparent',
              color: '#d4d4d8',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '2px',
              padding: '10px 18px',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Explore Catalog (Preview Mode)
          </button>
        </div>

        {/* Developer / Store Owner Location Test Controls */}
        <div
          style={{
            marginTop: 20,
            fontSize: '0.72rem',
            color: '#71717a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <span>Test Location:</span>
          <button
            type="button"
            onClick={() => handleSwitchGeoTest('IN')}
            style={{
              background: 'none',
              border: 'none',
              color: '#a1a1aa',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.72rem',
              padding: 0,
            }}
          >
            🇮🇳 India (Allow)
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => handleSwitchGeoTest('US')}
            style={{
              background: 'none',
              border: 'none',
              color: '#a1a1aa',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.72rem',
              padding: 0,
            }}
          >
            🇺🇸 United States (Block)
          </button>
        </div>
      </div>
    </div>
  );
}
