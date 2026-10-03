import { supabase } from '@/lib/supabase';

export type Badges = { messages: number; orders: number };

export const NO_BADGES: Badges = { messages: 0, orders: 0 };

/** Unread messages, and orders that are waiting for this person to act. */
export async function fetchBadges(): Promise<Badges> {
  const { data, error } = await supabase.rpc('my_badges');
  return error || !data ? NO_BADGES : (data as Badges);
}

const listeners = new Set<() => void>();

/** Lets screens (like the chat) tell the tab badges to refresh. */
export const onBadgesChanged = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export async function markConversationRead(conversationId: string): Promise<void> {
  await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
  listeners.forEach((listener) => listener());
}
