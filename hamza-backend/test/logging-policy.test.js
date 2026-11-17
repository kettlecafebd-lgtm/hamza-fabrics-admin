/**
 * Log-ingestion policy tests.
 *
 * Supabase bills log ingestion per line. These assertions pin the two rules
 * that keep that bill down, and the guard that stops a leftover debugging
 * session from undoing it:
 *
 *   1. Per-message / per-request chatter is `debug`, which the default
 *      `LOG_LEVEL=info` threshold drops.
 *   2. `LOG_LEVEL=debug` in production is clamped back to `info`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createLogger } from '../src/lib/logger.js';
import { guardLogLevel, isNoisyPath, requestLogger } from '../src/middleware/requestLogger.js';
import { createMediaIngestService } from '../src/services/mediaIngestService.js';

/** Logger that records every line that would actually be written. */
function recordingLogger(level) {
  const lines = [];
  const sink = {
    log: (...args) => lines.push(['log', args]),
    info: (...args) => lines.push(['info', args]),
    warn: (...args) => lines.push(['warn', args]),
    error: (...args) => lines.push(['error', args]),
    debug: (...args) => lines.push(['debug', args]),
  };
  return { lines, logger: createLogger({ level, sink }) };
}

test('one stored chat message writes no billable log line at the default level', async () => {
  const { lines, logger } = recordingLogger('info');

  const messages = {
    findMessageByPlatformId: async () => null,
    insertMessage: async (row) => ({ id: 'm1', ...row }),
    touchConversation: async () => {},
  };
  const conversations = { findOrCreate: async () => ({ id: 'c1' }) };
  const ingest = createMediaIngestService({ messages, conversations, logger });

  await ingest.handleMessengerMessage({
    pageId: 'page1',
    event: { sender: { id: 'user1' }, message: { mid: 'mid1', text: 'hello', timestamp: 1 } },
  });

  assert.deepEqual(lines, [], 'a normal message must not be logged at info');
});

test('a stored message still logs when the level is debug (opt-in diagnosis)', async () => {
  const { lines, logger } = recordingLogger('debug');
  const messages = {
    findMessageByPlatformId: async () => null,
    insertMessage: async (row) => ({ id: 'm1', ...row }),
    touchConversation: async () => {},
  };
  const conversations = { findOrCreate: async () => ({ id: 'c1' }) };
  const ingest = createMediaIngestService({ messages, conversations, logger });

  await ingest.handleWhatsAppMessage({
    phoneNumberId: 'pn1',
    value: { messages: [{ id: 'wa1', from: '8801', type: 'text', text: { body: 'hi' } }] },
  });

  assert.equal(lines.length, 1);
  // createLogger writes a level prefix, then the message and its fields.
  assert.match(lines[0][1].flat().join(' '), /stored whatsapp message/);
});

test('LOG_MEDIA_EVENTS=true promotes per-message lines back to info', async () => {
  const { lines, logger } = recordingLogger('info');
  const messages = {
    findMessageByPlatformId: async () => null,
    insertMessage: async (row) => ({ id: 'm1', ...row }),
    touchConversation: async () => {},
  };
  const conversations = { findOrCreate: async () => ({ id: 'c1' }) };
  const ingest = createMediaIngestService({ messages, conversations, logger, env: { LOG_MEDIA_EVENTS: true } });

  await ingest.handleMessengerMessage({
    pageId: 'page1',
    event: { sender: { id: 'user1' }, message: { mid: 'mid1', text: 'hello', timestamp: 1 } },
  });

  assert.equal(lines.length, 1);
  assert.equal(lines[0][0], 'info');
  assert.match(lines[0][1].flat().join(' '), /stored messenger message mid1/);
});

test('failures are never silenced', async () => {
  const { lines, logger } = recordingLogger('info');
  const messages = { findMessageByPlatformId: async () => { throw new Error('db down'); } };
  const ingest = createMediaIngestService({ messages, conversations: {}, logger });

  await assert.rejects(() => ingest.handleMessengerMessage({
    pageId: 'p',
    event: { sender: { id: 'u' }, message: { mid: 'm', text: 'x' } },
  }));
  // The route layer logs the failure; what matters here is that the default
  // level does not drop warn/error.
  logger.error('messenger event failed', { mid: 'm' });
  assert.equal(lines.length, 1);
  assert.equal(lines[0][0], 'error');
});

test('media and probe traffic is excluded from request logging', () => {
  assert.equal(isNoisyPath('/api/chat/media/s/token123'), true);
  assert.equal(isNoisyPath('/api/chat/media/abc'), true);
  assert.equal(isNoisyPath('/health'), true);
  assert.equal(isNoisyPath('/api/chat/conversations'), false);
  assert.equal(isNoisyPath('/api/products'), false);
});

test('request logging records the API but skips a whole thread of images', async () => {
  const { lines, logger } = recordingLogger('debug');
  const app = express();
  app.use(requestLogger({ logger }));
  app.get('/api/chat/media/:id', (_req, res) => res.status(302).end());
  app.get('/api/chat/conversations', (_req, res) => res.json({ ok: true }));
  app.get('/api/chat/boom', () => { throw new Error('nope'); });
  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => res.status(500).json({ ok: false }));

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  const get = (path) => fetch(`http://127.0.0.1:${port}${path}`).then((r) => r.text());

  try {
    await get('/api/chat/media/abc');
    await Promise.all(Array.from({ length: 5 }, (_, i) => get(`/api/chat/media/img${i}`)));
    await get('/api/chat/conversations');
    await get('/api/chat/boom');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  const paths = lines.map(([, args]) => args.flat().join(' '));
  // Six image requests produced zero lines; the API call and the failure did.
  assert.equal(paths.filter((p) => p.includes('/media/')).length, 0);
  assert.equal(paths.filter((p) => p.includes('/conversations')).length, 1);
  assert.equal(paths.filter((p) => p.includes('/boom')).length, 1);
});

test('LOG_LEVEL=debug is refused in production and clamped to info', () => {
  const warnings = [];
  const sink = { warn: (...args) => warnings.push(args.join(' ')), log() {} };
  const logger = { warn() {}, error() {}, info() {}, debug() {} };

  const env = guardLogLevel({ NODE_ENV: 'production', LOG_LEVEL: 'debug' }, logger, { sink });
  assert.equal(env.LOG_LEVEL, 'info');
  assert.match(warnings[0], /not allowed in production/);

  // Development keeps debug, so local investigation is unaffected.
  const dev = guardLogLevel({ NODE_ENV: 'development', LOG_LEVEL: 'debug' }, logger, { sink });
  assert.equal(dev.LOG_LEVEL, 'debug');

  // An explicit info/silent-in-production clamp also covers `silent`, which
  // would hide the failures you actually need.
  const silent = guardLogLevel({ NODE_ENV: 'production', LOG_LEVEL: 'silent' }, logger, { sink });
  assert.equal(silent.LOG_LEVEL, 'info');
});

test('the logger drops debug lines at info level but keeps warn and error', () => {
  const { lines, logger } = recordingLogger('info');
  logger.debug('noise');
  logger.info('also dropped? no: info is the threshold');
  logger.warn('keep');
  logger.error('keep');

  assert.deepEqual(lines.map(([name]) => name), ['info', 'warn', 'error']);
});
