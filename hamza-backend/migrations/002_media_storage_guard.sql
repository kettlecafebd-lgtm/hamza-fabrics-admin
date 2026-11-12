-- ============================================================================
-- 002_media_storage_guard.sql  (optional, defence in depth)
--
-- Prevents a future well-meaning commit from reintroducing binary media into
-- Postgres. Run AFTER 001 and after the blob table is gone.
-- ============================================================================

begin;

-- Any large column added to chat_* tables should be a red flag at review time.
-- This view makes the risk visible in monitoring instead of in a billing alert.
create or replace view public.chat_binary_storage_audit as
select
  c.relname                              as table_name,
  a.attname                              as column_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  pg_size_pretty(pg_total_relation_size(c.reltoastrelid)) as toast_size
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'chat\_%'
  and a.attname in ('data', 'payload', 'binary', 'bytes', 'base64', 'blob')
  and a.attnum > 0
  and not a.attisdropped;

comment on view public.chat_binary_storage_audit is
  'Should always return zero rows. A non-empty result means chat media is being stored as bytes again.';

commit;
