/**
 * Shared, single-flight cache for GET /api/settings/system.
 *
 * WHY: this payload was fetched independently by ThemeContext, Sidebar, Login
 * and the Settings page — 2 to 3 identical requests on every app boot, each one
 * a fresh (uncacheable) trip to the backend and therefore to the database.
 *
 * Contract:
 *   getSystemSettings()          -> cached / de-duplicated read
 *   getSystemSettings({ force: true }) -> bypass the cache (after a save)
 *   clearSystemSettings()        -> drop the cache
 *
 * The resolver never rejects: an offline backend must not break theming, the
 * sidebar or the login screen, so failures resolve to `{ success: false }`.
 */

import API_BASE_URL from '../config/api';

const TTL_MS = 5 * 60 * 1000;

let cached = null;      // { data, at }
let inflight = null;    // Promise

async function load() {
  const res = await fetch(`${API_BASE_URL}/api/settings/system`);
  const json = await res.json();
  return json && typeof json === 'object' ? json : { success: false };
}

export function getSystemSettings({ force = false } = {}) {
  const fresh = cached && Date.now() - cached.at < TTL_MS;
  if (!force && fresh) return Promise.resolve(cached.data);

  if (!inflight) {
    inflight = load()
      .then((data) => {
        if (data.success) cached = { data, at: Date.now() };
        return data;
      })
      .catch(() => ({ success: false }))
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function clearSystemSettings() {
  cached = null;
}

export default getSystemSettings;
