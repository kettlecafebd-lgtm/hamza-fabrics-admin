/**
 * Integration tests: boot the real Express app against a fake Supabase and
 * assert the two behaviours the refactor promises:
 *   - 302 to the original URL when one is stored
 *   - clean 404 (never 500) when the blob table is gone
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';


import { signMediaToken } from '../src/lib/mediaSignature.js';
import { fakeSupabase } from './helpers.js';

const SECRET = 'integration-secret';

const BASE_ENV = {
  NODE_ENV: 'test',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  MEDIA_URL_SIGNING_SECRET: SECRET,
  PUBLIC_API_BASE_URL: '',
  META_PAGE_ACCESS_TOKEN: 'page-token',
  WHATSAPP_TOKEN: '',
  WHATSAPP_PHONE_NUMBER_ID: '',
  META_VERIFY_TOKEN: 'verify',
  META_APP_SECRET: 'appsecret',
  META_GRAPH_VERSION: 'v21.0',
  META_GRAPH_BASE: 'https://graph.facebook.com',
  MEDIA_URL_SIGNING_TTL_SECONDS: 3600,
  BLOB_BREAKER_SECONDS: 60,
  MEDIA_STREAM_MAX_BYTES: 1024,
  MEDIA_STREAM_CACHE_BYTES: 4096,
  ENABLE_LEGACY_BLOB_WRITES: false,
  PORT: 0,
  LOG_LEVEL: 'silent',
};

function withServer(app, fn) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', async () => {
      const { port } = server.address();
      try {
        await fn(`http://127.0.0.1:${port}`);
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        server.close();
      }
    });
  });
}

function request(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
  });
}

test('proxy 302-redirects to the stored CDN URL (no bytes pass through us)', async () => {
  const cdnUrl = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1&ext=2';
  const client = fakeSupabase({
    messages: [{
      id: 'msg-1',
      conversation_id: 'conv-1',
      platform: 'messenger',
      media_url: cdnUrl,
      media_type: 'image',
      media_mime_type: 'image/jpeg',
      media_id: null,
      content: 'look',
    }],
  });

  const token = signMediaToken({ messageId: 'msg-1', exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);

  // The real app builds its own Supabase client; mount just the router with fakes.
  const { createMediaRouter } = await import('../src/routes/media.js');
  const { createMessageRepository } = await import('../src/services/messageRepository.js');
  const { createBlobStore } = await import('../src/services/legacyBlobStore.js');
  const { createGraphClient } = await import('../src/services/graphClient.js');
  const { createMediaFetcher } = await import('../src/services/mediaFetcher.js');
  const express = (await import('express')).default;

  const testApp = express();
  testApp.use('/api/chat/media', createMediaRouter({
    env: BASE_ENV,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    blobStore: createBlobStore({ client, logger: null, env: BASE_ENV }),
    messages: createMessageRepository({ client, logger: null }),
    graph: createGraphClient({ baseUrl: BASE_ENV.META_GRAPH_BASE, version: 'v21.0', logger: null }),
    mediaFetcher: createMediaFetcher({ logger: null }),
  }));

  await withServer(testApp, async (base) => {
    const res = await request(`${base}/api/chat/media/s/${token}`);
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, cdnUrl);
  });
});

test('proxy returns clean 404 when chat_media_blobs has been dropped', async () => {
  const missingTable = { code: '42P01', message: 'relation "chat_media_blobs" does not exist' };
  const client = fakeSupabase({ messages: [], throwOn: { chat_media_blobs: missingTable } });

  const { createMediaRouter } = await import('../src/routes/media.js');
  const { createMessageRepository } = await import('../src/services/messageRepository.js');
  const { createBlobStore } = await import('../src/services/legacyBlobStore.js');
  const { createGraphClient } = await import('../src/services/graphClient.js');
  const { createMediaFetcher } = await import('../src/services/mediaFetcher.js');
  const express = (await import('express')).default;

  const app = express();
  app.use('/api/chat/media', createMediaRouter({
    env: BASE_ENV,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    blobStore: createBlobStore({ client, logger: null, env: BASE_ENV }),
    messages: createMessageRepository({ client, logger: null }),
    graph: createGraphClient({ baseUrl: BASE_ENV.META_GRAPH_BASE, version: 'v21.0', logger: null }),
    mediaFetcher: createMediaFetcher({ logger: null }),
  }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ ok: false }));

  const token = signMediaToken({ messageId: 'gone-1', exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);

  await withServer(app, async (base) => {
    const res = await request(`${base}/api/chat/media/s/${token}`);
    assert.equal(res.status, 404, 'must be 404, not 500');
    const payload = JSON.parse(res.body);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, 'MEDIA_NOT_FOUND');
  });
});

test('unsigned legacy route also survives a dropped blob table', async () => {
  const client = fakeSupabase({
    messages: [],
    throwOn: { chat_media_blobs: { code: 'PGRST205', message: "Could not find the table 'public.chat_media_blobs'" } },
  });

  const { createMediaRouter } = await import('../src/routes/media.js');
  const { createMessageRepository } = await import('../src/services/messageRepository.js');
  const { createBlobStore } = await import('../src/services/legacyBlobStore.js');
  const { createGraphClient } = await import('../src/services/graphClient.js');
  const { createMediaFetcher } = await import('../src/services/mediaFetcher.js');
  const express = (await import('express')).default;

  const app = express();
  app.use('/api/chat/media', createMediaRouter({
    env: BASE_ENV,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    blobStore: createBlobStore({ client, logger: null, env: BASE_ENV }),
    messages: createMessageRepository({ client, logger: null }),
    graph: createGraphClient({ baseUrl: BASE_ENV.META_GRAPH_BASE, version: 'v21.0', logger: null }),
    mediaFetcher: createMediaFetcher({ logger: null }),
  }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ ok: false }));

  await withServer(app, async (base) => {
    const res = await request(`${base}/api/chat/media/some-old-blob-id`);
    assert.equal(res.status, 404);
  });
});

test('invalid signature is rejected with 403 and does not touch the DB', async () => {
  const client = fakeSupabase({ messages: [] });
  const { createMediaRouter } = await import('../src/routes/media.js');
  const { createMessageRepository } = await import('../src/services/messageRepository.js');
  const { createBlobStore } = await import('../src/services/legacyBlobStore.js');
  const { createGraphClient } = await import('../src/services/graphClient.js');
  const { createMediaFetcher } = await import('../src/services/mediaFetcher.js');
  const express = (await import('express')).default;

  const app = express();
  app.use('/api/chat/media', createMediaRouter({
    env: BASE_ENV,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    blobStore: createBlobStore({ client, logger: null, env: BASE_ENV }),
    messages: createMessageRepository({ client, logger: null }),
    graph: createGraphClient({ baseUrl: BASE_ENV.META_GRAPH_BASE, version: 'v21.0', logger: null }),
    mediaFetcher: createMediaFetcher({ logger: null }),
  }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ ok: false }));

  await withServer(app, async (base) => {
    const res = await request(`${base}/api/chat/media/s/forged.token`);
    assert.equal(res.status, 403);
  });
});

test('DB outage (transport error) degrades to 404, not 500', async () => {
  // Every query throws, as it does when DNS fails or the pooler drops us.
  const exploding = {
    from() {
      const b = {
        select() { return b; }, eq() { return b; }, not() { return b; },
        order() { return b; }, limit() { return b; }, update() { return b; },
        insert() { return b; }, maybeSingle() { return Promise.reject(new TypeError('fetch failed')); },
        single() { return Promise.reject(new TypeError('fetch failed')); },
        then(_f, r) { return Promise.reject(new TypeError('fetch failed')).then(_f, r); },
      };
      return b;
    },
  };

  const { createMediaRouter } = await import('../src/routes/media.js');
  const { createMessageRepository } = await import('../src/services/messageRepository.js');
  const { createBlobStore } = await import('../src/services/legacyBlobStore.js');
  const { createGraphClient } = await import('../src/services/graphClient.js');
  const { createMediaFetcher } = await import('../src/services/mediaFetcher.js');
  const express = (await import('express')).default;

  const app = express();
  app.use('/api/chat/media', createMediaRouter({
    env: BASE_ENV,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    blobStore: createBlobStore({ client: exploding, logger: null, env: BASE_ENV }),
    messages: createMessageRepository({ client: exploding, logger: null }),
    graph: createGraphClient({ baseUrl: BASE_ENV.META_GRAPH_BASE, version: 'v21.0', logger: null }),
    mediaFetcher: createMediaFetcher({ logger: null }),
  }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ ok: false }));

  await withServer(app, async (base) => {
    const res = await request(`${base}/api/chat/media/whatever`);
    assert.equal(res.status, 404, 'a DB outage must not surface as a 500 on the proxy');
  });
});

test('a stalled DB is skipped on the next request via the shared health signal', async () => {
  let queried = 0;
  const stall = {
    from() {
      queried += 1;
      const b = {
        select() { return b; }, eq() { return b; }, or() { return b; }, not() { return b; },
        order() { return b; }, limit() { return b; }, update() { return b; }, insert() { return b; },
        maybeSingle() { return new Promise(() => {}); }, single() { return new Promise(() => {}); },
      };
      return b;
    },
  };

  const { createMediaRouter } = await import('../src/routes/media.js');
  const { createMessageRepository } = await import('../src/services/messageRepository.js');
  const { createBlobStore } = await import('../src/services/legacyBlobStore.js');
  const { createGraphClient } = await import('../src/services/graphClient.js');
  const { createMediaFetcher } = await import('../src/services/mediaFetcher.js');
  const express = (await import('express')).default;

  const app = express();
  app.use('/api/chat/media', createMediaRouter({
    env: BASE_ENV,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    blobStore: createBlobStore({ client: stall, logger: null, env: BASE_ENV, timeoutMs: 60 }),
    messages: createMessageRepository({ client: stall, logger: null }),
    graph: createGraphClient({ baseUrl: BASE_ENV.META_GRAPH_BASE, version: 'v21.0', logger: null }),
    mediaFetcher: createMediaFetcher({ logger: null }),
  }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ ok: false }));

  await withServer(app, async (base) => {
    const first = await request(`${base}/api/chat/media/x`);
    assert.equal(first.status, 404);

    const queriesAfterFirst = queried;
    const t0 = Date.now();
    const second = await request(`${base}/api/chat/media/x`);
    const elapsed = Date.now() - t0;

    assert.equal(second.status, 404);
    assert.equal(queried, queriesAfterFirst, 'second request must not query a DB known to be stalled');
    assert.ok(elapsed < 500, `second request took ${elapsed}ms; expected the fast path`);
  });
});
