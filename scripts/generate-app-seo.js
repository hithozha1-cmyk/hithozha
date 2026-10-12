// Generates the app's own robots.txt, sitemap.xml and llms.txt into public/, so Vercel serves them as
// static files (which win over the SPA catch-all rewrite) at the app's real routes. The app has no
// separate marketing site at hithozha.in, so these describe the app itself. Run: npm run app:seo
const fs = require('fs');
const path = require('path');
const { exportLegal } = require('./export-legal');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://hithozha.in';
const PUBLIC = path.join(ROOT, 'public');

// Same list used for the (currently unused) static marketing site — kept here too since this script
// has no reason to depend on that one. See site/build.js for why: individual towns/villages would
// read as keyword-stuffing; districts are a truthful, meaningful unit for a statewide marketplace.
const TN_DISTRICTS = [
  'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode',
  'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai',
  'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet',
  'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli',
  'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar',
];

const AI_CRAWLERS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', // OpenAI
  'ClaudeBot', 'Claude-Web', 'anthropic-ai', // Anthropic
  'Google-Extended', // Gemini / Bard training
  'PerplexityBot', 'Perplexity-User', // Perplexity
  'CCBot', // Common Crawl (feeds many LLMs)
  'Applebot-Extended', // Apple Intelligence
  'Bytespider', // ByteDance
  'Amazonbot',
  'meta-externalagent', // Meta AI
];

function write(file, text) {
  fs.mkdirSync(PUBLIC, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC, file), text);
}

function generate() {
  const { business, pages } = JSON.parse(exportLegal());

  const urls = [ORIGIN + '/', ...pages.map((p) => `${ORIGIN}/legal/${p}`)];

  write(
    'robots.txt',
    `User-agent: *\nAllow: /\n\n${AI_CRAWLERS.map((ua) => `User-agent: ${ua}\nAllow: /`).join('\n\n')}\n\nSitemap: ${ORIGIN}/sitemap.xml\n`,
  );

  write(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`,
  );

  write(
    'llms.txt',
    `# Hithozha

> Hire ID-verified freelancers in Tamil Nadu for design, video, websites, tuition and more, or find work close to home. Free to join, in Tamil and English.

Hithozha is a freelance marketplace for Tamil Nadu, India. Clients post jobs and ID-verified freelancers (Aadhaar, PAN and a selfie check) apply to do them; Hithozha holds the client's payment until the work is approved. The app works in Tamil and English.

- App: ${ORIGIN}
- Contact: ${business.email}${business.phone ? `, ${business.phone}` : ''}
- Legal business name: ${business.legalName || business.name}
- Service area: all of Tamil Nadu, India (every district: ${TN_DISTRICTS.join(', ')})

## Key facts

- Free to join as a client or freelancer.
- Freelancers get 10 free tokens a month; 1 token per job application.
- Hithozha keeps a platform fee from the freelancer's side only (5% on the free plan); clients pay only the accepted proposal price.
- Identity-verified freelancers only.

## Pages

${pages.map((p) => `- [${p[0].toUpperCase()}${p.slice(1)}](${ORIGIN}/legal/${p})`).join('\n')}
`,
  );

  return urls;
}

module.exports = { generate, TN_DISTRICTS, AI_CRAWLERS, PUBLIC };

if (require.main === module) {
  const urls = generate();
  console.log(`generated public/robots.txt, sitemap.xml (${urls.length} urls) and llms.txt`);
}
