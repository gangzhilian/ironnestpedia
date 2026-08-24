#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import MiniSearch from 'minisearch';
import { parse } from 'parse5';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');
const locales = ['en', 'zh-cn', 'zh-tw'];
const expectedPhantomLabels = { en: 'Phantom Battery', 'zh-cn': '幽灵炮台', 'zh-tw': '幻影炮台' };
const errors = [];

function walkFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const file = join(directory, name);
    return statSync(file).isDirectory() ? walkFiles(file) : [file];
  });
}
function attrs(node) { return Object.fromEntries((node.attrs ?? []).map((attribute) => [attribute.name, attribute.value])); }
function walkNodes(node, output = []) { output.push(node); for (const child of node.childNodes ?? []) walkNodes(child, output); return output; }
function classes(node) { return (attrs(node).class ?? '').split(/\s+/).filter(Boolean); }
function withClass(nodes, name) { return nodes.filter((node) => classes(node).includes(name)); }
function descendants(node) { return walkNodes(node, []).slice(1); }
function localeFor(file) {
  const rel = relative(dist, file).split(sep).join('/');
  if (rel === 'zh-cn.html' || rel.startsWith('zh-cn/')) return 'zh-cn';
  if (rel === 'zh-tw.html' || rel.startsWith('zh-tw/')) return 'zh-tw';
  return 'en';
}

const htmlFiles = walkFiles(dist).filter((file) => file.endsWith('.html'));
const pagesByLocale = { en: 0, 'zh-cn': 0, 'zh-tw': 0 };
let quickJumpOccurrences = 0;

for (const file of htmlFiles) {
  const source = readFileSync(file, 'utf8');
  const nodes = walkNodes(parse(source));
  const rel = relative(dist, file);
  const locale = localeFor(file);
  pagesByLocale[locale] += 1;
  quickJumpOccurrences += (source.match(/QUICK JUMP|快速跳[转轉]/gi) ?? []).length;

  const headers = withClass(nodes, 'site-header');
  if (headers.length !== 1) {
    errors.push(`${rel}: expected one site-header, found ${headers.length}`);
    continue;
  }
  const headerNodes = descendants(headers[0]);
  for (const className of ['utility-bar', 'utility-actions', 'language-menu', 'language-panel', 'theme-toggle', 'steam-entry', 'main-bar', 'brand', 'main-navigation', 'global-search', 'search-results']) {
    if (withClass(headerNodes, className).length !== 1) errors.push(`${rel}: expected one .${className}`);
  }
  if (headerNodes.some((node) => node.tagName === 'select')) errors.push(`${rel}: native select found in header`);
  if (headerNodes.some((node) => node.tagName === 'datalist')) errors.push(`${rel}: QUICK JUMP datalist remains in header`);

  const steam = withClass(headerNodes, 'steam-entry')[0];
  const steamAttrs = attrs(steam ?? {});
  if (steamAttrs.href !== 'https://store.steampowered.com/app/2950790/' || steamAttrs.target !== '_blank' || !String(steamAttrs.rel).split(/\s+/).includes('noopener')) {
    errors.push(`${rel}: Steam entry attributes mismatch`);
  }
  const languagePanel = withClass(headerNodes, 'language-panel')[0];
  const languageOptions = descendants(languagePanel ?? {}).filter((node) => node.tagName === 'a');
  if (languageOptions.length !== 3) errors.push(`${rel}: expected three language options, found ${languageOptions.length}`);
  const themeToggle = withClass(headerNodes, 'theme-toggle')[0];
  if (descendants(themeToggle ?? {}).filter((node) => node.tagName === 'svg').length !== 2) errors.push(`${rel}: theme toggle must contain two custom SVG states`);
  const search = withClass(headerNodes, 'global-search')[0];
  const searchAttrs = attrs(search ?? {});
  if (searchAttrs['data-search-index'] !== `/search-index/${locale}.json`) errors.push(`${rel}: localized search index reference mismatch`);
  const combobox = descendants(search ?? {}).find((node) => attrs(node).role === 'combobox');
  if (!combobox || attrs(combobox)['aria-autocomplete'] !== 'list') errors.push(`${rel}: accessible search combobox missing`);
  if (!source.includes("localStorage.getItem('ironnest-theme')") || !source.includes('document.documentElement.dataset.theme')) errors.push(`${rel}: pre-paint theme restoration missing`);
}

const searchCounts = {};
const prefixMatches = {};
for (const locale of locales) {
  const file = join(dist, 'search-index', `${locale}.json`);
  const documents = JSON.parse(readFileSync(file, 'utf8'));
  searchCounts[locale] = documents.length;
  if (documents.length !== 105) errors.push(`${locale}: expected 105 search documents, found ${documents.length}`);
  if (new Set(documents.map((document) => document.id)).size !== 105) errors.push(`${locale}: duplicate search document IDs`);
  if (documents.some((document) => !document.label || !document.title || !document.path)) errors.push(`${locale}: incomplete search document`);
  const phantom = documents.find((document) => document.id === '/missions/phantombattery');
  if (phantom?.label !== expectedPhantomLabels[locale]) errors.push(`${locale}: Phantom Battery label mismatch`);
  const index = new MiniSearch({ fields: ['label', 'title', 'keywords', 'path'], storeFields: ['label', 'path'] });
  index.addAll(documents);
  const query = locale === 'en' ? 'phan' : locale === 'zh-cn' ? '幽灵' : '幻影';
  const matches = index.search(query, { prefix: true, combineWith: 'AND' });
  prefixMatches[locale] = matches[0]?.label ?? null;
  if (!matches.some((match) => match.id === '/missions/phantombattery')) errors.push(`${locale}: prefix search did not find Phantom Battery`);
}

const css = readFileSync(join(root, 'src/styles/global.css'), 'utf8');
if (!/\.main-bar\s*\{[^}]*grid-template-columns:\s*1fr auto 1fr/.test(css)) errors.push('desktop three-column main-bar grid missing');
if (!/:root\[data-theme="light"\]/.test(css)) errors.push('light theme token block missing');
if (!/\.language-panel\s*\{[^}]*background:\s*var\(--bg-elevated\)/.test(css)) errors.push('language panel does not use --bg-elevated');
if (!/\.search-results\s*\{[^}]*background:\s*var\(--bg-elevated\)/.test(css)) errors.push('search results do not use --bg-elevated');
if (!/@media \(max-width: 560px\)[\s\S]*?\.utility-actions\s*\{[^}]*width:\s*100%/.test(css)) errors.push('mobile always-visible utility row missing');
if (!/@media \(max-width: 560px\)[\s\S]*?\.global-search\s*\{[^}]*width:\s*100%/.test(css)) errors.push('mobile full-width global search missing');

const result = {
  status: errors.length ? 'FAIL' : 'PASS',
  html_pages: htmlFiles.length,
  pages_by_locale: pagesByLocale,
  search_documents_by_locale: searchCounts,
  prefix_search_top_matches: prefixMatches,
  quick_jump_occurrences: quickJumpOccurrences,
  language_options_per_page: 3,
  theme_persistence: 'localStorage',
  mobile_utility_strategy: 'always-visible single row',
  errors: errors.slice(0, 50),
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
