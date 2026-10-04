-- Chat notifications were going silent after the first message of a conversation. The inbox kept
-- only one unread "new message" per chat (so a busy chat does not flood it), but opening the chat
-- never marked that notification read, so every later message was skipped, and no push was sent.
--
-- Two fixes:
--   1. Opening a chat (mark_conversation_read) now also clears that chat's unread message notification.
--   2. A new message is skipped only when an unread one was sent in the last 2 minutes. A burst of
--      messages is one buzz; a message later on buzzes again, even if the first was never opened.

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and auth.uid() in (c.client_id, c.freelancer_id)
  ) then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  insert into public.conversation_reads (conversation_id, user_id, read_at)
  values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set read_at = now();

  update public.notifications
     set read_at = now()
   where user_id = auth.uid() and kind = 'message' and read_at is null
     and data ->> 'conversation_id' = p_conversation_id::text;
end;
$$;

create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations;
  v_to uuid;
begin
  select * into v_conv from public.conversations where id = new.conversation_id;
  v_to := case when new.sender_id = v_conv.client_id then v_conv.freelancer_id else v_conv.client_id end;
  if exists (
    select 1 from public.notifications
    where user_id = v_to and kind = 'message' and read_at is null
      and data ->> 'conversation_id' = new.conversation_id::text
      and created_at > now() - interval '2 minutes'
  ) then
    return null;
  end if;
  perform public.notify_user(v_to, 'message', jsonb_build_object(
    'conversation_id', new.conversation_id, 'name', (select full_name from public.profiles where id = new.sender_id)));
  return null;
end;
$$;
