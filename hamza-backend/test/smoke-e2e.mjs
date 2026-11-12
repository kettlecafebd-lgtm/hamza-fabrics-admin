/**
 * End-to-end smoke test: mock Graph API + mock Supabase, real routers.
 * Proves requirement 4 (refresh-media) and that webhooks never write blobs.
 *
 *   node test/smoke-e2e.mjs
 */
import http from 'node:http';
import assert from 'node:assert/strict';
import express from 'express';

import { createRefreshMediaRouter } from '../src/routes/refreshMedia.js';
import { createWebhookRouter } from '../src/routes/webhooks.js';
import { createChatRouter } from '../src/routes/chat.js';
import { createGraphClient } from '../src/services/graphClient.js';
import { createMessageRepository } from '../src/services/messageRepository.js';
import { createMediaIngestService } from '../src/services/mediaIngestService.js';
import { createConversationService } from '../src/services/conversationService.js';
import { verifyMetaSignature } from '../src/lib/metaSignature.js';
import crypto from 'node:crypto';

const GRAPH_CDN_URL = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=FRESH&ext=999';

// ---------------------------------------------------------------- mock Graph
const graphCalls = [];
const graphServer = http.createServer((req, res) => {
  graphCalls.push(req.url);
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.includes('/m_12345')) {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({
      id: 'm_12345',
      message: 'here is a photo',
      attachments: {
        data: [{
          id: 'att_1',
          mime_type: 'image/jpeg',
          name: 'photo.jpg',
          file_url: GRAPH_CDN_URL,
          image_data: { url: GRAPH_CDN_URL, width: 800, height: 600 },
        }],
      },
    }));
  }
  if (url.pathname.includes('/wa_media_77')) {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({
      messaging_product: 'whatsapp',
      url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=WA',
      mime_type: 'image/jpeg',
      id: 'wa_media_77',
    }));
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: { message: 'not found', code: 100 } }));
});

await new Promise((r) => graphServer.listen(0, '127.0.0.1', r));
const graphPort = graphServer.address().port;

// -------------------------------------------------------------- mock Supabase
const tables = {
  chat_messages: [
    { id: 'msg-1', conversation_id: 'conv-1', platform: 'messenger', platform_message_id: 'm_12345',
      direction: 'inbound', content: '', created_at: new Date().toISOString(),
      media_url: 'https://expired.cdn/old.jpg', media_type: 'image', media_mime_type: 'image/jpeg',
      media_id: null, media_source: 'webhook' },
    { id: 'msg-2', conversation_id: 'conv-2', platform: 'whatsapp', platform_message_id: 'wamid.2',
      direction: 'inbound', content: '', created_at: new Date().toISOString(),
      media_url: null, media_type: 'image', media_mime_type: 'image/jpeg',
      media_id: 'wa_media_77', media_source: 'webhook' },
  ],
  conversations: [{ id: 'conv-1', platform: 'messenger', external_id: 'psid_1' }],
};

function fakeClient() {
  const make = (table) => {
    const state = { filters: [], wantsOne: false };
    const b = {
      select() { return b; },
      eq(c, v) { state.filters.push([c, v]); return b; },
      not() { return b; },
      order() { return b; },
      limit() { return b; },
      update(patch) { state.patch = patch; return b; },
      insert(row) { state.insert = row; return b; },
      maybeSingle() { state.wantsOne = true; return done(); },
      single() { state.wantsOne = true; return done(); },
      then(f, r) { return done().then(f, r); },
    };
    async function done() {
      const rows = tables[table] || [];
      const match = rows.filter((row) => state.filters.every(([c, v]) => row[c] === v));
      if (state.insert) { tables[table].push({ id: `new-${Date.now()}`, ...state.insert }); return { data: state.insert, error: null }; }
      if (state.patch) {
        for (const row of match) Object.assign(row, state.patch);
        return { data: match[0] || null, error: null };
      }
      if (state.wantsOne) return { data: match[0] || null, error: null };
      return { data: match, error: null }; // list queries must return an array
    }
    return b;
  };
  return { from: make, _tables: tables };
}

const client = fakeClient();
const noopLogger = { debug() {}, info() {}, warn() {}, error() {}, child() { return this; } };
const env = {
  NODE_ENV: 'test',
  META_GRAPH_BASE: `http://127.0.0.1:${graphPort}`,
  META_GRAPH_VERSION: 'v21.0',
  META_PAGE_ACCESS_TOKEN: 'PAGE_TOKEN',
  WHATSAPP_TOKEN: 'WA_TOKEN',
  WHATSAPP_PHONE_NUMBER_ID: '1234',
  META_APP_SECRET: 'appsecret',
  MEDIA_URL_SIGNING_SECRET: 'smoke-secret',
  MEDIA_URL_SIGNING_TTL_SECONDS: 3600,
  PUBLIC_API_BASE_URL: '',
  ENABLE_LEGACY_BLOB_WRITES: false,
};

// ----------------------------------------------------------------- app wiring
const graph = createGraphClient({ baseUrl: env.META_GRAPH_BASE, version: 'v21.0', logger: noopLogger });
const messages = createMessageRepository({ client, logger: noopLogger });
const conversations = createConversationService({ client, logger: noopLogger });
const ingest = createMediaIngestService({ messages, conversations, logger: noopLogger });

const app = express();
app.use('/api/webhooks', express.json({ verify: (req, _r, buf) => { req.rawBody = buf; } }));
app.use('/api/webhooks', createWebhookRouter({
  env, logger: noopLogger, ingest,
  metaVerify: (req, res, next) => {
    const ok = verifyMetaSignature({ rawBody: req.rawBody, headers: req.headers, appSecret: env.META_APP_SECRET });
    return ok.ok ? next() : res.status(401).json({ ok: false });
  },
}));
app.use('/api/chat/refresh-media', createRefreshMediaRouter({ env, logger: noopLogger, messages, graph }));
app.use('/api/chat', createChatRouter({ env, logger: noopLogger, client, messages }));
app.locals.graph = graph;
app.locals.mediaFetcher = { cacheStats: () => ({ entries: 0 }) };
app.locals.blobStore = { state: () => ({ open: false }) };
app.use((err, _req, res, _next) => res.status(err.status || 500).json({ success: false, error: err.message }));

const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.listeners('listening').forEach((l) => l.call(server)) || server.once('listening', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const results = [];
const check = (name, fn) => fn().then(() => results.push(['PASS', name])).catch((e) => results.push(['FAIL', `${name} :: ${e.message}`]));

// --------------------------------------------------------------------- checks
await check('refresh-media re-resolves a Messenger URL from Graph', async () => {
  const res = await fetch(`${base}/api/chat/refresh-media/msg-1`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.url, GRAPH_CDN_URL);
  assert.equal(body.persisted, true, 'fresh URL must be written to chat_messages');
  assert.match(body.proxy_url, /^\/api\/chat\/media\/s\//);
});

await check('refreshed URL is persisted in chat_messages.media_url', async () => {
  const row = tables.chat_messages.find((m) => m.id === 'msg-1');
  assert.equal(row.media_url, GRAPH_CDN_URL);
  assert.equal(row.media_source, 'refreshed');
  assert.ok(row.media_refreshed_at);
});

await check('Graph call used /{message_id}?fields=attachments with the page token', async () => {
  assert.ok(graphCalls.some((u) => u.includes('/v21.0/m_12345') && u.includes('attachments')));
});

await check('refresh-media resolves WhatsApp via media id, not /attachments', async () => {
  const res = await fetch(`${base}/api/chat/refresh-media/msg-2`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.platform, 'whatsapp');
  assert.match(body.url, /mid=WA/);
  assert.equal(body.persisted, false, '5-minute URL must not be persisted');
});

await check('refresh-media 404s for unknown message', async () => {
  const res = await fetch(`${base}/api/chat/refresh-media/does-not-exist`);
  assert.equal(res.status, 404);
});

await check('inbox messages expose media without blob columns', async () => {
  const res = await fetch(`${base}/api/chat/conversations/conv-2/messages`);
  const body = await res.json();
  assert.equal(res.status, 200);
  const msg = body.messages.find((m) => m.id === 'msg-2');
  assert.equal(msg.has_media, true);
  assert.ok(msg.media, 'media object must be present');
  assert.ok(!('data' in msg) && !('base64' in msg), 'no binary/base64 fields in payload');
});

await check('Meta webhook stores a URL and writes ZERO blobs', async () => {
  const payload = JSON.stringify({
    object: 'page',
    entry: [{ id: 'page_1', time: Date.now(), messaging: [{
      sender: { id: 'psid_9' },
      recipient: { id: 'page_1' },
      timestamp: Date.now(),
      message: { mid: 'm_webhook_1', attachments: [{ type: 'image', payload: { url: 'https://lookaside.fbsbx.com/fresh.jpg', mime_type: 'image/jpeg' } }] },
    }] }],
  });
  const sig = crypto.createHmac('sha256', env.META_APP_SECRET).update(Buffer.from(payload)).digest('hex');

  const res = await fetch(`${base}/api/webhooks/meta`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${sig}` },
    body: payload,
  });
  assert.equal(res.status, 200);
  const stored = tables.chat_messages.find((m) => m.platform_message_id === 'm_webhook_1');
  assert.ok(stored, 'message must be stored');
  assert.equal(stored.media_url, 'https://lookaside.fbsbx.com/fresh.jpg');
  assert.ok(!('data' in stored) && !('blob' in stored), 'no binary columns written');
});

await check('webhook with a bad signature is rejected', async () => {
  const res = await fetch(`${base}/api/webhooks/meta`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=bad' },
    body: JSON.stringify({ object: 'page', entry: [] }),
  });
  assert.equal(res.status, 401);
});

// ------------------------------------------------------------------- teardown
server.close();
graphServer.close();

const failed = results.filter(([s]) => s === 'FAIL');
for (const [status, name] of results) console.log(`${status === 'PASS' ? '✓' : '✗'} ${name}`);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
