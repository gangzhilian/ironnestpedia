#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');
const locales = {
  en: { prefix: '/', hint: 'Swipe horizontally to view all columns →', region: 'Scrollable data table' },
  'zh-cn': { prefix: '/zh-cn/', hint: '左右滑动查看全部列 →', region: '可横向滚动的数据表格' },
  'zh-tw': { prefix: '/zh-tw/', hint: '左右滑動查看全部欄位 →', region: '可橫向捲動的資料表格' },
};

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const file = join(dir, name);
    return statSync(file).isDirectory() ? walk(file) : [file];
  });
}

function routeFor(file) {
  const rel = relative(dist, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'/index.html'.length)}`;
  return `/${rel.replace(/\.html$/, '')}`;
}

function luminance(hex) {
  const channels = hex.match(/[\da-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(left, right) {
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const htmlFiles = walk(dist).filter((file) => file.endsWith('.html'));
const errors = [];
let tablePages = 0;
let tables = 0;
let visibleImages = 0;

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const route = routeFor(file);
  const tableCount = (html.match(/<table\b/g) ?? []).length;
  const shellCount = (html.match(/class="table-shell"/g) ?? []).length;
  const hintCount = (html.match(/class="table-scroll-hint"/g) ?? []).length;
  const regionCount = (html.match(/class="table-wrap" role="region" aria-label="[^"]+" tabindex="0"/g) ?? []).length;
  if (tableCount) {
    tablePages += 1;
    tables += tableCount;
    const locale = route === '/zh-cn' || route.startsWith('/zh-cn/') ? locales['zh-cn']
      : route === '/zh-tw' || route.startsWith('/zh-tw/') ? locales['zh-tw'] : locales.en;
    if (shellCount !== tableCount || hintCount !== tableCount || regionCount !== tableCount) {
      errors.push(`${route}: tables=${tableCount} shells=${shellCount} hints=${hintCount} regions=${regionCount}`);
    }
    if (!html.includes(locale.hint) || !html.includes(`aria-label="${locale.region}"`)) errors.push(`${route}: localized table guidance missing`);
  }

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    visibleImages += 1;
    const attrs = match[1];
    if (!/\balt="[^"]*"/i.test(attrs)) errors.push(`${route}: img without alt`);
    if (!/\bwidth="\d+"/i.test(attrs) || !/\bheight="\d+"/i.test(attrs)) errors.push(`${route}: img without intrinsic dimensions`);
  }
}

const css = readFileSync(join(root, 'src/styles/global.css'), 'utf8');
if (!/@media \(max-width: 860px\)[\s\S]*?\.table-scroll-hint \{ display: block;/.test(css)) errors.push('tablet table-scroll hint rule missing');
if (!/@media \(max-width: 560px\)[\s\S]*?th:first-child, td:first-child \{ position: sticky;/.test(css)) errors.push('mobile sticky first-column rule missing');
if (!/@media \(prefers-reduced-motion: reduce\)/.test(css) || !/transition-duration: \.01ms !important/.test(css)) errors.push('reduced-motion override missing');
if (!/-webkit-overflow-scrolling: touch/.test(css) || !/overscroll-behavior-inline: contain/.test(css)) errors.push('touch scrolling containment missing');

const toolHeaderContrast = contrast('ffb020', '3f503b');
if (toolHeaderContrast < 4.5) errors.push(`tool header contrast ${toolHeaderContrast.toFixed(2)} is below 4.5`);

const techMark = readFileSync(join(root, 'src/components/TechMark.astro'), 'utf8');
if (!/<svg[^>]*width=\{size\}[^>]*height=\{size\}/.test(techMark) || !/aria-hidden=/.test(techMark)) errors.push('self-drawn SVG dimensions or accessibility handling missing');

const ogFiles = walk(join(root, 'public/og')).filter((file) => file.endsWith('.png'));
const result = {
  status: errors.length ? 'FAIL' : 'PASS',
  html_pages: htmlFiles.length,
  table_pages: tablePages,
  responsive_tables: tables,
  visible_raster_images: visibleImages,
  social_og_images: ogFiles.length,
  table_strategy: 'horizontal-scroll',
  tablet_hint_breakpoint_px: 860,
  mobile_sticky_column_breakpoint_px: 560,
  tool_header_contrast: Number(toolHeaderContrast.toFixed(2)),
  reduced_motion: true,
  errors: errors.slice(0, 50),
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
