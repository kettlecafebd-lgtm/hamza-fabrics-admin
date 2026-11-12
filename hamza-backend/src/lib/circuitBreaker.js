/**
 * Minimal circuit breaker.
 *
 * The media proxy must keep answering requests after `chat_media_blobs` has
 * been truncated or dropped. Without a breaker, every image request would pay
 * a round-trip to Postgres just to be told the relation does not exist.
 */
export function createCircuitBreaker({ name = 'circuit', cooldownMs = 60_000, now = Date.now } = {}) {
  let openUntil = 0;
  let lastReason = null;
  let openCount = 0;

  return {
    name,
    isOpen() {
      return now() < openUntil;
    },
    state() {
      return {
        name,
        open: this.isOpen(),
        opensInMs: Math.max(0, openUntil - now()),
        lastReason,
        openCount,
      };
    },
    trip(reason) {
      const wasOpen = this.isOpen();
      openUntil = now() + cooldownMs;
      lastReason = typeof reason === 'string' ? reason : reason?.message || 'unknown';
      if (!wasOpen) openCount += 1;
      return !wasOpen; // true when this call opened the breaker (caller logs once)
    },
    reset() {
      openUntil = 0;
      lastReason = null;
    },
  };
}

export default createCircuitBreaker;
