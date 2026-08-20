#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');
const origin = 'https://ironnestpedia.com';
const locales = ['en', 'zh-cn', 'zh-tw'];
const localizedPath = (path, locale) => locale === 'en' ? path : `/${locale}${path}`;
const guideFiles = readdirSync(join(root, 'data', 'en', 'guides')).filter((file) => file.endsWith('.json')).sort();
const guides = guideFiles.map((file) => JSON.parse(readFileSync(join(root, 'data', 'en', 'guides', file), 'utf8')));

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
function sitemapPaths() {
  const paths = new Set();
  for (const file of walk(dist).filter((path) => /sitemap.*\.xml$/.test(path))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const path = new URL(match[1]).pathname.replace(/\/$/, '') || '/';
      if (!path.endsWith('.xml')) paths.add(path);
    }
  }
  return paths;
}
function visibleText(html) {
  const read = (node) => node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(read).join(' ');
  return read(parse(html)).replace(/\s+/g, ' ').trim();
}

const htmlFiles = walk(dist).filter((file) => file.endsWith('.html'));
const htmlByRoute = new Map(htmlFiles.map((file) => [fileToRoute(file), readFileSync(file, 'utf8')]));
const sitemap = sitemapPaths();
const errors = [];
const inbound = {};

if (guideFiles.length !== 2) errors.push(`English guide data files=${guideFiles.length}, expected=2`);
for (const locale of locales) {
  const localizedFiles = readdirSync(join(root, 'data', locale, 'guides')).filter((file) => file.endsWith('.json')).sort();
  if (JSON.stringify(localizedFiles) !== JSON.stringify(guideFiles)) errors.push(`${locale}: guide data file set differs from en`);
}

for (const guide of guides) {
  inbound[guide.url_path] = {};
  for (const locale of locales) {
    const pagePath = localizedPath(guide.url_path, locale);
    const html = htmlByRoute.get(pagePath) ?? '';
    if (!html) { errors.push(`${pagePath}: built guide HTML missing`); continue; }
    if (/name="robots" content="noindex/i.test(html)) errors.push(`${pagePath}: published guide is noindex`);
    if (!html.includes(`<link rel="canonical" href="${origin}${pagePath}">`)) errors.push(`${pagePath}: canonical mismatch`);
    if (!sitemap.has(pagePath)) errors.push(`${pagePath}: missing from sitemap`);
    if (!html.includes('hreflang="x-default"')) errors.push(`${pagePath}: x-default missing`);
    for (const targetLocale of locales) {
      const hreflang = targetLocale === 'en' ? 'en' : targetLocale === 'zh-cn' ? 'zh-CN' : 'zh-TW';
      if (!html.includes(`hreflang="${hreflang}" href="${origin}${localizedPath(guide.url_path, targetLocale)}"`)) errors.push(`${pagePath}: ${hreflang} alternate missing`);
    }
    const localeGuide = JSON.parse(readFileSync(join(root, 'data', locale, 'guides', `${guide.slug}.json`), 'utf8'));
    const pageText = visibleText(html);
    for (const text of [localeGuide.h1, localeGuide.summary, localeGuide.provenance]) if (!pageText.includes(text)) errors.push(`${pagePath}: required guide copy missing`);
    for (const related of localeGuide.related_links) if (!html.includes(`href="${localizedPath(related.path, locale)}"`)) errors.push(`${pagePath}: related data link ${related.path} missing`);
    const expectedSources = localeGuide.inbound_from.map((path) => localizedPath(path, locale));
    const sources = expectedSources.filter((source) => (htmlByRoute.get(source) ?? '').includes(`href="${pagePath}"`));
    inbound[guide.url_path][locale] = sources.length;
    if (sources.length !== expectedSources.length) errors.push(`${pagePath}: inbound=${sources.length}, expected=${expectedSources.length}, missing=${expectedSources.filter((source) => !sources.includes(source)).join(',')}`);
    const ogPath = join(root, 'dist', 'og', locale, `guides--${guide.slug}.png`);
    if (!statExists(ogPath)) errors.push(`${pagePath}: OG image missing`);
  }
}

function statExists(path) {
  try { return statSync(path).isFile(); } catch { return false; }
}

const uncertaintyMarkers = {
  en: ['found none', 'did not find one', 'not confirmed'],
  'zh-cn': ['没有找到', '尚未确认'],
  'zh-tw': ['沒有找到', '尚未確認'],
};
for (const locale of locales) {
  const combined = guides.map((guide) => htmlByRoute.get(localizedPath(guide.url_path, locale)) ?? '').join('\n');
  for (const marker of uncertaintyMarkers[locale]) if (!combined.includes(marker)) errors.push(`${locale}: uncertainty marker missing: ${marker}`);
  const requisition = htmlByRoute.get(localizedPath('/guides/requisition-and-powder-resets', locale)) ?? '';
  for (const value of ['60', '15', '2', '13–58']) if (!requisition.includes(value)) errors.push(`${locale}: Requisition comparison missing ${value}`);
  const indexPath = localizedPath('/guides', locale);
  const indexHtml = htmlByRoute.get(indexPath) ?? '';
  if (!/name="robots" content="noindex,follow"/i.test(indexHtml)) errors.push(`${indexPath}: guide index placeholder must remain noindex,follow`);
  if (sitemap.has(indexPath)) errors.push(`${indexPath}: noindex guide index leaked into sitemap`);
}

const publishedPaths = new Set(guides.flatMap((guide) => locales.map((locale) => localizedPath(guide.url_path, locale))));
const unexpectedGuidePages = [...htmlByRoute.keys()].filter((path) => {
  const base = path.replace(/^\/(?:zh-cn|zh-tw)(?=\/|$)/, '') || '/';
  return base.startsWith('/guides/') && !publishedPaths.has(path);
});
if (unexpectedGuidePages.length) errors.push(`unexpected guide pages published: ${unexpectedGuidePages.join(', ')}`);

const expectedGuideSitemapUrls = guides.length * locales.length;
const actualGuideSitemapUrls = [...sitemap].filter((path) => {
  const base = path.replace(/^\/(?:zh-cn|zh-tw)(?=\/|$)/, '') || '/';
  return guides.some((guide) => guide.url_path === base);
}).length;
if (actualGuideSitemapUrls !== expectedGuideSitemapUrls) errors.push(`guide sitemap URLs=${actualGuideSitemapUrls}, expected=${expectedGuideSitemapUrls}`);

console.log(JSON.stringify({
  status: errors.length ? 'FAIL' : 'PASS',
  published_guides: guides.length,
  localized_guide_pages: guides.length * locales.length,
  sitemap_total_urls: sitemap.size,
  guide_sitemap_urls: actualGuideSitemapUrls,
  sitemap_urls_added_from_step28: sitemap.size - 336,
  guide_inbound_sources: inbound,
  guide_index_noindex_pages: locales.length,
  unexpected_candidate_pages: unexpectedGuidePages.length,
  errors: errors.slice(0, 50),
}, null, 2));
if (errors.length) process.exitCode = 1;
