import { supabase } from '@/lib/supabase';

export type PendingCompany = {
  id: string;
  name: string;
  gst_number: string | null;
  udyam_number: string | null;
  owner_name: string | null;
  created_at: string;
};

export type FlaggedMessage = {
  id: string;
  sender_name: string | null;
  violation_types: string[];
  original_body: string;
  created_at: string;
};

export type PayoutDue = {
  order_id: string;
  title: string;
  freelancer_name: string | null;
  earnings_paise: number;
  completed_at: string | null;
};

const list = async <T>(name: string): Promise<T[] | null> => {
  const { data, error } = await supabase.rpc(name);
  return error ? null : ((data ?? []) as T[]);
};

export const fetchPendingCompanies = () => list<PendingCompany>('admin_pending_companies');
export const fetchFlaggedMessages = () => list<FlaggedMessage>('admin_flagged_messages');
export const fetchPayoutsDue = () => list<PayoutDue>('admin_payouts_due');

export const setCompanyVerification = async (companyId: string, status: 'verified' | 'rejected'): Promise<boolean> =>
  !(await supabase.rpc('admin_set_company_verification', { p_company: companyId, p_status: status })).error;

export const markPaidOut = async (orderId: string): Promise<boolean> =>
  !(await supabase.rpc('admin_mark_paid_out', { p_order: orderId })).error;
