import express from 'express';
import { asyncHandler } from '../lib/httpError.js';
import { safeEqual } from '../lib/mediaSignature.js';

/**
 * Meta + WhatsApp webhook entry points.
 *
 * BEFORE: handler downloaded every attachment (fetch -> arrayBuffer ->
 * base64) and inserted it into chat_media_blobs before replying 200. That is
 * where the 106 MB of TOAST and most of the 36 GB egress came from, and it
 * also made Meta's 5-second webhook budget impossible to meet for large files.
 *
 * AFTER: handler stores only the URL / media id and answers 200 immediately.
 * No outbound media fetch happens on the hot path at all.
 */
export function createWebhookRouter({ env, logger, ingest, metaVerify }) {
  const router = express.Router();

  // ---- Meta verification handshake (Messenger / Instagram) ----
  router.get('/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && safeEqual(token, env.META_VERIFY_TOKEN)) {
      logger?.info('Meta webhook verified');
      return res.status(200).send(String(challenge ?? ''));
    }
    logger?.warn('Meta webhook verification failed');
    return res.sendStatus(403);
  });

  // ---- WhatsApp verification handshake ----
  router.get('/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && safeEqual(token, env.WHATSAPP_VERIFY_TOKEN)) {
      return res.status(200).send(String(challenge ?? ''));
    }
    return res.sendStatus(403);
  });

  // ---- Messenger / Instagram events ----
  router.post(
    '/meta',
    metaVerify,
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (body.object !== 'page') {
        // Ack unknown objects so Meta stops retrying them.
        return res.status(200).json({ received: true, ignored: 'object' });
      }

      const results = [];
      for (const entry of body.entry || []) {
        for (const event of entry.messaging || []) {
          try {
            results.push(await ingest.handleMessengerMessage({ pageId: entry.id, event }));
          } catch (error) {
            // A single bad message must not fail the whole batch: Meta would
            // replay every event in it, re-running work we already did.
            logger?.error('messenger event failed', { mid: event?.message?.mid, message: error.message });
            results.push({ handled: false, reason: 'error' });
          }
        }
      }

      return res.status(200).json({
        received: true,
        handled: results.filter((r) => r.handled).length,
        skipped: results.filter((r) => !r.handled).length,
      });
    }),
  );

  // ---- WhatsApp Cloud API events ----
  router.post(
    '/whatsapp',
    metaVerify,
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const changes = (body.entry || []).flatMap((entry) => entry.changes || []);
      const results = [];

      for (const change of changes) {
        if (change.field !== 'messages') continue;
        try {
          results.push(await ingest.handleWhatsAppMessage({
            phoneNumberId: change.value?.metadata?.phone_number_id,
            value: change.value,
          }));
        } catch (error) {
          logger?.error('whatsapp event failed', { message: error.message });
          results.push({ handled: false, reason: 'error' });
        }
      }

      return res.status(200).json({ received: true, handled: results.filter((r) => r.handled).length });
    }),
  );

  return router;
}

export default createWebhookRouter;
