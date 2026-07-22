// ===================================================================
// Standalone API Client
// ===================================================================

export function getApiBaseUrl(): string {
  // BROWSER (client-side):
  // Use a relative path in browser production/Vercel deployments so requests are strictly same-origin → zero CORS issues!
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    }
    return '/api/backend/api';
  }

  // SERVER-SIDE on Vercel (SSR for product/collection/etc. pages):
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/backend/api`;
  }

  // Local development (or any other environment):
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
}


export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  cache?: RequestCache;
  tags?: string[];
}

export async function fetchAPI<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { method = 'GET', body, cache, tags } = options;
  const url = `${getApiBaseUrl()}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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
    throw new Error(`API error: ${res.status} ${res.statusText} on ${path}`);
  }

  return res.json();
}
