/**
 * Image upload helpers for the admin panel.
 *
 * Why this exists:
 *   Phone photos (iPhone "IMG_xxxx.jpeg", Android camera) are usually 3–8 MB.
 *   The API sits behind nginx / a serverless platform that rejects request
 *   bodies over a hard limit (nginx default is **1 MB**, Vercel is 4.5 MB) with
 *   an HTTP **413** and an HTML error page. The browser then cannot parse JSON,
 *   and the UI falls back to a generic "Failed to update product." toast.
 *
 *   So we (1) shrink the image in the browser before uploading and
 *   (2) surface the real status/message when something still goes wrong.
 */

/** Hard-ish limit we warn about before uploading (browser side). */
export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_UPLOAD_MAX_MB) || 10;

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|bmp|gif|heic|heif|avif)$/i;

export const isImageFile = (file) =>
  !!file && (file.type?.startsWith('image/') || IMAGE_EXT_RE.test(file.name || ''));

export const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/** Load a File into an HTMLImageElement (works on iOS Safari). */
const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Selected file is not a readable image.'));
    };
    img.src = url;
  });

/**
 * Downscale + re-encode an image File so the upload stays small.
 *
 * @param {File} file - original file from <input type="file">
 * @param {object} [opts]
 * @param {number} [opts.maxSize=1600]  longest edge in pixels
 * @param {number} [opts.quality=0.82]  JPEG quality
 * @param {number} [opts.skipUnderKB=400] don't touch files already this small
 * @returns {Promise<File>} compressed file (or the original if compression is pointless/fails)
 */
export const compressImage = async (file, opts = {}) => {
  const { maxSize = 1600, quality = 0.82, skipUnderKB = 400 } = opts;

  if (!file || !isImageFile(file)) return file;
  // GIFs lose animation; SVG/HEIC can't be drawn reliably on every browser.
  if (/gif|svg|heic|heif/i.test(file.type || file.name || '')) return file;
  if (file.size <= skipUnderKB * 1024) return file;

  try {
    const img = await loadImage(file);
    const longest = Math.max(img.width, img.height);
    const scale = longest > maxSize ? maxSize / longest : 1;

    // Already small enough in both dimensions and bytes -> keep as-is.
    if (scale === 1 && file.size <= 1024 * 1024) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // White backdrop so transparent PNGs don't turn black in JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob) return file;

    // Never make things worse.
    if (blob.size >= file.size) return file;

    const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch (err) {
    console.warn('[imageUpload] compression skipped:', err?.message || err);
    return file;
  }
};

/**
 * Parse an API response defensively and throw a *useful* error when it fails.
 *
 * Handles the three real-world failure modes:
 *   - JSON body with { success: false, message }
 *   - HTML body from a proxy (408/413/502/504) instead of JSON
 *   - 401/403 when the admin token expired
 *
 * @param {Response} response
 * @returns {Promise<object>} parsed JSON payload
 */
export const readApiResponse = async (response) => {
  const status = response.status;
  const raw = await response.text();

  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null; // proxy/HTML error page
    }
  }

  if (response.ok && data && data.success !== undefined) {
    if (data.success === false) {
      const err = new Error(data.message || `Request failed (HTTP ${status})`);
      err.status = status;
      err.data = data;
      throw err;
    }
    return data;
  }

  if (response.ok) {
    if (data) return data;
    throw new Error(`Server returned an unexpected response (HTTP ${status}).`);
  }

  const hint =
    status === 413
      ? 'The image is too large for the server (HTTP 413). Try a smaller photo or raise the upload limit.'
      : status === 401 || status === 403
        ? 'Your admin session expired. Please log in again.'
        : status === 502 || status === 504
          ? 'The API server did not respond in time (gateway timeout).'
          : null;

  const message =
    (data && (data.message || data.error)) ||
    hint ||
    (raw && raw.length < 200 && !raw.trim().startsWith('<') ? raw.trim() : null) ||
    `Request failed (HTTP ${status}).`;

  const err = new Error(message);
  err.status = status;
  err.data = data;
  throw err;
};

/**
 * Compress every File inside a FormData-like payload description.
 * Returns the (possibly new) list of files, keeping the caller's keys intact.
 *
 * @param {Array<{key: string, file: File}>} entries
 * @returns {Promise<Array<{key: string, file: File}>>}
 */
export const compressEntries = async (entries, opts) =>
  Promise.all(
    entries.map(async ({ key, file }) => ({
      key,
      file: file ? await compressImage(file, opts) : file,
    })),
  );
