-- The send-push Edge Function reads and cleans up tokens as service_role; the table had no grant for it.
grant select, delete on public.push_tokens to service_role;
grant select on public.profiles to service_role;
