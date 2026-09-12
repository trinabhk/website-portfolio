#!/usr/bin/env node
/**
 * Regenerates sitemap.xml and feed.xml.
 *
 * lastmod comes from each file's last git commit date, so a CSS-only change
 * doesn't falsely bump every page. Resubmitting a sitemap whose lastmod never
 * moves tells Google "nothing changed" - which defeats the whole point.
 *
 *   node scripts/build-feeds.js           write both files
 *   node scripts/build-feeds.js --check   exit 1 if either is stale (used in CI)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://trinabh.com.np';
const CHECK = process.argv.includes('--check');

// Static pages. `changefreq`/`priority` are ignored by Google but harmless and
// still read by some other crawlers, so they stay.
const PAGES = [
  { file: 'index.html', url: '/', changefreq: 'monthly', priority: '1.0' },
  { file: 'about/index.html', url: '/about/', changefreq: 'monthly', priority: '0.8' },
  { file: 'services/index.html', url: '/services/', changefreq: 'monthly', priority: '0.9' },
  { file: 'technical-seo-nepal/index.html', url: '/technical-seo-nepal/', changefreq: 'monthly', priority: '0.9' },
  { file: 'seo-audit-nepal/index.html', url: '/seo-audit-nepal/', changefreq: 'monthly', priority: '0.9' },
  { file: 'projects/index.html', url: '/projects/', changefreq: 'monthly', priority: '0.8' },
  { file: 'blog/index.html', url: '/blog/', changefreq: 'weekly', priority: '0.7' },
];

// Blog posts, newest first. `published` is the authored date shown on the page;
// lastmod still tracks git so edits are reflected without touching this list.
const POSTS = [
  {
    file: 'blog/what-is-seo/index.html',
    url: '/blog/what-is-seo/',
    title: 'What Is SEO? A Straight Answer From an SEO Analyst',
    description: 'A practical, jargon-free explanation of search engine optimization - how it works, its three layers, and why it matters.',
    published: '2026-08-01',
    priority: '0.7',
  },
  {
    file: 'blog/seo-in-nepal/index.html',
    url: '/blog/seo-in-nepal/',
    title: 'SEO in Nepal: What Actually Works for Local Businesses',
    description: 'How Nepali businesses search, get found online, and the technical mistakes that cost them rankings.',
    published: '2026-08-01',
    priority: '0.7',
  },
  {
    file: 'blog/technical-seo-audit-checklist/index.html',
    url: '/blog/technical-seo-audit-checklist/',
    title: 'A technical SEO audit checklist I actually use',
    description: "The exact order I work through a site when something isn't ranking - from crawlability and indexing down to sitemaps and status codes - and why sequence matters.",
    published: '2026-06-16',
    priority: '0.6',
  },
];

const NPT = '+0545'; // Asia/Kathmandu
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

const TODAY = new Date().toISOString().slice(0, 10);

/** Last commit date for a path, as YYYY-MM-DD. Falls back to `orElse`. */
function committedDate(file, orElse) {
  const out = git(['log', '-1', '--format=%cs', '--', file]);
  return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : orElse;
}

/**
 * lastmod for a file. A file with uncommitted edits is dated today - it's about
 * to be committed, and stamping the previous commit's date would understate it.
 */
function modDate(file, orElse) {
  if (git(['status', '--porcelain', '--', file]) !== '') return TODAY;
  return committedDate(file, orElse);
}

/** YYYY-MM-DD -> RFC-822, which is what RSS pubDate requires. */
function rfc822(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const dd = String(d).padStart(2, '0');
  return `${dow}, ${dd} ${MONTHS[m - 1]} ${y} 09:00:00 ${NPT}`;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ------------------------------------------------------------------- sitemap.xml
const entries = [
  ...PAGES.map((p) => ({ ...p, lastmod: modDate(p.file, '2026-08-01') })),
  ...POSTS.map((p) => ({
    ...p,
    changefreq: 'monthly',
    lastmod: modDate(p.file, p.published),
  })),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url>
    <loc>${ORIGIN}${e.url}</loc>
    <lastmod>${e.lastmod}</lastmod>
  </url>`).join('\n')}
</urlset>
`;

// ---------------------------------------------------------------------- feed.xml
const items = POSTS.map((p) => {
  const updated = modDate(p.file, p.published);
  return `    <item>
      <title>${esc(p.title)}</title>
      <link>${ORIGIN}${p.url}</link>
      <guid isPermaLink="true">${ORIGIN}${p.url}</guid>
      <pubDate>${rfc822(p.published)}</pubDate>
      <description>${esc(p.description)}</description>
      <atom:updated>${updated}T09:00:00${NPT.slice(0, 3)}:${NPT.slice(3)}</atom:updated>
    </item>`;
}).join('\n');

const newest = POSTS.map((p) => modDate(p.file, p.published)).sort().reverse()[0];

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Trinabh Karki - Writing</title>
    <link>${ORIGIN}/blog/</link>
    <description>Practical technical SEO notes - indexing, crawlability, sitemaps, and SEO for businesses in Nepal.</description>
    <language>en</language>
    <copyright>Trinabh Karki</copyright>
    <managingEditor>karkitrinabh30@gmail.com (Trinabh Karki)</managingEditor>
    <webMaster>karkitrinabh30@gmail.com (Trinabh Karki)</webMaster>
    <lastBuildDate>${rfc822(newest)}</lastBuildDate>
    <atom:link href="${ORIGIN}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

// ------------------------------------------------------------------------ write
if (!CHECK) {
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
  fs.writeFileSync(path.join(ROOT, 'feed.xml'), feed);
  console.log('wrote       sitemap.xml');
  console.log('wrote       feed.xml');
  process.exit(0);
}

/*
 * --check can't just diff against a fresh render: on a clean checkout every
 * file is committed, so modDate returns commit dates, while the committed
 * sitemap was generated when those same files were still dirty (dated today).
 * Both are correct, and they differ. So assert the property that actually
 * matters instead: no URL may claim a lastmod older than its file's last
 * commit. That fails only when the generator genuinely wasn't re-run.
 */
const failures = [];
const committed = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const declared = new Map();
const re = /<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g;
let m;
while ((m = re.exec(committed)) !== null) {
  declared.set(m[1].replace(ORIGIN, ''), m[2]);
}

for (const e of entries) {
  const got = declared.get(e.url);
  if (!got) { failures.push(`${e.url} missing from sitemap.xml`); continue; }
  const real = committedDate(e.file, e.published || '2026-08-01');
  if (got < real) {
    failures.push(`${e.url} lastmod ${got} predates last commit ${real}`);
  }
}

const feedOnDisk = fs.existsSync(path.join(ROOT, 'feed.xml'))
  ? fs.readFileSync(path.join(ROOT, 'feed.xml'), 'utf8') : '';
for (const p of POSTS) {
  if (!feedOnDisk.includes(`${ORIGIN}${p.url}`)) {
    failures.push(`${p.url} missing from feed.xml`);
  }
}

if (failures.length) {
  console.error('Feeds are out of date:');
  failures.forEach((f) => console.error(`  - ${f}`));
  console.error('\nRun: node scripts/build-feeds.js');
  process.exit(1);
}
console.log(`ok          ${declared.size} URLs in sitemap.xml, ${POSTS.length} items in feed.xml`);
