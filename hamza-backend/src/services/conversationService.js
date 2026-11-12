import { isMissingRelation } from '../db/supabase.js';

/** Minimal find-or-create so webhook ingestion never duplicates threads. */
export function createConversationService({ client, logger }) {
  async function findOrCreate({ platform, externalId, pageId, contactName }) {
    const { data: existing, error } = await client
      .from('conversations')
      .select('id, platform, customer_name, external_id')
      .eq('platform', platform)
      .eq('external_id', externalId)
      .limit(1)
      .maybeSingle();

    if (error && !isMissingRelation(error)) throw error;
    if (existing) return existing;

    const { data: created, error: insertError } = await client
      .from('conversations')
      .insert({
        platform,
        external_id: externalId,
        customer_name: contactName || externalId,
        page_id: pageId || null,
        last_message_at: new Date().toISOString(),
      })
      .select('id, platform, customer_name, external_id')
      .single();

    if (insertError) {
      // Race with a concurrent webhook: re-read instead of failing the delivery.
      logger?.warn('conversation insert failed, retrying read', insertError.code);
      const { data: raced } = await client
        .from('conversations')
        .select('id, platform, customer_name, external_id')
        .eq('platform', platform)
        .eq('external_id', externalId)
        .limit(1)
        .maybeSingle();
      if (raced) return raced;
      throw insertError;
    }
    return created;
  }

  return { findOrCreate };
}

export default createConversationService;
