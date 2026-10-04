import { supabase } from '@/lib/supabase';
import type { VerificationStatus } from '@/lib/types';

export const ORDER_STATUSES = ['awaiting_payment', 'in_progress', 'delivered', 'disputed', 'completed', 'cancelled'] as const;
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
  refunded_paise: number;
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
  'freelancer_earnings_paise, refunded_paise, delivery_days, status, delivered_at, completed_at, created_at, ' +
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

export type PaymentStart = { status: 'ok'; url: string } | { status: 'not_enabled' } | { status: 'failed' };

/** Asks the server for a payment link for this order. */
export async function createPaymentLink(orderId: string): Promise<PaymentStart> {
  const { data, error } = await supabase.functions.invoke<{ url?: string }>('create-payment', { body: { orderId } });
  if (!error && data?.url) return { status: 'ok', url: data.url };
  // A 503 comes back as an error from invoke; the body says why.
  const body = error && 'context' in error ? await (error.context as Response).json().catch(() => null) : null;
  return body?.error === 'payments_not_enabled' ? { status: 'not_enabled' } : { status: 'failed' };
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

export type Dispute = {
  id: string;
  order_id: string;
  opened_by: string;
  reason: string;
  status: 'open' | 'resolved' | 'withdrawn';
  resolution: 'refund' | 'release' | 'split' | null;
  refund_paise: number | null;
  refund_reference: string | null;
  decision_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

/** The latest dispute on an order, or null when there is none (or it was withdrawn). */
export async function fetchDispute(orderId: string): Promise<Dispute | null> {
  const { data } = await supabase
    .from('disputes')
    .select('id, order_id, opened_by, reason, status, resolution, refund_paise, refund_reference, decision_note, created_at, resolved_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const dispute = data as Dispute | null;
  return dispute && dispute.status !== 'withdrawn' ? dispute : null;
}

export const openDispute = (orderId: string, reason: string) => rpc('open_dispute', { p_order_id: orderId, p_reason: reason });
export const withdrawDispute = (disputeId: string) => rpc('withdraw_dispute', { p_dispute_id: disputeId });
