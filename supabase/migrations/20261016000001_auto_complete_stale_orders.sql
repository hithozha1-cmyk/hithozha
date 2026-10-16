-- A client who never responds to a delivery would otherwise freeze the freelancer's money
-- forever: "mark delivered" is a freelancer's own claim, not proof of work, and only an explicit
-- client approval releases escrow. This adds the other half of that safety net: if the client
-- does nothing for 7 days after delivery, the order auto-completes and pays out exactly like
-- complete_order would. A client who actually has a problem is not stuck either: opening a
-- dispute (still available right up to that point) takes the order out of this entirely.

-- Keep AUTO_APPROVE_DAYS below in sync with AUTO_APPROVE_DAYS in app/orders/[id].tsx.
create function public.auto_complete_stale_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_count integer := 0;
begin
  for v_order in
    select id, freelancer_id
    from public.orders
    where status = 'delivered' and delivered_at <= now() - interval '7 days'
    order by delivered_at
    limit 500
    for update skip locked
  loop
    update public.orders set status = 'completed', completed_at = now() where id = v_order.id;
    update public.payments set status = 'released' where order_id = v_order.id and status = 'captured';
    update public.freelancer_profiles set completed_orders = completed_orders + 1 where user_id = v_order.freelancer_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Only pg_cron (running as the migration owner) needs to call this; no app role should.
revoke all on function public.auto_complete_stale_orders() from public, anon, authenticated;
grant execute on function public.auto_complete_stale_orders() to service_role;

-- Schedule it hourly. If pg_cron is not enabled on this project yet, enable it once from
-- Database -> Extensions in the Supabase dashboard, then re-run just this file.
do $$
begin
  execute 'create extension if not exists pg_cron with schema extensions';
exception when insufficient_privilege then
  raise notice 'pg_cron could not be enabled automatically here; enable it from Database > Extensions in the Supabase dashboard, then re-run this migration file to schedule the job.';
end
$$;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'auto-complete-stale-orders';
  perform cron.schedule('auto-complete-stale-orders', '0 * * * *', $cron$select public.auto_complete_stale_orders();$cron$);
exception when undefined_table or undefined_function then
  raise notice 'pg_cron is not enabled yet; enable it from Database > Extensions, then re-run this migration file to schedule the job.';
end
$$;
