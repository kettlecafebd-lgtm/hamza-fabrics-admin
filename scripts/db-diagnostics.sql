-- ============================================================================
--  HAMZA FABRICS — SUPABASE / POSTGRES DISK-EMERGENCY DIAGNOSTIC
-- ============================================================================
--  Context: database is at 492 MB / 500 MB (98 %). Treat this as an outage
--           waiting to happen — once the limit is hit, INSERTs fail hard.
--
--  HOW TO RUN
--    Supabase Dashboard -> SQL Editor -> paste ONE section at a time.
--    Read-only: every section below only SELECTs. The only writes are into
--    temporary tables (auto-dropped when your SQL-editor session ends) and,
--    in section 5, an optional read-only extension.
--    Estimated total runtime on a 492 MB database: 1-3 minutes.
--
--  WHAT TO LOOK AT FIRST (in order)
--    1. Section 2  -> which tables hold the bytes
--    2. Section 5  -> which COLUMNS hold the bytes (base64 / JSON blobs)
--    3. Section 12 -> write rate: what is still INSERTing today
--    4. Section 9  -> unused + duplicate indexes (free space with no behaviour
--                     change, and no data deleted)
--    5. Section 15 -> dead tuples / vacuum candidates
--
--  ORDER OF OPERATIONS THAT WILL ACTUALLY RECLAIM SPACE
--    a) DROP unused indexes            (instant, zero data loss, zero lock)
--    b) Add retention + delete rows    (space is reusable, not yet returned)
--    c) VACUUM (ANALYZE)               (frees inside the table for reuse)
--    d) pg_repack / VACUUM FULL        (returns space to the OS — see §15
--                                       warnings; needs free headroom you may
--                                       not have at 492/500 MB)
-- ============================================================================


-- ============================================================================
-- 1. OVERVIEW
-- ============================================================================
select
  current_database()                                        as database,
  current_user                                              as run_as,
  current_setting('server_version')                         as pg_version,
  pg_size_pretty(pg_database_size(current_database()))      as db_size,
  round(100.0 * pg_database_size(current_database())
        / (500::numeric * 1024 * 1024), 2)                    as pct_of_500mb_plan,
  pg_size_pretty(greatest(500::bigint * 1024 * 1024
                          - pg_database_size(current_database()), 0))
                                                            as headroom_to_500mb,
  (select stats_reset from pg_stat_database where datname = current_database())
                                                            as stats_last_reset;
-- NOTE: "stats_last_reset" matters — unused-index and dead-tuple numbers below
-- are counted since that timestamp. If it was minutes ago, wait a day before
-- trusting idx_scan = 0.


-- ============================================================================
-- 2. TOP 10 LARGEST TABLES  (heap + TOAST + indexes)
-- ============================================================================
select
  n.nspname                                                   as schema,
  c.relname                                                   as table_name,
  pg_size_pretty(pg_total_relation_size(c.oid))               as total_size,
  pg_total_relation_size(c.oid)                               as total_bytes,
  pg_size_pretty(pg_relation_size(c.oid))                     as heap_size,
  pg_size_pretty(pg_indexes_size(c.oid))                      as index_size,
  pg_size_pretty(
    case when c.reltoastrelid <> 0
         then pg_total_relation_size(c.reltoastrelid) else 0 end
  )                                                           as toast_size,
  c.reltuples::bigint                                         as est_rows,
  round(100.0 * pg_total_relation_size(c.oid)
        / nullif(pg_database_size(current_database()), 0), 1) as pct_of_db
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'm')                                 -- tables + matviews
  and n.nspname not in ('pg_catalog', 'information_schema')
  and n.nspname not like 'pg_toast%'
  and n.nspname not like 'pg_temp%'
order by pg_total_relation_size(c.oid) desc
limit 10;


-- ============================================================================
-- 3. LARGEST INDIVIDUAL OBJECTS  (catch a single runaway index or TOAST)
-- ============================================================================
select
  n.nspname || '.' || c.relname                               as object,
  case c.relkind
    when 'r' then 'table'
    when 'i' then 'index'
    when 't' then 'toast'
    when 'm' then 'matview'
    else c.relkind::text
  end                                                         as kind,
  pg_size_pretty(pg_relation_size(c.oid))                     as size,
  pg_relation_size(c.oid)                                     as bytes
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'i', 't', 'm')
  and n.nspname not in ('pg_catalog', 'information_schema')
order by pg_relation_size(c.oid) desc
limit 15;


-- ============================================================================
-- 4. SUPABASE-MANAGED SCHEMAS  (auth / storage / realtime / cron)
--    These are frequently the real culprit and are invisible in the list above
--    if you only look at `public`.
-- ============================================================================
select
  n.nspname                                                   as schema,
  sum(pg_total_relation_size(c.oid))                          as bytes,
  pg_size_pretty(sum(pg_total_relation_size(c.oid)))          as size,
  count(*)                                                    as relations
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'm')
  and n.nspname in ('auth', 'storage', 'realtime', 'cron', 'extensions',
                    'supabase_functions', 'vault', 'graphql', 'pgsodium')
group by n.nspname
order by sum(pg_total_relation_size(c.oid)) desc;

-- Row counts for the tables that most often bloat in Supabase projects.
-- `auth.sessions` / `auth.refresh_tokens` grow with every login and are only
-- cleaned by GoTrue's own sweeper — a broken client that logs in in a loop can
-- add tens of thousands of rows.
select 'auth.users'              as tbl, count(*) from auth.users
union all select 'auth.sessions',          count(*) from auth.sessions
union all select 'auth.refresh_tokens',    count(*) from auth.refresh_tokens
union all select 'auth.audit_log_entries', count(*) from auth.audit_log_entries
union all select 'auth.instances',         count(*) from auth.instances
order by 1;


-- ============================================================================
-- 5. WHICH COLUMNS HOLD THE BYTES  *** most useful section ***
--    Scans every text/json/jsonb/bytea column in `public` and totals the real
--    stored size of its contents.
--
--    Two different numbers, both useful (verified on PG 16):
--      physical_bytes = sum(pg_column_size(col))
--          what the value actually costs on disk. A 3 MB run of repeated text
--          measured 34 KB compressed. Base64 of a JPEG/PNG does NOT compress,
--          so for real images this equals the logical size — the worst case.
--      logical_bytes  = sum(octet_length(col::text))
--          what the app holds in memory and what you transfer over the wire
--          (relevant to the egress audit). Always the full 3 MB.
--    A large gap between physical and logical means "compressed, but still
--    expensive to read"; no gap means "paying for every byte twice".
-- ============================================================================
drop table if exists _col_sizes;
create temp table _col_sizes (
  schema_name text, table_name text, column_name text, rows_nonnull bigint,
  physical_bytes bigint, logical_bytes bigint
);

do $$
declare
  r record;
  v_phys  bigint;
  v_logic bigint;
  v_rows  bigint;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name,
           a.attname as column_name, a.atttypid as typ
    from pg_attribute a
    join pg_class c     on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r'
      and n.nspname = 'public'
      and a.attnum > 0
      and not a.attisdropped
      and a.atttypid in ('text'::regtype, 'varchar'::regtype, 'json'::regtype,
                         'jsonb'::regtype, 'bytea'::regtype)
  loop
    begin
      if r.typ = 'bytea'::regtype then
        execute format(
          'select coalesce(sum(pg_column_size(%I)),0)::bigint,
                  coalesce(sum(octet_length(%I)),0)::bigint,
                  count(%I)::bigint
             from %I.%I',
          r.column_name, r.column_name, r.column_name,
          r.schema_name, r.table_name
        ) into v_phys, v_logic, v_rows;
      else
        execute format(
          'select coalesce(sum(pg_column_size(%I)),0)::bigint,
                  coalesce(sum(octet_length(%I::text)),0)::bigint,
                  count(%I)::bigint
             from %I.%I',
          r.column_name, r.column_name, r.column_name,
          r.schema_name, r.table_name
        ) into v_phys, v_logic, v_rows;
      end if;

      if coalesce(v_phys, 0) > 0 then
        insert into _col_sizes
        values (r.schema_name, r.table_name, r.column_name, v_rows, v_phys, v_logic);
      end if;
    exception when others then
      raise notice 'skipped %.%.% -> %', r.schema_name, r.table_name, r.column_name, sqlerrm;
    end;
  end loop;
end $$;

select
  table_name,
  column_name,
  rows_nonnull,
  pg_size_pretty(physical_bytes)                                as on_disk,
  pg_size_pretty(logical_bytes)                                 as logical,
  physical_bytes,
  round(physical_bytes::numeric / nullif(rows_nonnull, 0))      as avg_bytes_per_row
from _col_sizes
order by physical_bytes desc
limit 25;


-- ============================================================================
-- 6. BASE64 / DATA-URI / INLINE-FILE DETECTION
--    Finds the classic "we stored the image as text" disaster.
-- ============================================================================
drop table if exists _b64_hits;
create temp table _b64_hits (
  table_name text, column_name text, hits bigint, bytes bigint
);

do $$
declare
  r record;
  v_hits bigint;
  v_bytes bigint;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name,
           a.attname as column_name
    from pg_attribute a
    join pg_class c     on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r'
      and n.nspname = 'public'
      and a.attnum > 0
      and not a.attisdropped
      and a.atttypid in ('text'::regtype, 'varchar'::regtype,
                         'json'::regtype, 'jsonb'::regtype)
  loop
    begin
      execute format(
        'select count(*)::bigint, coalesce(sum(octet_length(%I::text)),0)::bigint
           from %I.%I
          where %I::text like %L or %I::text like %L',
        r.column_name, r.schema_name, r.table_name,
        r.column_name, 'data:%',
        r.column_name, '%base64,%'
      ) into v_hits, v_bytes;

      if v_hits > 0 then
        insert into _b64_hits values (r.table_name, r.column_name, v_hits, v_bytes);
      end if;
    exception when others then null;
    end;
  end loop;
end $$;

select table_name, column_name, hits, pg_size_pretty(bytes) as bytes
from _b64_hits
order by bytes desc;
-- Expect: empty set. Anything here is the single fastest thing you can fix.


-- ============================================================================
-- 7. BIGGEST INDIVIDUAL ROWS
--    Point this at the top tables from section 2 (edit the table name).
--    Uses logical size, so TOASTed values are counted in full.
-- ============================================================================
select
  ctid,
  pg_size_pretty(octet_length(t::text)::bigint) as row_logical_size,
  octet_length(t::text)                          as row_bytes
from public.orders t
order by octet_length(t::text) desc
limit 20;

-- Same for jsonb columns specifically, to see whether line items dominate:
-- select id, pg_size_pretty(octet_length(products::text)::bigint) as products_bytes
-- from public.orders order by octet_length(products::text) desc limit 20;


-- ============================================================================
-- 8. REAL FREE SPACE PER TABLE  (pgstattuple — the accurate bloat measure)
--    'free_space' + 'dead_tuple_len' is what a rewrite would give back.
--    If pgstattuple cannot be installed, §15 still gives a dead-tuple estimate.
-- ============================================================================
do $$
declare
  r record;
  v_free  bigint;
  v_dead  bigint;
  v_len   bigint;
begin
  begin
    execute 'create extension if not exists pgstattuple';
    raise notice 'pgstattuple: enabled';
  exception when others then
    raise notice 'pgstattuple unavailable (%); skipping precise bloat scan', sqlerrm;
    return;
  end;

  raise notice '%-26s %-10s %-10s %-10s %-8s', 'table', 'heap', 'dead', 'free', 'free%';
  for r in
    select c.relname, pg_relation_size(c.oid) as heap_bytes
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname = 'public'
      and c.reltuples >= 0
    order by pg_relation_size(c.oid) desc
    limit 10
  loop
    begin
      execute format('select table_len, dead_tuple_len, free_space from pgstattuple(%L)',
                     'public.' || r.relname)
        into v_len, v_dead, v_free;

      raise notice '%-26s %-10s %-10s %-10s %-8s',
        r.relname,
        pg_size_pretty(v_len),
        pg_size_pretty(v_dead),
        pg_size_pretty(v_free),
        round(100.0 * v_free / nullif(v_len, 0), 1);
    exception when others then
      raise notice '%-26s %-10s (scan failed: %)', r.relname, pg_size_pretty(r.heap_bytes), sqlerrm;
    end;
  end loop;
end $$;
-- Results appear in the Messages/Notices pane.
-- Rule of thumb: free% > 20 % and the table is a hot UPDATE target -> the
-- autovacuum thresholds are too lax for this workload; tune per-table:
--   alter table public.orders set (autovacuum_vacuum_scale_factor = 0.05,
--                                  autovacuum_analyze_scale_factor = 0.02);


-- ============================================================================
-- 9. UNUSED INDEXES  (free space, zero risk — but verify stats age first)
-- ============================================================================
select
  s.schemaname                                                as schema,
  s.relname                                                   as table_name,
  s.indexrelname                                              as index_name,
  pg_size_pretty(pg_relation_size(s.indexrelid))              as index_size,
  pg_relation_size(s.indexrelid)                              as bytes,
  s.idx_scan                                                  as times_used,
  pg_get_indexdef(s.indexrelid)                               as definition,
  format('drop index concurrently if exists %I.%I;', s.schemaname, s.indexrelname)
                                                              as suggested_command
from pg_stat_user_indexes s
join pg_index i on i.indexrelid = s.indexrelid
where s.idx_scan = 0                       -- never used since stats reset
  and not i.indisprimary                   -- never drop a PK
  and not i.indisunique                    -- unique indexes enforce correctness
  and not i.indisreplident                 -- needed by logical replication
  and not exists (                         -- do not drop constraint-backing indexes
        select 1 from pg_constraint con where con.conindid = s.indexrelid
      )
order by pg_relation_size(s.indexrelid) desc;
-- SAFETY: `drop index concurrently` does not block writes. Double-check any
-- index that supports a foreign-key's *referencing* side before dropping —
-- Postgres will not warn you that FK checks are getting slower.


-- ============================================================================
-- 10. DUPLICATE INDEXES  (identical column set on the same table)
-- ============================================================================
with idx as (
  select
    i.indrelid,
    i.indexrelid,
    c.relname                                                as table_name,
    ic.relname                                               as index_name,
    i.indkey::text                                           as cols,
    i.indclass::text                                         as opclasses,
    (i.indpred is not null)                                  as is_partial,
    (i.indexprs is not null)                                 as is_expression,
    i.indisunique                                            as is_unique,
    pg_relation_size(i.indexrelid)                           as bytes,
    pg_get_indexdef(i.indexrelid)                            as definition
  from pg_index i
  join pg_class c    on c.oid  = i.indrelid
  join pg_class ic   on ic.oid = i.indexrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
)
select
  a.table_name,
  a.index_name                                               as index_a,
  b.index_name                                               as index_b,
  pg_size_pretty(a.bytes)                                    as size_a,
  pg_size_pretty(b.bytes)                                    as size_b,
  a.definition,
  b.definition
from idx a
join idx b
  on  a.indrelid = b.indrelid
  and a.indexrelid < b.indexrelid          -- report each pair once
where a.cols      = b.cols
  and a.opclasses = b.opclasses
  and a.is_partial = false and b.is_partial = false
  and a.is_expression = false and b.is_expression = false
order by a.bytes + b.bytes desc;


-- ============================================================================
-- 11. REDUNDANT PREFIX INDEXES
--     (a, b) makes a plain (a) index redundant. Very common after years of
--     "just add an index" — this is the most underrated source of bloat.
-- ============================================================================
with idx as (
  select
    i.indrelid,
    ic.relname                                               as index_name,
    c.relname                                                as table_name,
    (i.indkey::int2[])[0:array_length(i.indkey::int2[], 1)]  as col_arr,
    i.indpred is not null                                    as is_partial,
    pg_relation_size(i.indexrelid)                           as bytes,
    pg_get_indexdef(i.indexrelid)                            as definition
  from pg_index i
  join pg_class c     on c.oid  = i.indrelid
  join pg_class ic    on ic.oid = i.indexrelid
  join pg_namespace n on n.oid  = c.relnamespace
  where n.nspname = 'public'
    and not i.indisprimary
    and i.indexprs is null
)
select
  p.table_name,
  p.index_name                                               as redundant_index,
  pg_size_pretty(p.bytes)                                    as wasted_size,
  u.index_name                                               as covered_by,
  format('-- verify, then: drop index concurrently %I;', p.index_name) as action
from idx p
join idx u
  on  p.indrelid = u.indrelid
  and p.index_name <> u.index_name
  and not p.is_partial and not u.is_partial
  and array_length(p.col_arr, 1) < array_length(u.col_arr, 1)
  and (u.col_arr)[1:array_length(p.col_arr, 1)] = (p.col_arr)[1:array_length(p.col_arr, 1)]
where p.table_name is not null
order by p.bytes desc;
-- Only act when the covering index is a plain btree on the same operator class.


-- ============================================================================
-- 12. WRITE RATE — "what is still inserting rows?"  (answers Q2 directly)
--     Counted since stats_last_reset (section 1).
-- ============================================================================
select
  schemaname                                                  as schema,
  relname                                                     as table_name,
  n_tup_ins                                                   as rows_inserted,
  n_tup_upd                                                   as rows_updated,
  n_tup_del                                                   as rows_deleted,
  n_live_tup                                                  as live_rows,
  n_dead_tup                                                  as dead_rows,
  pg_size_pretty(pg_total_relation_size(relid))               as total_size,
  last_autovacuum,
  last_autoanalyze
from pg_stat_user_tables
order by n_tup_ins desc
limit 20;
-- A table with high n_tup_ins and no DELETE path is your unbounded collector.
-- Cross-reference with DB_AUDIT.md §2 for the endpoints that write to it.


-- ============================================================================
-- 13. RETENTION PROFILE — how old is the data in the biggest tables?
--     Edit the table/column list to match your schema, then look for a clean
--     cut-off (e.g. everything older than 12 months is cold).
-- ============================================================================
-- Template — run once per candidate table:
--   select date_trunc('month', created_at) as month,
--          count(*)                       as rows,
--          pg_size_pretty(sum(octet_length(t::text))::bigint) as logical_size
--   from public.orders t
--   group by 1 order by 1 desc limit 24;

-- Which candidate tables actually have a created_at to age off?
select
  c.relname                                                   as table_name,
  a.attname                                                   as ts_column,
  pg_size_pretty(pg_total_relation_size(c.oid))               as total_size
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
where c.relkind = 'r'
  and n.nspname = 'public'
  and a.atttypid in ('timestamptz'::regtype, 'timestamp'::regtype)
order by pg_total_relation_size(c.oid) desc;


-- ============================================================================
-- 14. HIDDEN CONSUMERS — replication slots, large objects, extensions
-- ============================================================================
-- 14a. Inactive replication slots retain WAL and can silently bloat the instance
select slot_name, plugin, slot_type, active, restart_lsn,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) as wal_retained
from pg_replication_slots;

-- 14b. Legacy large objects (lo_*) — bytes that are invisible to \dt
select
  count(*)                                                    as large_objects,
  pg_size_pretty(coalesce(sum(length(data)), 0)::bigint)       as total_data
from pg_largeobject;

-- 14c. Installed extensions (pg_cron presence decides §16)
select extname, extversion from pg_extension order by extname;


-- ============================================================================
-- 15. DEAD TUPLES / VACUUM CANDIDATES
-- ============================================================================
select
  schemaname                                                  as schema,
  relname                                                     as table_name,
  n_live_tup                                                  as live_rows,
  n_dead_tup                                                  as dead_rows,
  round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 1)
                                                              as dead_pct,
  pg_size_pretty(pg_total_relation_size(relid))               as total_size,
  pg_size_pretty(
    (pg_total_relation_size(relid)::numeric
     * n_dead_tup::numeric / nullif(n_live_tup + n_dead_tup, 0))::bigint
  )                                                           as reclaimable_estimate,
  last_vacuum,
  last_autovacuum,
  coalesce(last_autovacuum, last_vacuum)                      as last_vacuum_any
from pg_stat_user_tables
where n_dead_tup > 500
order by n_dead_tup desc
limit 25;

-- Generated commands, split by safety:
--   > 20 % dead AND < 200 MB  -> VACUUM (FULL) is safe enough to consider
--   > 20 % dead AND >= 200 MB -> use pg_repack, or VACUUM FULL only after
--                                freeing headroom (it needs ~1x table size free)
select
  relname                                                     as table_name,
  n_dead_tup,
  round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 1) as dead_pct,
  pg_size_pretty(pg_total_relation_size(relid))               as total_size,
  case
    when n_dead_tup > 0.2 * (n_live_tup + n_dead_tup)
     and pg_total_relation_size(relid) < 200 * 1024 * 1024
      then format('vacuum (full, analyze, verbose) %I;', relname)
    when n_dead_tup > 0.2 * (n_live_tup + n_dead_tup)
      then format('vacuum (analyze, verbose) %I;  -- then: pg_repack -t public.%I', relname, relname)
    else format('vacuum (analyze, verbose) %I;', relname)
  end                                                         as recommended
from pg_stat_user_tables
where n_dead_tup > 500
order by pg_total_relation_size(relid) * (n_dead_tup::numeric / nullif(n_live_tup + n_dead_tup, 0)) desc
limit 15;

-- ############################################################################
-- VACUUM WARNINGS — read before running anything below
-- ############################################################################
-- * VACUUM FULL takes an ACCESS EXCLUSIVE lock: the table is unreadable and
--   unwritable for the whole rewrite. On a live admin panel that is an outage.
-- * VACUUM FULL needs free disk equal to the table's new size. At 492/500 MB
--   you have ~8 MB. **VACUUM FULL will fail, or worse, fill the disk.** Free
--   space by deleting rows FIRST, then run plain VACUUM (no FULL) to make that
--   space reusable internally, and only then consider a rewrite.
-- * Prefer pg_repack (online, brief lock only), run from a machine with the
--   connection string — it needs ~2x the table size free too.
-- * VACUUM cannot run inside a transaction block; run each statement on its own.
-- * Check the toast tables too: VACUUM on the parent covers its TOAST.
-- ############################################################################


-- ============================================================================
-- 16. SCHEDULED JOBS  (only if pg_cron is installed — see §14c)
-- ============================================================================
-- select jobid, schedule, command, database, username, active
-- from cron.job order by jobid;

-- select jobid, status, return_message, start_time, end_time
-- from cron.job_run_details
-- order by start_time desc limit 50;
-- Failed jobs that retry in a loop are a classic silent row-generator.


-- ============================================================================
-- 17. EXPENSIVE STATEMENTS  (only if pg_stat_statements is enabled)
-- ============================================================================
-- select exists (select 1 from pg_extension where extname = 'pg_stat_statements')
--        as pg_stat_statements_installed;

-- select
--   left(query, 120)                                            as query,
--   calls,
--   rows,
--   round(total_exec_time::numeric, 1)                          as total_ms,
--   round(mean_exec_time::numeric, 2)                           as mean_ms,
--   pg_size_pretty((rows * 1024)::bigint)                       as approx_bytes_returned
-- from pg_stat_statements
-- order by rows desc
-- limit 25;
-- Sort by `rows` to find the query returning the most data (egress + memory),
-- then cross-reference with EGRESS_AUDIT.md.


-- ============================================================================
-- 18. SUPABASE STORAGE BUCKETS
--     Storage objects live in the DB's `storage` schema and count toward size.
--     Oversized originals are both DB size AND egress.
-- ============================================================================
select
  bucket_id,
  count(*)                                                    as objects,
  pg_size_pretty(sum((metadata->>'size')::numeric)::bigint)    as total_size,
  pg_size_pretty(avg((metadata->>'size')::numeric)::bigint)    as avg_size,
  pg_size_pretty(max((metadata->>'size')::numeric)::bigint)    as largest
from storage.objects
group by bucket_id
order by sum((metadata->>'size')::numeric) desc nulls last;


-- ============================================================================
-- 19. END OF DIAGNOSTIC
-- ============================================================================
-- Record the output of sections 2, 5, 9, 12 and 15 before changing anything —
-- they are your before/after baseline.
