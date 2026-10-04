-- 1) Reports: anyone signed in can report a person or a job. Only admins can read or close reports.
-- 2) Admin alerts: admins get a notification (and a phone push) when something needs them:
--    a new identity check, a new dispute, a new report.

-- ---------------------------------------------------------------------------
-- Notification kinds (adds the three admin ones)
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'proposal_received', 'proposal_rejected', 'hired', 'order_paid', 'order_delivered', 'order_completed',
  'order_cancelled', 'message', 'review_received', 'payout_sent', 'dispute_opened', 'dispute_withdrawn',
  'dispute_resolved', 'identity_verified', 'identity_rejected', 'company_verified', 'company_rejected',
  'admin_identity', 'admin_dispute', 'admin_report'
));

create function public.notify_admins(p_kind text, p_data jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.notify_user(p.id, p_kind, p_data) from public.profiles p where p.is_admin;
$$;
revoke all on function public.notify_admins(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_user uuid references public.profiles (id) on delete cascade,
  target_job uuid references public.jobs (id) on delete cascade,
  reason text not null check (reason in ('spam', 'scam', 'abuse', 'fake', 'other')),
  details text check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  admin_note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  -- A report is about exactly one thing: a person or a job.
  constraint reports_one_target check ((target_user is not null) <> (target_job is not null)),
  constraint reports_not_self check (target_user is null or target_user <> reporter_id)
);

create unique index reports_one_open_per_user on public.reports (reporter_id, target_user) where status = 'open' and target_user is not null;
create unique index reports_one_open_per_job on public.reports (reporter_id, target_job) where status = 'open' and target_job is not null;
create index reports_status_idx on public.reports (status, created_at);

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

create function public.submit_report(p_target_type text, p_target_id uuid, p_reason text, p_details text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_id uuid;
  v_name text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_target_type not in ('user', 'job') or p_target_id is null or p_reason not in ('spam', 'scam', 'abuse', 'fake', 'other') then
    raise exception 'invalid report' using errcode = '22023';
  end if;
  if v_details is not null and char_length(v_details) > 500 then raise exception 'invalid report' using errcode = '22023'; end if;
  -- A few per day is plenty for a real problem; it stops anyone flooding the admins.
  if (select count(*) from public.reports where reporter_id = v_uid and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'too many reports' using errcode = '54000';
  end if;

  if p_target_type = 'user' then
    if not exists (select 1 from public.profiles where id = p_target_id) then raise exception 'not found' using errcode = 'P0002'; end if;
    insert into public.reports (reporter_id, target_user, reason, details) values (v_uid, p_target_id, p_reason, v_details) returning id into v_id;
    select full_name into v_name from public.profiles where id = p_target_id;
  else
    if not exists (select 1 from public.jobs where id = p_target_id) then raise exception 'not found' using errcode = 'P0002'; end if;
    insert into public.reports (reporter_id, target_job, reason, details) values (v_uid, p_target_id, p_reason, v_details) returning id into v_id;
    select title into v_name from public.jobs where id = p_target_id;
  end if;

  perform public.notify_admins('admin_report', jsonb_build_object('name', coalesce(v_name, ''), 'reason', p_reason));
  return v_id;
end;
$$;

-- p_status: 'open', 'closed' (dismissed or actioned), 'all'.
create function public.admin_reports(p_status text default 'open', p_limit integer default 30, p_offset integer default 0)
returns table (id uuid, reporter_id uuid, reporter_name text, target_type text, target_user uuid, target_job uuid, target_name text,
               reason text, details text, status text, admin_note text, created_at timestamptz, reviewed_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  if p_status not in ('open', 'closed', 'all') then raise exception 'unknown filter' using errcode = '22023'; end if;
  return query
    select r.id, r.reporter_id, rp.full_name,
           case when r.target_user is not null then 'user' else 'job' end,
           r.target_user, r.target_job,
           coalesce(tp.full_name, j.title),
           r.reason, r.details, r.status, r.admin_note, r.created_at, r.reviewed_at
    from public.reports r
    join public.profiles rp on rp.id = r.reporter_id
    left join public.profiles tp on tp.id = r.target_user
    left join public.jobs j on j.id = r.target_job
    where case p_status when 'open' then r.status = 'open' when 'closed' then r.status <> 'open' else true end
    order by r.created_at desc
    limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

-- Closes a report. 'actioned' means you did something (for example suspended the person).
create function public.admin_close_report(p_id uuid, p_outcome text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform public.require_admin();
  if p_outcome not in ('dismissed', 'actioned') then raise exception 'unknown outcome' using errcode = '22023'; end if;
  update public.reports
     set status = p_outcome, admin_note = v_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id and status = 'open';
  if not found then raise exception 'no open report' using errcode = 'P0002'; end if;
  perform public.log_admin_action('close_report', 'report', p_id::text, jsonb_build_object('outcome', p_outcome, 'note', v_note));
end;
$$;

revoke all on function public.submit_report(text, uuid, text, text) from public, anon;
revoke all on function public.admin_reports(text, integer, integer) from public, anon;
revoke all on function public.admin_close_report(uuid, text, text) from public, anon;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;
grant execute on function public.admin_reports(text, integer, integer) to authenticated;
grant execute on function public.admin_close_report(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Alerts to admins: new identity check, new dispute
-- ---------------------------------------------------------------------------
create function public.alert_admins_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_admins('admin_identity', jsonb_build_object('name', coalesce((select full_name from public.profiles where id = new.user_id), '')));
  return null;
end;
$$;
create trigger identity_alert_admins after insert on public.identity_verifications
  for each row execute function public.alert_admins_identity();

create function public.alert_admins_dispute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_admins('admin_dispute', jsonb_build_object('title', coalesce((select title from public.orders where id = new.order_id), '')));
  return null;
end;
$$;
create trigger dispute_alert_admins after insert on public.disputes
  for each row execute function public.alert_admins_dispute();
