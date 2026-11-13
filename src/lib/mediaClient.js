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
 */

/** One year, immutable. Only safe because uploads are content-addressed. */
export const MEDIA_CACHE_CONTROL = '31536000';

/** Endpoint the backend should implement (idempotent, 404-tolerant). */
const MEDIA_DELETE_PATH = '/api/media/delete';

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
 * @returns {Promise<{ deleted: string[], skipped: string[] }>}
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
    };
  } catch (err) {
    console.warn('[media] orphan cleanup failed (ignored):', err?.message || err);
    return { deleted: [], skipped: unique };
  }
}

export default deleteMedia;
