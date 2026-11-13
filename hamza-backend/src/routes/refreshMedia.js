import express from 'express';
import { asyncHandler, badRequest, notFound } from '../lib/httpError.js';
import { normalizeAttachments, pickAttachmentUrl } from '../services/graphClient.js';
import { normalizePlatform } from '../services/attachmentResolver.js';
import { signMediaToken } from '../lib/mediaSignature.js';

/**
 * Requirement 4: fallback endpoint.
 *
 *   GET /api/chat/refresh-media/:messageId
 *
 * Facebook CDN URLs expire (and WhatsApp ones in 5 minutes). When an <img> or
 * <video> fails to load, the inbox calls this, we ask Graph for a fresh
 * `attachments` URL with the page access token, persist it, and return it.
 *
 * The client can then swap the src without a full message reload.
 */
export function createRefreshMediaRouter({ env, logger, messages, graph }) {
  const router = express.Router();

  router.get('/:messageId', asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    if (!messageId || !/^[A-Za-z0-9_:.-]{1,128}$/.test(messageId)) {
      throw badRequest('Invalid messageId.');
    }

    const message = await messages.findMessage(messageId);
    if (!message) throw notFound(`Message ${messageId} not found.`);

    const platform = normalizePlatform(message.platform || message.conversation_platform);

    // WhatsApp has no /attachments edge: resolve the stored media id instead.
    if (platform === 'whatsapp') {
      if (!message.media_id) {
        return res.status(404).json({
          success: false,
          error: { code: 'NO_MEDIA', message: 'This message has no WhatsApp media id to resolve.' },
        });
      }
      const resolved = await graph.getWhatsAppMediaUrl(message.media_id, {
        accessToken: env.WHATSAPP_TOKEN || env.META_PAGE_ACCESS_TOKEN,
        phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      });

      const token = signMediaToken(
        { messageId: message.id, exp: Math.floor(Date.now() / 1000) + env.MEDIA_URL_SIGNING_TTL_SECONDS },
        env.MEDIA_URL_SIGNING_SECRET,
      );

      return res.json({
        success: true,
        platform,
        url: resolved.url,
        proxy_url: `${env.PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/api/chat/media/s/${token}`,
        mime_type: resolved.mime_type || message.media_mime_type,
        expires_in_seconds: 300,
        persisted: false, // the URL is a 5-minute object, never worth storing
      });
    }

    const graphMessageId = message.platform_message_id || message.media_id;
    if (!graphMessageId) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_PLATFORM_MESSAGE_ID', message: 'No Graph message id stored for this row.' },
      });
    }

    const graphMessage = await graph.getMessageAttachments(graphMessageId, env.META_PAGE_ACCESS_TOKEN);
    const attachments = normalizeAttachments(graphMessage);
    const best = attachments.find((attachment) => attachment.url);

    if (!best) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MEDIA_NOT_EXPIRED_OR_GONE',
          message: 'Graph returned no fetchable attachment for this message.',
          attachments: attachments.length,
        },
      });
    }

    const { persisted } = await messages.updateMessageMedia(message.id, {
      url: best.url,
      mimeType: best.mimeType,
      kind: best.kind,
    });

    logger?.info(`refreshed media for message ${messageId}`, {
      platform,
      persisted,
      // Never log the URL itself: it carries a signed token.
      hasUrl: Boolean(best.url),
    });

    const token = signMediaToken(
      { messageId: message.id, exp: Math.floor(Date.now() / 1000) + env.MEDIA_URL_SIGNING_TTL_SECONDS },
      env.MEDIA_URL_SIGNING_SECRET,
    );

    return res.json({
      success: true,
      platform,
      url: best.url,
      proxy_url: `${env.PUBLIC_API_BASE_URL.replace(/\/+$/, '')}/api/chat/media/s/${token}`,
      mime_type: best.mimeType,
      kind: best.kind,
      persisted,
      refreshed_at: new Date().toISOString(),
    });
  }));

  /**
   * DEBUG/TEST HOOK: verifies the exact Graph call shape used above, without
   * touching the database. Enabled only outside production.
   */
  if (env.NODE_ENV !== 'production') {
    router.get('/probe/:graphMessageId', asyncHandler(async (req, res) => {
      const graphMessage = await graph.getMessageAttachments(req.params.graphMessageId, env.META_PAGE_ACCESS_TOKEN);
      res.json({
        success: true,
        attachments_returned: normalizeAttachments(graphMessage),
        first_url_present: Boolean(pickAttachmentUrl(graphMessage?.attachments?.data?.[0])),
      });
    }));
  }

  return router;
}

export default createRefreshMediaRouter;
