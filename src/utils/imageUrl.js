/**
 * Image URL helpers — egress control for product/hero imagery.
 *
 * WHY THIS EXISTS
 * ---------------
 * List views (orders table, variant matrix, restock, combos) render product
 * thumbnails at 36-48 CSS px. They were pointing straight at the original
 * upload, so a 50-row order page pulled 50+ full-resolution originals
 * (commonly 300 KB - 2 MB each) instead of 50 small derivatives. That is the
 * single largest driver of uncached egress on the admin.
 *
 * WHAT IT DOES
 * ------------
 * Two transformation back-ends, in priority order:
 *
 *  1. **Cloudflare in front of R2** (`VITE_CDN_IMAGE_TRANSFORMS=true`). The
 *     bucket is served from `R2_PUBLIC_BASE_URL`, so a thumbnail is one path
 *     prefix away and is transformed at the edge — R2 never pays for the
 *     full-size original on a 40 px slot:
 *
 *       https://media.example.com/products/a.webp
 *       -> https://media.example.com/cdn-cgi/image/width=96,quality=70,format=auto/products/a.webp
 *
 *  2. **Supabase Storage transforms** (LEGACY, `VITE_SUPABASE_IMAGE_TRANSFORMS=true`).
 *     Only relevant while old objects are still served from
 *     `<project>.supabase.co`; every request through it is Supabase egress and
 *     a logged Storage request, which is exactly what moving to R2 removes.
 *
 * Anything else (Unsplash, a relative backend path such as /uploads/a.jpg, or a
 * data: URI) is returned untouched.
 *
 * SAFETY
 * ------
 * Both swaps are opt-in flags. While they are unset every helper here is a
 * no-op and rendering is byte-for-byte identical to the raw URL, so a bucket
 * without a transform rule can never break a page.
 */

const PUBLIC_OBJECT_SEGMENT = '/storage/v1/object/public/';
const RENDER_SEGMENT = '/storage/v1/render/image/public/';

/** Feature flags. Read once at module load; neither can break a page when off. */
const supabaseTransformsEnabled = import.meta.env?.VITE_SUPABASE_IMAGE_TRANSFORMS === 'true';
const cdnTransformsEnabled = import.meta.env?.VITE_CDN_IMAGE_TRANSFORMS === 'true';

/** Public base of the R2 bucket (custom domain or r2.dev), without a slash. */
const CDN_BASE = String(import.meta.env?.VITE_MEDIA_PUBLIC_BASE_URL || '').replace(/\/+$/, '');

/** True when the URL is served from our own R2 public base. */
export function isOwnCdnUrl(url) {
  if (!url || typeof url !== 'string' || !CDN_BASE) return false;
  return url.startsWith(`${CDN_BASE}/`) && !url.includes('/cdn-cgi/image/');
}

/** Build a Cloudflare image-resizing URL for an object on our own base. */
function cdnImage(url, width, quality) {
  if (!isOwnCdnUrl(url)) return null;
  const rest = url.slice(CDN_BASE.length);
  return `${CDN_BASE}/cdn-cgi/image/width=${width},quality=${quality},format=auto${rest}`;
}

/** Applied when either back-end is available. */
const transformsEnabled = supabaseTransformsEnabled || cdnTransformsEnabled;

/**
 * Return a downscaled variant of `url` suitable for inline thumbnails.
 *
 * @param {string} url - original image URL (absolute, relative or data:)
 * @param {number} width - target width in CSS px (default 96)
 * @param {number} quality - 1-100 (default 70)
 * @returns {string} thumbnail URL, or the input unchanged when not applicable
 */
export function thumbUrl(url, width = 96, quality = 70) {
  if (!url || typeof url !== 'string' || !transformsEnabled) return url;

  // R2 + Cloudflare (the target state): transformed at the edge, zero Supabase.
  if (cdnTransformsEnabled) {
    const viaCdn = cdnImage(url, width, quality);
    if (viaCdn) return viaCdn;
  }

  // Legacy Supabase Storage transforms (objects not yet migrated to R2).
  if (!supabaseTransformsEnabled || !url.includes(PUBLIC_OBJECT_SEGMENT)) return url;
  const rendered = url.replace(PUBLIC_OBJECT_SEGMENT, RENDER_SEGMENT);
  const separator = rendered.includes('?') ? '&' : '?';
  return `${rendered}${separator}width=${width}&quality=${quality}&resize=cover`;
}

/** True when image transformations are switched on for this build. */
export const imageTransformsEnabled = transformsEnabled;

/** Which back-end will be used, for diagnostics in Settings/health views. */
export const imageTransformBackend = cdnTransformsEnabled
  ? 'cloudflare-r2'
  : supabaseTransformsEnabled
    ? 'supabase-storage'
    : 'none';

/**
 * Build a responsive `srcSet` for a thumbnail.
 *
 * Only produces descriptors when transformations are enabled AND the URL is a
 * Supabase public object — for anything else it returns `undefined` so the
 * caller can rely on the plain `src`.
 *
 * @param {string} url
 * @param {number[]} widths - e.g. [40, 80, 160] (1x, 2x, 3x of a 40px slot)
 * @param {{ quality?: number }} [opts]
 * @returns {string|undefined}
 */
export function srcSet(url, widths = [96, 192, 288], { quality = 70 } = {}) {
  if (!url || !transformsEnabled) return undefined;

  if (cdnTransformsEnabled && isOwnCdnUrl(url)) {
    return widths
      .map((w) => `${cdnImage(url, w, quality)} ${w}w`)
      .join(', ');
  }

  if (!supabaseTransformsEnabled || !url.includes(PUBLIC_OBJECT_SEGMENT)) return undefined;
  const rendered = url.replace(PUBLIC_OBJECT_SEGMENT, RENDER_SEGMENT);
  const base = rendered.split('?')[0];
  return widths
    .map((w) => `${base}?width=${w}&quality=${quality}&resize=cover ${w}w`)
    .join(', ');
}

/**
 * A tiny inline placeholder so a missing image never hits a third-party host.
 * (Several fallbacks pointed at via.placeholder.com, an external dependency that
 * is slow, occasionally unavailable, and adds a DNS lookup + TLS handshake.)
 */
export const IMAGE_PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">' +
      '<rect width="80" height="80" fill="#e5e7eb"/>' +
      '<path d="M22 54l12-14 8 9 6-7 10 12H22z" fill="#9ca3af"/>' +
      '<circle cx="30" cy="30" r="5" fill="#9ca3af"/>' +
    '</svg>'
  );

export default thumbUrl;
