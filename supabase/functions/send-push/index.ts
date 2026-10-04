// Sends a phone push notification when a row is added to the notifications table.
// A database trigger calls this function with a shared secret in the x-webhook-secret header.
// Android phones are reached directly through Firebase Cloud Messaging (FCM, using the
// FIREBASE_SERVICE_ACCOUNT secret); Expo push tokens (iPhone, later) go through Expo's service.
// Phones that Firebase or Expo say no longer exist are forgotten.
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
  admin_identity: { en: { title: 'New identity check', body: '{{name}} sent ID photos to check.' }, ta: { title: 'புதிய அடையாள சரிபார்ப்பு', body: '{{name}} சரிபார்க்க அடையாள புகைப்படங்களை அனுப்பினார்.' } },
  admin_dispute: { en: { title: 'New dispute', body: 'A problem was reported on {{title}}.' }, ta: { title: 'புதிய சர்ச்சை', body: '{{title}} இல் ஒரு பிரச்சினை புகாரளிக்கப்பட்டது.' } },
  admin_report: { en: { title: 'New report', body: '{{name}} was reported.' }, ta: { title: 'புதிய புகார்', body: '{{name}} பற்றி புகார் வந்துள்ளது.' } },
  referral_reward: { en: { title: 'A friend joined', body: '{{name}} joined with your code. You both got 5 extra applications.' }, ta: { title: 'ஒரு நண்பர் இணைந்தார்', body: '{{name}} உங்கள் குறியீட்டுடன் இணைந்தார். இருவருக்கும் 5 கூடுதல் விண்ணப்பங்கள் கிடைத்தன.' } },
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


// ---- Firebase Cloud Messaging (Android) ---------------------------------------------------------

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

/** The FIREBASE_SERVICE_ACCOUNT secret: the key file's JSON, pasted as is or as base64. */
function readServiceAccount(): ServiceAccount | null {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) return null;
  try {
    const text = raw.trim().startsWith('{') ? raw : atob(raw.trim());
    const parsed = JSON.parse(text);
    if (typeof parsed.client_email !== 'string' || typeof parsed.private_key !== 'string' || typeof parsed.project_id !== 'string') return null;
    return parsed as ServiceAccount;
  } catch {
    return null;
  }
}

const base64Url = (input: ArrayBuffer | string): string => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

/** Trades the service-account key for a short-lived Google access token (kept for about 50 minutes). */
async function googleAccessToken(account: ServiceAccount): Promise<string | null> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) return cachedAccessToken.value;

  const now = Math.floor(Date.now() / 1000);
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${claims}`;

  const pem = account.private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${base64Url(signature)}` }),
  });
  if (!response.ok) {
    console.error('Google refused the service account key', response.status);
    return null;
  }
  const { access_token: value } = (await response.json()) as { access_token?: string };
  if (!value) return null;
  cachedAccessToken = { value, expiresAt: Date.now() + 50 * 60 * 1000 };
  return value;
}

const isExpoToken = (token: string) => /^(Expo|Exponent)PushToken\[/.test(token);

type PushMessage = { title: string; body: string; data: Record<string, string | number> };

type FcmOutcome = { result: 'ok' | 'gone' | 'error'; note?: string };

/** Sends to one Android phone. 'gone' only when Firebase explicitly says the phone is unregistered. */
async function sendFcm(account: ServiceAccount, accessToken: string, token: string, message: PushMessage): Promise<FcmOutcome> {
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(message.data)) data[key] = String(value); // FCM data values must be strings
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: message.title, body: message.body },
        data,
        android: { priority: 'HIGH', notification: { channel_id: 'alerts', sound: 'default' } },
      },
    }),
  });
  if (response.ok) return { result: 'ok' };
  const detail = (await response.json().catch(() => null)) as {
    error?: { status?: string; message?: string; details?: { errorCode?: string }[] };
  } | null;
  const code = detail?.error?.details?.find((d) => d.errorCode)?.errorCode ?? detail?.error?.status ?? '';
  const note = `fcm ${response.status} ${code} ${(detail?.error?.message ?? '').slice(0, 90)}`.trim();
  if (code === 'UNREGISTERED') return { result: 'gone', note };
  console.error('Firebase refused a message:', note);
  return { result: 'error', note };
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
  const [{ data: tokens, error: tokensError }, { data: profile }] = await Promise.all([
    admin.from('push_tokens').select('token').eq('user_id', record.user_id),
    admin.from('profiles').select('language').eq('id', record.user_id).maybeSingle(),
  ]);
  if (tokensError) {
    console.error('could not read push_tokens:', tokensError.message);
    return json({ error: 'tokens_query_failed', notes: [tokensError.message.slice(0, 120)] }, 500);
  }
  if (!tokens || tokens.length === 0) return json({ sent: 0, gone: 0, failed: 0, notes: ['no phone registered for this user'] });

  const language: Language = profile?.language === 'en' ? 'en' : 'ta';
  const copy = TEXT[record.kind][language];
  const message: PushMessage = { title: copy.title, body: fill(copy.body, data), data: routeData(record.kind as string, data) };

  const all = tokens.map((row: { token: string }) => row.token);
  const expoTokens = all.filter(isExpoToken);
  const fcmTokens = all.filter((token) => !isExpoToken(token));
  const dead: string[] = [];
  const notes: string[] = [];
  let failed = false;
  let delivered = 0;

  // Android phones: straight to Firebase.
  if (fcmTokens.length > 0) {
    const account = readServiceAccount();
    const accessToken = account ? await googleAccessToken(account).catch(() => null) : null;
    if (!account || !accessToken) {
      console.error('FIREBASE_SERVICE_ACCOUNT is missing or not accepted, so Android pushes were not sent');
      notes.push(account ? 'google refused the service account key' : 'FIREBASE_SERVICE_ACCOUNT is missing or unreadable');
      failed = true;
    } else {
      for (const token of fcmTokens) {
        const outcome = await sendFcm(account, accessToken, token, message);
        if (outcome.result === 'ok') delivered += 1;
        else if (outcome.result === 'gone') dead.push(token);
        else failed = true;
        if (outcome.note) notes.push(outcome.note);
      }
    }
  }

  // Expo tokens (iPhone, later): through Expo's push service.
  if (expoTokens.length > 0) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(expoTokens.map((to) => ({ to, ...message, sound: 'default', channelId: 'alerts', priority: 'high' }))),
    });
    if (!response.ok) {
      console.error('Expo push service refused the request', response.status);
      notes.push(`expo ${response.status}`);
      failed = true;
    } else {
      const result = (await response.json().catch(() => null)) as { data?: { status?: string; details?: { error?: string } }[] } | null;
      (result?.data ?? []).forEach((ticket, index) => {
        if (ticket.status === 'ok') delivered += 1;
        else if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') dead.push(expoTokens[index]);
        else if (ticket.status === 'error') {
          failed = true;
          notes.push(`expo ${ticket.details?.error ?? 'error'}`);
        }
      });
    }
  }

  // Forget phones that no longer exist (app uninstalled, token expired).
  if (dead.length > 0) await admin.from('push_tokens').delete().in('token', dead);

  if (failed && delivered === 0 && dead.length === 0 && all.length > 0) return json({ error: 'push_provider_error', notes }, 502);
  return json({ sent: delivered, gone: dead.length, failed: all.length - delivered - dead.length, notes });
});
