// Runs the real Edge Function source in Node with Deno, Supabase and Razorpay mocked.
const ts = require('typescript');
const path = require('path');
const PROJECT = path.join(__dirname, '..', '..');
const crypto = require('crypto');
const fs = require('fs');

let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + detail}`);
};

const ENV = {
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  RAZORPAY_KEY_ID: 'rzp_test_id',
  RAZORPAY_KEY_SECRET: 'rzp_test_secret',
  RAZORPAY_WEBHOOK_SECRET: 'whsec_test',
  RESEND_API_KEY: 're_test_key',
};

// ---- mocks ---------------------------------------------------------------
let tables;
let rpcCalls;
let rpcResult;
let rpcError;
let razorpayCalls;
let razorpayHandler;
let lastError;
let userRpcCalls;
let userRpcError;
let users;

function resetWorld() {
  tables = { orders: [], payments: [], identity_verifications: [], profiles: [] };
  userRpcCalls = [];
  userRpcError = null;
  users = {};
  rpcCalls = [];
  rpcResult = { data: 'ok', error: null };
  rpcError = null;
  razorpayCalls = [];
  razorpayHandler = () => ({ status: 200, body: {} });
}

function queryBuilder(table) {
  const state = { filters: [], order: null, limit: null };
  const builder = {
    select: () => builder,
    eq: (column, value) => (state.filters.push([column, value]), builder),
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => {
      const row = tables[table].find((r) => state.filters.every(([c, v]) => r[c] === v));
      return { data: row ?? null, error: null };
    },
    then: (resolve) => {
      const rows = tables[table].filter((r) => state.filters.every(([c, v]) => r[c] === v));
      resolve({ data: rows, error: null });
    },
    insert: async (row) => {
      if (row.razorpay_payment_link_id === 'FAIL') return { error: { message: 'boom' } };
      tables[table].push({ status: 'created', ...row });
      return { error: null };
    },
  };
  return builder;
}

function createClient(url, key, options = {}) {
  const authHeader = options.global?.headers?.Authorization;
  if (key === ENV.SUPABASE_ANON_KEY) {
    return {
      auth: {
        getUser: async () => {
          const token = (authHeader ?? '').replace('Bearer ', '');
          if (token === 'good-token') return { data: { user: { id: 'user-1' } }, error: null };
          if (token === 'admin-token') return { data: { user: { id: 'admin-1' } }, error: null };
          return { data: { user: null }, error: { message: 'invalid jwt' } };
        },
      },
      rpc: async (name, args) => {
        userRpcCalls.push({ name, args, token: authHeader });
        if (authHeader !== 'Bearer admin-token') return { data: null, error: { code: '42501', message: 'not allowed' } };
        return userRpcError ? { data: null, error: userRpcError } : { data: null, error: null };
      },
    };
  }
  if (key !== ENV.SUPABASE_SERVICE_ROLE_KEY) throw new Error('unexpected key ' + key);
  return {
    from: queryBuilder,
    auth: { admin: { getUserById: async (id) => ({ data: { user: users[id] ?? null }, error: null }) } },
    rpc: async (name, args) => {
      rpcCalls.push({ name, args });
      return rpcError ? { data: null, error: rpcError } : rpcResult;
    },
  };
}

global.fetch = async (url, init = {}) => {
  razorpayCalls.push({ url: String(url), method: init.method, headers: init.headers, body: init.body });
  const { status, body } = razorpayHandler(String(url), init);
  return new Response(JSON.stringify(body), { status });
};

// ---- load a function -------------------------------------------------------
function loadFunction(name) {
  let handler;
  global.Deno = {
    env: { get: (key) => ENV[key] },
    serve: (fn) => {
      handler = fn;
    },
  };
  const source = fs.readFileSync(`${PROJECT}/supabase/functions/${name}/index.ts`, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: 'commonjs', target: 'es2022' } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, (id) => {
    if (id.startsWith('npm:@supabase/supabase-js')) return { createClient };
    if (id.startsWith('npm:@aws-sdk/client-s3')) return { PutObjectCommand: class {}, S3Client: class {} };
    if (id.startsWith('npm:@aws-sdk/s3-request-presigner')) return { getSignedUrl: async () => 'https://signed.example/upload' };
    throw new Error('unexpected import ' + id);
  });
  return handler;
}

const call = async (handler, { method = 'POST', headers = {}, body } = {}) => {
  const response = await handler(
    new Request('https://fn.local/', { method, headers, body: typeof body === 'string' ? body : JSON.stringify(body) }),
  );
  let json = null;
  try {
    json = await response.clone().json();
  } catch {
    /* plain text */
  }
  return { status: response.status, json, text: await response.text() };
};

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const authed = { Authorization: 'Bearer good-token', 'Content-Type': 'application/json' };

(async () => {
  // ===================== CORS (needed by the web version) ====================
  for (const name of ['r2-presign', 'create-payment', 'cancel-order', 'review-identity']) {
    resetWorld();
    const fn = loadFunction(name);
    const preflight = await fn(new Request('https://fn.local/', { method: 'OPTIONS', headers: { Origin: 'https://app.example.com', 'Access-Control-Request-Method': 'POST' } }));
    check(`${name}: answers the browser preflight`, preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === '*'
      && /authorization/.test(preflight.headers.get('access-control-allow-headers') ?? '') && /content-type/.test(preflight.headers.get('access-control-allow-headers') ?? ''));
    const denied = await fn(new Request('https://fn.local/', { method: 'POST', body: '{}' }));
    check(`${name}: error responses also carry the CORS header`, denied.status === 401 && denied.headers.get('access-control-allow-origin') === '*');
  }

  // ===================== create-payment ======================================
  const createPayment = loadFunction('create-payment');
  const seedOrder = (over = {}) => {
    tables.orders.push({ id: ORDER_ID, client_id: 'user-1', title: 'Logo for my bakery', amount_paise: 250000, status: 'awaiting_payment', ...over });
  };

  resetWorld();
  check('create-payment: rejects GET', (await call(createPayment, { method: 'GET' })).status === 405);
  check('create-payment: needs a token', (await call(createPayment, { body: { orderId: ORDER_ID } })).status === 401);
  check('create-payment: rejects a bad token', (await call(createPayment, { headers: { Authorization: 'Bearer nope' }, body: { orderId: ORDER_ID } })).status === 401);
  check('create-payment: rejects invalid json', (await call(createPayment, { headers: authed, body: '{oops' })).status === 400);
  check('create-payment: rejects a non-uuid order id', (await call(createPayment, { headers: authed, body: { orderId: "1' or 1=1" } })).status === 400);
  check('create-payment: unknown order is 404', (await call(createPayment, { headers: authed, body: { orderId: ORDER_ID } })).status === 404);

  resetWorld();
  seedOrder({ client_id: 'someone-else' });
  check('create-payment: another user\'s order looks like it does not exist', (await call(createPayment, { headers: authed, body: { orderId: ORDER_ID } })).status === 404);

  resetWorld();
  seedOrder({ status: 'in_progress' });
  check('create-payment: only unpaid orders can be paid', (await call(createPayment, { headers: authed, body: { orderId: ORDER_ID } })).status === 409);

  resetWorld();
  seedOrder();
  razorpayHandler = () => ({ status: 200, body: { id: 'plink_abc', short_url: 'https://rzp.io/i/abc' } });
  let res = await call(createPayment, { headers: authed, body: { orderId: ORDER_ID, amount: 1 } });
  check('create-payment: returns the payment url', res.status === 200 && res.json.url === 'https://rzp.io/i/abc', JSON.stringify(res));
  const sent = JSON.parse(razorpayCalls[0].body);
  check('create-payment: charges the amount stored in the database, not one from the request', sent.amount === 250000 && sent.currency === 'INR');
  check('create-payment: ties the link to the order', sent.reference_id === ORDER_ID && sent.notes.order_id === ORDER_ID);
  check('create-payment: calls Razorpay with basic auth', razorpayCalls[0].url === 'https://api.razorpay.com/v1/payment_links' && razorpayCalls[0].headers.Authorization === 'Basic ' + Buffer.from('rzp_test_id:rzp_test_secret').toString('base64'));
  check('create-payment: records the link in the ledger', tables.payments.length === 1 && tables.payments[0].razorpay_payment_link_id === 'plink_abc' && tables.payments[0].amount_paise === 250000);

  res = await call(createPayment, { headers: authed, body: { orderId: ORDER_ID } });
  check('create-payment: a second tap reuses the open link', res.status === 200 && res.json.url === 'https://rzp.io/i/abc' && razorpayCalls.length === 1 && tables.payments.length === 1);

  resetWorld();
  seedOrder();
  razorpayHandler = () => ({ status: 500, body: { error: 'down' } });
  const errorLog = console.error;
  console.error = () => {};
  res = await call(createPayment, { headers: authed, body: { orderId: ORDER_ID } });
  console.error = errorLog;
  check('create-payment: a Razorpay failure is a 502 and nothing is recorded', res.status === 502 && tables.payments.length === 0);

  // ===================== razorpay-webhook ====================================
  const webhook = loadFunction('razorpay-webhook');
  const sign = (raw, secret = ENV.RAZORPAY_WEBHOOK_SECRET) => crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const paidEvent = (over = {}) =>
    JSON.stringify({
      event: 'payment_link.paid',
      payload: { payment_link: { entity: { id: 'plink_abc' } }, payment: { entity: { id: 'pay_xyz', amount: 250000 } } },
      ...over,
    });
  const post = (raw, signature) => call(webhook, { headers: signature === undefined ? {} : { 'x-razorpay-signature': signature }, body: raw });

  resetWorld();
  let raw = paidEvent();
  check('webhook: rejects GET', (await call(webhook, { method: 'GET' })).status === 405);
  check('webhook: rejects a missing signature', (await post(raw)).status === 400);
  check('webhook: rejects a wrong signature', (await post(raw, sign(raw, 'other-secret'))).status === 400);
  check('webhook: rejects a signature for a different body', (await post(raw, sign(paidEvent({ event: 'x' })))).status === 400);
  check('webhook: rejects a truncated signature', (await post(raw, sign(raw).slice(0, 10))).status === 400);
  check('webhook: nothing reaches the database without a valid signature', rpcCalls.length === 0);

  res = await post(raw, sign(raw));
  check('webhook: accepts a valid signature', res.status === 200);
  check('webhook: records the payment with the right arguments', rpcCalls.length === 1 && rpcCalls[0].name === 'record_payment_captured'
    && rpcCalls[0].args.p_payment_link_id === 'plink_abc' && rpcCalls[0].args.p_payment_id === 'pay_xyz' && rpcCalls[0].args.p_amount_paise === 250000, JSON.stringify(rpcCalls));

  resetWorld();
  raw = JSON.stringify({ event: 'payment.failed', payload: {} });
  res = await post(raw, sign(raw));
  check('webhook: other events are acknowledged and ignored', res.status === 200 && rpcCalls.length === 0);

  resetWorld();
  raw = JSON.stringify({ event: 'payment_link.paid', payload: {} });
  check('webhook: a paid event missing fields is a 400', (await post(raw, sign(raw))).status === 400);
  raw = '{not json';
  check('webhook: invalid json is a 400', (await post(raw, sign(raw))).status === 400);

  resetWorld();
  rpcError = { code: 'P0002', message: 'unknown payment link' };
  console.error = () => {};
  raw = paidEvent();
  check('webhook: an unknown link is acknowledged so Razorpay stops retrying', (await post(raw, sign(raw))).status === 200);
  rpcError = { code: '22023', message: 'amount mismatch' };
  check('webhook: an amount mismatch is acknowledged, not retried', (await post(raw, sign(raw))).status === 200);
  rpcError = { code: '08006', message: 'connection lost' };
  check('webhook: a database failure asks Razorpay to retry', (await post(raw, sign(raw))).status === 500);
  console.error = errorLog;

  resetWorld();
  rpcResult = { data: 'duplicate', error: null };
  raw = paidEvent();
  res = await post(raw, sign(raw));
  check('webhook: a repeated event is a harmless 200', res.status === 200 && res.json.result === 'duplicate');

  resetWorld();
  rpcResult = { data: 'needs_refund', error: null };
  let logged = '';
  console.error = (...args) => (logged += args.join(' '));
  res = await post(raw, sign(raw));
  console.error = errorLog;
  check('webhook: a payment for a cancelled order is flagged for refund', res.status === 200 && logged.includes('REFUND NEEDED'));

  // ===================== cancel-order ========================================
  const cancelOrder = loadFunction('cancel-order');
  const seedPayment = () => tables.payments.push({ order_id: ORDER_ID, razorpay_payment_link_id: 'plink_abc', status: 'created' });
  const linkStatus = (status) => (url, init) => {
    if (init.method === 'GET') return { status: 200, body: { status } };
    return { status: 200, body: { status: 'cancelled' } };
  };

  resetWorld();
  check('cancel-order: needs a token', (await call(cancelOrder, { body: { orderId: ORDER_ID } })).status === 401);
  check('cancel-order: rejects a non-uuid order id', (await call(cancelOrder, { headers: authed, body: { orderId: 'x' } })).status === 400);
  seedOrder({ client_id: 'someone-else' });
  check('cancel-order: another user cannot cancel it', (await call(cancelOrder, { headers: authed, body: { orderId: ORDER_ID } })).status === 404);

  resetWorld();
  seedOrder({ status: 'in_progress' });
  check('cancel-order: a paid order cannot be cancelled', (await call(cancelOrder, { headers: authed, body: { orderId: ORDER_ID } })).status === 409);

  resetWorld();
  seedOrder();
  seedPayment();
  razorpayHandler = linkStatus('paid');
  res = await call(cancelOrder, { headers: authed, body: { orderId: ORDER_ID } });
  check('cancel-order: a link that was just paid blocks the cancel', res.status === 409 && res.json.error === 'already_paid' && rpcCalls.length === 0);
  check('cancel-order: a paid link is never cancelled at Razorpay', !razorpayCalls.some((c) => c.url.endsWith('/cancel')));

  resetWorld();
  seedOrder();
  seedPayment();
  razorpayHandler = linkStatus('created');
  res = await call(cancelOrder, { headers: authed, body: { orderId: ORDER_ID } });
  check('cancel-order: cancels the Razorpay link, then the order', res.status === 200 && res.json.cancelled === true
    && razorpayCalls.some((c) => c.url.endsWith('/plink_abc/cancel') && c.method === 'POST')
    && rpcCalls.length === 1 && rpcCalls[0].name === 'cancel_order' && rpcCalls[0].args.p_user_id === 'user-1' && rpcCalls[0].args.p_order_id === ORDER_ID, JSON.stringify({ res, rpcCalls }));

  resetWorld();
  seedOrder();
  seedPayment();
  razorpayHandler = linkStatus('expired');
  res = await call(cancelOrder, { headers: authed, body: { orderId: ORDER_ID } });
  check('cancel-order: an expired link needs no cancel call', res.status === 200 && !razorpayCalls.some((c) => c.url.endsWith('/cancel')));

  resetWorld();
  seedOrder();
  res = await call(cancelOrder, { headers: authed, body: { orderId: ORDER_ID } });
  check('cancel-order: an order that never had a link cancels without calling Razorpay', res.status === 200 && razorpayCalls.length === 0 && rpcCalls.length === 1);

  resetWorld();
  seedOrder();
  seedPayment();
  razorpayHandler = () => ({ status: 500, body: {} });
  console.error = () => {};
  res = await call(cancelOrder, { headers: authed, body: { orderId: ORDER_ID } });
  console.error = errorLog;
  check('cancel-order: if Razorpay is down the order is NOT cancelled', res.status === 502 && rpcCalls.length === 0);


  // ===================== review-identity =====================================
  const reviewIdentity = loadFunction('review-identity');
  const CHECK_ID = '22222222-2222-4222-8222-222222222222';
  const adminHeaders = { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' };
  const seedCheck = (language = 'en') => {
    tables.identity_verifications.push({ id: CHECK_ID, user_id: 'freelancer-1' });
    tables.profiles.push({ id: 'freelancer-1', full_name: 'Priya <b>R</b>', language });
    users['freelancer-1'] = { email: 'priya@example.com' };
  };
  const emailsSent = () => razorpayCalls.filter((c) => c.url === 'https://api.resend.com/emails');
  const review = (over = {}, headers = adminHeaders) => call(reviewIdentity, { headers, body: { id: CHECK_ID, status: 'verified', ...over } });

  resetWorld();
  check('review-identity: rejects GET', (await call(reviewIdentity, { method: 'GET' })).status === 405);
  check('review-identity: needs a token', (await call(reviewIdentity, { body: { id: CHECK_ID, status: 'verified' } })).status === 401);
  check('review-identity: rejects a non-uuid id', (await review({ id: 'x' })).status === 400);
  check('review-identity: rejects an unknown status', (await review({ status: 'maybe' })).status === 400);
  check('review-identity: rejects invalid json', (await call(reviewIdentity, { headers: adminHeaders, body: '{oops' })).status === 400);

  resetWorld();
  seedCheck();
  res = await review({}, authed);
  check('review-identity: a non-admin is refused and nothing is emailed', res.status === 403 && emailsSent().length === 0);

  resetWorld();
  seedCheck('en');
  razorpayHandler = () => ({ status: 200, body: { id: 'email_1' } });
  res = await review();
  check('review-identity: an admin approval is saved and emailed', res.status === 200 && res.json.reviewed === true && res.json.emailed === true, JSON.stringify(res));
  check('review-identity: the decision goes through the admin-checked database function as the admin', userRpcCalls.length === 1 && userRpcCalls[0].name === 'admin_review_identity' && userRpcCalls[0].args.p_status === 'verified' && userRpcCalls[0].token === 'Bearer admin-token');
  const approvedMail = JSON.parse(emailsSent()[0].body);
  check('review-identity: the approval email goes to the freelancer in their language', approvedMail.to[0] === 'priya@example.com' && approvedMail.subject === 'You are verified on Hithozha');
  check('review-identity: the email is sent with the Resend key', emailsSent()[0].headers.Authorization === 'Bearer re_test_key' && approvedMail.from === 'Hithozha <onboarding@resend.dev>');
  check('review-identity: names are escaped in the email', approvedMail.html.includes('Priya &lt;b&gt;R&lt;/b&gt;') && !approvedMail.html.includes('<b>R</b>'));

  resetWorld();
  seedCheck('ta');
  razorpayHandler = () => ({ status: 200, body: {} });
  res = await review({ status: 'rejected', reason: 'The ID photo is blurry <script>' });
  const rejectedMail = JSON.parse(emailsSent()[0].body);
  check('review-identity: a rejection is emailed in Tamil with the reason', res.json.emailed === true && rejectedMail.subject.includes('சரிபார்க்க முடியவில்லை') && rejectedMail.html.includes('The ID photo is blurry &lt;script&gt;'));
  check('review-identity: the reason reaches the database', userRpcCalls[0].args.p_reason === 'The ID photo is blurry <script>');

  resetWorld();
  seedCheck();
  userRpcError = { code: '22023', message: 'a reason is required' };
  res = await review({ status: 'rejected' });
  check('review-identity: a rejection without a reason is a 400 and sends no email', res.status === 400 && emailsSent().length === 0);
  userRpcError = { code: 'P0002', message: 'no pending check' };
  check('review-identity: an already-reviewed check is a 404 and sends no email', (await review()).status === 404 && emailsSent().length === 0);

  resetWorld();
  seedCheck();
  razorpayHandler = () => ({ status: 500, body: {} });
  console.error = () => {};
  res = await review();
  console.error = errorLog;
  check('review-identity: if the email fails the decision still stands and the reply says so', res.status === 200 && res.json.reviewed === true && res.json.emailed === false);

  resetWorld();
  seedCheck();
  delete ENV.RESEND_API_KEY;
  console.error = () => {};
  res = await review();
  console.error = errorLog;
  ENV.RESEND_API_KEY = 're_test_key';
  check('review-identity: without an email key the decision is saved and no email is attempted', res.status === 200 && res.json.reviewed === true && res.json.emailed === false && emailsSent().length === 0);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error('HARNESS ERROR', error);
  process.exit(2);
});
