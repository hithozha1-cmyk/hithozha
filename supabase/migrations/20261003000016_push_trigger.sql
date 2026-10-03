-- Calls the send-push Edge Function whenever a notification is created, using pg_net (the same
-- mechanism Supabase Database Webhooks use, without needing the dashboard webhook screen).
--
-- One-time setup in the SQL editor (the values are yours, so they never appear in this repository):
--   select vault.create_secret('<the PUSH_WEBHOOK_SECRET value>', 'push_webhook_secret');
--   select vault.create_secret('https://<project>.supabase.co/functions/v1/send-push', 'push_function_url');
-- and enable the pg_net extension (Database -> Extensions).
--
-- Sending a push must never stop a notification from being saved, so every failure here is swallowed.

create function public.push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'record', jsonb_build_object('id', new.id, 'user_id', new.user_id, 'kind', new.kind, 'data', new.data)
    ),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    timeout_milliseconds := 5000
  );
  return null;
exception when others then
  return null;
end;
$$;

revoke all on function public.push_on_notification() from public, anon, authenticated;

create trigger notifications_push after insert on public.notifications
  for each row execute function public.push_on_notification();
