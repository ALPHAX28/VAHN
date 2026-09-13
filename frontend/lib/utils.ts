// ===================================================================
// Utility helpers
// ===================================================================
import type { Money } from './api/types';

export function formatMoney(money: Money): string {
  const amount = parseFloat(money.amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: money.currencyCode || 'INR',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function createUrl(
  pathname: string,
  params: URLSearchParams | Record<string, string>
): string {
  const searchParams =
    params instanceof URLSearchParams ? params : new URLSearchParams(params);
  const paramsStr = searchParams.toString();
  return `${pathname}${paramsStr ? `?${paramsStr}` : ''}`;
}

export function ensureStartsWith(str: string, prefix: string) {
  return str.startsWith(prefix) ? str : `${prefix}${str}`;
}

export function ensureEndsWith(str: string, suffix: string) {
  return str.endsWith(suffix) ? str : `${str}${suffix}`;
}

/**
 * Converts a Shopify domain-relative URL like shopify://collections/xyz
 * to a next.js pathname
 */
export function shopifyUrlToPath(url: string): string {
  if (!url) return '/';
  const shopifyPrefix = 'shopify://';
  let path = url;
  if (url.startsWith(shopifyPrefix)) {
    path = '/' + url.replace(shopifyPrefix, '');
  }
  if (path.startsWith('/collections')) {
    return '/products';
  }
  return path;
}

export function truncate(str: string, length: number) {
  return str.length > length ? str.slice(0, length) + '...' : str;
}

/**
 * Resolves an absolute storefront URL when called from the admin dashboard,
 * or a relative path when in localhost/storefront.
 * E.g., on dev-admin.vahnsports.com -> https://dev.vahnsports.com/track?q=...
 *       on admin.vahnsports.com     -> https://vahnsports.com/track?q=...
 *       on localhost:3000           -> /track?q=...
 */
export function getStorefrontUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    if (
      hostname.includes('dev-admin') ||
      hostname.includes('admin-dev') ||
      hostname.includes('10.8.')
    ) {
      return `https://dev.vahnsports.com${cleanPath}`;
    }
    if (hostname.startsWith('admin.') || hostname === 'admin.vahnsports.com') {
      return `https://vahnsports.com${cleanPath}`;
    }
  }
  return cleanPath;
}

/**
 * Resolves the public customer tracking URL for an AWB code.
 */
export function getPublicTrackingUrl(awb?: string | null): string {
  const query = awb ? `?q=${encodeURIComponent(awb.trim())}` : '';
  return getStorefrontUrl(`/track${query}`);
}
