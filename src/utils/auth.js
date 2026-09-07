/**
 * Shared auth utilities for HamzaBI Frontend
 *
 * Replaces the duplicated `const getToken = () => localStorage.getItem('adminToken')`
 * pattern found in 20+ page/component files.
 */

const TOKEN_KEY = 'adminToken';

/**
 * Get the admin JWT token from localStorage
 * @returns {string} The admin token, or empty string if not found
 */
export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';

/**
 * Check if the user is authenticated (has a valid token)
 * @returns {boolean}
 */
export const isAuthenticated = () => !!localStorage.getItem(TOKEN_KEY);

/**
 * Get authorization headers for API calls
 * @returns {object} Headers object with Authorization bearer token
 */
export const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
});

/**
 * Get full headers for JSON API calls
 * @returns {object} Headers with Content-Type + Authorization
 */
export const jsonAuthHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});

/**
 * Clear auth token (logout)
 */
export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
};
