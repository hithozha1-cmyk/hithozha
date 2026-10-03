-- Android phones now register their Firebase (FCM) token directly, so the token column must
-- accept those as well as Expo push tokens (still used for iPhone later).
-- Both are made of letters, digits and a few symbols, with no spaces.

alter table public.push_tokens drop constraint push_tokens_token_check;
alter table public.push_tokens
  add constraint push_tokens_token_check check (char_length(token) between 20 and 4096 and token ~ '^[A-Za-z0-9_:.\[\]-]+$');

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_platform not in ('android', 'ios') or p_token is null or char_length(p_token) not between 20 and 4096 or p_token !~ '^[A-Za-z0-9_:.\[\]-]+$' then
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
