-- Freelancers had no way to hand off the actual work: chat is text-only, and the same filter
-- that catches people trying to pay off-platform also redacts plain links, so even pasting a
-- Google Drive link gets blacked out. This adds a real (private) attachment to chat messages,
-- so a freelancer can deliver files the normal way instead of routing around the filter.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-attachments', 'chat-attachments', false, 20971520, array[
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf', 'application/zip', 'application/x-zip-compressed',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv'
])
on conflict (id) do update
  set public = false, file_size_limit = 20971520, allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf', 'application/zip', 'application/x-zip-compressed',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv'
  ];

-- Objects are stored as "<conversation_id>/<uuid>-<filename>", so the first path segment is the
-- conversation, and both policies below just check the caller is one of its two participants.
create policy "participants upload chat attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1] and auth.uid() in (c.client_id, c.freelancer_id)
    )
  );

create policy "participants read chat attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1] and auth.uid() in (c.client_id, c.freelancer_id)
    )
  );

-- A message is now text, a file, or both.
alter table public.messages add column file_path text;
alter table public.messages add column file_name text check (char_length(file_name) <= 255);
alter table public.messages add column file_size integer check (file_size > 0);
alter table public.messages add column file_mime text;

alter table public.messages drop constraint messages_body_check;
alter table public.messages add constraint messages_body_check check (char_length(body) <= 2000);
alter table public.messages add constraint messages_body_or_file check (char_length(body) > 0 or file_path is not null);
alter table public.messages add constraint messages_file_fields_together
  check ((file_path is null) = (file_name is null) and (file_path is null) = (file_size is null) and (file_path is null) = (file_mime is null));

-- The old 2-argument signature is a distinct function to Postgres; replace it outright so
-- callers resolve to exactly one send_message instead of two ambiguous overloads.
drop function public.send_message(uuid, text);

create function public.send_message(
  p_conversation_id uuid,
  p_body text,
  p_file_path text default null,
  p_file_name text default null,
  p_file_size integer default null,
  p_file_mime text default null
)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_clean text;
  v_next text;
  v_types text[] := '{}';
  v_msg public.messages;
  v_has_file boolean := p_file_path is not null;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if char_length(v_body) > 2000 then
    raise exception 'message must be at most 2000 characters' using errcode = '22023';
  end if;
  if not v_has_file and char_length(v_body) = 0 then
    raise exception 'message must be 1 to 2000 characters' using errcode = '22023';
  end if;
  if v_has_file and (p_file_name is null or p_file_size is null or p_file_mime is null) then
    raise exception 'file_name, file_size and file_mime are required with a file' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and v_uid in (c.client_id, c.freelancer_id)
  ) then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  -- The upload policy already scoped the object to this conversation's folder and to a
  -- participant; this just confirms the file is really there before the message points at it.
  if v_has_file and not exists (
    select 1 from storage.objects
    where bucket_id = 'chat-attachments' and name = p_file_path
      and (storage.foldername(name))[1] = p_conversation_id::text
  ) then
    raise exception 'file not found' using errcode = 'P0002';
  end if;

  v_clean := v_body;

  -- Email addresses.
  v_next := regexp_replace(v_clean, '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+', '███', 'g');
  if v_next <> v_clean then v_types := array_append(v_types, 'email'); v_clean := v_next; end if;

  -- Links, with or without a scheme.
  v_next := regexp_replace(v_clean, '(https?://|www\.)[^[:space:]]+', '███', 'gi');
  v_next := regexp_replace(v_next, '\y[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|in|net|org|io|me|co|app|link|ly|xyz)\y[^[:space:]]*', '███', 'gi');
  if v_next <> v_clean then v_types := array_append(v_types, 'link'); v_clean := v_next; end if;

  -- UPI IDs such as name@oksbi (anything with an @ left after emails are removed).
  v_next := regexp_replace(v_clean, '[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}', '███', 'g');
  if v_next <> v_clean then v_types := array_append(v_types, 'upi'); v_clean := v_next; end if;

  -- Indian mobile numbers, with spaces or dashes between digits and an optional +91.
  v_next := regexp_replace(v_clean, '(\+?91[[:space:]-]*)?[6-9]([[:space:]-]*[0-9]){9}', '███', 'g');
  if v_next <> v_clean then v_types := array_append(v_types, 'phone'); v_clean := v_next; end if;

  -- Asking to pay or talk outside the platform.
  v_next := regexp_replace(
    v_clean,
    '\y(pay me directly|pay directly|outside (the )?(app|platform)|off[- ]platform|gpay|google ?pay|phone ?pe|paytm|upi|bank transfer|bank account|account (number|no)|ifsc)\y',
    '███', 'gi');
  if v_next <> v_clean then v_types := array_append(v_types, 'payment'); v_clean := v_next; end if;

  v_next := regexp_replace(v_clean, '\y(whats ?app|telegram|call me|text me)\y', '███', 'gi');
  if v_next <> v_clean then v_types := array_append(v_types, 'contact'); v_clean := v_next; end if;

  insert into public.messages (conversation_id, sender_id, body, was_redacted, file_path, file_name, file_size, file_mime)
  values (p_conversation_id, v_uid, v_clean, cardinality(v_types) > 0, p_file_path, p_file_name, p_file_size, p_file_mime)
  returning * into v_msg;

  if cardinality(v_types) > 0 then
    insert into public.chat_violations (message_id, sender_id, violation_types, original_body)
    values (v_msg.id, v_uid, v_types, v_body);
  end if;

  update public.conversations set last_message_at = v_msg.created_at where id = p_conversation_id;
  return v_msg;
end;
$$;

revoke all on function public.send_message(uuid, text, text, text, integer, text) from public, anon;
grant execute on function public.send_message(uuid, text, text, text, integer, text) to authenticated;
