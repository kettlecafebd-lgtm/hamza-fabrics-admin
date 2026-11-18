// Copy into the EXISTING server-side QR bridge. No login, WhatsApp send,
// session files or SDK dependencies: these functions observe its events only.
const directJid = jid => typeof jid === 'string' && /@(c\.us|s\.whatsapp\.net|lid)$/.test(jid);

function reply(peer, id, timestamp, text) {
  if (!directJid(peer) || !id || typeof text !== 'string' || !text.trim()) return null;
  return { fromMe: true, peer, id, timestamp: Number(timestamp), text };
}

// whatsapp-web.js: 'message_create' includes own sends; 'message' does not.
export async function fromWebJs(message, client) {
  if (message?.fromMe !== true || message.type !== 'chat') return null;
  const event = reply(message.to, message.id?.id, message.timestamp, message.body);
  // The same contact may be addressed by LID on the device but by phone in
  // the incoming thread. Use only WhatsApp's mapping; otherwise keep the LID.
  if (event?.peer.endsWith('@lid') && client?.getContactLidAndPhone) {
    const [contact] = await client.getContactLidAndPhone([event.peer]).catch(() => []);
    if (contact?.pn && contact.lid === event.peer) event.peerAlt = contact.pn;
  }
  return event;
}

// Baileys: call for EACH message in 'messages.upsert', including fromMe.
export function fromBaileys(message) {
  const key = message?.key;
  if (key?.fromMe !== true) return null;
  const content = message.message?.ephemeralMessage?.message ?? message.message;
  const event = reply(key.remoteJid, key.id, message.messageTimestamp, content?.conversation ?? content?.extendedTextMessage?.text);
  // Newer versions can supply BOTH a phone JID and an opaque privacy ID.
  if (event && directJid(key.remoteJidAlt) && key.remoteJidAlt.endsWith('@lid') !== key.remoteJid.endsWith('@lid')) {
    event.peerAlt = key.remoteJidAlt;
  }
  return event;
}

// Resolves to 'stored' or 'duplicate'; on failure give the SAME event to the
// bridge's retry/error handling. Never send another message to the customer.
export async function forwardReply(event, {
  endpoint = process.env.WHATSAPP_BRIDGE_REPLY_URL, secret = process.env.WHATSAPP_BRIDGE_SECRET,
} = {}) {
  if (!event) return;
  if (!secret || !endpoint || new URL(endpoint).protocol !== 'https:') {
    throw new Error('Configure the HTTPS inbox reply URL and bridge secret on the bridge server.');
  }
  const response = await fetch(endpoint, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!response.ok) throw new Error(`Inbox reply sync: HTTP ${response.status}.`);
  const body = await response.json().catch(() => null);
  if (!body?.success || !['stored', 'duplicate'].includes(body.result)) throw new Error('Inbox did not confirm reply sync. Check the receiver URL.');
  return body.result;
}
