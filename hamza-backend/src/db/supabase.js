import { createClient } from '@supabase/supabase-js';

export function createSupabase({ url, serviceRoleKey, logger }) {
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'hamza-backend' } },
  });

  /** Returns the table names PostgREST exposes, used to detect a dropped blob table. */
  async function tableExists(table) {
    const { error } = await client.from(table).select('id', { head: true, count: 'exact' }).limit(1);
    if (!error) return true;
    if (isMissingRelation(error)) return false;
    throw error;
  }

  return { client, tableExists, logger };
}

/**
 * PostgREST/Postgres errors that mean "this table isn't usable any more".
 * 42P01 = undefined_table, PGRST205 = table not in schema cache (dropped),
 * 42501 = permission denied (RLS grant revoked).
 */
export function isMissingRelation(error) {
  if (!error) return false;
  const code = error.code || '';
  const message = String(error.message || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === '42501' ||
    /relation .* does not exist/i.test(message) ||
    /could not find the table/i.test(message) ||
    /schema cache/i.test(message)
  );
}

export default createSupabase;
