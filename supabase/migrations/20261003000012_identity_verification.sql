-- Identity checks for freelancers: an ID photo and a selfie, kept in a PRIVATE storage bucket.
-- Policy: the photos are used only to verify identity. After an admin approves or rejects,
-- the admin deletes them by hand from the admin panel; we do not keep them.
--
--   * Only the person can upload, and only into their own folder. Nobody can read them back
--     except admins, and admins only through short-lived signed links.
--   * Every admin action here (open, approve, reject, delete) is written to admin_audit_log.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identity', 'identity', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "people upload their own identity photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'identity' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "admins read identity photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'identity' and public.is_admin());

create policy "admins delete identity photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'identity' and public.is_admin());

create table public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  id_type text not null check (id_type in ('aadhaar', 'pan', 'voter', 'driving_licence', 'passport')),
  id_path text,
  selfie_path text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  rejection_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  files_deleted_at timestamptz,
  constraint identity_files_deleted_together check ((files_deleted_at is not null) = (id_path is null and selfie_path is null))
);

create unique index identity_one_pending_per_user on public.identity_verifications (user_id) where status = 'pending';
create index identity_status_idx on public.identity_verifications (status, submitted_at);

alter table public.identity_verifications enable row level security;
revoke all on public.identity_verifications from anon, authenticated;
-- The file paths are deliberately not readable from the app.
grant select (id, user_id, id_type, status, rejection_reason, submitted_at, reviewed_at, files_deleted_at)
  on public.identity_verifications to authenticated;

create policy "people read their own identity checks"
  on public.identity_verifications for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Submitting
-- ---------------------------------------------------------------------------
create function public.submit_identity_verification(p_id_type text, p_id_path text, p_selfie_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_pattern text;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found or v_profile.role not in ('freelancer', 'both') then
    raise exception 'only freelancers verify their identity' using errcode = '42501';
  end if;
  if v_profile.verification_status in ('pending', 'verified') then
    raise exception 'already submitted' using errcode = '55000';
  end if;

  v_pattern := '^' || v_uid::text || '/[A-Za-z0-9._-]{1,80}\.(jpg|jpeg|png|webp)$';
  if p_id_type not in ('aadhaar', 'pan', 'voter', 'driving_licence', 'passport')
     or p_id_path is null or p_selfie_path is null
     or p_id_path !~ v_pattern or p_selfie_path !~ v_pattern or p_id_path = p_selfie_path then
    raise exception 'invalid submission' using errcode = '22023';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'identity' and name in (p_id_path, p_selfie_path)) <> 2 then
    raise exception 'upload both photos first' using errcode = '22023';
  end if;

  insert into public.identity_verifications (user_id, id_type, id_path, selfie_path)
  values (v_uid, p_id_type, p_id_path, p_selfie_path)
  returning id into v_id;
  update public.profiles set verification_status = 'pending' where id = v_uid;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
-- p_filter: 'pending' (waiting for review), 'to_delete' (reviewed, photos still stored), 'all'.
create function public.admin_identities(p_filter text default 'pending', p_limit integer default 30, p_offset integer default 0)
returns table (id uuid, user_id uuid, user_name text, id_type text, status text, rejection_reason text,
               submitted_at timestamptz, reviewed_at timestamptz, files_deleted_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  if p_filter not in ('pending', 'to_delete', 'all') then raise exception 'unknown filter' using errcode = '22023'; end if;
  return query
    select v.id, v.user_id, p.full_name, v.id_type, v.status, v.rejection_reason, v.submitted_at, v.reviewed_at, v.files_deleted_at
    from public.identity_verifications v
    join public.profiles p on p.id = v.user_id
    where case p_filter
            when 'pending' then v.status = 'pending'
            when 'to_delete' then v.status <> 'pending' and v.files_deleted_at is null
            else true
          end
    order by v.submitted_at
    limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

-- The storage paths of one check. 'view' is logged; 'delete' is for clearing them after review
-- (the deletion itself is logged by admin_identity_files_deleted).
create function public.admin_identity_files(p_id uuid, p_purpose text default 'view')
returns table (id_path text, selfie_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.identity_verifications;
begin
  perform public.require_admin();
  if p_purpose not in ('view', 'delete') then raise exception 'unknown purpose' using errcode = '22023'; end if;
  select * into v from public.identity_verifications where identity_verifications.id = p_id;
  if not found then raise exception 'check not found' using errcode = 'P0002'; end if;
  if v.id_path is null then raise exception 'the photos were already deleted' using errcode = '55000'; end if;
  if p_purpose = 'delete' and v.status = 'pending' then
    raise exception 'review the check before deleting its photos' using errcode = '55000';
  end if;
  if p_purpose = 'view' then
    perform public.log_admin_action('view_identity', 'identity', p_id::text);
  end if;
  return query select v.id_path, v.selfie_path;
end;
$$;

create function public.admin_review_identity(p_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v public.identity_verifications;
begin
  perform public.require_admin();
  if p_status not in ('verified', 'rejected') then raise exception 'status must be verified or rejected' using errcode = '22023'; end if;
  if p_status = 'rejected' and (v_reason is null or char_length(v_reason) < 3) then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  select * into v from public.identity_verifications where id = p_id for update;
  if not found or v.status <> 'pending' then raise exception 'no pending check' using errcode = 'P0002'; end if;

  update public.identity_verifications
     set status = p_status, rejection_reason = case when p_status = 'rejected' then v_reason end,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
  update public.profiles set verification_status = p_status where id = v.user_id;
  perform public.log_admin_action(case when p_status = 'verified' then 'verify_identity' else 'reject_identity' end,
                                  'identity', p_id::text, jsonb_build_object('reason', v_reason));
end;
$$;

-- Called after the admin has removed the photos from storage. Refuses if they are still there.
create function public.admin_identity_files_deleted(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.identity_verifications;
begin
  perform public.require_admin();
  select * into v from public.identity_verifications where id = p_id for update;
  if not found then raise exception 'check not found' using errcode = 'P0002'; end if;
  if v.status = 'pending' then raise exception 'review the check before deleting its photos' using errcode = '55000'; end if;
  if v.id_path is null then return; end if;
  if exists (select 1 from storage.objects where bucket_id = 'identity' and name in (v.id_path, v.selfie_path)) then
    raise exception 'the photos are still stored' using errcode = '55000';
  end if;
  update public.identity_verifications set id_path = null, selfie_path = null, files_deleted_at = now() where id = p_id;
  perform public.log_admin_action('delete_identity_files', 'identity', p_id::text);
end;
$$;

-- The overview also counts identity checks waiting and photos that should be deleted.
create or replace function public.admin_stats()
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
    'orders_active', (select count(*)::int from public.orders where status in ('awaiting_payment', 'in_progress', 'delivered', 'disputed')),
    'orders_completed', (select count(*)::int from public.orders where status = 'completed'),
    'held_paise', (select coalesce(sum(amount_paise), 0)::bigint from public.orders where status in ('in_progress', 'delivered', 'disputed')),
    'paid_volume_paise', (select coalesce(sum(amount_paise - refunded_paise), 0)::bigint from public.orders where status in ('in_progress', 'delivered', 'disputed', 'completed')),
    'platform_fees_paise', (select coalesce(sum(platform_fee_paise), 0)::bigint from public.orders where status = 'completed'),
    'payouts_due_count', (select count(*)::int from public.payments where status = 'released' and paid_out_at is null),
    'payouts_due_paise', (
      select coalesce(sum(o.freelancer_earnings_paise), 0)::bigint
      from public.orders o
      join public.payments p on p.order_id = o.id and p.status = 'released' and p.paid_out_at is null
    ),
    'verifications_pending', (select count(*)::int from public.companies where verification_status = 'pending'),
    'flagged_week', (select count(*)::int from public.chat_violations where created_at > now() - interval '7 days'),
    'disputes_open', (select count(*)::int from public.disputes where status = 'open'),
    'identities_pending', (select count(*)::int from public.identity_verifications where status = 'pending'),
    'identity_photos_to_delete', (select count(*)::int from public.identity_verifications where status <> 'pending' and files_deleted_at is null)
  );
end;
$$;

revoke all on function public.submit_identity_verification(text, text, text) from public, anon;
revoke all on function public.admin_identities(text, integer, integer) from public, anon;
revoke all on function public.admin_identity_files(uuid, text) from public, anon;
revoke all on function public.admin_review_identity(uuid, text, text) from public, anon;
revoke all on function public.admin_identity_files_deleted(uuid) from public, anon;
grant execute on function public.submit_identity_verification(text, text, text) to authenticated;
grant execute on function public.admin_identities(text, integer, integer) to authenticated;
grant execute on function public.admin_identity_files(uuid, text) to authenticated;
grant execute on function public.admin_review_identity(uuid, text, text) to authenticated;
grant execute on function public.admin_identity_files_deleted(uuid) to authenticated;
