#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');
const locales = ['en', 'zh-cn', 'zh-tw'];
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
const errors = [];
const measurementIds = new Set();
let taggedPages = 0;

for (const [route, html] of htmlByRoute) {
  const tags = [...html.matchAll(/googletagmanager\.com\/gtag\/js\?id=(G-[A-Z0-9]+)/g)];
  if (tags.length !== 1) {
    errors.push(`${route}: expected one GA4 loader, found ${tags.length}`);
    continue;
  }
  taggedPages += 1;
  measurementIds.add(tags[0][1]);
  for (const consent of ['ad_storage', 'ad_user_data', 'ad_personalization']) {
    if (!new RegExp(`${consent}: ['\"]denied['\"]`).test(html)) errors.push(`${route}: ${consent} is not denied by default`);
  }
  if (!/analytics_storage: ['"]granted['"]/.test(html)) errors.push(`${route}: analytics_storage is not explicitly granted for basic analytics`);
  const consentPosition = html.indexOf("gtag('consent', 'default'");
  const configPosition = html.indexOf("gtag('config'");
  if (consentPosition < 0 || configPosition < 0 || consentPosition > configPosition) errors.push(`${route}: consent default is not queued before config`);
}

if (measurementIds.size !== 1) errors.push(`expected one GA4 Measurement ID across the site, found ${[...measurementIds].join(', ') || 'none'}`);

const allHtml = [...htmlByRoute.values()].join('\n');
if (/(clarity\.ms|plausible\.io|umami|googlesyndication|adsbygoogle)/i.test(allHtml)) errors.push('an undeclared analytics or advertising script is present');

for (const eventName of [
  'tool-open', 'tool-calculate', 'tool-result', 'tool-copy',
  'guide-read', 'data-page-scroll', 'faq-open',
  'correction-submit', 'community-submit', 'search-use', 'index-page-click',
]) {
  if (!allHtml.includes(eventName)) errors.push(`analytics event wiring missing: ${eventName}`);
}

for (const locale of locales) {
  const privacyPath = localizedPath('/privacy', locale);
  const cookiesPath = localizedPath('/cookies', locale);
  const privacy = htmlByRoute.get(privacyPath) ?? '';
  const cookies = htmlByRoute.get(cookiesPath) ?? '';
  if (!privacy || !cookies) errors.push(`${locale}: privacy or cookies page missing`);
  if (!privacy.includes('Google Analytics 4') || !cookies.includes('Google Analytics 4')) errors.push(`${locale}: GA4 disclosure missing from policy pages`);
  for (const consent of ['ad_storage', 'ad_user_data', 'ad_personalization']) {
    if (!privacy.includes(consent) || !cookies.includes(consent)) errors.push(`${locale}: ${consent} disclosure missing`);
  }
  if (/currently does not use Google Analytics|目前不使用 Google Analytics|目前不使用 Google Analytics/.test(`${privacy}\n${cookies}`)) {
    errors.push(`${locale}: obsolete no-GA statement remains`);
  }
}

const result = {
  status: errors.length ? 'FAIL' : 'PASS',
  html_pages: htmlByRoute.size,
  ga4_tagged_pages: taggedPages,
  measurement_id_count: measurementIds.size,
  consent_defaults: {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  },
  analytics_services: ['Google Analytics 4'],
  policy_pages_checked: locales.length * 2,
  errors: errors.slice(0, 50),
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'PASS') process.exitCode = 1;
