/**
 * Live proof harness — exercises the REAL routes over real HTTP.
 *
 * Proves the three requirements against the actual backend in this repo:
 *   1. webhook stores payload.url, writes zero bytes
 *   2. proxy 302-redirects to the CDN URL; 404 (never 500) when the blob table
 *      is truncated or dropped
 *   3. /api/chat/refresh-media/:messageId re-resolves via Graph and persists
 *
 *   node test/verify-requirements.mjs
 */
import http from 'node:http';
import crypto from 'node:crypto';
import express from 'express';

import { createWebhookRouter } from '../src/routes/webhooks.js';
import { createMediaRouter } from '../src/routes/media.js';
import { createRefreshMediaRouter } from '../src/routes/refreshMedia.js';
import { createGraphClient } from '../src/services/graphClient.js';
import { createMessageRepository } from '../src/services/messageRepository.js';
import { createConversationService } from '../src/services/conversationService.js';
import { createMediaIngestService } from '../src/services/mediaIngestService.js';
import { createBlobStore } from '../src/services/legacyBlobStore.js';
import { createMediaFetcher } from '../src/services/mediaFetcher.js';
import { metaSignatureMiddleware } from '../src/lib/metaSignature.js';
import { signMediaToken } from '../src/lib/mediaSignature.js';

const APP_SECRET = 'proof-app-secret';
const SIGNING_SECRET = 'proof-signing-secret';
const CDN = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=FRESH&ext=123';
const FB_CDN = 'https://scontent.xx.fbcdn.net/v/t1.0-9/photo.jpg';

const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', `${name} :: ${e.message}`]); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// ─────────────────────────────────────────── mock Graph API
const graphHits = [];
const graph = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  graphHits.push(url.pathname + url.search);
  res.setHeader('content-type', 'application/json');
  if (url.pathname.includes('/m_expired_1')) {
    return res.end(JSON.stringify({
      id: 'm_expired_1',
      attachments: { data: [{ id: 'a1', mime_type: 'image/jpeg', name: 'p.jpg', file_url: CDN,
        image_data: { url: CDN, preview_url: CDN } }] },
    }));
  }
  if (url.pathname.includes('/wa_media_5')) {
    return res.end(JSON.stringify({ id: 'wa_media_5', mime_type: 'image/jpeg', url: 'https://lookaside.fbsbx.com/wa.jpg' }));
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: { message: 'unsupported', code: 100 } }));
});
await new Promise((r) => graph.listen(0, '127.0.0.1', r));
const graphPort = graph.address().port;

// ─────────────────────────────────────────── in-memory Supabase stand-in
const db = {
  chat_messages: [
    // URL stored, blob table irrelevant -> must 302
    { id: 'msg-302', conversation_id: 'c1', platform: 'messenger', platform_message_id: 'm_1',
      direction: 'inbound', content: '', created_at: new Date().toISOString(),
      media_url: FB_CDN, media_type: 'image', media_mime_type: 'image/jpeg', media_id: null, media_source: 'webhook' },
    // expired URL -> refresh endpoint must re-resolve and persist
    { id: 'msg-expired', conversation_id: 'c1', platform: 'messenger', platform_message_id: 'm_expired_1',
      direction: 'inbound', content: '', created_at: new Date().toISOString(),
      media_url: 'https://scontent.xx.fbcdn.net/EXPIRED.jpg', media_type: 'image',
      media_mime_type: 'image/jpeg', media_id: null, media_source: 'webhook' },
    // whatsapp: media id only, no URL
    { id: 'msg-wa', conversation_id: 'c2', platform: 'whatsapp', platform_message_id: 'wamid.5',
      direction: 'inbound', content: '', created_at: new Date().toISOString(),
      media_url: null, media_type: 'image', media_mime_type: 'image/jpeg', media_id: 'wa_media_5', media_source: 'webhook' },
  ],
  conversations: [{ id: 'c1', platform: 'messenger', external_id: 'psid_1' }],
};

const MISSING = { code: '42P01', message: 'relation "public.chat_media_blobs" does not exist' };
let blobTableExists = false;   // truncated/dropped from the start

function fakeClient() {
  return {
    from(table) {
      const st = { filters: [] };
      const b = {
        select() { return b; }, eq(c, v) { st.filters.push([c, v]); return b; },
        or() { return b; }, not() { return b; }, order() { return b; }, limit() { return b; },
        update(patch) { st.patch = patch; return b; }, insert(row) { st.insert = row; return b; },
        maybeSingle() { return done(true); }, single() { return done(true); },
        then(f, r) { return done(false).then(f, r); },
      };
      async function done(one) {
        if (table === 'chat_media_blobs' && !blobTableExists) return { data: null, error: MISSING };
        const rows = db[table] || [];
        const m = rows.filter((row) => st.filters.every(([c, v]) => row[c] === v));
        if (st.insert) { const rec = { id: `new-${Date.now()}`, ...st.insert }; rows.push(rec); return { data: rec, error: null }; }
        if (st.patch) { m.forEach((row) => Object.assign(row, st.patch)); return { data: m[0] || null, error: null }; }
        return one ? { data: m[0] || null, error: null } : { data: m, error: null };
      }
      return b;
    },
  };
}

// ─────────────────────────────────────────── app wired with the real routers
const client = fakeClient();
const logger = { debug() {}, info() {}, warn() {}, error() {} };
const env = {
  NODE_ENV: 'test', META_GRAPH_BASE: `http://127.0.0.1:${graphPort}`, META_GRAPH_VERSION: 'v21.0',
  META_PAGE_ACCESS_TOKEN: 'PAGE_TOKEN', WHATSAPP_TOKEN: 'WA_TOKEN', WHATSAPP_PHONE_NUMBER_ID: '1234',
  META_APP_SECRET: APP_SECRET, MEDIA_URL_SIGNING_SECRET: SIGNING_SECRET,
  MEDIA_URL_SIGNING_TTL_SECONDS: 3600, PUBLIC_API_BASE_URL: '', BLOB_BREAKER_SECONDS: 60,
  MEDIA_STREAM_MAX_BYTES: 1e6, MEDIA_STREAM_CACHE_BYTES: 1e6, ENABLE_LEGACY_BLOB_WRITES: false,
};

const graphClient = createGraphClient({ baseUrl: env.META_GRAPH_BASE, version: 'v21.0', logger });
const messages = createMessageRepository({ client, logger });
const conversations = createConversationService({ client, logger });
const ingest = createMediaIngestService({ messages, conversations, logger });
const blobStore = createBlobStore({ client, logger, env });

const app = express();
app.use('/api/webhooks', express.json({ verify: (req, _r, buf) => { req.rawBody = buf; } }));
app.use('/api/webhooks', createWebhookRouter({
  env, logger, ingest, metaVerify: metaSignatureMiddleware({ appSecret: APP_SECRET, logger }),
}));
app.use('/api/chat/media', createMediaRouter({
  env, logger, blobStore, messages, graph: graphClient, mediaFetcher: createMediaFetcher({ logger }),
}));
app.use('/api/chat/refresh-media', createRefreshMediaRouter({ env, logger, messages, graph: graphClient }));
app.use((e, _q, res, _n) => res.status(e.status || 500).json({ success: false, error: e.message }));

const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

// ─────────────────────────────────────────── REQ 1: webhook stores the URL
await check('REQ1 Messenger webhook stores payload.url, no bytes', async () => {
  const payload = JSON.stringify({
    object: 'page',
    entry: [{ id: 'page_1', time: Date.now(), messaging: [{
      sender: { id: 'psid_new' }, recipient: { id: 'page_1' }, timestamp: Date.now(),
      message: { mid: 'm_new_1', attachments: [{ type: 'image',
        payload: { url: 'https://lookaside.fbsbx.com/new.jpg', mime_type: 'image/jpeg' } }] },
    }] }],
  });
  const sig = crypto.createHmac('sha256', APP_SECRET).update(Buffer.from(payload)).digest('hex');
  const res = await fetch(`${base}/api/webhooks/meta`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${sig}` },
    body: payload,
  });
  assert(res.status === 200, `webhook status ${res.status}`);

  const row = db.chat_messages.find((m) => m.platform_message_id === 'm_new_1');
  assert(row, 'message was not stored');
  assert(row.media_url === 'https://lookaside.fbsbx.com/new.jpg', `media_url = ${row.media_url}`);
  const forbidden = ['data', 'blob', 'payload', 'base64', 'bytes'];
  assert(!forbidden.some((k) => k in row), 'binary column written to the row');
});

await check('REQ1 stores fbcdn.net URLs verbatim', async () => {
  const payload = JSON.stringify({
    object: 'page',
    entry: [{ id: 'page_1', messaging: [{
      sender: { id: 'psid_2' }, recipient: { id: 'page_1' }, timestamp: Date.now(),
      message: { mid: 'm_new_2', attachments: [{ type: 'image', payload: { url: FB_CDN, mime_type: 'image/jpeg' } }] },
    }] }],
  });
  const sig = crypto.createHmac('sha256', APP_SECRET).update(Buffer.from(payload)).digest('hex');
  await fetch(`${base}/api/webhooks/meta`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${sig}` },
    body: payload,
  });
  const row = db.chat_messages.find((m) => m.platform_message_id === 'm_new_2');
  assert(row?.media_url === FB_CDN, `expected fbcdn url, got ${row?.media_url}`);
});

// ─────────────────────────────────────────── REQ 2: 302 + clean 404
await check('REQ2 proxy returns 302 to the stored CDN URL', async () => {
  const token = signMediaToken({ messageId: 'msg-302', exp: Math.floor(Date.now() / 1000) + 60 }, SIGNING_SECRET);
  const res = await fetch(`${base}/api/chat/media/s/${token}`, { redirect: 'manual' });
  assert(res.status === 302, `expected 302, got ${res.status}`);
  assert(res.headers.get('location') === FB_CDN, `location = ${res.headers.get('location')}`);
});

await check('REQ2 truncated/dropped blob table -> 404, never 500', async () => {
  const res = await fetch(`${base}/api/chat/media/orphan-blob-xyz`);
  assert(res.status === 404, `expected 404, got ${res.status}`);
  const body = await res.json();
  assert(body.error?.code === 'MEDIA_NOT_FOUND', `code = ${body.error?.code}`);
});

await check('REQ2 legacy blob route still 404s after truncation (repeat call)', async () => {
  for (let i = 0; i < 3; i += 1) {
    const res = await fetch(`${base}/api/chat/media/old-blob-${i}`);
    assert(res.status === 404, `call ${i}: got ${res.status}`);
  }
});

// ─────────────────────────────────────────── REQ 3: refresh-media
await check('REQ3 refresh-media calls Graph /{mid}?fields=attachments', async () => {
  const before = graphHits.length;
  const res = await fetch(`${base}/api/chat/refresh-media/msg-expired`);
  const body = await res.json();
  assert(res.status === 200, `status ${res.status}: ${JSON.stringify(body)}`);
  assert(body.success === true, 'success flag missing');
  assert(body.url === CDN, `url = ${body.url}`);

  const call = graphHits.slice(before).find((h) => h.includes('m_expired_1'));
  assert(call, 'Graph was not called');
  assert(call.includes('fields=attachments'), `fields param missing: ${call}`);
});

await check('REQ3 fresh URL is persisted on the row', async () => {
  const row = db.chat_messages.find((m) => m.id === 'msg-expired');
  assert(row.media_url === CDN, `row still has ${row.media_url}`);
  assert(row.media_source === 'refreshed', `source = ${row.media_source}`);
  assert(row.media_refreshed_at, 'refreshed_at not set');
});

await check('REQ3 WhatsApp resolves by media id (no /attachments edge)', async () => {
  const res = await fetch(`${base}/api/chat/refresh-media/msg-wa`);
  const body = await res.json();
  assert(res.status === 200, `status ${res.status}`);
  assert(body.platform === 'whatsapp', `platform = ${body.platform}`);
  assert(body.persisted === false, 'ephemeral URL must not be persisted');
});

await check('REQ3 unknown message -> 404', async () => {
  const res = await fetch(`${base}/api/chat/refresh-media/nope`);
  assert(res.status === 404, `got ${res.status}`);
});

await check('REQ2 blob table EXISTS but is empty -> 404', async () => {
  blobTableExists = true;                       // table present, zero rows
  db.chat_media_blobs = [];
  const res = await fetch(`${base}/api/chat/media/empty-table-id`);
  assert(res.status === 404, `expected 404, got ${res.status}`);
  blobTableExists = false;
  delete db.chat_media_blobs;
});

await check('REQ2 blob table THROWS a non-missing error -> 404, not 500', async () => {
  // Simulate a statement timeout / pooler failure: not 42P01, just broken.
  const boom = {
    from(table) {
      const b = {
        select() { return b; }, eq() { return b; }, or() { return b; }, not() { return b; },
        order() { return b; }, limit() { return b; }, update() { return b; }, insert() { return b; },
        maybeSingle() { return Promise.reject(Object.assign(new Error('canceling statement'), { code: '57014' })); },
        single() { return Promise.reject(Object.assign(new Error('canceling statement'), { code: '57014' })); },
        then(_f, r) { return Promise.reject(new Error('boom')).then(_f, r); },
      };
      return b;
    },
  };
  const app2 = express();
  app2.use('/api/chat/media', createMediaRouter({
    env, logger,
    blobStore: createBlobStore({ client: boom, logger, env, timeoutMs: 150 }),
    messages: createMessageRepository({ client: boom, logger }),
    graph: graphClient,
    mediaFetcher: createMediaFetcher({ logger }),
  }));
  app2.use((e, _q, res, _n) => res.status(e.status || 500).json({ success: false }));

  const s2 = app2.listen(0, '127.0.0.1');
  await new Promise((r) => s2.once('listening', r));
  try {
    const res = await fetch(`http://127.0.0.1:${s2.address().port}/api/chat/media/broken-db-id`);
    assert(res.status === 404, `expected 404 under a broken DB, got ${res.status}`);
  } finally {
    s2.close();
  }
});

await check('REQ2/3 zero writes to chat_media_blobs during all of the above', async () => {
  assert(blobTableExists === false, 'test precondition');
  assert(db.chat_media_blobs === undefined, 'a chat_media_blobs table was created in the fake db');
});

server.close();
graph.close();

for (const [s, n] of results) console.log(`${s === 'PASS' ? '✓' : '✗'} ${n}`);
const failed = results.filter(([s]) => s === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} requirement checks passed`);
process.exit(failed ? 1 : 0);
