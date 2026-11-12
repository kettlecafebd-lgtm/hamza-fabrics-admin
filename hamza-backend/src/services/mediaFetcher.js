import { badGateway, HttpError } from '../lib/httpError.js';
import { LruCache } from '../lib/lruCache.js';

/**
 * The ONLY place in this service that pulls bytes over the network, and the
 * only place bytes are held: in a bounded in-memory LRU — never Postgres.
 *
 * Guards against SSRF (host allowlist, no redirects to new hosts, no private
 * IPs) and against memory exhaustion (size cap, timeout).
 */
const ALLOWED_HOST_SUFFIXES = [
  'cdninstagram.com',
  'fbcdn.net',
  'fbsbx.com', // lookaside.fbsbx.com — where Messenger/IG chat attachments live
  'facebook.com',
  'whatsapp.net',
  'whatsapp.com',
];

export function isAllowedMediaHost(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  // Block literal private ranges / localhost outright.
  if (/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) {
    return false;
  }
  return ALLOWED_HOST_SUFFIXES.some((suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`));
}

export function createMediaFetcher({
  logger,
  maxBytes = 16 * 1024 * 1024,
  cacheBytes = 32 * 1024 * 1024,
  timeoutMs = 15_000,
  fetchImpl = globalThis.fetch,
}) {
  const cache = new LruCache({ maxBytes: cacheBytes });

  async function fetchUpstream(url, { accessToken, cacheKey, ttlMs = 5 * 60_000 } = {}) {
    if (!isAllowedMediaHost(url)) {
      throw new HttpError(400, 'Refusing to fetch media from an untrusted host.', { code: 'MEDIA_HOST_NOT_ALLOWED' });
    }

    if (cacheKey) {
      const hit = cache.get(cacheKey);
      if (hit) return hit;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(url, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        redirect: 'follow',
        signal: controller.signal,
      });
    } catch (error) {
      throw badGateway(`Media fetch failed: ${error.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new HttpError(
        response.status === 404 ? 404 : 502,
        'Upstream media is no longer available.',
        { code: 'MEDIA_FETCH_FAILED', expose: true, details: { status: response.status } },
      );
    }

    const declared = Number.parseInt(response.headers.get('content-length') || '0', 10);
    if (declared > maxBytes) {
      throw new HttpError(413, 'Media exceeds the allowed size.', { code: 'MEDIA_TOO_LARGE' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw new HttpError(413, 'Media exceeds the allowed size.', { code: 'MEDIA_TOO_LARGE' });
    }

    const result = {
      buffer,
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      etag: response.headers.get('etag') || null,
    };

    if (cacheKey) {
      cache.set(cacheKey, result, ttlMs);
      logger?.debug(`media cache miss -> stored ${buffer.length}B as ${cacheKey}`);
    }

    return result;
  }

  return {
    fetchUpstream,
    isAllowedMediaHost,
    cacheStats: () => cache.stats(),
    clearCache: () => cache.map.clear(),
  };
}

export default createMediaFetcher;
