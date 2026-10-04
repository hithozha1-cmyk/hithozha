-- Thozha tokens and membership plans.
--
--   * Tokens pay for in-app actions. Today: applying to a job costs 1 token.
--   * Free tokens come every month with the plan and expire at the end of that month (India time).
--     Bought or earned tokens (referrals, admin gifts, later purchases) never expire.
--     Free tokens are spent first, then the others. Tokens are never paid out as cash.
--   * You get 1 token back if you are hired, and 1 back if the client closes the job without opening
--     your proposal.
--   * Plans set the monthly tokens, the commission, and limits on packages and open jobs. Until payments
--     are live an admin grants plans by hand. The commission is locked on the order when it is created.
--   * This replaces the old "10 free applications a month" counter and the referral bonus table.

-- ---------------------------------------------------------------------------
-- Plans (public prices and rules, editable by changing rows)
-- ---------------------------------------------------------------------------
create table public.plans (
  code text primary key,
  audience text not null check (audience in ('freelancer', 'client')),
  name text not null,
  monthly_tokens integer not null default 0 check (monthly_tokens >= 0),
  -- Commission kept from the freelancer's earnings, in basis points (500 = 5%).
  commission_bps integer not null default 500 check (commission_bps between 0 and 3000),
  -- Null means unlimited.
  max_packages integer check (max_packages is null or max_packages > 0),
  max_open_jobs integer check (max_open_jobs is null or max_open_jobs > 0),
  price_month_paise integer not null default 0 check (price_month_paise >= 0),
  price_year_paise integer not null default 0 check (price_year_paise >= 0),
  sort_order smallint not null default 0,
  active boolean not null default true
);

insert into public.plans (code, audience, name, monthly_tokens, commission_bps, max_packages, max_open_jobs, price_month_paise, price_year_paise, sort_order) values
  ('freelancer_free',   'freelancer', 'Free',     10, 500, 3,    null, 0,     0,      1),
  ('freelancer_pro',    'freelancer', 'Pro',      50, 300, 10,   null, 19900, 199000, 2),
  ('freelancer_elite',  'freelancer', 'Elite',    150, 200, null, null, 49900, 499000, 3),
  ('client_free',       'client',     'Free',     0,  500, null, 3,    0,     0,      1),
  ('client_business',   'client',     'Business', 0,  500, null, 10,   29900, 299000, 2),
  ('client_startup',    'client',     'Startup',  0,  500, null, null, 49900, 499000, 3);

alter table public.plans enable row level security;
revoke all on public.plans from anon, authenticated;
grant select on public.plans to authenticated;
create policy "plans are readable" on public.plans for select to authenticated using (active);

-- Who is on which plan. A row with a past expires_at counts as the free plan.
create table public.memberships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  audience text not null check (audience in ('freelancer', 'client')),
  plan_code text not null references public.plans (code),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  granted_by uuid references public.profiles (id),
  primary key (user_id, audience)
);
alter table public.memberships enable row level security;
revoke all on public.memberships from anon, authenticated;

create function public.plan_of(p_user uuid, p_audience text)
returns public.plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.plans p
  where p.code = coalesce(
    (select m.plan_code from public.memberships m
      where m.user_id = p_user and m.audience = p_audience and (m.expires_at is null or m.expires_at > now())),
    p_audience || '_free');
$$;
revoke all on function public.plan_of(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The token ledger: every change is a row, nothing is edited
-- ---------------------------------------------------------------------------
create table public.token_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  pool text not null check (pool in ('free', 'bought')),
  amount integer not null check (amount <> 0),
  kind text not null check (kind in ('monthly_grant', 'purchase', 'bonus', 'admin', 'spend', 'refund')),
  reason text,
  ref_type text,
  ref_id uuid,
  -- India-time month this row belongs to, e.g. 2026-10. Free tokens only count in their own month.
  month_key text not null,
  created_at timestamptz not null default now()
);
create index token_ledger_user_idx on public.token_ledger (user_id, month_key);
-- A refund for the same reason and proposal can happen only once.
create unique index token_refund_once on public.token_ledger (user_id, reason, ref_id) where kind = 'refund';

alter table public.token_ledger enable row level security;
revoke all on public.token_ledger from anon, authenticated;

create function public.token_month()
returns text
language sql
stable
set search_path = ''
as $$ select to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM') $$;

create function public.token_balances(p_user uuid)
returns table (free integer, bought integer)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount) filter (where pool = 'free' and month_key = public.token_month()), 0)::integer,
         coalesce(sum(amount) filter (where pool = 'bought'), 0)::integer
  from public.token_ledger where user_id = p_user;
$$;

-- Tops this month's free tokens up to what the plan gives (also covers an upgrade in the middle of the month).
create function public.ensure_monthly_grant(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target integer;
  v_granted integer;
begin
  select monthly_tokens into v_target from public.plan_of(p_user, 'freelancer');
  select coalesce(sum(amount), 0) into v_granted from public.token_ledger
   where user_id = p_user and kind = 'monthly_grant' and month_key = public.token_month();
  if v_target > v_granted then
    insert into public.token_ledger (user_id, pool, amount, kind, reason, month_key)
    values (p_user, 'free', v_target - v_granted, 'monthly_grant', 'plan tokens', public.token_month());
  end if;
end;
$$;

-- Takes tokens, free ones first. Returns false (and takes nothing) if there are not enough.
create function public.spend_tokens(p_user uuid, p_amount integer, p_reason text, p_ref_type text, p_ref_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_free integer;
  v_bought integer;
  v_take_free integer;
begin
  if p_amount <= 0 then raise exception 'invalid amount' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('tokens:' || p_user::text));
  perform public.ensure_monthly_grant(p_user);
  select b.free, b.bought into v_free, v_bought from public.token_balances(p_user) b;
  if v_free + v_bought < p_amount then return false; end if;
  v_take_free := least(v_free, p_amount);
  if v_take_free > 0 then
    insert into public.token_ledger (user_id, pool, amount, kind, reason, ref_type, ref_id, month_key)
    values (p_user, 'free', -v_take_free, 'spend', p_reason, p_ref_type, p_ref_id, public.token_month());
  end if;
  if p_amount - v_take_free > 0 then
    insert into public.token_ledger (user_id, pool, amount, kind, reason, ref_type, ref_id, month_key)
    values (p_user, 'bought', -(p_amount - v_take_free), 'spend', p_reason, p_ref_type, p_ref_id, public.token_month());
  end if;
  return true;
end;
$$;

-- Gives back tokens that were spent on p_ref_id, to the pool they came from. Happens at most once per reason.
create function public.refund_tokens(p_user uuid, p_amount integer, p_reason text, p_ref_type text, p_ref_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pool text;
begin
  select pool into v_pool from public.token_ledger
   where user_id = p_user and kind = 'spend' and ref_type = p_ref_type and ref_id = p_ref_id
   order by pool limit 1;
  if v_pool is null then return; end if;
  insert into public.token_ledger (user_id, pool, amount, kind, reason, ref_type, ref_id, month_key)
  values (p_user, v_pool, p_amount, 'refund', p_reason, p_ref_type, p_ref_id, public.token_month())
  on conflict (user_id, reason, ref_id) where kind = 'refund' do nothing;
end;
$$;

revoke all on function public.token_balances(uuid) from public, anon, authenticated;
revoke all on function public.ensure_monthly_grant(uuid) from public, anon, authenticated;
revoke all on function public.spend_tokens(uuid, integer, text, text, uuid) from public, anon, authenticated;
revoke all on function public.refund_tokens(uuid, integer, text, text, uuid) from public, anon, authenticated;

-- Move the old referral bonuses over as tokens that never expire, then retire the old counter.
insert into public.token_ledger (user_id, pool, amount, kind, reason, month_key)
select user_id, 'bought', amount, 'bonus', 'referral', public.token_month() from public.application_bonuses;

-- ---------------------------------------------------------------------------
-- Applying costs one token
-- ---------------------------------------------------------------------------
create or replace function public.enforce_application_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Ordering a package is not applying.
  if new.package_id is not null then return new; end if;
  if not public.spend_tokens(new.freelancer_id, 1, 'apply', 'proposal', new.id) then
    raise exception 'not enough tokens' using errcode = '54000';
  end if;
  return new;
end;
$$;

drop function public.my_application_credits();
drop function public.application_allowance(uuid);
drop function public.applications_this_month(uuid);
drop table public.application_bonuses;

-- Refunds: hired, and job closed without the client opening your proposal.
alter table public.proposals add column viewed_at timestamptz;

create function public.refund_on_hired()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' and new.package_id is null then
    perform public.refund_tokens(new.freelancer_id, 1, 'hired', 'proposal', new.id);
  end if;
  return null;
end;
$$;
create trigger proposals_refund_hired after update of status on public.proposals
  for each row execute function public.refund_on_hired();

create function public.refund_on_job_closed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A job closed because someone was hired has an accepted proposal; nothing to give back then.
  if new.status = 'closed' and old.status = 'open'
     and not exists (select 1 from public.proposals where job_id = new.id and status = 'accepted') then
    perform public.refund_tokens(p.freelancer_id, 1, 'job_closed_unviewed', 'proposal', p.id)
    from public.proposals p
    where p.job_id = new.id and p.status = 'pending' and p.viewed_at is null and p.package_id is null;
  end if;
  return null;
end;
$$;
create trigger jobs_refund_unviewed after update of status on public.jobs
  for each row execute function public.refund_on_job_closed();

-- The client opening their proposals list marks them seen.
create function public.mark_job_proposals_viewed(p_job uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.jobs where id = p_job and client_id = auth.uid()) then
    raise exception 'not your job' using errcode = '42501';
  end if;
  update public.proposals set viewed_at = now() where job_id = p_job and viewed_at is null;
end;
$$;
revoke all on function public.mark_job_proposals_viewed(uuid) from public, anon;
grant execute on function public.mark_job_proposals_viewed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Plan limits: packages (freelancers) and open jobs (clients)
-- ---------------------------------------------------------------------------
create or replace function public.limit_service_packages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
begin
  perform pg_advisory_xact_lock(hashtext('packages:' || new.freelancer_id::text));
  select max_packages into v_max from public.plan_of(new.freelancer_id, 'freelancer');
  -- "Unlimited" still has a ceiling so a profile stays readable.
  if (select count(*) from public.service_packages where freelancer_id = new.freelancer_id) >= coalesce(v_max, 30) then
    raise exception 'package limit reached' using errcode = '54000';
  end if;
  return new;
end;
$$;

create function public.limit_open_jobs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
begin
  if new.status <> 'open' then return new; end if;
  -- The short-lived job made inside order_package is exempt.
  if current_setting('app.hidden_job', true) = new.id::text then return new; end if;
  perform pg_advisory_xact_lock(hashtext('open-jobs:' || new.client_id::text));
  select max_open_jobs into v_max from public.plan_of(new.client_id, 'client');
  if v_max is not null and (select count(*) from public.jobs where client_id = new.client_id and status = 'open') >= v_max then
    raise exception 'open job limit reached' using errcode = '54000';
  end if;
  return new;
end;
$$;
create trigger jobs_limit_open before insert on public.jobs
  for each row execute function public.limit_open_jobs();

-- ---------------------------------------------------------------------------
-- Commission is locked on each order
-- ---------------------------------------------------------------------------
alter table public.orders add column commission_bps smallint not null default 500 check (commission_bps between 0 and 3000);

create or replace function public.accept_proposal(p_proposal_id uuid)
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
  v_bps integer;
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

  -- The platform fee follows the freelancer's plan and is locked on the order now (rounded half up).
  select commission_bps into v_bps from public.plan_of(v_prop.freelancer_id, 'freelancer');
  v_fee := ((v_prop.price_paise::bigint * v_bps + 5000) / 10000)::integer;

  update public.proposals set status = 'accepted' where id = v_prop.id;
  update public.jobs set status = 'closed' where id = v_job.id;

  insert into public.orders (
    proposal_id, job_id, client_id, freelancer_id, company_id, title,
    amount_paise, platform_fee_paise, freelancer_earnings_paise, delivery_days, commission_bps
  ) values (
    v_prop.id, v_job.id, v_job.client_id, v_prop.freelancer_id, v_job.company_id, v_job.title,
    v_prop.price_paise, v_fee, v_prop.price_paise - v_fee, v_prop.delivery_days, v_bps
  )
  returning id into v_order;

  return v_order;
end;
$$;

create or replace function public.admin_resolve_dispute(
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
  v_fee := (v_rest::bigint * v_order.commission_bps + 5000) / 10000;

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

create or replace function public.order_package(p_package_id uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pkg public.service_packages;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_job uuid := gen_random_uuid();
  v_proposal uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'note too long' using errcode = '22023'; end if;

  select * into v_pkg from public.service_packages where id = p_package_id and active;
  if not found then raise exception 'package not found' using errcode = 'P0002'; end if;
  if v_pkg.freelancer_id = v_uid then raise exception 'cannot order your own package' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = v_pkg.freelancer_id and verification_status = 'verified' and suspended_at is null) then
    raise exception 'package not available' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and suspended_at is not null) then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  -- This one job is closed again inside this function, so it does not count towards the open-jobs limit.
  perform set_config('app.hidden_job', v_job::text, true);
  insert into public.jobs (id, client_id, title, description, category_slug, job_type, budget_min_paise, budget_max_paise, work_mode)
  values (v_job, v_uid, v_pkg.title, left(v_pkg.description || coalesce(E'\n\nNote from the client: ' || v_note, ''), 2000),
          v_pkg.category_slug, 'one_time', v_pkg.price_paise, v_pkg.price_paise, 'online');

  insert into public.proposals (job_id, freelancer_id, message, price_paise, delivery_days, package_id)
  values (v_job, v_pkg.freelancer_id, v_pkg.description, v_pkg.price_paise, v_pkg.delivery_days, v_pkg.id)
  returning id into v_proposal;

  -- The normal hiring step: accepts the proposal, closes the job and creates the order.
  return public.accept_proposal(v_proposal);
end;
$$;

create or replace function public.my_referral()
returns table (code text, friends integer, bonus integer, can_redeem boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_try integer := 0;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;

  select rc.code into v_code from public.referral_codes rc where rc.user_id = v_uid;
  while v_code is null and v_try < 20 loop
    v_try := v_try + 1;
    v_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1), '') from generate_series(1, 6));
    begin
      insert into public.referral_codes (user_id, code) values (v_uid, v_code);
    exception when unique_violation then
      -- Either the code is taken (try another) or this person got one in the meantime (use it).
      select rc.code into v_code from public.referral_codes rc where rc.user_id = v_uid;
    end;
  end loop;

  return query select
    v_code,
    (select count(*)::integer from public.referrals r where r.referrer_id = v_uid),
    (select coalesce(sum(l.amount), 0)::integer from public.token_ledger l where l.user_id = v_uid and l.kind = 'bonus' and l.reason = 'referral'),
    (not exists (select 1 from public.referrals r where r.referred_id = v_uid)
       and (select p.created_at > now() - interval '7 days' from public.profiles p where p.id = v_uid));
end;
$$;

create or replace function public.redeem_referral(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_referrer uuid;
  v_name text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  -- Serialise redemptions by the same person.
  perform pg_advisory_xact_lock(hashtext('referral:' || v_uid::text));

  if not coalesce((select created_at > now() - interval '7 days' from public.profiles where id = v_uid), false) then
    raise exception 'too late to use a code' using errcode = '55000';
  end if;
  if exists (select 1 from public.referrals where referred_id = v_uid) then
    raise exception 'already used a code' using errcode = '55000';
  end if;

  select user_id into v_referrer from public.referral_codes where code = upper(btrim(coalesce(p_code, '')));
  if v_referrer is null then raise exception 'code not found' using errcode = 'P0002'; end if;
  if v_referrer = v_uid then raise exception 'cannot use your own code' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtext('referrer:' || v_referrer::text));
  if (select count(*) from public.referrals where referrer_id = v_referrer) >= 10 then
    raise exception 'code no longer gives rewards' using errcode = '54000';
  end if;

  insert into public.referrals (referred_id, referrer_id) values (v_uid, v_referrer);
  insert into public.token_ledger (user_id, pool, amount, kind, reason, month_key)
  values (v_uid, 'bought', 5, 'bonus', 'referral', public.token_month()), (v_referrer, 'bought', 5, 'bonus', 'referral', public.token_month());

  select full_name into v_name from public.profiles where id = v_uid;
  perform public.notify_user(v_referrer, 'referral_reward', jsonb_build_object('name', coalesce(v_name, ''), 'amount', 5));
end;
$$;

-- ---------------------------------------------------------------------------
-- What the app calls
-- ---------------------------------------------------------------------------
create function public.my_tokens()
returns table (free integer, bought integer, total integer, monthly integer, resets_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_free integer;
  v_bought integer;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  -- Only freelancers get monthly tokens.
  if exists (select 1 from public.profiles where id = v_uid and role in ('freelancer', 'both')) then
    perform pg_advisory_xact_lock(hashtext('tokens:' || v_uid::text));
    perform public.ensure_monthly_grant(v_uid);
  end if;
  select b.free, b.bought into v_free, v_bought from public.token_balances(v_uid) b;
  return query select v_free, v_bought, v_free + v_bought,
    (select pl.monthly_tokens from public.plan_of(v_uid, 'freelancer') pl),
    (date_trunc('month', now() at time zone 'Asia/Kolkata') + interval '1 month') at time zone 'Asia/Kolkata';
end;
$$;

create function public.my_plan(p_audience text)
returns table (plan_code text, plan_name text, monthly_tokens integer, commission_bps integer, max_packages integer, max_open_jobs integer, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_audience not in ('freelancer', 'client') then raise exception 'unknown audience' using errcode = '22023'; end if;
  return query
    select pl.code, pl.name, pl.monthly_tokens, pl.commission_bps, pl.max_packages, pl.max_open_jobs,
           (select m.expires_at from public.memberships m where m.user_id = v_uid and m.audience = p_audience and (m.expires_at is null or m.expires_at > now()))
    from public.plan_of(v_uid, p_audience) pl;
end;
$$;

revoke all on function public.my_tokens() from public, anon;
revoke all on function public.my_plan(text) from public, anon;
grant execute on function public.my_tokens() to authenticated;
grant execute on function public.my_plan(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: give a plan, give tokens, see a person's balance. All audit-logged.
-- ---------------------------------------------------------------------------
create function public.admin_set_membership(p_user uuid, p_plan_code text, p_months integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
begin
  perform public.require_admin();
  select * into v_plan from public.plans where code = p_plan_code;
  if not found then raise exception 'unknown plan' using errcode = 'P0002'; end if;
  if p_months is not null and (p_months < 1 or p_months > 36) then raise exception 'months must be 1 to 36' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'user not found' using errcode = 'P0002'; end if;

  insert into public.memberships (user_id, audience, plan_code, started_at, expires_at, granted_by)
  values (p_user, v_plan.audience, v_plan.code, now(), case when p_months is null then null else now() + make_interval(months => p_months) end, auth.uid())
  on conflict (user_id, audience) do update
    set plan_code = excluded.plan_code, started_at = excluded.started_at, expires_at = excluded.expires_at, granted_by = excluded.granted_by;

  perform public.log_admin_action('set_membership', 'user', p_user::text, jsonb_build_object('plan', p_plan_code, 'months', p_months));
end;
$$;

create function public.admin_grant_tokens(p_user uuid, p_amount integer, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  perform public.require_admin();
  if p_amount < 1 or p_amount > 1000 then raise exception 'amount must be 1 to 1000' using errcode = '22023'; end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 200 then raise exception 'a reason is required' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'user not found' using errcode = 'P0002'; end if;
  insert into public.token_ledger (user_id, pool, amount, kind, reason, month_key)
  values (p_user, 'bought', p_amount, 'admin', v_reason, public.token_month());
  perform public.log_admin_action('grant_tokens', 'user', p_user::text, jsonb_build_object('amount', p_amount, 'reason', v_reason));
end;
$$;

create function public.admin_user_tokens(p_user uuid)
returns table (free integer, bought integer, freelancer_plan text, freelancer_expires timestamptz, client_plan text, client_expires timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
    select b.free, b.bought,
           (select pl.code from public.plan_of(p_user, 'freelancer') pl),
           (select m.expires_at from public.memberships m where m.user_id = p_user and m.audience = 'freelancer'),
           (select pl.code from public.plan_of(p_user, 'client') pl),
           (select m.expires_at from public.memberships m where m.user_id = p_user and m.audience = 'client')
    from public.token_balances(p_user) b;
end;
$$;

revoke all on function public.admin_set_membership(uuid, text, integer) from public, anon;
revoke all on function public.admin_grant_tokens(uuid, integer, text) from public, anon;
revoke all on function public.admin_user_tokens(uuid) from public, anon;
grant execute on function public.admin_set_membership(uuid, text, integer) to authenticated;
grant execute on function public.admin_grant_tokens(uuid, integer, text) to authenticated;
grant execute on function public.admin_user_tokens(uuid) to authenticated;
