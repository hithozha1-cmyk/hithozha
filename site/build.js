// Builds the public website (hithozha.in) into site/dist. Plain Node, no packages: run `node build.js`.
// Pages: home (English and Tamil) plus Terms, Privacy, Refunds and Contact in both languages.
// The legal text comes from site/legal.json, which is exported from the app (npm run site:legal).
const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://hithozha.in';
const DIST = path.join(__dirname, 'dist');
const strings = require('./strings');
const legal = JSON.parse(fs.readFileSync(path.join(__dirname, 'legal.json'), 'utf8'));

const esc = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const homePath = (lang) => (lang === 'en' ? '/' : '/ta/');
const legalPath = (lang, page) => (lang === 'en' ? `/${page}` : `/ta/${page}`);

const FONTS =
  'https://fonts.googleapis.com/css2?family=Anek+Tamil:wght@600;700;800&family=Hind+Madurai:wght@400;500;600&display=swap';

function head({ t, title, description, pathFor, lang }) {
  const url = ORIGIN + pathFor(lang);
  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en" href="${ORIGIN + pathFor('en')}">
<link rel="alternate" hreflang="ta" href="${ORIGIN + pathFor('ta')}">
<link rel="alternate" hreflang="x-default" href="${ORIGIN + pathFor('en')}">
<meta name="theme-color" content="#1A1A2E">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Hithozha">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ORIGIN}/assets/og.png">
<meta property="og:locale" content="${lang === 'ta' ? 'ta_IN' : 'en_IN'}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/assets/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/styles.css">
`;
}

function header(t, pathFor, lang) {
  const other = lang === 'en' ? 'ta' : 'en';
  const home = homePath(lang);
  return `<header class="top">
<div class="wrap top-row">
<a class="logo" href="${home}" aria-label="Hithozha"><span>hi</span><span class="brand">thozha</span></a>
<nav class="nav" aria-label="Main">
<a href="${home}#how">${esc(t.nav.how)}</a>
<a href="${home}#safety">${esc(t.nav.safety)}</a>
<a href="${home}#plans">${esc(t.nav.plans)}</a>
<a href="${home}#faq">${esc(t.nav.faq)}</a>
</nav>
<div class="top-actions">
<a class="lang" href="${pathFor(other)}" hreflang="${other}" lang="${other}">${esc(t.footer.language)}</a>
<a class="btn btn-small" href="${t.appUrl}">${esc(t.nav.open)}</a>
</div>
</div>
</header>`;
}

function footer(t, lang) {
  const other = lang === 'en' ? 'ta' : 'en';
  const pageLinks = legal.pages.map((p) => `<a href="${legalPath(lang, p)}">${esc(t.legalPages[p])}</a>`).join('\n');
  return `<footer class="foot">
<div class="wrap foot-row">
<div>
<a class="logo logo-light" href="${homePath(lang)}" aria-label="Hithozha"><span>hi</span><span class="brand">thozha</span></a>
<p>${esc(t.footer.tagline)}</p>
<p class="muted">${esc(t.footer.rights)}</p>
</div>
<div>
<h3>${esc(t.footer.legal)}</h3>
${pageLinks}
</div>
<div>
<h3>${esc(t.footer.contact)}</h3>
<a href="mailto:${esc(legal.business.email)}">${esc(legal.business.email)}</a>
${legal.business.phone ? `<span>${esc(legal.business.phone)}</span>` : ''}
<a class="lang" href="${homePath(other)}" hreflang="${other}" lang="${other}">${esc(strings[other].footer.language)}</a>
</div>
</div>
</footer>`;
}

function steps(list) {
  return `<ol class="steps">${list
    .map(([title, text], i) => `<li><span class="num" aria-hidden="true">${i + 1}</span><div><h4>${esc(title)}</h4><p>${esc(text)}</p></div></li>`)
    .join('')}</ol>`;
}

function planCards(t, list, kind) {
  return list
    .map(([name, price, lines]) => {
      const isFree = price === '0';
      return `<article class="plan${isFree ? ' plan-free' : ''}">
<h4>${esc(name)}</h4>
<p class="price">${isFree ? esc(t.plans.free) : `&#8377;${esc(price)} <span>${esc(t.plans.perMonth)}</span>`}</p>
${isFree ? '' : `<p class="soon">${esc(t.plans.soon)}</p>`}
<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
</article>`;
    })
    .join('');
}

function home(lang) {
  const t = strings[lang];
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: t.faq.items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Hithozha',
    url: ORIGIN,
    logo: `${ORIGIN}/assets/icon-512.png`,
    email: legal.business.email,
    areaServed: 'Tamil Nadu, India',
    slogan: strings.en.footer.tagline,
  };
  return (
    head({ t, title: t.meta.title, description: t.meta.description, pathFor: homePath, lang }) +
    `<script type="application/ld+json">${JSON.stringify(orgLd)}</script>
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${header(t, homePath, lang)}
<main id="main">
<section class="hero">
<div class="wrap hero-grid">
<div>
<p class="kicker">${esc(t.hero.kicker)}</p>
<h1>${esc(t.hero.title)}</h1>
<p class="lead">${esc(t.hero.text)}</p>
<div class="actions">
<a class="btn" href="${t.appUrl}">${esc(t.hero.primary)}</a>
<a class="btn btn-ghost" href="#how">${esc(t.hero.secondary)}</a>
</div>
<p class="note">${esc(t.hero.note)}</p>
</div>
<div class="hero-art" aria-hidden="true">
<img src="/assets/icon-512.png" alt="" width="260" height="260">
</div>
</div>
</section>

<section class="trust" aria-label="Why Hithozha">
<div class="wrap trust-grid">
${t.trust.map(([h, p]) => `<div class="trust-item"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join('')}
</div>
</section>

<section class="block" id="how">
<div class="wrap">
<h2>${esc(t.how.title)}</h2>
<div class="two">
<div class="panel"><h3>${esc(t.how.clients.title)}</h3>${steps(t.how.clients.steps)}</div>
<div class="panel"><h3>${esc(t.how.freelancers.title)}</h3>${steps(t.how.freelancers.steps)}</div>
</div>
</div>
</section>

<section class="block alt">
<div class="wrap">
<h2>${esc(t.categories.title)}</h2>
<ul class="chips">${t.categories.items.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
</div>
</section>

<section class="block" id="safety">
<div class="wrap">
<h2>${esc(t.safety.title)}</h2>
<div class="cards">
${t.safety.items.map(([h, p]) => `<article class="card"><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join('')}
</div>
</div>
</section>

<section class="block alt" id="plans">
<div class="wrap">
<h2>${esc(t.plans.title)}</h2>
<p class="section-note">${esc(t.plans.note)}</p>
<h3 class="sub">${esc(t.plans.freelancerTitle)}</h3>
<div class="plans">${planCards(t, t.plans.freelancer, 'freelancer')}</div>
<p class="section-note">${esc(t.plans.tokens)}</p>
<h3 class="sub">${esc(t.plans.clientTitle)}</h3>
<div class="plans">${planCards(t, t.plans.client, 'client')}</div>
</div>
</section>

<section class="block" id="faq">
<div class="wrap narrow">
<h2>${esc(t.faq.title)}</h2>
${t.faq.items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
</div>
</section>

<section class="cta">
<div class="wrap cta-row">
<div>
<h2>${esc(t.cta.title)}</h2>
<p>${esc(t.cta.text)}</p>
</div>
<a class="btn btn-light" href="${t.appUrl}">${esc(t.cta.button)}</a>
</div>
</section>
</main>
${footer(t, lang)}
</body>
</html>
`
  );
}

function legalPage(lang, page) {
  const t = strings[lang];
  const content = legal.content[lang][page];
  const pathFor = (l) => legalPath(l, page);
  const b = legal.business;
  return (
    head({ t, title: `${content.title} | Hithozha`, description: content.sections[0] ? content.sections[0][1].slice(0, 155) : content.title, pathFor, lang }) +
    `</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${header(t, pathFor, lang)}
<main id="main" class="legal">
<div class="wrap narrow">
<a class="back" href="${homePath(lang)}">&larr; ${esc(t.legalBack)}</a>
<h1>${esc(content.title)}</h1>
${content.sections.map(([h, p]) => `<section><h2>${esc(h)}</h2><p>${esc(p)}</p></section>`).join('\n')}
${
  page === 'contact'
    ? `<section><h2>${esc(b.name)}</h2><p><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></p>${b.phone ? `<p>${esc(b.phone)}</p>` : ''}${b.address ? `<p>${esc(b.address)}</p>` : ''}</section>`
    : ''
}
<nav class="others" aria-label="More">
${legal.pages.filter((p) => p !== page).map((p) => `<a href="${legalPath(lang, p)}">${esc(t.legalPages[p])}</a>`).join('')}
</nav>
</div>
</main>
${footer(t, lang)}
</body>
</html>
`
  );
}

function write(file, text) {
  const full = path.join(DIST, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    if (entry.isDirectory()) copyDir(source, path.join(to, entry.name));
    else fs.copyFileSync(source, path.join(to, entry.name));
  }
}

function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  const urls = [];
  for (const lang of ['en', 'ta']) {
    write(lang === 'en' ? 'index.html' : 'ta/index.html', home(lang));
    urls.push(ORIGIN + homePath(lang));
    for (const page of legal.pages) {
      write(lang === 'en' ? `${page}/index.html` : `ta/${page}/index.html`, legalPage(lang, page));
      urls.push(ORIGIN + legalPath(lang, page));
    }
  }
  fs.copyFileSync(path.join(__dirname, 'styles.css'), path.join(DIST, 'styles.css'));
  copyDir(path.join(__dirname, 'assets'), path.join(DIST, 'assets'));
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
  write(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`,
  );
  return urls;
}

module.exports = { build, DIST };

if (require.main === module) {
  const urls = build();
  console.log(`built ${urls.length} pages into site/dist`);
}
