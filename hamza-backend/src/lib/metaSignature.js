import crypto from 'node:crypto';
import { safeEqual } from './mediaSignature.js';

/**
 * Verifies Meta's `X-Hub-Signature-256` header.
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validate-payloads
 */
export function verifyMetaSignature({ rawBody, headers, appSecret }) {
  if (!appSecret) return { ok: false, reason: 'app_secret_not_configured' };
  const header = headers['x-hub-signature-256'];
  if (!header || typeof header !== 'string') return { ok: false, reason: 'missing_signature' };

  const [scheme, digest] = header.split('=');
  if (scheme !== 'sha256' || !digest) return { ok: false, reason: 'unsupported_signature' };
  if (!rawBody) return { ok: false, reason: 'missing_raw_body' };

  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  if (!safeEqual(digest, expected)) return { ok: false, reason: 'signature_mismatch' };
  return { ok: true };
}

/**
 * Middleware factory. `rawBody` must come from express.raw()/verify so the
 * signature is computed over the exact bytes Meta sent — re-serialising JSON
 * breaks it.
 */
export function metaSignatureMiddleware({ appSecret, logger }) {
  return function verifyMetaWebhook(req, res, next) {
    const result = verifyMetaSignature({ rawBody: req.rawBody, headers: req.headers, appSecret });

    if (!result.ok) {
      if (result.reason === 'app_secret_not_configured') {
        // Refusing to process unsigned events is the only safe default.
        logger?.error('META_APP_SECRET is not set — rejecting webhook. Set it to accept events.');
        return res.status(500).json({ success: false, error: { code: 'WEBHOOK_NOT_CONFIGURED' } });
      }
      logger?.warn(`Rejected Meta webhook: ${result.reason}`);
      return res.status(401).json({ success: false, error: { code: 'INVALID_SIGNATURE' } });
    }
    return next();
  };
}
