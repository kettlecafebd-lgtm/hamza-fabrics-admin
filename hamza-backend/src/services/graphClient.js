import { badGateway, HttpError } from '../lib/httpError.js';

/**
 * Thin Graph API client. Only three calls matter for chat media:
 *
 *   1. GET /{mid}?fields=attachments          -> Messenger / IG attachment URLs
 *   2. GET /{media_id}?phone_number_id=...    -> WhatsApp temporary URL (5 min)
 *   3. GET <temporary url> + Bearer token     -> WhatsApp bytes (needs the header)
 *
 * Docs:
 *   https://developers.facebook.com/docs/graph-api/reference/message/
 *   https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/
 */
export const ATTACHMENT_FIELDS = [
  'attachments{id,mime_type,name,size,file_url,image_data,image_data{url,preview_url},video_data,video_data{url,preview_url}}',
  'message',
  'created_time',
].join(',');

export function createGraphClient({ baseUrl, version, logger, fetchImpl = globalThis.fetch }) {
  const root = `${baseUrl.replace(/\/+$/, '')}/${version}`;

  async function request(path, { accessToken, method = 'GET', timeoutMs = 10_000, query = {} } = {}) {
    if (!accessToken) {
      throw new HttpError(500, 'No access token configured for Graph API.', { code: 'GRAPH_NO_TOKEN' });
    }

    const url = new URL(`${root}/${path.replace(/^\/+/, '')}`);
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== '') url.searchParams.set(key, String(value));
    }
    // Token in the header, never in the URL: URLs end up in logs and referrers.
    url.searchParams.set('access_token', accessToken);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(url, { method, signal: controller.signal });
    } catch (error) {
      throw badGateway(`Graph API request failed: ${error.message}`, { path });
    } finally {
      clearTimeout(timer);
    }

    let body;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok || body?.error) {
      const meta = body?.error || {};
      // Never include the request URL: it carries the access token.
      logger?.warn('Graph API error', {
        path,
        status: res.status,
        code: meta.code,
        subcode: meta.error_subcode,
        message: meta.message,
        type: meta.type,
      });
      throw new HttpError(res.status === 404 ? 404 : 502, meta.message || 'Graph API error.', {
        code: `GRAPH_${meta.code || res.status}`,
        details: { type: meta.type, subcode: meta.error_subcode, path },
        expose: res.status === 404,
      });
    }

    return body;
  }

  return {
    root,
    /** Fetch attachment metadata for a Messenger/Instagram message id. */
    async getMessageAttachments(messageId, accessToken) {
      const body = await request(messageId, { accessToken, query: { fields: ATTACHMENT_FIELDS } });
      return body;
    },
    /** Resolve a WhatsApp media id to its 5-minute download URL. */
    async getWhatsAppMediaUrl(mediaId, { accessToken, phoneNumberId }) {
      return request(mediaId, {
        accessToken,
        query: phoneNumberId ? { phone_number_id: phoneNumberId } : {},
      });
    },
    request,
  };
}

/**
 * Pulls the best displayable URL out of a Graph attachment object.
 * Order matters: `file_url` is present for files, `image_data.url` for photos,
 * `video_data.url` for video (with a preview still as a last resort).
 */
export function pickAttachmentUrl(attachment) {
  if (!attachment || typeof attachment !== 'object') return null;
  return (
    attachment.file_url ||
    attachment.image_data?.url ||
    attachment.image_data?.preview_url ||
    attachment.video_data?.url ||
    attachment.video_data?.preview_url ||
    attachment.url ||
    null
  );
}

export function normalizeAttachments(graphMessage) {
  const list = graphMessage?.attachments?.data;
  if (!Array.isArray(list)) return [];
  return list.map((attachment) => ({
    id: attachment.id || null,
    mimeType: attachment.mime_type || null,
    name: attachment.name || null,
    size: attachment.size ?? null,
    url: pickAttachmentUrl(attachment),
    kind: attachment.mime_type?.startsWith('video')
      ? 'video'
      : attachment.mime_type?.startsWith('image') || attachment.image_data
        ? 'image'
        : 'file',
  }));
}

export default createGraphClient;
