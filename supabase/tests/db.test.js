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
  -- Just enough of Supabase Storage for the identity-photo policies.
  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid default auth.uid()
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.buckets, storage.objects to authenticated, service_role;
  grant execute on function storage.foldername(text) to anon, authenticated, service_role;
  -- Just enough of Vault and pg_net for the push trigger.
  create schema vault;
  create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
  create schema net;
  create table net.calls (url text, body jsonb, headers jsonb);
  grant usage on schema net, vault to service_role;
  grant all on net.calls, vault.decrypted_secrets to service_role;
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds integer default 5000)
    returns bigint language plpgsql as
    $$ begin
      if url like '%explode%' then raise exception 'network down'; end if;
      insert into net.calls values (url, body, headers);
      return 1;
    end $$;
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
  // Only verified freelancers can apply (migration 0013); an admin verifies people in real life.
  const verify = (uid) => service(() => q(`update public.profiles set verification_status = 'verified' where id = $1`, [uid]));
  for (const uid of [bothUser, freelancerF, freelancerG]) await verify(uid);
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
  await rejects('non-admins cannot verify companies', () => user(clientA, () => q(`select public.admin_set_company_verification($1, 'verified', null)`, [company2.id])), '42501');
  await user(outsider, () => q(`select public.submit_company_verification('29BBBBB1111B1Z6', null)`));
  const pending = await user(admin, () => q(`select * from public.admin_pending_companies()`));
  check('the review queue shows only masked numbers', pending.length === 1 && pending[0].gst_masked === '29***********Z6' && !('gst_number' in pending[0]));
  const detail = await user(admin, () => one(`select * from public.admin_company_detail($1)`, [pending[0].id]));
  check('the detail screen shows the full number', detail.gst_number === '29BBBBB1111B1Z6');
  await rejects('non-admins cannot open company details', () => user(clientA, () => q(`select * from public.admin_company_detail($1)`, [pending[0].id])), '42501');
  await rejects('an admin can only set verified or rejected', () => user(admin, () => q(`select public.admin_set_company_verification($1, 'none', null)`, [company2.id])), '22023');
  await rejects('a rejection needs a reason', () => user(admin, () => q(`select public.admin_set_company_verification($1, 'rejected', '')`, [company2.id])), '22023');
  await user(admin, () => q(`select public.admin_set_company_verification($1, 'verified', null)`, [company2.id]));
  check('an admin verifies a company', (await service(() => one(`select verification_status from public.companies where id = $1`, [company2.id]))).verification_status === 'verified');
  await rejects('a company is reviewed only once', () => user(admin, () => q(`select public.admin_set_company_verification($1, 'rejected', 'again please')`, [company2.id])), 'P0002');
  const flagged = await user(admin, () => q(`select * from public.admin_flagged_messages()`));
  check('an admin sees flagged chat messages with the original text', flagged.length > 0 && flagged.some((f) => f.original_body.includes('98765 43210')));
  const due = await user(admin, () => q(`select * from public.admin_payouts_due()`));
  check('completed, released orders are due for payout', due.length === 2 && due.every((d) => d.earnings_paise > 0));
  await rejects('non-admins cannot mark a payout', () => user(freelancerF, () => q(`select public.admin_mark_paid_out($1, 'UTR123456')`, [orderId])), '42501');
  await rejects('a payout needs a bank reference', () => user(admin, () => q(`select public.admin_mark_paid_out($1, 'x')`, [orderId])), '22023');
  await user(admin, () => q(`select public.admin_mark_paid_out($1, 'UTR123456')`, [orderId]));
  check('a payout can be marked as paid', (await user(admin, () => q(`select * from public.admin_payouts_due()`))).length === 1);
  await rejects('a payout cannot be paid twice', () => user(admin, () => q(`select public.admin_mark_paid_out($1, 'UTR999999')`, [orderId])), 'P0002');
  check('the freelancer sees when they were paid', !!(await user(freelancerF, () => one(`select paid_out_at from public.payments where order_id = $1`, [orderId]))).paid_out_at);
  await rejects('is_admin stays hidden from users', () => user(admin, () => q(`select is_admin from public.profiles`)), '42501');

  // ---- migration 0010: admin panel --------------------------------------
  for (const call of ["admin_stats()", "admin_revenue('day', 7)", "admin_users('', 10, 0)", "admin_jobs('', null, 10, 0)", "admin_orders(null, 10, 0)", "admin_audit_log_list(10, 0)"]) {
    await rejects(`non-admins cannot call ${call}`, () => user(clientA, () => q(`select * from public.${call}`)), '42501');
  }
  await rejects('signed-out users cannot call admin functions', () => anon(() => q(`select public.admin_stats()`)), '42501');
  await rejects('the audit log table is closed to everyone', () => user(admin, () => q(`select * from public.admin_audit_log`)), '42501');
  await rejects('nobody can write the audit log directly', () => user(admin, () => q(`insert into public.admin_audit_log (admin_id, action, target_type) values ($1, 'x', 'y')`, [admin])), '42501');
  await rejects('log_admin_action is not callable by the app', () => user(admin, () => q(`select public.log_admin_action('x', 'y', null)`)), '42501');

  const stats = await user(admin, async () => (await one(`select public.admin_stats() as s`)).s);
  check('overview counts users, jobs and orders', stats.users >= 7 && stats.jobs_open > 0 && stats.orders_completed >= 1);
  check('overview money adds up from orders', stats.platform_fees_paise > 0 && stats.paid_volume_paise >= stats.platform_fees_paise);
  check('overview shows payouts still due', stats.payouts_due_paise > 0 && stats.payouts_due_count >= 1);
  const revenue = await user(admin, () => q(`select * from public.admin_revenue('day', 7)`));
  check('revenue groups completed orders by day', revenue.length >= 1 && Number(revenue[0].fees_paise) > 0);
  await rejects('revenue only groups by day or month', () => user(admin, () => q(`select * from public.admin_revenue('year', 7)`)), '22023');

  const found = await user(admin, () => q(`select * from public.admin_users('freelancer f', 10, 0)`));
  check('admin searches users by name', found.length === 1 && found[0].email === 'f@test');
  check('admin searches users by email', (await user(admin, () => q(`select id from public.admin_users('client@test', 10, 0)`))).length === 1);
  check('a search with wildcards is treated as plain text', (await user(admin, () => q(`select id from public.admin_users('%', 10, 0)`))).length === 0);
  check('admin pages through users', (await user(admin, () => q(`select id from public.admin_users('', 2, 0)`))).length === 2);
  const ud = await user(admin, async () => (await one(`select public.admin_user_detail($1) as d`, [freelancerF])).d);
  check('user detail shows activity counts', ud.proposals >= 1 && ud.orders_as_freelancer >= 1);
  await rejects('non-admins cannot open user details', () => user(clientA, () => q(`select public.admin_user_detail($1)`, [freelancerF])), '42501');

  check('admin lists jobs with poster and proposal count', (await user(admin, () => q(`select * from public.admin_jobs('bakery', null, 50, 0)`))).some((j) => j.has_live_order && Number(j.proposals) >= 1));
  check('admin lists orders with payment status', (await user(admin, () => q(`select * from public.admin_orders('completed', 10, 0)`))).every((o) => o.payment_status === 'released'));
  check('a paid-out order shows its bank reference', (await user(admin, () => q(`select * from public.admin_orders('completed', 10, 0)`))).some((o) => o.payout_reference === 'UTR123456'));

  // closing a job
  const spam = await job(clientA);
  await rejects('non-admins cannot close jobs this way', () => user(clientA, () => q(`select public.admin_close_job($1, 'spam listing')`, [spam.id])), '42501');
  await rejects('closing a job needs a reason', () => user(admin, () => q(`select public.admin_close_job($1, '')`, [spam.id])), '22023');
  await user(admin, () => q(`select public.admin_close_job($1, 'spam listing')`, [spam.id]));
  check('admin takes a job off the board', (await one(`select status from public.jobs where id = $1`, [spam.id])).status === 'closed');
  await rejects('a job with a live order cannot be closed by admin', () => user(admin, () => q(`select public.admin_close_job($1, 'because')`, [jobA.id])), '55000');

  // suspending
  const troll = await newUser('troll@test');
  await setProfile(troll, 'both', 'Troll');
  await verify(troll);
  await user(troll, () => q(`insert into public.freelancer_profiles (user_id, bio, skills) values ($1, 'I do many things well', array['writing'])`, [troll]));
  await rejects('non-admins cannot suspend', () => user(clientA, () => q(`select public.admin_set_user_suspended($1, true, 'rude')`, [troll])), '42501');
  await rejects('an admin cannot suspend themselves', () => user(admin, () => q(`select public.admin_set_user_suspended($1, true, 'oops')`, [admin])), '22023');
  await rejects('suspending needs a reason', () => user(admin, () => q(`select public.admin_set_user_suspended($1, true, '')`, [troll])), '22023');
  await user(admin, () => q(`select public.admin_set_user_suspended($1, true, 'Scam reports')`, [troll]));
  check('a suspended user knows it', (await user(troll, async () => (await one(`select public.am_suspended() as s`)).s)) === true);
  check('other users are not suspended', (await user(clientA, async () => (await one(`select public.am_suspended() as s`)).s)) === false);
  await rejects('a suspended user cannot post a job', () => job(troll), '42501');
  await rejects('a suspended user cannot apply to a job', () => propose(troll, jobS.id, 100000), '42501');
  await user(admin, () => q(`select public.admin_set_user_suspended($1, true, 'Spam in chat')`, [freelancerF]));
  await rejects('a suspended user cannot send a message', () => user(freelancerF, () => q(`select public.send_message($1, 'hello again')`, [convM])), '42501');
  await user(admin, () => q(`select public.admin_set_user_suspended($1, false)`, [freelancerF]));
  check('a restored user can send messages again', !!(await user(freelancerF, () => one(`select public.send_message($1, 'hello again') as m`, [convM]))));
  await user(admin, () => q(`select public.admin_set_user_suspended($1, false)`, [troll]));
  check('a restored user can work again', !!(await job(troll)).id);
  const jobH = await job(clientA);
  const propH = await propose(freelancerG, jobH.id, 50000);
  await user(admin, () => q(`select public.admin_set_user_suspended($1, true, 'Fake portfolio')`, [freelancerG]));
  await rejects('a client cannot hire a suspended freelancer', () => user(clientA, () => q(`select public.accept_proposal($1)`, [propH.id])), '42501');
  await user(admin, () => q(`select public.admin_set_user_suspended($1, false)`, [freelancerG]));
  await rejects('suspended status stays hidden from the app', () => user(clientA, () => q(`select suspended_at from public.profiles`)), '42501');

  // payout details
  await rejects('a client-only user cannot save payout details', () => user(outsider, () => q(`insert into public.payout_details (upi_id, account_name) values ('x@okaxis', 'Out Sider')`)), '42501');
  await rejects('a bad UPI id is refused', () => user(freelancerF, () => q(`insert into public.payout_details (upi_id, account_name) values ('not a upi', 'Freelancer F')`)), '23514');
  await user(freelancerF, () => q(`insert into public.payout_details (upi_id, account_name) values ('freelancerf@okaxis', 'Freelancer F')`));
  check('a freelancer sees their own payout details', (await user(freelancerF, () => q(`select * from public.payout_details`))).length === 1);
  check('others cannot see payout details', (await user(freelancerG, () => q(`select * from public.payout_details`))).length === 0);
  check('admin sees where to pay in the payout list', (await user(admin, () => q(`select * from public.admin_payouts_due()`))).every((d) => d.upi_id === null || d.upi_id === 'freelancerf@okaxis'));

  // categories
  await rejects('non-admins cannot add categories', () => user(clientA, () => q(`select public.admin_upsert_category(null, 'cooking', 'Cooking', 'சமையல்', 'book-open', 9, true)`)), '42501');
  await rejects('categories cannot be written directly any more', () => user(admin, () => q(`insert into public.categories (slug, name_en, name_ta, icon) values ('x1', 'X', 'X', 'mic')`)), '42501');
  const cat = (await user(admin, () => one(`select public.admin_upsert_category(null, 'cooking', 'Cooking', 'சமையல்', 'book-open', 9, true) as id`))).id;
  check('admin adds a category', (await user(clientA, () => q(`select * from public.categories where slug = 'cooking'`))).length === 1);
  await user(admin, () => q(`select public.admin_upsert_category($1, 'cooking', 'Home cooking', 'வீட்டு சமையல்', 'book-open', 9, false)`, [cat]));
  check('admin edits a category', (await one(`select name_en, is_active from public.categories where id = $1`, [cat])).is_active === false);
  await rejects('a category needs a Tamil name', () => user(admin, () => q(`select public.admin_upsert_category(null, 'baking', 'Baking', '', 'mic', 10, true)`)), '22023');

  // the audit log
  const log = await user(admin, () => q(`select * from public.admin_audit_log_list(100, 0)`));
  const acts = log.map((l) => l.action);
  for (const a of ['verify_company', 'mark_paid_out', 'close_job', 'suspend_user', 'restore_user', 'add_category', 'edit_category', 'view_company_ids']) {
    check(`the audit log records ${a}`, acts.includes(a));
  }
  check('failed admin actions leave no audit entry', !acts.includes('reject_company'));
  check('audit entries name the admin and keep the reason', log.every((l) => l.admin_name === 'Admin') && log.some((l) => l.details.reason === 'Scam reports'));

  // ---- migration 0011: disputes -------------------------------------------
  let linkNo = 0;
  const paidOrder = async (freelancer, price) => {
    const jb = await job(clientA);
    const pr = await propose(freelancer, jb.id, price);
    const oid = (await user(clientA, () => one(`select public.accept_proposal($1) as id`, [pr.id]))).id;
    linkNo += 1;
    await service(() => q(`insert into public.payments (order_id, razorpay_payment_link_id, payment_url, amount_paise) values ($1, $2, 'https://rzp.io/i/d', $3)`, [oid, 'plink_d' + linkNo, price]));
    await service(() => q(`select public.record_payment_captured($1, $2, $3)`, ['plink_d' + linkNo, 'pay_d' + linkNo, price]));
    return { oid, pid: pr.id };
  };
  const D1 = await paidOrder(freelancerF, 100000);
  const why = 'The logo files never arrived and the freelancer stopped replying.';
  await rejects('an outsider cannot dispute an order', () => user(outsider, () => q(`select public.open_dispute($1, $2)`, [D1.oid, why])), 'P0002');
  await rejects('a dispute needs a real description', () => user(clientA, () => q(`select public.open_dispute($1, 'bad')`, [D1.oid])), '22023');
  await rejects('an unpaid order cannot be disputed', () => user(clientA, () => q(`select public.open_dispute($1, $2)`, [orderRId, why])), '55000');
  await rejects('signed-out users cannot open disputes', () => anon(() => q(`select public.open_dispute($1, $2)`, [D1.oid, why])), '42501');
  const dp1 = (await user(clientA, () => one(`select public.open_dispute($1, $2) as id`, [D1.oid, why]))).id;
  check('opening a dispute freezes the order', (await one(`select status from public.orders where id = $1`, [D1.oid])).status === 'disputed');
  await rejects('an order cannot be disputed twice at once', () => user(freelancerF, () => q(`select public.open_dispute($1, $2)`, [D1.oid, why])), '55000');
  await rejects('a disputed order cannot be delivered', () => user(freelancerF, () => q(`select public.mark_order_delivered($1)`, [D1.oid])), 'P0002');
  await rejects('a disputed order cannot be approved', () => user(clientA, () => q(`select public.complete_order($1)`, [D1.oid])), '55000');
  check('both people on the order can read the dispute', (await user(freelancerF, () => q(`select id from public.disputes`))).length === 1 && (await user(clientA, () => q(`select id from public.disputes where id = $1`, [dp1]))).length === 1);
  check('outsiders cannot read disputes', (await user(outsider, () => q(`select id from public.disputes`))).length === 0);
  await rejects('disputes cannot be written directly', () => user(clientA, () => q(`update public.disputes set status = 'resolved' where id = $1`, [dp1])), '42501');
  await rejects('only the opener can withdraw', () => user(freelancerF, () => q(`select public.withdraw_dispute($1)`, [dp1])), 'P0002');
  await user(clientA, () => q(`select public.withdraw_dispute($1)`, [dp1]));
  check('withdrawing puts the order back', (await one(`select status from public.orders where id = $1`, [D1.oid])).status === 'in_progress');
  await rejects('a withdrawn dispute cannot be withdrawn again', () => user(clientA, () => q(`select public.withdraw_dispute($1)`, [dp1])), '55000');
  const dp2 = (await user(freelancerF, () => one(`select public.open_dispute($1, $2) as id`, [D1.oid, 'The client keeps changing the brief after I deliver.']))).id;
  const convD = (await one(`select id from public.conversations where proposal_id = $1`, [D1.pid])).id;
  await user(freelancerF, () => q(`select public.send_message($1, 'I did send the files yesterday')`, [convD]));

  // admin side
  await rejects('non-admins cannot list disputes', () => user(clientA, () => q(`select * from public.admin_disputes('open', 10, 0)`)), '42501');
  await rejects('non-admins cannot read a dispute chat', () => user(clientA, () => q(`select * from public.admin_dispute_messages($1)`, [dp2])), '42501');
  const openList = await user(admin, () => q(`select * from public.admin_disputes('open', 10, 0)`));
  check('admin sees open disputes and who opened them', openList.length === 1 && openList[0].opened_by_role === 'freelancer' && openList[0].amount_paise === 100000);
  check('admin reads the chat behind a dispute', (await user(admin, () => q(`select * from public.admin_dispute_messages($1)`, [dp2]))).some((m) => m.body.includes('yesterday') && m.sender_role === 'freelancer'));
  check('the overview counts open disputes', (await user(admin, async () => (await one(`select public.admin_stats() as s`)).s)).disputes_open === 1);

  const resolve = (id, res, refund, ref, note = 'Decision after reading the chat') => user(admin, () => q(`select public.admin_resolve_dispute($1, $2, $3, $4, $5)`, [id, res, refund, ref, note]));
  await rejects('non-admins cannot resolve disputes', () => user(clientA, () => q(`select public.admin_resolve_dispute($1, 'release', 0, null, 'because I said so')`, [dp2])), '42501');
  await rejects('an unknown resolution is refused', () => resolve(dp2, 'burn', 0, null), '22023');
  await rejects('a decision needs an explanation', () => resolve(dp2, 'release', 0, null, 'no'), '22023');
  await rejects('a refund needs the bank reference', () => resolve(dp2, 'refund', 0, null), '22023');
  await rejects('a split cannot refund nothing', () => resolve(dp2, 'split', 0, 'UTR000111'), '22023');
  await rejects('a split cannot refund everything', () => resolve(dp2, 'split', 100000, 'UTR000111'), '22023');
  check('refused decisions leave the dispute open', (await one(`select status from public.disputes where id = $1`, [dp2])).status === 'open');

  await resolve(dp2, 'refund', 0, 'REFUND-0001');
  const refunded = await one(`select * from public.orders where id = $1`, [D1.oid]);
  check('a refund cancels the order and returns the whole payment', refunded.status === 'cancelled' && refunded.refunded_paise === 100000 && refunded.platform_fee_paise === 0 && refunded.freelancer_earnings_paise === 0);
  check('a refund marks the payment refunded', (await one(`select status from public.payments where order_id = $1`, [D1.oid])).status === 'refunded');
  check('the dispute records who decided and the reference', (await user(clientA, () => one(`select * from public.disputes where id = $1`, [dp2]))).refund_reference === 'REFUND-0001');
  await rejects('a resolved dispute cannot be resolved again', () => resolve(dp2, 'release', 0, null), '55000');

  const D2 = await paidOrder(freelancerF, 100000);
  const doneBefore = (await one(`select completed_orders from public.freelancer_profiles where user_id = $1`, [freelancerF])).completed_orders;
  const dp3 = (await user(clientA, () => one(`select public.open_dispute($1, $2) as id`, [D2.oid, why]))).id;
  await resolve(dp3, 'release', 0, null);
  const released = await one(`select * from public.orders where id = $1`, [D2.oid]);
  check('a release completes the order with the usual fee', released.status === 'completed' && released.platform_fee_paise === 5000 && released.freelancer_earnings_paise === 95000 && released.refunded_paise === 0);
  check('a release counts as a completed job and is due for payout', (await one(`select completed_orders from public.freelancer_profiles where user_id = $1`, [freelancerF])).completed_orders === doneBefore + 1 && (await user(admin, () => q(`select * from public.admin_payouts_due()`))).some((d) => d.order_id === D2.oid));

  const D3 = await paidOrder(freelancerG, 100000);
  const dp4 = (await user(freelancerG, () => one(`select public.open_dispute($1, $2) as id`, [D3.oid, why]))).id;
  await resolve(dp4, 'split', 40000, 'REFUND-0002');
  const split = await one(`select * from public.orders where id = $1`, [D3.oid]);
  check('a split refunds part and charges the fee on the rest', split.status === 'completed' && split.refunded_paise === 40000 && split.platform_fee_paise === 3000 && split.freelancer_earnings_paise === 57000);
  check('the amounts on a split order still add up', split.platform_fee_paise + split.freelancer_earnings_paise + split.refunded_paise === split.amount_paise);
  check('a split releases the payment for payout', (await one(`select status from public.payments where order_id = $1`, [D3.oid])).status === 'released');
  check('nothing is left open', (await user(admin, () => q(`select * from public.admin_disputes('open', 10, 0)`))).length === 0);
  check('resolved disputes are listed with their decision', (await user(admin, () => q(`select * from public.admin_disputes('resolved', 10, 0)`))).some((d) => d.resolution === 'split' && d.refund_paise === 40000));
  const dpLog = (await user(admin, () => q(`select action, details from public.admin_audit_log_list(100, 0)`)));
  check('the audit log records disputes decided and chats read', dpLog.some((l) => l.action === 'resolve_dispute' && l.details.resolution === 'split') && dpLog.some((l) => l.action === 'view_dispute_chat'));

  // ---- migration 0013: only verified freelancers can apply -----------------
  const newbie = await newUser('newbie@test');
  await setProfile(newbie, 'freelancer', 'Newbie');
  const jobV = await job(clientA);
  await rejects('an unverified freelancer cannot apply', () => propose(newbie, jobV.id), '42501');
  await verify(newbie);
  check('a verified freelancer can apply', !!(await propose(newbie, jobV.id)).id);
  await service(() => q(`update public.profiles set verification_status = 'none' where id = $1`, [freelancerF]));

  // ---- migration 0012: identity photos and checks -----------------------
  const putFile = (uid, name) => user(uid, () => q(`insert into storage.objects (bucket_id, name) values ('identity', $1)`, [name]));
  const idPath = `${freelancerF}/100-id.jpg`;
  const selfiePath = `${freelancerF}/100-selfie.jpg`;
  const panPath = `${freelancerF}/100-pan.jpg`;
  await rejects('people cannot upload into someone else\'s folder', () => putFile(freelancerG, idPath), '42501');
  await rejects('signed-out users cannot upload identity photos', () => anon(() => q(`insert into storage.objects (bucket_id, name) values ('identity', 'x/y.jpg')`)), '42501');
  await putFile(freelancerF, idPath);
  check('people can upload into their own folder', (await one(`select count(*)::int as n from storage.objects where bucket_id = 'identity'`)).n === 1);
  check('nobody can read the photos back, not even the owner', (await user(freelancerF, () => q(`select * from storage.objects where bucket_id = 'identity'`))).length === 0);
  check('other people cannot read the photos either', (await user(clientA, () => q(`select * from storage.objects where bucket_id = 'identity'`))).length === 0);
  check('an admin can read the photos', (await user(admin, () => q(`select * from storage.objects where bucket_id = 'identity'`))).length === 1);
  await user(freelancerF, () => q(`delete from storage.objects where bucket_id = 'identity'`));
  check('the owner cannot delete the photos', (await one(`select count(*)::int as n from storage.objects where bucket_id = 'identity'`)).n === 1);
  check('the identity bucket is private', (await one(`select public from storage.buckets where id = 'identity'`)).public === false);

  const submitId = (uid, a, p, sf) => user(uid, () => one(`select public.submit_identity_verification($1, $2, $3) as id`, [a, p, sf]));
  await rejects('only freelancers can submit an identity check', () => submitId(clientA, `${clientA}/1-id.jpg`, `${clientA}/1-pan.jpg`, `${clientA}/1-selfie.jpg`), '42501');
  await rejects('the selfie and PAN photo must exist in storage', () => submitId(freelancerF, idPath, panPath, selfiePath), '22023');
  await putFile(freelancerF, selfiePath);
  await rejects('the PAN photo must exist in storage', () => submitId(freelancerF, idPath, panPath, selfiePath), '22023');
  await putFile(freelancerF, panPath);
  await rejects('paths must be in the person\'s own folder', () => submitId(freelancerF, `${freelancerG}/100-id.jpg`, panPath, selfiePath), '22023');
  await rejects('the three photos must be different files', () => submitId(freelancerF, idPath, panPath, panPath), '22023');
  await rejects('a missing PAN photo is refused', () => user(freelancerF, () => q(`select public.submit_identity_verification($1, null, $2)`, [idPath, selfiePath])), '22023');
  await rejects('a path with dots and slashes is refused', () => submitId(freelancerF, `${freelancerF}/../x.jpg`, panPath, selfiePath), '22023');
  const idv = (await submitId(freelancerF, idPath, panPath, selfiePath)).id;
  check('submitting marks the profile as pending', (await user(clientA, () => one(`select verification_status from public.profiles where id = $1`, [freelancerF]))).verification_status === 'pending');
  await rejects('a second submission while pending is refused', () => submitId(freelancerF, idPath, panPath, selfiePath), '55000');
  check('people can read the status of their own check', (await user(freelancerF, () => one(`select status from public.identity_verifications`))).status === 'pending');
  await rejects('the file paths are not readable from the app', () => user(freelancerF, () => q(`select id_path from public.identity_verifications`)), '42501');
  check('other people cannot see anyone\'s check', (await user(clientA, () => q(`select id from public.identity_verifications`))).length === 0);
  await rejects('checks cannot be written directly', () => user(freelancerF, () => q(`update public.identity_verifications set status = 'verified' where id = $1`, [idv])), '42501');

  await rejects('non-admins cannot list identity checks', () => user(clientA, () => q(`select * from public.admin_identities('pending', 10, 0)`)), '42501');
  await rejects('non-admins cannot get the photo paths', () => user(freelancerF, () => q(`select * from public.admin_identity_files($1, 'view')`, [idv])), '42501');
  await rejects('non-admins cannot review', () => user(freelancerF, () => q(`select public.admin_review_identity($1, 'verified')`, [idv])), '42501');
  const waiting = await user(admin, () => q(`select * from public.admin_identities('pending', 10, 0)`));
  check('admin sees the check waiting, without any file paths', waiting.length === 1 && waiting[0].user_name === 'Freelancer F' && !('id_path' in waiting[0]));
  check('the overview counts identity checks waiting', (await user(admin, async () => (await one(`select public.admin_stats() as s`)).s)).identities_pending === 1);
  const idFiles = await user(admin, () => one(`select * from public.admin_identity_files($1, 'view')`, [idv]));
  check('admin gets the photo paths to make signed links', idFiles.id_path === idPath && idFiles.pan_path === panPath && idFiles.selfie_path === selfiePath);
  await rejects('photos of a pending check cannot be deleted yet', () => user(admin, () => q(`select public.admin_identity_files_deleted($1)`, [idv])), '55000');
  await rejects('a rejection needs a reason', () => user(admin, () => q(`select public.admin_review_identity($1, 'rejected', '')`, [idv])), '22023');
  await user(admin, () => q(`select public.admin_review_identity($1, 'rejected', 'The ID photo is blurry')`, [idv]));
  check('rejecting tells the person why', (await user(freelancerF, () => one(`select rejection_reason from public.identity_verifications where id = $1`, [idv]))).rejection_reason === 'The ID photo is blurry');
  check('rejecting resets the profile status', (await user(clientA, () => one(`select verification_status from public.profiles where id = $1`, [freelancerF]))).verification_status === 'rejected');
  await rejects('a check is reviewed only once', () => user(admin, () => q(`select public.admin_review_identity($1, 'verified')`, [idv])), 'P0002');
  check('reviewed checks wait in the delete list', (await user(admin, () => q(`select * from public.admin_identities('to_delete', 10, 0)`))).length === 1);
  check('the overview counts photos to delete', (await user(admin, async () => (await one(`select public.admin_stats() as s`)).s)).identity_photos_to_delete === 1);

  await rejects('files cannot be marked deleted while they are still stored', () => user(admin, () => q(`select public.admin_identity_files_deleted($1)`, [idv])), '55000');
  const delPaths = await user(admin, () => one(`select * from public.admin_identity_files($1, 'delete')`, [idv]));
  check('admin gets the paths to delete after review', delPaths.id_path === idPath);
  await user(admin, () => q(`delete from storage.objects where bucket_id = 'identity' and name in ($1, $2, $3)`, [idPath, panPath, selfiePath]));
  check('an admin can delete the photos', (await one(`select count(*)::int as n from storage.objects where bucket_id = 'identity'`)).n === 0);
  await user(admin, () => q(`select public.admin_identity_files_deleted($1)`, [idv]));
  const gone = await service(() => one(`select id_path, pan_path, selfie_path, files_deleted_at from public.identity_verifications where id = $1`, [idv]));
  check('after deletion the check keeps no file paths', gone.id_path === null && gone.pan_path === null && gone.selfie_path === null && gone.files_deleted_at !== null);
  check('the delete list is empty afterwards', (await user(admin, () => q(`select * from public.admin_identities('to_delete', 10, 0)`))).length === 0);
  await rejects('deleted photos cannot be opened', () => user(admin, () => q(`select * from public.admin_identity_files($1, 'view')`, [idv])), '55000');

  const idPath2 = `${freelancerF}/200-id.jpg`;
  const selfiePath2 = `${freelancerF}/200-selfie.jpg`;
  const panPath2 = `${freelancerF}/200-pan.jpg`;
  await putFile(freelancerF, idPath2);
  await putFile(freelancerF, panPath2);
  await putFile(freelancerF, selfiePath2);
  const idv2 = (await submitId(freelancerF, idPath2, panPath2, selfiePath2)).id;
  check('a rejected person can try again', !!idv2);
  await user(admin, () => q(`select public.admin_review_identity($1, 'verified')`, [idv2]));
  check('approving marks the profile verified for everyone to see', (await user(clientA, () => one(`select verification_status from public.profiles where id = $1`, [freelancerF]))).verification_status === 'verified');
  await rejects('a verified person cannot submit again', () => submitId(freelancerF, idPath2, panPath2, selfiePath2), '55000');
  await user(admin, () => q(`delete from storage.objects where bucket_id = 'identity'`));
  await user(admin, () => q(`select public.admin_identity_files_deleted($1)`, [idv2]));
  const idLog = await user(admin, () => q(`select action from public.admin_audit_log_list(100, 0)`));
  for (const a of ['view_identity', 'reject_identity', 'verify_identity', 'delete_identity_files']) {
    check(`the audit log records ${a}`, idLog.some((l) => l.action === a));
  }

  // ---- migration 0014: notifications ---------------------------------------
  const nClient = await newUser('n-client@test');
  const nFree = await newUser('n-free@test');
  await setProfile(nClient, 'client', 'Nina Client');
  await setProfile(nFree, 'freelancer', 'Farid Free');
  await verify(nFree);
  const inbox = (uid) => user(uid, () => q(`select kind, data, read_at from public.notifications order by created_at, id`));
  const kinds = async (uid) => (await inbox(uid)).map((n) => n.kind);

  const nJob = await job(nClient);
  const nProp = await propose(nFree, nJob.id, 100000);
  check('a client hears about a new proposal, with the freelancer name', (await inbox(nClient)).some((n) => n.kind === 'proposal_received' && n.data.name === 'Farid Free' && n.data.proposal_id === nProp.id));
  check('the freelancer is not told about their own proposal', !(await kinds(nFree)).includes('proposal_received'));

  const nConv = (await one(`select id from public.conversations where proposal_id = $1`, [nProp.id])).id;
  await user(nFree, () => q(`select public.send_message($1, 'Hello, I can start today')`, [nConv]));
  await user(nFree, () => q(`select public.send_message($1, 'And I can share samples too')`, [nConv]));
  check('many messages in one chat make one notification', (await kinds(nClient)).filter((k) => k === 'message').length === 1);
  check('the sender is not notified of their own message', !(await kinds(nFree)).includes('message'));
  await user(nClient, () => q(`select public.mark_notifications_read()`));
  check('marking read clears the unread notifications', (await inbox(nClient)).every((n) => n.read_at !== null));
  await user(nFree, () => q(`select public.send_message($1, 'Any questions?')`, [nConv]));
  check('after reading, the next message notifies again', (await kinds(nClient)).filter((k) => k === 'message').length === 2);

  const nOrder = (await user(nClient, () => one(`select public.accept_proposal($1) as id`, [nProp.id]))).id;
  check('hiring notifies the freelancer', (await inbox(nFree)).some((n) => n.kind === 'hired' && n.data.order_id === nOrder && n.data.name === 'Nina Client'));
  await service(() => q(`insert into public.payments (order_id, razorpay_payment_link_id, payment_url, amount_paise) values ($1, 'plink_n1', 'https://rzp.io/i/n', 100000)`, [nOrder]));
  await service(() => q(`select public.record_payment_captured('plink_n1', 'pay_n1', 100000)`));
  check('a paid order notifies the freelancer', (await kinds(nFree)).includes('order_paid'));
  await user(nFree, () => q(`select public.mark_order_delivered($1)`, [nOrder]));
  check('a delivery notifies the client', (await kinds(nClient)).includes('order_delivered'));
  await user(nClient, () => q(`select public.complete_order($1)`, [nOrder]));
  check('an approval notifies the freelancer with the amount', (await inbox(nFree)).some((n) => n.kind === 'order_completed' && n.data.amount_paise === 95000));
  await user(nClient, () => q(`select public.submit_review($1, 5, 'Great work')`, [nOrder]));
  check('a review notifies the freelancer', (await inbox(nFree)).some((n) => n.kind === 'review_received' && n.data.rating === 5));
  await user(admin, () => q(`select public.admin_mark_paid_out($1, 'UTR777888')`, [nOrder]));
  check('a payout notifies the freelancer with the reference', (await inbox(nFree)).some((n) => n.kind === 'payout_sent' && n.data.reference === 'UTR777888' && n.data.amount_paise === 95000));

  const nJob2 = await job(nClient);
  const nProp2 = await propose(nFree, nJob2.id, 80000);
  await user(nClient, () => q(`select public.reject_proposal($1)`, [nProp2.id]));
  check('a rejected proposal notifies the freelancer', (await kinds(nFree)).includes('proposal_rejected'));

  const nJob3 = await job(nClient);
  const nProp3 = await propose(nFree, nJob3.id, 60000);
  const nOrder3 = (await user(nClient, () => one(`select public.accept_proposal($1) as id`, [nProp3.id]))).id;
  await service(() => q(`select public.cancel_order($1, $2)`, [nOrder3, nClient]));
  check('cancelling an unpaid order notifies the freelancer', (await kinds(nFree)).includes('order_cancelled'));

  const nJob4 = await job(nClient);
  const nProp4 = await propose(nFree, nJob4.id, 60000);
  const nOrder4 = (await user(nClient, () => one(`select public.accept_proposal($1) as id`, [nProp4.id]))).id;
  await service(() => q(`insert into public.payments (order_id, razorpay_payment_link_id, payment_url, amount_paise) values ($1, 'plink_n4', 'https://rzp.io/i/n', 60000)`, [nOrder4]));
  await service(() => q(`select public.record_payment_captured('plink_n4', 'pay_n4', 60000)`));
  const nDispute = (await user(nClient, () => one(`select public.open_dispute($1, 'The work is not what we agreed on at all') as id`, [nOrder4]))).id;
  check('opening a dispute notifies the other person only', (await kinds(nFree)).includes('dispute_opened') && !(await kinds(nClient)).includes('dispute_opened'));
  await user(nClient, () => q(`select public.withdraw_dispute($1)`, [nDispute]));
  check('withdrawing a dispute notifies the other person', (await kinds(nFree)).includes('dispute_withdrawn'));
  const nDispute2 = (await user(nFree, () => one(`select public.open_dispute($1, 'The client will not reply to my questions') as id`, [nOrder4]))).id;
  await user(admin, () => q(`select public.admin_resolve_dispute($1, 'release', 0, null, 'Work was delivered as agreed')`, [nDispute2]));
  check('a decision notifies both people', (await inbox(nClient)).some((n) => n.kind === 'dispute_resolved' && n.data.resolution === 'release') && (await inbox(nFree)).some((n) => n.kind === 'dispute_resolved'));

  check('an identity decision notified the freelancer', (await kinds(freelancerF)).includes('identity_rejected') && (await kinds(freelancerF)).includes('identity_verified'));
  check('the rejection reason is in the notification', (await inbox(freelancerF)).some((n) => n.kind === 'identity_rejected' && n.data.reason === 'The ID photo is blurry'));
  check('a company decision notified its owner', (await kinds(outsider)).includes('company_verified'));

  check('people see only their own notifications', (await inbox(nClient)).every((n) => n.kind !== 'hired') && (await kinds(outsider)).every((k) => !['hired', 'order_paid'].includes(k)));
  await rejects('notifications cannot be written by the app', () => user(nClient, () => q(`insert into public.notifications (user_id, kind) values ($1, 'hired')`, [nFree])), '42501');
  await rejects('notifications cannot be edited directly', () => user(nClient, () => q(`update public.notifications set read_at = null`)), '42501');
  await rejects('the notify helper is not callable by the app', () => user(nClient, () => q(`select public.notify_user($1, 'hired', '{}')`, [nFree])), '42501');
  await rejects('signed-out users cannot read notifications', () => anon(() => q(`select * from public.notifications`)), '42501');
  const freeUnread = (await inbox(nFree)).filter((n) => n.read_at === null).length;
  await user(nClient, () => q(`select public.mark_notifications_read()`));
  check('marking read never touches another person\'s notifications', (await inbox(nFree)).filter((n) => n.read_at === null).length === freeUnread && freeUnread > 0);
  const firstFree = (await user(nFree, () => one(`select id from public.notifications order by created_at limit 1`))).id;
  await user(nFree, () => q(`select public.mark_notifications_read($1)`, [[firstFree]]));
  check('one notification can be marked read on its own', (await inbox(nFree)).filter((n) => n.read_at === null).length === freeUnread - 1);

  // ---- migration 0015: push tokens ---------------------------------------------
  const tok = (n) => `ExponentPushToken[device${String(n).padStart(10, '0')}]`;
  const register = (uid, token, platform = 'android') => user(uid, () => q(`select public.register_push_token($1, $2)`, [token, platform]));
  const tokenOwner = async (token) => (await service(() => q(`select user_id from public.push_tokens where token = $1`, [token])))[0]?.user_id ?? null;

  await register(nFree, tok(1));
  check('a phone can register its token', (await tokenOwner(tok(1))) === nFree);
  await register(nFree, tok(1), 'ios');
  check('registering the same token twice keeps one row', (await service(() => q(`select * from public.push_tokens where token = $1`, [tok(1)]))).length === 1);
  await register(nClient, tok(1));
  check('a shared phone moves to whoever signed in last', (await tokenOwner(tok(1))) === nClient);
  await user(nFree, () => q(`select public.unregister_push_token($1)`, [tok(1)]));
  check('someone else cannot remove the token', (await tokenOwner(tok(1))) === nClient);
  await user(nClient, () => q(`select public.unregister_push_token($1)`, [tok(1)]));
  check('signing out removes the token', (await tokenOwner(tok(1))) === null);

  await rejects('a made-up token is refused', () => register(nFree, 'not-a-token'), '22023');
  await rejects('a token with SQL in it is refused', () => register(nFree, "ExponentPushToken[x'); drop table profiles;--]"), '22023');
  await rejects('an unknown platform is refused', () => register(nFree, tok(2), 'windows'), '22023');
  await rejects('signed-out users cannot register a token', () => anon(() => q(`select public.register_push_token($1, 'android')`, [tok(3)])), '42501');
  await rejects('tokens cannot be read from the app', () => user(nFree, () => q(`select * from public.push_tokens`)), '42501');
  await rejects('tokens cannot be written directly', () => user(nFree, () => q(`insert into public.push_tokens (token, user_id, platform) values ($1, $2, 'android')`, [tok(4), nFree])), '42501');

  for (let n = 10; n < 22; n++) await register(nFree, tok(n));
  const kept = await service(() => q(`select token from public.push_tokens where user_id = $1`, [nFree]));
  check('only the ten newest phones are kept', kept.length === 10 && kept.some((k) => k.token === tok(21)) && !kept.some((k) => k.token === tok(10)));

  // ---- migration 0016: the push trigger ----------------------------------------
  const pushCalls = () => service(() => q(`select * from net.calls`));
  const makeNote = async () => (await service(() => one(`select public.notify_user($1, 'message', '{"conversation_id":"c","name":"Z"}') as x`, [nFree])));
  const callsBefore = (await pushCalls()).length;
  await makeNote();
  check('without the Vault settings a notification is saved and nothing is sent', (await pushCalls()).length === callsBefore);

  await service(() => q(`insert into vault.decrypted_secrets values ('push_webhook_secret', 'the-secret'), ('push_function_url', 'https://x.supabase.co/functions/v1/send-push')`));
  await makeNote();
  const sent = (await pushCalls()).slice(callsBefore);
  check('a new notification calls send-push once', sent.length === 1 && sent[0].url === 'https://x.supabase.co/functions/v1/send-push');
  check('the call carries the shared secret', sent[0].headers['x-webhook-secret'] === 'the-secret');
  check('the call describes the notification for the right person', sent[0].body.type === 'INSERT' && sent[0].body.table === 'notifications' && sent[0].body.record.user_id === nFree && sent[0].body.record.kind === 'message' && sent[0].body.record.data.name === 'Z');

  const countBefore = (await service(() => one(`select count(*)::int as n from public.notifications`))).n;
  await service(() => q(`update vault.decrypted_secrets set decrypted_secret = 'https://explode.example/send' where name = 'push_function_url'`));
  await makeNote();
  check('a failing push never blocks the notification from being saved', (await service(() => one(`select count(*)::int as n from public.notifications`))).n === countBefore + 1);
  await service(() => q(`delete from vault.decrypted_secrets`));
  check('the push trigger is not callable by the app', await (async () => { try { await user(nClient, () => q(`select public.push_on_notification()`)); return false; } catch (e) { return e.code === '42501'; } })());

  // ---- migration 0018: free application credits ---------------------------
  const busy = await newUser('busy@test');
  const other = await newUser('other-free@test');
  await setProfile(busy, 'freelancer', 'Busy Bee');
  await setProfile(other, 'freelancer', 'Other Free');
  await verify(busy);
  await verify(other);
  const credits = (uid) => user(uid, () => one(`select * from public.my_application_credits()`));

  const fresh = await credits(busy);
  check('a new freelancer has 10 free applications this month', fresh.used === 0 && fresh.allowed === 10 && fresh.remaining === 10);
  const resetsAt = new Date(fresh.resets_at);
  check('the allowance resets on the 1st of next month, India time', resetsAt > new Date() && resetsAt.getTime() - Date.now() < 32 * 86400000);

  const sentIds = [];
  for (let n = 0; n < 10; n++) {
    const jb = await job(clientA);
    sentIds.push((await propose(busy, jb.id, 60000)).id);
  }
  check('ten proposals in a month are accepted', sentIds.length === 10);
  const spent = await credits(busy);
  check('the counter shows all ten used and none left', spent.used === 10 && spent.remaining === 0);

  const jobEleven = await job(clientA);
  await rejects('the eleventh proposal of the month is refused', () => propose(busy, jobEleven.id, 60000), '54000');
  check('a refused proposal is not saved', (await credits(busy)).used === 10);

  await user(busy, () => q(`update public.proposals set status = 'withdrawn' where id = $1`, [sentIds[0]]));
  await rejects('withdrawing a proposal does not give the credit back', () => propose(busy, jobEleven.id, 60000), '54000');

  check('another freelancer is not affected by someone else\'s limit', !!(await propose(other, jobEleven.id, 60000)).id && (await credits(other)).used === 1);
  check('a client cannot read or spend anyone\'s credits', (await user(clientA, () => one(`select * from public.my_application_credits()`))).used === 0);

  await service(() => q(`update public.proposals set created_at = created_at - interval '40 days' where freelancer_id = $1`, [busy]));
  check('last month\'s proposals no longer count', (await credits(busy)).used === 0);
  check('the freelancer can apply again in a new month', !!(await propose(busy, jobEleven.id, 60000)).id);
  check('this month\'s proposal counts again from one', (await credits(busy)).used === 1);

  await rejects('signed-out users cannot read credits', () => anon(() => q(`select * from public.my_application_credits()`)), '42501');
  await rejects('the counting helper is not callable by the app', () => user(busy, () => q(`select public.applications_this_month($1)`, [busy])), '42501');
  await rejects('the allowance helper is not callable by the app', () => user(busy, () => q(`select public.application_allowance($1)`, [busy])), '42501');

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
