"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    // Disable automatic browser scroll restoration so new pages always start at top
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    // If navigating to a new page without a specific hash anchor, reset scroll to top
    if (typeof window !== "undefined" && !window.location.hash) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      // Secondary tick to ensure scroll is at top after asynchronous rendering / layout shifts
      const rafId = requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });

      return () => cancelAnimationFrame(rafId);
    }
  }, [pathname]);

  return null;
}
