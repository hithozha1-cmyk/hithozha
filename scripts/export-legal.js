// Copies the app's legal text (src/legal/content.ts) into site/legal.json, so the website's Terms, Privacy,
// Refunds and Contact pages always say exactly what the app says. Run: npm run site:legal
// A test fails if site/legal.json is out of date, so the two cannot drift apart.
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function exportLegal() {
  const source = fs.readFileSync(path.join(ROOT, 'src/legal/content.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', output)(mod, mod.exports);
  const { BUSINESS, LEGAL_PAGES, legalContent } = mod.exports;
  return JSON.stringify({ business: BUSINESS, pages: LEGAL_PAGES, content: legalContent }, null, 2) + '\n';
}

module.exports = { exportLegal };

if (require.main === module) {
  fs.writeFileSync(path.join(ROOT, 'site/legal.json'), exportLegal());
  console.log('site/legal.json updated');
}
