/**
 * Shared API Client for HamzaBI Frontend
 *
 * Replaces the duplicated fetch + auth + error handling pattern
 * found in 20+ page files. Centralizes:
 *   - Base URL configuration
 *   - Authorization headers
 *   - JSON content-type
 *   - Error handling (a failed call always throws, it never looks like "no data")
 *   - Expired login (401) -> back to the login page
 *   - Response parsing
 */

import API_BASE_URL from '../config/api';
import { getToken, clearAuth } from './auth';

/**
 * Make an authenticated API request
 *
 * @param {string} endpoint - API path (e.g., '/api/products')
 * @param {object} options - fetch options (method, body, etc.).
 *   `auth: false` sends no login token, for addresses the shop also calls without a login.
 * @returns {Promise<object>} Parsed JSON response
 * @throws {Error} with `.status` and `.data` when the server answers with an
 *   error status or with `{ success: false }`
 *
 * @example
 *   const data = await apiClient('/api/products');
 *   const result = await apiClient('/api/orders', { method: 'POST', body: { ... } });
 */
export const apiClient = async (endpoint, options = {}) => {
  const { method = 'GET', body, headers: customHeaders = {}, auth = true, ...rest } = options;

  const token = auth ? getToken() : '';

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...customHeaders,
  };

  // Only set Content-Type for non-FormData bodies
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    ...rest,
  }).catch((cause) => {
    throw new Error('Cannot reach the server. Check the connection and try again.', { cause });
  });

  // An empty answer is fine. An HTML page instead of JSON means a proxy or a wrong
  // address answered, not the API: `data` stays null and that counts as an error.
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }

  const loginExpired = auth && response.status === 401;
  if (loginExpired) {
    clearAuth();
    window.location.href = '/login';
  }

  if (!response.ok || !data || data.success === false) {
    const fallback =
      loginExpired ? 'Your login has expired. Please log in again.'
      : !response.ok ? `The server answered with error ${response.status}.`
      : data ? 'The server refused this request.'
      : 'The server sent an answer this page cannot read.';
    const error = new Error(data?.message || fallback);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export default apiClient;
