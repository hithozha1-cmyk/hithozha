-- Disputes. Either person on a paid order can report a problem; the order freezes
-- (neither delivery nor approval works while it is 'disputed') until an admin decides:
-- refund the client, release to the freelancer, or split. Money moves outside the app,
-- so a refund needs the bank reference (UTR), like payouts.

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('awaiting_payment', 'in_progress', 'delivered', 'disputed', 'completed', 'cancelled'));

-- Part of the payment that went back to the client. fee + earnings + refunded = amount.
alter table public.orders add column refunded_paise integer not null default 0 check (refunded_paise >= 0);
alter table public.orders drop constraint orders_amounts_add_up;
alter table public.orders add constraint orders_amounts_add_up
  check (platform_fee_paise + freelancer_earnings_paise + refunded_paise = amount_paise);
grant select (refunded_paise) on public.orders to authenticated;

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  opened_by uuid not null references public.profiles (id),
  reason text not null check (char_length(reason) between 10 and 1000),
  previous_status text not null check (previous_status in ('in_progress', 'delivered')),
  status text not null default 'open' check (status in ('open', 'resolved', 'withdrawn')),
  resolution text check (resolution in ('refund', 'release', 'split')),
  refund_paise integer check (refund_paise >= 0),
  refund_reference text,
  decision_note text,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint disputes_resolved_has_decision check ((status = 'resolved') = (resolution is not null))
);

create unique index disputes_one_open_per_order on public.disputes (order_id) where status = 'open';
create index disputes_status_idx on public.disputes (status, created_at desc);

alter table public.disputes enable row level security;
revoke all on public.disputes from anon, authenticated;
grant select on public.disputes to authenticated;

create policy "participants read their disputes"
  on public.disputes for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and auth.uid() in (o.client_id, o.freelancer_id)));

-- ---------------------------------------------------------------------------
-- Opening and withdrawing
-- ---------------------------------------------------------------------------
create function public.open_dispute(p_order_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_order public.orders;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if char_length(v_reason) < 10 or char_length(v_reason) > 1000 then
    raise exception 'describe the problem in 10 to 1000 characters' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_uid not in (v_order.client_id, v_order.freelancer_id) then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.status not in ('in_progress', 'delivered') then
    raise exception 'only a paid order that is not finished can be disputed' using errcode = '55000';
  end if;

  insert into public.disputes (order_id, opened_by, reason, previous_status)
  values (v_order.id, v_uid, v_reason, v_order.status)
  returning id into v_id;
  update public.orders set status = 'disputed' where id = v_order.id;
  return v_id;
end;
$$;

-- The person who opened it can take it back while nobody has decided yet.
create function public.withdraw_dispute(p_dispute_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_dispute public.disputes;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_dispute from public.disputes where id = p_dispute_id for update;
  if not found or v_dispute.opened_by <> v_uid then
    raise exception 'dispute not found' using errcode = 'P0002';
  end if;
  if v_dispute.status <> 'open' then
    raise exception 'the dispute is already closed' using errcode = '55000';
  end if;
  update public.disputes set status = 'withdrawn' where id = v_dispute.id;
  update public.orders set status = v_dispute.previous_status where id = v_dispute.order_id and status = 'disputed';
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
create function public.admin_disputes(p_status text default 'open', p_limit integer default 30, p_offset integer default 0)
returns table (id uuid, order_id uuid, title text, client_name text, freelancer_name text, opened_by_name text,
               opened_by_role text, reason text, status text, resolution text, refund_paise integer, refund_reference text,
               decision_note text, amount_paise integer, platform_fee_paise integer, previous_status text,
               created_at timestamptz, resolved_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
    select d.id, o.id, o.title, cl.full_name, fr.full_name, ob.full_name,
           case when d.opened_by = o.client_id then 'client' else 'freelancer' end,
           d.reason, d.status, d.resolution, d.refund_paise, d.refund_reference, d.decision_note,
           o.amount_paise, o.platform_fee_paise, d.previous_status, d.created_at, d.resolved_at
    from public.disputes d
    join public.orders o on o.id = d.order_id
    join public.profiles cl on cl.id = o.client_id
    join public.profiles fr on fr.id = o.freelancer_id
    join public.profiles ob on ob.id = d.opened_by
    where p_status is null or d.status = p_status
    order by d.created_at desc
    limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

-- The conversation behind the order, so the admin can judge. Opening it is logged.
create function public.admin_dispute_messages(p_dispute_id uuid)
returns table (id uuid, sender_name text, sender_role text, body text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  if not exists (select 1 from public.disputes where disputes.id = p_dispute_id) then
    raise exception 'dispute not found' using errcode = 'P0002';
  end if;
  perform public.log_admin_action('view_dispute_chat', 'dispute', p_dispute_id::text);
  return query
    select m.id, p.full_name, case when m.sender_id = c.client_id then 'client' else 'freelancer' end, m.body, m.created_at
    from public.disputes d
    join public.orders o on o.id = d.order_id
    join public.conversations c on c.proposal_id = o.proposal_id
    join public.messages m on m.conversation_id = c.id
    join public.profiles p on p.id = m.sender_id
    where d.id = p_dispute_id
    order by m.created_at;
end;
$$;

-- refund: whole payment back to the client, order cancelled.
-- release: whole earnings to the freelancer, order completed.
-- split: p_refund_paise back to the client, the rest to the freelancer less the 5% fee.
create function public.admin_resolve_dispute(
  p_dispute_id uuid, p_resolution text, p_refund_paise integer, p_reference text, p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := btrim(coalesce(p_note, ''));
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
  v_dispute public.disputes;
  v_order public.orders;
  v_refund integer;
  v_rest integer;
  v_fee integer;
begin
  perform public.require_admin();
  if p_resolution not in ('refund', 'release', 'split') then
    raise exception 'resolution must be refund, release or split' using errcode = '22023';
  end if;
  if char_length(v_note) < 5 or char_length(v_note) > 500 then
    raise exception 'explain the decision in 5 to 500 characters' using errcode = '22023';
  end if;

  select * into v_dispute from public.disputes where id = p_dispute_id for update;
  if not found then raise exception 'dispute not found' using errcode = 'P0002'; end if;
  if v_dispute.status <> 'open' then raise exception 'the dispute is already closed' using errcode = '55000'; end if;
  select * into v_order from public.orders where id = v_dispute.order_id for update;

  v_refund := case p_resolution when 'refund' then v_order.amount_paise when 'release' then 0 else coalesce(p_refund_paise, 0) end;
  if p_resolution = 'split' and (v_refund < 1 or v_refund >= v_order.amount_paise) then
    raise exception 'a split refunds part of the payment, not all or none' using errcode = '22023';
  end if;
  if v_refund > 0 and (v_ref is null or v_ref !~ '^[A-Za-z0-9-]{6,40}$') then
    raise exception 'enter the bank reference (UTR) of the refund' using errcode = '22023';
  end if;
  if v_refund = 0 then v_ref := null; end if;

  v_rest := v_order.amount_paise - v_refund;
  v_fee := (v_rest::bigint * 500 + 5000) / 10000;

  if p_resolution = 'refund' then
    update public.orders
       set status = 'cancelled', refunded_paise = v_order.amount_paise, platform_fee_paise = 0, freelancer_earnings_paise = 0
     where id = v_order.id;
    update public.payments set status = 'refunded' where order_id = v_order.id and status = 'captured';
  else
    update public.orders
       set status = 'completed', completed_at = now(), refunded_paise = v_refund,
           platform_fee_paise = v_fee, freelancer_earnings_paise = v_rest - v_fee
     where id = v_order.id;
    update public.payments set status = 'released' where order_id = v_order.id and status = 'captured';
    update public.freelancer_profiles set completed_orders = completed_orders + 1 where user_id = v_order.freelancer_id;
  end if;

  update public.disputes
     set status = 'resolved', resolution = p_resolution, refund_paise = v_refund, refund_reference = v_ref,
         decision_note = v_note, resolved_by = auth.uid(), resolved_at = now()
   where id = v_dispute.id;

  perform public.log_admin_action('resolve_dispute', 'dispute', v_dispute.id::text,
    jsonb_build_object('resolution', p_resolution, 'refund_paise', v_refund, 'reference', v_ref, 'reason', v_note));
end;
$$;

-- The overview counts frozen orders as money still held, and open disputes as work for the admin.
create or replace function public.admin_stats()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today timestamptz := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  perform public.require_admin();
  return json_build_object(
    'signups_today', (select count(*)::int from public.profiles where created_at >= v_today),
    'users', (select count(*)::int from public.profiles),
    'freelancers', (select count(*)::int from public.profiles where role in ('freelancer', 'both')),
    'clients', (select count(*)::int from public.profiles where role in ('client', 'both')),
    'suspended', (select count(*)::int from public.profiles where suspended_at is not null),
    'jobs_open', (select count(*)::int from public.jobs where status = 'open'),
    'proposals_today', (select count(*)::int from public.proposals where created_at >= v_today),
    'orders_active', (select count(*)::int from public.orders where status in ('awaiting_payment', 'in_progress', 'delivered', 'disputed')),
    'orders_completed', (select count(*)::int from public.orders where status = 'completed'),
    'held_paise', (select coalesce(sum(amount_paise), 0)::bigint from public.orders where status in ('in_progress', 'delivered', 'disputed')),
    'paid_volume_paise', (select coalesce(sum(amount_paise - refunded_paise), 0)::bigint from public.orders where status in ('in_progress', 'delivered', 'disputed', 'completed')),
    'platform_fees_paise', (select coalesce(sum(platform_fee_paise), 0)::bigint from public.orders where status = 'completed'),
    'payouts_due_count', (select count(*)::int from public.payments where status = 'released' and paid_out_at is null),
    'payouts_due_paise', (
      select coalesce(sum(o.freelancer_earnings_paise), 0)::bigint
      from public.orders o
      join public.payments p on p.order_id = o.id and p.status = 'released' and p.paid_out_at is null
    ),
    'verifications_pending', (select count(*)::int from public.companies where verification_status = 'pending'),
    'flagged_week', (select count(*)::int from public.chat_violations where created_at > now() - interval '7 days'),
    'disputes_open', (select count(*)::int from public.disputes where status = 'open')
  );
end;
$$;

revoke all on function public.open_dispute(uuid, text) from public, anon;
revoke all on function public.withdraw_dispute(uuid) from public, anon;
revoke all on function public.admin_disputes(text, integer, integer) from public, anon;
revoke all on function public.admin_dispute_messages(uuid) from public, anon;
revoke all on function public.admin_resolve_dispute(uuid, text, integer, text, text) from public, anon;
grant execute on function public.open_dispute(uuid, text) to authenticated;
grant execute on function public.withdraw_dispute(uuid) to authenticated;
grant execute on function public.admin_disputes(text, integer, integer) to authenticated;
grant execute on function public.admin_dispute_messages(uuid) to authenticated;
grant execute on function public.admin_resolve_dispute(uuid, text, integer, text, text) to authenticated;
