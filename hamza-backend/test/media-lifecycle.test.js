/**
 * Tests for the media life-cycle routes (the half `src/lib/mediaClient.js` was
 * written against two audits ago and no backend implemented).
 *
 *   POST /api/media/delete
 *   POST /api/media/cache-control
 *
 * These run the real Express router against a fake Supabase, so they cover
 * parsing, the reference guard, fail-closed behaviour, request bounds and the
 * storage calls — not Supabase itself.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createMediaLifecycleRouter } from '../src/routes/media.js';
import {
  createMediaStorage,
  parseStorageObject,
  toStorageKey,
  resolveCacheControlSeconds,
  parseBucketList,
} from '../src/services/mediaStorage.js';

const SUPABASE_URL = 'https://demo.supabase.co';
const PUBLIC_BASE = `${SUPABASE_URL}/storage/v1/object/public`;
const RENDER_BASE = `${SUPABASE_URL}/storage/v1/render/image/public`;

const logger = { debug() {}, info() {}, warn() {}, error() {} };

const BASE_ENV = {
  SUPABASE_URL,
  MEDIA_DELETE_ENABLED: true,
  MEDIA_DELETE_BUCKETS: 'media,products',
  MEDIA_DELETE_MAX_URLS: 50,
  MEDIA_CACHE_CONTROL_MAX_URLS: 10,
  MEDIA_CACHE_CONTROL_MAX_BYTES: 1024,
  MEDIA_UPLOAD_CACHE_CONTROL_SECONDS: 31_536_000,
  MEDIA_REFERENCES_VIEW: 'media_references',
};

function fakeClient({ references = [], missingView = false, viewError = null, storageError = null, objects = {} } = {}) {
  const calls = { removed: [], uploaded: [], queries: [] };

  const client = {
    from(view) {
      const builder = {
        select() { return builder; },
        in(column, keys) {
          calls.queries.push({ view, column, keys });
          if (missingView) {
            return Promise.resolve({
              data: null,
              error: { code: '42P01', message: 'relation "media_references" does not exist' },
            });
          }
          if (viewError) return Promise.resolve({ data: null, error: viewError });
          const found = references
            .filter((key) => keys.includes(key))
            .map((key) => ({ storage_key: key }));
          return Promise.resolve({ data: found, error: null });
        },
      };
      return builder;
    },
    storage: {
      from(bucket) {
        return {
          async remove(keys) {
            calls.removed.push({ bucket, keys });
            if (storageError) return { data: null, error: storageError };
            return { data: keys.map((name) => ({ name })), error: null };
          },
          async download(key) {
            const object = objects[key];
            if (!object) return { data: null, error: { message: 'Object not found' } };
            return { data: new Blob([object.body], { type: object.type || 'image/webp' }), error: null };
          },
          async upload(key, body, options) {
            calls.uploaded.push({ bucket, key, options, size: body.size });
            return { data: { path: key }, error: null };
          },
        };
      },
    },
  };

  return { client, calls };
}

function buildApp({ env = BASE_ENV, client } = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api/media', createMediaLifecycleRouter({
    env,
    logger,
    storage: createMediaStorage({ client, env, logger }),
  }));
  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ success: false, error: { code: error.code, message: error.message } });
  });
  return app;
}

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

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        json: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'),
      }));
    });
    req.on('error', reject);
    req.end(payload);
  });
}

const productUrl = (key, bucket = 'products') => `${PUBLIC_BASE}/${bucket}/${key}`;

// ── URL parsing ───────────────────────────────────────────────────────────────

test('parses public, render and signed object URLs into bucket + key', () => {
  const expected = { ok: true, bucket: 'products', key: 'shirt-abc.webp', storageKey: 'products/shirt-abc.webp' };

  assert.deepEqual(parseStorageObject(productUrl('shirt-abc.webp'), { supabaseUrl: SUPABASE_URL }), expected);
  assert.deepEqual(
    parseStorageObject(`${RENDER_BASE}/products/shirt-abc.webp?width=96&quality=70`, { supabaseUrl: SUPABASE_URL }),
    expected,
  );
  assert.deepEqual(
    parseStorageObject(`${SUPABASE_URL}/storage/v1/object/sign/products/shirt-abc.webp?token=x`, { supabaseUrl: SUPABASE_URL }),
    expected,
  );
});

test('refuses anything it cannot prove is ours', () => {
  const parse = (url) => parseStorageObject(url, { supabaseUrl: SUPABASE_URL }).reason;

  assert.equal(parse('https://evil.example.com/storage/v1/object/public/products/a.webp'), 'foreign-host');
  assert.equal(parse('/uploads/hero.jpg'), 'legacy-disk');
  assert.equal(parse('data:image/png;base64,AAAA'), 'inline-payload');
  assert.equal(parse('products/a.webp'), 'not-absolute');
  assert.equal(parseStorageObject(`${PUBLIC_BASE}/products/%2E%2E/%2E%2E/etc/passwd`, { supabaseUrl: SUPABASE_URL }).ok, false);
  assert.equal(parseStorageObject(`${PUBLIC_BASE}/products/../../etc/passwd`, { supabaseUrl: SUPABASE_URL }).ok, false);
  assert.equal(parseStorageObject(productUrl('a.webp')).reason, 'storage-not-configured');
});

test('storage keys match the frontend normaliser (query and transform ignored)', () => {
  assert.equal(
    toStorageKey(`${RENDER_BASE}/products/a.webp?width=96&quality=70`),
    'products/a.webp',
  );
  assert.equal(toStorageKey('/uploads/hero.jpg?x=1'), 'uploads/hero.jpg');
  assert.equal(toStorageKey('data:image/png;base64,AAAA'), null);
  assert.deepEqual(parseBucketList(''), ['media', 'products']);
  assert.equal(resolveCacheControlSeconds('public, max-age=86400, immutable'), '86400');
  assert.equal(resolveCacheControlSeconds('999999999'), '31536000');
});

// ── wiring ───────────────────────────────────────────────────────────────────

test('the app mounts /api/media behind admin auth (never an <img>-reachable delete)', async () => {
  const { createApp } = await import('../src/app.js');
  const env = {
    NODE_ENV: 'test',
    // Unroutable address: auth fails fast instead of reaching a real project.
    SUPABASE_URL: 'http://127.0.0.1:9',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    MEDIA_URL_SIGNING_SECRET: 'test-secret',
    META_GRAPH_VERSION: 'v21.0',
    META_GRAPH_BASE: 'https://graph.facebook.com',
    META_APP_SECRET: 'appsecret',
    META_VERIFY_TOKEN: 'verify',
    META_PAGE_ACCESS_TOKEN: '',
    WHATSAPP_TOKEN: '',
    WHATSAPP_PHONE_NUMBER_ID: '',
    MEDIA_URL_SIGNING_TTL_SECONDS: 3600,
    BLOB_BREAKER_SECONDS: 60,
    MEDIA_STREAM_MAX_BYTES: 1024,
    MEDIA_STREAM_CACHE_BYTES: 4096,
    ENABLE_LEGACY_BLOB_WRITES: false,
    MEDIA_DELETE_ENABLED: true,
    MEDIA_DELETE_BUCKETS: 'media,products',
    MEDIA_REFERENCES_VIEW: 'media_references',
  };
  const { app } = createApp({ env, logger });

  await withServer(app, async (base) => {
    const anonymous = await postJson(`${base}/api/media/delete`, { urls: [productUrl('a.webp')] });
    assert.equal(anonymous.status, 401);
  });
});

// ── delete ───────────────────────────────────────────────────────────────────

test('deletes an unreferenced object and skips a referenced one', async () => {
  const url = productUrl('new.webp');
  const shared = productUrl('shared.webp');
  const { client, calls } = fakeClient({ references: ['products/shared.webp'] });
  const app = buildApp({ client });

  await withServer(app, async (base) => {
    const res = await postJson(`${base}/api/media/delete`, { urls: [url, shared, url] });

    assert.equal(res.status, 200);
    assert.deepEqual(res.json.deleted, [url]);
    assert.deepEqual(res.json.skipped, [shared]);
    assert.equal(res.json.reasons[shared], 'referenced');
    assert.deepEqual(calls.removed, [{ bucket: 'products', keys: ['new.webp'] }]);
    // One batched reference query for the whole request, not one per URL.
    assert.equal(calls.queries.length, 1);
    assert.deepEqual(calls.queries[0].keys, ['products/new.webp', 'products/shared.webp']);
  });
});

test('an encoded key in the view still protects its decoded spelling', async () => {
  // The SQL view keeps whatever spelling the column holds; the frontend decodes.
  const url = productUrl('blue shirt.webp');
  const { client, calls } = fakeClient({ references: ['products/blue%20shirt.webp'] });
  const app = buildApp({ client });

  await withServer(app, async (base) => {
    const res = await postJson(`${base}/api/media/delete`, { urls: [url] });

    assert.deepEqual(res.json.deleted, []);
    assert.equal(res.json.reasons[url], 'referenced');
    assert.deepEqual(calls.removed, []);
  });
});

test('fails closed when the reference view is missing', async () => {
  const urls = [productUrl('a.webp'), productUrl('b.webp')];
  const { client, calls } = fakeClient({ missingView: true });
  const app = buildApp({ client });

  await withServer(app, async (base) => {
    const res = await postJson(`${base}/api/media/delete`, { urls });

    assert.equal(res.status, 200);
    assert.deepEqual(res.json.deleted, []);
    assert.deepEqual(res.json.skipped, urls);
    assert.equal(res.json.reasons[urls[0]], 'references-unavailable');
    assert.deepEqual(calls.removed, [], 'nothing may be removed without a reference check');
  });
});

test('stays inert until MEDIA_DELETE_ENABLED=true', async () => {
  const url = productUrl('a.webp');
  const { client, calls } = fakeClient();
  const app = buildApp({ client, env: { ...BASE_ENV, MEDIA_DELETE_ENABLED: false } });

  await withServer(app, async (base) => {
    const res = await postJson(`${base}/api/media/delete`, { urls: [url] });

    assert.equal(res.status, 200);
    assert.equal(res.json.disabled, true);
    assert.deepEqual(res.json.deleted, []);
    assert.equal(res.json.reasons[url], 'disabled');
    assert.equal(calls.queries.length, 0);
    assert.deepEqual(calls.removed, []);
  });
});

test('legacy /uploads paths and foreign hosts are skipped without a storage call', async () => {
  const urls = ['/uploads/hero.jpg', 'https://cdn.example.com/storage/v1/object/public/products/a.webp'];
  const { client, calls } = fakeClient();
  const app = buildApp({ client });

  await withServer(app, async (base) => {
    const res = await postJson(`${base}/api/media/delete`, { urls });

    assert.deepEqual(res.json.deleted, []);
    assert.deepEqual(res.json.skipped, urls);
    assert.equal(res.json.reasons[urls[0]], 'legacy-disk');
    assert.equal(res.json.reasons[urls[1]], 'foreign-host');
    assert.deepEqual(calls.queries, []);
    assert.deepEqual(calls.removed, []);
  });
});

test('a repeated delete is success (object already gone)', async () => {
  const url = productUrl('gone.webp');
  const { client } = fakeClient({ storageError: { message: 'Object not found', statusCode: '404' } });
  const app = buildApp({ client });

  await withServer(app, async (base) => {
    const res = await postJson(`${base}/api/media/delete`, { urls: [url] });
    assert.deepEqual(res.json.deleted, [url]);
    assert.deepEqual(res.json.skipped, []);
  });
});

test('rejects malformed bodies and unbounded batches with 400', async () => {
  const { client } = fakeClient();
  const app = buildApp({ client });

  await withServer(app, async (base) => {
    assert.equal((await postJson(`${base}/api/media/delete`, { urls: 'nope' })).status, 400);
    assert.equal((await postJson(`${base}/api/media/delete`, {})).status, 400);

    const tooMany = Array.from({ length: 51 }, (_, i) => productUrl(`p${i}.webp`));
    const res = await postJson(`${base}/api/media/delete`, { urls: tooMany });
    assert.equal(res.status, 400);
    assert.match(res.json.error.message, /At most 50/);
  });
});

// ── cache-control backfill ──────────────────────────────────────────────────

test('re-uploads an object with the configured Cache-Control', async () => {
  const key = 'hero.webp';
  const url = productUrl(key, 'media');
  const { client, calls } = fakeClient({ objects: { [key]: { body: new Uint8Array(64), type: 'image/webp' } } });
  const app = buildApp({ client });

  await withServer(app, async (base) => {
    const res = await postJson(`${base}/api/media/cache-control`, { urls: [url] });

    assert.equal(res.status, 200);
    assert.deepEqual(res.json.updated, [url]);
    assert.equal(res.json.cacheControl, 'max-age=31536000');
    assert.equal(calls.uploaded.length, 1);
    assert.equal(calls.uploaded[0].bucket, 'media');
    assert.equal(calls.uploaded[0].key, key);
    assert.deepEqual(calls.uploaded[0].options, {
      upsert: true,
      contentType: 'image/webp',
      cacheControl: '31536000',
    });
  });
});

test('cache-control skips oversized objects and non-storage URLs', async () => {
  const hero = 'hero.webp';
  const huge = 'huge.webp';
  const { client, calls } = fakeClient({
    objects: {
      [hero]: { body: new Uint8Array(64), type: 'image/webp' },
      [huge]: { body: new Uint8Array(4096), type: 'image/webp' },
    },
  });
  const app = buildApp({ client });

  await withServer(app, async (base) => {
    const res = await postJson(`${base}/api/media/cache-control`, {
      urls: [productUrl(hero, 'media'), productUrl(huge, 'media'), '/uploads/legacy.jpg'],
    });

    assert.deepEqual(res.json.updated, [productUrl(hero, 'media')]);
    assert.equal(res.json.reasons[productUrl(huge, 'media')], 'too-large');
    assert.equal(res.json.reasons['/uploads/legacy.jpg'], 'legacy-disk');
    assert.equal(calls.uploaded.length, 1);
  });
});
