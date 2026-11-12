/**
 * Tests for the behaviours this refactor must guarantee.
 * Run from hamza-backend/:  npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { extractAttachmentFromMessengerMessage, extractAttachmentFromWhatsAppMessage, toMessageColumns } from '../src/services/attachmentResolver.js';
import { signMediaToken, verifyMediaToken, safeEqual } from '../src/lib/mediaSignature.js';
import { isAllowedMediaHost } from '../src/services/mediaFetcher.js';
import { verifyMetaSignature } from '../src/lib/metaSignature.js';
import { isMissingRelation } from '../src/db/supabase.js';
import { buildProxyUrlSafe } from './helpers.js';
import { createCircuitBreaker } from '../src/lib/circuitBreaker.js';
import { LruCache } from '../src/lib/lruCache.js';

const SECRET = 'test-secret-value';

test('Messenger attachment keeps payload.url and never signals byte storage', () => {
  const message = {
    mid: 'm_abc123',
    attachments: [{
      type: 'image',
      payload: {
        url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=abc&ext=123',
        mime_type: 'image/jpeg',
      },
    }],
  };

  const attachment = extractAttachmentFromMessengerMessage(message);
  assert.equal(attachment.kind, 'image');
  assert.match(attachment.url, /^https:\/\/lookaside\.fbsbx\.com/);
  assert.equal(attachment.mediaId, null);

  const columns = toMessageColumns(attachment);
  assert.equal(columns.media_url, attachment.url);
  assert.equal(columns.message_type, 'image');
  // The column set has no data/base64 field at all.
  assert.deepEqual(Object.keys(columns).sort(), [
    'media_id', 'media_mime_type', 'media_source', 'media_type', 'media_url', 'message_type',
  ]);
});

test('Messenger attachment with no url still stores the id for later refresh', () => {
  const attachment = extractAttachmentFromMessengerMessage({
    attachments: [{ type: 'image', id: 'att_42', payload: {} }],
  });
  assert.equal(attachment.url, null);
  assert.equal(attachment.attachmentId, 'att_42');
});

test('WhatsApp attachment stores media id, not a soon-dead URL', () => {
  const attachment = extractAttachmentFromWhatsAppMessage({
    type: 'image',
    image: { id: 'media_999', mime_type: 'image/jpeg', caption: 'hi' },
  });
  assert.equal(attachment.mediaId, 'media_999');
  assert.equal(attachment.kind, 'image');
});

test('text message produces no media columns to write', () => {
  const columns = toMessageColumns(null);
  assert.equal(columns.media_url, null);
  assert.equal(columns.message_type, 'text');
});

test('signed media token round-trips and hides the upstream URL', () => {
  const exp = Math.floor(Date.now() / 1000) + 60;
  const token = signMediaToken({ messageId: 'msg-1', exp }, SECRET);

  assert.ok(!token.includes('fbsbx'), 'token must not leak the CDN host');
  const verified = verifyMediaToken(token, SECRET);
  assert.equal(verified.ok, true);
  assert.equal(verified.messageId, 'msg-1');
});

test('expired media token is rejected', () => {
  const token = signMediaToken({ messageId: 'msg-1', exp: Math.floor(Date.now() / 1000) - 1 }, SECRET);
  assert.deepEqual(verifyMediaToken(token, SECRET), { ok: false, reason: 'expired' });
});

test('tampered media token is rejected', () => {
  const exp = Math.floor(Date.now() / 1000) + 60;
  const token = signMediaToken({ messageId: 'msg-1', exp }, SECRET);
  const [body, sig] = token.split('.');
  const forgedBody = Buffer.from(JSON.stringify({ i: 'msg-2', e: exp })).toString('base64url');
  assert.deepEqual(verifyMediaToken(`${forgedBody}.${sig}`, SECRET), { ok: false, reason: 'bad_signature' });
  assert.ok(body && sig);
});

test('media host allowlist blocks SSRF attempts', () => {
  assert.equal(isAllowedMediaHost('https://lookaside.fbsbx.com/x.jpg'), true);
  assert.equal(isAllowedMediaHost('https://scontent.xx.fbcdn.net/x.jpg'), true);
  assert.equal(isAllowedMediaHost('http://lookaside.fbsbx.com/x.jpg'), false, 'https only');
  assert.equal(isAllowedMediaHost('https://169.254.169.254/latest/meta-data'), false);
  assert.equal(isAllowedMediaHost('https://localhost/x'), false);
  assert.equal(isAllowedMediaHost('https://evil.com/fbcdn.net'), false);
});

test('Meta webhook signature verification matches Graph documentation', () => {
  const rawBody = Buffer.from(JSON.stringify({ object: 'page' }));
  const digest = crypto.createHmac('sha256', 'appsecret').update(rawBody).digest('hex');

  assert.equal(
    verifyMetaSignature({ rawBody, headers: { 'x-hub-signature-256': `sha256=${digest}` }, appSecret: 'appsecret' }).ok,
    true,
  );
  assert.equal(
    verifyMetaSignature({ rawBody, headers: { 'x-hub-signature-256': 'sha256=deadbeef' }, appSecret: 'appsecret' }).ok,
    false,
  );
  assert.equal(
    verifyMetaSignature({ rawBody, headers: {}, appSecret: 'appsecret' }).ok,
    false,
  );
});

test('dropped/truncated blob table is detected as "missing", not as a crash', () => {
  assert.equal(isMissingRelation({ code: '42P01', message: 'relation "chat_media_blobs" does not exist' }), true);
  assert.equal(isMissingRelation({ code: 'PGRST205', message: "Could not find the table 'public.chat_media_blobs'" }), true);
  assert.equal(isMissingRelation({ code: '42501', message: 'permission denied' }), true);
  assert.equal(isMissingRelation({ code: '57014', message: 'canceling statement due to statement timeout' }), false);
  assert.equal(isMissingRelation(null), false);
});

test('circuit breaker stops hammering a missing table', () => {
  let now = 1000;
  const breaker = createCircuitBreaker({ cooldownMs: 5000, now: () => now });
  assert.equal(breaker.isOpen(), false);
  assert.equal(breaker.trip('relation does not exist'), true); // logs once
  assert.equal(breaker.isOpen(), true);
  now += 5001;
  assert.equal(breaker.isOpen(), false);
});

test('LRU cache bounds memory and evicts the least recently used entry', () => {
  const cache = new LruCache({ maxBytes: 100, maxEntries: 5 });
  const value = Buffer.alloc(40);

  cache.set('a', value, 1000);
  cache.set('b', value, 1000);

  // Reading 'a' makes 'b' the least-recently-used entry.
  assert.equal(cache.get('a')?.length, 40);

  cache.set('c', value, 1000); // 120 bytes > 100 -> must evict exactly one
  assert.ok(cache.bytes <= 100, `bytes ${cache.bytes} should stay within budget`);
  assert.equal(cache.get('b'), null, 'b was LRU and should be evicted');
  assert.equal(cache.get('a')?.length, 40);
  assert.equal(cache.get('c')?.length, 40);
});

test('LRU cache honours TTL', () => {
  const cache = new LruCache({ maxBytes: 100, maxEntries: 5 });
  cache.set('short', Buffer.alloc(10), -1); // already expired
  assert.equal(cache.get('short'), null);
});

test('proxy URL is absolute-free and signed', () => {
  const url = buildProxyUrlSafe('msg-1', SECRET);
  assert.match(url, /^\/api\/chat\/media\/s\//);
});

test('safeEqual compares without throwing on length mismatch', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual(undefined, 'x'), false);
});
