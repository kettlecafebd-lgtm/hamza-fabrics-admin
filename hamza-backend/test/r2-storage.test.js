/**
 * R2 migration tests.
 *
 * What must be true after this refactor:
 *   1. No new media is written to Supabase Storage — the R2 driver is chosen as
 *      soon as it is configured, and the Supabase driver refuses to store bytes.
 *   2. A presigned upload hands the browser a URL bound to Content-Type and
 *      `Cache-Control: immutable`, and the file never transits the backend.
 *   3. Cache-Control rewrites are metadata-only (HeadObject + CopyObject): no
 *      object body is ever downloaded, which is what Supabase had to do.
 *   4. Keys cannot escape the bucket, and only allow-listed paths/types are
 *      accepted.
 *   5. Deletes go out in ONE batched request and stay reference-checked.
 *
 * No network: the S3 client is injected, so these assert on the commands the
 * driver would send.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import {
  buildUploadKey,
  normalizeObjectKey,
  parseR2Object,
  storageKeyVariants,
  createR2Storage,
  isR2Configured,
  resolveR2Endpoint,
} from '../src/services/r2Storage.js';
import { createMediaStorage, resolveStorageDriver, createSupabaseStorage } from '../src/services/mediaStorage.js';
import { createMediaLifecycleRouter } from '../src/routes/media.js';
import { createUploadRouter } from '../src/routes/uploads.js';

const logger = { debug() {}, info() {}, warn() {}, error() {} };

const R2_ENV = {
  SUPABASE_URL: 'https://demo.supabase.co',
  R2_BUCKET: 'hamza-media',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_ACCOUNT_ID: 'acct123',
  R2_PUBLIC_BASE_URL: 'https://media.example.com',
  MEDIA_REFERENCES_VIEW: 'media_references',
  MEDIA_DELETE_ENABLED: true,
  MEDIA_DELETE_MAX_URLS: 50,
  MEDIA_CACHE_CONTROL_MAX_URLS: 10,
  MEDIA_CACHE_CONTROL_MAX_BYTES: 1024,
  MEDIA_UPLOAD_CACHE_CONTROL_SECONDS: 31_536_000,
  MEDIA_PRESIGN_TTL_SECONDS: 300,
  MEDIA_UPLOAD_MAX_BYTES: 1024 * 1024,
  MEDIA_DIRECT_UPLOAD_ENABLED: true,
};

/** Records every command the driver sends instead of hitting AWS. */
function fakeS3({ head = { ContentLength: 64, ContentType: 'image/webp' }, failOn = {} } = {}) {
  const calls = [];
  return {
    calls,
    async send(command) {
      const name = command.constructor.name;
      calls.push({ name, input: command.input });
      if (failOn[name]) throw failOn[name];
      if (name === 'HeadObjectCommand') return head;
      if (name === 'DeleteObjectsCommand') {
        return { Deleted: command.input.Delete.Objects, Errors: [] };
      }
      return {};
    },
  };
}

function fakeDb({ references = [] } = {}) {
  return {
    from() {
      const builder = {
        select() { return builder; },
        in(column, keys) {
          const data = references
            .filter((key) => keys.includes(key))
            .map((key) => ({ storage_key: key }));
          return Promise.resolve({ data, error: null });
        },
      };
      return builder;
    },
  };
}

/**
 * Express 4 does not serialise thrown errors by itself. app.js installs a
 * handler after all routes, so `listen()` does the same -- an error handler
 * registered before the routes would never be reached.
 */
function installErrorHandler(app) {
  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({
      success: false,
      error: { code: error.code || `HTTP_${error.status || 500}`, message: error.message },
    });
  });
}

// ── driver selection ─────────────────────────────────────────────────────────

test('R2 is the default driver once it is configured, Supabase is opt-in only', () => {
  assert.equal(resolveStorageDriver(R2_ENV), 'r2');
  // No R2 credentials at all: the legacy driver is the only thing that works.
  assert.equal(resolveStorageDriver({ SUPABASE_URL: 'https://demo.supabase.co' }), 'supabase');
  // Explicit override wins in both directions.
  assert.equal(resolveStorageDriver({ ...R2_ENV, MEDIA_STORAGE_DRIVER: 'supabase' }), 'supabase');
  assert.equal(isR2Configured(R2_ENV), true);
  assert.equal(resolveR2Endpoint(R2_ENV), 'https://acct123.r2.cloudflarestorage.com');
  assert.equal(resolveR2Endpoint({ R2_ENDPOINT: 'https://custom.example.com/' }), 'https://custom.example.com');
});

test('createMediaStorage builds an R2 adapter by default and reports the driver', () => {
  const storage = createMediaStorage({ env: R2_ENV, logger, client: fakeDb() });
  assert.equal(storage.driver, 'r2');
  assert.equal(storage.publicUrl('products/a.webp'), 'https://media.example.com/products/a.webp');
});

test('the Supabase driver can no longer accept new bytes', async () => {
  const legacy = createSupabaseStorage({
    client: { storage: { from: () => ({ remove: async () => ({ error: null }) }) } },
    env: { ...R2_ENV, SUPABASE_URL: 'https://demo.supabase.co' },
    logger,
  });
  assert.equal(legacy.driver, 'supabase');
  assert.deepEqual(await legacy.putObject({ key: 'a', body: Buffer.from('x'), contentType: 'image/webp' }),
    { ok: false, reason: 'driver-not-supported' });
  assert.deepEqual(await legacy.presignUpload({ key: 'a', contentType: 'image/webp' }),
    { ok: false, reason: 'driver-not-supported' });
});

// ── URL parsing ─────────────────────────────────────────────────────────────

test('parses our public base, Cloudflare-transformed URLs and path-style endpoints', () => {
  const expected = { ok: true, bucket: 'hamza-media', key: 'products/a.webp', storageKey: 'hamza-media/products/a.webp' };

  assert.deepEqual(parseR2Object('https://media.example.com/products/a.webp', { env: R2_ENV }), expected);
  // Edge-transformed thumbnails must resolve to the same object, or a delete
  // would look "unreferenced" and remove an image that is in use.
  assert.deepEqual(
    parseR2Object('https://media.example.com/cdn-cgi/image/width=96,quality=70/products/a.webp', { env: R2_ENV }),
    expected,
  );
  assert.deepEqual(
    parseR2Object('https://acct123.r2.cloudflarestorage.com/hamza-media/products/a.webp?X-Amz-Signature=x', { env: R2_ENV }),
    expected,
  );
});

test('refuses foreign hosts, other buckets and inline payloads', () => {
  const reason = (url) => parseR2Object(url, { env: R2_ENV }).reason;

  assert.equal(reason('https://evil.example.com/products/a.webp'), 'foreign-host');
  assert.equal(reason('https://acct123.r2.cloudflarestorage.com/other-bucket/a.webp'), 'foreign-bucket');
  assert.equal(reason('data:image/png;base64,AAAA'), 'inline-payload');
  assert.equal(reason('/products/a.webp'), 'not-absolute');
  assert.equal(parseR2Object('https://media.example.com/products/a.webp', { env: {} }).reason,
    'storage-not-configured');
});

test('a legacy Supabase URL is not treated as an R2 object', () => {
  // Important during the drain: the R2 driver must not try to delete from a
  // bucket it does not own, and the reason must be machine-readable.
  const result = parseR2Object(
    'https://demo.supabase.co/storage/v1/object/public/products/a.webp',
    { env: R2_ENV },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'foreign-host');
});

// ── key safety ──────────────────────────────────────────────────────────────

test('keys cannot escape the bucket or smuggle control characters', () => {
  assert.equal(normalizeObjectKey('products/a.webp'), 'products/a.webp');
  assert.equal(normalizeObjectKey('/products/a.webp'), 'products/a.webp');
  assert.equal(normalizeObjectKey('products/../../etc/passwd'), null);
  assert.equal(normalizeObjectKey('products//a.webp'), null);
  assert.equal(normalizeObjectKey('products/./a.webp'), null);
  assert.equal(normalizeObjectKey('products/a\u0000.webp'), null);
  assert.equal(normalizeObjectKey(''), null);
  assert.deepEqual(storageKeyVariants('products/blue shirt.webp'),
    ['products/blue shirt.webp', 'products/blue%20shirt.webp']);
});

test('upload keys are slugified, extension-matched and confined to known prefixes', () => {
  assert.equal(buildUploadKey({ folder: 'products', fileName: 'Blue Shirt #1.JPG', contentType: 'image/jpeg' }),
    'products/blue-shirt-1.jpg');
  assert.equal(buildUploadKey({ folder: 'avatars', fileName: 'me-3f9a.webp', contentType: 'image/webp' }),
    'avatars/me-3f9a.webp');
  // Unknown folders collapse to `media` rather than creating arbitrary paths.
  assert.equal(buildUploadKey({ folder: '../../etc', fileName: 'x.png', contentType: 'image/png' }),
    'media/x.png');
  // Empty name still produces a usable, non-user-controlled key.
  assert.match(buildUploadKey({ folder: 'products', fileName: '', contentType: 'image/webp' }),
    /^products\/upload-[a-z0-9]+\.webp$/);
});

// ── presigned uploads ───────────────────────────────────────────────────────

test('presign returns a PUT bound to the content type and immutable caching', async () => {
  const s3 = fakeS3();
  const storage = createR2Storage({ env: R2_ENV, logger, client: s3 });

  const result = await storage.presignUpload({
    key: 'products/shirt-abc.webp',
    contentType: 'image/webp',
    size: 2048,
  });

  assert.equal(result.ok, true);
  assert.match(result.uploadUrl, /^https:\/\/acct123\.r2\.cloudflarestorage\.com\/hamza-media\/products\/shirt-abc\.webp/);
  assert.match(result.uploadUrl, /X-Amz-Signature=/);
  assert.equal(result.url, 'https://media.example.com/products/shirt-abc.webp');
  assert.equal(result.headers['Content-Type'], 'image/webp');
  assert.equal(result.headers['Cache-Control'], 'public, max-age=31536000, immutable');
  assert.equal(result.expiresIn, 300);
});

test('presign refuses oversized, unsupported and unsafe requests', async () => {
  const storage = createR2Storage({ env: R2_ENV, logger, client: fakeS3() });

  assert.equal((await storage.presignUpload({ key: 'products/a.webp', contentType: 'image/webp', size: 10 ** 9 })).reason,
    'too-large');
  assert.equal((await storage.presignUpload({ key: 'products/a.html', contentType: 'text/html' })).reason,
    'unsupported-type');
  assert.equal((await storage.presignUpload({ key: '../a.webp', contentType: 'image/webp' })).reason,
    'invalid-key');
});

// ── cache-control: metadata only ────────────────────────────────────────────

test('cache-control uses HeadObject + CopyObject and never downloads the object', async () => {
  const s3 = fakeS3({ head: { ContentLength: 512, ContentType: 'image/jpeg' } });
  const storage = createR2Storage({ env: R2_ENV, logger, client: s3 });

  const result = await storage.rewriteCacheControl({ key: 'media/hero.jpg' }, '86400');

  assert.equal(result.ok, true);
  assert.deepEqual(s3.calls.map((c) => c.name), ['HeadObjectCommand', 'CopyObjectCommand']);
  const copy = s3.calls[1].input;
  assert.equal(copy.CopySource, 'hamza-media/media/hero.jpg');
  assert.equal(copy.MetadataDirective, 'REPLACE');
  assert.equal(copy.CacheControl, 'public, max-age=86400, immutable');
  assert.equal(copy.ContentType, 'image/jpeg');
  // The whole point: no GetObjectCommand anywhere in this flow.
  assert.equal(s3.calls.some((c) => c.name === 'GetObjectCommand'), false);
});

test('cache-control skips oversized objects without copying them', async () => {
  const s3 = fakeS3({ head: { ContentLength: 4096, ContentType: 'image/webp' } });
  const storage = createR2Storage({ env: R2_ENV, logger, client: s3 });

  const result = await storage.rewriteCacheControl({ key: 'media/huge.webp' }, '86400');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'too-large');
  assert.deepEqual(s3.calls.map((c) => c.name), ['HeadObjectCommand']);
});

// ── deletes ─────────────────────────────────────────────────────────────────

test('deletes are batched into one request and stay reference-checked', async () => {
  const s3 = fakeS3();
  const storage = createR2Storage({
    env: R2_ENV,
    logger,
    client: s3,
    supabaseClient: fakeDb({ references: ['hamza-media/products/shared.webp'] }),
  });

  const app = express();
  app.use(express.json());
  app.use('/api/media', createMediaLifecycleRouter({ env: R2_ENV, logger, storage }));

  const base = await listen(app);
  try {
    const res = await postJson(`${base}/api/media/delete`, {
      urls: [
        'https://media.example.com/products/new.webp',
        'https://media.example.com/products/shared.webp',
        'https://media.example.com/products/also-new.webp',
      ],
    });

    assert.equal(res.status, 200);
    assert.equal(res.json.driver, 'r2');
    assert.deepEqual(res.json.deleted.sort(), [
      'https://media.example.com/products/also-new.webp',
      'https://media.example.com/products/new.webp',
    ]);
    assert.deepEqual(res.json.skipped, ['https://media.example.com/products/shared.webp']);
    assert.equal(res.json.reasons['https://media.example.com/products/shared.webp'], 'referenced');

    // ONE batched delete, not one request per object.
    const deletes = s3.calls.filter((c) => c.name === 'DeleteObjectsCommand');
    assert.equal(deletes.length, 1);
    assert.deepEqual(deletes[0].input.Delete.Objects.map((o) => o.Key).sort(),
      ['products/also-new.webp', 'products/new.webp']);
  } finally {
    await base.close();
  }
});

test('a deleted object that R2 reports as missing still counts as deleted (idempotent)', async () => {
  const s3 = fakeS3({ failOn: { DeleteObjectCommand: Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' }) } });
  const storage = createR2Storage({ env: R2_ENV, logger, client: s3 });
  assert.deepEqual(await storage.removeObject({ key: 'products/gone.webp' }), { ok: true });
});

// ── upload routes ───────────────────────────────────────────────────────────

test('POST /api/media/presign hands out a direct-to-R2 PUT', async () => {
  const storage = createR2Storage({ env: R2_ENV, logger, client: fakeS3() });
  const app = express();
  app.use(express.json());
  app.use('/api/media', createUploadRouter({ env: R2_ENV, logger, storage }));

  const base = await listen(app);
  try {
    const res = await postJson(`${base}/api/media/presign`, {
      folder: 'products',
      fileName: 'IMG 4821.webp',
      contentType: 'image/webp',
      size: 4096,
    });

    assert.equal(res.status, 200);
    assert.equal(res.json.key, 'products/img-4821.webp');
    assert.equal(res.json.url, 'https://media.example.com/products/img-4821.webp');
    assert.match(res.json.uploadUrl, /X-Amz-Signature/);
    assert.equal(res.json.headers['Cache-Control'], 'public, max-age=31536000, immutable');
  } finally {
    await base.close();
  }
});

test('presign answers 503 (not 500) when direct uploads are disabled', async () => {
  const env = { ...R2_ENV, MEDIA_DIRECT_UPLOAD_ENABLED: false };
  const storage = createR2Storage({ env, logger, client: fakeS3() });
  const app = express();
  app.use(express.json());
  app.use('/api/media', createUploadRouter({ env, logger, storage }));

  const base = await listen(app);
  try {
    const res = await postJson(`${base}/api/media/presign`, {
      folder: 'products', fileName: 'a.webp', contentType: 'image/webp', size: 10,
    });
    // 503 is what makes the client fall back to multipart instead of failing.
    assert.equal(res.status, 503);
    assert.equal(res.json.error.code, 'DIRECT_UPLOAD_DISABLED');
  } finally {
    await base.close();
  }
});

test('presign rejects a non-image content type with 415', async () => {
  const storage = createR2Storage({ env: R2_ENV, logger, client: fakeS3() });
  const app = express();
  app.use(express.json());
  app.use('/api/media', createUploadRouter({ env: R2_ENV, logger, storage }));

  const base = await listen(app);
  try {
    const res = await postJson(`${base}/api/media/presign`, {
      folder: 'products', fileName: 'x.html', contentType: 'text/html', size: 10,
    });
    assert.equal(res.status, 415);
  } finally {
    await base.close();
  }
});

test('the legacy multipart route writes to R2 and keeps the { success, url } contract', async () => {
  const s3 = fakeS3();
  const storage = createR2Storage({ env: R2_ENV, logger, client: s3 });
  const app = express();
  // Mirrors app.js: the router supplies its own multipart reader.
  app.use('/api/upload-image', createUploadRouter({ env: R2_ENV, logger, storage }));

  const base = await listen(app);
  try {
    const boundary = '----hamzaTestBoundary';
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="image"; filename="Blue Shirt.webp"\r\n'),
      Buffer.from('Content-Type: image/webp\r\n\r\n'),
      Buffer.from([0x52, 0x49, 0x46, 0x46]),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await postRaw(`${base}/api/upload-image`, payload,
      `multipart/form-data; boundary=${boundary}`);

    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.equal(res.json.driver, 'r2');
    assert.equal(res.json.key, 'products/blue-shirt.webp');
    assert.equal(res.json.url, 'https://media.example.com/products/blue-shirt.webp');

    const put = s3.calls.find((c) => c.name === 'PutObjectCommand');
    assert.ok(put, 'bytes must be written to R2');
    assert.equal(put.input.Bucket, 'hamza-media');
    assert.equal(put.input.ContentType, 'image/webp');
    assert.equal(put.input.CacheControl, 'public, max-age=31536000, immutable');
  } finally {
    await base.close();
  }
});

// ── helpers ─────────────────────────────────────────────────────────────────

function listen(app) {
  installErrorHandler(app);
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      const close = () => new Promise((done) => server.close(done));
      resolve(Object.assign(new String(base), { close, toString: () => base, valueOf: () => base, [Symbol.toPrimitive]: () => base }));
    });
  });
}

function postJson(url, body) {
  return postRaw(url, JSON.stringify(body), 'application/json');
}

function postRaw(url, payload, contentType) {
  return new Promise((resolve, reject) => {
    const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    const req = http.request(String(url), {
      method: 'POST',
      headers: { 'Content-Type': contentType, 'Content-Length': body.length },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = {};
        try { json = JSON.parse(text); } catch { json = {}; }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}
