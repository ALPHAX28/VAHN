import useSWR, { SWRConfiguration } from 'swr';
import { getApiBaseUrl } from './api/client';

/**
 * Default JSON fetcher for SWR requests.
 * Automatically resolves relative API URLs against the configured API base.
 */
export async function fetcher<T>(url: string): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const fullUrl = url.startsWith('http')
    ? url
    : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;

  const res = await fetch(fullUrl, {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!res.ok) {
    let errorData;
    try {
      errorData = await res.json();
    } catch {
      errorData = { detail: res.statusText };
    }
    const error = new Error(
      errorData?.detail || `API request failed with status ${res.status}`
    );
    (error as any).status = res.status;
    (error as any).info = errorData;
    throw error;
  }

  return res.json();
}

/**
 * Typed custom hook wrapping useSWR with default VAHN API fetcher.
 */
export function useApi<T>(key: string | null | (() => string | null), config?: SWRConfiguration) {
  return useSWR<T>(key, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    ...config,
  });
}

export default useSWR;
