-- Hithozha phase 1: profiles, with a signup trigger and locked-down privileges.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  city text,
  language text not null default 'ta' check (language in ('ta', 'en')),
  role text check (role in ('client', 'freelancer', 'both')),
  phone text,
  verification_status text not null default 'none'
    check (verification_status in ('none', 'pending', 'verified', 'rejected')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Column-level privileges are the guard rails. Supabase grants new tables to
-- anon/authenticated by default, so start from nothing and add back only what
-- the app needs. Consequences:
--   * users can never write is_admin or verification_status;
--   * phone and is_admin are not readable from the client (service role and
--     Edge Functions only) until a later phase needs them.
revoke all on public.profiles from anon, authenticated;

grant select (id, full_name, avatar_url, city, language, role, verification_status, created_at, updated_at)
  on public.profiles to authenticated;

grant update (full_name, avatar_url, city, language, role)
  on public.profiles to authenticated;

-- Public profile fields are readable by every signed-in user.
create policy "profiles are readable by signed-in users"
  on public.profiles for select
  to authenticated
  using (true);

-- Users edit only their own row.
create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the profile row as soon as an auth user exists. Google supplies a
-- name and picture in the user metadata; email OTP users start empty.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Used by admin-only policies in other tables. Security definer so it can read
-- is_admin even though clients cannot.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
