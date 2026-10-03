import { supabase } from '@/lib/supabase';
import type { VerificationStatus } from '@/lib/types';

export const ORDER_STATUSES = ['awaiting_payment', 'in_progress', 'delivered', 'completed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

type Person = { full_name: string | null; avatar_url: string | null };

export type Order = {
  id: string;
  proposal_id: string;
  job_id: string;
  client_id: string;
  freelancer_id: string;
  company_id: string | null;
  title: string;
  amount_paise: number;
  platform_fee_paise: number;
  freelancer_earnings_paise: number;
  delivery_days: number;
  status: OrderStatus;
  delivered_at: string | null;
  completed_at: string | null;
  created_at: string;
  client: Person | null;
  freelancer: Person | null;
  company: { id: string; name: string; logo_url: string | null; verification_status: VerificationStatus } | null;
  review: { id: string; rating: number } | null;
};

export const ORDER_SELECT =
  'id, proposal_id, job_id, client_id, freelancer_id, company_id, title, amount_paise, platform_fee_paise, ' +
  'freelancer_earnings_paise, delivery_days, status, delivered_at, completed_at, created_at, ' +
  'client:profiles!client_id(full_name, avatar_url), freelancer:profiles!freelancer_id(full_name, avatar_url), ' +
  'company:companies!company_id(id, name, logo_url, verification_status), review:reviews(id, rating)';

export async function fetchOrders(): Promise<Order[] | null> {
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(100);
  return error ? null : ((data ?? []) as unknown as Order[]);
}

export async function fetchOrder(id: string): Promise<Order | null> {
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle();
  return error || !data ? null : (data as unknown as Order);
}

export type ActionResult = { ok: true } | { ok: false; code?: string };

const rpc = async (name: string, args: Record<string, unknown>): Promise<ActionResult> => {
  const { error } = await supabase.rpc(name, args);
  return error ? { ok: false, code: error.code } : { ok: true };
};

export const acceptProposal = async (proposalId: string): Promise<{ orderId: string } | null> => {
  const { data, error } = await supabase.rpc('accept_proposal', { p_proposal_id: proposalId });
  return error || typeof data !== 'string' ? null : { orderId: data };
};
export const rejectProposal = (proposalId: string) => rpc('reject_proposal', { p_proposal_id: proposalId });
export const markOrderDelivered = (orderId: string) => rpc('mark_order_delivered', { p_order_id: orderId });
export const completeOrder = (orderId: string) => rpc('complete_order', { p_order_id: orderId });
export const submitReview = (orderId: string, rating: number, comment: string) =>
  rpc('submit_review', { p_order_id: orderId, p_rating: rating, p_comment: comment.trim() || null });

/** Asks the server for a Razorpay payment link for this order. */
export async function createPaymentLink(orderId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke<{ url?: string }>('create-payment', { body: { orderId } });
  return error || !data?.url ? null : data.url;
}

export async function cancelUnpaidOrder(orderId: string): Promise<'cancelled' | 'already_paid' | 'failed'> {
  const { data, error } = await supabase.functions.invoke<{ cancelled?: boolean; error?: string }>('cancel-order', {
    body: { orderId },
  });
  if (!error && data?.cancelled) return 'cancelled';
  // A 409 comes back as an error from invoke; the body says why.
  const body = error && 'context' in error ? await (error.context as Response).json().catch(() => null) : null;
  return body?.error === 'already_paid' ? 'already_paid' : 'failed';
}
