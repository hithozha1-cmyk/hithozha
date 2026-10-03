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
