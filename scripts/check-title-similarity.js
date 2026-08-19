#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const locales = ['en', 'zh-cn', 'zh-tw'];
const routes = (JSON.parse(await readFile(join(root, 'data/routes.json'), 'utf8'))).pages
  .filter((route) => route.page_type !== 'tool_placeholder');
const routeMap = new Map(routes.map((route) => [route.url_path, route]));
const pages = [];

function tokens(value) {
  return new Set(String(value).toLocaleLowerCase('en-US').replace(/\|\s*iron nest$/i, '').match(/[\p{L}]+|\d+(?:\.\d+)?/gu) ?? []);
}

function jaccard(left, right) {
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

function templateBody(title, route) {
  if (route?.page_type !== 'data_entity') return title;
  const colon = Math.max(title.indexOf(':'), title.indexOf('：'));
  return colon >= 0 ? title.slice(colon + 1).trim() : title;
}

for (const locale of locales) {
  const seo = new Map();
  for (const file of await readdir(join(root, `data/${locale}/seo`))) {
    const document = JSON.parse(await readFile(join(root, `data/${locale}/seo/${file}`), 'utf8'));
    for (const page of document.pages) seo.set(page.url_path, page);
  }
  const site = JSON.parse(await readFile(join(root, `data/${locale}/site.json`), 'utf8'));
  pages.push({ locale, path: '/', entity: 'Home', title: site.home_seo.title });
  pages.push({ locale, path: '/contact', entity: 'Contact', title: site.contact.seo_title });
  for (const route of routes) {
    const page = seo.get(route.url_path);
    if (!page) throw new Error(`Missing ${locale} SEO: ${route.url_path}`);
    pages.push({ locale, path: route.url_path, entity: route.entity, title: page.title });
  }
}

const expected = 318;
if (pages.length !== expected) throw new Error(`Expected ${expected} indexable titles, found ${pages.length}`);
const exact = new Map();
const exactDuplicates = [];
for (const page of pages) {
  const normalized = page.title.trim().toLocaleLowerCase('en-US');
  if (exact.has(normalized)) exactDuplicates.push([exact.get(normalized), page]);
  else exact.set(normalized, page);
}
const technicalTitleLeaks = pages.filter((page) => /\[\d+\s*(?:locale keys|个本地化键|個本地化鍵)\]/i.test(page.title));
const mixedNameRoutes = routes.filter((route) => route.entity === 'MapEntity' && /STR_ENTITYNAME_[A-Z_]+/.test(String(route.unique_value_statement ?? '')));
const missingNaturalMixedTitles = mixedNameRoutes.filter((route) => {
  const page = pages.find((item) => item.locale === 'en' && item.path === route.url_path);
  return !page?.title.includes(' (also ');
});

let comparisons = 0;
let maxSimilarity = 0;
let closestPair = null;
const nearDuplicates = [];
const exactTemplateBodies = [];
for (let leftIndex = 0; leftIndex < pages.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < pages.length; rightIndex += 1) {
    comparisons += 1;
    const left = pages[leftIndex];
    const right = pages[rightIndex];
    const similarity = jaccard(tokens(left.title), tokens(right.title));
    if (similarity > maxSimilarity) { maxSimilarity = similarity; closestPair = [left, right]; }
    if (similarity >= 0.86) nearDuplicates.push({ similarity, left, right });
    if (left.locale === right.locale && left.entity === right.entity) {
      const leftRoute = routeMap.get(left.path);
      const rightRoute = routeMap.get(right.path);
      if (leftRoute?.page_type === 'data_entity' && rightRoute?.page_type === 'data_entity') {
        const leftBody = templateBody(left.title, leftRoute).toLocaleLowerCase('en-US');
        const rightBody = templateBody(right.title, rightRoute).toLocaleLowerCase('en-US');
        if (leftBody === rightBody) exactTemplateBodies.push({ left, right, body: leftBody });
      }
    }
  }
}

const result = {
  status: exactDuplicates.length || exactTemplateBodies.length || nearDuplicates.length || technicalTitleLeaks.length || missingNaturalMixedTitles.length ? 'FAIL' : 'PASS',
  titles: pages.length,
  pairwise_comparisons: comparisons,
  exact_duplicates: exactDuplicates.length,
  exact_template_body_duplicates: exactTemplateBodies.length,
  near_duplicate_threshold: 0.86,
  near_duplicates: nearDuplicates.length,
  verified_mixed_name_titles: mixedNameRoutes.length,
  technical_title_leaks: technicalTitleLeaks.length,
  missing_natural_mixed_titles: missingNaturalMixedTitles.length,
  maximum_similarity: Number(maxSimilarity.toFixed(3)),
  closest_pair: closestPair?.map(({ locale, path, title }) => ({ locale, path, title })),
  failures: [...technicalTitleLeaks, ...missingNaturalMixedTitles, ...exactTemplateBodies, ...nearDuplicates].slice(0, 20),
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'PASS') process.exitCode = 1;
