// An admin approves or rejects a freelancer's identity check, and the freelancer gets an email.
// The decision itself is the admin_review_identity database function, which refuses anyone who
// is not an admin, so this function only adds the email. If the email cannot be sent the decision
// still stands and the reply says so.
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

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type Language = 'ta' | 'en';

const COPY = {
  en: {
    verified: {
      subject: 'You are verified on Hithozha',
      title: 'You are verified',
      body: 'Good news: our team checked your Aadhaar, PAN and selfie and your identity is verified. You can now apply to jobs. We delete your photos after verification.',
      button: 'Open Hithozha',
    },
    rejected: {
      subject: 'We could not verify your identity on Hithozha',
      title: 'We could not verify you',
      body: 'Our team could not verify your identity from the photos you sent.',
      reasonLabel: 'Reason:',
      retry: 'You can send new photos from the app. Make sure the ID is clear and the name is readable.',
      button: 'Try again',
    },
    greeting: (name: string) => `Hi ${name},`,
    footer: 'Hithozha: work with friends, not strangers.',
  },
  ta: {
    verified: {
      subject: 'ஹித்தோழாவில் நீங்கள் சரிபார்க்கப்பட்டீர்கள்',
      title: 'நீங்கள் சரிபார்க்கப்பட்டீர்கள்',
      body: 'நல்ல செய்தி: எங்கள் குழு உங்கள் அடையாள அட்டையையும் செல்ஃபியையும் சரிபார்த்தது; உங்கள் அடையாளம் உறுதி செய்யப்பட்டது. இனி வேலைகளுக்கு விண்ணப்பிக்கலாம். சரிபார்ப்புக்குப் பிறகு உங்கள் புகைப்படங்களை நீக்கிவிடுவோம்.',
      button: 'ஹித்தோழாவைத் திற',
    },
    rejected: {
      subject: 'ஹித்தோழாவில் உங்கள் அடையாளத்தைச் சரிபார்க்க முடியவில்லை',
      title: 'உங்களைச் சரிபார்க்க முடியவில்லை',
      body: 'நீங்கள் அனுப்பிய புகைப்படங்களிலிருந்து உங்கள் அடையாளத்தை எங்கள் குழுவால் சரிபார்க்க முடியவில்லை.',
      reasonLabel: 'காரணம்:',
      retry: 'ஆப்பிலிருந்து புதிய புகைப்படங்களை அனுப்பலாம். அடையாள அட்டை தெளிவாகவும், பெயர் படிக்கும்படியும் இருக்கட்டும்.',
      button: 'மீண்டும் முயற்சி',
    },
    greeting: (name: string) => `வணக்கம் ${name},`,
    footer: 'ஹித்தோழா: நண்பர்களுடன் வேலை செய்யுங்கள், அந்நியர்களுடன் அல்ல.',
  },
} as const;

function buildEmail(language: Language, status: 'verified' | 'rejected', name: string, reason: string | null, appUrl: string) {
  const copy = COPY[language];
  const part = copy[status];
  const lines: string[] = [`<p>${escapeHtml(copy.greeting(name))}</p>`, `<p>${escapeHtml(part.body)}</p>`];
  if (status === 'rejected') {
    const rejected = COPY[language].rejected;
    if (reason) lines.push(`<p><strong>${escapeHtml(rejected.reasonLabel)}</strong> ${escapeHtml(reason)}</p>`);
    lines.push(`<p>${escapeHtml(rejected.retry)}</p>`);
  }
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1A1A2E">` +
    `<h2 style="margin:0 0 16px;color:#D4420A">${escapeHtml(part.title)}</h2>${lines.join('')}` +
    `<p style="margin:24px 0"><a href="${escapeHtml(appUrl)}" style="background:#D4420A;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none">${escapeHtml(part.button)}</a></p>` +
    `<p style="color:#5E5E73;font-size:13px">${escapeHtml(copy.footer)}</p></div>`;
  const text = [copy.greeting(name), part.body, status === 'rejected' && reason ? `${COPY[language].rejected.reasonLabel} ${reason}` : '', appUrl]
    .filter(Boolean)
    .join('\n\n');
  return { subject: part.subject, html, text };
}

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

  let body: { id?: unknown; status?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (typeof body.id !== 'string' || !UUID.test(body.id)) return json({ error: 'invalid_check' }, 400);
  if (body.status !== 'verified' && body.status !== 'rejected') return json({ error: 'invalid_status' }, 400);
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 300) : null;
  const status: 'verified' | 'rejected' = body.status;

  // Runs as the signed-in person, so the database decides whether they are an admin.
  const { error: reviewError } = await userClient.rpc('admin_review_identity', { p_id: body.id, p_status: status, p_reason: reason });
  if (reviewError) {
    const code = reviewError.code;
    if (code === '42501') return json({ error: 'forbidden' }, 403);
    if (code === 'P0002') return json({ error: 'check_not_found' }, 404);
    if (code === '22023') return json({ error: 'invalid_request' }, 400);
    console.error('admin_review_identity failed', reviewError.message);
    return json({ error: 'server_error' }, 500);
  }

  // The decision is saved. From here on, nothing may undo it.
  let emailed = false;
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      console.error('RESEND_API_KEY is not set, so no email was sent');
      return json({ reviewed: true, emailed });
    }
    const admin = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false },
    });
    const { data: check } = await admin.from('identity_verifications').select('user_id').eq('id', body.id).maybeSingle();
    if (!check) return json({ reviewed: true, emailed });
    const [{ data: profile }, { data: account }] = await Promise.all([
      admin.from('profiles').select('full_name, language').eq('id', check.user_id).maybeSingle(),
      admin.auth.admin.getUserById(check.user_id),
    ]);
    const to = account?.user?.email;
    if (!to) return json({ reviewed: true, emailed });

    const language: Language = profile?.language === 'en' ? 'en' : 'ta';
    const email = buildEmail(language, status, profile?.full_name?.trim() || (language === 'ta' ? 'நண்பரே' : 'there'), reason, Deno.env.get('APP_URL') ?? 'https://hithozha.vercel.app');
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_FROM') ?? 'Hithozha <onboarding@resend.dev>',
        to: [to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    emailed = sent.ok;
    if (!sent.ok) console.error('email provider refused the message', sent.status);
  } catch (error) {
    console.error('could not send the decision email', error instanceof Error ? error.message : 'unknown error');
  }
  return json({ reviewed: true, emailed });
});
