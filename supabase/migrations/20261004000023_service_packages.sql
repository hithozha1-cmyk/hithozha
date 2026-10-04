-- Fixed-price packages: a verified freelancer lists "Logo design, Rs 1500, 3 days" and a client
-- orders it directly, with no proposal round.
--
-- Ordering a package reuses the whole existing order flow (payment, chat, delivery, disputes,
-- reviews, payouts). It does this by creating a private job and an accepted proposal behind the
-- scenes, then the normal order, all inside one database function. The proposal carries package_id,
-- which the app can never set, so the proposal triggers know to skip the application limit and the
-- "new proposal" notification for it.

create table public.service_packages (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 5 and 80),
  description text not null check (char_length(description) between 20 and 600),
  category_slug text not null references public.categories (slug),
  -- Money is integer paise. Minimum Rs 50, same as a proposal.
  price_paise integer not null check (price_paise >= 5000 and price_paise <= 1000000000),
  delivery_days smallint not null check (delivery_days between 1 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index service_packages_freelancer_idx on public.service_packages (freelancer_id);
create index service_packages_active_idx on public.service_packages (created_at desc) where active;

create trigger service_packages_set_updated_at
  before update on public.service_packages
  for each row execute function public.set_updated_at();

-- At most 6 packages per freelancer, so a profile stays readable.
create function public.limit_service_packages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('packages:' || new.freelancer_id::text));
  if (select count(*) from public.service_packages where freelancer_id = new.freelancer_id) >= 6 then
    raise exception 'package limit reached' using errcode = '54000';
  end if;
  return new;
end;
$$;
create trigger service_packages_limit before insert on public.service_packages
  for each row execute function public.limit_service_packages();

alter table public.service_packages enable row level security;
revoke all on public.service_packages from anon, authenticated;
grant select on public.service_packages to authenticated;
grant insert (title, description, category_slug, price_paise, delivery_days, active),
      update (title, description, category_slug, price_paise, delivery_days, active),
      delete
  on public.service_packages to authenticated;

-- Policies cannot read the hidden profile columns themselves, so they ask these two small functions.
create function public.is_verified_active(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select verification_status = 'verified' and suspended_at is null from public.profiles where id = p_user), false);
$$;

create function public.can_publish_packages()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role in ('freelancer', 'both') and verification_status = 'verified' and suspended_at is null from public.profiles where id = auth.uid()), false);
$$;

revoke all on function public.is_verified_active(uuid) from public, anon;
revoke all on function public.can_publish_packages() from public, anon;
grant execute on function public.is_verified_active(uuid) to authenticated;
grant execute on function public.can_publish_packages() to authenticated;

-- Everyone signed in can see active packages of identity-verified freelancers; owners see all of theirs.
create policy "packages are visible"
  on public.service_packages for select to authenticated
  using (freelancer_id = auth.uid() or (active and public.is_verified_active(freelancer_id)));

create policy "verified freelancers create their packages"
  on public.service_packages for insert to authenticated
  with check (freelancer_id = auth.uid() and public.can_publish_packages());

create policy "freelancers edit their packages"
  on public.service_packages for update to authenticated
  using (freelancer_id = auth.uid())
  with check (freelancer_id = auth.uid());

create policy "freelancers delete their packages"
  on public.service_packages for delete to authenticated
  using (freelancer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Proposals remember which package they came from. Not writable from the app.
-- ---------------------------------------------------------------------------
alter table public.proposals add column package_id uuid references public.service_packages (id) on delete set null;

-- Package orders do not use up the freelancer's monthly applications.
create or replace function public.enforce_application_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.package_id is not null then return new; end if;
  -- Two proposals sent at the same instant must not both squeeze past the limit.
  perform pg_advisory_xact_lock(hashtext('application-limit:' || new.freelancer_id::text));
  if public.applications_this_month(new.freelancer_id) >= public.application_allowance(new.freelancer_id) then
    raise exception 'application limit reached' using errcode = '54000';
  end if;
  return new;
end;
$$;

-- ...and the client is not told "you received a proposal" for their own order.
create or replace function public.notify_on_proposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
begin
  if new.package_id is not null then return null; end if;
  select * into v_job from public.jobs where id = new.job_id;
  if tg_op = 'INSERT' then
    perform public.notify_user(v_job.client_id, 'proposal_received', jsonb_build_object(
      'job_id', new.job_id, 'proposal_id', new.id, 'title', v_job.title,
      'name', (select full_name from public.profiles where id = new.freelancer_id)));
  elsif new.status = 'rejected' and old.status = 'pending' then
    perform public.notify_user(new.freelancer_id, 'proposal_rejected', jsonb_build_object('job_id', new.job_id, 'title', v_job.title));
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ordering a package. Returns the new order's id (awaiting payment).
-- ---------------------------------------------------------------------------
create function public.order_package(p_package_id uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pkg public.service_packages;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_job uuid;
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

  insert into public.jobs (client_id, title, description, category_slug, job_type, budget_min_paise, budget_max_paise, work_mode)
  values (v_uid, v_pkg.title, left(v_pkg.description || coalesce(E'\n\nNote from the client: ' || v_note, ''), 2000),
          v_pkg.category_slug, 'one_time', v_pkg.price_paise, v_pkg.price_paise, 'online')
  returning id into v_job;

  insert into public.proposals (job_id, freelancer_id, message, price_paise, delivery_days, package_id)
  values (v_job, v_pkg.freelancer_id, v_pkg.description, v_pkg.price_paise, v_pkg.delivery_days, v_pkg.id)
  returning id into v_proposal;

  -- The normal hiring step: accepts the proposal, closes the job and creates the order.
  return public.accept_proposal(v_proposal);
end;
$$;

revoke all on function public.order_package(uuid, text) from public, anon;
grant execute on function public.order_package(uuid, text) to authenticated;
