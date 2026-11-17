import express from 'express';
import { asyncHandler, badRequest, HttpError } from '../lib/httpError.js';
import { buildUploadKey, isAllowedContentType } from '../services/r2Storage.js';

/**
 * Upload routes — the whole point of this file is that **bytes never transit
 * the backend or Supabase**.
 *
 * WHY
 * ---
 * Every image in the admin used to be POSTed as multipart to
 * `/api/upload-image`, which forwarded the file to Supabase Storage. That gave
 * us, per image:
 *
 *   browser -> our backend        (ingress + egress on our host)
 *           -> Supabase Storage   (a logged write, billed)
 *   browser <- <project>.supabase.co/storage/v1/object/public/...  (billed egress)
 *
 * Now:
 *
 *   POST /api/media/presign   { folder, fileName, contentType, size }
 *        -> { uploadUrl, key, url, headers }        (one small JSON call)
 *
 *   browser PUT uploadUrl  (the file bytes)  -> R2 directly
 *   browser GET  R2_PUBLIC_BASE_URL/key      -> R2 directly
 *
 * Two endpoints exist:
 *
 *   1. `POST /api/media/presign`  — preferred. Returns a presigned PUT bound to
 *      Content-Type and `Cache-Control: immutable`. Zero bytes through us.
 *      Disabled by `MEDIA_DIRECT_UPLOAD_ENABLED=false` (e.g. before the bucket's
 *      CORS policy allows the admin origin) — the client then falls back to (2).
 *
 *   2. `POST /api/upload-image`   — the legacy multipart shape the existing
 *      pages call (`ProfileSettings`, `Settings`, `Products`, `ResolutionCenter`).
 *      Bytes pass through this process once, but they are written **to R2** and
 *      the response keeps the `{ success, url }` contract, so no page had to be
 *      rewritten to stop using Supabase.
 *
 * Both are mounted behind `requireAdmin` in app.js; resolution evidence photos
 * arrive through the customer-facing resolution endpoint, not this router.
 */

/** Field names the legacy pages use for the binary part, in priority order. */
const LEGACY_FILE_FIELDS = ['image', 'file', 'images'];

/** Map a legacy form field name to an R2 key prefix. */
function folderForRequest(body = {}) {
  const explicit = String(body.folder || '').trim();
  if (explicit) return explicit;
  if (body.kind === 'avatar') return 'avatars';
  if (body.kind === 'variant') return 'variants';
  if (body.kind === 'review') return 'reviews';
  if (body.kind === 'resolution') return 'resolution';
  const field = LEGACY_FILE_FIELDS.find((name) => body[name] !== undefined) || 'image';
  return field === 'image' ? 'products' : 'media';
}

/**
 * Minimal streaming multipart reader.
 *
 * `express.raw()` gives us the body as a Buffer without the huge overhead of a
 * full multipart parser dependency, and we only need one part: the file. The
 * legacy calls are small (the client caps uploads at 1200 px / WebP, and
 * `MEDIA_UPLOAD_MAX_BYTES` bounds it again), so buffering one file is bounded
 * and never touches Supabase.
 */
function readFirstFilePart(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  let offset = buffer.indexOf(delimiter);
  while (offset !== -1) {
    const next = buffer.indexOf(delimiter, offset + delimiter.length);
    if (next === -1) break;
    const part = buffer.subarray(offset + delimiter.length, next);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headers = part.subarray(0, headerEnd).toString('latin1');
      const nameMatch = headers.match(/name="([^"]*)"/i);
      const typeMatch = headers.match(/content-type:\s*([^\r\n;]+)/i);
      const fileNameMatch = headers.match(/filename="([^"]*)"/i);
      if (nameMatch && fileNameMatch) {
        // Trailing CRLF belongs to the framing, not the payload.
        const body = part.subarray(headerEnd + 4, part.length - 2);
        return {
          field: nameMatch[1],
          fileName: fileNameMatch[1],
          contentType: (typeMatch?.[1] || 'application/octet-stream').trim().toLowerCase(),
          body,
        };
      }
    }
    offset = next;
  }
  return null;
}

export function createUploadRouter({ env = {}, logger, storage } = {}) {
  const router = express.Router();
  const storageReady = Boolean(storage?.presignUpload) && storage.driver === 'r2';
  const directEnabled = env.MEDIA_DIRECT_UPLOAD_ENABLED === true || env.MEDIA_DIRECT_UPLOAD_ENABLED === 'true';
  const presignSeconds = Number(env.MEDIA_PRESIGN_TTL_SECONDS) || 300;

  /**
   * POST /api/media/presign
   *
   * The client asks for a URL, PUTs the file straight to R2, and uses `url` as
   * the value it stores on the product/hero/avatar row. Nothing is proxied.
   */
  router.post('/presign', asyncHandler(async (req, res) => {
    if (!storageReady) {
      throw new HttpError(503, 'Object storage is not configured.', { code: 'STORAGE_NOT_CONFIGURED' });
    }
    if (!directEnabled) {
      // Expected state until the bucket CORS policy is in place: the client
      // treats 503 as "fall back to multipart" and nothing breaks.
      throw new HttpError(503, 'Direct uploads are disabled.', { code: 'DIRECT_UPLOAD_DISABLED' });
    }

    const body = req.body || {};
    const contentType = String(body.contentType || '').toLowerCase();
    if (!contentType) throw badRequest('`contentType` is required.');
    if (!isAllowedContentType(contentType)) {
      throw new HttpError(415, `Unsupported content type: ${contentType}`, { code: 'UNSUPPORTED_MEDIA_TYPE' });
    }

    const key = buildUploadKey({
      folder: folderForRequest(body),
      fileName: body.fileName,
      contentType,
    });

    const result = await storage.presignUpload({
      key,
      contentType,
      size: body.size,
      expiresIn: presignSeconds,
    });

    if (!result.ok) {
      const status = result.reason === 'too-large' ? 413 : 500;
      throw new HttpError(status, `Could not prepare the upload (${result.reason}).`, { code: 'PRESIGN_FAILED' });
    }

    // Small and cacheable-free: one line per upload is noise, so debug only.
    logger?.debug('presigned upload', { key, contentType });

    return res.json({
      success: true,
      // Contract used by src/lib/mediaClient.js `uploadToStorage()`.
      uploadUrl: result.uploadUrl,
      method: 'PUT',
      headers: result.headers,
      key: result.key,
      url: result.url,
      publicUrl: result.url,
      expiresIn: result.expiresIn,
      driver: storage.driver,
    });
  }));

  /**
   * POST /api/upload-image  (legacy multipart contract)
   *
   * Body: multipart/form-data with `image` | `file` | `images`
   * Optional fields: `folder`, `kind`, `file_name`, `content_type`,
   * `previous_image_url` (only used by the caller for cleanup).
   *
   * Response: `{ success: true, url, key, driver }` — unchanged shape, so
   * `ProfileSettings.jsx`, `Settings.jsx` and `Products.jsx` keep working.
   */
  router.post(['/upload-image', '/'], express.raw({
    type: 'multipart/form-data',
    limit: Number(env.MEDIA_UPLOAD_MAX_BYTES) || 12 * 1024 * 1024,
  }), asyncHandler(async (req, res) => {
    if (!storageReady) {
      throw new HttpError(503, 'Object storage is not configured.', { code: 'STORAGE_NOT_CONFIGURED' });
    }

    const contentTypeHeader = String(req.headers['content-type'] || '');
    const boundary = contentTypeHeader.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundary) throw badRequest('Expected a multipart/form-data body.');

    const buffer = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buffer || buffer.length === 0) throw badRequest('No file was uploaded.');

    const part = readFirstFilePart(buffer, (boundary[1] || boundary[2]).trim());
    if (!part) throw badRequest('No file part found in the request.');
    if (!isAllowedContentType(part.contentType)) {
      throw new HttpError(415, `Unsupported content type: ${part.contentType}`, { code: 'UNSUPPORTED_MEDIA_TYPE' });
    }

    const key = buildUploadKey({
      folder: folderForRequest({ ...req.query, [part.field]: true, folder: req.query.folder }),
      fileName: part.fileName,
      contentType: part.contentType,
    });

    const result = await storage.putObject({
      key,
      body: part.body,
      contentType: part.contentType,
    });

    if (!result.ok) {
      const status = result.reason === 'too-large' ? 413 : 500;
      throw new HttpError(status, `Upload failed (${result.reason}).`, { code: 'UPLOAD_FAILED' });
    }

    logger?.debug('server-side upload stored', { key, bytes: part.body.length });

    return res.json({
      success: true,
      url: result.url,
      publicUrl: result.url,
      key: result.key,
      bytes: part.body.length,
      driver: storage.driver,
    });
  }));

  /** Small capability probe so the frontend can pick presign vs multipart once. */
  router.get('/upload-capabilities', (_req, res) => {
    res.json({
      success: true,
      driver: storage?.driver || 'none',
      directUpload: Boolean(storageReady && directEnabled),
      presignPath: '/api/media/presign',
      multipartPath: '/api/upload-image',
      maxBytes: storage?.maxUploadBytes || Number(env.MEDIA_UPLOAD_MAX_BYTES) || 0,
    });
  });

  return router;
}

export default createUploadRouter;
