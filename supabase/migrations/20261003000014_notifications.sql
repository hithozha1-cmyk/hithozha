-- In-app notifications. The database writes them itself (triggers on proposals, orders, messages,
-- disputes, reviews, payouts and verifications), so no app code can forget to, and nobody can
-- send one to someone else. People can only read their own and mark them read.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'proposal_received', 'proposal_rejected', 'hired', 'order_paid', 'order_delivered', 'order_completed',
    'order_cancelled', 'message', 'review_received', 'payout_sent', 'dispute_opened', 'dispute_withdrawn',
    'dispute_resolved', 'identity_verified', 'identity_rejected', 'company_verified', 'company_rejected'
  )),
  -- Ids for opening the right screen, plus a few names so the text can be written in the reader's language.
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

create policy "people read their own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create function public.notify_user(p_user uuid, p_kind text, p_data jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, data) values (p_user, p_kind, coalesce(p_data, '{}'::jsonb));
$$;
revoke all on function public.notify_user(uuid, text, jsonb) from public, anon, authenticated;

-- Marks the given notifications read, or every unread one when no list is given.
create function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  update public.notifications
     set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
end;
$$;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Proposals
-- ---------------------------------------------------------------------------
create function public.notify_on_proposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = new.job_id;
  if tg_op = 'INSERT' then
    perform public.notify_user(v_job.client_id, 'proposal_received', jsonb_build_object(
      'job_id', new.job_id, 'proposal_id', new.id, 'title', v_job.title,
      'name', (select full_name from public.profiles where id = new.freelancer_id)));
  elsif new.status = 'rejected' and old.status = 'pending' then
    perform public.notify_user(new.freelancer_id, 'proposal_rejected', jsonb_build_object('job_id', new.job_id, 'title', v_job.title));
  end if;
  return null;
end;
$$;

create trigger proposals_notify_insert after insert on public.proposals
  for each row execute function public.notify_on_proposal();
create trigger proposals_notify_update after update of status on public.proposals
  for each row when (old.status is distinct from new.status) execute function public.notify_on_proposal();

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create function public.notify_on_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data jsonb := jsonb_build_object('order_id', new.id, 'title', new.title);
begin
  if tg_op = 'INSERT' then
    perform public.notify_user(new.freelancer_id, 'hired', v_data || jsonb_build_object(
      'name', (select full_name from public.profiles where id = new.client_id)));
  elsif old.status = 'awaiting_payment' and new.status = 'in_progress' then
    perform public.notify_user(new.freelancer_id, 'order_paid', v_data);
  elsif new.status = 'delivered' and old.status = 'in_progress' then
    perform public.notify_user(new.client_id, 'order_delivered', v_data);
  elsif new.status = 'completed' and old.status = 'delivered' then
    perform public.notify_user(new.freelancer_id, 'order_completed', v_data || jsonb_build_object('amount_paise', new.freelancer_earnings_paise));
  elsif new.status = 'cancelled' and old.status = 'awaiting_payment' then
    perform public.notify_user(new.freelancer_id, 'order_cancelled', v_data);
  end if;
  return null;
end;
$$;

create trigger orders_notify_insert after insert on public.orders
  for each row execute function public.notify_on_order();
create trigger orders_notify_update after update of status on public.orders
  for each row when (old.status is distinct from new.status) execute function public.notify_on_order();

-- ---------------------------------------------------------------------------
-- Disputes: the other person hears when one is opened or withdrawn; both hear the decision.
-- ---------------------------------------------------------------------------
create function public.notify_on_dispute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_other uuid;
  v_data jsonb;
begin
  select * into v_order from public.orders where id = new.order_id;
  v_data := jsonb_build_object('order_id', v_order.id, 'title', v_order.title);
  v_other := case when new.opened_by = v_order.client_id then v_order.freelancer_id else v_order.client_id end;

  if tg_op = 'INSERT' then
    perform public.notify_user(v_other, 'dispute_opened', v_data);
  elsif new.status = 'withdrawn' then
    perform public.notify_user(v_other, 'dispute_withdrawn', v_data);
  elsif new.status = 'resolved' then
    perform public.notify_user(v_order.client_id, 'dispute_resolved', v_data || jsonb_build_object('resolution', new.resolution));
    perform public.notify_user(v_order.freelancer_id, 'dispute_resolved', v_data || jsonb_build_object('resolution', new.resolution));
  end if;
  return null;
end;
$$;

create trigger disputes_notify_insert after insert on public.disputes
  for each row execute function public.notify_on_dispute();
create trigger disputes_notify_update after update of status on public.disputes
  for each row when (old.status is distinct from new.status) execute function public.notify_on_dispute();

-- ---------------------------------------------------------------------------
-- Messages: one notification per chat until it is read, so a busy chat does not flood the inbox.
-- ---------------------------------------------------------------------------
create function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations;
  v_to uuid;
begin
  select * into v_conv from public.conversations where id = new.conversation_id;
  v_to := case when new.sender_id = v_conv.client_id then v_conv.freelancer_id else v_conv.client_id end;
  if exists (
    select 1 from public.notifications
    where user_id = v_to and kind = 'message' and read_at is null and data ->> 'conversation_id' = new.conversation_id::text
  ) then
    return null;
  end if;
  perform public.notify_user(v_to, 'message', jsonb_build_object(
    'conversation_id', new.conversation_id, 'name', (select full_name from public.profiles where id = new.sender_id)));
  return null;
end;
$$;

create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_on_message();

-- ---------------------------------------------------------------------------
-- Reviews, payouts, verifications
-- ---------------------------------------------------------------------------
create function public.notify_on_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_user(new.freelancer_id, 'review_received', jsonb_build_object('order_id', new.order_id, 'rating', new.rating));
  return null;
end;
$$;
create trigger reviews_notify after insert on public.reviews
  for each row execute function public.notify_on_review();

create function public.notify_on_payout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = new.order_id;
  perform public.notify_user(v_order.freelancer_id, 'payout_sent', jsonb_build_object(
    'order_id', v_order.id, 'title', v_order.title, 'amount_paise', v_order.freelancer_earnings_paise, 'reference', new.payout_reference));
  return null;
end;
$$;
create trigger payments_notify_payout after update of paid_out_at on public.payments
  for each row when (old.paid_out_at is null and new.paid_out_at is not null) execute function public.notify_on_payout();

create function public.notify_on_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'verified' then
    perform public.notify_user(new.user_id, 'identity_verified', '{}'::jsonb);
  elsif new.status = 'rejected' then
    perform public.notify_user(new.user_id, 'identity_rejected', jsonb_build_object('reason', new.rejection_reason));
  end if;
  return null;
end;
$$;
create trigger identity_notify after update of status on public.identity_verifications
  for each row when (old.status = 'pending' and new.status <> 'pending') execute function public.notify_on_identity();

create function public.notify_on_company()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_user(new.owner_id, case new.verification_status when 'verified' then 'company_verified' else 'company_rejected' end,
    jsonb_build_object('company_id', new.id, 'name', new.name, 'reason', new.rejection_reason));
  return null;
end;
$$;
create trigger companies_notify after update of verification_status on public.companies
  for each row when (old.verification_status = 'pending' and new.verification_status in ('verified', 'rejected'))
  execute function public.notify_on_company();
