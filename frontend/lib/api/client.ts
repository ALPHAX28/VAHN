// ===================================================================
// Standalone API Client
// ===================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

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
  const { method = 'GET', body, cache = 'no-store', tags } = options;
  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache,
    next: tags ? { tags } : undefined,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText} on ${path}`);
  }

  return res.json();
}
