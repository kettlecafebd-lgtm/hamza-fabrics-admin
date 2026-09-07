import API_BASE_URL from '../config/api';

/**
 * Auth-aware fetch wrapper for Module V (HttpOnly cookies).
 *
 * Sends credentials: 'include' so HttpOnly cookies are sent automatically.
 * During migration, also sends Authorization header from localStorage as fallback.
 * On 401: clears all stored tokens and redirects to login.
 *
 * Usage:
 *   import { authFetch } from '../lib/authFetch';
 *   const res = await authFetch('/api/orders');
 */
export async function authFetch(url, options = {}) {
  // Backward compat: still send header from localStorage during migration
  const token = localStorage.getItem('adminToken') || localStorage.getItem('customerToken');

  const headers = new Headers(options.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
    credentials: 'include', // CRITICAL: sends HttpOnly cookies
  });

  // On 401, clear tokens and redirect to login
  if (response.status === 401) {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerData');
    window.location.href = '/login';
    throw new Error('Session expired. Redirecting to login.');
  }

  return response;
}

/**
 * Auth-aware fetch that always includes credentials.
 * Use for simple GET/POST where you don't need backward compat header logic.
 */
export async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  return response;
}

/**
 * Generate a simple browser fingerprint for device trust decisions.
 * Module U: Staff 2FA device fingerprinting.
 */
export function getBrowserFingerprint() {
  const raw = [
    navigator.userAgent,
    `${screen.width}x${screen.height}`,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    navigator.platform,
  ].join('|');

  // Simple hash (not cryptographic — this is a heuristic)
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
