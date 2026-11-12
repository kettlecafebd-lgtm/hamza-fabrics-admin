import crypto from 'node:crypto';

/**
 * Signed media URLs.
 *
 * Problem: Facebook CDN URLs embed a page access token in `oe=`/`oh=` style
 * parameters. WhatsApp Cloud API URLs are not public at all — they need an
 * `Authorization` header. We therefore never hand the raw upstream URL to the
 * browser. Instead the API returns `/api/chat/media/s/<token>` where the token
 * is `base64url(JSON{id,exp}) + '.' + hmac`.
 *
 * Properties:
 *  - Opaque: no upstream host, no token material leaks to the client.
 *  - Bounded lifetime: the token expires, unlike a raw CDN URL.
 *  - Tamper-evident: changing the message id or expiry invalidates the HMAC.
 */
const B64URL = 'base64url';

function hmac(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest(B64URL);
}

export function signMediaToken({ messageId, exp }, secret) {
  const body = Buffer.from(JSON.stringify({ i: String(messageId), e: exp }), 'utf8').toString(B64URL);
  return `${body}.${hmac(secret, body)}`;
}

export function verifyMediaToken(token, secret, { now = Date.now() } = {}) {
  if (typeof token !== 'string' || !token.includes('.')) return { ok: false, reason: 'malformed' };
  const [body, signature] = token.split('.');
  if (!body || !signature) return { ok: false, reason: 'malformed' };

  const expected = hmac(secret, body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(body, B64URL).toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (!parsed?.i || !Number.isFinite(parsed?.e)) return { ok: false, reason: 'malformed' };
  if (parsed.e * 1000 <= now) return { ok: false, reason: 'expired' };

  return { ok: true, messageId: parsed.i, exp: parsed.e };
}

/** Constant-time comparison for webhook verify tokens / signatures. */
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
