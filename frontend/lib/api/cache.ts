/**
 * In-Memory Client-Side SWR (Stale-While-Revalidate) API Cache
 * Enables instant 0ms page navigation with background revalidation and automatic mutation invalidation.
 */

interface CacheRecord<T> {
  data: T;
  timestamp: number;
}

type Subscriber = () => void;

class ClientApiCache {
  private cache = new Map<string, CacheRecord<any>>();
  private pending = new Map<string, Promise<any>>();
  private subscribers = new Map<string, Set<Subscriber>>();

  // Default Time-To-Live: 5 minutes
  private defaultTTL = 5 * 60 * 1000;

  /**
   * Synchronously retrieve cached data if valid
   */
  get<T>(key: string): T | null {
    if (typeof window === "undefined") return null;
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * Set cache entry and notify active listeners
   */
  set<T>(key: string, data: T): void {
    if (typeof window === "undefined") return;
    this.cache.set(key, { data, timestamp: Date.now() });
    this.notify(key);
  }

  /**
   * Invalidate matching cache keys or clear all cache
   */
  invalidate(keyPattern?: string): void {
    if (typeof window === "undefined") return;
    if (!keyPattern) {
      this.cache.clear();
      this.subscribers.forEach((set) => set.forEach((cb) => cb()));
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(keyPattern)) {
        this.cache.delete(key);
        this.notify(key);
      }
    }
  }

  /**
   * Subscribe to cache updates for a given key
   */
  subscribe(key: string, callback: Subscriber): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    return () => {
      const set = this.subscribers.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) this.subscribers.delete(key);
      }
    };
  }

  private notify(key: string): void {
    const set = this.subscribers.get(key);
    if (set) {
      set.forEach((cb) => cb());
    }
  }

  /**
   * Stale-While-Revalidate Request Strategy
   */
  async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: { forceFresh?: boolean } = {}
  ): Promise<T> {
    if (typeof window === "undefined") {
      return fetcher();
    }

    const { forceFresh = false } = options;
    const cached = this.get<T>(key);

    if (cached !== null && !forceFresh) {
      // Background revalidation (stale-while-revalidate)
      if (!this.pending.has(key)) {
        const revalidatePromise = fetcher()
          .then((freshData) => {
            this.set(key, freshData);
            return freshData;
          })
          .catch((err) => {
            console.warn(`[ApiCache] Background revalidation warning for ${key}:`, err);
          })
          .finally(() => {
            this.pending.delete(key);
          });
        this.pending.set(key, revalidatePromise);
      }
      // Return instant cached data immediately (0ms latency!)
      return Promise.resolve(cached);
    }

    // Deduplicate in-flight network requests
    if (this.pending.has(key)) {
      return this.pending.get(key) as Promise<T>;
    }

    const promise = fetcher()
      .then((data) => {
        this.set(key, data);
        return data;
      })
      .finally(() => {
        this.pending.delete(key);
      });

    this.pending.set(key, promise);
    return promise;
  }
}

export const clientCache = new ClientApiCache();
