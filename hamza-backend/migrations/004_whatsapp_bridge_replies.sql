-- Mirror a reply already sent on a QR-linked device. No sending, history
-- backfill, new threads, unread increments or changes to Cloud API credentials.
begin;

create or replace function public.record_whatsapp_bridge_reply(
  p_customer_ids text[], p_page_id text, p_message_id text,
  p_content text, p_created_at timestamptz
) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  thread_id public.conversations.id%type;
begin
  -- Serialize overlapping bridge deliveries to this thread before checking
  -- the ID. No global uniqueness assumption or cleanup of historical rows.
  begin
    select c.id into strict thread_id from public.conversations c
     where c.platform = 'whatsapp' and c.external_id = any(p_customer_ids)
       and c.page_id::text is not distinct from p_page_id
       for update;
  exception
    when no_data_found then return 'no_thread';
    when too_many_rows then return 'ambiguous';
  end;

  if exists (select 1 from public.chat_messages
              where conversation_id = thread_id and platform_message_id = p_message_id) then
    return 'duplicate';
  end if;

  insert into public.chat_messages
    (conversation_id, platform_message_id, direction, content, created_at, message_type)
  values (thread_id, p_message_id, 'outbound', p_content, p_created_at, 'text');

  -- A delayed device event belongs in history, not ahead of a newer preview.
  update public.conversations set last_message = p_content, last_message_at = p_created_at
   where id = thread_id and (last_message_at is null or last_message_at <= p_created_at);
  return 'stored';
end;
$$;

-- Supabase grants RPC execution broadly by default. Only the authenticated
-- backend handler may call this function with its server-side service role.
revoke all on function public.record_whatsapp_bridge_reply(text[], text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_whatsapp_bridge_reply(text[], text, text, text, timestamptz)
  to service_role;
commit;
