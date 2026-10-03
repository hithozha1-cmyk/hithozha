-- Phone push notifications: where to send them. Each phone that signs in registers an Expo push
-- token. A token belongs to whoever signed in last (a shared phone moves it), and signing out removes it.
-- The tokens are never readable from the app; only the send-push Edge Function (service role) uses them.

create table public.push_tokens (
  token text primary key check (token ~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,60}\]$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_platform not in ('android', 'ios') or p_token is null or p_token !~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,60}\]$' then
    raise exception 'invalid token' using errcode = '22023';
  end if;

  insert into public.push_tokens (token, user_id, platform)
  values (p_token, v_uid, p_platform)
  on conflict (token) do update set user_id = v_uid, platform = p_platform, updated_at = now();

  -- Keep the ten most recent phones per person.
  delete from public.push_tokens
   where user_id = v_uid
     and token not in (select token from public.push_tokens where user_id = v_uid order by updated_at desc limit 10);
end;
$$;

create function public.unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
