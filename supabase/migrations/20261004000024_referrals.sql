-- Referral codes. Everyone has a personal code. When a new person enters a friend's code in their
-- first 7 days, both get 5 extra application credits. Extra credits never expire: they are used
-- only after the 10 free ones of a month run out. A person can reward at most 10 friends.
--
-- Also fixes a small thing in the credit count: proposals created by ordering a package (not by
-- applying) no longer use up anyone's applications.

-- ---------------------------------------------------------------------------
-- Tables (nobody reads or writes them directly; the functions below do)
-- ---------------------------------------------------------------------------
create table public.referral_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);

create table public.referrals (
  referred_id uuid primary key references public.profiles (id) on delete cascade,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint referrals_not_self check (referred_id <> referrer_id)
);
create index referrals_referrer_idx on public.referrals (referrer_id);

create table public.application_bonuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text not null check (reason in ('referral_given', 'referral_received')),
  created_at timestamptz not null default now()
);
create index application_bonuses_user_idx on public.application_bonuses (user_id);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.application_bonuses enable row level security;
revoke all on public.referral_codes, public.referrals, public.application_bonuses from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Credits: 10 free a month, plus unspent referral bonus
-- ---------------------------------------------------------------------------
create or replace function public.applications_this_month(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.proposals
  where freelancer_id = p_user
    and package_id is null
    and created_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
$$;

create or replace function public.application_allowance(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with monthly as (
    select count(*)::integer as n
    from public.proposals
    where freelancer_id = p_user
      and package_id is null
      and created_at < date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
    group by date_trunc('month', created_at at time zone 'Asia/Kolkata')
  ),
  spent as (select coalesce(sum(greatest(n - 10, 0)), 0) as n from monthly),
  earned as (select coalesce(sum(amount), 0) as n from public.application_bonuses where user_id = p_user)
  select 10 + greatest((select n from earned) - (select n from spent), 0)::integer;
$$;

-- ---------------------------------------------------------------------------
-- Notification kind
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'proposal_received', 'proposal_rejected', 'hired', 'order_paid', 'order_delivered', 'order_completed',
  'order_cancelled', 'message', 'review_received', 'payout_sent', 'dispute_opened', 'dispute_withdrawn',
  'dispute_resolved', 'identity_verified', 'identity_rejected', 'company_verified', 'company_rejected',
  'admin_identity', 'admin_dispute', 'admin_report', 'referral_reward'
));

-- ---------------------------------------------------------------------------
-- What the app calls
-- ---------------------------------------------------------------------------
-- The caller's code (made on first use), how many friends joined with it, and whether they can still enter one.
create function public.my_referral()
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
    (select coalesce(sum(b.amount), 0)::integer from public.application_bonuses b where b.user_id = v_uid),
    (not exists (select 1 from public.referrals r where r.referred_id = v_uid)
       and (select p.created_at > now() - interval '7 days' from public.profiles p where p.id = v_uid));
end;
$$;

-- Enter a friend's code. Both of you get 5 extra application credits.
create function public.redeem_referral(p_code text)
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
  insert into public.application_bonuses (user_id, amount, reason) values (v_uid, 5, 'referral_received'), (v_referrer, 5, 'referral_given');

  select full_name into v_name from public.profiles where id = v_uid;
  perform public.notify_user(v_referrer, 'referral_reward', jsonb_build_object('name', coalesce(v_name, ''), 'amount', 5));
end;
$$;

revoke all on function public.my_referral() from public, anon;
revoke all on function public.redeem_referral(text) from public, anon;
grant execute on function public.my_referral() to authenticated;
grant execute on function public.redeem_referral(text) to authenticated;
