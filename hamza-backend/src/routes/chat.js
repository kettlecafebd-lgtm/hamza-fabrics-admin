import express from 'express';
import { asyncHandler, badRequest, notFound } from '../lib/httpError.js';
import { resolveMessageMedia, serializeMessage } from '../services/attachmentResolver.js';
import { signMediaToken } from '../lib/mediaSignature.js';

/**
 * Inbox API consumed by the admin frontend.
 *
 * Endpoints (unchanged shape, so the frontend needs no breaking change):
 *   GET  /api/chat/conversations
 *   GET  /api/chat/conversations/:id/messages
 *   POST /api/chat/conversations/:id/messages
 *
 * What changed: every message is serialised with a `media` object built from
 * `chat_messages.media_url` (or a lazily resolved WhatsApp media id). The API
 * never selects blob columns, so listing messages is now O(text) not O(bytes).
 */
export function createChatRouter({ env, logger, client, messages }) {
  const router = express.Router();

  const sign = (messageId) =>
    signMediaToken(
      { messageId, exp: Math.floor(Date.now() / 1000) + env.MEDIA_URL_SIGNING_TTL_SECONDS },
      env.MEDIA_URL_SIGNING_SECRET,
    );

  router.get('/conversations', asyncHandler(async (req, res) => {
    const limit = clampInt(req.query.limit, 50, 1, 200);
    const { data, error } = await client
      .from('conversations')
      .select('id, platform, customer_name, customer_phone, last_message, last_message_at, unread_count, external_id')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) throw error;
    res.json({ success: true, conversations: data || [] });
  }));

  router.get('/conversations/:id/messages', asyncHandler(async (req, res) => {
    const limit = clampInt(req.query.limit, 100, 1, 200);

    const { data, error } = await client
      .from('chat_messages')
      .select('id, conversation_id, platform_message_id, direction, content, created_at, message_type, media_url, media_type, media_mime_type, media_id, media_source, media_refreshed_at')
      .eq('conversation_id', req.params.id)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    // Resolve media for messages that actually have it. Text-only rows cost
    // nothing, and WhatsApp resolution failures degrade to `available: false`.
    const serialized = await Promise.all(
      (data || []).map(async (message) => {
        const needsMedia = Boolean(message.media_url || message.media_id || message.media_type);
        if (!needsMedia) return serializeMessage(message, null);

        const media = await resolveMessageMedia({ message, graph: req.app.locals.graph, env, signMediaToken, logger });
        return serializeMessage(message, media);
      }),
    );

    res.json({ success: true, messages: serialized });
  }));

  router.post('/conversations/:id/messages', asyncHandler(async (req, res) => {
    const content = String(req.body?.content || '').trim();
    if (!content) throw badRequest('content is required.');

    const { data: conversation, error: convError } = await client
      .from('conversations')
      .select('id, platform')
      .eq('id', req.params.id)
      .maybeSingle();
    if (convError) throw convError;
    if (!conversation) throw notFound('Conversation not found.');

    const saved = await messages.insertMessage({
      conversation_id: conversation.id,
      direction: 'outbound',
      content,
      created_at: new Date().toISOString(),
      ...toTextColumns(),
    });

    await messages.touchConversation(conversation.id, { lastMessage: content, at: saved.created_at });

    // Outbound sending to Meta is intentionally out of scope for this refactor:
    // it is a separate integration and does not touch media storage.
    res.status(201).json({ success: true, message: serializeMessage(saved, null) });
  }));

  /** Media health: proves at a glance that no bytes are being stored. */
  router.get('/media-health', asyncHandler(async (req, res) => {
    const { count: withMedia, error } = await client
      .from('chat_messages')
      .select('id', { head: true, count: 'exact' })
      .not('media_url', 'is', null);

    res.json({
      success: true,
      legacy_blob_writes_enabled: Boolean(env.ENABLE_LEGACY_BLOB_WRITES),
      messages_with_media_url: error ? null : withMedia,
      columns_error: error ? error.message : null,
      proxy_cache: req.app.locals.mediaFetcher?.cacheStats?.() ?? null,
      blob_table: req.app.locals.blobStore?.state?.() ?? null,
    });
  }));

  return router;
}

function toTextColumns() {
  return { message_type: 'text', media_url: null, media_type: null, media_mime_type: null, media_id: null, media_source: null };
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export default createChatRouter;
