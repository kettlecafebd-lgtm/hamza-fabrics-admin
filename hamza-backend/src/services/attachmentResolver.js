import { HttpError } from '../lib/httpError.js';
import { normalizeAttachments, pickAttachmentUrl } from './graphClient.js';

/**
 * THE REFACTOR, IN ONE PLACE.
 *
 * Before: webhook -> download bytes -> base64 -> INSERT INTO chat_media_blobs.
 *   106 MB of TOAST, 36 GB+ of egress, and every inbox scroll re-downloaded
 *   from our own database.
 *
 * After: webhook -> read `payload.url` (Messenger) / resolve media id
 *   (WhatsApp) -> store that short URL string on `chat_messages`.
 *   Zero bytes in Postgres. Zero proxy egress when the CDN URL is usable.
 *
 * Facebook CDN URLs are long-lived and signed; we only fall back to the
 * refresh endpoint when they actually stop loading. WhatsApp URLs live 5
 * minutes, so we store the *media id* and resolve on demand (cached).
 */

/** Platform values we accept, normalised from the many spellings Meta uses. */
export function normalizePlatform(value) {
  const v = String(value || '').toLowerCase();
  if (v.includes('whatsapp')) return 'whatsapp';
  if (v.includes('messenger')) return 'messenger';
  if (v.includes('instagram') || v === 'ig') return 'instagram';
  return v || 'unknown';
}

/**
 * Extracts the inbound attachment from a Messenger/Instagram webhook message.
 *
 * Messenger delivers `message.attachments[].payload.url` — a direct CDN link.
 * We take it as-is; no fetch, no decode, no write to TOAST.
 */
export function extractAttachmentFromMessengerMessage(message) {
  const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
  const first = attachments.find((attachment) => pickAttachmentUrl(attachment?.payload)) || attachments[0];
  if (!first) return null;

  const payload = first.payload || {};
  const url = pickAttachmentUrl(payload);

  return {
    kind: first.type || guessKindFromMime(payload.mime_type) || 'file',
    mimeType: payload.mime_type || null,
    name: payload.name || first.name || null,
    size: payload.size ?? null,
    // The whole point: keep the CDN URL, not the bytes.
    url: url || null,
    /** Needed later by /api/chat/refresh-media when the CDN URL expires. */
    attachmentId: first.id || null,
    /** WhatsApp hands us a media id instead of a URL; resolve lazily. */
    mediaId: payload.id || null,
    source: 'webhook',
  };
}

/** Extracts an inbound attachment from a WhatsApp Cloud API message. */
export function extractAttachmentFromWhatsAppMessage(message) {
  const type = message?.type;
  if (!type || !['image', 'video', 'audio', 'document', 'sticker'].includes(type)) return null;

  const media = message[type];
  if (!media?.id && !media?.link) return null;

  return {
    kind: type === 'sticker' ? 'image' : type,
    mimeType: media.mime_type || null,
    name: media.filename || null,
    size: media.file_size ?? null,
    // Present in some webhook payloads, but expires in 5 minutes.
    url: media.link || null,
    attachmentId: media.id || null,
    mediaId: media.id || null,
    caption: media.caption || null,
    source: 'webhook',
  };
}

export function guessKindFromMime(mimeType) {
  if (!mimeType) return null;
  if (mimeType.startsWith('image')) return 'image';
  if (mimeType.startsWith('video')) return 'video';
  if (mimeType.startsWith('audio')) return 'audio';
  return 'file';
}

/**
 * Shapes the attachment into the columns we persist on `chat_messages`.
 * Column names match the migration in migrations/001_media_urls.sql.
 */
export function toMessageColumns(attachment) {
  if (!attachment) {
    return {
      message_type: 'text',
      media_url: null,
      media_type: null,
      media_mime_type: null,
      media_id: null,
      media_source: null,
    };
  }
  return {
    message_type: attachment.kind || 'file',
    media_url: attachment.url || null,
    media_type: attachment.kind || 'file',
    media_mime_type: attachment.mimeType || null,
    media_id: attachment.attachmentId || attachment.mediaId || null,
    media_source: attachment.source || 'webhook',
  };
}

/**
 * Resolves a usable, browser-safe payload for one stored message.
 *
 * Never throws. The inbox must keep rendering text when media is broken.
 */
export async function resolveMessageMedia({ message, graph, env, signMediaToken, logger }) {
  const mediaId = message.media_id;
  const platform = normalizePlatform(message.platform || message.conversation_platform);
  const storedUrl = message.media_url;

  // A signed internal URL is only valid until it expires; always re-sign.
  const sign = (id) => signMediaToken({ messageId: id, exp: Math.floor(Date.now() / 1000) + env.MEDIA_URL_SIGNING_TTL_SECONDS }, env.MEDIA_URL_SIGNING_SECRET);

  // --- WhatsApp: stored URL is useless (5 min). Resolve from the media id. ---
  if (!storedUrl && mediaId && platform === 'whatsapp') {
    try {
      const resolved = await graph.getWhatsAppMediaUrl(mediaId, {
        accessToken: env.WHATSAPP_TOKEN || env.META_PAGE_ACCESS_TOKEN,
        phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      });
      if (resolved?.url) {
        return {
          available: true,
          via: 'graph_whatsapp',
          url: resolved.url,
          proxyUrl: buildProxyUrl(message.id, env, sign),
          mimeType: resolved.mime_type || message.media_mime_type,
          kind: guessKindFromMime(resolved.mime_type) || message.media_type,
          requiresAuthHeader: true,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        };
      }
    } catch (error) {
      logger?.warn(`WhatsApp media ${mediaId} could not be resolved: ${error.message}`);
    }
  }

  if (!storedUrl) {
    return breadcrumbOnly(message, env, sign, 'no_url_stored');
  }

  return {
    available: true,
    via: 'stored_url',
    url: storedUrl,
    proxyUrl: buildProxyUrl(message.id, env, sign),
    mimeType: message.media_mime_type,
    kind: message.media_type,
    // Facebook CDN URLs are fetchable directly; WhatsApp ones need our proxy.
    requiresAuthHeader: platform === 'whatsapp',
    expiresAt: null,
  };
}

/**
 * Browsers cannot load a URL that needs an Authorization header, so WhatsApp
 * media is always served through /api/chat/media/:id (or /s/:token).
 */
export function buildProxyUrl(messageId, env, sign) {
  const token = sign(messageId);
  const base = env.PUBLIC_API_BASE_URL.replace(/\/+$/, '');
  return `${base}/api/chat/media/s/${token}`;
}

export function breadcrumbOnly(message, env, sign, reason = 'media_unavailable') {
  return {
    available: false,
    reason,
    url: null,
    proxyUrl: message?.id ? buildProxyUrl(message.id, env, sign) : null,
    kind: message?.media_type,
    mimeType: message?.media_mime_type,
  };
}

/**
 * Serialises a message row for the inbox API.
 * The contract stays backwards compatible: `content` for text, plus
 * `media`/`media_url` so the existing ChatThread keeps working.
 */
export function serializeMessage(message, media) {
  const content = message.content ?? '';
  const hasMedia = Boolean(message.media_url || message.media_id || message.media_type);

  return {
    ...message,
    content: content || mediaLabel(message, media),
    has_media: hasMedia,
    media_url: message.media_url || null,
    media: media
      ? {
          available: media.available,
          url: media.available ? media.url : null,
          proxy_url: media.proxyUrl,
          kind: media.kind,
          mime_type: media.mimeType,
          available_via: media.via || null,
          expires_at: media.expiresAt || null,
        }
      : null,
  };
}

function mediaLabel(message, media) {
  if (!message.media_type) return '';
  const kind = media?.kind || message.media_type;
  const map = { image: '📷 Photo', video: '🎬 Video', audio: '🎤 Voice message', file: '📎 Attachment', sticker: '💟 Sticker' };
  const label = map[kind] || '📎 Attachment';
  return message.media_name ? `${label}: ${message.media_name}` : label;
}

export { HttpError };
