// Starts a Razorpay Subscription for a paid plan and returns its hosted checkout link.
// The Razorpay Plan behind it is created once per (plan_code, cycle) and cached on public.plans,
// so nothing needs to be pre-configured in the Razorpay dashboard.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CYCLES = ['month', 'year'] as const;
type Cycle = (typeof CYCLES)[number];
const isCycle = (value: unknown): value is Cycle => typeof value === 'string' && (CYCLES as readonly string[]).includes(value);

// How many billing cycles to set up: effectively "until cancelled" (10 years monthly, 20 years yearly).
const TOTAL_COUNT: Record<Cycle, number> = { month: 120, year: 20 };
const RAZORPAY_PERIOD: Record<Cycle, string> = { month: 'monthly', year: 'yearly' };

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

  let body: { planCode?: unknown; cycle?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (typeof body.planCode !== 'string' || !isCycle(body.cycle)) return json({ error: 'invalid_request' }, 400);
  const cycle = body.cycle;

  const admin = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  const { data: plan } = await admin
    .from('plans')
    .select('code, audience, name, active, price_month_paise, price_year_paise, razorpay_plan_id_month, razorpay_plan_id_year')
    .eq('code', body.planCode)
    .maybeSingle();
  if (!plan || !plan.active) return json({ error: 'unknown_plan' }, 404);

  const price = cycle === 'month' ? plan.price_month_paise : plan.price_year_paise;
  if (!price || price <= 0) return json({ error: 'plan_not_payable' }, 409);

  if (!Deno.env.get('RAZORPAY_KEY_ID') || !Deno.env.get('RAZORPAY_KEY_SECRET')) return json({ error: 'payments_not_enabled' }, 503);

  const credentials = btoa(`${requiredEnv('RAZORPAY_KEY_ID')}:${requiredEnv('RAZORPAY_KEY_SECRET')}`);
  const razorpay = (path: string, payload: unknown) =>
    fetch(`https://api.razorpay.com/v1/${path}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

  let razorpayPlanId = cycle === 'month' ? plan.razorpay_plan_id_month : plan.razorpay_plan_id_year;

  if (!razorpayPlanId) {
    const planResponse = await razorpay('plans', {
      period: RAZORPAY_PERIOD[cycle],
      interval: 1,
      item: { name: `Hithozha ${plan.name} (${plan.audience}, ${cycle}ly)`, amount: price, currency: 'INR' },
    });
    if (!planResponse.ok) {
      console.error('razorpay plan creation failed', planResponse.status, await planResponse.text());
      return json({ error: 'payment_provider_error' }, 502);
    }
    const created = (await planResponse.json()) as { id?: string };
    if (!created.id) return json({ error: 'payment_provider_error' }, 502);
    razorpayPlanId = created.id;

    const { error: cacheError } = await admin.rpc('cache_razorpay_plan_id', {
      p_plan_code: plan.code,
      p_cycle: cycle,
      p_razorpay_plan_id: razorpayPlanId,
    });
    if (cacheError) console.error('could not cache razorpay plan id', cacheError.message);
  }

  const subscriptionResponse = await razorpay('subscriptions', {
    plan_id: razorpayPlanId,
    customer_notify: 1,
    quantity: 1,
    total_count: TOTAL_COUNT[cycle],
    notes: { user_id: userId, audience: plan.audience, plan_code: plan.code },
  });
  if (!subscriptionResponse.ok) {
    console.error('razorpay subscription creation failed', subscriptionResponse.status, await subscriptionResponse.text());
    return json({ error: 'payment_provider_error' }, 502);
  }
  const subscription = (await subscriptionResponse.json()) as { id?: string; short_url?: string };
  if (!subscription.id || !subscription.short_url) return json({ error: 'payment_provider_error' }, 502);

  const { error: recordError } = await admin.rpc('record_subscription_created', {
    p_user: userId,
    p_audience: plan.audience,
    p_plan_code: plan.code,
    p_cycle: cycle,
    p_razorpay_subscription_id: subscription.id,
    p_checkout_url: subscription.short_url,
  });
  if (recordError) {
    console.error('could not record subscription', recordError.message);
    return json({ error: 'server_error' }, 500);
  }

  return json({ url: subscription.short_url });
});
