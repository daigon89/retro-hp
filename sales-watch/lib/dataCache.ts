/**
 * Server-side in-memory cache for Google Sheets data.
 *
 * Uses a Node.js global to persist across hot-reloads in development and
 * across multiple requests in production (single process).
 *
 * TTL: 5 minutes (300 seconds).
 *
 * All public functions are safe to call concurrently — a pending promise is
 * stored so that simultaneous callers don't trigger multiple fetches.
 */

import "server-only";
import {
  fetchAllData,
  fetchPreData,
  fetchTossupData,
  fetchContractData,
  fetchStaffData,
  type ApoRow,
  type PreRow,
  type TossupRow,
  type ContractRow,
  type StaffRow,
} from "@/lib/sheets";

const TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Global cache store (survives HMR in dev)
// ---------------------------------------------------------------------------

type CacheEntry<T> = {
  data: T;
  fetchedAt: number; // Date.now()
  promise: Promise<T> | null;
};

type GlobalCache = {
  apo?: CacheEntry<ApoRow[]>;
  pre?: CacheEntry<PreRow[]>;
  tossup?: CacheEntry<TossupRow[]>;
  contract?: CacheEntry<ContractRow[]>;
  staff?: CacheEntry<StaffRow[]>;
  /** ISO string of the most recent successful fetch across all sheets */
  lastFetchedAt?: string;
};

// Attach to globalThis so the cache survives Next.js hot-module-replacement
const g = globalThis as typeof globalThis & { __salesWatchCache?: GlobalCache };
if (!g.__salesWatchCache) {
  g.__salesWatchCache = {};
}
const store = g.__salesWatchCache;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStale(entry: CacheEntry<unknown>): boolean {
  return Date.now() - entry.fetchedAt > TTL_MS;
}

async function withCache<T>(
  key: keyof Omit<GlobalCache, "lastFetchedAt">,
  fetcher: () => Promise<T>
): Promise<T> {
  const existing = store[key] as CacheEntry<T> | undefined;

  // Fresh cache hit
  if (existing && !isStale(existing)) {
    return existing.data;
  }

  // In-flight deduplication
  if (existing?.promise) {
    return existing.promise;
  }

  const promise = fetcher().then((data) => {
    const now = Date.now();
    (store[key] as CacheEntry<T>) = { data, fetchedAt: now, promise: null };
    store.lastFetchedAt = new Date(now).toISOString();
    return data;
  });

  // Store the promise so concurrent callers can share it
  const s = store as Record<string, CacheEntry<unknown> | string | undefined>;
  if (!s[key]) {
    s[key] = {
      data: [] as unknown as T,
      fetchedAt: 0,
      promise: promise as Promise<unknown>,
    } as CacheEntry<unknown>;
  } else {
    (s[key] as CacheEntry<unknown>).promise = promise as Promise<unknown>;
  }

  return promise;
}

// ---------------------------------------------------------------------------
// Invalidation
// ---------------------------------------------------------------------------

/**
 * Clear the entire cache. The next call to any cached function will
 * re-fetch from Google Sheets.
 */
export function invalidateCache(): void {
  // Delete all keys in place so existing references to `store` stay valid
  const s = store as Record<string, unknown>;
  Object.keys(s).forEach((k) => {
    delete s[k];
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getCachedApoData(): Promise<ApoRow[]> {
  return withCache("apo", async () => {
    const data = await fetchAllData();
    return data.apo;
  });
}

export async function getCachedPreData(): Promise<PreRow[]> {
  return withCache("pre", fetchPreData);
}

export async function getCachedTossupData(): Promise<TossupRow[]> {
  return withCache("tossup", fetchTossupData);
}

export async function getCachedContractData(): Promise<ContractRow[]> {
  return withCache("contract", fetchContractData);
}

export async function getCachedStaffData(): Promise<StaffRow[]> {
  return withCache("staff", fetchStaffData);
}

/**
 * Returns the ISO timestamp of the most recent successful cache population,
 * or null if no data has been fetched yet.
 */
export function getLastFetchedAt(): string | null {
  return store.lastFetchedAt ?? null;
}
