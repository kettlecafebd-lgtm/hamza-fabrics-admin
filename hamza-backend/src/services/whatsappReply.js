import { badRequest, HttpError } from '../lib/httpError.js';

const unconfirmed = () => new HttpError(502,
  'WhatsApp did not confirm this reply. Check with the recipient before sending it again.',
  { code: 'WHATSAPP_UNCONFIRMED', expose: true });

/** Reply from the business number that received the inbound message, to its sender. */
export async function sendWhatsAppReply({ env, graph, conversation, content }) {
  const token = env.WHATSAPP_TOKEN?.trim();
  const configuredSender = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const phoneNumberId = String(conversation.page_id || configuredSender || '');
  if (!token || !/^\d+$/.test(phoneNumberId)) {
    throw new HttpError(503,
      'WhatsApp sending is not configured. Ask the server admin to check the WhatsApp access token and business phone number ID.',
      { code: 'WHATSAPP_NOT_CONFIGURED', expose: true });
  }
  if (configuredSender && phoneNumberId !== configuredSender) {
    throw new HttpError(409, 'This conversation belongs to a different WhatsApp business number than the one configured for sending.',
      { code: 'WHATSAPP_NUMBER_MISMATCH' });
  }
  const to = conversation.external_id;
  if (typeof to !== 'string' || !to.trim()) {
    throw new HttpError(422, 'This conversation has no customer WhatsApp ID to reply to.', { code: 'WHATSAPP_NO_RECIPIENT' });
  }
  if (Array.from(content).length > 4096) throw badRequest('A WhatsApp text reply can contain at most 4096 characters.');

  let result;
  try {
    result = await graph.request(`${phoneNumberId}/messages`, {
      method: 'POST', accessToken: token,
      json: { messaging_product: 'whatsapp', to, type: 'text', text: { body: content } },
    });
  } catch (error) {
    // A lost response is not proof the send failed. Never automatically retry.
    const code = /^GRAPH_(\d+)$/.exec(error.code)?.[1];
    if (!code || error.details?.status >= 500) throw unconfirmed();

    let hint = 'Have the server admin check this error code.';
    if (code === '131047') hint = 'The 24-hour reply window has closed. Wait for a new customer message or use an approved template.';
    if (['190', '10', '200', '131005'].includes(code)) hint = 'Ask the server admin to check the connected number’s access token and messaging permission.';
    throw new HttpError(502, `WhatsApp rejected the reply (code ${code}). ${hint}`, { code: `WHATSAPP_${code}`, expose: true });
  }

  const id = result?.messages?.[0]?.id;
  if (typeof id !== 'string' || !id.trim()) throw unconfirmed();
  return id; // Acceptance by Meta, not a handset delivery receipt.
}
