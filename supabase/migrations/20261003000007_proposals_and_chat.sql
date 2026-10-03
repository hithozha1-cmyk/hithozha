-- Phase 2b: proposals (freelancers apply to jobs) and chat (client and freelancer talk).

-- ---------------------------------------------------------------------------
-- Proposals
-- ---------------------------------------------------------------------------
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  -- Defaults to the caller and is not in the insert grant, so it cannot be spoofed.
  freelancer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  message text not null check (char_length(message) between 20 and 1000),
  -- Money is integer paise. Minimum is Rs 50.
  price_paise integer not null check (price_paise >= 5000 and price_paise <= 1000000000),
  delivery_days smallint not null check (delivery_days between 1 and 365),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, freelancer_id)
);

create index proposals_job_idx on public.proposals (job_id, created_at desc);
create index proposals_freelancer_idx on public.proposals (freelancer_id);

create trigger proposals_set_updated_at
  before update on public.proposals
  for each row execute function public.set_updated_at();

alter table public.proposals enable row level security;

-- Freelancers write the offer; they can later only withdraw it. Accepting and
-- rejecting go through functions (migration 0008).
revoke all on public.proposals from anon, authenticated;
grant select on public.proposals to authenticated;
grant insert (job_id, message, price_paise, delivery_days) on public.proposals to authenticated;
grant update (status) on public.proposals to authenticated;

create policy "proposals are visible to the freelancer and the job owner"
  on public.proposals for select
  to authenticated
  using (
    freelancer_id = auth.uid()
    or exists (select 1 from public.jobs j where j.id = job_id and j.client_id = auth.uid())
  );

create policy "freelancers send proposals to open jobs they do not own"
  on public.proposals for insert
  to authenticated
  with check (
    freelancer_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('freelancer', 'both')
    )
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.status = 'open' and j.client_id <> auth.uid()
    )
  );

create policy "freelancers withdraw their pending proposals"
  on public.proposals for update
  to authenticated
  using (freelancer_id = auth.uid() and status = 'pending')
  with check (freelancer_id = auth.uid() and status = 'withdrawn');

-- ---------------------------------------------------------------------------
-- Conversations: one per proposal, so a client can ask questions before hiring.
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null unique references public.proposals (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  freelancer_id uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create index conversations_client_idx on public.conversations (client_id, last_message_at desc nulls last);
create index conversations_freelancer_idx on public.conversations (freelancer_id, last_message_at desc nulls last);

alter table public.conversations enable row level security;

-- Read-only for participants; rows are created by the trigger below.
revoke all on public.conversations from anon, authenticated;
grant select on public.conversations to authenticated;

create policy "participants read their conversations"
  on public.conversations for select
  to authenticated
  using (auth.uid() in (client_id, freelancer_id));

create function public.create_conversation_for_proposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.conversations (proposal_id, job_id, client_id, freelancer_id)
  select new.id, new.job_id, j.client_id, new.freelancer_id
  from public.jobs j
  where j.id = new.job_id;
  return new;
end;
$$;

create trigger proposals_create_conversation
  after insert on public.proposals
  for each row execute function public.create_conversation_for_proposal();

-- ---------------------------------------------------------------------------
-- Messages. Clients cannot insert directly: send_message() scans every message
-- on the server first, so contact details and "pay me directly" are redacted.
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  was_redacted boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;

create policy "participants read messages"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.client_id, c.freelancer_id)
    )
  );

-- Every redaction is logged for the trust and safety team. No client access at all:
-- the original text is read with the service role or in the SQL editor.
create table public.chat_violations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  violation_types text[] not null,
  original_body text not null,
  created_at timestamptz not null default now()
);

create index chat_violations_sender_idx on public.chat_violations (sender_id, created_at desc);

alter table public.chat_violations enable row level security;
revoke all on public.chat_violations from anon, authenticated;

create function public.send_message(p_conversation_id uuid, p_body text)
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
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if char_length(v_body) = 0 or char_length(v_body) > 2000 then
    raise exception 'message must be 1 to 2000 characters' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and v_uid in (c.client_id, c.freelancer_id)
  ) then
    raise exception 'conversation not found' using errcode = 'P0002';
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

  insert into public.messages (conversation_id, sender_id, body, was_redacted)
  values (p_conversation_id, v_uid, v_clean, cardinality(v_types) > 0)
  returning * into v_msg;

  if cardinality(v_types) > 0 then
    insert into public.chat_violations (message_id, sender_id, violation_types, original_body)
    values (v_msg.id, v_uid, v_types, v_body);
  end if;

  update public.conversations set last_message_at = v_msg.created_at where id = p_conversation_id;
  return v_msg;
end;
$$;

revoke all on function public.send_message(uuid, text) from public, anon;
grant execute on function public.send_message(uuid, text) to authenticated;

-- New messages reach the app live. Supabase Realtime applies the select policy above.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;
