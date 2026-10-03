import type { Href } from 'expo-router';

import { supabase } from '@/lib/supabase';

export type NotificationKind =
  | 'proposal_received'
  | 'proposal_rejected'
  | 'hired'
  | 'order_paid'
  | 'order_delivered'
  | 'order_completed'
  | 'order_cancelled'
  | 'message'
  | 'review_received'
  | 'payout_sent'
  | 'dispute_opened'
  | 'dispute_withdrawn'
  | 'dispute_resolved'
  | 'identity_verified'
  | 'identity_rejected'
  | 'company_verified'
  | 'company_rejected';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  data: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Where tapping a notification should go, or null when there is nowhere useful to go. */
export function notificationHref(n: Pick<AppNotification, 'kind' | 'data'>): Href | null {
  const { data } = n;
  switch (n.kind) {
    case 'proposal_received':
      return data.job_id ? { pathname: '/jobs/proposals/[id]', params: { id: text(data.job_id) } } : null;
    case 'proposal_rejected':
      return data.job_id ? { pathname: '/jobs/[id]', params: { id: text(data.job_id) } } : null;
    case 'message':
      return data.conversation_id ? { pathname: '/chat/[id]', params: { id: text(data.conversation_id) } } : null;
    case 'identity_verified':
    case 'identity_rejected':
      return '/account/verify-identity';
    case 'company_verified':
    case 'company_rejected':
      return data.company_id ? { pathname: '/company/[id]', params: { id: text(data.company_id) } } : null;
    default:
      return data.order_id ? { pathname: '/orders/[id]', params: { id: text(data.order_id) } } : null;
  }
}

export async function fetchNotifications(): Promise<AppNotification[] | null> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, kind, data, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(50);
  return error ? null : ((data ?? []) as AppNotification[]);
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  return error ? 0 : (count ?? 0);
}

export const markRead = async (ids?: string[]): Promise<boolean> =>
  !(await supabase.rpc('mark_notifications_read', { p_ids: ids ?? null })).error;

/** Calls `onInsert` whenever a new notification arrives for this person. Returns a function that stops listening. */
export function subscribeToNotifications(userId: string, onInsert: () => void): () => void {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, onInsert)
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

// Lets the inbox screen tell the bell to recount after marking things read.
const listeners = new Set<() => void>();
export const onUnreadChanged = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const announceUnreadChanged = (): void => listeners.forEach((listener) => listener());
