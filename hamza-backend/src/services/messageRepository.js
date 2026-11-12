import { isMissingRelation } from '../db/supabase.js';

/**
 * All `chat_messages` access lives here.
 *
 * Note the column allowlist in SELECTS: we never ask PostgREST for a blob
 * column. Selecting `data`/`payload` from a joined table is what turned one
 * inbox page load into megabytes of egress.
 */
const MESSAGE_COLUMNS = [
  'id',
  'conversation_id',
  'platform_message_id',
  'direction',
  'content',
  'created_at',
  'message_type',
  'media_url',
  'media_type',
  'media_mime_type',
  'media_id',
  'media_source',
  'media_refreshed_at',
].join(',');

export function createMessageRepository({ client, logger }) {
  async function findMessage(messageId) {
    const { data, error } = await client
      .from('chat_messages')
      .select(MESSAGE_COLUMNS)
      .eq('id', messageId)
      .maybeSingle();

    if (error) {
      if (isMissingRelation(error)) return null; // pre-migration schema
      throw error;
    }
    return data || null;
  }

  async function findMessageByPlatformId(platformMessageId) {
    const { data, error } = await client
      .from('chat_messages')
      .select(MESSAGE_COLUMNS)
      .eq('platform_message_id', platformMessageId)
      .maybeSingle();

    if (error) {
      if (isMissingRelation(error)) return null;
      throw error;
    }
    return data || null;
  }

  /**
   * Pre-migration fallback: the media columns may not exist yet. We detect
   * once and then keep using the reduced column set instead of erroring on
   * every single message insert.
   */
  let legacySchema = false;

  async function insertMessage(row) {
    const attempt = async (payload) => {
      const { data, error } = await client.from('chat_messages').insert(payload).select(MESSAGE_COLUMNS).single();
      if (error) throw error;
      return data;
    };

    if (!legacySchema) {
      try {
        return await attempt(row);
      } catch (error) {
        if (isMissingRelation(error) && /column|media_/i.test(String(error.message))) {
          legacySchema = true;
          logger?.warn(
            'chat_messages media columns are missing — run migrations/001_media_urls.sql. ' +
              'Falling back to legacy insert for this process.',
          );
        } else {
          throw error;
        }
      }
    }

    const { media_url, media_type, media_mime_type, media_id, media_source, message_type, ...rest } = row;
    return attempt(rest);
  }

  /** The one write that retires the blob table: a URL string and its metadata. */
  async function updateMessageMedia(messageId, { url, mimeType, kind, refreshedAt = new Date().toISOString() }) {
    const { data, error } = await client
      .from('chat_messages')
      .update({
        media_url: url,
        media_mime_type: mimeType ?? null,
        media_type: kind ?? null,
        media_source: 'refreshed',
        media_refreshed_at: refreshedAt,
        updated_at: refreshedAt,
      })
      .eq('id', messageId)
      .select(MESSAGE_COLUMNS)
      .maybeSingle();

    if (error) {
      if (isMissingRelation(error)) {
        logger?.warn('Cannot persist refreshed media URL: media columns missing. Returning URL only.');
        return { persisted: false, message: null };
      }
      throw error;
    }
    return { persisted: true, message: data };
  }

  async function touchConversation(conversationId, { lastMessage, at }) {
    if (!conversationId) return;
    const { error } = await client
      .from('conversations')
      .update({ last_message: lastMessage, last_message_at: at })
      .eq('id', conversationId);
    if (error && !isMissingRelation(error)) {
      logger?.warn('Could not update conversation preview', { code: error.code, message: error.message });
    }
  }

  return { findMessage, findMessageByPlatformId, insertMessage, updateMessageMedia, touchConversation };
}

export default createMessageRepository;
