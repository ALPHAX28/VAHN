// ===================================================================
// Standalone API Client
// ===================================================================

export function getApiBaseUrl(): string {
  // BROWSER (client-side):
  if (typeof window !== 'undefined') {
    // If running locally on localhost, use localhost backend API
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');
    }
    // In production browser, use relative same-origin path '/api/backend/api' so all requests
    // are strictly same-origin (zero CORS issues and zero preflight redirects!)
    return '/api/backend/api';
  }

  // SERVER-SIDE (SSR / Build time):
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/backend/api`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/backend/api`;
  }

  return 'http://localhost:8000/api';
}


import { clientCache } from './cache';

export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  cache?: RequestCache;
  tags?: string[];
}

export async function fetchAPI<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers: customHeaders, cache, tags } = options;

  const networkFetcher = async (): Promise<T> => {
    const url = `${getApiBaseUrl()}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    };

    if (cache) {
      fetchOptions.cache = cache;
    } else if (method === 'GET') {
      fetchOptions.next = { revalidate: 30, tags };
    } else {
      fetchOptions.cache = 'no-store';
    }

    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
      let detailMsg = "";
      try {
        const errJson = await res.clone().json();
        if (errJson && errJson.detail) {
          detailMsg = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch { /* ignore */ }

      const finalMsg = detailMsg || `API error: ${res.status} ${res.statusText} on ${path}`;

      if (res.status === 403 && typeof window !== "undefined") {
        if (finalMsg.toLowerCase().includes("suspend") || finalMsg.toLowerCase().includes("account")) {
          localStorage.removeItem("vahn_auth_token");
          localStorage.removeItem("vahn_auth_user");
          window.dispatchEvent(new CustomEvent("vahn_auth_suspended", { detail: { message: finalMsg } }));
        }
      }

      throw new Error(finalMsg);
    }

    return res.json();

  };

  if (method === 'GET' && cache !== 'no-store') {
    const cacheKey = `storefront:${path}`;
    return clientCache.fetchWithCache<T>(cacheKey, networkFetcher);
  }

  const result = await networkFetcher();
  if (method !== 'GET') {
    clientCache.invalidate('storefront:');
  }
  return result;
}
