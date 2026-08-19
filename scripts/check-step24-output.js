#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');
const origin = 'https://ironnestpedia.com';
const correctionEmail = 'corrections@ironnestpedia.com';
const routes = JSON.parse(readFileSync(join(root, 'data/routes.json'), 'utf8')).pages;
const dataRoutes = routes.filter((route) => route.page_type === 'data_entity' || route.page_type === 'index');
const locales = [
  { code: 'en', fieldPrompt: 'Field or value that looks wrong:', evidencePrompt: 'Evidence (' },
  { code: 'zh-cn', fieldPrompt: '不正确的字段或数值：', evidencePrompt: '依据（' },
  { code: 'zh-tw', fieldPrompt: '不正確的欄位或數值：', evidencePrompt: '依據（' },
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

function anchors(html) {
  return [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*class="([^"]*)"[^>]*>|<a\b[^>]*\bclass="([^"]*)"[^>]*href="([^"]+)"[^>]*>/gi)]
    .map((match) => ({ href: (match[1] ?? match[4]).replaceAll('&amp;', '&'), className: match[2] ?? match[3] }));
}

function checkMailto(href, expectedPageUrl, locale, errors, context) {
  let mailto;
  try { mailto = new URL(href); } catch { errors.push(`${context}: invalid mailto URL`); return; }
  if (mailto.protocol !== 'mailto:' || mailto.pathname !== correctionEmail) errors.push(`${context}: wrong correction address`);
  const subject = mailto.searchParams.get('subject') ?? '';
  const body = mailto.searchParams.get('body') ?? '';
  if (!subject.includes('Correction:') && locale.code === 'en') errors.push(`${context}: correction subject missing`);
  if (!body.includes(expectedPageUrl)) errors.push(`${context}: page URL missing from mail body`);
  if (!body.includes(locale.fieldPrompt)) errors.push(`${context}: field/value prompt missing`);
  if (!body.includes(locale.evidencePrompt)) errors.push(`${context}: evidence prompt missing`);
}

const htmlFiles = walk(dist).filter((file) => file.endsWith('.html'));
const htmlByRoute = new Map(htmlFiles.map((file) => [fileToRoute(file), readFileSync(file, 'utf8')]));
const errors = [];
let dataPagesChecked = 0;
let contactPagesChecked = 0;
let footerLinksChecked = 0;

for (const locale of locales) {
  for (const route of dataRoutes) {
    const path = localizedPath(route.url_path, locale.code);
    const html = htmlByRoute.get(path) ?? '';
    const link = anchors(html).find((item) => item.className.split(/\s+/).includes('report-issue'));
    if (!link) errors.push(`${path}: report-an-issue link missing`);
    else checkMailto(link.href, `${origin}${path}`, locale, errors, path);
    dataPagesChecked += 1;
  }

  const contactPath = localizedPath('/contact', locale.code);
  const contactHtml = htmlByRoute.get(contactPath) ?? '';
  const contactMain = contactHtml.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? '';
  if (!contactHtml) errors.push(`${contactPath}: contact page missing`);
  if (/name="robots" content="noindex/i.test(contactHtml)) errors.push(`${contactPath}: contact page is still noindex`);
  if (/<form\b/i.test(contactMain)) errors.push(`${contactPath}: undisclosed web form found in contact content`);
  if (!contactHtml.includes(correctionEmail)) errors.push(`${contactPath}: visible correction email missing`);
  const contactLink = anchors(contactHtml).find((item) => item.className.split(/\s+/).includes('contact-action'));
  if (!contactLink) errors.push(`${contactPath}: contact mailto link missing`);
  else checkMailto(contactLink.href, `${origin}${contactPath}`, locale, errors, contactPath);
  contactPagesChecked += 1;
}

for (const [path, html] of htmlByRoute) {
  const expectedContactPath = path === '/zh-cn' || path.startsWith('/zh-cn/') ? '/zh-cn/contact'
    : path === '/zh-tw' || path.startsWith('/zh-tw/') ? '/zh-tw/contact' : '/contact';
  if (!anchors(html).some((item) => item.className.split(/\s+/).includes('footer-contact') && item.href === expectedContactPath)) {
    errors.push(`${path}: localized footer contact link missing`);
  }
  footerLinksChecked += 1;
}

const sitemapUrls = new Set();
for (const file of walk(dist).filter((file) => /sitemap.*\.xml$/.test(file))) {
  for (const match of readFileSync(file, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const path = new URL(match[1]).pathname.replace(/\/$/, '') || '/';
    if (!path.endsWith('.xml')) sitemapUrls.add(path);
  }
}
for (const locale of locales) {
  const path = localizedPath('/contact', locale.code);
  if (!sitemapUrls.has(path)) errors.push(`${path}: contact page missing from sitemap`);
}

const expectedDataPages = dataRoutes.length * locales.length;
if (dataPagesChecked !== expectedDataPages) errors.push(`data page count ${dataPagesChecked}, expected ${expectedDataPages}`);
console.log(JSON.stringify({
  status: errors.length ? 'FAIL' : 'PASS',
  correction_email: correctionEmail,
  data_pages_checked: dataPagesChecked,
  contact_pages_checked: contactPagesChecked,
  footer_links_checked: footerLinksChecked,
  contact_sitemap_urls: 3,
  about_scope: 'published in step 26; not asserted by step 24 regression check',
  errors: errors.slice(0, 50),
}, null, 2));
if (errors.length) process.exitCode = 1;
