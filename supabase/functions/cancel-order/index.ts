// Cancels an order that has not been paid. The Razorpay payment link is cancelled
// first, so nobody can pay for an order that no longer exists.
import { createClient } from 'npm:@supabase/supabase-js@2';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A browser (the web version of the app) asks permission before calling this function.
// Access is controlled by the bearer token, not cookies, so any origin may call it.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const requiredEnv = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret ${name}`);
  return value;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  const userClient = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  let body: { orderId?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (typeof body.orderId !== 'string' || !UUID.test(body.orderId)) return json({ error: 'invalid_order' }, 400);

  const admin = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  const { data: order } = await admin.from('orders').select('id, client_id, status').eq('id', body.orderId).maybeSingle();
  if (!order || order.client_id !== userId) return json({ error: 'order_not_found' }, 404);
  if (order.status !== 'awaiting_payment') return json({ error: 'order_not_cancellable' }, 409);

  const { data: links } = await admin
    .from('payments')
    .select('razorpay_payment_link_id')
    .eq('order_id', order.id)
    .eq('status', 'created');

  const credentials = btoa(`${requiredEnv('RAZORPAY_KEY_ID')}:${requiredEnv('RAZORPAY_KEY_SECRET')}`);
  const razorpay = (path: string, method: string) =>
    fetch(`https://api.razorpay.com/v1/payment_links/${path}`, { method, headers: { Authorization: `Basic ${credentials}` } });

  for (const link of links ?? []) {
    const id = link.razorpay_payment_link_id;
    if (!id) continue;

    const lookup = await razorpay(id, 'GET');
    if (!lookup.ok) {
      console.error('could not look up payment link', lookup.status);
      return json({ error: 'payment_provider_error' }, 502);
    }
    const { status } = (await lookup.json()) as { status?: string };

    // Already paid: the webhook is about to settle the order, so cancelling would be wrong.
    if (status === 'paid' || status === 'partially_paid') return json({ error: 'already_paid' }, 409);

    if (status === 'created') {
      const cancelled = await razorpay(`${id}/cancel`, 'POST');
      if (!cancelled.ok) {
        console.error('could not cancel payment link', cancelled.status);
        return json({ error: 'payment_provider_error' }, 502);
      }
    }
  }

  const { error } = await admin.rpc('cancel_order', { p_order_id: order.id, p_user_id: userId });
  if (error) {
    console.error('cancel_order failed', error.message);
    return json({ error: error.code === '55000' ? 'order_not_cancellable' : 'server_error' }, error.code === '55000' ? 409 : 500);
  }
  return json({ cancelled: true });
});
