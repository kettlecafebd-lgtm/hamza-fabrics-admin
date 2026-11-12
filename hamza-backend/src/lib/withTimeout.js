/**
 * Bounds a promise so a slow/hanging dependency cannot hold a request open.
 *
 * The media proxy is fetched by <img> tags. If Postgres or DNS stalls, the
 * browser keeps the connection (and a worker) busy for the whole timeout. We
 * would rather answer 404 in 2s and let the inbox retry/refresh.
 */
export function withTimeout(promise, ms, label = 'operation') {
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve(promise);

  let timer;
  const timeout = new Promise((_resolve, reject) => {
    // Deliberately NOT unref()'d: an unref'd timer lets the event loop exit
    // before the race resolves in short-lived processes (tests, CLI scripts).
    // clearTimeout in finally() guarantees the timer does not leak.
    timer = setTimeout(() => {
      const error = new Error(`${label} timed out after ${ms}ms`);
      error.code = 'ETIMEDOUT';
      error.timeout = true;
      reject(error);
    }, ms);
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

/**
 * Like withTimeout, but a timeout produces a fallback value instead of a
 * rejection. Use this where a slow dependency should degrade silently.
 */
export async function withTimeoutFallback(promise, ms, fallback, label = 'operation') {
  try {
    return await withTimeout(promise, ms, label);
  } catch (error) {
    if (error?.timeout) return typeof fallback === 'function' ? fallback(error) : fallback;
    throw error; // genuine errors are the caller's business
  }
}

export default withTimeout;
