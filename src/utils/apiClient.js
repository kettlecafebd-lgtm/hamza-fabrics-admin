/**
 * Shared API Client for HamzaBI Frontend
 *
 * Replaces the duplicated fetch + auth + error handling pattern
 * found in 20+ page files. Centralizes:
 *   - Base URL configuration
 *   - Authorization headers
 *   - JSON content-type
 *   - Error handling
 *   - Response parsing
 */

import API_BASE_URL from '../config/api';
import { getToken } from './auth';

/**
 * Make an authenticated API request
 *
 * @param {string} endpoint - API path (e.g., '/api/products')
 * @param {object} options - fetch options (method, body, etc.)
 * @returns {Promise<object>} Parsed JSON response
 *
 * @example
 *   const data = await apiClient('/api/products');
 *   const result = await apiClient('/api/orders', { method: 'POST', body: { ... } });
 */
export const apiClient = async (endpoint, options = {}) => {
  const { method = 'GET', body, headers: customHeaders = {}, ...rest } = options;

  const token = getToken();

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
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || `API error: ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export default apiClient;
