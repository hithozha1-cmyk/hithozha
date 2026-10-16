// Asks Razorpay to stop a subscription at the end of the period already paid for, so the
// membership keeps working until then instead of cutting off immediately.
import { createClient } from 'npm:@supabase/supabase-js@2';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // This client carries the caller's own identity, so subscription_for_cancel's auth.uid()
  // ownership check is the thing that actually protects someone else's subscription.
  const userClient = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);

  let body: { subscriptionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (typeof body.subscriptionId !== 'string' || !UUID.test(body.subscriptionId)) return json({ error: 'invalid_request' }, 400);

  const { data: razorpaySubscriptionId, error: lookupError } = await userClient.rpc('subscription_for_cancel', {
    p_subscription_id: body.subscriptionId,
  });
  if (lookupError || !razorpaySubscriptionId) {
    return json({ error: lookupError?.code === '55000' ? 'not_cancellable' : 'subscription_not_found' }, 404);
  }

  const credentials = btoa(`${requiredEnv('RAZORPAY_KEY_ID')}:${requiredEnv('RAZORPAY_KEY_SECRET')}`);
  const cancelResponse = await fetch(`https://api.razorpay.com/v1/subscriptions/${razorpaySubscriptionId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cancel_at_cycle_end: 1 }),
  });
  if (!cancelResponse.ok) {
    console.error('razorpay cancel failed', cancelResponse.status, await cancelResponse.text());
    return json({ error: 'payment_provider_error' }, 502);
  }

  const { error: markError } = await userClient.rpc('mark_subscription_cancel_requested', { p_subscription_id: body.subscriptionId });
  if (markError) console.error('could not mark cancel requested', markError.message);

  return json({ cancelled: true });
});
