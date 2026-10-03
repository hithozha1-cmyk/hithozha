-- Phase 2 (jobs): clients post work, freelancers browse it.

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  -- Set when a company client posts; null for individuals.
  company_id uuid references public.companies (id) on delete set null,
  title text not null check (char_length(title) between 5 and 100),
  description text not null check (char_length(description) between 20 and 2000),
  category_slug text not null references public.categories (slug),
  job_type text not null check (job_type in ('one_time', 'monthly', 'part_time')),
  -- Only part-time jobs have weekly hours, and every part-time job has them.
  hours_per_week smallint check (hours_per_week between 1 and 80),
  -- Money is always integer paise. For monthly and part_time jobs this is a monthly budget.
  budget_min_paise integer not null check (budget_min_paise >= 0),
  budget_max_paise integer not null check (budget_max_paise >= budget_min_paise),
  work_mode text not null check (work_mode in ('online', 'in_person')),
  city text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_hours_only_for_part_time check ((job_type = 'part_time') = (hours_per_week is not null)),
  constraint jobs_city_for_in_person check (work_mode = 'online' or city is not null)
);

create index jobs_open_created_idx on public.jobs (created_at desc) where status = 'open';
create index jobs_company_idx on public.jobs (company_id) where status = 'open';
create index jobs_client_idx on public.jobs (client_id);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

alter table public.jobs enable row level security;

-- Posters can only change the status (close or reopen). Everything else is fixed at posting time.
revoke all on public.jobs from anon, authenticated;

grant select on public.jobs to authenticated;

grant insert (client_id, company_id, title, description, category_slug, job_type, hours_per_week,
              budget_min_paise, budget_max_paise, work_mode, city)
  on public.jobs to authenticated;

grant update (status) on public.jobs to authenticated;

-- Everyone signed in sees open jobs; posters also see their own closed ones.
create policy "open jobs are readable, posters see their own"
  on public.jobs for select
  to authenticated
  using (status = 'open' or client_id = auth.uid());

-- Only clients can post, and a job can only point at a company the poster owns.
create policy "clients post jobs"
  on public.jobs for insert
  to authenticated
  with check (
    client_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('client', 'both')
    )
    and (
      company_id is null
      or exists (
        select 1 from public.companies c
        where c.id = company_id and c.owner_id = auth.uid()
      )
    )
  );

create policy "posters update their own jobs"
  on public.jobs for update
  to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid());
