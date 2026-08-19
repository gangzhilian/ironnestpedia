#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');
const locales = ['en', 'zh-cn', 'zh-tw'];
const basePages = ['/privacy', '/terms', '/cookies', '/about'];
const localizedPath = (path, locale) => locale === 'en' ? path : `/${locale}${path}`;

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

const htmlFiles = walk(dist).filter((file) => file.endsWith('.html'));
const htmlByRoute = new Map(htmlFiles.map((file) => [fileToRoute(file), readFileSync(file, 'utf8')]));
const sitemapUrls = new Set();
for (const file of walk(dist).filter((file) => /sitemap.*\.xml$/.test(file))) {
  for (const match of readFileSync(file, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const path = new URL(match[1]).pathname.replace(/\/$/, '') || '/';
    if (!path.endsWith('.xml')) sitemapUrls.add(path);
  }
}

const entityFiles = readdirSync(join(root, 'data/en/entities')).filter((name) => name.endsWith('.json') && !name.endsWith('.labels.json'));
const entityRows = entityFiles.flatMap((name) => JSON.parse(readFileSync(join(root, 'data/en/entities', name), 'utf8')));
const versions = [...new Set(entityRows.map((row) => String(row.game_version)).filter(Boolean))];
const sources = [...new Set(entityRows.map((row) => String(row.data_source)).filter(Boolean))];
const errors = [];

for (const locale of locales) {
  for (const basePath of basePages) {
    const path = localizedPath(basePath, locale);
    const html = htmlByRoute.get(path) ?? '';
    if (!html) errors.push(`${path}: page missing`);
    if (/name="robots" content="noindex/i.test(html)) errors.push(`${path}: still noindex`);
    if (/Unpublished section|Reviewed content belongs|步骤26|步驟26/.test(html)) errors.push(`${path}: placeholder text remains`);
    if (!sitemapUrls.has(path)) errors.push(`${path}: missing from sitemap`);
    for (const footerPath of basePages) {
      if (!html.includes(`href="${localizedPath(footerPath, locale)}"`)) errors.push(`${path}: localized footer link ${footerPath} missing`);
    }
  }
}

const enPrivacy = htmlByRoute.get('/privacy') ?? '';
const enCookies = htmlByRoute.get('/cookies') ?? '';
const enAbout = htmlByRoute.get('/about') ?? '';
for (const service of ['Google Analytics', 'Google AdSense', 'Microsoft Clarity', 'Plausible']) {
  if (!enPrivacy.includes(`currently does not use ${service}`) && !enPrivacy.includes(`does not use Google Analytics, Google AdSense, Microsoft Clarity, Plausible`)) errors.push(`/privacy: current non-use statement missing ${service}`);
  if (!enCookies.includes(service)) errors.push(`/cookies: current technical status missing ${service}`);
}
for (const disclosure of ['IP address', 'User-Agent', 'request time', 'sender address']) {
  if (!enPrivacy.includes(disclosure)) errors.push(`/privacy: disclosure missing ${disclosure}`);
}
if (!enCookies.includes('currently does not use cookies or local storage')) errors.push('/cookies: explicit current non-use statement missing');
if (!enAbout.includes(`${entityRows.length} source records`)) errors.push(`/about: dynamic record count ${entityRows.length} missing`);
for (const version of versions) if (!enAbout.includes(`game version ${version}`)) errors.push(`/about: dynamic game version ${version} missing`);
for (const source of sources) if (!enAbout.includes(source)) errors.push(`/about: dynamic source ${source} missing`);
if (!enAbout.includes('no records classified as in-game observed or community submitted')) errors.push('/about: source boundary missing');

for (const [path, html] of htmlByRoute) {
  const locale = path === '/zh-cn' || path.startsWith('/zh-cn/') ? 'zh-cn' : path === '/zh-tw' || path.startsWith('/zh-tw/') ? 'zh-tw' : 'en';
  for (const basePath of basePages) {
    const expected = localizedPath(basePath, locale);
    if (!html.includes(`href="${expected}"`)) errors.push(`${path}: footer missing ${expected}`);
  }
}

const complianceScripts = basePages.flatMap((path) => locales.map((locale) => htmlByRoute.get(localizedPath(path, locale)) ?? '')).join('\n');
if (/(googletagmanager|googlesyndication|adsbygoogle|clarity\.ms|plausible\.io)/i.test(complianceScripts)) errors.push('compliance pages contain analytics or advertising script references');

const result = {
  status: errors.length ? 'FAIL' : 'PASS',
  compliance_pages: basePages.length * locales.length,
  footer_pages_checked: htmlByRoute.size,
  sitemap_urls: sitemapUrls.size,
  expected_sitemap_urls: 336,
  entity_records: entityRows.length,
  game_versions: versions,
  data_sources: sources,
  current_analytics_ad_tracking_scripts: 0,
  errors: errors.slice(0, 50),
};
if (sitemapUrls.size !== 336) result.errors.push(`sitemap count ${sitemapUrls.size}, expected 336`);
if (result.errors.length) result.status = 'FAIL';
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'PASS') process.exitCode = 1;
