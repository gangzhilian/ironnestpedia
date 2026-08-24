#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const routes = (JSON.parse(await readFile(join(root, 'data/routes.json'), 'utf8'))).pages
  .filter((route) => route.page_type !== 'tool_placeholder');
routes.push({ url_path: '/contact', page_type: 'contact', entity: 'Contact' });
const locales = ['en', 'zh-cn', 'zh-tw'];
const localeLang = { en: 'en', 'zh-cn': 'zh-CN', 'zh-tw': 'zh-TW' };
const failures = [];
const summary = { pages: 0, json_ld_blocks: 0, breadcrumbs: 0, datasets: 0, entity_pages: 0, og_images: 0 };
const ogImages = new Set();

function htmlPath(locale, path) {
  if (path === '/') return join(root, 'dist', locale === 'en' ? 'index.html' : `${locale}.html`);
  return join(root, 'dist', locale === 'en' ? '' : locale, `${path.slice(1)}.html`);
}
function attrs(node) { return Object.fromEntries((node.attrs ?? []).map((attr) => [attr.name, attr.value])); }
function walk(node, output = []) { output.push(node); for (const child of node.childNodes ?? []) walk(child, output); return output; }
function text(node) { return node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(text).join(''); }
function elements(nodes, tag, predicate = () => true) { return nodes.filter((node) => node.tagName === tag && predicate(attrs(node))); }
function meta(nodes, key, value) { return elements(nodes, 'meta', (a) => a[key] === value)[0] ? attrs(elements(nodes, 'meta', (a) => a[key] === value)[0]).content : undefined; }
function fail(locale, path, message) { failures.push(`${locale}:${path} — ${message}`); }

for (const locale of locales) {
  for (const route of [{ url_path: '/', page_type: 'home', entity: 'Home' }, ...routes]) {
    const path = route.url_path;
    const source = await readFile(htmlPath(locale, path), 'utf8');
    const document = parse(source);
    const nodes = walk(document);
    summary.pages += 1;
    const canonicalPath = locale === 'en' ? path : path === '/' ? `/${locale}` : `/${locale}${path}`;
    const canonical = `https://ironnestpedia.com${canonicalPath}`;
    const h1s = elements(nodes, 'h1');
    if (h1s.length !== 1) fail(locale, path, `expected exactly one h1, found ${h1s.length}`);
    const title = text(elements(nodes, 'title')[0] ?? {}).trim();
    const description = meta(nodes, 'name', 'description');
    if (!title || !description) fail(locale, path, 'missing title or description');
    if (meta(nodes, 'name', 'viewport') !== 'width=device-width, initial-scale=1') fail(locale, path, 'viewport meta mismatch');
    const canonicalLink = elements(nodes, 'link', (a) => a.rel === 'canonical')[0];
    if (attrs(canonicalLink ?? {}).href !== canonical) fail(locale, path, 'canonical URL mismatch');

    const requiredMeta = [
      ['property', 'og:title', title], ['property', 'og:description', description], ['property', 'og:url', canonical],
      ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', title], ['name', 'twitter:description', description],
    ];
    for (const [key, name, expected] of requiredMeta) if (meta(nodes, key, name) !== expected) fail(locale, path, `${name} mismatch`);
    const ogImage = meta(nodes, 'property', 'og:image');
    const twitterImage = meta(nodes, 'name', 'twitter:image');
    if (!ogImage || ogImage !== twitterImage) fail(locale, path, 'OG/Twitter image missing or inconsistent');
    else {
      ogImages.add(ogImage);
      const imageFile = join(root, 'dist', new URL(ogImage).pathname.slice(1));
      try {
        const dimensions = await sharp(imageFile).metadata();
        if (dimensions.width !== 1200 || dimensions.height !== 630) fail(locale, path, `OG image is ${dimensions.width}×${dimensions.height}`);
      } catch { fail(locale, path, `OG image file missing: ${ogImage}`); }
    }

    const schemas = elements(nodes, 'script', (a) => a.type === 'application/ld+json').map((node) => {
      try { return JSON.parse(text(node)); } catch { fail(locale, path, 'invalid JSON-LD'); return {}; }
    });
    summary.json_ld_blocks += schemas.length;
    if (schemas.some((schema) => ['FAQPage', 'HowTo', 'SoftwareApplication'].includes(schema['@type']))) fail(locale, path, 'unsupported schema type emitted');
    const breadcrumb = schemas.find((schema) => schema['@type'] === 'BreadcrumbList');
    if (path === '/') {
      if (breadcrumb) fail(locale, path, 'homepage should not emit a one-item BreadcrumbList');
    } else if (!breadcrumb) fail(locale, path, 'BreadcrumbList missing');
    else {
      summary.breadcrumbs += 1;
      const items = breadcrumb.itemListElement ?? [];
      if (items.length < 2) fail(locale, path, 'BreadcrumbList has fewer than two items');
      if (items.at(-1)?.item !== canonical) fail(locale, path, 'last breadcrumb item is not canonical URL');
      const visibleText = text(document).replace(/\s+/g, ' ');
      for (const item of items) if (!visibleText.includes(item.name)) fail(locale, path, `breadcrumb name not visible: ${item.name}`);
    }

    if (route.page_type === 'index') {
      const dataset = schemas.find((schema) => schema['@type'] === 'Dataset');
      if (!dataset) fail(locale, path, 'Dataset schema missing on index page');
      else {
        summary.datasets += 1;
        const visibleText = text(document).replace(/\s+/g, ' ');
        if (dataset.name !== text(h1s[0]).trim()) fail(locale, path, 'Dataset name does not match visible h1');
        if (!visibleText.includes(dataset.description)) fail(locale, path, 'Dataset description is not visible verbatim');
        if (dataset.description.length < 50 || dataset.description.length > 5000) fail(locale, path, 'Dataset description outside 50–5000 characters');
        if (dataset.url !== canonical || dataset.inLanguage !== localeLang[locale]) fail(locale, path, 'Dataset URL or language mismatch');
        for (const variable of dataset.variableMeasured ?? []) if (!visibleText.includes(variable)) fail(locale, path, `Dataset variable not visible: ${variable}`);
      }
    }

    if (route.page_type === 'data_entity') {
      summary.entity_pages += 1;
      const classValues = elements(nodes, 'div').map((node) => attrs(node).class ?? '');
      if (!classValues.some((value) => value.split(' ').includes('provenance-stamp'))) fail(locale, path, 'provenance stamp missing');
      if (!classValues.some((value) => value.split(' ').includes('interpretation-status'))) fail(locale, path, 'tested-interpretation status missing');
    }
    if (['Medal', 'Punchcard', 'Mutator'].includes(route.entity) && route.page_type === 'index') {
      if (!elements(nodes, 'div').some((node) => (attrs(node).class ?? '').split(' ').includes('index-table-only'))) fail(locale, path, 'table-only index class missing');
    }
  }
}

summary.og_images = ogImages.size;
if (summary.pages !== 318) failures.push(`Expected 318 pages, checked ${summary.pages}`);
if (summary.breadcrumbs !== 315) failures.push(`Expected 315 BreadcrumbLists, found ${summary.breadcrumbs}`);
if (summary.datasets !== 21) failures.push(`Expected 21 localized Dataset schemas, found ${summary.datasets}`);
if (summary.entity_pages !== 288) failures.push(`Expected 288 localized entity pages, found ${summary.entity_pages}`);
if (summary.og_images !== 318) failures.push(`Expected 318 unique OG images, found ${summary.og_images}`);

const css = await readFile(join(root, 'src/styles/global.css'), 'utf8');
for (const [token, value] of Object.entries({ '--bg-base': '#0d1210', '--bg-surface': '#161c19', '--bg-elevated': '#1c231f', '--text-primary': '#dce4dd', '--text-muted': '#8a978c', '--accent-warning': '#ffb020' })) {
  if (!css.includes(`${token}: ${value}`)) failures.push(`Visual token mismatch: ${token}`);
}
for (const [token, value] of Object.entries({ '--bg-base': '#eef1ec', '--bg-surface': '#e2e7de', '--bg-elevated': '#f8faf6', '--border-line': '#c3ccbe', '--text-primary': '#1a211c', '--text-muted': '#5c6a5a', '--accent-olive': '#5c7355', '--accent-warning': '#9b5d06' })) {
  if (!css.includes(`${token}: ${value}`)) failures.push(`Light visual token mismatch: ${token}`);
}
if (css.includes('fonts.googleapis.com')) failures.push('Runtime Google Fonts reference found');

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
summary.contrast = {
  dark: {
    primary_on_base: Number(contrast('#dce4dd', '#0d1210').toFixed(2)),
    muted_on_base: Number(contrast('#8a978c', '#0d1210').toFixed(2)),
    warning_on_base: Number(contrast('#ffb020', '#0d1210').toFixed(2)),
    primary_on_surface: Number(contrast('#dce4dd', '#161c19').toFixed(2)),
    muted_on_surface: Number(contrast('#8a978c', '#161c19').toFixed(2)),
    warning_on_surface: Number(contrast('#ffb020', '#161c19').toFixed(2)),
  },
  light: {
    primary_on_base: Number(contrast('#1a211c', '#eef1ec').toFixed(2)),
    muted_on_base: Number(contrast('#5c6a5a', '#eef1ec').toFixed(2)),
    warning_on_base: Number(contrast('#9b5d06', '#eef1ec').toFixed(2)),
    primary_on_surface: Number(contrast('#1a211c', '#e2e7de').toFixed(2)),
    muted_on_surface: Number(contrast('#5c6a5a', '#e2e7de').toFixed(2)),
    warning_on_elevated: Number(contrast('#9b5d06', '#f8faf6').toFixed(2)),
    button_text_on_warning: Number(contrast('#fffaf0', '#9b5d06').toFixed(2)),
    panel_text_on_olive: Number(contrast('#fffaf0', '#5c7355').toFixed(2)),
  },
};
for (const [theme, pairs] of Object.entries(summary.contrast)) {
  for (const [pair, ratio] of Object.entries(pairs)) if (ratio < 4.5) failures.push(`WCAG AA contrast failed: ${theme}.${pair} = ${ratio}`);
}

console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', ...summary, failures: failures.slice(0, 50) }, null, 2));
if (failures.length) process.exitCode = 1;
