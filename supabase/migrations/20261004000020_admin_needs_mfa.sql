-- Admin access needs a second step. is_admin() (used by every admin function, the admin storage
-- policies and the category policies) is now true only for an admin account whose session passed
-- the authenticator-app (TOTP) check, i.e. whose token carries aal = aal2.
-- is_admin_account() answers only "is this an admin account", so the admin site knows to ask for the code.
create function public.is_admin_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin_account() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

revoke all on function public.is_admin_account() from public, anon;
grant execute on function public.is_admin_account() to authenticated;
