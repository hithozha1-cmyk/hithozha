import { supabase } from '@/lib/supabase';

// Every call here goes to a database function that checks is_admin() itself,
// so hiding the screen in the app is a convenience, not the protection.

export type AdminStats = {
  signups_today: number;
  users: number;
  freelancers: number;
  clients: number;
  suspended: number;
  jobs_open: number;
  proposals_today: number;
  orders_active: number;
  orders_completed: number;
  held_paise: number;
  paid_volume_paise: number;
  platform_fees_paise: number;
  payouts_due_count: number;
  payouts_due_paise: number;
  verifications_pending: number;
  flagged_week: number;
  disputes_open: number;
  identities_pending: number;
  identity_photos_to_delete: number;
};

export type RevenueRow = { period: string; orders: number; volume_paise: number; fees_paise: number };

export type AdminUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  city: string | null;
  created_at: string;
  suspended_at: string | null;
  suspension_reason: string | null;
  is_admin: boolean;
};

export type AdminUserDetail = AdminUser & {
  company: { id: string; name: string; verification_status: string } | null;
  freelancer: { headline: string | null; rating_avg: number; rating_count: number; completed_orders: number } | null;
  jobs: number;
  proposals: number;
  orders_as_client: number;
  orders_as_freelancer: number;
  flagged_messages: number;
};

export type AdminJob = {
  id: string;
  title: string;
  poster_name: string | null;
  status: string;
  job_type: string;
  budget_min_paise: number;
  budget_max_paise: number;
  created_at: string;
  proposals: number;
  has_live_order: boolean;
};

export type AdminOrder = {
  id: string;
  title: string;
  client_name: string | null;
  freelancer_name: string | null;
  amount_paise: number;
  platform_fee_paise: number;
  status: string;
  payment_status: string | null;
  payout_reference: string | null;
  paid_out_at: string | null;
  created_at: string;
};

export type PendingCompany = {
  id: string;
  name: string;
  gst_masked: string | null;
  udyam_masked: string | null;
  owner_name: string | null;
  created_at: string;
};

export type CompanyDetail = {
  id: string;
  name: string;
  gst_number: string | null;
  udyam_number: string | null;
  owner_name: string | null;
  owner_email: string | null;
  website: string | null;
  linkedin_url: string | null;
  team_size: string | null;
  industry: string | null;
  city: string | null;
  about: string | null;
  verification_status: string;
  created_at: string;
};

export type FlaggedMessage = {
  id: string;
  sender_id: string;
  sender_name: string | null;
  violation_types: string[];
  original_body: string;
  created_at: string;
};

export type PayoutDue = {
  order_id: string;
  title: string;
  freelancer_name: string | null;
  upi_id: string | null;
  account_name: string | null;
  earnings_paise: number;
  completed_at: string | null;
};

export type AuditEntry = {
  id: string;
  admin_name: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type Result<T> = { ok: true; data: T } | { ok: false };

async function call<T>(name: string, args?: Record<string, unknown>): Promise<Result<T>> {
  const { data, error } = await supabase.rpc(name, args);
  return error ? { ok: false } : { ok: true, data: data as T };
}

export const PAGE_SIZE = 30;

export type AdminReport = {
  id: string;
  reporter_id: string;
  reporter_name: string | null;
  target_type: 'user' | 'job';
  target_user: string | null;
  target_job: string | null;
  target_name: string | null;
  reason: string;
  details: string | null;
  status: 'open' | 'dismissed' | 'actioned';
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};
export type ReportFilter = 'open' | 'closed' | 'all';

export const fetchStats = () => call<AdminStats>('admin_stats');
export const fetchRevenue = (granularity: 'day' | 'month') => call<RevenueRow[]>('admin_revenue', { p_granularity: granularity, p_periods: 14 });

export const fetchUsers = (search: string, offset: number) => call<AdminUser[]>('admin_users', { p_search: search, p_limit: PAGE_SIZE, p_offset: offset });
export const fetchUserDetail = (id: string) => call<AdminUserDetail>('admin_user_detail', { p_user: id });
export const setSuspended = (id: string, suspend: boolean, reason: string) =>
  call<null>('admin_set_user_suspended', { p_user: id, p_suspend: suspend, p_reason: reason });

export const fetchJobs = (search: string, status: string | null, offset: number) =>
  call<AdminJob[]>('admin_jobs', { p_search: search, p_status: status, p_limit: PAGE_SIZE, p_offset: offset });
export const closeJob = (id: string, reason: string) => call<null>('admin_close_job', { p_job: id, p_reason: reason });

export const fetchOrders = (status: string | null, offset: number) =>
  call<AdminOrder[]>('admin_orders', { p_status: status, p_limit: PAGE_SIZE, p_offset: offset });

export const fetchPendingCompanies = () => call<PendingCompany[]>('admin_pending_companies');
export const fetchCompanyDetail = (id: string) => call<CompanyDetail[]>('admin_company_detail', { p_company: id });
export const reviewCompany = (id: string, status: 'verified' | 'rejected', reason: string | null) =>
  call<null>('admin_set_company_verification', { p_company: id, p_status: status, p_reason: reason });

export const fetchFlaggedMessages = () => call<FlaggedMessage[]>('admin_flagged_messages');

export const fetchPayoutsDue = () => call<PayoutDue[]>('admin_payouts_due');
export const markPaidOut = (orderId: string, reference: string) => call<null>('admin_mark_paid_out', { p_order: orderId, p_reference: reference });

export const saveCategory = (c: { id: string | null; slug: string; nameEn: string; nameTa: string; icon: string; sort: number; active: boolean }) =>
  call<string>('admin_upsert_category', {
    p_id: c.id,
    p_slug: c.slug,
    p_name_en: c.nameEn,
    p_name_ta: c.nameTa,
    p_icon: c.icon,
    p_sort_order: c.sort,
    p_active: c.active,
  });

export const fetchAuditLog = (offset: number) => call<AuditEntry[]>('admin_audit_log_list', { p_limit: PAGE_SIZE, p_offset: offset });

/** True for a bank reference (UTR) the database will accept. Mirrors admin_mark_paid_out. */
export const isValidReference = (value: string): boolean => /^[A-Za-z0-9-]{6,40}$/.test(value.trim());

export type AdminDispute = {
  id: string;
  order_id: string;
  title: string;
  client_name: string | null;
  freelancer_name: string | null;
  opened_by_name: string | null;
  opened_by_role: 'client' | 'freelancer';
  reason: string;
  status: 'open' | 'resolved' | 'withdrawn';
  resolution: 'refund' | 'release' | 'split' | null;
  refund_paise: number | null;
  refund_reference: string | null;
  decision_note: string | null;
  amount_paise: number;
  platform_fee_paise: number;
  previous_status: string;
  created_at: string;
  resolved_at: string | null;
};

export type DisputeMessage = { id: string; sender_name: string | null; sender_role: 'client' | 'freelancer'; body: string; created_at: string };

export type Resolution = 'refund' | 'release' | 'split';

export const fetchDisputes = (status: string | null, offset: number) =>
  call<AdminDispute[]>('admin_disputes', { p_status: status, p_limit: PAGE_SIZE, p_offset: offset });
export const fetchDisputeMessages = (id: string) => call<DisputeMessage[]>('admin_dispute_messages', { p_dispute_id: id });
export const resolveDispute = (id: string, resolution: Resolution, refundPaise: number, reference: string | null, note: string) =>
  call<null>('admin_resolve_dispute', { p_dispute_id: id, p_resolution: resolution, p_refund_paise: refundPaise, p_reference: reference, p_note: note });

export type AdminIdentity = {
  id: string;
  user_id: string;
  user_name: string | null;
  id_type: string;
  status: 'pending' | 'verified' | 'rejected';
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  files_deleted_at: string | null;
};

export type IdentityFilter = 'pending' | 'to_delete' | 'all';

export const fetchIdentities = (filter: IdentityFilter, offset: number) =>
  call<AdminIdentity[]>('admin_identities', { p_filter: filter, p_limit: PAGE_SIZE, p_offset: offset });
/**
 * Decides an identity check through the review-identity Edge Function, which saves the decision
 * (the database refuses non-admins) and emails the freelancer. `emailed` is false when the
 * decision was saved but the email could not be sent.
 */
export async function reviewIdentity(id: string, status: 'verified' | 'rejected', reason: string | null): Promise<Result<{ emailed: boolean }>> {
  const { data, error } = await supabase.functions.invoke<{ reviewed?: boolean; emailed?: boolean }>('review-identity', { body: { id, status, reason } });
  return error || !data?.reviewed ? { ok: false } : { ok: true, data: { emailed: data.emailed === true } };
}

type IdentityPaths = { id_path: string; pan_path: string | null; selfie_path: string };

export type IdentityPhotoUrls = { aadhaarUrl: string; panUrl: string | null; selfieUrl: string };

/** Short-lived signed links (60 seconds) to the Aadhaar, PAN and selfie photos. Opening them is audit-logged. */
export async function openIdentityPhotos(id: string): Promise<IdentityPhotoUrls | null> {
  const files = await call<IdentityPaths[]>('admin_identity_files', { p_id: id, p_purpose: 'view' });
  if (!files.ok || !files.data[0]) return null;
  const { id_path, pan_path, selfie_path } = files.data[0];
  const paths = [id_path, ...(pan_path ? [pan_path] : []), selfie_path];
  const { data, error } = await supabase.storage.from('identity').createSignedUrls(paths, 60);
  const urls = (data ?? []).map((entry) => entry.signedUrl).filter((url): url is string => !!url);
  if (error || urls.length !== paths.length) return null;
  // Older checks have no PAN photo: their list is [id, selfie].
  return pan_path ? { aadhaarUrl: urls[0], panUrl: urls[1], selfieUrl: urls[2] } : { aadhaarUrl: urls[0], panUrl: null, selfieUrl: urls[1] };
}

/** Removes the photos from storage, then records that they are gone. Only after the check is reviewed. */
export async function deleteIdentityPhotos(id: string): Promise<boolean> {
  const files = await call<IdentityPaths[]>('admin_identity_files', { p_id: id, p_purpose: 'delete' });
  if (!files.ok || !files.data[0]) return false;
  const { id_path, pan_path, selfie_path } = files.data[0];
  const removed = await supabase.storage.from('identity').remove([id_path, ...(pan_path ? [pan_path] : []), selfie_path]);
  if (removed.error) return false;
  return (await call<null>('admin_identity_files_deleted', { p_id: id })).ok;
}

export const fetchReports = (status: ReportFilter, offset: number) =>
  call<AdminReport[]>('admin_reports', { p_status: status, p_limit: PAGE_SIZE, p_offset: offset });
export const closeReport = (id: string, outcome: 'dismissed' | 'actioned', note: string | null) =>
  call<null>('admin_close_report', { p_id: id, p_outcome: outcome, p_note: note });

export type UserTokens = {
  free: number;
  bought: number;
  freelancer_plan: string;
  freelancer_expires: string | null;
  client_plan: string;
  client_expires: string | null;
};

export const fetchUserTokens = async (userId: string): Promise<Result<UserTokens>> => {
  const r = await call<UserTokens[]>('admin_user_tokens', { p_user: userId });
  return r.ok && r.data[0] ? { ok: true, data: r.data[0] } : { ok: false };
};
export const setMembership = (userId: string, planCode: string, months: number | null) =>
  call<null>('admin_set_membership', { p_user: userId, p_plan_code: planCode, p_months: months });
export const giveTokens = (userId: string, amount: number, reason: string) =>
  call<null>('admin_grant_tokens', { p_user: userId, p_amount: amount, p_reason: reason });
