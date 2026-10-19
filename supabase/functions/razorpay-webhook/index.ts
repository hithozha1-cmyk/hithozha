// Receives Razorpay events. Razorpay does not send a Supabase JWT, so this function
// must be deployed with "Verify JWT" off. It trusts nothing except a valid signature.
import { createClient } from 'npm:@supabase/supabase-js@2';

const requiredEnv = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret ${name}`);
  return value;
};

const ok = (body: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ received: true, ...body }), { status: 200, headers: { 'Content-Type': 'application/json' } });

async function validSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody)));
  const expected = Array.from(mac, (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (expected.length !== signature.length) return false;
  // Compare every character so the time taken does not reveal where they differ.
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return difference === 0;
}

type WebhookEvent = {
  event?: string;
  payload?: {
    payment_link?: { entity?: { id?: string } };
    payment?: { entity?: { id?: string; amount?: number } };
    subscription?: { entity?: { id?: string; current_end?: number } };
  };
};

// subscription.halted behaves like a pause (Razorpay stopped retrying a failed charge) and
// subscription.resumed goes back to active; everything else maps straight onto the status
// check on public.subscriptions. Razorpay has no "subscription.expired" event.
const SUBSCRIPTION_STATUS: Record<string, string> = {
  'subscription.cancelled': 'cancelled',
  'subscription.completed': 'completed',
  'subscription.paused': 'paused',
  'subscription.halted': 'paused',
  'subscription.resumed': 'active',
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  if (!(await validSignature(rawBody, signature, requiredEnv('RAZORPAY_WEBHOOK_SECRET')))) {
    return new Response('invalid signature', { status: 400 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const admin = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  if (event.event === 'payment_link.paid') {
    const linkId = event.payload?.payment_link?.entity?.id;
    const paymentId = event.payload?.payment?.entity?.id;
    const amount = event.payload?.payment?.entity?.amount;
    if (typeof linkId !== 'string' || typeof paymentId !== 'string' || typeof amount !== 'number') {
      return new Response('missing fields', { status: 400 });
    }

    const { data, error } = await admin.rpc('record_payment_captured', {
      p_payment_link_id: linkId,
      p_payment_id: paymentId,
      p_amount_paise: amount,
    });

    if (error) {
      // An unknown link or a mismatched amount will not fix itself, so acknowledge it
      // (retries would be pointless) and leave a trace. Anything else: ask Razorpay to retry.
      if (error.code === 'P0002' || error.code === '22023') {
        console.error('payment not matched', error.code, error.message, { linkId, paymentId, amount });
        return ok({ matched: false });
      }
      console.error('could not record payment', error.message);
      return new Response('server error', { status: 500 });
    }

    if (data === 'needs_refund') {
      // Money arrived for an order that is no longer waiting for payment. Refund it in the Razorpay dashboard.
      console.error('REFUND NEEDED', { linkId, paymentId, amount });
    }
    return ok({ result: data });
  }

  // The first charge (subscription.activated) and every renewal (subscription.charged) both mean
  // the membership is paid through to this billing cycle's end.
  if (event.event === 'subscription.activated' || event.event === 'subscription.charged') {
    const subscriptionId = event.payload?.subscription?.entity?.id;
    const currentEnd = event.payload?.subscription?.entity?.current_end;
    if (typeof subscriptionId !== 'string' || typeof currentEnd !== 'number') {
      return new Response('missing fields', { status: 400 });
    }
    const { error } = await admin.rpc('activate_subscription', {
      p_razorpay_subscription_id: subscriptionId,
      p_current_period_end: new Date(currentEnd * 1000).toISOString(),
    });
    if (error) {
      if (error.code === 'P0002') {
        console.error('subscription not matched', subscriptionId);
        return ok({ matched: false });
      }
      console.error('could not activate subscription', error.message);
      return new Response('server error', { status: 500 });
    }
    return ok();
  }

  const mappedStatus = SUBSCRIPTION_STATUS[event.event ?? ''];
  if (mappedStatus) {
    const subscriptionId = event.payload?.subscription?.entity?.id;
    if (typeof subscriptionId !== 'string') return new Response('missing fields', { status: 400 });
    const { error } = await admin.rpc('set_subscription_status', {
      p_razorpay_subscription_id: subscriptionId,
      p_status: mappedStatus,
    });
    if (error) console.error('could not set subscription status', error.message, { subscriptionId, mappedStatus });
    return ok();
  }

  // Everything else (payment.authorized, order.paid, ...) is acknowledged and ignored.
  return ok({ ignored: event.event ?? null });
});
