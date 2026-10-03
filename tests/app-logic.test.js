// Tests for the pure logic in src/lib: validation, money, onboarding steps, search cleaning.
// Run with: npm run test:logic
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const cache = new Map();

// Loads a TypeScript file and resolves "@/..." imports to src/. The Supabase client is replaced
// with an empty stand-in so nothing needs network access or environment variables.
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText;
  const mod = { exports: {} };
  cache.set(file, mod.exports);
  new Function('module', 'exports', 'require', output)(mod, mod.exports, (id) => {
    if (id === '@/lib/supabase') return { supabase: {} };
    // Native modules the push helpers import; only the pure functions are tested here.
    if (['expo-constants', 'expo-device', 'expo-notifications', 'react-native'].includes(id)) return { Platform: { OS: 'android' } };
    if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`);
    throw new Error(`unexpected import ${id} in ${file}`);
  });
  cache.set(file, mod.exports);
  return mod.exports;
}

let failed = 0;
let passed = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`}`);
};

const company = load('src/lib/company.ts');
const onboarding = load('src/lib/onboarding.ts');
const jobs = load('src/lib/jobs.ts');
const money = load('src/lib/money.ts');
const proposals = load('src/lib/proposals.ts');
const freelancer = load('src/lib/freelancerForm.ts');

// ---- GST and Udyam ---------------------------------------------------------
check('GST valid', company.GST_PATTERN.test('22AAAAA0000A1Z5'), true);
check('GST too short', company.GST_PATTERN.test('22AAAAA0000A1Z'), false);
check('GST lowercase', company.GST_PATTERN.test('22aaaaa0000a1z5'), false);
check('GST missing Z', company.GST_PATTERN.test('22AAAAA0000A1X5'), false);
check('Udyam valid', company.UDYAM_PATTERN.test('UDYAM-TN-00-0000000'), true);
check('Udyam bad digits', company.UDYAM_PATTERN.test('UDYAM-TN-00-000000'), false);
check('Udyam bad prefix', company.UDYAM_PATTERN.test('UDYAN-TN-00-0000000'), false);

// ---- links -------------------------------------------------------------------
check('url bare domain', company.normalizeUrl('example.com'), 'https://example.com');
check('url https kept', company.normalizeUrl('https://example.com/a'), 'https://example.com/a');
check('url javascript rejected', company.normalizeUrl('javascript:alert(1)'), null);
check('url no dot rejected', company.normalizeUrl('localhost'), null);
check('url spaces rejected', company.normalizeUrl('exa mple.com'), null);
check('linkedin ok', company.normalizeLinkedIn('linkedin.com/company/acme'), 'https://linkedin.com/company/acme');
check('linkedin lookalike rejected', company.normalizeLinkedIn('https://notlinkedin.com/x'), null);
check('linkedin other site rejected', company.normalizeLinkedIn('https://example.com/linkedin.com'), null);

// ---- company form ------------------------------------------------------------
const goodCompany = { ...company.EMPTY_COMPANY, name: 'Acme', teamSize: '1-10', industry: 'technology', city: 'chennai' };
check('company valid', company.validateCompany(goodCompany), {});
check('company empty', Object.keys(company.validateCompany(company.EMPTY_COMPANY)).sort(), ['city', 'industry', 'name', 'teamSize']);
check('company 1-char name', Object.keys(company.validateCompany({ ...goodCompany, name: 'A' })), ['name']);
check('company bad website', Object.keys(company.validateCompany({ ...goodCompany, website: 'not a url' })), ['website']);

// ---- onboarding steps (step 1 is the account itself) --------------------------
check('freelancer steps', onboarding.onboardingSteps('freelancer', null), ['role', 'profile', 'professional']);
check('individual client steps', onboarding.onboardingSteps('client', 'individual'), ['role', 'client-type', 'profile']);
check('company client steps', onboarding.onboardingSteps('client', 'company'), ['role', 'client-type', 'company-profile', 'profile']);
check('both + company steps', onboarding.onboardingSteps('both', 'company'), ['role', 'client-type', 'company-profile', 'profile', 'professional']);
check('freelancer ignores client type', onboarding.onboardingSteps('freelancer', 'company'), ['role', 'profile', 'professional']);

// ---- money and the platform fee ---------------------------------------------------
check('toPaise', money.toPaise(1499), 149900);
check('formatINR groups the Indian way', money.formatINR(12345600).replace(/\s/g, ' '), '₹1,23,456');
// These match what the database produced in supabase/tests/db.test.js.
check('earnings after 5% fee', proposals.earningsAfterFee(250000), 237500);
check('earnings round half up', proposals.earningsAfterFee(123457), 123457 - 6173);
check('earnings tiny price', proposals.earningsAfterFee(99), 94);
check('earnings large price', proposals.earningsAfterFee(1000000000), 950000000);

// ---- jobs --------------------------------------------------------------------------
check('recurring monthly', jobs.isRecurring('monthly'), true);
check('recurring part_time', jobs.isRecurring('part_time'), true);
check('recurring one_time', jobs.isRecurring('one_time'), false);
check('range single', jobs.budgetRange({ budget_min_paise: 500000, budget_max_paise: 500000 }), '₹5,000');
check('range pair', jobs.budgetRange({ budget_min_paise: 500000, budget_max_paise: 1000000 }), '₹5,000 – ₹10,000');
check('poster: company wins', jobs.posterName({ company: { name: 'Acme' }, client: { full_name: 'Priya' } }), 'Acme');
check('poster: individual', jobs.posterName({ company: null, client: { full_name: 'Priya' } }), 'Priya');
check('job query never asks for private columns', /gst_number|udyam_number|phone|is_admin/.test(jobs.JOB_SELECT), false);

// ---- search ----------------------------------------------------------------------------
check('search keeps normal words', jobs.sanitizeSearch('logo design'), 'logo design');
check('search trims and collapses spaces', jobs.sanitizeSearch('  logo   design  '), 'logo design');
check('search strips filter syntax', jobs.sanitizeSearch('a,b(c)*d%e'), 'a b c d e');
check('search strips dots', jobs.sanitizeSearch('title.ilike.*x*'), 'title ilike x');
check('search keeps Tamil', jobs.sanitizeSearch('வீடியோ எடிட்டிங்'), 'வீடியோ எடிட்டிங்');
check('search strips quotes and semicolons', jobs.sanitizeSearch('logo"; drop table'), 'logo drop table');
check('search is capped at 60 characters', jobs.sanitizeSearch('x'.repeat(100)).length, 60);
check('search of blanks is empty', jobs.sanitizeSearch('   '), '');
check('filters: nothing set', jobs.hasActiveFilters(jobs.EMPTY_FILTERS), false);
check('filters: blank search is not a filter', jobs.hasActiveFilters({ ...jobs.EMPTY_FILTERS, query: '   ' }), false);
check('filters: search words count', jobs.hasActiveFilters({ ...jobs.EMPTY_FILTERS, query: 'logo' }), true);
check('filters: category counts', jobs.activeFilterCount({ query: 'x', category: 'a', jobType: null, city: 'chennai' }), 2);

// ---- freelancer form (onboarding and edit profile) -------------------------------------------
const goodFreelancer = {
  ...freelancer.EMPTY_FREELANCER,
  headline: 'Logo designer',
  skills: ['graphic-design'],
  experience: 'expert',
  availability: 'full_time',
  bio: 'I design logos for shops and startups.',
};
const empty = freelancer.validateFreelancer(freelancer.EMPTY_FREELANCER);
check('freelancer: empty form reports every required field', Object.keys(empty.errors).sort(), ['availability', 'bio', 'experience', 'headline', 'skills']);
check('freelancer: empty form has no payload', empty.details, null);
const ok = freelancer.validateFreelancer({ ...goodFreelancer, price: '1500', education: ' B.Des ' });
check('freelancer: valid form has no errors', ok.errors, {});
check('freelancer: price becomes paise', ok.details.starting_price_paise, 150000);
check('freelancer: education is trimmed', ok.details.education, 'B.Des');
check('freelancer: blank price is allowed', freelancer.validateFreelancer(goodFreelancer).details.starting_price_paise, null);
check('freelancer: price under Rs 50 is rejected', Object.keys(freelancer.validateFreelancer({ ...goodFreelancer, price: '49' }).errors), ['price']);
check('freelancer: short bio is rejected', Object.keys(freelancer.validateFreelancer({ ...goodFreelancer, bio: 'too short' }).errors), ['bio']);
check('freelancer: error values are translation keys', freelancer.validateFreelancer(freelancer.EMPTY_FREELANCER).errors.headline, 'onboarding.professional.headlineRequired');
const loaded = freelancer.freelancerToFormValues({
  headline: 'Editor',
  skills: ['video-editing'],
  experience_level: 'intermediate',
  languages: ['ta', 'en'],
  availability: 'weekends',
  starting_price_paise: 150000,
  bio: 'Reels and ads',
  education: null,
  portfolio_urls: ['https://x/y.jpg'],
});
check('freelancer: a saved row fills the form', [loaded.price, loaded.experience, loaded.availability, loaded.education, loaded.portfolio.length], ['1500', 'intermediate', 'weekends', '', 1]);
check('freelancer: unknown saved values are ignored', freelancer.freelancerToFormValues({ ...loaded, headline: null, skills: [], experience_level: 'wizard', languages: [], availability: 'sometimes', starting_price_paise: null, bio: null, education: null, portfolio_urls: [] }).experience, null);

// ---- earnings summary ---------------------------------------------------------------
const earnings = load('src/lib/earnings.ts');
const order = (status, paise, payments) => ({ id: status + paise, title: 'x', status, freelancer_earnings_paise: paise, completed_at: null, payments });
const summary = earnings.summarizeEarnings([
  order('in_progress', 100, [{ status: 'captured', paid_out_at: null }]),
  order('delivered', 200, [{ status: 'captured', paid_out_at: null }]),
  order('completed', 400, [{ status: 'released', paid_out_at: null }]),
  order('completed', 800, [{ status: 'released', paid_out_at: '2026-10-03T00:00:00Z' }]),
]);
check('earnings: escrow adds in-progress and delivered', summary.inEscrow, 300);
check('earnings: released but unpaid is awaiting payout', summary.awaitingPayout, 400);
check('earnings: paid out is counted separately', summary.paidOut, 800);
check('earnings: nothing at all', earnings.summarizeEarnings([]), { inEscrow: 0, awaitingPayout: 0, paidOut: 0 });
check('earnings: a completed order with no released payment is not counted', earnings.summarizeEarnings([order('completed', 500, [])]).awaitingPayout, 0);

// ---- legal pages: every page exists in both languages ---------------------------------
const legal = load('src/legal/content.ts');
for (const lang of ['en', 'ta']) {
  for (const page of legal.LEGAL_PAGES) {
    const content = legal.legalContent[lang][page];
    check(`legal: ${lang} ${page} has a title and text`, Boolean(content.title) && content.sections.length > 0 && content.sections.every(([h, b]) => h && b), true);
  }
}
check('legal: the terms state the 5% fee', legal.legalContent.en.terms.sections.some(([, b]) => b.includes('5%')), true);
check('legal: the contact page has an email', /@/.test(legal.BUSINESS.email), true);

// ---- admin: payout references and UPI ids (mirror the database checks) ----------------
const admin = load('src/lib/admin.ts');
check('admin: a UTR is accepted', admin.isValidReference('UTR123456'), true);
check('admin: a UTR with spaces around it is trimmed', admin.isValidReference('  SBIN0123456789  '), true);
check('admin: a short reference is refused', admin.isValidReference('12345'), false);
check('admin: a reference with symbols is refused', admin.isValidReference('abc 123; drop'), false);
const payoutSource = fs.readFileSync(path.join(ROOT, 'src/components/PayoutDetails.tsx'), 'utf8');
const upi = new Function('return ' + /UPI_PATTERN = (\/.*\/);/.exec(payoutSource)[1])();
check('upi: a normal id is accepted', upi.test('kaushik@okaxis'), true);
check('upi: no bank part is refused', upi.test('kaushik'), false);
check('upi: spaces are refused', upi.test('kau shik@okaxis'), false);

// ---- notifications: where a tap goes --------------------------------------------------
const notes = load('src/lib/notifications.ts');
check('notify: a proposal opens the proposals of that job', notes.notificationHref({ kind: 'proposal_received', data: { job_id: 'j1' } }), { pathname: '/jobs/proposals/[id]', params: { id: 'j1' } });
check('notify: a message opens the chat', notes.notificationHref({ kind: 'message', data: { conversation_id: 'c1' } }), { pathname: '/chat/[id]', params: { id: 'c1' } });
check('notify: order events open the order', notes.notificationHref({ kind: 'order_paid', data: { order_id: 'o1' } }), { pathname: '/orders/[id]', params: { id: 'o1' } });
check('notify: payouts open the order', notes.notificationHref({ kind: 'payout_sent', data: { order_id: 'o2' } }), { pathname: '/orders/[id]', params: { id: 'o2' } });
check('notify: identity opens the verify screen', notes.notificationHref({ kind: 'identity_rejected', data: {} }), '/account/verify-identity');
check('notify: a company decision opens the company', notes.notificationHref({ kind: 'company_verified', data: { company_id: 'x1' } }), { pathname: '/company/[id]', params: { id: 'x1' } });
check('notify: missing ids lead nowhere instead of crashing', notes.notificationHref({ kind: 'hired', data: {} }), null);

// ---- push: what a tapped push opens ---------------------------------------------------
const push = load('src/lib/push.ts');
check('push: an order push opens the order', push.hrefFromPushData({ kind: 'order_paid', order_id: 'o1', title: 'x' }), { pathname: '/orders/[id]', params: { id: 'o1' } });
check('push: a message push opens the chat', push.hrefFromPushData({ kind: 'message', conversation_id: 'c1' }), { pathname: '/chat/[id]', params: { id: 'c1' } });
check('push: an unknown kind opens nothing', push.hrefFromPushData({ kind: 'free_money', order_id: 'o1' }), null);
check('push: a missing kind opens nothing', push.hrefFromPushData({ order_id: 'o1' }), null);
check('push: a non-object payload opens nothing', push.hrefFromPushData('hello'), null);
check('push: a missing payload opens nothing', push.hrefFromPushData(undefined), null);
check('push: a push without the needed id opens nothing', push.hrefFromPushData({ kind: 'hired' }), null);
check('push: every notification kind is a known push kind', notes.NOTIFICATION_KINDS.length, 17);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
