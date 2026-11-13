/**
 * Self-test for src/lib/dataCache.js.
 *
 *   node scripts/datacache-selftest.mjs
 *
 * Uses the real global `fetch`/`Response` from Node, with `fetch` stubbed so we
 * can count requests. Proves the two properties that matter: concurrent callers
 * share one request, and repeat callers inside the TTL cost zero requests —
 * while mutations, errors and explicit invalidation still see fresh data.
 */
import { cachedFetch, cachedJson, invalidateCache, clearCache, cacheStats, CACHE_TTLS } from '../src/lib/dataCache.js';

let checks = 0;
let failures = 0;
const check = (name, cond, detail = '') => {
  checks++;
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

let fetchCount = 0;
let payload = { value: 1 };
let failuresToInject = 0;
const requested = [];

globalThis.fetch = async (url) => {
  fetchCount++;
  requested.push(url);
  if (failuresToInject > 0) {
    failuresToInject--;
    return new Response('{"success":false}', { status: 500, headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
};

clearCache();

// ── 1. deduplication ────────────────────────────────────────────────────────
fetchCount = 0;
const [a, b, c] = await Promise.all([
  cachedFetch('/api/products?page=1'),
  cachedFetch('/api/products?page=1'),
  cachedFetch('/api/products?page=1'),
]);
check('three concurrent callers share one request', fetchCount === 1, `${fetchCount} request(s)`);
check('every caller still receives the body', (await a.json()).value === 1 && (await b.json()).value === 1 && (await c.json()).value === 1);
check('each caller gets an independent Response', a !== b);

// ── 2. TTL hit ──────────────────────────────────────────────────────────────
fetchCount = 0;
await cachedFetch('/api/products?page=1');
check('repeat call inside TTL costs no request', fetchCount === 0, `${fetchCount} request(s)`);

// ── 3. different URL is a different entry ───────────────────────────────────
fetchCount = 0;
await cachedFetch('/api/products?page=2');
check('different query is not served from the page-1 entry', fetchCount === 1);

// ── 4. token scoping ────────────────────────────────────────────────────────
fetchCount = 0;
await cachedFetch('/api/products?page=1', { token: 'admin-A' });
await cachedFetch('/api/products?page=1', { token: 'admin-B' });
check('different tokens do not share a cache entry', fetchCount === 2, `${fetchCount} request(s)`);
fetchCount = 0;
await cachedFetch('/api/products?page=1', { token: 'admin-A' });
check('same token hits its own entry', fetchCount === 0);

// ── 5. invalidation ─────────────────────────────────────────────────────────
clearCache();
fetchCount = 0;
await cachedFetch('/api/products?page=1');
await cachedFetch('/api/products?page=2');
await cachedFetch('/api/orders?page=1');
payload = { value: 2 };
invalidateCache('/api/products');
fetchCount = 0;
const afterInvalidate = await cachedFetch('/api/products?page=1');
check('invalidateCache(prefix) refetches the affected URLs', fetchCount === 1 && (await afterInvalidate.json()).value === 2);
fetchCount = 0;
await cachedFetch('/api/orders?page=1');
check('invalidateCache(prefix) leaves other URLs cached', fetchCount === 0);

// ── 6. mutation bypass ──────────────────────────────────────────────────────
fetchCount = 0;
await cachedFetch('/api/products?page=1', { method: 'POST' });
await cachedFetch('/api/products?page=1', { method: 'POST' });
check('non-GET is never cached or deduped', fetchCount === 2, `${fetchCount} request(s)`);

// ── 7. failures are not cached ──────────────────────────────────────────────
clearCache();
failuresToInject = 1;
fetchCount = 0;
const failed = await cachedFetch('/api/boom');
check('error status is passed through', failed.ok === false && failed.status === 500);
await cachedFetch('/api/boom');
check('a failed request is retried, not cached', fetchCount === 2, `${fetchCount} request(s)`);

// ── 8. force ────────────────────────────────────────────────────────────────
clearCache();
fetchCount = 0;
await cachedFetch('/api/forced');
await cachedFetch('/api/forced', { force: true });
check('force skips the cache read', fetchCount === 2);

// ── 9. abort ────────────────────────────────────────────────────────────────
clearCache();
fetchCount = 0;
const controller = new AbortController();
const aborted = cachedFetch('/api/slow', { signal: controller.signal });
controller.abort();
let abortErr = null;
try { await aborted; } catch (e) { abortErr = e; }
check('aborted caller gets an AbortError', abortErr?.name === 'AbortError', abortErr?.name);
// The shared request must still have completed and populated the cache.
await new Promise((r) => setTimeout(r, 10));
fetchCount = 0;
await cachedFetch('/api/slow');
check('the aborted request still populated the cache', fetchCount === 0, `${fetchCount} request(s)`);

// ── 10. cachedJson + stats + TTL map ────────────────────────────────────────
clearCache();
const json = await cachedJson('/api/json');
check('cachedJson returns the parsed body', json.value === 2);
check('cacheStats reports entries', cacheStats().entries === 1, JSON.stringify(cacheStats()));
check('TTL presets are ordered reference > list > analytics',
      CACHE_TTLS.reference > CACHE_TTLS.list && CACHE_TTLS.list > CACHE_TTLS.analytics);
clearCache();
check('clearCache empties the store', cacheStats().entries === 0);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
