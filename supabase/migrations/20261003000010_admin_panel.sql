  -- Admin panel. Every admin function starts with require_admin(), checked on the server,
  -- and every action that changes something writes a row to admin_audit_log.
  
  -- ---------------------------------------------------------------------------
  -- Helpers
  -- ---------------------------------------------------------------------------
  create function public.require_admin()
  returns void
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  begin
    if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  end;
  $$;
  
  -- Lists show only the ends of an ID number; the full number is shown on a detail screen.
  create function public.mask_id(p text)
  returns text
  language sql
  immutable
  set search_path = ''
  as $$
    select case
      when p is null then null
      when length(p) <= 4 then repeat('*', length(p))
      else left(p, 2) || repeat('*', length(p) - 4) || right(p, 2)
    end;
  $$;
  
  create table public.admin_audit_log (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references public.profiles (id),
    action text not null,
    target_type text not null,
    target_id text,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  
  create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
  
  alter table public.admin_audit_log enable row level security;
  revoke all on public.admin_audit_log from anon, authenticated;
  
  create function public.log_admin_action(p_action text, p_target_type text, p_target_id text, p_details jsonb default '{}'::jsonb)
  returns void
  language sql
  security definer
  set search_path = ''
  as $$
    insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
    values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
  $$;
  
  revoke all on function public.require_admin() from public, anon, authenticated;
  revoke all on function public.log_admin_action(text, text, text, jsonb) from public, anon, authenticated;
  
  -- ---------------------------------------------------------------------------
  -- Suspending users. The columns are hidden from the app; people learn their own
  -- status through am_suspended(). Suspended users cannot start new work.
  -- ---------------------------------------------------------------------------
  alter table public.profiles
    add column suspended_at timestamptz,
    add column suspension_reason text;
  
  create function public.am_suspended()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
  as $$
    select coalesce((select suspended_at is not null from public.profiles where id = auth.uid()), false);
  $$;
  
  create function public.block_suspended()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    v_column text;
  begin
    foreach v_column in array tg_argv loop
      if exists (
        select 1 from public.profiles
        where id = (to_jsonb(new) ->> v_column)::uuid and suspended_at is not null
      ) then
        raise exception 'account suspended' using errcode = '42501';
      end if;
    end loop;
    return new;
  end;
  $$;
  
  create trigger jobs_block_suspended before insert on public.jobs
    for each row execute function public.block_suspended('client_id');
  create trigger proposals_block_suspended before insert on public.proposals
    for each row execute function public.block_suspended('freelancer_id');
  create trigger messages_block_suspended before insert on public.messages
    for each row execute function public.block_suspended('sender_id');
  create trigger orders_block_suspended before insert on public.orders
    for each row execute function public.block_suspended('client_id', 'freelancer_id');
  
  create function public.admin_set_user_suspended(p_user uuid, p_suspend boolean, p_reason text default null)
  returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
    v_updated integer;
  begin
    perform public.require_admin();
    if p_user = auth.uid() then raise exception 'you cannot suspend yourself' using errcode = '22023'; end if;
    if p_suspend and (v_reason is null or char_length(v_reason) < 3) then
      raise exception 'a reason is required' using errcode = '22023';
    end if;
    update public.profiles
       set suspended_at = case when p_suspend then now() else null end,
           suspension_reason = case when p_suspend then v_reason else null end
     where id = p_user and is_admin = false;
    get diagnostics v_updated = row_count;
    if v_updated = 0 then raise exception 'user not found or is an admin' using errcode = 'P0002'; end if;
    perform public.log_admin_action(case when p_suspend then 'suspend_user' else 'restore_user' end, 'user', p_user::text,
                                    jsonb_build_object('reason', v_reason));
  end;
  $$;
  
  -- ---------------------------------------------------------------------------
  -- Company verification with reasons, and masked numbers in the queue.
  -- ---------------------------------------------------------------------------
  alter table public.companies add column rejection_reason text;
  
  -- Resubmitting clears the old rejection reason.
  create or replace function public.submit_company_verification(p_gst text default null, p_udyam text default null)
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
  
    update public.companies
       set gst_number = v_gst,
           udyam_number = v_udyam,
           verification_status = 'pending',
           rejection_reason = null
     where owner_id = auth.uid();
  end;
  $$;
  
  drop function public.admin_pending_companies();
  drop function public.admin_set_company_verification(uuid, text);
  
  create function public.admin_pending_companies()
  returns table (id uuid, name text, gst_masked text, udyam_masked text, owner_name text, created_at timestamptz)
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  begin
    perform public.require_admin();
    return query
      select c.id, c.name, public.mask_id(c.gst_number), public.mask_id(c.udyam_number), p.full_name, c.created_at
      from public.companies c
      join public.profiles p on p.id = c.owner_id
      where c.verification_status = 'pending'
      order by c.created_at;
  end;
  $$;
  
  -- The detail screen: full numbers, and the view is recorded.
  create function public.admin_company_detail(p_company uuid)
  returns table (id uuid, name text, gst_number text, udyam_number text, owner_name text, owner_email text,
                 website text, linkedin_url text, team_size text, industry text, city text, about text,
                 verification_status text, created_at timestamptz)
  language plpgsql
  security definer
  set search_path = ''
  as $$
  begin
    perform public.require_admin();
    if not exists (select 1 from public.companies where companies.id = p_company) then
      raise exception 'company not found' using errcode = 'P0002';
    end if;
    perform public.log_admin_action('view_company_ids', 'company', p_company::text);
    return query
      select c.id, c.name, c.gst_number, c.udyam_number, p.full_name, u.email::text, c.website, c.linkedin_url,
             c.team_size, c.industry, c.city, c.about, c.verification_status, c.created_at
      from public.companies c
      join public.profiles p on p.id = c.owner_id
      left join auth.users u on u.id = c.owner_id
      where c.id = p_company;
  end;
  $$;
  
  create function public.admin_set_company_verification(p_company uuid, p_status text, p_reason text default null)
  returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
    v_updated integer;
  begin
    perform public.require_admin();
    if p_status not in ('verified', 'rejected') then raise exception 'status must be verified or rejected' using errcode = '22023'; end if;
    if p_status = 'rejected' and (v_reason is null or char_length(v_reason) < 3) then
      raise exception 'a reason is required' using errcode = '22023';
    end if;
    update public.companies
       set verification_status = p_status,
           rejection_reason = case when p_status = 'rejected' then v_reason else null end
     where id = p_company and verification_status = 'pending';
    get diagnostics v_updated = row_count;
    if v_updated = 0 then raise exception 'no pending company' using errcode = 'P0002'; end if;
    perform public.log_admin_action(case when p_status = 'verified' then 'verify_company' else 'reject_company' end,
                                    'company', p_company::text, jsonb_build_object('reason', v_reason));
  end;
  $$;
  
  -- ---------------------------------------------------------------------------
  -- Payouts: where to pay the freelancer, and the bank reference once paid.
  -- ---------------------------------------------------------------------------
  create table public.payout_details (
    user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
    upi_id text not null check (upi_id ~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z]{2,32}$'),
    account_name text not null check (char_length(account_name) between 2 and 80),
    updated_at timestamptz not null default now()
  );
  
  create trigger payout_details_set_updated_at
    before update on public.payout_details
    for each row execute function public.set_updated_at();
  
  alter table public.payout_details enable row level security;
  revoke all on public.payout_details from anon, authenticated;
  grant select on public.payout_details to authenticated;
  grant insert (user_id, upi_id, account_name), update (user_id, upi_id, account_name) on public.payout_details to authenticated;
  
  create policy "people read their own payout details"
    on public.payout_details for select to authenticated using (user_id = auth.uid());
  
  create policy "freelancers save their own payout details"
    on public.payout_details for insert to authenticated
    with check (
      user_id = auth.uid()
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('freelancer', 'both'))
    );
  
  create policy "freelancers change their own payout details"
    on public.payout_details for update to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
  
  alter table public.payments add column payout_reference text;
  grant select (payout_reference) on public.payments to authenticated;
  
  drop function public.admin_payouts_due();
  drop function public.admin_mark_paid_out(uuid);
  
  create function public.admin_payouts_due()
  returns table (order_id uuid, title text, freelancer_name text, upi_id text, account_name text,
                 earnings_paise integer, completed_at timestamptz)
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  begin
    perform public.require_admin();
    return query
      select o.id, o.title, p.full_name, d.upi_id, d.account_name, o.freelancer_earnings_paise, o.completed_at
      from public.orders o
      join public.payments pay on pay.order_id = o.id and pay.status = 'released' and pay.paid_out_at is null
      join public.profiles p on p.id = o.freelancer_id
      left join public.payout_details d on d.user_id = o.freelancer_id
      order by o.completed_at;
  end;
  $$;
  
  create function public.admin_mark_paid_out(p_order uuid, p_reference text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    v_ref text := btrim(coalesce(p_reference, ''));
    v_updated integer;
  begin
    perform public.require_admin();
    if v_ref !~ '^[A-Za-z0-9-]{6,40}$' then raise exception 'enter the bank reference number (UTR)' using errcode = '22023'; end if;
    update public.payments set paid_out_at = now(), payout_reference = v_ref
     where order_id = p_order and status = 'released' and paid_out_at is null;
    get diagnostics v_updated = row_count;
    if v_updated = 0 then raise exception 'nothing to pay out' using errcode = 'P0002'; end if;
    perform public.log_admin_action('mark_paid_out', 'order', p_order::text, jsonb_build_object('reference', v_ref));
  end;
  $$;
  
  -- ---------------------------------------------------------------------------
  -- Categories: managed through one audited function, not direct table writes.
  -- ---------------------------------------------------------------------------
  alter table public.categories add column is_active boolean not null default true;
  
  drop policy "admins insert categories" on public.categories;
  drop policy "admins update categories" on public.categories;
  drop policy "admins delete categories" on public.categories;
  revoke insert, update, delete on public.categories from authenticated;
  
  create function public.admin_upsert_category(
    p_id uuid, p_slug text, p_name_en text, p_name_ta text, p_icon text, p_sort_order integer, p_active boolean
  )
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    v_id uuid;
  begin
    perform public.require_admin();
    if p_slug !~ '^[a-z0-9-]{2,40}$' then raise exception 'slug must be 2 to 40 lowercase letters, digits or dashes' using errcode = '22023'; end if;
    if char_length(btrim(coalesce(p_name_en, ''))) < 2 or char_length(btrim(coalesce(p_name_ta, ''))) < 2 then
      raise exception 'both names are required' using errcode = '22023';
    end if;
    if p_icon not in ('video', 'monitor', 'pen-tool', 'megaphone', 'camera', 'book-open', 'file-text', 'mic', 'shapes') then
      raise exception 'unknown icon' using errcode = '22023';
    end if;
  
    if p_id is null then
      insert into public.categories (slug, name_en, name_ta, icon, sort_order, is_active)
      values (p_slug, btrim(p_name_en), btrim(p_name_ta), p_icon, coalesce(p_sort_order, 0), coalesce(p_active, true))
      returning id into v_id;
    else
      update public.categories
         set slug = p_slug, name_en = btrim(p_name_en), name_ta = btrim(p_name_ta), icon = p_icon,
             sort_order = coalesce(p_sort_order, 0), is_active = coalesce(p_active, true)
       where id = p_id
       returning id into v_id;
      if v_id is null then raise exception 'category not found' using errcode = 'P0002'; end if;
    end if;
    perform public.log_admin_action(case when p_id is null then 'add_category' else 'edit_category' end, 'category', v_id::text,
                                    jsonb_build_object('slug', p_slug, 'active', coalesce(p_active, true)));
    return v_id;
  end;
  $$;
  
  -- ---------------------------------------------------------------------------
  -- Overview, revenue, lists
  -- ---------------------------------------------------------------------------
  drop function if exists public.admin_close_job(uuid);
  
  create function public.admin_stats()
  returns json
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  declare
    v_today timestamptz := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  begin
    perform public.require_admin();
    return json_build_object(
      'signups_today', (select count(*)::int from public.profiles where created_at >= v_today),
      'users', (select count(*)::int from public.profiles),
      'freelancers', (select count(*)::int from public.profiles where role in ('freelancer', 'both')),
      'clients', (select count(*)::int from public.profiles where role in ('client', 'both')),
      'suspended', (select count(*)::int from public.profiles where suspended_at is not null),
      'jobs_open', (select count(*)::int from public.jobs where status = 'open'),
      'proposals_today', (select count(*)::int from public.proposals where created_at >= v_today),
      'orders_active', (select count(*)::int from public.orders where status in ('awaiting_payment', 'in_progress', 'delivered')),
      'orders_completed', (select count(*)::int from public.orders where status = 'completed'),
      'held_paise', (select coalesce(sum(amount_paise), 0)::bigint from public.orders where status in ('in_progress', 'delivered')),
      'paid_volume_paise', (select coalesce(sum(amount_paise), 0)::bigint from public.orders where status in ('in_progress', 'delivered', 'completed')),
      'platform_fees_paise', (select coalesce(sum(platform_fee_paise), 0)::bigint from public.orders where status = 'completed'),
      'payouts_due_count', (select count(*)::int from public.payments where status = 'released' and paid_out_at is null),
      'payouts_due_paise', (
        select coalesce(sum(o.freelancer_earnings_paise), 0)::bigint
        from public.orders o
        join public.payments p on p.order_id = o.id and p.status = 'released' and p.paid_out_at is null
      ),
      'verifications_pending', (select count(*)::int from public.companies where verification_status = 'pending'),
      'flagged_week', (select count(*)::int from public.chat_violations where created_at > now() - interval '7 days')
    );
  end;
  $$;
  
  -- Commission earned per day or per month (India time), newest first.
  create function public.admin_revenue(p_granularity text default 'day', p_periods integer default 14)
  returns table (period date, orders integer, volume_paise bigint, fees_paise bigint)
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  begin
    perform public.require_admin();
    if p_granularity not in ('day', 'month') then raise exception 'granularity must be day or month' using errcode = '22023'; end if;
    return query
      select date_trunc(p_granularity, o.completed_at at time zone 'Asia/Kolkata')::date as period,
             count(*)::int, sum(o.amount_paise)::bigint, sum(o.platform_fee_paise)::bigint
      from public.orders o
      where o.status = 'completed' and o.completed_at is not null
      group by 1
      order by 1 desc
      limit least(greatest(p_periods, 1), 60);
  end;
  $$;
  
  create function public.admin_users(p_search text default '', p_limit integer default 30, p_offset integer default 0)
  returns table (id uuid, full_name text, email text, role text, city text, created_at timestamptz,
                 suspended_at timestamptz, suspension_reason text, is_admin boolean)
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  declare
    v_term text := '%' || replace(replace(replace(btrim(coalesce(p_search, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  begin
    perform public.require_admin();
    return query
      select p.id, p.full_name, u.email::text, p.role, p.city, p.created_at, p.suspended_at, p.suspension_reason, p.is_admin
      from public.profiles p
      left join auth.users u on u.id = p.id
      where p.full_name ilike v_term or u.email ilike v_term
      order by p.created_at desc
      limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
  end;
  $$;
  
  -- Everything an admin needs to judge one account.
  create function public.admin_user_detail(p_user uuid)
  returns json
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  declare
    v_result json;
  begin
    perform public.require_admin();
    select json_build_object(
      'id', p.id, 'full_name', p.full_name, 'email', u.email, 'role', p.role, 'city', p.city, 'created_at', p.created_at,
      'suspended_at', p.suspended_at, 'suspension_reason', p.suspension_reason, 'is_admin', p.is_admin,
      'company', (select json_build_object('id', c.id, 'name', c.name, 'verification_status', c.verification_status)
                  from public.companies c where c.owner_id = p.id),
      'freelancer', (select json_build_object('headline', f.headline, 'rating_avg', f.rating_avg, 'rating_count', f.rating_count,
                                              'completed_orders', f.completed_orders)
                     from public.freelancer_profiles f where f.user_id = p.id),
      'jobs', (select count(*)::int from public.jobs j where j.client_id = p.id),
      'proposals', (select count(*)::int from public.proposals pr where pr.freelancer_id = p.id),
      'orders_as_client', (select count(*)::int from public.orders o where o.client_id = p.id),
      'orders_as_freelancer', (select count(*)::int from public.orders o where o.freelancer_id = p.id),
      'flagged_messages', (select count(*)::int from public.chat_violations v where v.sender_id = p.id)
    ) into v_result
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.id = p_user;
    if v_result is null then raise exception 'user not found' using errcode = 'P0002'; end if;
    return v_result;
  end;
  $$;
  
  create function public.admin_jobs(p_search text default '', p_status text default null, p_limit integer default 30, p_offset integer default 0)
  returns table (id uuid, title text, poster_name text, status text, job_type text, budget_min_paise integer,
                 budget_max_paise integer, created_at timestamptz, proposals bigint, has_live_order boolean)
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  declare
    v_term text := '%' || replace(replace(replace(btrim(coalesce(p_search, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  begin
    perform public.require_admin();
    return query
      select j.id, j.title, coalesce(c.name, p.full_name), j.status, j.job_type, j.budget_min_paise, j.budget_max_paise,
             j.created_at,
             (select count(*) from public.proposals pr where pr.job_id = j.id),
             exists (select 1 from public.orders o where o.job_id = j.id and o.status <> 'cancelled')
      from public.jobs j
      join public.profiles p on p.id = j.client_id
      left join public.companies c on c.id = j.company_id
      where (j.title ilike v_term or p.full_name ilike v_term or c.name ilike v_term)
        and (p_status is null or j.status = p_status)
      order by j.created_at desc
      limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
  end;
  $$;
  
  -- Takes a job off the board (spam, illegal listing). Refuses if an order is already running on it.
  create function public.admin_close_job(p_job uuid, p_reason text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
    v_updated integer;
  begin
    perform public.require_admin();
    if v_reason is null or char_length(v_reason) < 3 then raise exception 'a reason is required' using errcode = '22023'; end if;
    if exists (select 1 from public.orders where job_id = p_job and status <> 'cancelled') then
      raise exception 'the job has a live order' using errcode = '55000';
    end if;
    update public.jobs set status = 'closed' where id = p_job and status = 'open';
    get diagnostics v_updated = row_count;
    if v_updated = 0 then raise exception 'no open job' using errcode = 'P0002'; end if;
    perform public.log_admin_action('close_job', 'job', p_job::text, jsonb_build_object('reason', v_reason));
  end;
  $$;
  
  create function public.admin_orders(p_status text default null, p_limit integer default 30, p_offset integer default 0)
  returns table (id uuid, title text, client_name text, freelancer_name text, amount_paise integer, platform_fee_paise integer,
                 status text, payment_status text, payout_reference text, paid_out_at timestamptz, created_at timestamptz)
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  begin
    perform public.require_admin();
    return query
      select o.id, o.title, cl.full_name, fr.full_name, o.amount_paise, o.platform_fee_paise, o.status,
             (select pay.status from public.payments pay where pay.order_id = o.id order by pay.created_at desc limit 1),
             (select max(pay.payout_reference) from public.payments pay where pay.order_id = o.id),
             (select max(pay.paid_out_at) from public.payments pay where pay.order_id = o.id),
             o.created_at
      from public.orders o
      join public.profiles cl on cl.id = o.client_id
      join public.profiles fr on fr.id = o.freelancer_id
      where p_status is null or o.status = p_status
      order by o.created_at desc
      limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
  end;
  $$;
  
  create function public.admin_audit_log_list(p_limit integer default 50, p_offset integer default 0)
  returns table (id uuid, admin_name text, action text, target_type text, target_id text, details jsonb, created_at timestamptz)
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  begin
    perform public.require_admin();
    return query
      select l.id, p.full_name, l.action, l.target_type, l.target_id, l.details, l.created_at
      from public.admin_audit_log l
      join public.profiles p on p.id = l.admin_id
      order by l.created_at desc
      limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
  end;
  $$;
  
  drop function public.admin_flagged_messages();
  
  create function public.admin_flagged_messages()
  returns table (id uuid, conversation_id uuid, sender_id uuid, sender_name text, violation_types text[], original_body text, created_at timestamptz)
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  begin
    perform public.require_admin();
    return query
      select v.id, m.conversation_id, v.sender_id, p.full_name, v.violation_types, v.original_body, v.created_at
      from public.chat_violations v
      join public.messages m on m.id = v.message_id
      join public.profiles p on p.id = v.sender_id
      order by v.created_at desc
      limit 50;
  end;
  $$;
  
  -- ---------------------------------------------------------------------------
  -- Permissions: callable by signed-in users, but each function refuses non-admins.
  -- ---------------------------------------------------------------------------
  revoke all on function public.am_suspended() from public, anon;
  revoke all on function public.admin_set_user_suspended(uuid, boolean, text) from public, anon;
  revoke all on function public.admin_pending_companies() from public, anon;
  revoke all on function public.admin_company_detail(uuid) from public, anon;
  revoke all on function public.admin_set_company_verification(uuid, text, text) from public, anon;
  revoke all on function public.admin_flagged_messages() from public, anon;
  revoke all on function public.admin_payouts_due() from public, anon;
  revoke all on function public.admin_mark_paid_out(uuid, text) from public, anon;
  revoke all on function public.admin_upsert_category(uuid, text, text, text, text, integer, boolean) from public, anon;
  revoke all on function public.admin_stats() from public, anon;
  revoke all on function public.admin_revenue(text, integer) from public, anon;
  revoke all on function public.admin_users(text, integer, integer) from public, anon;
  revoke all on function public.admin_user_detail(uuid) from public, anon;
  revoke all on function public.admin_jobs(text, text, integer, integer) from public, anon;
  revoke all on function public.admin_close_job(uuid, text) from public, anon;
  revoke all on function public.admin_orders(text, integer, integer) from public, anon;
  revoke all on function public.admin_audit_log_list(integer, integer) from public, anon;
  grant execute on function public.am_suspended() to authenticated;
  grant execute on function public.admin_set_user_suspended(uuid, boolean, text) to authenticated;
  grant execute on function public.admin_pending_companies() to authenticated;
  grant execute on function public.admin_company_detail(uuid) to authenticated;
  grant execute on function public.admin_set_company_verification(uuid, text, text) to authenticated;
  grant execute on function public.admin_flagged_messages() to authenticated;
  grant execute on function public.admin_payouts_due() to authenticated;
  grant execute on function public.admin_mark_paid_out(uuid, text) to authenticated;
  grant execute on function public.admin_upsert_category(uuid, text, text, text, text, integer, boolean) to authenticated;
  grant execute on function public.admin_stats() to authenticated;
  grant execute on function public.admin_revenue(text, integer) to authenticated;
  grant execute on function public.admin_users(text, integer, integer) to authenticated;
  grant execute on function public.admin_user_detail(uuid) to authenticated;
  grant execute on function public.admin_jobs(text, text, integer, integer) to authenticated;
  grant execute on function public.admin_close_job(uuid, text) to authenticated;
  grant execute on function public.admin_orders(text, integer, integer) to authenticated;
  grant execute on function public.admin_audit_log_list(integer, integer) to authenticated;
