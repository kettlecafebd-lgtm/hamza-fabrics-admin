-- 003_media_references.sql
--
-- Safety net for POST /api/media/delete (hamza-backend/src/routes/media.js).
--
-- WHY
-- ---
-- The admin frontend replaces and deletes product/hero images; the bytes live
-- in Supabase Storage and, until now, nothing ever removed them. Deleting on
-- the client's word alone is not acceptable: two products can share one photo
-- (same fabric, different colourway), and a client sweep cannot see uploads
-- made in another tab. The delete route therefore refuses to remove an object
-- unless this view proves *no row points at it*.
--
-- HOW IT STAYS SAFE
-- -----------------
-- 1. `media_storage_key(url)` normalises a public/render/signed Storage URL to
--    `<bucket>/<path>` — the same key the frontend computes. Query strings and
--    transforms are ignored, so `…/a.webp?width=96` matches `…/a.webp`.
-- 2. `media_references` is built only from tables that actually exist, so this
--    migration cannot fail on a schema that differs from the audit.
-- 3. Deletion stays OFF until `MEDIA_DELETE_ENABLED=true`. Verify the view
--    against the Storage dashboard first (see MEDIA_AUDIT.md §5.4).
--
-- EXTEND THIS VIEW
-- ----------------
-- A missing column is a leak (harmless), a missing *reference* is data loss.
-- Product review photos and hero/footer banners are stored inside JSON in some
-- deployments (the frontend reads `product.reviews`, `settings.hero_images`,
-- `settings.footer_images`). If that is your schema, add the JSON extraction to
-- `media_references_sql()` below and re-run this migration. Anything the view
-- cannot see will never be deleted — by design, but also never cleaned up.
--
-- VERIFY AFTER RUNNING
-- --------------------
--   select count(*) from public.media_references;
--   select * from public.media_references where storage_key is null limit 5;
--   -- spot-check one live image URL:
--   select public.media_storage_key('https://<project>.supabase.co/storage/v1/object/public/products/x.webp');

begin;

create or replace function public.media_storage_key(url text)
returns text
language sql
immutable
as $$
  select case
    when url is null then null
    when btrim(url) = '' then null
    when btrim(url) ~* '^(data|blob|javascript):' then null
    when btrim(url) ~* '/storage/v1/(object|render/image)/(public|sign|authenticated)/'
      then nullif(
        regexp_replace(
          regexp_replace(
            btrim(url),
            '^.*?/storage/v1/(object|render/image)/(public|sign|authenticated)/',
            ''
          ),
          '[?#].*$', ''
        ),
        ''
      )
    else nullif(
      regexp_replace(
        regexp_replace(
          regexp_replace(btrim(url), '[?#].*$', ''),
          '^[a-z]+://[^/]+/', ''
        ),
        '^/+', ''
      ),
      ''
    )
  end;
$$;

comment on function public.media_storage_key(text) is
  'Normalises a storage URL to <bucket>/<path> (or a relative path) for reference checks.';

-- Build a UNION ALL over whatever tables *and columns* this project has.
-- Checking the column as well as the table matters: a schema that drifted from
-- the audit must produce an empty view, never a migration error.
create or replace function public.media_has_column(p_table text, p_column text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = p_table
      and c.column_name = p_column
  );
$$;

create or replace function public.media_references_sql()
returns text
language plpgsql
stable
as $$
declare
  parts text[] := '{}';
begin
  if public.media_has_column('products', 'image_url') then
    parts := array_append(parts, 'select image_url as url from public.products where image_url is not null');
  elsif public.media_has_column('products', 'image') then
    parts := array_append(parts, 'select image as url from public.products where image is not null');
  end if;
  if public.media_has_column('product_variants', 'image_url') then
    parts := array_append(parts, 'select image_url as url from public.product_variants where image_url is not null');
  elsif public.media_has_column('product_variants', 'image') then
    parts := array_append(parts, 'select image as url from public.product_variants where image is not null');
  end if;
  if public.media_has_column('product_reviews', 'image_url') then
    parts := array_append(parts, 'select image_url as url from public.product_reviews where image_url is not null');
  elsif public.media_has_column('product_reviews', 'image') then
    parts := array_append(parts, 'select image as url from public.product_reviews where image is not null');
  end if;
  if public.media_has_column('profiles', 'avatar_url') then
    parts := array_append(parts, 'select avatar_url as url from public.profiles where avatar_url is not null');
  end if;

  if array_length(parts, 1) is null then
    return 'select null::text as url where false';
  end if;

  return array_to_string(parts, ' union all ');
end;
$$;

comment on function public.media_references_sql() is
  'SQL body for public.media_references; extend it when new URL-bearing columns appear.';
comment on function public.media_has_column(text, text) is
  'True when public.<table>.<column> exists; keeps this migration safe on drifted schemas.';

do $$
begin
  execute 'drop view if exists public.media_references';
  execute format(
    'create view public.media_references as
       select url, public.media_storage_key(url) as storage_key
       from (%s) refs
       where url is not null',
    public.media_references_sql()
  );
end;
$$;

comment on view public.media_references is
  'Every stored media URL the app knows about. POST /api/media/delete refuses any storage key listed here.';

-- The service-role key used by hamza-backend bypasses RLS; grant explicitly so
-- a future non-service role can still read the view. Guarded so this migration
-- also runs on a plain PostgreSQL instance that has no Supabase roles.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select on public.media_references to service_role';
  end if;
end;
$$;

commit;
