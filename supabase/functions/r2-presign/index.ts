// Issues a short-lived presigned PUT URL so the app can upload straight to
// Cloudflare R2. R2 credentials never leave this function.
import { PutObjectCommand, S3Client } from 'npm:@aws-sdk/client-s3@3';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MB = 1024 * 1024;
const URL_TTL_SECONDS = 300;
const MAX_BYTES = {
  avatar: 5 * MB,
  portfolio: 5 * MB,
  company_logo: 2 * MB,
} as const;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type Kind = keyof typeof MAX_BYTES;

const isKind = (value: unknown): value is Kind =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(MAX_BYTES, value);

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

  // Only signed-in users may upload.
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  let body: { kind?: unknown; contentType?: unknown; size?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { kind, contentType, size } = body;
  if (!isKind(kind)) return json({ error: 'invalid_kind' }, 400);
  if (typeof contentType !== 'string' || !(contentType in EXTENSIONS)) return json({ error: 'invalid_content_type' }, 400);
  // R2 enforces the signed Content-Length, which is how the size cap holds.
  if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) return json({ error: 'invalid_size' }, 400);
  if (size > MAX_BYTES[kind]) return json({ error: 'file_too_large' }, 413);

  const key = `${kind}/${userId}/${crypto.randomUUID()}.${EXTENSIONS[contentType]}`;

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${requiredEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY'),
    },
  });

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: requiredEnv('R2_BUCKET'),
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    }),
    {
      expiresIn: URL_TTL_SECONDS,
      signableHeaders: new Set(['content-type', 'content-length']),
    },
  );

  const publicBase = requiredEnv('R2_PUBLIC_URL').replace(/\/+$/, '');
  return json({ uploadUrl, publicUrl: `${publicBase}/${key}`, key, expiresIn: URL_TTL_SECONDS });
});
