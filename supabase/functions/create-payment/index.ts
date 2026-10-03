// Creates a Razorpay payment link for an order the caller is the client of.
// The amount always comes from the database, never from the app.
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

  const { data: order } = await admin
    .from('orders')
    .select('id, client_id, title, amount_paise, status')
    .eq('id', body.orderId)
    .maybeSingle();
  if (!order || order.client_id !== userId) return json({ error: 'order_not_found' }, 404);
  if (order.status !== 'awaiting_payment') return json({ error: 'order_not_payable' }, 409);

  // Reuse the open link instead of creating a second one.
  const { data: existing } = await admin
    .from('payments')
    .select('payment_url')
    .eq('order_id', order.id)
    .eq('status', 'created')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.payment_url) return json({ url: existing.payment_url });

  const credentials = btoa(`${requiredEnv('RAZORPAY_KEY_ID')}:${requiredEnv('RAZORPAY_KEY_SECRET')}`);
  const response = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: order.amount_paise,
      currency: 'INR',
      accept_partial: false,
      reference_id: order.id,
      description: `Hithozha: ${order.title}`.slice(0, 200),
      notes: { order_id: order.id },
      reminder_enable: false,
    }),
  });
  if (!response.ok) {
    console.error('razorpay payment link failed', response.status, await response.text());
    return json({ error: 'payment_provider_error' }, 502);
  }
  const link = (await response.json()) as { id?: string; short_url?: string };
  if (!link.id || !link.short_url) return json({ error: 'payment_provider_error' }, 502);

  const { error: insertError } = await admin.from('payments').insert({
    order_id: order.id,
    razorpay_payment_link_id: link.id,
    payment_url: link.short_url,
    amount_paise: order.amount_paise,
  });
  if (insertError) {
    console.error('could not record payment link', insertError.message);
    return json({ error: 'server_error' }, 500);
  }

  return json({ url: link.short_url });
});
