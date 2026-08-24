#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const locales = ['en', 'zh-cn', 'zh-tw'];
const errors = [];

function attrs(node) { return Object.fromEntries((node.attrs ?? []).map((attribute) => [attribute.name, attribute.value])); }
function walk(node, output = []) { output.push(node); for (const child of node.childNodes ?? []) walk(child, output); return output; }
function classes(node) { return (attrs(node).class ?? '').split(/\s+/).filter(Boolean); }
function withClass(nodes, name) { return nodes.filter((node) => classes(node).includes(name)); }
function descendants(node) { return walk(node, []).slice(1); }
function textContent(node) { return (node?.childNodes ?? []).map((child) => child.nodeName === '#text' ? child.value : textContent(child)).join('').replace(/\s+/g, ' ').trim(); }
function outputFile(locale) { return join(root, 'dist', locale === 'en' ? 'index.html' : `${locale}.html`); }
function localizedPath(path, locale) { return locale === 'en' ? path : `/${locale}${path}`; }

for (const locale of locales) {
  const home = JSON.parse(readFileSync(join(root, 'data', locale, 'home.json'), 'utf8'));
  const heroData = home.blocks.find((block) => block.order === 1);
  const guideData = home.blocks.find((block) => block.order === 4);
  const html = readFileSync(outputFile(locale), 'utf8');
  const nodes = walk(parse(html));
  const heroes = withClass(nodes, 'home-hero');
  if (heroes.length !== 1) {
    errors.push(`${locale}: expected one homepage Hero, found ${heroes.length}`);
    continue;
  }
  const hero = heroes[0];
  const heroNodes = descendants(hero);
  const semanticH1 = heroNodes.filter((node) => node.tagName === 'h1');
  if (semanticH1.length !== 1 || textContent(semanticH1[0]) !== home.h1 || !classes(semanticH1[0] ?? {}).includes('visually-hidden')) {
    errors.push(`${locale}: the existing semantic H1 was not preserved exactly`);
  }
  if (textContent(withClass(heroNodes, 'hero-classification')[0]) !== heroData.eyebrow) errors.push(`${locale}: eyebrow mismatch`);
  if (textContent(withClass(heroNodes, 'hero-title-primary')[0]) !== 'IRON NEST') errors.push(`${locale}: primary visual title mismatch`);
  if (textContent(withClass(heroNodes, 'hero-title-secondary')[0]) !== 'Heavy Turret Simulator') errors.push(`${locale}: visual subtitle mismatch`);
  if (textContent(withClass(heroNodes, 'hero-hook')[0]) !== heroData.description) errors.push(`${locale}: Hero hook mismatch`);

  const stats = withClass(heroNodes, 'hero-stat');
  if (stats.length !== 4) errors.push(`${locale}: expected four trust facts, found ${stats.length}`);
  stats.forEach((stat, index) => {
    const label = textContent(descendants(stat).find((node) => node.tagName === 'span'));
    if (label !== heroData.hero_stats[index]?.label) errors.push(`${locale}: trust fact ${index + 1} mismatch`);
  });
  const reviewDate = withClass(heroNodes, 'hero-stat-date')[0];
  if (attrs(reviewDate ?? {}).datetime !== '2026-08-24') errors.push(`${locale}: Steam review verification date missing`);

  const ctas = withClass(heroNodes, 'hero-cta');
  const expectedHrefs = [localizedPath('/missions/phantombattery', locale), localizedPath('/known-issues', locale), '#database-matrix'];
  if (ctas.length !== 3) errors.push(`${locale}: expected three Hero CTAs, found ${ctas.length}`);
  ctas.forEach((cta, index) => {
    if (attrs(cta).href !== expectedHrefs[index]) errors.push(`${locale}: CTA ${index + 1} target mismatch`);
    if (textContent(cta) !== heroData.cta_buttons[index]?.label) errors.push(`${locale}: CTA ${index + 1} label mismatch`);
  });
  const teaser = withClass(heroNodes, 'hero-dev-teaser')[0];
  if (!teaser || teaser.tagName !== 'p' || textContent(teaser) !== heroData.dev_teaser.label) errors.push(`${locale}: development teaser mismatch`);
  if (descendants(teaser ?? {}).some((node) => node.tagName === 'a' || node.tagName === 'button')) errors.push(`${locale}: development teaser must not be interactive`);
  if (nodes.filter((node) => attrs(node).id === 'database-matrix').length !== 1) errors.push(`${locale}: database matrix anchor missing`);
  if (guideData?.count !== 0) errors.push(`${locale}: guide placeholder count changed`);
}

const source = readFileSync(join(root, 'src', 'components', 'HomePage.astro'), 'utf8');
if (!source.includes('Refresh the Steam review snapshot periodically')) errors.push('Steam review refresh TODO is missing');
const css = readFileSync(join(root, 'src', 'styles', 'global.css'), 'utf8');
if (!/\.home-hero\s*\{[\s\S]*?linear-gradient[\s\S]*?var\(--hero-background\)/.test(css)) errors.push('Hero background gradient/image treatment missing');
if (!/@media \(max-width: 560px\)[\s\S]*?\.home-hero\s*\{[\s\S]*?background-position/.test(css)) errors.push('mobile Hero crop is not defined');
if (!existsSync(join(root, 'public', 'images', 'page_bg_raw.jpg'))) errors.push('self-hosted Steam Hero background is missing');

const result = {
  status: errors.length ? 'FAIL' : 'PASS',
  locales_checked: locales.length,
  hero_sections: locales.length,
  trust_facts_per_locale: 4,
  ctas_per_locale: 3,
  semantic_h1: 'preserved and visually hidden',
  review_snapshot_verified_at: '2026-08-24',
  guide_placeholder_count: 0,
  errors,
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
