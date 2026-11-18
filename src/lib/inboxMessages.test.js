import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeMessages } from './inboxMessages.js';

test('refresh merges the newest page with old rows and an overlapping live phone reply in time order', () => {
  const old = { id: 1, created_at: '2026-01-01T00:00:00Z' };
  const incoming = { id: 2, created_at: '2026-01-01T01:00:00Z', direction: 'inbound' };
  const reply = { id: 3, platform_message_id: 'phone-event', created_at: '2026-01-01T02:00:00Z', direction: 'outbound', content: 'Yes, in stock' };
  const live = { ...reply, id: undefined };
  assert.deepEqual(mergeMessages([incoming, reply], [old, incoming, live]), [old, incoming, reply]);
});
