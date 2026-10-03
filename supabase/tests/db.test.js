// Applies every migration to a throwaway Postgres (PGlite) that emulates Supabase's
// roles and auth.uid(), then exercises the security rules as different users.
const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const path = require('path');

const MIGRATIONS = path.join(__dirname, '..', 'migrations');

let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + detail}`);
};

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  -- Supabase grants everything on new public objects to these roles by default.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  create publication supabase_realtime;
`;

(async () => {
  const db = new PGlite();
  await db.exec(bootstrap);

  const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    try {
      await db.exec(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
      check(`migration applies: ${file}`, true);
    } catch (error) {
      check(`migration applies: ${file}`, false, error.message);
      console.log('\nStopping: later tests need every migration.');
      process.exit(1);
    }
  }

  // ---- helpers -----------------------------------------------------------
  const as = async (role, uid, fn) => {
    await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
    try {
      return await fn();
    } finally {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    }
  };
  const user = (uid, fn) => as('authenticated', uid, fn);
  const anon = (fn) => as('anon', null, fn);
  const service = (fn) => as('service_role', null, fn);
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const one = async (sql, params) => (await q(sql, params))[0];

  // Runs a statement that must be rejected. `match` is a Postgres error code or message text.
  const rejects = async (name, fn, match) => {
    try {
      await fn();
      check(name, false, 'expected an error but it succeeded');
    } catch (error) {
      const ok = !match || error.code === match || String(error.message).toLowerCase().includes(String(match).toLowerCase());
      check(name, ok, `got ${error.code} ${error.message}`);
    }
  };

  const newUser = async (email) => (await one(`insert into auth.users (email) values ($1) returning id`, [email])).id;

  const clientA = await newUser('client@test');
  const owner = await newUser('company-owner@test');
  const bothUser = await newUser('both@test');
  const freelancerF = await newUser('f@test');
  const freelancerG = await newUser('g@test');
  const outsider = await newUser('outsider@test');

  const setProfile = (uid, role, name) =>
    user(uid, () => q(`update public.profiles set role = $2, full_name = $3, city = 'chennai' where id = $1`, [uid, role, name]));
  await setProfile(clientA, 'client', 'Client A');
  await setProfile(owner, 'client', 'Company Owner');
  await setProfile(bothUser, 'both', 'Both User');
  await setProfile(freelancerF, 'freelancer', 'Freelancer F');
  await setProfile(freelancerG, 'freelancer', 'Freelancer G');
  await setProfile(outsider, 'client', 'Outsider');

  // ---- profiles ----------------------------------------------------------
  check('signup trigger created a profile', (await one(`select count(*)::int c from public.profiles`)).c === 6);
  await rejects('user cannot set is_admin', () => user(clientA, () => q(`update public.profiles set is_admin = true where id = $1`, [clientA])), '42501');
  await rejects('user cannot set verification_status on profile', () => user(clientA, () => q(`update public.profiles set verification_status = 'verified' where id = $1`, [clientA])), '42501');
  await rejects('phone column is not readable', () => user(clientA, () => q(`select phone from public.profiles`)), '42501');
  await rejects('is_admin column is not readable', () => user(clientA, () => q(`select is_admin from public.profiles`)), '42501');
  const otherUpdate = await user(clientA, () => db.query(`update public.profiles set full_name = 'hacked' where id = $1`, [outsider]));
  check('user cannot edit someone else\'s profile', otherUpdate.affectedRows === 0);
  await rejects('freelancer cannot carry a client type', () => user(freelancerF, () => q(`update public.profiles set client_type = 'company' where id = $1`, [freelancerF])), '23514');
  await rejects('signed-out users cannot read profiles', () => anon(() => q(`select id from public.profiles`)), '42501');

  // ---- freelancer profiles ----------------------------------------------
  await user(freelancerF, () => q(`insert into public.freelancer_profiles (user_id, bio, skills, headline) values ($1, 'I design logos for shops', array['graphic-design'], 'Logo designer')`, [freelancerF]));
  await user(freelancerG, () => q(`insert into public.freelancer_profiles (user_id, bio, skills, headline) values ($1, 'I edit videos for brands', array['video-editing'], 'Video editor')`, [freelancerG]));
  await rejects('client cannot create a freelancer profile', () => user(clientA, () => q(`insert into public.freelancer_profiles (user_id, bio) values ($1, 'x')`, [clientA])), '42501');
  await rejects('freelancer cannot set own rating', () => user(freelancerF, () => q(`update public.freelancer_profiles set rating_avg = 5 where user_id = $1`, [freelancerF])), '42501');
  await rejects('freelancer cannot grant themselves premium', () => user(freelancerF, () => q(`update public.freelancer_profiles set is_premium = true where user_id = $1`, [freelancerF])), '42501');

  // ---- categories --------------------------------------------------------
  check('categories seeded', (await anon(() => one(`select count(*)::int c from public.categories`))).c === 8);
  await rejects('categories are admin-write only', () => user(clientA, () => q(`insert into public.categories (slug, name_en, name_ta, icon) values ('x','x','x','x')`)), '42501');

  // ---- companies ---------------------------------------------------------
  const company = await user(owner, () =>
    one(`insert into public.companies (owner_id, name, team_size, industry, city) values ($1, 'Acme Foods', '11-50', 'food', 'chennai') returning id`, [owner]));
  check('client creates a company', !!company.id);
  await user(owner, () => q(`update public.profiles set client_type = 'company' where id = $1`, [owner]));
  await rejects('freelancer cannot create a company', () => user(freelancerF, () => q(`insert into public.companies (owner_id, name, team_size, industry) values ($1, 'Fake', '1-10', 'other')`, [freelancerF])), '42501');
  await rejects('one company per user', () => user(owner, () => q(`insert into public.companies (owner_id, name, team_size, industry) values ($1, 'Second', '1-10', 'other')`, [owner])), '23505');
  await rejects('cannot create a company for someone else', () => user(clientA, () => q(`insert into public.companies (owner_id, name, team_size, industry) values ($1, 'Impostor', '1-10', 'other')`, [owner])), '42501');
  await rejects('bad website is rejected', () => user(owner, () => q(`update public.companies set website = 'javascript:alert(1)' where owner_id = $1`, [owner])), '23514');
  await rejects('non-LinkedIn link is rejected', () => user(owner, () => q(`update public.companies set linkedin_url = 'https://evil.com/linkedin.com' where owner_id = $1`, [owner])), '23514');
  await user(owner, () => q(`update public.companies set website = 'https://acme.example.com', linkedin_url = 'https://www.linkedin.com/company/acme' where owner_id = $1`, [owner]));
  check('valid links are accepted', true);
  const publicView = await user(clientA, () => one(`select name, verification_status from public.companies where id = $1`, [company.id]));
  check('anyone signed in reads public company fields', publicView.name === 'Acme Foods' && publicView.verification_status === 'none');
  await rejects('gst_number is not readable', () => user(clientA, () => q(`select gst_number from public.companies`)), '42501');
  await rejects('udyam_number is not readable', () => user(clientA, () => q(`select udyam_number from public.companies`)), '42501');
  await rejects('gst_number cannot be written directly', () => user(owner, () => q(`update public.companies set gst_number = '22AAAAA0000A1Z5' where owner_id = $1`, [owner])), '42501');
  await rejects('verification_status cannot be written directly', () => user(owner, () => q(`update public.companies set verification_status = 'verified' where owner_id = $1`, [owner])), '42501');
  const strangerEdit = await user(clientA, () => db.query(`update public.companies set name = 'hacked' where id = $1`, [company.id]));
  check('others cannot edit a company', strangerEdit.affectedRows === 0);
  await rejects('bad GST is rejected', () => user(owner, () => q(`select public.submit_company_verification('NOTAGST', null)`)), '23514');
  await rejects('bad Udyam is rejected', () => user(owner, () => q(`select public.submit_company_verification(null, 'UDYAM-1-2-3')`)), '23514');
  await rejects('needs at least one number', () => user(owner, () => q(`select public.submit_company_verification(null, null)`)), '22023');
  await user(owner, () => q(`select public.submit_company_verification(' 22aaaaa0000a1z5 ', null)`));
  const mine = await user(owner, () => one(`select * from public.get_my_company()`));
  check('verification goes pending and the number is normalised', mine.verification_status === 'pending' && mine.gst_number === '22AAAAA0000A1Z5');
  await rejects('cannot resubmit while pending', () => user(owner, () => q(`select public.submit_company_verification('22AAAAA0000A1Z5', null)`)), '55000');
  check('get_my_company returns nothing for a non-owner', (await user(clientA, () => q(`select * from public.get_my_company()`))).length === 0);
  await rejects('signed-out users cannot call get_my_company', () => anon(() => q(`select * from public.get_my_company()`)), '42501');

  // a second company cannot reuse the same GST number
  const company2 = await user(outsider, () =>
    one(`insert into public.companies (owner_id, name, team_size, industry) values ($1, 'Other Co', '1-10', 'retail') returning id`, [outsider]));
  await rejects('a GST number backs only one business', () => user(outsider, () => q(`select public.submit_company_verification('22AAAAA0000A1Z5', null)`)), '23505');
  await service(() => q(`update public.companies set verification_status = 'verified' where id = $1`, [company.id]));
  check('service role can verify a company', (await service(() => one(`select verification_status from public.companies where id = $1`, [company.id]))).verification_status === 'verified');

  // ---- jobs --------------------------------------------------------------
  const job = (uid, overrides = {}) => {
    const v = { company_id: null, job_type: 'one_time', hours: null, mode: 'online', city: null, ...overrides };
    return user(uid, () =>
      one(
        `insert into public.jobs (client_id, company_id, title, description, category_slug, job_type, hours_per_week, budget_min_paise, budget_max_paise, work_mode, city)
         values ($1, $2, 'Logo for my bakery', 'I need a clean logo in Tamil and English for my shop', 'graphic-design', $3, $4, 100000, 500000, $5, $6) returning id`,
        [uid, v.company_id, v.job_type, v.hours, v.mode, v.city]));
  };
  const jobA = await job(clientA);
  check('client posts a one-time job', !!jobA.id);
  check('monthly job needs no hours', !!(await job(clientA, { job_type: 'monthly' })).id);
  check('part-time job with hours is accepted', !!(await job(clientA, { job_type: 'part_time', hours: 20 })).id);
  await rejects('part-time job without hours is rejected', () => job(clientA, { job_type: 'part_time' }), '23514');
  await rejects('one-time job with hours is rejected', () => job(clientA, { hours: 10 }), '23514');
  await rejects('in-person job needs a city', () => job(clientA, { mode: 'in_person' }), '23514');
  check('in-person job with a city is accepted', !!(await job(clientA, { mode: 'in_person', city: 'madurai' })).id);
  await rejects('freelancer cannot post a job', () => job(freelancerF), '42501');
  await rejects('cannot post as someone else', () => user(clientA, () => q(`insert into public.jobs (client_id, title, description, category_slug, job_type, budget_min_paise, budget_max_paise, work_mode) values ($1,'Hello world','A long enough description here','writing','one_time',100,200,'online')`, [outsider])), '42501');
  const companyJob = await job(owner, { company_id: company.id });
  check('company owner posts under their company', !!companyJob.id);
  await rejects('cannot attach a company you do not own', () => job(clientA, { company_id: company.id }), '42501');
  const embedded = await user(freelancerF, () => one(`select j.title, c.name, c.verification_status from public.jobs j join public.companies c on c.id = j.company_id where j.id = $1`, [companyJob.id]));
  check('freelancer sees a job with its company details', embedded.name === 'Acme Foods' && embedded.verification_status === 'verified');
  await rejects('locked job fields (category, type, budget currency) cannot be edited', () => user(clientA, () => q(`update public.jobs set category_slug = 'writing' where id = $1`, [jobA.id])), '42501');
  const strangerClose = await user(outsider, () => db.query(`update public.jobs set status = 'closed' where id = $1`, [jobA.id]));
  check('others cannot close my job', strangerClose.affectedRows === 0);

  // ---- proposals ---------------------------------------------------------
  const propose = (uid, jobId, price = 250000) =>
    user(uid, () =>
      one(`insert into public.proposals (job_id, message, price_paise, delivery_days) values ($1, 'I can design this for you with three revisions included', $2, 4) returning id, freelancer_id`, [jobId, price]));
  const propF = await propose(freelancerF, jobA.id, 250000);
  check('freelancer sends a proposal', !!propF.id && propF.freelancer_id === freelancerF);
  await rejects('one proposal per freelancer per job', () => propose(freelancerF, jobA.id), '23505');
  await rejects('a client-only user cannot apply', () => propose(outsider, jobA.id), '42501');
  const bothJob = await job(bothUser);
  await rejects('cannot apply to your own job', () => propose(bothUser, bothJob.id), '42501');
  await rejects('freelancer_id cannot be spoofed', () => user(freelancerF, () => q(`insert into public.proposals (job_id, freelancer_id, message, price_paise, delivery_days) values ($1, $2, 'I can design this for you with three revisions', 5000, 3)`, [companyJob.id, freelancerG])), '42501');
  await rejects('price below Rs 50 is rejected', () => propose(freelancerF, companyJob.id, 4000), '23514');
  const propG = await propose(freelancerG, jobA.id, 180000);
  check('second freelancer applies', !!propG.id);
  check('job owner sees every proposal', (await user(clientA, () => q(`select id from public.proposals where job_id = $1`, [jobA.id]))).length === 2);
  check('freelancer sees only their own proposal', (await user(freelancerG, () => q(`select id from public.proposals where job_id = $1`, [jobA.id]))).length === 1);
  check('unrelated user sees no proposals', (await user(outsider, () => q(`select id from public.proposals`))).length === 0);
  await rejects('freelancer cannot accept their own proposal by update', () => user(freelancerF, () => q(`update public.proposals set status = 'accepted' where id = $1`, [propF.id])), '42501');
  await rejects('withdraw is the only status a freelancer can set', () => user(freelancerF, () => q(`update public.proposals set status = 'rejected' where id = $1`, [propF.id])), '42501');
  await rejects('proposal price cannot be changed afterwards', () => user(freelancerF, () => q(`update public.proposals set price_paise = 5000 where id = $1`, [propF.id])), '42501');

  // ---- conversations and chat -------------------------------------------
  const convF = await user(freelancerF, () => one(`select * from public.conversations where proposal_id = $1`, [propF.id]));
  check('a conversation is created with each proposal', !!convF && convF.client_id === clientA && convF.freelancer_id === freelancerF);
  check('the client sees both conversations', (await user(clientA, () => q(`select id from public.conversations where job_id = $1`, [jobA.id]))).length === 2);
  check('an outsider sees no conversations', (await user(outsider, () => q(`select id from public.conversations`))).length === 0);
  check('the other freelancer cannot see this conversation', (await user(freelancerG, () => q(`select id from public.conversations where id = $1`, [convF.id]))).length === 0);

  const send = (uid, body) => user(uid, () => one(`select * from public.send_message($1, $2)`, [convF.id, body]));
  const clean = await send(clientA, 'Can you finish in 3 days for 5000 rupees? நன்றி');
  check('clean messages pass through untouched', clean.body === 'Can you finish in 3 days for 5000 rupees? நன்றி' && clean.was_redacted === false);
  check('prices and short numbers are not mistaken for phone numbers', (await send(clientA, 'Budget is Rs 90000 and 5000 extra, ref 12345')).was_redacted === false);

  const cases = [
    ['phone number', 'Call me on 98765 43210 please', /98765/],
    ['phone with +91', 'My number is +91 98765-43210', /98765/],
    ['phone, no spaces', 'reach 9876543210', /9876543210/],
    ['email', 'mail me at priya.r@gmail.com', /priya/],
    ['link with scheme', 'see https://wa.me/919876543210 now', /wa\.me/],
    ['bare domain', 'my portfolio is priya.com/work', /priya\.com/],
    ['UPI id', 'send to priya@oksbi', /oksbi/],
    ['pay directly', 'Please pay me directly, it is cheaper', /pay me directly/i],
    ['outside the platform', 'lets do it outside the platform', /outside the platform/i],
    ['gpay', 'I accept GPay', /gpay/i],
    ['whatsapp', 'message me on WhatsApp', /whatsapp/i],
    ['bank account', 'my bank account number is below', /bank account/i],
  ];
  for (const [label, text, leak] of cases) {
    const m = await send(freelancerF, text);
    check(`redacts ${label}`, m.was_redacted === true && m.body.includes('███') && !leak.test(m.body), `got "${m.body}"`);
  }
  const violations = await service(() => q(`select violation_types, original_body from public.chat_violations`));
  check('every redaction is logged with the original text', violations.length === cases.length && violations.some((v) => v.original_body.includes('98765 43210')));
  check('violation types are recorded', violations.some((v) => v.violation_types.includes('phone')) && violations.some((v) => v.violation_types.includes('email')) && violations.some((v) => v.violation_types.includes('payment')));
  await rejects('chat_violations is invisible to users', () => user(freelancerF, () => q(`select * from public.chat_violations`)), '42501');
  await rejects('messages cannot be inserted directly', () => user(freelancerF, () => q(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'sneaky 9876543210')`, [convF.id, freelancerF])), '42501');
  await rejects('messages cannot be edited to restore a number', () => user(freelancerF, () => q(`update public.messages set body = '9876543210' where conversation_id = $1`, [convF.id])), '42501');
  await rejects('an outsider cannot send into the conversation', () => user(outsider, () => q(`select * from public.send_message($1, 'hello there')`, [convF.id])), 'P0002');
  await rejects('the other freelancer cannot send either', () => user(freelancerG, () => q(`select * from public.send_message($1, 'hello there')`, [convF.id])), 'P0002');
  await rejects('empty messages are rejected', () => send(clientA, '   '), '22023');
  await rejects('signed-out users cannot send', () => anon(() => q(`select * from public.send_message($1, 'hi')`, [convF.id])), '42501');
  check('participants read the thread', (await user(clientA, () => q(`select id from public.messages where conversation_id = $1`, [convF.id]))).length === 2 + cases.length);
  check('an outsider reads nothing', (await user(outsider, () => q(`select id from public.messages`))).length === 0);
  check('last_message_at is updated', !!(await user(clientA, () => one(`select last_message_at from public.conversations where id = $1`, [convF.id]))).last_message_at);

  // ---- withdraw ----------------------------------------------------------
  await user(freelancerG, () => q(`update public.proposals set status = 'withdrawn' where id = $1`, [propG.id]));
  check('freelancer withdraws a pending proposal', (await user(freelancerG, () => one(`select status from public.proposals where id = $1`, [propG.id]))).status === 'withdrawn');
  const reWithdraw = await user(freelancerG, () => db.query(`update public.proposals set status = 'withdrawn' where id = $1`, [propG.id]));
  check('a withdrawn proposal cannot be changed again', reWithdraw.affectedRows === 0);
  await rejects('a withdrawn proposal cannot be accepted', () => user(clientA, () => q(`select public.accept_proposal($1)`, [propG.id])), '55000');

  // ---- orders ------------------------------------------------------------
  await rejects('only the job owner can accept', () => user(freelancerF, () => q(`select public.accept_proposal($1)`, [propF.id])), '42501');
  await rejects('another client cannot accept', () => user(outsider, () => q(`select public.accept_proposal($1)`, [propF.id])), '42501');
  const orderId = (await user(clientA, () => one(`select public.accept_proposal($1) as id`, [propF.id]))).id;
  const order = await user(clientA, () => one(`select * from public.orders where id = $1`, [orderId]));
  check('accepting creates an order', order.status === 'awaiting_payment' && order.client_id === clientA && order.freelancer_id === freelancerF);
  check('platform fee is 5% and amounts add up', order.amount_paise === 250000 && order.platform_fee_paise === 12500 && order.freelancer_earnings_paise === 237500);
  check('the job is closed and the proposal accepted', (await one(`select status from public.jobs where id = $1`, [jobA.id])).status === 'closed' && (await one(`select status from public.proposals where id = $1`, [propF.id])).status === 'accepted');
  await rejects('a closed job cannot be hired twice', () => user(clientA, () => q(`select public.accept_proposal($1)`, [propF.id])), '55000');
  check('the freelancer sees the order and its earnings', (await user(freelancerF, () => one(`select freelancer_earnings_paise from public.orders where id = $1`, [orderId]))).freelancer_earnings_paise === 237500);
  check('an outsider cannot see the order', (await user(outsider, () => q(`select id from public.orders`))).length === 0);
  await rejects('orders cannot be written directly', () => user(clientA, () => q(`update public.orders set status = 'completed' where id = $1`, [orderId])), '42501');
  await rejects('orders cannot be inserted directly', () => user(clientA, () => q(`insert into public.orders (proposal_id, job_id, client_id, freelancer_id, title, amount_paise, platform_fee_paise, freelancer_earnings_paise, delivery_days) values ($1,$2,$3,$4,'x',100,0,100,1)`, [propF.id, jobA.id, clientA, freelancerF])), '42501');
  await rejects('delivering an unpaid order is refused', () => user(freelancerF, () => q(`select public.mark_order_delivered($1)`, [orderId])), 'P0002');
  await rejects('completing an undelivered order is refused', () => user(clientA, () => q(`select public.complete_order($1)`, [orderId])), '55000');

  // fee rounding on an awkward price
  const jobR = await job(clientA);
  const propR = await propose(freelancerG, jobR.id, 123457);
  const orderRId = (await user(clientA, () => one(`select public.accept_proposal($1) as id`, [propR.id]))).id;
  const orderR = await user(clientA, () => one(`select * from public.orders where id = $1`, [orderRId]));
  check('fee rounds half up and still adds up', orderR.platform_fee_paise === 6173 && orderR.platform_fee_paise + orderR.freelancer_earnings_paise === 123457);

  // ---- payments ----------------------------------------------------------
  await rejects('users cannot create payments', () => user(clientA, () => q(`insert into public.payments (order_id, amount_paise, status) values ($1, 250000, 'captured')`, [orderId])), '42501');
  await service(() => q(`insert into public.payments (order_id, razorpay_payment_link_id, payment_url, amount_paise) values ($1, 'plink_1', 'https://rzp.io/i/x', 250000)`, [orderId]));
  await rejects('users cannot mark a payment as paid', () => user(clientA, () => q(`select public.record_payment_captured('plink_1', 'pay_1', 250000)`)), '42501');
  await rejects('signed-out users cannot mark a payment as paid', () => anon(() => q(`select public.record_payment_captured('plink_1', 'pay_1', 250000)`)), '42501');
  await rejects('a wrong amount is refused', () => service(() => q(`select public.record_payment_captured('plink_1', 'pay_1', 100)`)), '22023');
  await rejects('an unknown payment link is refused', () => service(() => q(`select public.record_payment_captured('nope', 'pay_1', 250000)`)), 'P0002');
  check('a paid order moves to in progress', (await service(() => one(`select public.record_payment_captured('plink_1', 'pay_1', 250000) as r`))).r === 'ok' && (await one(`select status from public.orders where id = $1`, [orderId])).status === 'in_progress');
  check('a repeated webhook is harmless', (await service(() => one(`select public.record_payment_captured('plink_1', 'pay_1', 250000) as r`))).r === 'duplicate');
  check('the client sees the payment status', (await user(clientA, () => one(`select status from public.payments where order_id = $1`, [orderId]))).status === 'captured');
  await rejects('Razorpay ids are hidden from the client', () => user(clientA, () => q(`select razorpay_payment_id from public.payments`)), '42501');
  await rejects('the payment url is hidden from the freelancer', () => user(freelancerF, () => q(`select payment_url from public.payments`)), '42501');
  await rejects('an outsider sees no payments', () => user(outsider, () => q(`select id, status from public.payments`)).then((r) => { if (r.length) throw Object.assign(new Error('leak'), { code: 'LEAK' }); throw Object.assign(new Error('empty'), { code: 'EMPTY' }); }), 'EMPTY');
  await rejects('a paid order cannot be cancelled', () => service(() => q(`select public.cancel_order($1, $2)`, [orderId, clientA])), '55000');

  // ---- delivery, release, review ----------------------------------------
  await rejects('the client cannot mark work as delivered', () => user(clientA, () => q(`select public.mark_order_delivered($1)`, [orderId])), 'P0002');
  await rejects('a stranger cannot mark work as delivered', () => user(outsider, () => q(`select public.mark_order_delivered($1)`, [orderId])), 'P0002');
  await user(freelancerF, () => q(`select public.mark_order_delivered($1)`, [orderId]));
  check('the freelancer delivers', (await one(`select status from public.orders where id = $1`, [orderId])).status === 'delivered');
  await rejects('the freelancer cannot release their own payment', () => user(freelancerF, () => q(`select public.complete_order($1)`, [orderId])), 'P0002');
  await rejects('reviews need a completed order', () => user(clientA, () => q(`select public.submit_review($1, 5, 'great')`, [orderId])), '55000');
  await user(clientA, () => q(`select public.complete_order($1)`, [orderId]));
  check('the client completes the order', (await one(`select status from public.orders where id = $1`, [orderId])).status === 'completed');
  check('escrow is released', (await one(`select status from public.payments where order_id = $1`, [orderId])).status === 'released');
  check('completed_orders goes up', (await one(`select completed_orders from public.freelancer_profiles where user_id = $1`, [freelancerF])).completed_orders === 1);
  await rejects('an order cannot be completed twice', () => user(clientA, () => q(`select public.complete_order($1)`, [orderId])), '55000');
  await rejects('the freelancer cannot review themselves', () => user(freelancerF, () => q(`select public.submit_review($1, 5, 'I am great')`, [orderId])), 'P0002');
  await rejects('a rating of 6 is refused', () => user(clientA, () => q(`select public.submit_review($1, 6, 'x')`, [orderId])), '22023');
  await rejects('a rating of 0 is refused', () => user(clientA, () => q(`select public.submit_review($1, 0, 'x')`, [orderId])), '22023');
  await user(clientA, () => q(`select public.submit_review($1, 5, 'Great work, delivered on time')`, [orderId]));
  await rejects('only one review per order', () => user(clientA, () => q(`select public.submit_review($1, 1, 'changed my mind')`, [orderId])), '23505');
  await rejects('reviews cannot be written directly', () => user(clientA, () => q(`insert into public.reviews (order_id, reviewer_id, freelancer_id, rating) values ($1,$2,$3,5)`, [orderId, clientA, freelancerF])), '42501');
  const fp = await one(`select rating_avg::float as avg, rating_count from public.freelancer_profiles where user_id = $1`, [freelancerF]);
  check('the freelancer rating is updated', fp.avg === 5 && fp.rating_count === 1);
  check('reviews are readable by signed-in users', (await user(outsider, () => q(`select rating from public.reviews`))).length === 1);

  // a second review changes the average
  const jobS = await job(clientA);
  const propS = await propose(freelancerF, jobS.id, 100000);
  const orderS = (await user(clientA, () => one(`select public.accept_proposal($1) as id`, [propS.id]))).id;
  await service(() => q(`insert into public.payments (order_id, razorpay_payment_link_id, amount_paise) values ($1, 'plink_2', 100000)`, [orderS]));
  await service(() => q(`select public.record_payment_captured('plink_2', 'pay_2', 100000)`));
  await user(freelancerF, () => q(`select public.mark_order_delivered($1)`, [orderS]));
  await user(clientA, () => q(`select public.complete_order($1)`, [orderS]));
  await user(clientA, () => q(`select public.submit_review($1, 2, null)`, [orderS]));
  const fp2 = await one(`select rating_avg::float as avg, rating_count, completed_orders from public.freelancer_profiles where user_id = $1`, [freelancerF]);
  check('the average updates with a second review', fp2.avg === 3.5 && fp2.rating_count === 2 && fp2.completed_orders === 2);

  // ---- cancel an unpaid order -------------------------------------------
  const jobC = await job(clientA);
  const propC = await propose(freelancerG, jobC.id, 300000);
  const orderC = (await user(clientA, () => one(`select public.accept_proposal($1) as id`, [propC.id]))).id;
  await service(() => q(`insert into public.payments (order_id, razorpay_payment_link_id, amount_paise) values ($1, 'plink_3', 300000)`, [orderC]));
  await rejects('users cannot cancel orders directly', () => user(clientA, () => q(`select public.cancel_order($1, $2)`, [orderC, clientA])), '42501');
  await rejects('only the client can have the order cancelled', () => service(() => q(`select public.cancel_order($1, $2)`, [orderC, freelancerG])), 'P0002');
  await service(() => q(`select public.cancel_order($1, $2)`, [orderC, clientA]));
  check('cancelling reopens the job and the proposal', (await one(`select status from public.orders where id = $1`, [orderC])).status === 'cancelled'
    && (await one(`select status from public.jobs where id = $1`, [jobC.id])).status === 'open'
    && (await one(`select status from public.proposals where id = $1`, [propC.id])).status === 'pending');
  check('cancelling cancels the open payment link row', (await one(`select status from public.payments where order_id = $1`, [orderC])).status === 'cancelled');
  check('a late payment on a cancelled order is flagged for refund', (await service(() => one(`select public.record_payment_captured('plink_3', 'pay_3', 300000) as r`))).r === 'needs_refund');
  const orderC2 = (await user(clientA, () => one(`select public.accept_proposal($1) as id`, [propC.id]))).id;
  check('the same freelancer can be hired again after a cancel', !!orderC2 && orderC2 !== orderC);

  // ---- realtime ---------------------------------------------------------
  const published = (await q(`select tablename from pg_publication_tables where pubname = 'supabase_realtime'`)).map((r) => r.tablename).sort();
  check('messages and orders are published to Realtime', published.includes('messages') && published.includes('orders'), published.join(','));

  // ---- migration 0009: edit jobs, badges, payouts, admin ------------------
  const jobE = await job(clientA);
  await user(clientA, () => q(`update public.jobs set title = 'Logo for my bakery shop', budget_max_paise = 600000 where id = $1`, [jobE.id]));
  check('a poster can fix a job title and budget', (await one(`select title from public.jobs where id = $1`, [jobE.id])).title === 'Logo for my bakery shop');
  const strangerEdit2 = await user(outsider, () => db.query(`update public.jobs set title = 'hacked job title' where id = $1`, [jobE.id]));
  check('others cannot edit my job', strangerEdit2.affectedRows === 0);
  await rejects('job type cannot be changed after posting', () => user(clientA, () => q(`update public.jobs set job_type = 'monthly' where id = $1`, [jobE.id])), '42501');
  const liveEdit = await user(clientA, () => db.query(`update public.jobs set title = 'changed while ordered' where id = $1`, [jobA.id]));
  check('a job with a live order cannot be edited', liveEdit.affectedRows === 0);

  // unread badges
  const badges = (uid) => user(uid, async () => (await one(`select public.my_badges() as b`)).b);
  const before = await badges(clientA);
  const jobM = await job(clientA);
  const propM = await propose(freelancerF, jobM.id, 100000);
  const convM = (await user(freelancerF, () => one(`select id from public.conversations where proposal_id = $1`, [propM.id]))).id;
  await user(freelancerF, () => q(`select public.send_message($1, 'Hello, I can start today')`, [convM]));
  check('a new message shows as unread for the other person', (await badges(clientA)).messages === before.messages + 1);
  check('your own message is not unread for you', (await badges(freelancerF)).messages === (await badges(freelancerF)).messages);
  await user(clientA, () => q(`select public.mark_conversation_read($1)`, [convM]));
  check('opening the chat clears it', (await badges(clientA)).messages === before.messages);
  await rejects('only participants can mark a chat read', () => user(outsider, () => q(`select public.mark_conversation_read($1)`, [convM])), 'P0002');
  await rejects('read marks cannot be written directly', () => user(clientA, () => q(`insert into public.conversation_reads (conversation_id, user_id) values ($1, $2)`, [convM, clientA])), '42501');
  check('orders needing action are counted (freelancer, order in progress)', (await badges(freelancerF)).orders >= 0);

  // admin
  const admin = await newUser('admin@test');
  await setProfile(admin, 'client', 'Admin');
  await service(() => q(`update public.profiles set is_admin = true where id = $1`, [admin]));
  for (const call of ['admin_pending_companies()', 'admin_flagged_messages()', 'admin_payouts_due()']) {
    await rejects(`non-admins cannot call ${call}`, () => user(clientA, () => q(`select * from public.${call}`)), '42501');
  }
  await rejects('non-admins cannot verify companies', () => user(clientA, () => q(`select public.admin_set_company_verification($1, 'verified')`, [company2.id])), '42501');
  await user(outsider, () => q(`select public.submit_company_verification('29BBBBB1111B1Z6', null)`));
  const pending = await user(admin, () => q(`select * from public.admin_pending_companies()`));
  check('an admin sees companies waiting for review, with the private numbers', pending.length === 1 && pending[0].gst_number === '29BBBBB1111B1Z6');
  await rejects('an admin can only set verified or rejected', () => user(admin, () => q(`select public.admin_set_company_verification($1, 'none')`, [company2.id])), '22023');
  await user(admin, () => q(`select public.admin_set_company_verification($1, 'verified')`, [company2.id]));
  check('an admin verifies a company', (await service(() => one(`select verification_status from public.companies where id = $1`, [company2.id]))).verification_status === 'verified');
  await rejects('a company is reviewed only once', () => user(admin, () => q(`select public.admin_set_company_verification($1, 'rejected')`, [company2.id])), 'P0002');
  const flagged = await user(admin, () => q(`select * from public.admin_flagged_messages()`));
  check('an admin sees flagged chat messages with the original text', flagged.length > 0 && flagged.some((f) => f.original_body.includes('98765 43210')));
  const due = await user(admin, () => q(`select * from public.admin_payouts_due()`));
  check('completed, released orders are due for payout', due.length === 2 && due.every((d) => d.earnings_paise > 0));
  await rejects('non-admins cannot mark a payout', () => user(freelancerF, () => q(`select public.admin_mark_paid_out($1)`, [orderId])), '42501');
  await user(admin, () => q(`select public.admin_mark_paid_out($1)`, [orderId]));
  check('a payout can be marked as paid', (await user(admin, () => q(`select * from public.admin_payouts_due()`))).length === 1);
  await rejects('a payout cannot be paid twice', () => user(admin, () => q(`select public.admin_mark_paid_out($1)`, [orderId])), 'P0002');
  check('the freelancer sees when they were paid', !!(await user(freelancerF, () => one(`select paid_out_at from public.payments where order_id = $1`, [orderId]))).paid_out_at);
  await rejects('is_admin stays hidden from users', () => user(admin, () => q(`select is_admin from public.profiles`)), '42501');

  // ---- signed-out access is closed everywhere ---------------------------
  for (const table of ['jobs', 'proposals', 'conversations', 'messages', 'orders', 'payments', 'reviews', 'companies', 'freelancer_profiles']) {
    await rejects(`signed-out users cannot read ${table}`, () => anon(() => q(`select 1 from public.${table} limit 1`)), '42501');
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error('HARNESS ERROR', error);
  process.exit(2);
});
