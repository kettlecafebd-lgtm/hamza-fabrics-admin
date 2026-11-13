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
 * If an image is served from Supabase Storage's public object endpoint, swap it
 * for the Image Transformation endpoint and ask for a small render:
 *
 *   /storage/v1/object/public/products/a.jpg
 *   -> /storage/v1/render/image/public/products/a.jpg?width=96&quality=70
 *
 * Anything else (Unsplash, a relative backend path such as /uploads/a.jpg, or a
 * data: URI) is returned untouched.
 *
 * SAFETY
 * ------
 * Supabase Image Transformations are a project-level setting (Supabase Pro+).
 * If they are disabled the render endpoint 404s, so the swap is gated behind
 * VITE_SUPABASE_IMAGE_TRANSFORMS=true. While the flag is unset, every helper
 * here is a no-op and rendering is byte-for-byte identical to today.
 */

const PUBLIC_OBJECT_SEGMENT = '/storage/v1/object/public/';
const RENDER_SEGMENT = '/storage/v1/render/image/public/';

const transformsEnabled = import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORMS === 'true';

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
  if (!url.includes(PUBLIC_OBJECT_SEGMENT)) return url;

  const rendered = url.replace(PUBLIC_OBJECT_SEGMENT, RENDER_SEGMENT);
  const separator = rendered.includes('?') ? '&' : '?';
  return `${rendered}${separator}width=${width}&quality=${quality}&resize=cover`;
}

/** True when image transformations are switched on for this build. */
export const imageTransformsEnabled = transformsEnabled;

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
  if (!url.includes(PUBLIC_OBJECT_SEGMENT)) return undefined;

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
