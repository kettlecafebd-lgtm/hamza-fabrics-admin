import express from 'express';
import { loadEnv } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { HttpError } from './lib/httpError.js';
import { createSupabase } from './db/supabase.js';
import { createGraphClient } from './services/graphClient.js';
import { createBlobStore } from './services/legacyBlobStore.js';
import { createMessageRepository } from './services/messageRepository.js';
import { createConversationService } from './services/conversationService.js';
import { createMediaIngestService } from './services/mediaIngestService.js';
import { createMediaFetcher } from './services/mediaFetcher.js';
import { createMediaRouter } from './routes/media.js';
import { createRefreshMediaRouter } from './routes/refreshMedia.js';
import { createChatRouter } from './routes/chat.js';
import { createWebhookRouter } from './routes/webhooks.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { metaSignatureMiddleware } from './lib/metaSignature.js';

export function createApp({ env = loadEnv(), logger = createLogger({ level: process.env.LOG_LEVEL || 'info' }) } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Keep the exact bytes Meta signed; JSON.stringify would change them.
  app.use('/api/webhooks', express.json({
    limit: '2mb',
    verify: (req, _res, buf) => { req.rawBody = buf; },
  }));
  app.use(express.json({ limit: '1mb' }));

  const supabase = createSupabase({ url: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY, logger });
  const client = supabase.client;
  const graph = createGraphClient({
    baseUrl: env.META_GRAPH_BASE,
    version: env.META_GRAPH_VERSION,
    logger,
  });

  const blobStore = createBlobStore({
    client,
    logger,
    env,
    cooldownMs: env.BLOB_BREAKER_SECONDS * 1000,
  });
  blobStore.assertWritesDisabled();

  const messages = createMessageRepository({ client, logger });
  const conversations = createConversationService({ client, logger });
  const mediaFetcher = createMediaFetcher({
    logger,
    maxBytes: env.MEDIA_STREAM_MAX_BYTES,
    cacheBytes: env.MEDIA_STREAM_CACHE_BYTES,
  });
  const ingest = createMediaIngestService({ messages, conversations, logger });

  // Shared with routes that resolve media lazily.
  app.locals.graph = graph;
  app.locals.blobStore = blobStore;
  app.locals.mediaFetcher = mediaFetcher;
  app.locals.messages = messages;

  const requireAdmin = createAuthMiddleware({ client, logger });
  const metaVerify = metaSignatureMiddleware({ appSecret: env.META_APP_SECRET, logger });

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'hamza-backend', storage: 'url-only' }));

  // Media proxy must be reachable from <img src> -> signed URLs, no auth header.
  app.use('/api/chat/media', createMediaRouter({ env, logger, blobStore, messages, graph, mediaFetcher }));

  // Webhooks authenticate with X-Hub-Signature-256, not bearer tokens.
  app.use('/api/webhooks', createWebhookRouter({ env, logger, ingest, metaVerify }));

  app.use('/api/chat', requireAdmin);
  app.use('/api/chat', createChatRouter({ env, logger, client, messages }));
  app.use('/api/chat/refresh-media', requireAdmin, createRefreshMediaRouter({ env, logger, messages, graph }));

  app.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } }));

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, _next) => {
    const status = error instanceof HttpError ? error.status : Number(error.status) || 500;
    if (status >= 500) logger.error('request failed', { path: req.path, message: error.message, stack: error.stack });
    res.status(status).json({
      success: false,
      error: {
        code: error.code || `HTTP_${status}`,
        message: error.expose || status < 500 ? error.message : 'Internal server error.',
        ...(error.details ? { details: error.details } : {}),
      },
    });
  });

  return { app, deps: { client, graph, blobStore, messages, mediaFetcher, ingest, env, logger } };
}

export default createApp;
