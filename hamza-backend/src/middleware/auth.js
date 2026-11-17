import { createHash } from 'node:crypto';
import { unauthorized } from '../lib/httpError.js';

/**
 * Admin authentication for inbox / media endpoints.
 *
 * The frontend sends `Authorization: Bearer <adminToken>` where adminToken is
 * issued by /api/auth/login (see the frontend's src/utils/auth.js). This module
 * verifies it as a Supabase-issued JWT and requires an admin-ish role claim.
 *
 * Media proxying is deliberately NOT behind this middleware: <img> tags cannot
 * send headers. Those routes are protected by HMAC-signed, expiring URLs
 * instead (see lib/mediaSignature.js), which is the standard trade-off.
 *
 * WHY THE TOKEN CACHE EXISTS
 * --------------------------
 * `client.auth.getUser(token)` is an HTTP call to Supabase Auth on **every**
 * request. Opening the inbox fires conversations + messages + a request per
 * <img>, so a single screen could produce dozens of Auth round-trips — and every
 * one of them is a Supabase request that lands in log ingestion (and counts
 * against rate limits) without telling us anything new.
 *
 * A verified token is cached until shortly before its own `exp`, keyed by a
 * SHA-256 of the token, so the raw JWT is never held in memory or in a log line.
 * Revocation is therefore bounded by `exp` — the same guarantee Supabase's own
 * JWT verification gives, since a signed token is valid until it expires.
 */

/** Verify at most this many distinct tokens per process; bounded memory. */
const DEFAULT_MAX_ENTRIES = 500;

/** Never trust a cached entry for longer than this, even for a long-lived exp. */
const MAX_CACHE_MS = 5 * 60 * 1000;

/** Re-verify this far ahead of expiry so a token cannot expire mid-request. */
const EXPIRY_SKEW_MS = 30 * 1000;

function tokenCacheKey(token) {
  // A JWT is a bearer credential: never use it as a map key or log it.
  return createHash('sha256').update(token).digest('hex');
}

export function createAuthMiddleware({ client, logger, cache = true, maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
  const tokens = cache
    ? new Map() // key -> { user, expiresAt }
    : null;

  function getCached(key) {
    if (!tokens) return null;
    const entry = tokens.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      tokens.delete(key);
      return null;
    }
    return entry.user;
  }

  function setCached(key, user) {
    if (!tokens) return;
    // Simple FIFO bound: this map only ever holds a few hundred short strings.
    if (tokens.size >= maxEntries) {
      const oldest = tokens.keys().next().value;
      if (oldest !== undefined) tokens.delete(oldest);
    }
    tokens.set(key, user);
  }

  /** How long a verification may be reused, from the token's own `exp`. */
  function cacheTtlFor(expSeconds) {
    if (!Number.isFinite(expSeconds)) return MAX_CACHE_MS;
    const untilExpiry = expSeconds * 1000 - Date.now() - EXPIRY_SKEW_MS;
    if (untilExpiry <= 0) return 0;
    return Math.min(untilExpiry, MAX_CACHE_MS);
  }

  return async function requireAdmin(req, res, next) {
    try {
      const header = req.headers.authorization || '';
      const [scheme, token] = header.split(' ');
      if (scheme !== 'Bearer' || !token) return next(unauthorized());

      const key = tokenCacheKey(token);
      const cached = getCached(key);
      if (cached) {
        req.user = cached;
        return next();
      }

      const { data, error } = await client.auth.getUser(token);
      if (error || !data?.user) return next(unauthorized('Invalid or expired session.'));

      // Only server-assigned roles may send as the shop; user_metadata is editable by the user.
      const role = data.user.app_metadata?.role || 'user';
      if (!['admin', 'owner', 'manager', 'service_role'].includes(role)) {
        logger?.warn('Rejected non-admin inbox access', { userId: data.user.id, role });
        return next(unauthorized('Admin access required.'));
      }

      const user = { id: data.user.id, email: data.user.email, role };
      const ttl = cacheTtlFor(Number(data.user.exp ?? expiryFromToken(token)));
      if (ttl > 0) setCached(key, user);

      req.user = user;
      return next();
    } catch (error) {
      logger?.error('auth middleware failure', error.message);
      return next(unauthorized('Authentication failed.'));
    }
  };
}

/**
 * Read `exp` from a JWT payload without verifying it. Only used to size a cache
 * entry for a token Supabase has *already* verified, so an unverified read is
 * harmless: a forged exp can only shorten or (at most) extend reuse by
 * MAX_CACHE_MS of an already-valid token.
 */
function expiryFromToken(token) {
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number(json.exp);
  } catch {
    return NaN;
  }
}

export default createAuthMiddleware;
