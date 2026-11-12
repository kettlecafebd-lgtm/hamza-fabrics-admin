import express from 'express';
import { asyncHandler, HttpError } from '../lib/httpError.js';
import { verifyMediaToken } from '../lib/mediaSignature.js';
import { toBuffer } from '../services/legacyBlobStore.js';
import { resolveMessageMedia } from '../services/attachmentResolver.js';
import { buildProxyUrl } from '../services/attachmentResolver.js';
import { signMediaToken } from '../lib/mediaSignature.js';
import { withTimeout, withTimeoutFallback } from '../lib/withTimeout.js';

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

export { buildProxyUrl };
export default createMediaRouter;
