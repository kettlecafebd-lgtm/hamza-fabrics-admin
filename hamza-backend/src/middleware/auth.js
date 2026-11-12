import { unauthorized } from '../lib/httpError.js';

/**
 * Admin authentication for inbox endpoints.
 *
 * The frontend sends `Authorization: Bearer <adminToken>` where adminToken is
 * issued by /api/auth/login (see src/lib/authFetch.js). This module verifies
 * it as a Supabase-issued JWT and requires an admin-ish role claim.
 *
 * Media proxying is deliberately NOT behind this middleware: <img> tags cannot
 * send headers. Those routes are protected by HMAC-signed, expiring URLs
 * instead (see lib/mediaSignature.js), which is the standard trade-off.
 */
export function createAuthMiddleware({ client, logger }) {
  return async function requireAdmin(req, res, next) {
    try {
      const header = req.headers.authorization || '';
      const [scheme, token] = header.split(' ');
      if (scheme !== 'Bearer' || !token) return next(unauthorized());

      const { data, error } = await client.auth.getUser(token);
      if (error || !data?.user) return next(unauthorized('Invalid or expired session.'));

      const role = data.user.app_metadata?.role || data.user.user_metadata?.role || 'user';
      if (!['admin', 'owner', 'manager', 'service_role'].includes(role)) {
        logger?.warn('Rejected non-admin inbox access', { userId: data.user.id, role });
        return next(unauthorized('Admin access required.'));
      }

      req.user = { id: data.user.id, email: data.user.email, role };
      return next();
    } catch (error) {
      logger?.error('auth middleware failure', error.message);
      return next(unauthorized('Authentication failed.'));
    }
  };
}

export default createAuthMiddleware;
