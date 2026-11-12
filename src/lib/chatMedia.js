/**
 * Chat media helpers.
 *
 * Chat attachments are NOT stored in our database any more: the backend keeps
 * a Facebook CDN URL (or a WhatsApp media id) on `chat_messages` and hands the
 * browser either that URL or a signed proxy link (`media.proxy_url`).
 *
 * Facebook/WhatsApp CDN links expire. When an <img> fails to load we call
 * `GET /api/chat/refresh-media/:messageId`, which asks Graph for a fresh URL,
 * persists it, and returns it. That is the whole recovery story — no base64,
 * no blobs, no re-upload.
 */
import API_BASE_URL from '../config/api';

/** Resolves the best source for a message's media, if any. */
export function getMediaSrc(message) {
  if (!message?.has_media) return null;
  const media = message.media;
  if (!media) return message.media_url || null;

  // Prefer the signed proxy URL: it works for WhatsApp too, where the raw URL
  // requires an Authorization header the browser cannot send.
  if (media.proxy_url) return `${API_BASE_URL}${media.proxy_url}`;
  return media.url || message.media_url || null;
}

export function isImage(message, media) {
  const kind = message?.media_type || media?.kind;
  const mime = message?.media_mime_type || media?.mime_type || '';
  return kind === 'image' || kind === 'sticker' || mime.startsWith('image/');
}

export function isVideo(message, media) {
  const kind = message?.media_type || media?.kind;
  const mime = message?.media_mime_type || media?.mime_type || '';
  return kind === 'video' || mime.startsWith('video/');
}

export function isAudio(message, media) {
  const kind = message?.media_type || media?.kind;
  const mime = message?.media_mime_type || media?.mime_type || '';
  return kind === 'audio' || mime.startsWith('audio/');
}

/**
 * Asks the backend to re-resolve an expired attachment URL.
 * Returns the fresh URL, or null when it cannot be recovered.
 */
export async function refreshMediaUrl(messageId, token = localStorage.getItem('adminToken')) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/refresh-media/${encodeURIComponent(messageId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.success) return null;
    return data.proxy_url ? `${API_BASE_URL}${data.proxy_url}` : data.url || null;
  } catch {
    return null;
  }
}
