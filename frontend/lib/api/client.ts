// ===================================================================
// Standalone API Client
// ===================================================================

function getApiBaseUrl(): string {
  // BROWSER (client-side) in production:
  // Use a relative path so requests are same-origin → no CORS preflight issues
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    return '/api/backend/api';
  }

  // SERVER-SIDE on Vercel (SSR for product/collection/etc. pages):
  // VERCEL_PROJECT_PRODUCTION_URL is Vercel's system env var set to the stable
  // production domain (e.g. "vahn.vercel.app") — NOT the preview deployment URL,
  // so it won't be blocked by Vercel's deployment protection.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/backend/api`;
  }

  // Local development (or any other environment):
  // Use NEXT_PUBLIC_API_URL (set in .env.local) or fallback to localhost
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
