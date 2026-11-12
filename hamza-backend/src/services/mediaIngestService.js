import {
  extractAttachmentFromMessengerMessage,
  extractAttachmentFromWhatsAppMessage,
  normalizePlatform,
  toMessageColumns,
} from './attachmentResolver.js';

/**
 * Inbound webhook -> chat_messages, with no blob writes.
 *
 * Flow for every inbound event:
 *   1. find/create the conversation
 *   2. extract attachment metadata + CDN URL (no network I/O)
 *   3. INSERT the message with media_url / media_id / media_mime_type
 *   4. return the row so the socket can push it to the inbox
 *
 * `deliveryStatus` answers Meta's retries with 200 even when a single message
 * cannot be stored, so Meta does not replay the whole batch for 7 days.
 */
export function createMediaIngestService({ messages, conversations, logger }) {
  async function handleMessengerMessage({ pageId, event }) {
    const message = event?.message;
    if (!message || message.is_echo) return { handled: false, reason: 'not_inbound' };

    const platformMessageId = message.mid;
    const senderId = event.sender?.id;
    if (!platformMessageId || !senderId) return { handled: false, reason: 'incomplete_event' };

    const existing = await messages.findMessageByPlatformId(platformMessageId);
    if (existing) return { handled: false, reason: 'duplicate', message: existing };

    const attachment = extractAttachmentFromMessengerMessage(message);
    const conversation = await conversations.findOrCreate({
      platform: 'messenger',
      externalId: senderId,
      pageId,
    });

    const direction = senderId === pageId ? 'outbound' : 'inbound';
    const content = message.text || attachment?.caption || '';

    const row = {
      conversation_id: conversation.id,
      platform_message_id: platformMessageId,
      direction,
      content,
      created_at: toIso(message.timestamp),
      ...toMessageColumns(attachment),
    };

    const saved = await messages.insertMessage(row);
    await messages.touchConversation(conversation.id, {
      lastMessage: content || attachmentLabel(attachment),
      at: row.created_at,
    });

    logger?.info(`stored messenger message ${platformMessageId}`, {
      media: attachment ? attachment.kind : 'none',
      storedUrl: Boolean(attachment?.url),
      blobBytesWritten: 0,
    });

    return { handled: true, conversationId: conversation.id, message: saved, attachment };
  }

  async function handleWhatsAppMessage({ phoneNumberId, value }) {
    const message = value?.messages?.[0];
    if (!message) return { handled: false, reason: 'no_message' };

    const platformMessageId = message.id;
    const waId = message.from;
    if (!platformMessageId || !waId) return { handled: false, reason: 'incomplete_event' };

    const existing = await messages.findMessageByPlatformId(platformMessageId);
    if (existing) return { handled: false, reason: 'duplicate', message: existing };

    const attachment = extractAttachmentFromWhatsAppMessage(message);
    const conversation = await conversations.findOrCreate({
      platform: 'whatsapp',
      externalId: waId,
      pageId: phoneNumberId,
      contactName: value?.contacts?.[0]?.profile?.name,
    });

    const content = message.text?.body || attachment?.caption || '';
    const row = {
      conversation_id: conversation.id,
      platform_message_id: platformMessageId,
      direction: 'inbound',
      content,
      created_at: toIso(message.timestamp ? Number(message.timestamp) * 1000 : undefined),
      ...toMessageColumns(attachment),
    };

    const saved = await messages.insertMessage(row);
    await messages.touchConversation(conversation.id, {
      lastMessage: content || attachmentLabel(attachment),
      at: row.created_at,
    });

    logger?.info(`stored whatsapp message ${platformMessageId}`, {
      media: attachment ? attachment.kind : 'none',
      // WhatsApp gives a media id, not a URL; it is resolved on read.
      mediaId: attachment?.mediaId || null,
      blobBytesWritten: 0,
    });

    return { handled: true, conversationId: conversation.id, message: saved, attachment };
  }

  return { handleMessengerMessage, handleWhatsAppMessage };
}

function attachmentLabel(attachment) {
  if (!attachment) return '';
  const map = { image: '📷 Photo', video: '🎬 Video', audio: '🎤 Voice message', document: '📎 Document', file: '📎 Attachment' };
  return map[attachment.kind] || '📎 Attachment';
}

function toIso(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export default createMediaIngestService;
