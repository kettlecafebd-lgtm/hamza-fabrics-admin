import { isMissingRelation } from '../db/supabase.js';
import { createCircuitBreaker } from '../lib/circuitBreaker.js';
import { withTimeout } from '../lib/withTimeout.js';

/**
 * LEGACY, READ-ONLY.
 *
 * This module exists only so that old messages whose bytes still live in
 * `chat_media_blobs` keep rendering after deployment, and so the proxy can
 * keep working until the table is truncated.
 *
 * Rules enforced here:
 *  - No INSERT/UPDATE of binary payloads. Ever. (`ENABLE_LEGACY_BLOB_WRITES`
 *    is a kill-switch that logs loudly; it defaults to false.)
 *  - A truncation, a DROP TABLE, or a revoked grant must not 500 the inbox.
 *    Every failure is swallowed, the breaker opens, and callers fall back.
 */
export function createBlobStore({ client, logger, cooldownMs = 60_000, now = Date.now, env, timeoutMs = 2_000 }) {
  const breaker = createCircuitBreaker({ name: 'chat_media_blobs', cooldownMs, now });

  /**
   * One round-trip for both id shapes: an old client may send either the
   * message id or the blob id. Two sequential queries would double the
   * latency of a miss; `.or()` resolves it in one.
   */
  async function readBlobByAnyId(key) {
    if (breaker.isOpen()) return { found: false, skipped: 'circuit_open' };
    return read((query) => query.or(`message_id.eq.${key},id.eq.${key}`), key);
  }

  async function readBlobByMessageId(messageId) {
    if (breaker.isOpen()) return { found: false, skipped: 'circuit_open' };
    return read((query) => query.eq('message_id', messageId), messageId);
  }

  async function readBlobById(blobId) {
    if (breaker.isOpen()) return { found: false, skipped: 'circuit_open' };
    return read((query) => query.eq('id', blobId), blobId);
  }

  /**
   * Both the PostgREST error object AND a thrown transport error (DNS failure,
   * connection reset) must degrade to "not found". A 500 from the proxy would
   * break every <img> on the inbox page during a DB blip.
   *
   * The timeout lives HERE, not in the route, so that a stall trips the
   * breaker and the next request does not pay the same cost.
   */
  async function read(applyFilter, key) {
    try {
      const query = applyFilter(
        client
          .from('chat_media_blobs')
          .select('id, message_id, mime_type, file_name, data, media_url, bytes'),
      ).limit(1);

      const { data, error } = await withTimeout(
        Promise.resolve(query.maybeSingle()),
        timeoutMs,
        'chat_media_blobs read',
      );

      if (error) return handleError(error, key);
      if (!data) return { found: false };
      return { found: true, blob: data };
    } catch (error) {
      return handleError(error, key);
    }
  }

  function handleError(error, key) {
    if (isMissingRelation(error)) {
      if (breaker.trip(error)) {
        logger?.warn(
          `chat_media_blobs is unavailable (${error?.code || 'unknown'}). ` +
            'Media proxy will serve stored URLs only for the next ' +
            `${Math.round(cooldownMs / 1000)}s. This is expected after truncation.`,
        );
      }
      return { found: false, skipped: 'table_missing' };
    }
    // Timeouts, DNS failures and connection resets land here. Trip the breaker
    // so we stop paying the round-trip, and answer 404 instead of 500.
    if (breaker.trip(error)) {
      logger?.error('chat_media_blobs read failed — opening breaker', {
        key,
        code: error?.code || 'TRANSPORT',
        message: error?.message || String(error),
      });
    }
    return { found: false, skipped: 'error' };
  }

  return {
    readBlobByMessageId,
    readBlobById,
    readBlobByAnyId,
    isAvailable: () => !breaker.isOpen(),
    state: () => breaker.state(),
    /** Let other DB readers share this health signal (see routes/media.js). */
    markUnhealthy: (reason) => breaker.trip(reason),
    markHealthy: () => breaker.reset(),
    /** Guard so a future refactor cannot silently reintroduce binary writes. */
    assertWritesDisabled() {
      if (env?.ENABLE_LEGACY_BLOB_WRITES) {
        logger?.error(
          'ENABLE_LEGACY_BLOB_WRITES is true — binary storage is DEPRECATED and is the cause of the ' +
            '106 MB TOAST / 36 GB egress incident. Unset it unless you are debugging a migration.',
        );
        return false;
      }
      return true;
    },
  };
}

/** Turns a Postgres `bytea`/base64 value into a Buffer, or null. */
export function toBuffer(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') {
    // PostgREST returns bytea as `\x...` hex.
    if (value.startsWith('\\x')) return Buffer.from(value.slice(2), 'hex');
    try {
      const decoded = Buffer.from(value, 'base64');
      return decoded.length > 0 ? decoded : null;
    } catch {
      return null;
    }
  }
  return null;
}

export default createBlobStore;
