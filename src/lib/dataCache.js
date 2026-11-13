/**
 * Request cache + in-flight deduplication for GET endpoints.
 *
 * WHY
 * ---
 * Every page in this admin fetches its data in a mount effect. Navigating
 * Orders -> Dashboard -> Orders re-downloaded the whole order list; opening the
 * Products page twice in a row cost two full catalogue downloads; the Brain
 * dashboard issued 8 requests on mount and again on every return visit. None of
 * that data had changed in the intervening 30 seconds.
 *
 * This module gives GET requests the two properties they were missing:
 *
 *   1. DEDUPLICATION — N components asking for the same URL at the same time
 *      share one network request. (Mount effects in sibling panels routinely
 *      fire in the same tick.)
 *   2. SHORT-LIVED CACHE — a repeat request within `ttl` is served from memory
 *      with zero bytes over the wire.
 *
 * WHAT IT IS NOT
 * --------------
 * Not a state manager and not a source of truth. Mutations must call
 * `invalidateCache()` for the URLs they affect, exactly as they would after a
 * manual refetch. The default TTL is deliberately short (60 s): the goal is to
 * stop paying twice for the same page render, not to serve stale business data.
 *
 * AUTH
 * ----
 * The cache key includes the bearer token, so two admins signed in on the same
 * machine never see each other's responses, and a re-login starts cold.
 *
 * ABORTING
 * --------
 * If a caller passes an AbortSignal, the caller gets the AbortError but the
 * shared request keeps running and still populates the cache — that is the
 * point of dedup (the component that cancelled is often the one that comes
 * straight back).
 */

const DEFAULT_TTL = 60_000;
const MAX_ENTRIES = 120;

/** key -> { body, status, contentType, expires, storedAt } */
const cache = new Map();
/** key -> Promise<entry> */
const inflight = new Map();

function keyFor(url, token) {
  return token ? `${url}::${String(token)}` : url;
}

function isFresh(entry) {
  return !!entry && entry.expires > Date.now();
}

function evictOldest() {
  if (cache.size <= MAX_ENTRIES) return;
  let oldestKey = null;
  let oldestTime = Infinity;
  for (const [key, entry] of cache) {
    if (entry.storedAt < oldestTime) {
      oldestTime = entry.storedAt;
      oldestKey = key;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

/** A fresh Response per hit — callers may read the body independently. */
function toResponse(entry) {
  return new Response(entry.body, {
    status: entry.status,
    statusText: entry.status === 200 ? 'OK' : '',
    headers: { 'content-type': entry.contentType || 'application/json' },
  });
}

function abortError() {
  if (typeof DOMException === 'function') return new DOMException('Aborted', 'AbortError');
  const err = new Error('Aborted');
  err.name = 'AbortError';
  return err;
}

function raceAbort(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener('abort', onAbort); resolve(value); },
      (err) => { signal.removeEventListener('abort', onAbort); reject(err); }
    );
  });
}

/**
 * Drop every cached entry whose URL starts with `prefix`.
 * Call this after a mutation: `invalidateCache('/api/products')`.
 */
export function invalidateCache(prefix = '') {
  if (!prefix) return clearCache();
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/** Forget everything (logout, tenant switch, hard refresh). */
export function clearCache() {
  cache.clear();
  inflight.clear();
}

/** Introspection for the diagnostics panel / tests. */
export function cacheStats() {
  return { entries: cache.size, inflight: inflight.size, keys: [...cache.keys()] };
}

/**
 * A drop-in replacement for `fetch()` on GET endpoints.
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.ttl]        cache lifetime in ms (default 60 s)
 * @param {string} [opts.token]      bearer token, part of the cache key
 * @param {object} [opts.headers]    forwarded to fetch; `Authorization` also scopes the key
 * @param {AbortSignal} [opts.signal]
 * @param {boolean} [opts.force]     skip the cache read (still dedupes)
 * @param {string} [opts.method]     anything other than GET bypasses the cache entirely
 */
export async function cachedFetch(url, {
  ttl = DEFAULT_TTL,
  token,
  headers = {},
  signal,
  force = false,
  method = 'GET',
} = {}) {
  // Mutations must never be served from cache, and must never be deduped.
  if (method !== 'GET') {
    return fetch(url, { method, headers, signal });
  }

  const key = keyFor(url, token ?? headers.Authorization);

  if (!force) {
    const hit = cache.get(key);
    if (isFresh(hit)) return toResponse(hit);
  }

  let shared = inflight.get(key);
  if (!shared) {
    shared = (async () => {
      const res = await fetch(url, { headers });
      const body = await res.text();
      const entry = {
        body,
        status: res.status,
        contentType: res.headers.get('content-type'),
        expires: Date.now() + ttl,
        storedAt: Date.now(),
      };
      // Never cache failures: a 500 or a 401 must be retried next time.
      if (res.ok) {
        cache.set(key, entry);
        evictOldest();
      }
      return entry;
    })();

    inflight.set(key, shared);
    // Keep the shared promise from becoming an unhandled rejection when the
    // only consumer aborted before it settled.
    shared
      .catch(() => {})
      .finally(() => { if (inflight.get(key) === shared) inflight.delete(key); });
  }

  return toResponse(await raceAbort(shared, signal));
}

/** Parse-and-cache in one step: the common shape at every call site here. */
export async function cachedJson(url, opts) {
  const res = await cachedFetch(url, opts);
  return res.json();
}

/** Warm the cache without caring about the result (hover / route prefetch). */
export function prefetch(url, opts) {
  cachedFetch(url, opts).catch(() => {});
}

export const CACHE_TTLS = {
  /** Slow-moving reference data: taxonomy, categories, brands. */
  reference: 10 * 60_000,
  /** Lists and dashboards: fresh enough to be trusted, long enough to be useful. */
  list: 60_000,
  /** Aggregates that drive money numbers — shortest by default. */
  analytics: 30_000,
};

export default cachedFetch;
