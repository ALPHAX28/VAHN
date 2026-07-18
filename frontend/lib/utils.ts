// ===================================================================
// Utility helpers
// ===================================================================
import type { Money } from './api/types';

export function formatMoney(money: Money): string {
  const amount = parseFloat(money.amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: money.currencyCode,
    minimumFractionDigits: 2,
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
  if (url.startsWith(shopifyPrefix)) {
    return '/' + url.replace(shopifyPrefix, '');
  }
  return url;
}

export function truncate(str: string, length: number) {
  return str.length > length ? str.slice(0, length) + '...' : str;
}
