/**
 * Media storage facade — picks a driver, so routes never import an SDK.
 *
 * DRIVERS
 * -------
 *   r2        Cloudflare R2 (S3-compatible, zero egress). **The default.**
 *             See `r2Storage.js`. Presigned browser uploads, server-side
 *             Cache-Control rewrites, batched deletes.
 *
 *   supabase  LEGACY, DEPRECATED. Kept only as an explicit opt-in
 *             (`MEDIA_STORAGE_DRIVER=supabase`) so an operator can drain an
 *             existing bucket, and so objects already stored there can still be
 *             deleted. It is the reason this service used to generate Supabase
 *             egress and log-ingestion charges: every `storage.from(...)` call
 *             is a logged Storage request, and `rewriteCacheControl` moved the
 *             whole object through this process.
 *
 * WHY THE FACADE EXISTS
 * ---------------------
 * Both drivers expose the same methods, and every one of them resolves to a
 * result object rather than throwing for an expected condition (foreign host,
 * reference check unavailable, object missing). The routes turn those into
 * per-URL `skipped` entries, so one bad URL never aborts a sweep.
 *
 *   parse(url)                        -> { ok, key } | { ok:false, reason }
 *   referencedKeys(keys)              -> { ok, referenced:Set }
 *   removeObject({ key })             -> { ok } | { ok:false, reason }
 *   removeObjects(keys)               -> { ok, removed }            (R2 only)
 *   rewriteCacheControl({ key }, s)   -> { ok } | { ok:false, reason }
 *   presignUpload({ key, type, size })-> { ok, uploadUrl, url }     (R2 only)
 *   putObject({ key, body, type })    -> { ok, url }                (R2 only)
 */

import { isMissingRelation } from '../db/supabase.js';
import { createR2Storage, isR2Configured } from './r2Storage.js';

/** Objects can only be removed from these Supabase buckets unless overridden. */
const DEFAULT_DELETE_BUCKETS = ['media', 'products'];

/** One year. Content-addressed keys make immutable caching safe. */
export const DEFAULT_CACHE_CONTROL_SECONDS = 31_536_000;

/** Supabase stores cacheControl as seconds and serves `Cache-Control: max-age=<n>`. */
const MAX_CACHE_CONTROL_SECONDS = 31_536_000;

/**
 * Which driver should be built for this env.
 *
 * R2 whenever it is configured — that is the migration. Supabase only when
 * asked for by name, because silently falling back would keep billing the
 * thing we are moving off.
 */
export function resolveStorageDriver(env = {}) {
  const requested = String(env.MEDIA_STORAGE_DRIVER || '').trim().toLowerCase();
  if (requested === 'supabase') return 'supabase';
  if (requested === 'r2') return 'r2';
  if (isR2Configured(env)) return 'r2';
  return 'supabase';
}

/**
 * Normalise a URL into `<bucket>/<key>` for Supabase objects, or a
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
 * Parse a Supabase storage URL into `{ bucket, key }`, or `{ reason }`
 * explaining why it cannot be deleted. Pure and synchronous.
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
 * considers both spellings.
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
 * Clamp a requested cache-control value to seconds. Accepts `31536000`,
 * `max-age=31536000` or a full header value; returns decimal seconds.
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
 * LEGACY Supabase Storage adapter.
 *
 * Does not exist to serve new media — it exists so that objects already in a
 * Supabase bucket can be deleted while R2 takes over. `putObject` and
 * `presignUpload` are deliberately unimplemented: there is no supported way to
 * write new bytes here any more, because that is what generated the bill.
 */
export function createSupabaseStorage({ client, env = {}, logger } = {}) {
  const buckets = parseBucketList(env.MEDIA_DELETE_BUCKETS);
  const referencesView = env.MEDIA_REFERENCES_VIEW || 'media_references';
  const maxCacheBytes = Number(env.MEDIA_CACHE_CONTROL_MAX_BYTES) || 8 * 1024 * 1024;

  const allowed = (bucket) => buckets.includes(bucket);

  function bucketApi(bucket) {
    if (!client?.storage?.from) throw new Error('Supabase storage client is not configured');
    return client.storage.from(bucket);
  }

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
   * DEPRECATED. Supabase has no metadata-only update, so this downloaded the
   * object and re-uploaded it — two logged Storage requests and a full copy of
   * the bytes per image. Only reachable with `MEDIA_STORAGE_DRIVER=supabase`.
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
    driver: 'supabase',
    buckets,
    referencesView,
    parse: (url) => parseStorageObject(url, { supabaseUrl: env.SUPABASE_URL }),
    referencedKeys,
    removeObject,
    rewriteCacheControl,
    /** Explicitly unsupported: new bytes must go to R2. */
    presignUpload: async () => ({ ok: false, reason: 'driver-not-supported' }),
    putObject: async () => ({ ok: false, reason: 'driver-not-supported' }),
    publicUrl: () => null,
    checkBucket: async () => ({ ok: true, deprecated: true }),
  };
}

/**
 * Pick a driver. R2 wins whenever it is configured; Supabase is opt-in only.
 *
 * @returns the R2 adapter, the legacy Supabase adapter, or a **degraded**
 *   adapter that refuses everything with `storage-not-configured` instead of
 *   taking the process down. A misconfigured media bucket must never stop
 *   webhooks from being ingested.
 */
export function createMediaStorage({ client, env = {}, logger } = {}) {
  const driver = resolveStorageDriver(env);

  if (driver === 'r2' && isR2Configured(env)) {
    return createR2Storage({ env, logger, supabaseClient: client });
  }

  if (driver === 'supabase') {
    // `debug`, not `warn`: `server.js` already warns once at boot, and this
    // factory runs per-process. Duplicating a deprecation notice at info/warn
    // is exactly the kind of chatter that inflates log ingestion.
    logger?.debug?.(
      'MEDIA_STORAGE: using the deprecated Supabase Storage driver. ' +
        'Set R2_BUCKET/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_PUBLIC_BASE_URL to move media off Supabase.',
    );
    return createSupabaseStorage({ client, env, logger });
  }

  logger?.error?.(`MEDIA_STORAGE: driver "${driver}" is not configured - every media operation will be refused.`);
  const reason = 'storage-not-configured';
  return {
    driver,
    configured: false,
    parse: () => ({ ok: false, reason }),
    referencedKeys: async () => ({ ok: false, reason, referenced: new Set() }),
    removeObject: async () => ({ ok: false, reason }),
    removeObjects: async () => ({ ok: false, reason, removed: [] }),
    rewriteCacheControl: async () => ({ ok: false, reason }),
    presignUpload: async () => ({ ok: false, reason }),
    putObject: async () => ({ ok: false, reason }),
    publicUrl: () => null,
    checkBucket: async () => ({ ok: false, reason }),
  };
}

export default createMediaStorage;
