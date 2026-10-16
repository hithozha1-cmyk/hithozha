import { supabase } from '@/lib/supabase';
import type { Audience } from '@/lib/tokens';

export type SubscriptionStatus = 'created' | 'authenticated' | 'active' | 'paused' | 'cancelled' | 'completed' | 'expired';
export type BillingCycle = 'month' | 'year';

export type Subscription = {
  id: string;
  audience: Audience;
  plan_code: string;
  cycle: BillingCycle;
  status: SubscriptionStatus;
  cancel_requested: boolean;
  current_period_end: string | null;
  created_at: string;
};

const SUBSCRIPTION_COLUMNS = 'id, audience, plan_code, cycle, status, cancel_requested, current_period_end, created_at';

/** Every subscription this account has ever started, newest first. */
export async function fetchMySubscriptions(): Promise<Subscription[] | null> {
  const { data, error } = await supabase.from('subscriptions').select(SUBSCRIPTION_COLUMNS).order('created_at', { ascending: false });
  return error ? null : (data as Subscription[]);
}

/** The subscription actually paying for the membership on this audience right now, if any. */
export function activeSubscription(subscriptions: Subscription[], audience: Audience): Subscription | null {
  return subscriptions.find((s) => s.audience === audience && (s.status === 'active' || s.status === 'authenticated')) ?? null;
}

export type SubscribeStart = { status: 'ok'; url: string } | { status: 'not_enabled' } | { status: 'failed' };

/** Starts a Razorpay subscription and returns its hosted checkout link. */
export async function createSubscription(planCode: string, cycle: BillingCycle): Promise<SubscribeStart> {
  const { data, error } = await supabase.functions.invoke<{ url?: string }>('create-subscription', { body: { planCode, cycle } });
  if (!error && data?.url) return { status: 'ok', url: data.url };
  const body = error && 'context' in error ? await (error.context as Response).json().catch(() => null) : null;
  return body?.error === 'payments_not_enabled' ? { status: 'not_enabled' } : { status: 'failed' };
}

/** Asks Razorpay to stop renewing at the end of the period already paid for. */
export async function cancelSubscription(subscriptionId: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke<{ cancelled?: boolean }>('cancel-subscription', { body: { subscriptionId } });
  return !error && data?.cancelled === true;
}
