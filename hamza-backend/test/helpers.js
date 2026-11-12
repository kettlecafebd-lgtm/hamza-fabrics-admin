import { signMediaToken } from '../src/lib/mediaSignature.js';

/** Absolute-free proxy path, mirroring buildProxyUrl with an empty base. */
export function buildProxyUrlSafe(messageId, secret) {
  const token = signMediaToken({ messageId, exp: Math.floor(Date.now() / 1000) + 60 }, secret);
  return `/api/chat/media/s/${token}`;
}

/** Builds a fake Supabase-ish query builder for route tests. */
export function fakeSupabase({ messages = [], throwOn = {} } = {}) {
  const rows = [...messages];
  function query(table) {
    const state = { table, filters: [], limit: null, head: false };
    const builder = {
      select(_cols, opts = {}) { state.head = Boolean(opts.head); return builder; },
      eq(column, value) { state.filters.push([column, value]); return builder; },
      not() { return builder; },
      order() { return builder; },
      limit(n) { state.limit = n; return builder; },
      maybeSingle() { return resolveOne(); },
      single() { return resolveOne(); },
      then(onFulfilled, onRejected) { return resolveMany().then(onFulfilled, onRejected); },
    };

    const matches = () => rows.filter((row) => state.filters.every(([col, val]) => row[col] === val));

    function resolveOne() {
      if (throwOn[table]) return Promise.resolve({ data: null, error: throwOn[table] });
      return Promise.resolve({ data: matches()[0] || null, error: null });
    }
    function resolveMany() {
      if (throwOn[table]) return Promise.resolve({ data: null, error: throwOn[table] });
      const found = matches();
      return Promise.resolve({ data: state.limit ? found.slice(0, state.limit) : found, error: null });
    }

    return builder;
  }

  return {
    from: query,
    auth: { getUser: async () => ({ data: { user: { id: 'u1', app_metadata: { role: 'admin' } } }, error: null }) },
    _rows: rows,
  };
}
