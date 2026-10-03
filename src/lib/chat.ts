import { supabase } from '@/lib/supabase';

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  was_redacted: boolean;
  created_at: string;
};

type Person = { full_name: string | null; avatar_url: string | null };

export type Conversation = {
  id: string;
  proposal_id: string;
  job_id: string;
  client_id: string;
  freelancer_id: string;
  last_message_at: string | null;
  created_at: string;
  job: { title: string } | null;
  client: Person | null;
  freelancer: Person | null;
  lastMessage?: string;
};

export const CONVERSATION_SELECT =
  'id, proposal_id, job_id, client_id, freelancer_id, last_message_at, created_at, ' +
  'job:jobs!job_id(title), client:profiles!client_id(full_name, avatar_url), freelancer:profiles!freelancer_id(full_name, avatar_url)';

const MESSAGE_COLUMNS = 'id, conversation_id, sender_id, body, was_redacted, created_at';

export async function fetchConversations(): Promise<Conversation[] | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) return null;
  const conversations = (data ?? []) as unknown as Conversation[];
  if (conversations.length === 0) return conversations;

  // One extra query for the preview line: newest messages first, keep the first per conversation.
  const { data: recent } = await supabase
    .from('messages')
    .select('conversation_id, body')
    .in('conversation_id', conversations.map((c) => c.id))
    .order('created_at', { ascending: false })
    .limit(300);
  const latest = new Map<string, string>();
  for (const row of recent ?? []) if (!latest.has(row.conversation_id)) latest.set(row.conversation_id, row.body);
  return conversations.map((c) => ({ ...c, lastMessage: latest.get(c.id) }));
}

export async function fetchConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase.from('conversations').select(CONVERSATION_SELECT).eq('id', id).maybeSingle();
  return error || !data ? null : (data as unknown as Conversation);
}

export async function fetchMessages(conversationId: string): Promise<Message[] | null> {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500);
  return error ? null : ((data ?? []) as Message[]);
}

/** Sends through the server, which scans and redacts the text before saving it. */
export async function sendMessage(conversationId: string, body: string): Promise<Message | null> {
  const { data, error } = await supabase.rpc('send_message', { p_conversation_id: conversationId, p_body: body });
  return error || !data ? null : (data as Message);
}

/** Calls back for each new message in a conversation. Returns a function that stops listening. */
export function subscribeToMessages(conversationId: string, onMessage: (message: Message) => void): () => void {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onMessage(payload.new as Message),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Calls back whenever the given order changes (for example when a payment lands). */
export function subscribeToOrder(orderId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`order:${orderId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, onChange)
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
