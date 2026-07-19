// ===================================================================
// Standalone API Client
// ===================================================================

const getApiBaseUrl = () => {
  // If running in the browser in production: use relative path to prevent CORS / preflight redirect errors
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    return '/api/backend/api';
  }
  // Otherwise (server-side rendering, or local development): use NEXT_PUBLIC_API_URL
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

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
  const url = `${API_BASE_URL}${path}`;

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
