/**
 * Supabase Storage lifecycle helpers for *product/hero* media.
 *
 * WHY THIS EXISTS
 * ---------------
 * `src/lib/mediaClient.js` in the admin frontend has always asked the backend to
 * sweep orphaned uploads (`POST /api/media/delete`), but no backend in this
 * workspace implemented it: the frontend call was written against a contract
 * that only existed in MEDIA_AUDIT.md §5.3. The chat backend in this repository
 * is the natural place for the route (it already owns the Supabase service-role
 * client and the storage credentials), so the route and this adapter live here.
 *
 * SAFETY RULES — every one of these is enforced in code, not by convention:
 *
 *   1. **Only our Supabase project.** The URL host must equal `SUPABASE_URL`'s
 *      host. A crafted URL cannot point the service-role key at another project.
 *   2. **Only allow-listed buckets.** `MEDIA_DELETE_BUCKETS` (default
 *      `media,products`); anything else is skipped, never deleted.
 *   3. **Only real object URLs.** `/uploads/...` (legacy disk on the other
 *      backend), `data:`/`blob:` payloads, signed transform URLs with a foreign
 *      host, and bare keys are all rejected before any network call.
 *   4. **Reference check, fail closed.** An object is only removed when a
 *      `media_references` view proves no row points at it. If the view is
 *      missing or the query errors, the URL is *skipped*, not deleted.
 *   5. **Opt-in.** Deletion stays disabled until `MEDIA_DELETE_ENABLED=true`
 *      is set after the view has been created and verified (migration 003).
 */

import { isMissingRelation } from '../db/supabase.js';

/** Objects can only be removed from these buckets unless overridden by env. */
const DEFAULT_DELETE_BUCKETS = ['media', 'products'];

/** One year. Content-addressed keys make immutable caching safe (see MEDIA_AUDIT §3.2). */
export const DEFAULT_CACHE_CONTROL_SECONDS = 31_536_000;

/** Supabase stores cacheControl as seconds and serves `Cache-Control: max-age=<n>`. */
const MAX_CACHE_CONTROL_SECONDS = 31_536_000;

/**
 * Normalise a stored URL into `<bucket>/<key>` for Supabase objects, or a
 * leading-slash-free path for everything else. Mirrors `toStorageKey()` in the
 * frontend so both sides agree on object identity.
 */
export function toStorageKey(url) {
  if (!url || typeof url !== 'string') return null;
  const raw = url.trim();
  if (!raw || /^(data|blob|javascript):/i.test(raw)) return null;
  try {
    const withoutQuery = raw.split('?')[0].split('#')[0];
    const supa = withoutQuery.match(
      /\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/(.+)$/,
    );
    if (supa) return decodeURIComponent(supa[1]);
    if (/^https?:\/\//i.test(withoutQuery)) {
      return decodeURIComponent(new URL(withoutQuery).pathname.replace(/^\/+/, ''));
    }
    return decodeURIComponent(withoutQuery.replace(/^\/+/, ''));
  } catch {
    return null;
  }
}

/**
 * Parse a storage URL into `{ bucket, key }`, or `{ reason }` explaining why it
 * cannot be deleted. Pure and synchronous: no network, no database.
 */
export function parseStorageObject(url, { supabaseUrl } = {}) {
  if (!url || typeof url !== 'string' || !url.trim()) return { ok: false, reason: 'invalid' };

  const raw = url.trim();
  if (/^(data|blob|javascript):/i.test(raw)) return { ok: false, reason: 'inline-payload' };
  if (raw.startsWith('/uploads/') || raw.startsWith('uploads/')) {
    // Served by the legacy API's disk (`nginx.conf` proxies /uploads/ to it).
    return { ok: false, reason: 'legacy-disk' };
  }
  if (!/^https?:\/\//i.test(raw)) return { ok: false, reason: 'not-absolute' };

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  let expected;
  try {
    expected = supabaseUrl ? new URL(supabaseUrl) : null;
  } catch {
    expected = null;
  }
  if (!expected) return { ok: false, reason: 'storage-not-configured' };
  if (parsed.host !== expected.host) return { ok: false, reason: 'foreign-host' };

  const match = parsed.pathname.match(
    /^\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/,
  );
  if (!match) return { ok: false, reason: 'not-an-object-url' };

  let bucket;
  let key;
  try {
    bucket = decodeURIComponent(match[1]);
    key = decodeURIComponent(match[2]).replace(/^\/+/, '');
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (!bucket || !key) return { ok: false, reason: 'invalid' };
  if (key.split('/').includes('..')) return { ok: false, reason: 'invalid' };
  if (key.length > 1024) return { ok: false, reason: 'invalid' };

  return { ok: true, bucket, key, storageKey: `${bucket}/${key}` };
}

/**
 * `products/blue shirt.webp` and `products/blue%20shirt.webp` are the same
 * object. The frontend decodes; the SQL view does not, so every comparison
 * considers both spellings. Without this, an object whose key contains an
 * encoded character would look unreferenced and be deleted while in use.
 */
export function storageKeyVariants(key) {
  if (!key) return [];
  let decoded = key;
  try {
    decoded = decodeURIComponent(key);
  } catch {
    // Not valid percent-encoding: compare the raw spelling only.
  }
  const encoded = decoded
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return [...new Set([decoded, encoded])];
}

/** Parse `MEDIA_DELETE_BUCKETS` (comma-separated or array) into a list. */
export function parseBucketList(value, fallback = DEFAULT_DELETE_BUCKETS) {
  if (Array.isArray(value)) return value.map((b) => String(b).trim()).filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [...fallback];
  return value.split(',').map((b) => b.trim()).filter(Boolean);
}

/**
 * Clamp a requested cache-control value to seconds Supabase will accept.
 * Accepts `31536000`, `max-age=31536000` or a full header value; returns a
 * string of decimal seconds (Supabase composes `max-age=<seconds>` itself).
 */
export function resolveCacheControlSeconds(value, fallback = DEFAULT_CACHE_CONTROL_SECONDS) {
  const numeric = (input) => {
    const n = Number.parseInt(String(input), 10);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, MAX_CACHE_CONTROL_SECONDS) : null;
  };

  if (value == null || value === '') return String(numeric(fallback) ?? DEFAULT_CACHE_CONTROL_SECONDS);
  if (typeof value === 'number') return String(numeric(value) ?? DEFAULT_CACHE_CONTROL_SECONDS);

  const text = String(value);
  const maxAge = text.match(/max-age\s*=\s*"?(\d+)"?/i);
  if (maxAge) return String(numeric(maxAge[1]) ?? DEFAULT_CACHE_CONTROL_SECONDS);
  return String(numeric(text) ?? DEFAULT_CACHE_CONTROL_SECONDS);
}

/**
 * Storage adapter bound to one project + client.
 *
 * Every method resolves to a small result object instead of throwing for
 * expected conditions (foreign host, unreferenced check unavailable, object
 * missing). The route turns those into `skipped` entries.
 */
export function createMediaStorage({ client, env = {}, logger } = {}) {
  const buckets = parseBucketList(env.MEDIA_DELETE_BUCKETS);
  const referencesView = env.MEDIA_REFERENCES_VIEW || 'media_references';
  const maxCacheBytes = Number(env.MEDIA_CACHE_CONTROL_MAX_BYTES) || 8 * 1024 * 1024;

  const allowed = (bucket) => buckets.includes(bucket);

  function bucketApi(bucket) {
    if (!client?.storage?.from) throw new Error('Supabase storage client is not configured');
    return client.storage.from(bucket);
  }

  /**
   * One query for the whole batch: which of these keys does any row still
   * point at? A missing view / failed query is reported as `ok: false` so the
   * caller skips every URL — "cannot verify" must never mean "delete".
   */
  async function referencedKeys(keys = []) {
    const unique = [...new Set(keys.filter(Boolean))];
    if (unique.length === 0) return { ok: true, referenced: new Set() };

    const queryKeys = [...new Set(unique.flatMap(storageKeyVariants))];

    try {
      const { data, error } = await client
        .from(referencesView)
        .select('storage_key')
        .in('storage_key', queryKeys);

      if (error) {
        if (isMissingRelation(error)) {
          logger?.warn(`${referencesView} is missing - refusing to delete unreferenced-checked media`);
          return { ok: false, reason: 'references-unavailable', referenced: new Set() };
        }
        logger?.warn(`reference lookup failed: ${error.message}`);
        return { ok: false, reason: 'references-error', referenced: new Set() };
      }

      const referenced = new Set();
      for (const row of data || []) {
        for (const variant of storageKeyVariants(row.storage_key)) referenced.add(variant);
      }
      return { ok: true, referenced };
    } catch (error) {
      logger?.warn(`reference lookup threw: ${error.message}`);
      return { ok: false, reason: 'references-error', referenced: new Set() };
    }
  }

  async function removeObject({ bucket, key }) {
    if (!allowed(bucket)) return { ok: false, reason: 'bucket-not-allowed' };
    try {
      const { error } = await bucketApi(bucket).remove([key]);
      if (!error) return { ok: true };
      // A second delete of the same key is success by definition (idempotent).
      if (/not found|does not exist|no such object/i.test(error.message || '')) return { ok: true };
      logger?.warn(`storage remove failed for ${bucket}/${key}: ${error.message}`);
      return { ok: false, reason: 'storage-error' };
    } catch (error) {
      logger?.warn(`storage remove threw for ${bucket}/${key}: ${error.message}`);
      return { ok: false, reason: 'storage-error' };
    }
  }

  /**
   * Re-upload an object with a corrected Cache-Control. Needed because
   * Supabase has no metadata-only update: the bytes must be written again.
   * Bounded by `MEDIA_CACHE_CONTROL_MAX_BYTES` and skips anything oversized.
   */
  async function rewriteCacheControl({ bucket, key }, seconds) {
    if (!allowed(bucket)) return { ok: false, reason: 'bucket-not-allowed' };
    const api = bucketApi(bucket);
    try {
      const { data: blob, error: downloadError } = await api.download(key);
      if (downloadError || !blob) return { ok: false, reason: 'not-found' };
      if (typeof blob.size === 'number' && blob.size > maxCacheBytes) {
        return { ok: false, reason: 'too-large' };
      }
      const { error: uploadError } = await api.upload(key, blob, {
        upsert: true,
        contentType: blob.type || 'application/octet-stream',
        cacheControl: String(seconds),
      });
      if (uploadError) {
        logger?.warn(`cache-control rewrite failed for ${bucket}/${key}: ${uploadError.message}`);
        return { ok: false, reason: 'storage-error' };
      }
      return { ok: true };
    } catch (error) {
      logger?.warn(`cache-control rewrite threw for ${bucket}/${key}: ${error.message}`);
      return { ok: false, reason: 'storage-error' };
    }
  }

  return {
    buckets,
    referencesView,
    parse: (url) => parseStorageObject(url, { supabaseUrl: env.SUPABASE_URL }),
    referencedKeys,
    removeObject,
    rewriteCacheControl,
  };
}

export default createMediaStorage;
