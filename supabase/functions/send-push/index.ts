// Sends a phone push notification when a row is added to the notifications table.
// A Supabase Database Webhook (INSERT on public.notifications) calls this function with a shared
// secret in the x-webhook-secret header. Phones that Expo says no longer exist are forgotten.
import { createClient } from 'npm:@supabase/supabase-js@2';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const requiredEnv = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret ${name}`);
  return value;
};

/** Compares two strings without stopping at the first difference, so timing reveals nothing. */
function sameSecret(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

type Language = 'ta' | 'en';
type Text = { title: string; body: string };

// The same wording as the in-app inbox (notifications.kinds in src/i18n).
const TEXT: Record<string, Record<Language, Text>> = {
  proposal_received: { en: { title: 'New proposal', body: '{{name}} sent a proposal for {{title}}.' }, ta: { title: 'புதிய முன்மொழிவு', body: '{{title}} க்கு {{name}} முன்மொழிவு அனுப்பினார்.' } },
  proposal_rejected: { en: { title: 'Proposal not accepted', body: 'Your proposal for {{title}} was not accepted.' }, ta: { title: 'முன்மொழிவு ஏற்கப்படவில்லை', body: '{{title}} க்கான உங்கள் முன்மொழிவு ஏற்கப்படவில்லை.' } },
  hired: { en: { title: 'You were hired', body: '{{name}} hired you for {{title}}. The client pays next.' }, ta: { title: 'உங்களை வேலைக்கு எடுத்தனர்', body: '{{title}} க்காக {{name}} உங்களை வேலைக்கு எடுத்தார். அடுத்து வாடிக்கையாளர் பணம் செலுத்துவார்.' } },
  order_paid: { en: { title: 'Payment received', body: '{{title}} is paid and held safely. You can start the work.' }, ta: { title: 'பணம் வந்தது', body: '{{title}} க்கான பணம் செலுத்தப்பட்டு பாதுகாப்பாக வைக்கப்பட்டுள்ளது. வேலையைத் தொடங்கலாம்.' } },
  order_delivered: { en: { title: 'Work delivered', body: '{{title}} was delivered. Check it and approve to release the payment.' }, ta: { title: 'வேலை ஒப்படைக்கப்பட்டது', body: '{{title}} ஒப்படைக்கப்பட்டது. பார்த்து, பணத்தை விடுவிக்க ஏற்கவும்.' } },
  order_completed: { en: { title: 'Order approved', body: '{{title}} was approved. {{amount}} is on its way to you.' }, ta: { title: 'ஆர்டர் ஏற்கப்பட்டது', body: '{{title}} ஏற்கப்பட்டது. {{amount}} உங்களுக்கு வந்துகொண்டிருக்கிறது.' } },
  order_cancelled: { en: { title: 'Order cancelled', body: '{{title}} was cancelled before payment.' }, ta: { title: 'ஆர்டர் ரத்து', body: '{{title}} பணம் செலுத்தும் முன் ரத்து செய்யப்பட்டது.' } },
  message: { en: { title: 'New message', body: '{{name}} sent you a message.' }, ta: { title: 'புதிய செய்தி', body: '{{name}} உங்களுக்குச் செய்தி அனுப்பினார்.' } },
  review_received: { en: { title: 'New review', body: 'You got {{rating}} out of 5.' }, ta: { title: 'புதிய மதிப்புரை', body: 'உங்களுக்கு 5 இல் {{rating}} கிடைத்தது.' } },
  payout_sent: { en: { title: 'Payout sent', body: '{{amount}} for {{title}} was sent to you. Reference {{reference}}.' }, ta: { title: 'பணம் அனுப்பப்பட்டது', body: '{{title}} க்கான {{amount}} உங்களுக்கு அனுப்பப்பட்டது. குறிப்பு எண் {{reference}}.' } },
  dispute_opened: { en: { title: 'Problem reported', body: 'A problem was reported on {{title}}. Our team will decide.' }, ta: { title: 'பிரச்சினை புகாரளிக்கப்பட்டது', body: '{{title}} இல் ஒரு பிரச்சினை புகாரளிக்கப்பட்டது. எங்கள் குழு முடிவு செய்யும்.' } },
  dispute_withdrawn: { en: { title: 'Problem withdrawn', body: 'The problem reported on {{title}} was withdrawn.' }, ta: { title: 'புகார் திரும்பப் பெறப்பட்டது', body: '{{title}} இல் புகாரளிக்கப்பட்ட பிரச்சினை திரும்பப் பெறப்பட்டது.' } },
  dispute_resolved: { en: { title: 'Dispute decided', body: 'Our team decided the dispute on {{title}}. Open the order to read it.' }, ta: { title: 'சர்ச்சை தீர்க்கப்பட்டது', body: '{{title}} இன் சர்ச்சையை எங்கள் குழு தீர்த்தது. படிக்க ஆர்டரைத் திறக்கவும்.' } },
  identity_verified: { en: { title: 'Identity verified', body: 'You can now apply to jobs.' }, ta: { title: 'அடையாளம் சரிபார்க்கப்பட்டது', body: 'இனி வேலைகளுக்கு விண்ணப்பிக்கலாம்.' } },
  identity_rejected: { en: { title: 'Identity not verified', body: 'We could not verify you. Open to read why and send new photos.' }, ta: { title: 'அடையாளம் சரிபார்க்கப்படவில்லை', body: 'உங்களைச் சரிபார்க்க முடியவில்லை. காரணத்தைப் படிக்கவும், புதிய புகைப்படங்களை அனுப்பவும்.' } },
  company_verified: { en: { title: 'Business verified', body: '{{name}} now has the verified badge.' }, ta: { title: 'நிறுவனம் சரிபார்க்கப்பட்டது', body: '{{name}} இப்போது சரிபார்க்கப்பட்ட அடையாளத்தைப் பெற்றுள்ளது.' } },
  company_rejected: { en: { title: 'Business not verified', body: 'We could not verify {{name}}. You can submit again.' }, ta: { title: 'நிறுவனம் சரிபார்க்கப்படவில்லை', body: '{{name}} ஐச் சரிபார்க்க முடியவில்லை. மீண்டும் சமர்ப்பிக்கலாம்.' } },
};

const rupees = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);

function fill(template: string, data: Record<string, unknown>): string {
  const values: Record<string, string> = {
    name: typeof data.name === 'string' ? data.name : '',
    title: typeof data.title === 'string' ? data.title : '',
    rating: typeof data.rating === 'number' ? String(data.rating) : '',
    reference: typeof data.reference === 'string' ? data.reference : '',
    amount: typeof data.amount_paise === 'number' ? rupees(data.amount_paise) : '',
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '').replace(/\s+/g, ' ').trim();
}

/** The ids the app needs to open the right screen when the push is tapped. Strings and numbers only. */
function routeData(kind: string, data: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = { kind };
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.length <= 200) out[key] = value;
    else if (typeof value === 'number') out[key] = value;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secret = req.headers.get('x-webhook-secret') ?? '';
  if (!secret || !sameSecret(secret, requiredEnv('PUSH_WEBHOOK_SECRET'))) return json({ error: 'unauthorized' }, 401);

  let payload: { type?: unknown; table?: unknown; record?: { id?: unknown; user_id?: unknown; kind?: unknown; data?: unknown } };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const record = payload.record;
  if (payload.type !== 'INSERT' || payload.table !== 'notifications' || !record) return json({ ignored: true });
  if (typeof record.user_id !== 'string' || !UUID.test(record.user_id) || typeof record.kind !== 'string' || !TEXT[record.kind]) {
    return json({ error: 'invalid_record' }, 400);
  }
  const data = record.data && typeof record.data === 'object' ? (record.data as Record<string, unknown>) : {};

  const admin = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const [{ data: tokens }, { data: profile }] = await Promise.all([
    admin.from('push_tokens').select('token').eq('user_id', record.user_id),
    admin.from('profiles').select('language').eq('id', record.user_id).maybeSingle(),
  ]);
  if (!tokens || tokens.length === 0) return json({ sent: 0 });

  const language: Language = profile?.language === 'en' ? 'en' : 'ta';
  const copy = TEXT[record.kind][language];
  const messages = tokens.map((row: { token: string }) => ({
    to: row.token,
    title: copy.title,
    body: fill(copy.body, data),
    data: routeData(record.kind as string, data),
    sound: 'default',
    channelId: 'default',
    priority: 'high',
  }));

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers, body: JSON.stringify(messages) });
  if (!response.ok) {
    console.error('Expo push service refused the request', response.status);
    return json({ error: 'push_provider_error' }, 502);
  }

  // Forget phones that no longer exist (app uninstalled, token expired).
  const result = (await response.json().catch(() => null)) as { data?: { status?: string; details?: { error?: string } }[] } | null;
  const dead = (result?.data ?? [])
    .map((ticket, index) => (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? messages[index].to : null))
    .filter((token): token is string => token !== null);
  if (dead.length > 0) await admin.from('push_tokens').delete().in('token', dead);

  return json({ sent: messages.length - dead.length });
});
