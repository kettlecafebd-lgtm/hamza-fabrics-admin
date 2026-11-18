/** Merge history and concurrent live events without moving older bubbles below a new reply. */
export function mergeMessages(...lists) {
  const messages = [];
  const seen = new Set();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const message of list) {
      if (!message || typeof message !== 'object') continue;
      const keys = [];
      if (message.id != null) keys.push(`id:${message.id}`);
      if (message.platform_message_id) keys.push(`platform:${message.platform_message_id}`);
      if (!keys.length) keys.push(`fallback:${message.direction}:${message.created_at}:${message.content}`);
      if (keys.some(key => seen.has(key))) continue;
      for (const key of keys) seen.add(key);
      messages.push(message);
    }
  }
  return messages.sort((a, b) => (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0));
}
