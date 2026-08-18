#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(fileURLToPath(new URL('..', import.meta.url)));
const distRoot = join(projectRoot, 'dist');
const routes = JSON.parse(readFileSync(join(projectRoot, 'data', 'routes.json'), 'utf8')).pages;
const placeholders = JSON.parse(readFileSync(join(projectRoot, 'data', 'skeleton-placeholder-pages.json'), 'utf8')).pages;
const siteOrigin = 'https://ironnestpedia.com';
const minInbound = 3;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function fileToRoute(file) {
  const rel = relative(distRoot, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'/index.html'.length)}`;
  return `/${rel.slice(0, -'.html'.length)}`;
}

function normalizeHref(href, source) {
  if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return null;
  try {
    const url = new URL(href.replaceAll('&amp;', '&'), new URL(source, siteOrigin));
    if (url.origin !== siteOrigin) return null;
    return url.pathname.replace(/\/$/, '') || '/';
  } catch {
    return null;
  }
}

const htmlFiles = walk(distRoot).filter((file) => file.endsWith('.html'));
const htmlByRoute = new Map(htmlFiles.map((file) => [fileToRoute(file), readFileSync(file, 'utf8')]));
const inbound = new Map(routes.map((route) => [route.url_path, new Set()]));

for (const [source, html] of htmlByRoute) {
  const hrefPattern = /<a\b[^>]*\bhref=(?:"([^"]+)"|'([^']+)')[^>]*>/gi;
  for (const match of html.matchAll(hrefPattern)) {
    const target = normalizeHref(match[1] ?? match[2], source);
    if (target && target !== source && inbound.has(target)) inbound.get(target).add(source);
  }
}

const errors = [];
const audited = routes.filter((route) => route.page_type !== 'tool_placeholder');
for (const route of audited) {
  const html = htmlByRoute.get(route.url_path);
  if (!html) errors.push(`${route.url_path}: missing built HTML`);
  if (/name="robots" content="noindex/i.test(html ?? '')) errors.push(`${route.url_path}: approved page is unexpectedly noindex`);
  const count = inbound.get(route.url_path)?.size ?? 0;
  if (count < minInbound) errors.push(`${route.url_path}: inbound=${count}, expected >=${minInbound}`);
}

const noindexPaths = [...placeholders.map((page) => page.url_path), '/tools/mission-map', '/404'];
for (const path of noindexPaths) {
  const html = htmlByRoute.get(path);
  if (!html) errors.push(`${path}: missing noindex placeholder HTML`);
  else if (!/name="robots" content="noindex,follow"/i.test(html)) errors.push(`${path}: missing noindex,follow meta`);
}

const sitemapFiles = walk(distRoot).filter((file) => /sitemap.*\.xml$/.test(file));
const sitemapUrls = new Set();
for (const file of sitemapFiles) {
  const xml = readFileSync(file, 'utf8');
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const path = new URL(match[1]).pathname.replace(/\/$/, '') || '/';
    if (!path.endsWith('.xml')) sitemapUrls.add(path);
  }
}
for (const path of noindexPaths) if (sitemapUrls.has(path)) errors.push(`${path}: noindex page leaked into sitemap`);
const expectedSitemapRoutes = new Map([
  ['/', { entity: 'Home', page_type: 'home' }],
  ...routes
    .filter((route) => route.page_type !== 'tool_placeholder')
    .map((route) => [route.url_path, { entity: route.entity, page_type: route.page_type }]),
]);
const missingSitemapRoutes = [...expectedSitemapRoutes]
  .filter(([path]) => !sitemapUrls.has(path))
  .map(([url_path, route]) => ({ url_path, ...route }));
const extraSitemapRoutes = [...sitemapUrls]
  .filter((path) => !expectedSitemapRoutes.has(path));
if (missingSitemapRoutes.length || extraSitemapRoutes.length) {
  errors.push(JSON.stringify({
    sitemap_diff: {
      expected: expectedSitemapRoutes.size,
      actual: sitemapUrls.size,
      missing: missingSitemapRoutes,
      extra: extraSitemapRoutes,
    },
  }));
}

if (errors.length) {
  console.error(JSON.stringify({ status: 'FAIL', html_pages: htmlFiles.length, audited_pages: audited.length, sitemap_urls: sitemapUrls.size, errors }, null, 2));
  process.exit(1);
}

const inboundCounts = audited.map((route) => inbound.get(route.url_path)?.size ?? 0);
console.log(JSON.stringify({
  status: 'PASS',
  html_pages: htmlFiles.length,
  audited_pages: audited.length,
  below_three_inbound: 0,
  minimum_inbound: Math.min(...inboundCounts),
  expected_sitemap_urls: expectedSitemapRoutes.size,
  sitemap_urls: sitemapUrls.size,
  missing_sitemap_urls: missingSitemapRoutes.length,
  extra_sitemap_urls: extraSitemapRoutes.length,
}, null, 2));
