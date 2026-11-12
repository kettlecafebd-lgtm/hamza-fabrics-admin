/**
 * Bounded in-memory LRU cache for small binary payloads.
 *
 * Why this exists: WhatsApp media URLs expire in 5 minutes and require an
 * `Authorization` header, so they cannot be redirected to. The only way to
 * show the image is to fetch it ourselves — which is exactly how the 36 GB of
 * egress happened. Caching the resolved bytes for a bounded window means a
 * conversation re-rendered 50 times costs one upstream fetch, not 50.
 */
export class LruCache {
  constructor({ maxBytes = 32 * 1024 * 1024, maxEntries = 500 } = {}) {
    this.maxBytes = maxBytes;
    this.maxEntries = maxEntries;
    this.bytes = 0;
    this.map = new Map(); // insertion order == LRU order
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.delete(key);
      this.misses += 1;
      return null;
    }
    // Refresh recency.
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key, value, ttlMs) {
    if (!value || value.length > this.maxBytes) return false;
    this.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
    this.bytes += value.length;
    this.evict();
    return true;
  }

  delete(key) {
    const existing = this.map.get(key);
    if (!existing) return;
    this.bytes -= existing.value.length;
    this.map.delete(key);
  }

  evict() {
    while ((this.bytes > this.maxBytes || this.map.size > this.maxEntries) && this.map.size > 0) {
      const oldest = this.map.keys().next().value;
      this.delete(oldest);
    }
  }

  stats() {
    return {
      entries: this.map.size,
      bytes: this.bytes,
      maxBytes: this.maxBytes,
      hitRate: this.hits + this.misses === 0 ? 0 : this.hits / (this.hits + this.misses),
      hits: this.hits,
      misses: this.misses,
    };
  }
}

export default LruCache;
