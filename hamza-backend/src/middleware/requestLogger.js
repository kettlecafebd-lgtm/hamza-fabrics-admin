import { createLogger } from '../lib/logger.js';

/**
 * Request logging + Supabase log-ingestion control.
 *
 * WHY
 * ---
 * Supabase bills log ingestion per ingested line, and this service is the
 * noisiest writer we control:
 *
 *   1. **One `info` per stored message.** Every inbound Messenger/WhatsApp text
 *      produced a log record — thousands a day for a busy inbox, and none of it
 *      was actionable.
 *   2. **One line per media resolve / delete / cache-control sweep.**
 *   3. **A GET per `<img>`** for `/api/chat/media/*`. A 50-message thread is 50
 *      requests, each previously logging.
 *
 * The policy now:
 *
 *   - `warn` / `error` always emit (they are few, and they are the ones you read).
 *   - Per-message and per-request chatter is `debug`, which the default
 *     `LOG_LEVEL=info` threshold drops entirely.
 *   - Request lines are opt-in (`LOG_HTTP_REQUESTS=true`), and even then media
 *     GETs and health checks are skipped, because a 302 to a CDN is not an
 *     event worth paying to store.
 *   - `server.js` fails loudly once at boot if `LOG_LEVEL` is `debug` in
 *     production, so a leftover debugging session cannot quietly reinstate the
 *     bill.
 */

/** Paths whose request lines are never worth ingesting. */
const NOISY_PATH_PREFIXES = [
  '/api/chat/media', // one per <img>; a 302 to a CDN explains itself
  '/health',
  '/api/media/config',
  '/api/media/upload-capabilities',
  '/favicon.ico',
];

export function isNoisyPath(path) {
  const value = String(path || '');
  return NOISY_PATH_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(prefix));
}

/**
 * `express` middleware emitting exactly one line per request, at `info`, for
 * paths that are not noise. Mounted only when `LOG_HTTP_REQUESTS=true`.
 */
export function requestLogger({ logger = createLogger() } = {}) {
  return function logRequest(req, res, next) {
    if (isNoisyPath(req.path)) return next();

    const startedAt = process.hrtime.bigint();
    res.once('finish', () => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      // Success is debug (aggregate, don't archive); failures stay at warn.
      const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms`;
      if (res.statusCode >= 500) logger.error(line);
      else if (res.statusCode >= 400) logger.warn(line);
      else logger.debug(line);
    });
    return next();
  };
}

/**
 * Boot-time guard against the one setting that silently restores the old bill.
 * Returns the effective env after clamping, so the caller can log the change.
 */
export function guardLogLevel(env, logger, { sink = console } = {}) {
  const level = String(env.LOG_LEVEL || 'info').toLowerCase();
  if (env.NODE_ENV === 'production' && (level === 'debug' || level === 'silent')) {
    const message =
      '[hamza-backend] LOG_LEVEL=' + level + ' is not allowed in production: ' +
      'debug floods log ingestion, silent hides failures. Using "info".';
    (sink.warn || sink.log).call(sink, message);
    logger?.warn(message);
    return { ...env, LOG_LEVEL: 'info' };
  }
  return env;
}

export default requestLogger;
