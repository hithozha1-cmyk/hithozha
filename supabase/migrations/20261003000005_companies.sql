-- Phase 1.5: startup / company clients.

-- 1. Individual vs company on the profile (never set for pure freelancers).
alter table public.profiles
  add column client_type text check (client_type in ('individual', 'company')),
  add constraint profiles_client_type_not_for_freelancers
    check (role is distinct from 'freelancer' or client_type is null);

grant select (client_type) on public.profiles to authenticated;
grant update (client_type) on public.profiles to authenticated;

-- 2. Companies. One per user for now.
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  logo_url text,
  website text check (website ~* '^https?://[^[:space:]]+$' and char_length(website) <= 200),
  linkedin_url text check (linkedin_url ~* '^https?://([a-z0-9-]+\.)*linkedin\.com(/[^[:space:]]*)?$' and char_length(linkedin_url) <= 200),
  team_size text not null check (team_size in ('1-10', '11-50', '51-200', '200+')),
  industry text not null check (char_length(industry) between 2 and 60),
  city text,
  about text check (char_length(about) <= 600),
  -- Private: never readable through the table API, only via get_my_company().
  gst_number text check (gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  udyam_number text check (udyam_number ~ '^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$'),
  verification_status text not null default 'none'
    check (verification_status in ('none', 'pending', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A registration number can back only one business.
create unique index companies_gst_number_key on public.companies (gst_number) where gst_number is not null;
create unique index companies_udyam_number_key on public.companies (udyam_number) where udyam_number is not null;

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

alter table public.companies enable row level security;

-- Column privileges are the guard rails (same pattern as profiles):
--   * gst_number / udyam_number are not selectable or writable directly;
--   * verification_status is not writable by users at all.
-- owner_id is writable only because upserts set it; the policies pin it to the caller.
revoke all on public.companies from anon, authenticated;

grant select (id, owner_id, name, logo_url, website, linkedin_url, team_size, industry, city, about,
              verification_status, created_at, updated_at)
  on public.companies to authenticated;

grant insert (owner_id, name, logo_url, website, linkedin_url, team_size, industry, city, about)
  on public.companies to authenticated;

grant update (owner_id, name, logo_url, website, linkedin_url, team_size, industry, city, about)
  on public.companies to authenticated;

create policy "companies are readable by signed-in users"
  on public.companies for select
  to authenticated
  using (true);

create policy "clients create their own company"
  on public.companies for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('client', 'both')
    )
  );

create policy "owners update their own company"
  on public.companies for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 3. The owner's full row, including the private registration numbers.
create function public.get_my_company()
returns setof public.companies
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.companies where owner_id = auth.uid();
$$;

-- 4. Submit a GST or Udyam number for review. The only way a user can move
--    verification_status, and only to 'pending'. Admins decide the outcome with
--    the service role.
create function public.submit_company_verification(p_gst text default null, p_udyam text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gst text := nullif(upper(btrim(coalesce(p_gst, ''))), '');
  v_udyam text := nullif(upper(btrim(coalesce(p_udyam, ''))), '');
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_gst is null and v_udyam is null then
    raise exception 'a GST or Udyam number is required' using errcode = '22023';
  end if;

  select verification_status into v_status from public.companies where owner_id = auth.uid();
  if not found then
    raise exception 'create a company first' using errcode = 'P0002';
  end if;
  if v_status in ('pending', 'verified') then
    raise exception 'already submitted' using errcode = '55000';
  end if;

  -- Format problems surface as check_violation (23514), duplicates as unique_violation (23505).
  update public.companies
     set gst_number = v_gst,
         udyam_number = v_udyam,
         verification_status = 'pending'
   where owner_id = auth.uid();
end;
$$;

revoke all on function public.get_my_company() from public, anon;
revoke all on function public.submit_company_verification(text, text) from public, anon;
grant execute on function public.get_my_company() to authenticated;
grant execute on function public.submit_company_verification(text, text) to authenticated;
