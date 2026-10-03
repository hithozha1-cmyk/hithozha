-- Application credits, free tier: every freelancer can send 10 proposals a month (India time).
-- The limit is enforced by the database, so no app version can bypass it. Withdrawn and declined
-- proposals still count, so the limit cannot be dodged by withdrawing. Buying extra packs comes
-- later (when payments are live): application_allowance() is the one place that will add them.

create function public.application_allowance(p_user uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select 10;
$$;

create function public.applications_this_month(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.proposals
  where freelancer_id = p_user
    and created_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
$$;

revoke all on function public.application_allowance(uuid) from public, anon, authenticated;
revoke all on function public.applications_this_month(uuid) from public, anon, authenticated;

create function public.enforce_application_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Two proposals sent at the same instant must not both squeeze past the limit.
  perform pg_advisory_xact_lock(hashtext('application-limit:' || new.freelancer_id::text));
  if public.applications_this_month(new.freelancer_id) >= public.application_allowance(new.freelancer_id) then
    raise exception 'application limit reached' using errcode = '54000';
  end if;
  return new;
end;
$$;

create trigger proposals_enforce_limit before insert on public.proposals
  for each row execute function public.enforce_application_limit();

-- What the apply screen shows: used, allowed, left, and when it resets.
create function public.my_application_credits()
returns table (used integer, allowed integer, remaining integer, resets_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_used integer;
  v_allowed integer;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  v_used := public.applications_this_month(v_uid);
  v_allowed := public.application_allowance(v_uid);
  return query select v_used, v_allowed, greatest(v_allowed - v_used, 0),
    (date_trunc('month', now() at time zone 'Asia/Kolkata') + interval '1 month') at time zone 'Asia/Kolkata';
end;
$$;

revoke all on function public.my_application_credits() from public, anon;
grant execute on function public.my_application_credits() to authenticated;
