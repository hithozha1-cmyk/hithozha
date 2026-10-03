-- Phase 2c: orders, escrow payments and reviews.
--
-- Escrow model: the client pays the full price into the platform's Razorpay
-- account (money is "held"). When the client approves the delivered work the
-- payment is marked released and the freelancer's earnings (price minus the 5%
-- platform fee) become payable. Paying the freelancer out is done outside the
-- app for now.

-- ---------------------------------------------------------------------------
-- Orders. Nobody writes to this table directly: every change goes through the
-- functions below, which check who is allowed to do what and in which state.
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id),
  job_id uuid not null references public.jobs (id),
  client_id uuid not null references public.profiles (id),
  freelancer_id uuid not null references public.profiles (id),
  company_id uuid references public.companies (id) on delete set null,
  -- Snapshot of the job title, so the order still reads well if the job changes.
  title text not null,
  -- Money is integer paise. The client pays amount_paise; the freelancer receives
  -- freelancer_earnings_paise; the platform keeps platform_fee_paise (5%).
  amount_paise integer not null check (amount_paise > 0),
  platform_fee_paise integer not null check (platform_fee_paise >= 0),
  freelancer_earnings_paise integer not null check (freelancer_earnings_paise >= 0),
  delivery_days smallint not null,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'in_progress', 'delivered', 'completed', 'cancelled')),
  delivered_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_amounts_add_up check (platform_fee_paise + freelancer_earnings_paise = amount_paise)
);

-- A job has at most one live order, and so does a proposal. Cancelled ones do not count.
create unique index orders_one_live_per_job on public.orders (job_id) where status <> 'cancelled';
create unique index orders_one_live_per_proposal on public.orders (proposal_id) where status <> 'cancelled';
create index orders_client_idx on public.orders (client_id, created_at desc);
create index orders_freelancer_idx on public.orders (freelancer_id, created_at desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;

create policy "participants read their orders"
  on public.orders for select
  to authenticated
  using (auth.uid() in (client_id, freelancer_id));

-- ---------------------------------------------------------------------------
-- Payments: the ledger. Written only by the payment Edge Functions (service role)
-- and the functions below. Razorpay ids are never readable from the app.
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null default 'razorpay',
  razorpay_payment_link_id text unique,
  razorpay_payment_id text unique,
  payment_url text,
  amount_paise integer not null check (amount_paise > 0),
  -- created -> captured (held in escrow) -> released (freelancer is owed)
  -- or created -> cancelled. 'refunded' is set manually when money goes back.
  status text not null default 'created'
    check (status in ('created', 'captured', 'released', 'refunded', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_order_idx on public.payments (order_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select (id, order_id, amount_paise, status, created_at) on public.payments to authenticated;

create policy "participants read payment status"
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and auth.uid() in (o.client_id, o.freelancer_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Reviews: written once, by the client, after the order is completed.
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  freelancer_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

create index reviews_freelancer_idx on public.reviews (freelancer_id, created_at desc);

alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to authenticated;

create policy "reviews are readable by signed-in users"
  on public.reviews for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

-- Client hires a freelancer: accepts the proposal and creates the order.
create function public.accept_proposal(p_proposal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_prop public.proposals;
  v_job public.jobs;
  v_fee integer;
  v_order uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_prop from public.proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'proposal not found' using errcode = 'P0002';
  end if;
  select * into v_job from public.jobs where id = v_prop.job_id for update;
  if v_job.client_id <> v_uid then
    raise exception 'not your job' using errcode = '42501';
  end if;
  if v_prop.status <> 'pending' then
    raise exception 'proposal is not pending' using errcode = '55000';
  end if;
  if v_job.status <> 'open' then
    raise exception 'job is not open' using errcode = '55000';
  end if;

  -- 5% platform fee, rounded half up.
  v_fee := ((v_prop.price_paise::bigint * 500 + 5000) / 10000)::integer;

  update public.proposals set status = 'accepted' where id = v_prop.id;
  update public.jobs set status = 'closed' where id = v_job.id;

  insert into public.orders (
    proposal_id, job_id, client_id, freelancer_id, company_id, title,
    amount_paise, platform_fee_paise, freelancer_earnings_paise, delivery_days
  ) values (
    v_prop.id, v_job.id, v_job.client_id, v_prop.freelancer_id, v_job.company_id, v_job.title,
    v_prop.price_paise, v_fee, v_prop.price_paise - v_fee, v_prop.delivery_days
  )
  returning id into v_order;

  return v_order;
end;
$$;

-- Client turns a proposal down.
create function public.reject_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_updated integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.proposals p
     set status = 'rejected'
   where p.id = p_proposal_id
     and p.status = 'pending'
     and exists (select 1 from public.jobs j where j.id = p.job_id and j.client_id = v_uid);
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'proposal not found or not pending' using errcode = 'P0002';
  end if;
end;
$$;

-- Freelancer says the work is done.
create function public.mark_order_delivered(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_updated integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.orders
     set status = 'delivered', delivered_at = now()
   where id = p_order_id and freelancer_id = v_uid and status = 'in_progress';
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'order not found or not in progress' using errcode = 'P0002';
  end if;
end;
$$;

-- Client approves the delivered work: the escrow is released.
create function public.complete_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.client_id <> v_uid then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'delivered' then
    raise exception 'order has not been delivered' using errcode = '55000';
  end if;

  update public.orders set status = 'completed', completed_at = now() where id = v_order.id;
  update public.payments set status = 'released' where order_id = v_order.id and status = 'captured';
  update public.freelancer_profiles
     set completed_orders = completed_orders + 1
   where user_id = v_order.freelancer_id;
end;
$$;

-- Client reviews a completed order. Updates the freelancer's rating.
create function public.submit_review(p_order_id uuid, p_rating integer, p_comment text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_review uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'rating must be 1 to 5' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.client_id <> v_uid then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'completed' then
    raise exception 'order is not completed' using errcode = '55000';
  end if;

  insert into public.reviews (order_id, reviewer_id, freelancer_id, rating, comment)
  values (v_order.id, v_uid, v_order.freelancer_id, p_rating, nullif(btrim(coalesce(p_comment, '')), ''))
  returning id into v_review;

  update public.freelancer_profiles fp
     set rating_count = s.total,
         rating_avg = s.average
    from (
      select count(*)::integer as total, round(avg(rating)::numeric, 2) as average
      from public.reviews
      where freelancer_id = v_order.freelancer_id
    ) s
   where fp.user_id = v_order.freelancer_id;

  return v_review;
end;
$$;

revoke all on function public.accept_proposal(uuid) from public, anon;
revoke all on function public.reject_proposal(uuid) from public, anon;
revoke all on function public.mark_order_delivered(uuid) from public, anon;
revoke all on function public.complete_order(uuid) from public, anon;
revoke all on function public.submit_review(uuid, integer, text) from public, anon;
grant execute on function public.accept_proposal(uuid) to authenticated;
grant execute on function public.reject_proposal(uuid) to authenticated;
grant execute on function public.mark_order_delivered(uuid) to authenticated;
grant execute on function public.complete_order(uuid) to authenticated;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Functions only the Edge Functions (service role) can call
-- ---------------------------------------------------------------------------

-- Razorpay told us a payment link was paid. Safe to call twice.
-- Returns 'ok', 'duplicate', or 'needs_refund' (paid for an order that is no longer waiting).
create function public.record_payment_captured(
  p_payment_link_id text,
  p_payment_id text,
  p_amount_paise integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
  v_updated integer;
begin
  select * into v_pay from public.payments where razorpay_payment_link_id = p_payment_link_id for update;
  if not found then
    raise exception 'unknown payment link' using errcode = 'P0002';
  end if;
  if v_pay.status in ('captured', 'released', 'refunded') then
    return 'duplicate';
  end if;
  if p_amount_paise <> v_pay.amount_paise then
    raise exception 'amount mismatch' using errcode = '22023';
  end if;

  update public.payments
     set status = 'captured', razorpay_payment_id = p_payment_id
   where id = v_pay.id;

  update public.orders set status = 'in_progress' where id = v_pay.order_id and status = 'awaiting_payment';
  get diagnostics v_updated = row_count;

  return case when v_updated = 1 then 'ok' else 'needs_refund' end;
end;
$$;

-- Cancels an order that has not been paid yet and puts the job and proposal back.
-- Called by the cancel-order Edge Function after it has cancelled the payment link.
create function public.cancel_order(p_order_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.client_id <> p_user_id then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'awaiting_payment' then
    raise exception 'only unpaid orders can be cancelled' using errcode = '55000';
  end if;
  if exists (select 1 from public.payments where order_id = v_order.id and status in ('captured', 'released')) then
    raise exception 'order has been paid' using errcode = '55000';
  end if;

  update public.orders set status = 'cancelled' where id = v_order.id;
  update public.payments set status = 'cancelled' where order_id = v_order.id and status = 'created';
  update public.proposals set status = 'pending' where id = v_order.proposal_id;
  update public.jobs set status = 'open' where id = v_order.job_id;
end;
$$;

revoke all on function public.record_payment_captured(text, text, integer) from public, anon, authenticated;
revoke all on function public.cancel_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_payment_captured(text, text, integer) to service_role;
grant execute on function public.cancel_order(uuid, uuid) to service_role;

-- Order status changes reach the app live (for example when a payment lands).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;
