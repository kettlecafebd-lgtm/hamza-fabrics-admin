/**
 * Media lifecycle helpers — cache headers + orphan cleanup.
 *
 * CACHE-CONTROL
 * -------------
 * A browser cannot set `Cache-Control` on an object it uploads; only the code
 * that performs the storage write can. Supabase Storage and R2 both accept it at
 * upload time:
 *
 *   Supabase : storage.from(bucket).upload(path, file,
 *                { cacheControl: '31536000', contentType, upsert: false })
 *   R2/S3    : new PutObjectCommand({ Bucket, Key, Body,
 *                ContentType, CacheControl: 'public, max-age=31536000, immutable' })
 *
 * The frontend's job is to (a) make the filename content-addressed so immutable
 * caching can never serve stale bytes, and (b) tell the backend which header
 * value to apply. `appendStorageFields()` does (b) — the backend should prefer
 * the uploaded field and fall back to its own default.
 *
 * WHERE THE BYTES GO (Cloudflare R2)
 * ----------------------------------
 * Media used to be POSTed to the backend, which forwarded it to Supabase
 * Storage; the browser then downloaded it back from `<project>.supabase.co`.
 * Both halves were billed, and both are gone:
 *
 *   uploadMedia()  --POST /api/media/presign--> { uploadUrl, headers, url }
 *                  --PUT  file + headers------> R2 directly   (0 bytes via us)
 *   <img src>      ---------- GET url --------> R2 directly   (0 bytes via us)
 *
 * If presigning is unavailable (route missing, `MEDIA_DIRECT_UPLOAD_ENABLED=false`
 * while bucket CORS is being set up) `uploadMedia()` transparently falls back to
 * the multipart route, which now also writes to R2 rather than Supabase Storage.
 * Callers see the same `{ url }` result either way.
 *
 * ORPHANS
 * -------
 * Nothing in this app ever deleted a stored object: replacing a product image
 * uploaded a new file and dropped the old URL, and deleting a product removed
 * only the database row. Both leave the object billable forever.
 *
 * Two layers fix that:
 *   1. `deleteMedia()` — best-effort client sweep after a successful replace or
 *      delete. It only asks the server to remove URLs that nothing else
 *      references (see `isUrlStillReferenced`), and it never throws.
 *   2. A server-side garbage collector is still required, because a client
 *      sweep cannot see deleted-in-another-tab or failed-in-flight uploads.
 *      See DB_AUDIT.md / MEDIA_AUDIT.md for the reconciliation job.
 *
 * WHERE THE REQUEST GOES
 * ----------------------
 * `deleteMedia()` posts to `POST /api/media/delete` on the media backend
 * (`hamza-backend/src/routes/media.js`), which now implements the contract:
 *
 *   request   { urls: string[] }              (Bearer admin token)
 *   response  { deleted: string[], skipped: string[], reasons?: Record<string,string> }
 *
 * The route is deliberately conservative: it removes an object only when the
 * `media_references` view (migration 003) proves nothing points at it, and it
 * stays inert until `MEDIA_DELETE_ENABLED=true`. Every refusal comes back in
 * `skipped` with a machine-readable `reasons[url]` (`referenced`, `disabled`,
 * `legacy-disk`, `foreign-host`, `references-unavailable`, …) — none of which
 * is an error, so an operator's save is never blocked by cleanup.
 *
 * An older deployment without the route answers 404; that is treated as
 * "not implemented yet" and stays silent. Override the path with
 * `VITE_MEDIA_DELETE_PATH` if it is ever mounted elsewhere.
 */

/** One year, immutable. Only safe because uploads are content-addressed. */
export const MEDIA_CACHE_CONTROL = '31536000';

/**
 * Route implemented by hamza-backend (`POST /api/media/delete`). Kept in
 * relative form so it works same-origin through nginx/Vercel and in tests.
 */
const MEDIA_DELETE_PATH = import.meta.env?.VITE_MEDIA_DELETE_PATH || '/api/media/delete';

/** Presigned direct-to-R2 upload (hamza-backend/src/routes/uploads.js). */
const MEDIA_PRESIGN_PATH = import.meta.env?.VITE_MEDIA_PRESIGN_PATH || '/api/media/presign';

/** Legacy multipart upload; now a write to R2, not Supabase Storage. */
const MEDIA_UPLOAD_PATH = import.meta.env?.VITE_MEDIA_UPLOAD_PATH || '/api/upload-image';

/** Map an upload `kind` to the R2 key prefix the backend expects. */
const FOLDER_BY_KIND = {
  product: 'products',
  variant: 'variants',
  review: 'reviews',
  settings: 'media',
  avatar: 'avatars',
  resolution: 'resolution',
};

/**
 * True once presigning has failed in this session, so later uploads skip the
 * round-trip that is known to 503. Reset by a page reload, which is fine: the
 * flag only avoids repeated failures, it is not a correctness requirement.
 */
let presignUnavailable = false;

/**
 * Add the fields a backend needs to write correct storage metadata.
 * Unknown form fields are ignored by multipart parsers, so this is safe even
 * before the backend is updated.
 *
 * @param {FormData} formData
 * @param {File} file - the (already optimised) file being attached
 */
export function appendStorageFields(formData, file) {
  if (!formData) return formData;
  formData.append('cache_control', MEDIA_CACHE_CONTROL);
  formData.append('cache_control_header', `public, max-age=${MEDIA_CACHE_CONTROL}, immutable`);
  if (file?.type) formData.append('content_type', file.type);
  if (file?.name) formData.append('file_name', file.name);
  return formData;
}

/**
 * Normalise any stored value into a comparable storage key.
 * Handles absolute Supabase/R2 URLs, API-relative paths and bare keys.
 */
export function toStorageKey(url) {
  if (!url || typeof url !== 'string') return null;
  // Inline payloads (base64 data URLs, blob: previews) are not stored objects.
  if (/^(data|blob|javascript):/i.test(url.trim())) return null;
  try {
    const withoutQuery = url.split('?')[0].split('#')[0];
    // Supabase public/render URL -> <bucket>/<path>
    const supa = withoutQuery.match(/\/storage\/v1\/(?:object|render\/image)\/public\/(.+)$/);
    if (supa) return decodeURIComponent(supa[1]);
    // Any other absolute URL -> path portion
    if (/^https?:\/\//i.test(withoutQuery)) {
      const u = new URL(withoutQuery);
      return decodeURIComponent(u.pathname.replace(/^\/+/, ''));
    }
    // Relative /uploads/x.jpg or bare key
    return decodeURIComponent(withoutQuery.replace(/^\/+/, ''));
  } catch {
    return null;
  }
}

/** Two URLs point at the same object (ignoring transform query + host). */
export function isSameMedia(a, b) {
  const ka = toStorageKey(a);
  const kb = toStorageKey(b);
  if (!ka || !kb) return false;
  return ka === kb || ka.endsWith(kb) || kb.endsWith(ka);
}

/**
 * Is this URL still used by any record other than the one being changed?
 * Prevents deleting a photo two products share.
 *
 * @param {string} url
 * @param {Array<object>} records - rows to scan
 * @param {string[]} fields - property names that may hold a URL or array of URLs
 * @param {Array<string|number>} excludeIds - records being deleted/replaced
 * @param {string} idField
 */
export function isUrlStillReferenced(url, records = [], fields = ['image_url', 'image'], excludeIds = [], idField = 'id') {
  const excluded = new Set(excludeIds.map(String));
  for (const record of records) {
    if (!record || excluded.has(String(record[idField]))) continue;
    for (const field of fields) {
      const value = record[field];
      if (Array.isArray(value)) {
        if (value.some((v) => isSameMedia(typeof v === 'string' ? v : v?.url || v?.image_url, url))) return true;
      } else if (typeof value === 'string' && isSameMedia(value, url)) {
        return true;
      }
    }
    // nested variants (products -> variants[].image_url)
    if (Array.isArray(record.variants)) {
      if (record.variants.some((v) => isSameMedia(v?.image_url || v?.image, url))) return true;
    }
  }
  return false;
}

/**
 * Best-effort orphan cleanup. Resolves to the list of URLs the server accepted.
 * Never throws: a failed cleanup must not fail the user's save.
 *
 * @param {string|string[]} urls
 * @param {{ apiBase: string, token?: string }} opts
 * @returns {Promise<{ deleted: string[], skipped: string[], reasons?: Record<string,string> }>}
 */
export async function deleteMedia(urls, { apiBase = '', token } = {}) {
  const list = (Array.isArray(urls) ? urls : [urls])
    .filter((u) => typeof u === 'string' && u.trim())
    .map((u) => u.trim())
    .filter((u) => !/^(data|blob|javascript):/i.test(u));

  // De-duplicate by storage key so we never ask twice for the same object.
  const unique = [];
  const seen = new Set();
  for (const url of list) {
    const key = toStorageKey(url) || url;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(url);
  }
  if (unique.length === 0) return { deleted: [], skipped: [] };

  try {
    const base = typeof apiBase === 'string' ? apiBase.replace(/\/+$/, '') : '';
    const res = await fetch(`${base}${MEDIA_DELETE_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ urls: unique }),
    });

    if (!res.ok) {
      // 404 = endpoint not implemented yet; anything else is worth a warning.
      if (res.status !== 404) {
        console.warn(`[media] cleanup returned ${res.status} for ${unique.length} object(s)`);
      }
      return { deleted: [], skipped: unique };
    }

    let json = {};
    try {
      json = (await res.json()) || {};
    } catch {
      json = {};
    }
    return {
      deleted: Array.isArray(json.deleted) ? json.deleted : unique,
      skipped: Array.isArray(json.skipped) ? json.skipped : [],
      ...(json.reasons && typeof json.reasons === 'object' ? { reasons: json.reasons } : {}),
    };
  } catch (err) {
    console.warn('[media] orphan cleanup failed (ignored):', err?.message || err);
    return { deleted: [], skipped: unique };
  }
}

/**
 * Upload a prepared image and return its public R2 URL.
 *
 * Order of preference:
 *   1. **Presigned PUT** — one small JSON call, then the file goes browser→R2.
 *      Nothing transits the backend and nothing touches Supabase.
 *   2. **Multipart fallback** — the legacy shape, still writing to R2. Used
 *      when the presign route is missing, disabled, or the bucket's CORS policy
 *      has not been opened to this origin yet.
 *
 * Never throws for an expected condition: it returns `{ ok: false, reason }` so
 * the caller can show one toast and stop.
 *
 * @param {File} file - already optimised (see src/lib/imageOptimize.js)
 * @param {object} opts
 * @param {string} opts.apiBase
 * @param {string} [opts.token]
 * @param {'product'|'variant'|'review'|'settings'|'avatar'|'resolution'} [opts.kind]
 * @param {string} [opts.fieldName] - multipart field name (`image`, `file`, ...)
 * @param {string} [opts.previousUrl] - hinted to the backend for cleanup
 * @returns {Promise<{ ok: boolean, url?: string, key?: string, driver?: string, reason?: string }>}
 */
export async function uploadMedia(file, { apiBase = '', token, kind = 'product', fieldName = 'image', previousUrl } = {}) {
  if (!file) return { ok: false, reason: 'no-file' };
  const base = typeof apiBase === 'string' ? apiBase.replace(/\/+$/, '') : '';
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // ── 1. Presigned direct-to-R2 ─────────────────────────────────────────────
  if (!presignUnavailable) {
    try {
      const presignRes = await fetch(`${base}${MEDIA_PRESIGN_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          folder: FOLDER_BY_KIND[kind] || 'media',
          fileName: file.name,
          contentType: file.type || 'image/webp',
          size: file.size,
          previousUrl: previousUrl || null,
        }),
      });

      if (presignRes.ok) {
        const presigned = await presignRes.json();
        if (presigned?.uploadUrl) {
          // The signature is bound to these headers; both are settable from
          // fetch, and they are what makes the one-year cache safe.
          const put = await fetch(presigned.uploadUrl, {
            method: presigned.method || 'PUT',
            headers: presigned.headers || { 'Content-Type': file.type || 'image/webp' },
            body: file,
          });
          if (put.ok) {
            return { ok: true, url: presigned.url || presigned.publicUrl, key: presigned.key, driver: 'r2-direct' };
          }
          // A rejected PUT is usually CORS or a stale signature: retry via the
          // backend once rather than failing the operator's save.
          console.warn(`[media] direct upload failed (${put.status}); falling back to server upload`);
        }
      } else if (presignRes.status === 404 || presignRes.status === 503) {
        // Not deployed yet, or direct uploads deliberately disabled.
        presignUnavailable = true;
      }
    } catch (err) {
      // Network/CORS failure: the multipart route below is same-origin.
      console.warn('[media] presign unavailable, using server upload:', err?.message || err);
    }
  }

  // ── 2. Multipart fallback (server writes to R2) ───────────────────────────
  const formData = new FormData();
  formData.append(fieldName, file);
  appendStorageFields(formData, file);
  formData.append('kind', kind);
  formData.append('folder', FOLDER_BY_KIND[kind] || 'media');
  if (previousUrl) formData.append('previous_image_url', previousUrl);

  try {
    const res = await fetch(`${base}${MEDIA_UPLOAD_PATH}`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });

    if (res.status === 413) return { ok: false, reason: 'too-large' };
    if (!res.ok) return { ok: false, reason: `http-${res.status}` };

    const data = await res.json();
    if (!data?.success || !(data.url || data.publicUrl)) return { ok: false, reason: 'no-url' };
    return { ok: true, url: data.url || data.publicUrl, key: data.key, driver: data.driver || 'server' };
  } catch (err) {
    return { ok: false, reason: err?.message || 'network' };
  }
}

export default deleteMedia;
