create table public.freelancer_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  bio text check (char_length(bio) <= 500),
  skills text[] not null default '{}' check (cardinality(skills) <= 10),
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  completed_orders integer not null default 0,
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.freelancer_profiles enable row level security;

-- Users may only write bio and skills (user_id is writable because upserts set
-- it; the policies pin it to the caller). Ratings, order counts and premium status
-- are system-managed, so they are not in the column grants.
revoke all on public.freelancer_profiles from anon, authenticated;
grant select on public.freelancer_profiles to authenticated;
grant insert (user_id, bio, skills), update (user_id, bio, skills) on public.freelancer_profiles to authenticated;

create policy "freelancer profiles are readable by signed-in users"
  on public.freelancer_profiles for select
  to authenticated
  using (true);

create policy "freelancers create their own profile"
  on public.freelancer_profiles for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('freelancer', 'both')
    )
  );

create policy "freelancers update their own profile"
  on public.freelancer_profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
