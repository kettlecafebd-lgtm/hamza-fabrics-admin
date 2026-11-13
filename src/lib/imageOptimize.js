/**
 * Client-side image optimisation for Supabase Storage / Cloudflare R2 uploads.
 *
 * WHY
 * ---
 * Every upload path in this app sent the original camera file: a modern phone
 * shoots 12-48 MP, which is 5-20 MB per photo. Those originals were then served
 * back into 40 px table thumbnails. Resizing to a 1200 px longest edge and
 * re-encoding to WebP at quality 0.80 costs a few hundred ms of CPU on the
 * operator's machine and removes ~95 % of the bytes from Storage, from every
 * page load, and from every CDN cache fill.
 *
 * DESIGN RULES
 * ------------
 *  1. NEVER block an upload. Any failure (no canvas, weird codec, huge file)
 *     returns the original File so the existing flow keeps working.
 *  2. NEVER make a file bigger. If the re-encode is not smaller, keep the original.
 *  3. Preserve animation and vectors: GIF and SVG pass through untouched.
 *  4. Respect EXIF orientation, otherwise portrait photos upload sideways.
 *  5. Content-address the filename (`name-<hash>.webp`) so:
 *       - the object is safe to cache immutably (Cache-Control: immutable),
 *       - re-uploading the same photo produces the same key instead of a
 *         second copy (which is how half of all "orphaned" files are born).
 */

/**
 * House standard: WebP, longest edge 1200 px, quality 0.80.
 *
 * Every preset derives from this so the rule lives in exactly one place. The
 * only exception is `avatar`, which has its own (smaller) cap — a 1200 px image
 * displayed at 128 px would still be wasteful, and the rule is "never larger
 * than 1200", not "always exactly 1200".
 */
export const UPLOAD_STANDARD = { maxWidth: 1200, maxHeight: 1200, quality: 0.80 };

/** Per-destination presets. Widths are the largest the UI can usefully display. */
export const UPLOAD_PRESETS = {
  // Product detail page / zoom - largest place this is shown.
  product:    { ...UPLOAD_STANDARD },
  // Colour-variant swatch shown at <= 96 px, but opened in a lightbox.
  variant:    { ...UPLOAD_STANDARD },
  // Customer review photo, rendered small.
  review:     { ...UPLOAD_STANDARD },
  // Storefront hero banners - full bleed. 1200 px wide is the house cap; a
  // 1920x600 banner becomes 1200x375.
  settings:   { ...UPLOAD_STANDARD },
  // Avatar rendered at <= 128 px; 320 px covers a 2.5x retina display.
  avatar:     { maxWidth: 320, maxHeight: 320, quality: 0.80 },
  // Customer-uploaded evidence for a return/resolution claim.
  resolution: { ...UPLOAD_STANDARD },
};

/** Hard ceiling on the original file we are willing to decode. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024; // 25 MB

/** Formats we deliberately do not touch. */
const PASSTHROUGH_MIME = /^image\/(gif|svg\+xml)$/i;

/** Longest edge we will ever produce, as a sanity clamp. */
const ABSOLUTE_MAX_EDGE = 1200;

export class ImageTooLargeError extends Error {
  constructor(bytes) {
    super(`Image is ${(bytes / 1048576).toFixed(1)} MB. Maximum is ${Math.round(MAX_SOURCE_BYTES / 1048576)} MB.`);
    this.name = 'ImageTooLargeError';
    this.bytes = bytes;
  }
}

const canUseCanvas = () =>
  typeof document !== 'undefined' &&
  !!document.createElement('canvas')?.getContext;

/**
 * Decode the file into something drawable, honouring EXIF rotation.
 * Returns { source, width, height, release } — call release() when done.
 */
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close?.(),
      };
    } catch {
      /* fall through to <img> */
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode image.'));
      el.src = objectUrl;
    });
    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

/** Encode the canvas, falling back to JPEG if the browser ignores WebP. */
function toBlob(canvas, mime, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob && blob.type === mime) return resolve(blob);
      // Browser silently produced something else (old Safari) — ask for JPEG.
      canvas.toBlob((jpeg) => resolve(jpeg || null), 'image/jpeg', quality);
    }, mime, quality);
  });
}

/** Short, stable content hash used as a cache-busting filename segment. */
export async function contentHash(file) {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return [...new Uint8Array(digest)]
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null; // insecure context or OOM — caller falls back to a random id
  }
}

/** `my photo.JPG` -> `my-photo-<hash>.webp` (safe for any object store). */
export function buildFileName(originalName, hash, ext = 'webp') {
  const base = String(originalName || 'image')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';
  const suffix = hash || Math.random().toString(36).slice(2, 10);
  return `${base}-${suffix}.${ext}`;
}

/**
 * Resize + re-encode an image File for upload.
 *
 * @param {File} file
 * @param {keyof typeof UPLOAD_PRESETS | object} preset
 * @returns {Promise<File>} optimised file, or the original when that is the
 *                          better (or only safe) answer
 * @throws {ImageTooLargeError} when the source exceeds MAX_SOURCE_BYTES
 */
export async function optimizeImage(file, preset = 'product') {
  if (!file || typeof file === 'string') return file;
  if (!file.type?.startsWith('image/')) return file;
  if (PASSTHROUGH_MIME.test(file.type)) return file;
  if (!canUseCanvas()) return file;

  if (file.size > MAX_SOURCE_BYTES) throw new ImageTooLargeError(file.size);

  const cfg = typeof preset === 'string' ? (UPLOAD_PRESETS[preset] || UPLOAD_PRESETS.product) : preset;
  const maxWidth = Math.min(cfg.maxWidth || 1600, ABSOLUTE_MAX_EDGE);
  const maxHeight = Math.min(cfg.maxHeight || 1600, ABSOLUTE_MAX_EDGE);
  const quality = cfg.quality ?? UPLOAD_STANDARD.quality;

  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    return file; // undecodable (corrupt / HEIC on old browsers) — let the server deal with it
  }

  try {
    const { source, width, height } = decoded;
    if (!width || !height) return file;

    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    // Already small enough and already modern? Leave it alone.
    if (scale === 1 && /^image\/(webp|avif)$/i.test(file.type) && file.size < 400 * 1024) {
      return file;
    }

    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return file;

    // High-quality downscale: do it in two passes when shrinking a lot, which
    // avoids the aliasing a single big step produces on fine fabric texture.
    if (scale < 0.5) {
      const half = document.createElement('canvas');
      half.width = Math.max(1, Math.round(width * Math.sqrt(scale)));
      half.height = Math.max(1, Math.round(height * Math.sqrt(scale)));
      const hctx = half.getContext('2d');
      if (hctx) {
        hctx.imageSmoothingEnabled = true;
        hctx.imageSmoothingQuality = 'high';
        hctx.drawImage(source, 0, 0, half.width, half.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(half, 0, 0, targetW, targetH);
      } else {
        ctx.drawImage(source, 0, 0, targetW, targetH);
      }
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, targetW, targetH);
    }

    const blob = await toBlob(canvas, 'image/webp', quality);
    if (!blob) return file;

    // Rule 2: never ship a "compression" that grew the file.
    if (blob.size >= file.size) return file;

    const hash = await contentHash(blob);
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], buildFileName(file.name, hash, ext), {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    decoded?.release?.();
  }
}

/**
 * Optimise and never throw — for call sites where a failure must not break the
 * submit (the server can still accept the original).
 *
 * @returns {Promise<{ file: File, changed: boolean, originalBytes: number, bytes: number }>}
 */
export async function prepareImageForUpload(file, preset = 'product') {
  const originalBytes = file?.size ?? 0;
  if (!file) return { file, changed: false, originalBytes, bytes: 0 };

  try {
    if (file.size > MAX_SOURCE_BYTES) throw new ImageTooLargeError(file.size);
    const optimized = await optimizeImage(file, preset);
    return {
      file: optimized,
      changed: optimized !== file,
      originalBytes,
      bytes: optimized?.size ?? originalBytes,
    };
  } catch (err) {
    // Surface the size error to the caller — it is actionable for the user.
    if (err instanceof ImageTooLargeError) throw err;
    return { file, changed: false, originalBytes, bytes: originalBytes };
  }
}

/** Human-readable "4.2 MB -> 180 KB (96% smaller)" for toasts/console. */
export function describeSaving(originalBytes, bytes) {
  if (!originalBytes || !bytes) return '';
  const pct = Math.round((1 - bytes / originalBytes) * 100);
  const fmt = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
  return pct > 0 ? `${fmt(originalBytes)} → ${fmt(bytes)} (${pct}% smaller)` : `${fmt(bytes)}`;
}

export default optimizeImage;
