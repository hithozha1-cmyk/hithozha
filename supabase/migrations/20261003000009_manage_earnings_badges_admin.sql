-- My jobs (edit), earnings (payout tracking), tab badges (unread), and admin tools.

-- ---------------------------------------------------------------------------
-- 1. Posters can fix typos in a job, but only while no order is live.
-- ---------------------------------------------------------------------------
drop policy "posters update their own jobs" on public.jobs;
grant update (title, description, budget_min_paise, budget_max_paise) on public.jobs to authenticated;

create policy "posters edit jobs that have no live order"
  on public.jobs for update
  to authenticated
  using (
    client_id = auth.uid()
    and not exists (select 1 from public.orders o where o.job_id = jobs.id and o.status <> 'cancelled')
  )
  with check (client_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Payout tracking: when an admin has actually paid the freelancer.
-- ---------------------------------------------------------------------------
alter table public.payments add column paid_out_at timestamptz;
grant select (paid_out_at) on public.payments to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Unread messages and "needs your action" counts for the tab badges.
-- ---------------------------------------------------------------------------
create table public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_reads enable row level security;
revoke all on public.conversation_reads from anon, authenticated;

create function public.mark_conversation_read(p_conversation_id uuid)
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
end;
$$;

create function public.my_badges()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'messages', (
      select count(*)::int
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      left join public.conversation_reads r on r.conversation_id = c.id and r.user_id = auth.uid()
      where auth.uid() in (c.client_id, c.freelancer_id)
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(r.read_at, '-infinity'::timestamptz)
    ),
    'orders', (
      select count(*)::int
      from public.orders o
      where (o.client_id = auth.uid() and o.status in ('awaiting_payment', 'delivered'))
         or (o.freelancer_id = auth.uid() and o.status = 'in_progress')
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Admin tools. Every function checks is_admin() itself.
-- ---------------------------------------------------------------------------
create function public.admin_pending_companies()
returns table (id uuid, name text, gst_number text, udyam_number text, owner_name text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select c.id, c.name, c.gst_number, c.udyam_number, p.full_name, c.created_at
    from public.companies c
    join public.profiles p on p.id = c.owner_id
    where c.verification_status = 'pending'
    order by c.created_at;
end;
$$;

create function public.admin_set_company_verification(p_company uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_status not in ('verified', 'rejected') then raise exception 'status must be verified or rejected' using errcode = '22023'; end if;
  update public.companies set verification_status = p_status where id = p_company and verification_status = 'pending';
  get diagnostics v_updated = row_count;
  if v_updated = 0 then raise exception 'no pending company' using errcode = 'P0002'; end if;
end;
$$;

create function public.admin_flagged_messages()
returns table (id uuid, conversation_id uuid, sender_name text, violation_types text[], original_body text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select v.id, m.conversation_id, p.full_name, v.violation_types, v.original_body, v.created_at
    from public.chat_violations v
    join public.messages m on m.id = v.message_id
    join public.profiles p on p.id = v.sender_id
    order by v.created_at desc
    limit 50;
end;
$$;

create function public.admin_payouts_due()
returns table (order_id uuid, title text, freelancer_name text, earnings_paise integer, completed_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select o.id, o.title, p.full_name, o.freelancer_earnings_paise, o.completed_at
    from public.orders o
    join public.payments pay on pay.order_id = o.id and pay.status = 'released' and pay.paid_out_at is null
    join public.profiles p on p.id = o.freelancer_id
    order by o.completed_at;
end;
$$;

create function public.admin_mark_paid_out(p_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.payments set paid_out_at = now() where order_id = p_order and status = 'released' and paid_out_at is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then raise exception 'nothing to pay out' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
revoke all on function public.my_badges() from public, anon;
revoke all on function public.admin_pending_companies() from public, anon;
revoke all on function public.admin_set_company_verification(uuid, text) from public, anon;
revoke all on function public.admin_flagged_messages() from public, anon;
revoke all on function public.admin_payouts_due() from public, anon;
revoke all on function public.admin_mark_paid_out(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.my_badges() to authenticated;
grant execute on function public.admin_pending_companies() to authenticated;
grant execute on function public.admin_set_company_verification(uuid, text) to authenticated;
grant execute on function public.admin_flagged_messages() to authenticated;
grant execute on function public.admin_payouts_due() to authenticated;
grant execute on function public.admin_mark_paid_out(uuid) to authenticated;
