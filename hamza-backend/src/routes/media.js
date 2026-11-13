import express from 'express';
import { asyncHandler, badRequest, HttpError } from '../lib/httpError.js';
import { verifyMediaToken } from '../lib/mediaSignature.js';
import { toBuffer } from '../services/legacyBlobStore.js';
import { resolveMessageMedia } from '../services/attachmentResolver.js';
import { buildProxyUrl } from '../services/attachmentResolver.js';
import { signMediaToken } from '../lib/mediaSignature.js';
import { withTimeout, withTimeoutFallback } from '../lib/withTimeout.js';
import { resolveCacheControlSeconds } from '../services/mediaStorage.js';

/** Upper bound for any DB/Graph call made while serving an <img>. */
const LOOKUP_TIMEOUT_MS = 2_000;

/**
 * GET /api/chat/media/:id            legacy proxy (id may be a message id or a blob id)
 * GET /api/chat/media/s/:token       signed proxy handed out by the inbox API
 *
 * Contract with the frontend (verified against src/components/Inbox/ChatThread.jsx):
 *   - 302 straight to the CDN when a usable URL is stored (no egress through us)
 *   - 404 (never 500) when the blob table is gone or empty
 *   - the request must always terminate
 */
export function createMediaRouter({ env, logger, blobStore, messages, graph, mediaFetcher }) {
  const router = express.Router();

  const sign = (messageId) =>
    signMediaToken(
      { messageId, exp: Math.floor(Date.now() / 1000) + env.MEDIA_URL_SIGNING_TTL_SECONDS },
      env.MEDIA_URL_SIGNING_SECRET,
    );

  function noStore(res) {
    res.set('Cache-Control', 'private, max-age=300');
    res.set('X-Content-Type-Options', 'nosniff');
  }

  /** Shared handler for both /:id and /s/:token. */
  async function serveMedia(req, res, messageId, { allowBlobFallback }) {
    // If the DB was just proven unhealthy (message-lookup timeouts), skip it
    // entirely this time instead of burning another timeout per request.
    let message = null;
    if (blobStore.isAvailable()) {
      message = await withTimeoutFallback(
        messages.findMessage(messageId),
        LOOKUP_TIMEOUT_MS,
        (error) => {
          logger?.warn(`media ${messageId}: message lookup failed (${error.message}) — skipping DB path`);
          // Reuse the blob store's breaker as a shared "DB is unhealthy" signal.
          blobStore.markUnhealthy(error);
          return null;
        },
        'message lookup',
      ).catch((error) => {
        logger?.warn(`media ${messageId}: message lookup errored (${error.message})`);
        return null;
      });
    }

    if (message) {
      const media = await withTimeoutFallback(
        resolveMessageMedia({ message, graph, env, signMediaToken, logger }),
        LOOKUP_TIMEOUT_MS,
        () => ({ available: false }),
        'media resolve',
      );
      if (media.available && media.url) {
        // Requirement 3: redirect to the original URL when we have one.
        if (!media.requiresAuthHeader) {
          noStore(res);
          logger?.debug(`media ${messageId} -> 302 upstream`);
          return res.redirect(302, media.url);
        }
        // WhatsApp: URL needs our Bearer token, so stream it (bounded, cached).
        try {
          const fetched = await mediaFetcher.fetchUpstream(media.url, {
            accessToken: env.WHATSAPP_TOKEN || env.META_PAGE_ACCESS_TOKEN,
            cacheKey: `wa:${message.media_id}`,
            ttlMs: 5 * 60_000,
          });
          noStore(res);
          res.set('Content-Type', fetched.contentType);
          res.set('Content-Length', String(fetched.buffer.length));
          return res.end(fetched.buffer);
        } catch (error) {
          if (error.status === 413) throw error;
          logger?.warn(`WhatsApp media stream failed for ${messageId}: ${error.message}`);
          // fall through to the blob in case this is a pre-refactor message
        }
      }
    }

    if (allowBlobFallback) {
      // One query, one timeout. The store owns both, so a stall trips its
      // breaker and the NEXT request is answered without touching Postgres.
      const result = await blobStore
        .readBlobByAnyId(messageId)
        .catch((error) => ({ found: false, skipped: error.message }));

      if (result?.found) return sendBlob(res, result.blob, { logger });
    }

    return notFoundMedia(res, logger, messageId);
  }

  function sendBlob(res, blob, { logger }) {
    const buffer = toBuffer(blob.data);
    if (!buffer || buffer.length === 0) return notFoundMedia(res, logger, blob.message_id || blob.id);
    noStore(res);
    res.set('Content-Type', blob.mime_type || 'application/octet-stream');
    res.set('Content-Length', String(buffer.length));
    res.set('X-Media-Source', 'legacy-blob');
    return res.end(buffer);
  }

  /**
   * Requirement 3: clean 404, never a 500. This is the path that runs after
   * `TRUNCATE chat_media_blobs` — it is expected traffic, not an error.
   */
  function notFoundMedia(res, logger, id) {
    logger?.debug(`media ${id}: no URL and no blob - 404`);
    res.set('Cache-Control', 'no-store');
    return res.status(404).json({
      success: false,
      error: {
        code: 'MEDIA_NOT_FOUND',
        message: 'Media is no longer stored. Use /api/chat/refresh-media/:messageId to re-resolve it.',
      },
    });
  }

  // Unsigned legacy route: still works for ids that survived truncation.
  router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
      throw new HttpError(400, 'Invalid media id.', { code: 'INVALID_MEDIA_ID' });
    }
    return serveMedia(req, res, id, { allowBlobFallback: true });
  }));

  // Signed route: what the inbox API hands the browser today.
  router.get('/s/:token', asyncHandler(async (req, res) => {
    const result = verifyMediaToken(req.params.token, env.MEDIA_URL_SIGNING_SECRET);
    if (!result.ok) {
      const status = result.reason === 'expired' ? 410 : 403;
      throw new HttpError(status, 'This media link is invalid or has expired.', {
        code: result.reason === 'expired' ? 'MEDIA_LINK_EXPIRED' : 'MEDIA_LINK_INVALID',
        details: { refresh: `/api/chat/refresh-media/${extractMaybeId(req.params.token)}` },
      });
    }
    return serveMedia(req, res, result.messageId, { allowBlobFallback: true });
  }));

  return router;
}

function extractMaybeId(token) {
  try {
    const body = token.split('.')[0];
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')).i;
  } catch {
    return ':messageId';
  }
}

/**
 * LIFE-CYCLE ROUTES — the contract `src/lib/mediaClient.js` already calls.
 *
 *   POST /api/media/delete         { urls: string[] }
 *     -> { deleted: string[], skipped: string[], reasons: Record<string,string> }
 *
 *   POST /api/media/cache-control  { urls: string[] }   (ops/backfill only)
 *     -> { updated: string[], skipped: string[], reasons: Record<string,string> }
 *
 * Both are admin-only (mounted behind `requireAdmin` in app.js), idempotent,
 * bounded per request, and fail closed: a URL is only deleted when a
 * `media_references` row proves nothing points at it (see migration 003).
 * Per-URL refusals are 200 + `skipped`, never a 4xx, so one bad URL cannot
 * make the browser abandon the rest of the sweep.
 */
const MAX_MEDIA_URL_LENGTH = 2_048;

function readMediaUrls(value, limit) {
  if (!Array.isArray(value)) throw badRequest('`urls` must be an array of strings.');
  if (value.length > limit) throw badRequest(`At most ${limit} URLs per request.`);

  const unique = [];
  const seen = new Set();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const url = entry.trim();
    if (!url || url.length > MAX_MEDIA_URL_LENGTH) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    unique.push(url);
  }
  return unique;
}

export function createMediaLifecycleRouter({ env = {}, logger, storage }) {
  if (!storage) throw new Error('createMediaLifecycleRouter requires a media storage adapter');

  const router = express.Router();
  const deleteEnabled = env.MEDIA_DELETE_ENABLED === true || env.MEDIA_DELETE_ENABLED === 'true';
  const maxDeleteUrls = Number(env.MEDIA_DELETE_MAX_URLS) || 50;
  const maxCacheUrls = Number(env.MEDIA_CACHE_CONTROL_MAX_URLS) || 10;
  const cacheSeconds = resolveCacheControlSeconds(env.MEDIA_UPLOAD_CACHE_CONTROL_SECONDS);

  router.post('/delete', asyncHandler(async (req, res) => {
    const urls = readMediaUrls(req.body?.urls, maxDeleteUrls);
    const deleted = [];
    const skipped = [];
    const reasons = {};

    if (!deleteEnabled) {
      for (const url of urls) {
        skipped.push(url);
        reasons[url] = 'disabled';
      }
      logger?.info(`media delete: disabled (${urls.length} URL(s) ignored)`);
      return res.json({ success: true, deleted, skipped, reasons, disabled: true });
    }

    // Parse first, then verify the whole batch with one reference query.
    const candidates = [];
    for (const url of urls) {
      const parsed = storage.parse(url);
      if (!parsed.ok) {
        skipped.push(url);
        reasons[url] = parsed.reason;
      } else {
        candidates.push({ url, ...parsed });
      }
    }

    const references = await storage.referencedKeys(candidates.map((c) => c.storageKey));

    for (const candidate of candidates) {
      if (!references.ok) {
        skipped.push(candidate.url);
        reasons[candidate.url] = references.reason || 'references-unavailable';
        continue;
      }
      // A shared photo must survive one product's delete.
      if (references.referenced.has(candidate.storageKey)) {
        skipped.push(candidate.url);
        reasons[candidate.url] = 'referenced';
        continue;
      }

      const result = await storage.removeObject(candidate);
      if (result.ok) {
        deleted.push(candidate.url);
      } else {
        skipped.push(candidate.url);
        reasons[candidate.url] = result.reason || 'storage-error';
      }
    }

    if (urls.length) {
      logger?.info(`media delete: ${deleted.length} removed, ${skipped.length} skipped`);
    }
    return res.json({ success: true, deleted, skipped, reasons });
  }));

  router.post('/cache-control', asyncHandler(async (req, res) => {
    const urls = readMediaUrls(req.body?.urls, maxCacheUrls);
    const seconds = cacheSeconds;
    const updated = [];
    const skipped = [];
    const reasons = {};

    for (const url of urls) {
      const parsed = storage.parse(url);
      if (!parsed.ok) {
        skipped.push(url);
        reasons[url] = parsed.reason;
        continue;
      }
      const result = await storage.rewriteCacheControl(parsed, seconds);
      if (result.ok) {
        updated.push(url);
      } else {
        skipped.push(url);
        reasons[url] = result.reason || 'storage-error';
      }
    }

    if (urls.length) logger?.info(`media cache-control: ${updated.length} updated, ${skipped.length} skipped`);
    return res.json({ success: true, updated, skipped, reasons, cacheControl: `max-age=${seconds}` });
  }));

  return router;
}

export { buildProxyUrl };
export default createMediaRouter;
