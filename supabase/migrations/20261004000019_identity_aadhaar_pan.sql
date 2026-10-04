-- Identity checks now ask for three photos: the Aadhaar card, the PAN card and a selfie.
-- id_path keeps holding the first ID photo (the Aadhaar card); pan_path is new.
-- Older checks (one ID of any type + selfie) stay readable; their pan_path is empty.

alter table public.identity_verifications add column pan_path text;

alter table public.identity_verifications drop constraint identity_verifications_id_type_check;
alter table public.identity_verifications
  add constraint identity_verifications_id_type_check
  check (id_type in ('aadhaar', 'pan', 'voter', 'driving_licence', 'passport', 'aadhaar_pan'));

alter table public.identity_verifications drop constraint identity_files_deleted_together;
alter table public.identity_verifications
  add constraint identity_files_deleted_together
  check ((files_deleted_at is not null) = (id_path is null and pan_path is null and selfie_path is null));

-- ---------------------------------------------------------------------------
-- Submitting: Aadhaar photo, PAN photo, selfie. All three must be uploaded and different.
-- ---------------------------------------------------------------------------
drop function public.submit_identity_verification(text, text, text);
create function public.submit_identity_verification(p_aadhaar_path text, p_pan_path text, p_selfie_path text)
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
  if p_aadhaar_path is null or p_pan_path is null or p_selfie_path is null
     or p_aadhaar_path !~ v_pattern or p_pan_path !~ v_pattern or p_selfie_path !~ v_pattern
     or p_aadhaar_path = p_pan_path or p_aadhaar_path = p_selfie_path or p_pan_path = p_selfie_path then
    raise exception 'invalid submission' using errcode = '22023';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'identity' and name in (p_aadhaar_path, p_pan_path, p_selfie_path)) <> 3 then
    raise exception 'upload all three photos first' using errcode = '22023';
  end if;

  insert into public.identity_verifications (user_id, id_type, id_path, pan_path, selfie_path)
  values (v_uid, 'aadhaar_pan', p_aadhaar_path, p_pan_path, p_selfie_path)
  returning id into v_id;
  update public.profiles set verification_status = 'pending' where id = v_uid;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: the paths now include the PAN photo (empty for older checks).
-- ---------------------------------------------------------------------------
drop function public.admin_identity_files(uuid, text);
create function public.admin_identity_files(p_id uuid, p_purpose text default 'view')
returns table (id_path text, pan_path text, selfie_path text)
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
  return query select v.id_path, v.pan_path, v.selfie_path;
end;
$$;

create or replace function public.admin_identity_files_deleted(p_id uuid)
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
  if exists (select 1 from storage.objects where bucket_id = 'identity' and name in (v.id_path, v.pan_path, v.selfie_path)) then
    raise exception 'the photos are still stored' using errcode = '55000';
  end if;
  update public.identity_verifications set id_path = null, pan_path = null, selfie_path = null, files_deleted_at = now() where id = p_id;
  perform public.log_admin_action('delete_identity_files', 'identity', p_id::text);
end;
$$;

revoke all on function public.submit_identity_verification(text, text, text) from public, anon;
revoke all on function public.admin_identity_files(uuid, text) from public, anon;
grant execute on function public.submit_identity_verification(text, text, text) to authenticated;
grant execute on function public.admin_identity_files(uuid, text) to authenticated;
