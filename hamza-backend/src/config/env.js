/**
 * Environment configuration for hamza-backend.
 *
 * Every value that changes between deployments lives here. Anything that is
 * required for chat media to work is validated at boot so the process fails
 * loudly instead of silently degrading to "no attachments".
 */

const DEFAULTS = {
  PORT: 5000,
  META_GRAPH_VERSION: 'v21.0',
  META_GRAPH_BASE: 'https://graph.facebook.com',
  LOG_LEVEL: 'info',
  /** How long a resolved Facebook CDN URL is considered "fresh enough" to reuse. */
  MEDIA_URL_TTL_SECONDS: 60 * 60 * 24 * 3, // 3 days
  /** Hard cap on bytes we will ever stream through the proxy for one request. */
  MEDIA_STREAM_MAX_BYTES: 16 * 1024 * 1024, // 16 MB (WhatsApp Cloud API limit)
  /** In-process cache for proxied WhatsApp bytes (Meta requires a token header). */
  MEDIA_STREAM_CACHE_BYTES: 32 * 1024 * 1024,
  /** Seconds to stop querying chat_media_blobs after a failure (e.g. table dropped). */
  BLOB_BREAKER_SECONDS: 60,
  /** Signed proxy URLs handed to the browser. */
  MEDIA_URL_SIGNING_TTL_SECONDS: 60 * 60 * 24,
  /**
   * LEGACY ONLY. Keep writing raw bytes into chat_media_blobs.
   * Must stay false: this is the exact behaviour we are removing.
   */
  ENABLE_LEGACY_BLOB_WRITES: false,

  // ---- Product / hero media life-cycle (POST /api/media/*) ----
  /**
   * Deletion is opt-in: enable it only after migration 003's
   * `media_references` view exists and has been verified. While false, every
   * URL is answered with `skipped: ['disabled']` and nothing is removed.
   */
  MEDIA_DELETE_ENABLED: false,
  /** Buckets the delete route may touch (comma-separated). */
  MEDIA_DELETE_BUCKETS: 'media,products',
  /** Bound on work per request; the browser sweeps at most this many at once. */
  MEDIA_DELETE_MAX_URLS: 50,
  /** Cache-control backfill is heavier (bytes round-trip), so keep it small. */
  MEDIA_CACHE_CONTROL_MAX_URLS: 10,
  MEDIA_CACHE_CONTROL_MAX_BYTES: 8 * 1024 * 1024,
  /** Seconds Supabase stores for uploads; a year only because keys are content-addressed. */
  MEDIA_UPLOAD_CACHE_CONTROL_SECONDS: 31_536_000,
  /** View/table the delete route consults before removing an object. */
  MEDIA_REFERENCES_VIEW: 'media_references',
};

/** Values that must be booleans, not the raw env string. */
const BOOLEAN_KEYS = ['ENABLE_LEGACY_BLOB_WRITES', 'MEDIA_DELETE_ENABLED'];

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

function readBool(value, fallback) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function readInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadEnv(source = process.env) {
  const env = {
    ...DEFAULTS,
    NODE_ENV: source.NODE_ENV || 'development',

    SUPABASE_URL: source.SUPABASE_URL || '',
    SUPABASE_SERVICE_ROLE_KEY: source.SUPABASE_SERVICE_ROLE_KEY || '',

    META_APP_SECRET: source.META_APP_SECRET || '',
    META_VERIFY_TOKEN: source.META_VERIFY_TOKEN || '',
    META_PAGE_ACCESS_TOKEN: source.META_PAGE_ACCESS_TOKEN || '',

    WHATSAPP_TOKEN: source.WHATSAPP_TOKEN || '',
    WHATSAPP_PHONE_NUMBER_ID: source.WHATSAPP_PHONE_NUMBER_ID || '',
    WHATSAPP_VERIFY_TOKEN: source.WHATSAPP_VERIFY_TOKEN || source.META_VERIFY_TOKEN || '',

    MEDIA_URL_SIGNING_SECRET: source.MEDIA_URL_SIGNING_SECRET || '',
    /** Absolute base URL used when serialising media links (optional). */
    PUBLIC_API_BASE_URL: source.PUBLIC_API_BASE_URL || '',
  };

  for (const key of Object.keys(DEFAULTS)) {
    if (source[key] !== undefined) {
      env[key] = typeof DEFAULTS[key] === 'number' ? readInt(source[key], DEFAULTS[key]) : source[key];
    }
  }

  for (const key of BOOLEAN_KEYS) {
    env[key] = readBool(source[key], DEFAULTS[key]);
  }
  env.META_GRAPH_VERSION = String(env.META_GRAPH_VERSION).replace(/^\/+/, '');

  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    const error = new Error(`Missing required env vars: ${missing.join(', ')}`);
    error.code = 'ENV_MISSING';
    throw error;
  }

  if (!env.MEDIA_URL_SIGNING_SECRET) {
    // Deriving keeps deployments working without a new secret, but a dedicated
    // secret is better: rotating it must not rotate the DB credentials.
    env.MEDIA_URL_SIGNING_SECRET = `derived:${env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 32)}`;
  }

  return env;
}

export default loadEnv;
