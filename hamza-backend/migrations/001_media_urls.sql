-- ============================================================================
-- 001_media_urls.sql
-- Retire chat_media_blobs: store Facebook CDN URLs on chat_messages instead.
--
-- Run order matters. Do NOT truncate/drop the blob table in this file — the
-- old rows are the only copy of pre-refactor media until you have verified
-- that the refresh endpoint can re-resolve them. See step 6.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns that replace the blob table.
-- ---------------------------------------------------------------------------
alter table public.chat_messages
  add column if not exists media_url         text,
  add column if not exists media_type        text,
  add column if not exists media_mime_type   text,
  add column if not exists media_id          text,
  add column if not exists media_source      text default 'webhook',
  add column if not exists media_refreshed_at timestamptz;

comment on column public.chat_messages.media_url is
  'Direct Facebook/Instagram CDN URL, or NULL for WhatsApp (resolved from media_id on read). Byte storage in Postgres is prohibited.';
comment on column public.chat_messages.media_id is
  'Platform attachment/media id. For WhatsApp this is the ONLY durable handle (URLs expire in 5 min).';

-- 'attachment' messages need a type even when media_url is null (WhatsApp).
update public.chat_messages
   set message_type = 'attachment'
 where message_type is null
   and (media_id is not null or media_type is not null);

-- ---------------------------------------------------------------------------
-- 2. Lookup indexes. The inbox and the refresh endpoint both hit these.
-- ---------------------------------------------------------------------------
create index if not exists idx_chat_messages_platform_message_id
  on public.chat_messages (platform_message_id);

create index if not exists idx_chat_messages_media_id
  on public.chat_messages (media_id)
  where media_id is not null;

create index if not exists idx_chat_messages_has_media
  on public.chat_messages (conversation_id, created_at desc)
  where media_url is not null or media_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Guard rail: nothing in this schema should ever hold a data URL again.
--    A CHECK constraint is cheaper than discovering 106 MB of TOAST later.
-- ---------------------------------------------------------------------------
alter table public.chat_messages
  drop constraint if exists chat_messages_media_url_not_blob;

alter table public.chat_messages
  add constraint chat_messages_media_url_not_blob
  check (media_url is null or media_url !~ '^data:');

-- ---------------------------------------------------------------------------
-- 4. Backfill: recover whatever metadata the blob table still has, WITHOUT
--    reading the binary column. Selecting `data` here would pull another
--    106 MB into the replica; only the pointer columns are read.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'chat_media_blobs'
  ) then
    update public.chat_messages m
       set media_url    = coalesce(m.media_url, b.media_url),
           media_mime_type = coalesce(m.media_mime_type, b.mime_type),
           media_source = 'legacy_blob'
      from public.chat_media_blobs b
     where b.message_id = m.id
       and m.media_url is null
       and b.media_url is not null;
    raise notice 'Backfilled media_url from chat_media_blobs pointers.';
  else
    raise notice 'chat_media_blobs already absent - nothing to backfill.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Trim the blob table in batches so autovacuum can keep up with WAL.
--    COMMENT THIS OUT on the first run if you want to keep a full backup.
-- ---------------------------------------------------------------------------
-- delete from public.chat_media_blobs where id in (
--   select id from public.chat_media_blobs order by message_id limit 500
-- );

commit;

-- ---------------------------------------------------------------------------
-- 6. RECLAIM (run manually, outside a transaction, after verification):
--
--      -- once the inbox shows no broken media:
--      truncate table public.chat_media_blobs;
--      -- or retire it entirely:
--      drop table public.chat_media_blobs;
--
--    Then reclaim the disk (TOAST is not returned to the OS by TRUNCATE alone
--    if the table survives):
--      vacuum full public.chat_media_blobs;
--
--    Verify the win:
--      select pg_size_pretty(pg_total_relation_size('public.chat_media_blobs'));
--
-- The backend tolerates every one of these states: missing table, truncated
-- table, revoked grants. Media proxy returns 404 and the inbox falls back to
-- the message text (see src/services/legacyBlobStore.js).
-- ---------------------------------------------------------------------------
