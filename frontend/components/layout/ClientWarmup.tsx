'use client';

import { useEffect, useRef } from 'react';

export default function ClientWarmup() {
  const lastPingRef = useRef<number>(0);

  useEffect(() => {
    function pingWarmup() {
      const now = Date.now();
      // Throttle pings to at most once per 60 seconds
      if (now - lastPingRef.current < 60000) return;
      lastPingRef.current = now;

      try {
        fetch('/api/keep-alive', { method: 'GET', cache: 'no-store' }).catch(() => {});
      } catch (e) {
        // Silent catch
      }
    }

    // 1. Instant background warmup on mount
    pingWarmup();

    // 2. Periodic background warmup interval (every 2 minutes)
    const interval = setInterval(pingWarmup, 120000);

    // 3. User activity intent listener (wakes up backend on hover/touch if idle)
    function handleUserIntent() {
      pingWarmup();
    }

    window.addEventListener('pointerdown', handleUserIntent, { passive: true });
    window.addEventListener('touchstart', handleUserIntent, { passive: true });

    return () => {
      clearInterval(interval);
      window.removeEventListener('pointerdown', handleUserIntent);
      window.removeEventListener('touchstart', handleUserIntent);
    };
  }, []);

  return null;
}
