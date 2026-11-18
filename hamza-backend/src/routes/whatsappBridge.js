import { asyncHandler, badRequest, HttpError, notFound, unauthorized } from '../lib/httpError.js';
import { safeEqual } from '../lib/mediaSignature.js';

// Match the same customer address an inbound thread can store. Never strip
// all non-digits: groups and WhatsApp privacy IDs (LIDs) aren't phone numbers.
function customerIds(peer) {
  if (typeof peer !== 'string') return [];
  const lid = /^(\d{1,20})(?::\d+)?@lid$/.exec(peer);
  if (lid) return [`${lid[1]}@lid`];
  const phone = /^\+?([1-9]\d{4,14})$/.exec(peer)
    ?? /^([1-9]\d{4,14})(?::\d+)?@(?:c\.us|s\.whatsapp\.net)$/.exec(peer);
  if (!phone) return [];
  const n = phone[1];
  return [n, `+${n}`, `${n}@c.us`, `${n}@s.whatsapp.net`];
}

/** Record a text already sent on the linked device. This route must NEVER send to WhatsApp. */
export function createWhatsAppBridgeHandler({ env, client, logger }) {
  return asyncHandler(async (req, res) => {
    const secret = env.WHATSAPP_BRIDGE_SECRET?.trim();
    if (!secret) throw new HttpError(503, 'Linked-device reply sync is not configured.', { code: 'BRIDGE_DISABLED', expose: true });
    const token = /^Bearer (\S+)$/i.exec(req.get('authorization') || '')?.[1];
    if (!token || !safeEqual(token, secret)) throw unauthorized('Invalid bridge credential.');

    const { fromMe, peer, peerAlt, id, timestamp, text } = req.body || {};
    if (fromMe !== true) throw badRequest('Expected a sent message (fromMe: true).');
    const ids = customerIds(peer);
    if (!ids.length) throw badRequest('peer must be the direct customer chat address.');
    if (peerAlt != null) {
      const alt = customerIds(peerAlt);
      if (!alt.length || ids[0].endsWith('@lid') === alt[0].endsWith('@lid')) {
        throw badRequest('Expected a provider-mapped LID and phone address.');
      }
      ids.push(...alt);
    }
    if (typeof id !== 'string' || !id.length || id.length > 256 || /\s/.test(id) || id.includes('\0')) {
      throw badRequest('A stable WhatsApp message id is required.');
    }
    if (typeof text !== 'string' || !text.trim() || text.length > 65536 || text.includes('\0')) {
      throw badRequest('Expected a non-empty text reply of at most 65536 characters.');
    }
    if (!Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp > Date.now() / 1000 + 300) {
      throw badRequest('Expected the WhatsApp send timestamp in Unix seconds.');
    }

    const { data, error } = await client.rpc('record_whatsapp_bridge_reply', {
      p_customer_ids: ids, p_page_id: env.WHATSAPP_BRIDGE_PAGE_ID?.trim() || null,
      p_message_id: id, p_content: text, p_created_at: new Date(timestamp * 1000).toISOString(),
    });
    if (error) {
      // PostgREST details can contain message text. Log only the error code.
      logger?.warn('Linked-device reply could not be recorded', { code: error.code });
      throw new HttpError(503, 'Could not record the reply. Check the bridge migration and retry the same event.',
        { code: 'BRIDGE_WRITE_FAILED', expose: true });
    }
    if (data === 'no_thread') throw notFound('No matching WhatsApp inbox thread for this customer and linked account.');
    if (data === 'ambiguous') throw new HttpError(409, 'More than one WhatsApp thread matches this recipient.', { code: 'AMBIGUOUS_THREAD' });
    if (data !== 'stored' && data !== 'duplicate') throw new Error('Unexpected linked-device reply result.');
    res.status(data === 'stored' ? 201 : 200).json({ success: true, result: data });
  });
}
