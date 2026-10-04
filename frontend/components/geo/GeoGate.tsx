'use client';

import { usePathname } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface GeoState {
  countryCode: string;
  countryName: string;
  countryFlag: string;
  isServiceable: boolean;
  source?: string;
}

const STORAGE_KEY = 'vahn_geo_status';

function getCountryMeta(code: string): { name: string; flag: string } {
  if (!code || code.length !== 2) return { name: 'International', flag: '🌐' };
  const upper = code.toUpperCase();
  let name = upper;
  try {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    name = regionNames.of(upper) || upper;
  } catch {
    name = upper;
  }
  let flag = '🌐';
  try {
    const codePoints = upper.split('').map((c) => 127397 + c.charCodeAt(0));
    flag = String.fromCodePoint(...codePoints);
  } catch {
    flag = '🌐';
  }
  return { name, flag };
}

export default function GeoGate() {
  const pathname = usePathname();

  const [geoState, setGeoState] = useState<GeoState | null>(null);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

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

    const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
    const isProd =
      hostname === 'vahnsports.com' ||
      hostname === 'www.vahnsports.com' ||
      hostname === 'admin.vahnsports.com' ||
      (hostname.endsWith('vahnsports.com') &&
        !hostname.startsWith('dev.') &&
        !hostname.startsWith('dev-'));

    const isDevOrLocal =
      !isProd &&
      (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.localhost') ||
        hostname.startsWith('dev.') ||
        hostname.includes('dev-') ||
        hostname.includes('staging'));

    // Check query param override: ?test_geo=US or ?test_geo=IN (STRICTLY disabled on production vahnsports.com)
    const searchParams =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const testGeoParam = isDevOrLocal ? searchParams?.get('test_geo') : null;

    // If test query param is explicitly passed on dev/local, activate immediately in 0ms!
    if (testGeoParam && /^[a-zA-Z]{2}$/.test(testGeoParam)) {
      const code = testGeoParam.toUpperCase();
      const meta = getCountryMeta(code);
      const testState: GeoState = {
        countryCode: code,
        countryName: meta.name,
        countryFlag: meta.flag,
        isServiceable: code === 'IN',
        source: 'client_instant_test',
      };
      setGeoState(testState);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(testState));
      } catch {
        // ignore
      }
      return;
    }

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

    // If cached in session: on prod, purge any test session data immediately
    if (cachedGeo) {
      if (isProd || !isDevOrLocal) {
        if (cachedGeo.source?.includes('test') || cachedGeo.source === 'client_instant_test') {
          try {
            sessionStorage.removeItem(STORAGE_KEY);
          } catch {
            // ignore
          }
          cachedGeo = null;
        }
      }

      if (cachedGeo) {
        setGeoState(cachedGeo);
        return;
      }
    }

    const fetchGeoCheck = async (testGeo: string | null) => {
      try {
        const url =
          isDevOrLocal && testGeo
            ? `/api/geo/check?test_geo=${encodeURIComponent(testGeo)}`
            : '/api/geo/check';
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
        // Network timeout / offline -> fail open so customers are never blocked
        setGeoState({
          countryCode: 'IN',
          countryName: 'India',
          countryFlag: '🇮🇳',
          isServiceable: true,
          source: 'network_fallback_open',
        });
      }
    };

    // Perform background geo check
    fetchGeoCheck(null);
  }, [isAdmin]);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/geo/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          country_code: geoState?.countryCode || 'INTL',
          country_name: geoState?.countryName || 'International',
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

  // If on admin or check hasn't run yet or user is in India -> do not render modal
  if (isAdmin || !geoState || geoState.isServiceable) {
    return null;
  }

  // Full-screen, premium non-serviceable takeover page
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
        background: 'rgba(5, 5, 5, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'linear-gradient(180deg, #111113 0%, #08080a 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 30px 80px -15px rgba(0, 0, 0, 0.9), 0 0 1px 1px rgba(255, 255, 255, 0.06)',
          borderRadius: '4px',
          padding: '44px 32px',
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
            background:
              'radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 70%)',
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
            padding: '6px 16px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '100px',
            fontSize: '0.78rem',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#a1a1aa',
            marginBottom: '20px',
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
            margin: '0 0 14px 0',
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
            margin: '0 auto 30px auto',
            maxWidth: '440px',
          }}
        >
          VAHN bespoke sportswear is currently handcrafted and dispatched exclusively for athletes
          across India. We are expanding rapidly, and international delivery to{' '}
          <strong style={{ color: '#ffffff' }}>{geoState.countryName}</strong> is launching soon.
        </p>

        {/* Waitlist Form or Success Message */}
        {!isSubmitted ? (
          <form onSubmit={handleWaitlistSubmit} style={{ marginBottom: 16 }}>
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
                placeholder="Enter your email to get notified on launch..."
                style={{
                  width: '100%',
                  background: '#09090b',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  borderRadius: '2px',
                  padding: '14px 16px',
                  color: '#ffffff',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                id="btn-geo-waitlist-submit"
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '2px',
                  padding: '14px 20px',
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
              padding: '20px',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: '2px',
              marginBottom: 16,
              maxWidth: '420px',
              margin: '0 auto 16px auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                color: '#4ade80',
                fontWeight: 800,
                fontSize: '0.9rem',
                marginBottom: 6,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                role="img"
                aria-label="Success checkmark"
              >
                <title>Success checkmark</title>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>YOU ARE ON THE PRIORITY LIST</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#86efac', lineHeight: 1.5 }}>
              We will notify <strong>{email}</strong> the moment shipping to {geoState.countryName}{' '}
              begins.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
