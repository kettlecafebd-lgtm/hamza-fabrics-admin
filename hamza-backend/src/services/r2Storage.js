/**
 * Cloudflare R2 storage driver — the replacement for Supabase Storage.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every product image, hero banner, variant swatch and profile avatar used to
 * be written to Supabase Storage and served from
 * `<project>.supabase.co/storage/v1/...`. That put three things on the Supabase
 * bill at once:
 *
 *   1. **Egress** — every thumbnail on every admin page load left Supabase.
 *   2. **Log ingestion** — every one of those GETs is a logged Storage request,
 *      and the media life-cycle routes made it worse: `POST /api/media/cache-control`
 *      downloaded the object and uploaded it again (2 requests + full egress per
 *      image) just to change a header.
 *   3. **Storage** — objects were never deleted.
 *
 * R2 has **zero egress fees**, and because it is S3-compatible the same code
 * path serves presigned browser uploads. Bytes never touch this process or
 * Supabase:
 *
 *   browser ──presign──▶ backend ──(1 tiny JSON call)──▶ R2
 *   browser ───────────PUT file────────────────────────▶ R2   (0 bytes via us)
 *   browser ───────────GET  image──────────────────────▶ R2   (0 bytes via us)
 *
 * SAFETY / CORRECTNESS RULES
 * --------------------------
 *   1. **Single allowed bucket.** `parse()` only ever returns `R2_BUCKET`; a URL
 *      for another bucket is refused rather than signed or deleted.
 *   2. **Only our public base.** A key is derived from `R2_PUBLIC_BASE_URL`,
 *      never from an arbitrary host, so a crafted URL cannot address another
 *      tenant's object.
 *   3. **Content-addressed keys.** The browser uploads `name-<hash>.webp`, so a
 *      one-year `immutable` Cache-Control can never serve stale bytes.
 *   4. **No bytes through this process for metadata changes.** Changing
 *      Cache-Control uses `CopyObject` with `MetadataDirective: REPLACE`, which
 *      R2 performs server-side (HeadObject + CopyObject, zero payload egress).
 *   5. **Deletes are reference-checked** by the caller (see routes/media.js).
 */

import {
  S3Client,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { isMissingRelation } from '../db/supabase.js';

/** One year, immutable. Only safe because keys are content-addressed. */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** Prefix segments a presigned upload may write into. */
const ALLOWED_PREFIXES = ['products', 'variants', 'reviews', 'media', 'avatars', 'resolution'];

/** Content types a browser may hand us a presigned URL for. */
const ALLOWED_CONTENT_TYPES = [
  'image/webp',
  'image/jpeg',
  'image/png',
  'image/avif',
  'image/gif',
  'image/svg+xml',
];

/** Hard ceiling for a single presigned upload (mirrors the client optimiser). */
export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Presigned PUT lifetimes. Short: the URL is minted immediately before the PUT. */
export const DEFAULT_PRESIGN_SECONDS = 300;

/** Max objects per batched delete request (R2/S3 limit is 1000). */
const DELETE_BATCH_LIMIT = 1000;

/**
 * True when this env block describes a usable R2 configuration.
 * Used by `createMediaStorage` to pick a driver and by `/health`.
 */
export function isR2Configured(env = {}) {
  return Boolean(
    env.R2_BUCKET &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      (env.R2_ENDPOINT || env.R2_ACCOUNT_ID),
  );
}

/** R2's S3 endpoint, either explicit or derived from the account id. */
export function resolveR2Endpoint(env = {}) {
  if (env.R2_ENDPOINT) return String(env.R2_ENDPOINT).replace(/\/+$/, '');
  if (env.R2_ACCOUNT_ID) return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return '';
}

/** Public delivery base (custom domain or r2.dev), without a trailing slash. */
export function resolveR2PublicBase(env = {}) {
  return String(env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
}

/**
 * Validate + normalise an object key.
 *
 * Rejects traversal, absolute paths, control characters and anything longer
 * than R2's practical limit. Returns `null` instead of throwing so callers can
 * report a per-URL `skipped` reason.
 */
export function normalizeObjectKey(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let key = raw.trim().replace(/^\/+/, '');
  if (!key || key.length > 1024) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(key)) return null;
  const segments = key.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;
  return key;
}

/** First path segment of a key (`products/a.webp` -> `products`). */
export function keyPrefix(key) {
  return String(key || '').split('/')[0];
}

/**
 * Build a safe, content-addressed key for an upload.
 *
 * `folder` must be one of ALLOWED_PREFIXES; the filename is slugified and must
 * already carry the client's content hash (see `src/lib/imageOptimize.js`). We
 * re-slugify server-side because the browser is not a trust boundary.
 */
export function buildUploadKey({ folder = 'media', fileName = '', contentType = 'image/webp' } = {}) {
  const prefix = ALLOWED_PREFIXES.includes(folder) ? folder : 'media';
  const ext = extensionForType(contentType);
  const base = String(fileName || '')
    .replace(/\.[^.]*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 120);
  // No usable name -> a random one. Never interpolate raw user text.
  const stem = base || `upload-${Date.now().toString(36)}`;
  const name = stem.endsWith(`.${ext}`) ? stem : `${stem}.${ext}`;
  return `${prefix}/${name}`;
}

function extensionForType(contentType) {
  switch (String(contentType || '').toLowerCase()) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/avif': return 'avif';
    case 'image/gif': return 'gif';
    case 'image/svg+xml': return 'svg';
    default: return 'webp';
  }
}

export function isAllowedContentType(contentType) {
  return ALLOWED_CONTENT_TYPES.includes(String(contentType || '').toLowerCase());
}

/**
 * Parse a URL into `{ bucket, key }` for R2 objects.
 *
 * Accepts our public base (`R2_PUBLIC_BASE_URL/products/a.webp`), a
 * Cloudflare-transformed URL under the same base
 * (`…/cdn-cgi/image/width=96/products/a.webp`), and a direct path-style
 * endpoint URL (`…/<bucket>/<key>`). Everything else is refused with a reason.
 */
export function parseR2Object(url, { env = {} } = {}) {
  if (!url || typeof url !== 'string' || !url.trim()) return { ok: false, reason: 'invalid' };
  const raw = url.trim();
  if (/^(data|blob|javascript):/i.test(raw)) return { ok: false, reason: 'inline-payload' };
  if (!/^https?:\/\//i.test(raw)) return { ok: false, reason: 'not-absolute' };

  const bucket = env.R2_BUCKET;
  if (!bucket) return { ok: false, reason: 'storage-not-configured' };

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  const publicBase = resolveR2PublicBase(env);
  let key = null;

  if (publicBase) {
    let baseUrl;
    try {
      baseUrl = new URL(publicBase);
    } catch {
      baseUrl = null;
    }
    if (baseUrl && parsed.host === baseUrl.host) {
      const basePath = baseUrl.pathname.replace(/\/+$/, '');
      let pathname = parsed.pathname;
      if (basePath && pathname.startsWith(basePath)) pathname = pathname.slice(basePath.length);
      // Cloudflare image-resizing prefix in front of the same object.
      pathname = pathname.replace(/^\/cdn-cgi\/image\/[^/]+\//, '/');
      key = safeDecode(pathname);
      if (key == null) return { ok: false, reason: 'invalid' };
    }
  }

  // Path-style S3 endpoint: https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
  if (key == null) {
    const endpoint = resolveR2Endpoint(env);
    if (endpoint) {
      try {
        const endpointHost = new URL(endpoint).host;
        if (parsed.host === endpointHost) {
          const pathname = safeDecode(parsed.pathname);
          if (pathname == null) return { ok: false, reason: 'invalid' };
          const [first, ...rest] = pathname.split('/').filter(Boolean);
          if (first !== bucket || rest.length === 0) return { ok: false, reason: 'foreign-bucket' };
          key = rest.join('/');
        }
      } catch {
        // Malformed endpoint: fall through to foreign-host.
      }
    }
  }

  if (key == null) return { ok: false, reason: 'foreign-host' };

  const normalized = normalizeObjectKey(key);
  if (!normalized) return { ok: false, reason: 'invalid' };

  return { ok: true, bucket, key: normalized, storageKey: `${bucket}/${normalized}` };
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Both spellings of a key, so an encoded row cannot look unreferenced.
 * Mirrors `storageKeyVariants` in the Supabase driver.
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

/**
 * Storage adapter bound to one R2 bucket.
 *
 * Same method surface as the Supabase driver in mediaStorage.js, so the routes
 * do not care which one is mounted. `driver` is reported by /health.
 */
export function createR2Storage({ env = {}, logger, client, supabaseClient } = {}) {
  const bucket = env.R2_BUCKET;
  const publicBase = resolveR2PublicBase(env);
  const referencesView = env.MEDIA_REFERENCES_VIEW || 'media_references';
  const maxCacheBytes = Number(env.MEDIA_CACHE_CONTROL_MAX_BYTES) || 8 * 1024 * 1024;
  const maxUploadBytes = Number(env.MEDIA_UPLOAD_MAX_BYTES) || DEFAULT_MAX_UPLOAD_BYTES;
  const presignSeconds = Number(env.MEDIA_PRESIGN_TTL_SECONDS) || DEFAULT_PRESIGN_SECONDS;

  const s3Config = {
    region: env.R2_REGION || 'auto',
    endpoint: resolveR2Endpoint(env),
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  };

  /** Command transport (Head/Copy/Delete/Put). Injectable so tests stay offline. */
  const s3 = client || new S3Client(s3Config);

  /**
   * Signing needs a *real* S3Client: `getSignedUrl` reads the client's endpoint
   * provider and signer, which a stub does not have. Signing is pure local
   * computation (no network), so a dedicated instance costs nothing.
   */
  const signer = new S3Client(s3Config);

  /** Reference lookups still live in Postgres: R2 has no idea what our rows say. */
  const db = supabaseClient;

  function publicUrl(key) {
    const normalized = normalizeObjectKey(key);
    if (!normalized || !publicBase) return null;
    return `${publicBase}/${normalized.split('/').map(encodeURIComponent).join('/')}`;
  }

  async function referencedKeys(keys = []) {
    const unique = [...new Set(keys.filter(Boolean))];
    if (unique.length === 0) return { ok: true, referenced: new Set() };
    if (!db?.from) return { ok: false, reason: 'references-unavailable', referenced: new Set() };

    const queryKeys = [...new Set(unique.flatMap(storageKeyVariants))];

    try {
      const { data, error } = await db
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

  async function removeObject({ key }) {
    const normalized = normalizeObjectKey(key);
    if (!normalized) return { ok: false, reason: 'invalid' };
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: normalized }));
      return { ok: true };
    } catch (error) {
      // Idempotent: S3 DELETE on a missing key is a 204, but a proxy may 404.
      if (/not found|nosuchkey|does not exist/i.test(String(error.name || error.message))) {
        return { ok: true };
      }
      logger?.warn(`r2 delete failed for ${normalized}: ${error.message}`);
      return { ok: false, reason: 'storage-error' };
    }
  }

  /** Batched delete: one R2 request for up to 1000 keys instead of N requests. */
  async function removeObjects(keys = []) {
    const normalized = [...new Set(keys.map(normalizeObjectKey).filter(Boolean))];
    if (normalized.length === 0) return { ok: true, removed: [] };
    if (normalized.length > DELETE_BATCH_LIMIT) {
      const removed = [];
      for (let i = 0; i < normalized.length; i += DELETE_BATCH_LIMIT) {
        const chunk = normalized.slice(i, i + DELETE_BATCH_LIMIT);
        const result = await removeObjects(chunk);
        if (!result.ok) return result;
        removed.push(...result.removed);
      }
      return { ok: true, removed };
    }
    try {
      const response = await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: normalized.map((Key) => ({ Key })), Quiet: true },
      }));
      const failed = (response?.Errors || []).map((entry) => entry.Key);
      return { ok: true, removed: normalized.filter((key) => !failed.includes(key)), failed };
    } catch (error) {
      logger?.warn(`r2 batch delete failed (${normalized.length} keys): ${error.message}`);
      return { ok: false, reason: 'storage-error', removed: [] };
    }
  }

  /**
   * Rewrite Cache-Control WITHOUT moving bytes through us.
   *
   * Supabase had no metadata-only update, so the old implementation downloaded
   * the object and uploaded it again — 2 requests and 2× the bytes, plus two
   * log entries, per image. R2 is S3-compatible: HeadObject (metadata only) then
   * a server-side CopyObject with `MetadataDirective: REPLACE`.
   */
  async function rewriteCacheControl({ key }, seconds) {
    const normalized = normalizeObjectKey(key);
    if (!normalized) return { ok: false, reason: 'invalid' };

    let head;
    try {
      head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: normalized }));
    } catch (error) {
      if (/not found|nosuchkey|404/i.test(`${error.name} ${error.message}`)) {
        return { ok: false, reason: 'not-found' };
      }
      logger?.warn(`r2 head failed for ${normalized}: ${error.message}`);
      return { ok: false, reason: 'storage-error' };
    }

    if (typeof head.ContentLength === 'number' && head.ContentLength > maxCacheBytes) {
      return { ok: false, reason: 'too-large' };
    }

    try {
      await s3.send(new CopyObjectCommand({
        Bucket: bucket,
        Key: normalized,
        CopySource: `${bucket}/${encodeURIComponent(normalized).replace(/%2F/g, '/')}`,
        MetadataDirective: 'REPLACE',
        ContentType: head.ContentType || 'application/octet-stream',
        CacheControl: `public, max-age=${seconds}, immutable`,
      }));
      return { ok: true };
    } catch (error) {
      logger?.warn(`r2 cache-control copy failed for ${normalized}: ${error.message}`);
      return { ok: false, reason: 'storage-error' };
    }
  }

  /**
   * Mint a presigned PUT so the browser writes to R2 directly.
   *
   * The returned URL is bound to `ContentType` and `CacheControl`: the browser
   * must send exactly those headers (both are settable from `fetch`), which is
   * what makes `immutable` safe and stops a caller from storing an HTML file
   * under an image key.
   */
  async function presignUpload({ key, contentType, size, expiresIn = presignSeconds } = {}) {
    const normalized = normalizeObjectKey(key);
    if (!normalized) return { ok: false, reason: 'invalid-key' };
    if (!isAllowedContentType(contentType)) return { ok: false, reason: 'unsupported-type' };
    const bytes = Number(size);
    if (Number.isFinite(bytes) && bytes > maxUploadBytes) return { ok: false, reason: 'too-large' };

    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: normalized,
        ContentType: String(contentType).toLowerCase(),
        CacheControl: IMMUTABLE_CACHE_CONTROL,
      });
      const uploadUrl = await getSignedUrl(signer, command, { expiresIn });
      return {
        ok: true,
        uploadUrl,
        key: normalized,
        url: publicUrl(normalized),
        method: 'PUT',
        headers: {
          'Content-Type': String(contentType).toLowerCase(),
          'Cache-Control': IMMUTABLE_CACHE_CONTROL,
        },
        expiresIn,
      };
    } catch (error) {
      logger?.warn(`r2 presign failed for ${normalized}: ${error.message}`);
      return { ok: false, reason: 'presign-error' };
    }
  }

  /**
   * Server-side PUT. Fallback for when the bucket's CORS rules have not been
   * opened to the admin origin yet, and the path used by the legacy
   * `/api/upload-image` shape. Bytes pass through this process once, never
   * through Supabase.
   */
  async function putObject({ key, body, contentType, cacheControl = IMMUTABLE_CACHE_CONTROL } = {}) {
    const normalized = normalizeObjectKey(key);
    if (!normalized) return { ok: false, reason: 'invalid-key' };
    if (!body || typeof body.length !== 'number') return { ok: false, reason: 'empty-body' };
    if (body.length > maxUploadBytes) return { ok: false, reason: 'too-large' };
    if (!isAllowedContentType(contentType)) return { ok: false, reason: 'unsupported-type' };

    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: normalized,
        Body: body,
        ContentType: String(contentType).toLowerCase(),
        CacheControl: cacheControl,
      }));
      return { ok: true, key: normalized, url: publicUrl(normalized) };
    } catch (error) {
      logger?.warn(`r2 put failed for ${normalized}: ${error.message}`);
      return { ok: false, reason: 'storage-error' };
    }
  }

  /** Cheap liveness probe for /health; never throws. */
  async function checkBucket() {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error.name || 'unavailable' };
    }
  }

  return {
    driver: 'r2',
    bucket,
    publicBase,
    parse: (url) => parseR2Object(url, { env }),
    referencedKeys,
    removeObject,
    removeObjects,
    rewriteCacheControl,
    presignUpload,
    putObject,
    publicUrl,
    buildUploadKey: (options) => buildUploadKey(options),
    maxUploadBytes,
    checkBucket,
  };
}

export default createR2Storage;
