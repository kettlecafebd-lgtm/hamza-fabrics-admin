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
import { createMediaStorage } from './services/mediaStorage.js';
import { createMediaLifecycleRouter, createMediaRouter } from './routes/media.js';
import { createUploadRouter } from './routes/uploads.js';
import { guardLogLevel, requestLogger as requestLoggerMiddleware } from './middleware/requestLogger.js';
import { createRefreshMediaRouter } from './routes/refreshMedia.js';
import { createChatRouter } from './routes/chat.js';
import { createWebhookRouter } from './routes/webhooks.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { metaSignatureMiddleware } from './lib/metaSignature.js';

export function createApp({ env = loadEnv(), logger = createLogger({ level: process.env.LOG_LEVEL || 'info' }) } = {}) {
  // A debug level in production is the single easiest way to re-create the log
  // ingestion bill; clamp it here so every entry point (server, tests, scripts)
  // gets the same behaviour.
  env = guardLogLevel(env, logger);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Keep the exact bytes Meta signed; JSON.stringify would change them.
  app.use('/api/webhooks', express.json({
    limit: '2mb',
    verify: (req, _res, buf) => { req.rawBody = buf; },
  }));
  app.use(express.json({ limit: '1mb' }));

  // Opt-in and noise-filtered: see middleware/requestLogger.js. Success is
  // logged at `debug` (dropped by the default level) so a page load cannot
  // generate 50 billable records.
  if (env.LOG_HTTP_REQUESTS === true || env.LOG_HTTP_REQUESTS === 'true') {
    app.use(requestLoggerMiddleware({ logger }));
  }

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
  const ingest = createMediaIngestService({ messages, conversations, logger, env });
  const mediaStorage = createMediaStorage({ client, env, logger });

  // Shared with routes that resolve media lazily.
  app.locals.graph = graph;
  app.locals.blobStore = blobStore;
  app.locals.mediaFetcher = mediaFetcher;
  app.locals.messages = messages;
  app.locals.mediaStorage = mediaStorage;

  const requireAdmin = createAuthMiddleware({ client, logger });
  const metaVerify = metaSignatureMiddleware({ appSecret: env.META_APP_SECRET, logger });

  /**
   * Liveness + honest storage report. `driver` is the answer to "are we still
   * paying Supabase for this?", and `warnings` is why presigned uploads would
   * be refused.
   */
  app.get('/health', (_req, res) => res.json({
    ok: true,
    service: 'hamza-backend',
    storage: 'url-only',
    mediaDriver: mediaStorage.driver,
    mediaConfigured: Boolean(mediaStorage.configured ?? mediaStorage.driver === 'r2'),
    directUpload: Boolean(env.MEDIA_DIRECT_UPLOAD_ENABLED),
    warnings: env.MEDIA_STORAGE_WARNINGS || [],
  }));

  // Media proxy must be reachable from <img src> -> signed URLs, no auth header.
  app.use('/api/chat/media', createMediaRouter({ env, logger, blobStore, messages, graph, mediaFetcher }));

  // Webhooks authenticate with X-Hub-Signature-256, not bearer tokens.
  app.use('/api/webhooks', createWebhookRouter({ env, logger, ingest, metaVerify }));

  // All admin media routes share ONE auth pass. Mounting two routers each
  // behind `requireAdmin` on the same prefix would verify the same token twice
  // per request, and every verification is a Supabase Auth round-trip (a logged
  // request we pay for). One router, one check.
  const mediaAdmin = express.Router();
  mediaAdmin.use(requireAdmin);

  // Uploads first: `/api/media/presign` hands the browser a direct-to-R2 PUT
  // (zero bytes through us) and `/api/media/upload-image` is the legacy
  // multipart shape, now writing to R2 instead of Supabase Storage.
  const uploadRouter = createUploadRouter({ env, logger, storage: mediaStorage });
  mediaAdmin.use(uploadRouter);

  // Life-cycle: reference-checked deletes and server-side Cache-Control fixes.
  mediaAdmin.use(createMediaLifecycleRouter({ env, logger, storage: mediaStorage }));
  app.use('/api/media', mediaAdmin);

  // Legacy alias: `ProfileSettings.jsx` and `Settings.jsx` still POST here.
  app.use('/api/upload-image', requireAdmin, uploadRouter);

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

  return { app, deps: { client, graph, blobStore, messages, mediaFetcher, mediaStorage, ingest, env, logger } };
}

export default createApp;
