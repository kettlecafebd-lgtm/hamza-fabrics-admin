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
  /**
   * Cache-control backfill. On R2 this is a server-side CopyObject (metadata
   * only, zero payload egress), so the batch can be larger than the old
   * download-then-upload Supabase path -- but it is still a maintenance job.
   */
  MEDIA_CACHE_CONTROL_MAX_URLS: 10,
  MEDIA_CACHE_CONTROL_MAX_BYTES: 25 * 1024 * 1024,
  /** Seconds Supabase stores for uploads; a year only because keys are content-addressed. */
  MEDIA_UPLOAD_CACHE_CONTROL_SECONDS: 31_536_000,
  /** View/table the delete route consults before removing an object. */
  MEDIA_REFERENCES_VIEW: 'media_references',

  // ---- Cloudflare R2 (the media store; Supabase Storage is deprecated) ----
  /**
   * 'r2' (default when configured), 'supabase' (deprecated drain-only mode).
   * Left empty so `resolveStorageDriver()` can prefer R2 whenever its
   * credentials exist and refuse to silently keep billing Supabase.
   */
  MEDIA_STORAGE_DRIVER: '',
  R2_BUCKET: '',
  R2_ACCESS_KEY_ID: '',
  R2_SECRET_ACCESS_KEY: '',
  R2_ACCOUNT_ID: '',
  R2_ENDPOINT: '',
  /** 'auto' is R2's only region. */
  R2_REGION: 'auto',
  /** Public delivery base: a custom domain in front of the bucket, or r2.dev. */
  R2_PUBLIC_BASE_URL: '',
  /** Lifetime of a presigned browser PUT. Short: minted right before the PUT. */
  MEDIA_PRESIGN_TTL_SECONDS: 300,
  /** Ceiling for any single upload (client optimiser already caps at 1200 px). */
  MEDIA_UPLOAD_MAX_BYTES: 10 * 1024 * 1024,
  /**
   * When false, `/api/media/presign` answers 503 and the frontend falls back to
   * server-side multipart upload. Set false until the bucket's CORS policy
   * allows PUT from the admin origin.
   */
  MEDIA_DIRECT_UPLOAD_ENABLED: true,

  // ---- Log ingestion control ----
  /**
   * One line per stored message is the single largest log-ingestion driver in
   * this service: every WhatsApp/Messenger message produced an `info` record,
   * and log-ingestion billing is per line. Off by default; `LOG_MEDIA_EVENTS=true`
   * turns it back on for debugging.
   */
  LOG_MEDIA_EVENTS: false,
  /** Emit one request line per HTTP request (method, path, status, ms). */
  LOG_HTTP_REQUESTS: false,
};

/** Values that must be booleans, not the raw env string. */
const BOOLEAN_KEYS = [
  'ENABLE_LEGACY_BLOB_WRITES',
  'MEDIA_DELETE_ENABLED',
  'MEDIA_DIRECT_UPLOAD_ENABLED',
  'LOG_MEDIA_EVENTS',
  'LOG_HTTP_REQUESTS',
];

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

    // Cloudflare R2. Credentials are read straight through; presence (not
    // validity) is checked by `isR2Configured()` at boot.
    R2_BUCKET: source.R2_BUCKET || '',
    R2_ACCESS_KEY_ID: source.R2_ACCESS_KEY_ID || '',
    R2_SECRET_ACCESS_KEY: source.R2_SECRET_ACCESS_KEY || '',
    R2_ACCOUNT_ID: source.R2_ACCOUNT_ID || '',
    R2_ENDPOINT: source.R2_ENDPOINT || '',
    R2_PUBLIC_BASE_URL: source.R2_PUBLIC_BASE_URL || '',
    MEDIA_STORAGE_DRIVER: source.MEDIA_STORAGE_DRIVER || '',

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

  // R2 is the media store. A partially-configured bucket is a *warning*, not a
  // boot failure: refusing to start would also stop webhook ingestion, which
  // has nothing to do with where images live. `MEDIA_STORAGE_DRIVER=supabase`
  // is honoured silently because it is an explicit, temporary drain decision.
  const r2Missing = ['R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']
    .filter((key) => !env[key]);
  const r2HasEndpoint = Boolean(env.R2_ENDPOINT || env.R2_ACCOUNT_ID);
  env.MEDIA_STORAGE_CONFIGURED = r2Missing.length === 0 && r2HasEndpoint;
  env.MEDIA_STORAGE_WARNINGS = [];

  if (!env.MEDIA_STORAGE_CONFIGURED) {
    const detail = r2Missing.length
      ? `missing ${r2Missing.join(', ')}`
      : 'missing R2_ACCOUNT_ID or R2_ENDPOINT';
    env.MEDIA_STORAGE_WARNINGS.push(`R2 is not configured (${detail})`);
  }
  if (env.MEDIA_STORAGE_CONFIGURED && !env.R2_PUBLIC_BASE_URL) {
    // Without a public base we can upload but never hand out a URL.
    env.MEDIA_STORAGE_WARNINGS.push('R2_PUBLIC_BASE_URL is empty: public URLs cannot be generated');
  }
  if (env.MEDIA_DIRECT_UPLOAD_ENABLED && !env.MEDIA_STORAGE_CONFIGURED) {
    env.MEDIA_DIRECT_UPLOAD_ENABLED = false;
    env.MEDIA_STORAGE_WARNINGS.push('MEDIA_DIRECT_UPLOAD_ENABLED disabled because R2 is not configured');
  }

  return env;
}

export default loadEnv;
