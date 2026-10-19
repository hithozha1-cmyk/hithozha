-- Real recurring billing for paid plans, via Razorpay Subscriptions (a different product from the
-- Payment Links used for order escrow). Until now "an admin grants plans by hand" was the only way
-- onto a paid plan; this adds the self-serve path, in the same style as orders/payments:
--   * create-subscription (Edge Function) creates a Razorpay Subscription and returns its hosted
--     checkout URL, the same pattern as create-payment's payment link.
--   * The Razorpay Plan behind a subscription is created once per app plan/cycle and its id cached
--     on public.plans, so nothing needs to be pre-configured in the Razorpay dashboard.
--   * razorpay-webhook (already deployed) is extended to also handle subscription.* events:
--     activation/charge extends the membership exactly like admin_set_membership does, just driven
--     by Razorpay's own billing cycle instead of a fixed month count.
--   * Cancelling asks Razorpay to stop at the end of the paid period (cancel_at_cycle_end), so the
--     membership the person already paid for keeps working until then.

alter table public.plans add column if not exists razorpay_plan_id_month text;
alter table public.plans add column if not exists razorpay_plan_id_year text;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  audience text not null check (audience in ('freelancer', 'client')),
  plan_code text not null references public.plans (code),
  cycle text not null check (cycle in ('month', 'year')),
  razorpay_subscription_id text not null unique,
  status text not null default 'created'
    check (status in ('created', 'authenticated', 'active', 'paused', 'cancelled', 'completed', 'expired')),
  checkout_url text,
  cancel_requested boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id, audience, created_at desc);

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

drop policy if exists "people read their own subscriptions" on public.subscriptions;
create policy "people read their own subscriptions"
  on public.subscriptions for select to authenticated
  using (user_id = auth.uid());

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Called by the create-subscription Edge Function (service role)
-- ---------------------------------------------------------------------------

-- Caches the Razorpay plan id for a (plan_code, cycle) pair after it is created once.
create or replace function public.cache_razorpay_plan_id(p_plan_code text, p_cycle text, p_razorpay_plan_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_cycle = 'month' then
    update public.plans set razorpay_plan_id_month = p_razorpay_plan_id where code = p_plan_code;
  elsif p_cycle = 'year' then
    update public.plans set razorpay_plan_id_year = p_razorpay_plan_id where code = p_plan_code;
  else
    raise exception 'unknown cycle' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.record_subscription_created(
  p_user uuid, p_audience text, p_plan_code text, p_cycle text,
  p_razorpay_subscription_id text, p_checkout_url text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.subscriptions (user_id, audience, plan_code, cycle, razorpay_subscription_id, checkout_url)
  values (p_user, p_audience, p_plan_code, p_cycle, p_razorpay_subscription_id, p_checkout_url)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Called by razorpay-webhook (service role)
-- ---------------------------------------------------------------------------

-- subscription.activated or subscription.charged: the membership runs until this billing cycle's end.
create or replace function public.activate_subscription(p_razorpay_subscription_id text, p_current_period_end timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  select * into v_sub from public.subscriptions where razorpay_subscription_id = p_razorpay_subscription_id for update;
  if not found then
    raise exception 'unknown subscription' using errcode = 'P0002';
  end if;

  update public.subscriptions
     set status = 'active', current_period_end = p_current_period_end, cancel_requested = false
   where id = v_sub.id;

  -- Same upsert admin_set_membership does; granted_by stays null so a paid membership is
  -- distinguishable from one an admin granted by hand.
  insert into public.memberships (user_id, audience, plan_code, started_at, expires_at, granted_by)
  values (v_sub.user_id, v_sub.audience, v_sub.plan_code, now(), p_current_period_end, null)
  on conflict (user_id, audience) do update
    set plan_code = excluded.plan_code, expires_at = excluded.expires_at, granted_by = null;
end;
$$;

-- subscription.cancelled, subscription.completed, subscription.expired, subscription.paused, subscription.halted:
-- just record the status. The membership already expires at current_period_end on its own.
create or replace function public.set_subscription_status(p_razorpay_subscription_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('authenticated', 'active', 'paused', 'cancelled', 'completed', 'expired') then
    raise exception 'unknown status' using errcode = '22023';
  end if;
  update public.subscriptions set status = p_status where razorpay_subscription_id = p_razorpay_subscription_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Called by the cancel-subscription Edge Function, as the signed-in user
-- ---------------------------------------------------------------------------

-- Read-only ownership check: returns the Razorpay id to cancel, or raises if this is not the
-- caller's subscription or it is already past cancelling.
create or replace function public.subscription_for_cancel(p_subscription_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sub public.subscriptions;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found or v_sub.user_id <> v_uid then
    raise exception 'subscription not found' using errcode = 'P0002';
  end if;
  if v_sub.status not in ('created', 'authenticated', 'active') or v_sub.cancel_requested then
    raise exception 'subscription cannot be cancelled' using errcode = '55000';
  end if;
  return v_sub.razorpay_subscription_id;
end;
$$;

-- Called only after Razorpay has confirmed the cancel-at-cycle-end request.
create or replace function public.mark_subscription_cancel_requested(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  update public.subscriptions set cancel_requested = true where id = p_subscription_id and user_id = v_uid;
end;
$$;

revoke all on function public.cache_razorpay_plan_id(text, text, text) from public, anon, authenticated;
revoke all on function public.record_subscription_created(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.activate_subscription(text, timestamptz) from public, anon, authenticated;
revoke all on function public.set_subscription_status(text, text) from public, anon, authenticated;
grant execute on function public.cache_razorpay_plan_id(text, text, text) to service_role;
grant execute on function public.record_subscription_created(uuid, text, text, text, text, text) to service_role;
grant execute on function public.activate_subscription(text, timestamptz) to service_role;
grant execute on function public.set_subscription_status(text, text) to service_role;

revoke all on function public.subscription_for_cancel(uuid) from public, anon;
revoke all on function public.mark_subscription_cancel_requested(uuid) from public, anon;
grant execute on function public.subscription_for_cancel(uuid) to authenticated;
grant execute on function public.mark_subscription_cancel_requested(uuid) to authenticated;
