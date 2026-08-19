#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');
const origin = 'https://ironnestpedia.com';
const routes = JSON.parse(readFileSync(join(root, 'data', 'routes.json'), 'utf8')).pages;
const placeholders = JSON.parse(readFileSync(join(root, 'data', 'skeleton-placeholder-pages.json'), 'utf8')).pages;
const locales = [
  { code: 'en', html: 'en', hreflang: 'en' },
  { code: 'zh-cn', html: 'zh-CN', hreflang: 'zh-CN' },
  { code: 'zh-tw', html: 'zh-TW', hreflang: 'zh-TW' },
];
const localizedPath = (path, locale) => locale === 'en' ? path : path === '/' ? `/${locale}` : `/${locale}${path}`;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
function fileToRoute(file) {
  const rel = relative(dist, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'/index.html'.length)}`;
  return `/${rel.slice(0, -'.html'.length)}`;
}
function attr(html, tag, name) {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*\\b${name}="([^"]+)"[^>]*>`, 'i'));
  return match?.[1];
}
function linkMap(html) {
  const links = new Map();
  for (const match of html.matchAll(/<link\b([^>]+)>/gi)) {
    const attrs = match[1];
    const rel = attrs.match(/\brel="([^"]+)"/i)?.[1];
    const hreflang = attrs.match(/\bhreflang="([^"]+)"/i)?.[1];
    const href = attrs.match(/\bhref="([^"]+)"/i)?.[1];
    if (rel === 'alternate' && hreflang && href) links.set(hreflang, href.replaceAll('&amp;', '&'));
  }
  return links;
}

const htmlFiles = walk(dist).filter((file) => file.endsWith('.html'));
const htmlByRoute = new Map(htmlFiles.map((file) => [fileToRoute(file), readFileSync(file, 'utf8')]));
const errors = [];
const indexable = ['/', '/contact', ...routes.filter((route) => route.page_type !== 'tool_placeholder').map((route) => route.url_path)];
const noindex = [...placeholders.map((page) => page.url_path), '/tools/mission-map', '/404'];

if (htmlFiles.length !== 342) errors.push(`html pages=${htmlFiles.length}, expected=342`);
for (const basePath of indexable) {
  for (const locale of locales) {
    const path = localizedPath(basePath, locale.code);
    const html = htmlByRoute.get(path);
    if (!html) { errors.push(`${path}: missing HTML`); continue; }
    if (attr(html, 'html', 'lang') !== locale.html) errors.push(`${path}: wrong html lang`);
    const expectedCanonical = `${origin}${path}`;
    if (!html.includes(`<link rel="canonical" href="${expectedCanonical}">`)) errors.push(`${path}: canonical mismatch`);
    const alternates = linkMap(html);
    for (const target of locales) {
      const expected = `${origin}${localizedPath(basePath, target.code)}`;
      if (alternates.get(target.hreflang) !== expected) errors.push(`${path}: ${target.hreflang} alternate mismatch`);
      if (!html.includes(`href="${localizedPath(basePath, target.code)}"`)) errors.push(`${path}: missing ${target.code} language switch link`);
    }
    if (alternates.get('x-default') !== `${origin}${basePath}`) errors.push(`${path}: x-default mismatch`);
    if ([expectedCanonical, ...alternates.values()].some((url) => new URL(url, origin).pathname !== '/' && new URL(url, origin).pathname.endsWith('/'))) errors.push(`${path}: trailing slash in canonical/alternate`);
    if (/name="robots" content="noindex/i.test(html)) errors.push(`${path}: indexable page is noindex`);
  }
}

for (const basePath of noindex) {
  for (const locale of locales) {
    const path = localizedPath(basePath, locale.code);
    const html = htmlByRoute.get(path);
    if (!html) { errors.push(`${path}: missing noindex HTML`); continue; }
    if (!/name="robots" content="noindex,follow"/i.test(html)) errors.push(`${path}: missing noindex,follow`);
    if (linkMap(html).size) errors.push(`${path}: noindex page has hreflang alternates`);
  }
}

const sitemapUrls = new Set();
for (const file of walk(dist).filter((file) => /sitemap.*\.xml$/.test(file))) {
  for (const match of readFileSync(file, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const path = new URL(match[1]).pathname.replace(/\/$/, '') || '/';
    if (!path.endsWith('.xml')) sitemapUrls.add(path);
  }
}
const expectedSitemap = new Set(indexable.flatMap((path) => locales.map((locale) => localizedPath(path, locale.code))));
const missing = [...expectedSitemap].filter((path) => !sitemapUrls.has(path));
const extra = [...sitemapUrls].filter((path) => !expectedSitemap.has(path));
if (sitemapUrls.size !== 318 || missing.length || extra.length) errors.push(`sitemap expected=318 actual=${sitemapUrls.size} missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`);
for (const oldPath of ['/missions/ceremony-and-hche', '/missions/insurrections-and-requisitions']) {
  if ([...sitemapUrls].some((path) => path.endsWith(oldPath))) errors.push(`${oldPath}: old URL leaked into sitemap`);
}

const corrected = {
  en: { fire: 'Fire &amp; Light', liberation: 'Liberation' },
  'zh-cn': { fire: '炮火与光辉', liberation: '解放' },
  'zh-tw': { fire: '射擊與照明', liberation: '解放' },
};
const firePages = ['/missions/fire-and-light', '/achievements/achievement-2-clear', '/achievements/achievement-2-golden'];
const liberationPages = ['/missions/liberation', '/achievements/achievement-3-clear', '/achievements/achievement-3-golden'];
for (const locale of locales) {
  for (const path of firePages) if (!htmlByRoute.get(localizedPath(path, locale.code))?.includes(corrected[locale.code].fire)) errors.push(`${locale.code}${path}: corrected Fire & Light term missing`);
  for (const path of liberationPages) if (!htmlByRoute.get(localizedPath(path, locale.code))?.includes(corrected[locale.code].liberation)) errors.push(`${locale.code}${path}: corrected Liberation term missing`);
}

const redirects = readFileSync(join(dist, '_redirects'), 'utf8');
for (const line of [
  '/missions/ceremony-and-hche  /missions/fire-and-light  301',
  '/missions/insurrections-and-requisitions  /missions/liberation  301',
]) if (!redirects.includes(line)) errors.push(`redirect missing: ${line}`);

for (const locale of locales.filter((item) => item.code !== 'en')) {
  const localizedFiles = [...htmlByRoute].filter(([path]) => path === `/${locale.code}` || path.startsWith(`/${locale.code}/`));
  if (localizedFiles.some(([, html]) => !/[\u4e00-\u9fff]/.test(html))) errors.push(`${locale.code}: at least one page has no CJK output`);
}

if (errors.length) {
  console.error(JSON.stringify({ status: 'FAIL', html_pages: htmlFiles.length, sitemap_urls: sitemapUrls.size, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  status: 'PASS',
  html_pages: htmlFiles.length,
  indexable_pages_per_locale: indexable.length,
  noindex_pages_per_locale: noindex.length,
  hreflang_sets_checked: indexable.length * locales.length,
  sitemap_urls: sitemapUrls.size,
  corrected_pages_checked: 6 * locales.length,
  redirects_checked: 2,
}, null, 2));
