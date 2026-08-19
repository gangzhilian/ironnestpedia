#!/usr/bin/env node

import { mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const locales = ['en', 'zh-cn', 'zh-tw'];
const routes = (JSON.parse(await readFile(join(root, 'data/routes.json'), 'utf8'))).pages
  .filter((route) => route.page_type !== 'tool_placeholder');
const pages = [
  { url_path: '/', entity: 'IRON NEST' },
  ...routes,
  { url_path: '/contact', entity: 'Contact' },
  { url_path: '/about', entity: 'Compliance' },
  { url_path: '/privacy', entity: 'Compliance' },
  { url_path: '/cookies', entity: 'Compliance' },
  { url_path: '/terms', entity: 'Compliance' },
  { url_path: '/tools', entity: 'Tool' },
  { url_path: '/tools/achievement-completion', entity: 'Tool' },
];
const displayFont = (await readFile(join(root, 'public/fonts/space-grotesk-latin-variable.woff2'))).toString('base64');
const dataFont = (await readFile(join(root, 'public/fonts/jetbrains-mono-latin-variable.woff2'))).toString('base64');

const escapeXml = (value) => String(value).replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character]);
const imageName = (path) => path === '/' ? 'home' : path.replace(/^\//, '').replaceAll('/', '--');

function lines(text, limit, maxLines) {
  const tokens = /[\u3400-\u9fff]/u.test(text) ? [...text] : text.split(/\s+/);
  const output = [];
  let line = '';
  for (const token of tokens) {
    const separator = /[\u3400-\u9fff]/u.test(text) ? '' : ' ';
    const next = line ? `${line}${separator}${token}` : token;
    if (next.length > limit && line) {
      output.push(line);
      line = token;
      if (output.length === maxLines - 1) break;
    } else line = next;
  }
  if (line && output.length < maxLines) output.push(line);
  const consumed = output.join(/[\u3400-\u9fff]/u.test(text) ? '' : ' ').length;
  if (consumed < text.length && output.length) output[output.length - 1] = `${output.at(-1).replace(/[\s,.;:·-]+$/u, '')}…`;
  return output;
}

for (const locale of locales) {
  const seo = new Map();
  for (const file of await readdir(join(root, `data/${locale}/seo`))) {
    const document = JSON.parse(await readFile(join(root, `data/${locale}/seo/${file}`), 'utf8'));
    for (const page of document.pages) seo.set(page.url_path, page);
  }
  const site = JSON.parse(await readFile(join(root, `data/${locale}/site.json`), 'utf8'));
  const tools = JSON.parse(await readFile(join(root, `data/${locale}/tools.json`), 'utf8'));
  const compliance = JSON.parse(await readFile(join(root, `data/${locale}/compliance.json`), 'utf8'));
  const outputDir = join(root, `public/og/${locale}`);
  await mkdir(outputDir, { recursive: true });

  for (const route of pages) {
    const page = route.url_path === '/' ? site.home_seo
      : route.url_path === '/contact' ? { title: site.contact.seo_title, description: site.contact.seo_description }
      : ['/about', '/privacy', '/cookies', '/terms'].includes(route.url_path) ? {
        title: compliance.pages[route.url_path.slice(1)].seo_title,
        description: compliance.pages[route.url_path.slice(1)].seo_description,
      }
      : route.url_path === '/tools' ? { title: tools.index.seo_title, description: tools.index.seo_description }
      : route.url_path === '/tools/achievement-completion' ? {
        title: tools.achievement_completion.seo_title,
        description: tools.achievement_completion.seo_description,
      } : seo.get(route.url_path);
    if (!page) throw new Error(`Missing ${locale} SEO for ${route.url_path}`);
    const titleLines = lines(page.title, locale === 'en' ? 34 : 23, 3);
    const descriptionLines = lines(page.description, locale === 'en' ? 74 : 42, 2);
    const titleSvg = titleLines.map((line, index) => `<text x="92" y="${218 + index * 72}" class="title">${escapeXml(line)}</text>`).join('');
    const descriptionSvg = descriptionLines.map((line, index) => `<text x="94" y="${474 + index * 30}" class="description">${escapeXml(line)}</text>`).join('');
    const routeLabel = route.url_path === '/' ? '/' : route.url_path;
    const entityLabel = route.entity === 'MapEntity' ? 'UNIT' : String(route.entity ?? 'DATABASE').toUpperCase();
    const svg = `
      <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
        <style>
          @font-face{font-family:SpaceGrotesk;src:url(data:font/woff2;base64,${displayFont}) format('woff2')}
          @font-face{font-family:JetBrainsMono;src:url(data:font/woff2;base64,${dataFont}) format('woff2')}
          .title{font:700 56px SpaceGrotesk,Arial,sans-serif;letter-spacing:-1.6px;fill:#dce4dd}
          .description,.data{font:500 20px JetBrainsMono,monospace;fill:#8a978c}
          .data{font-size:17px;letter-spacing:2px}.amber{fill:#ffb020}.olive{stroke:#4a5d45}.line{stroke:#2a332c}
        </style>
        <rect width="1200" height="630" fill="#0d1210"/>
        <path d="M0 78H1200M0 552H1200M62 0V630M1138 0V630" class="line" fill="none"/>
        <path d="M62 78h38M62 78v38M1138 78h-38M1138 78v38M62 552h38M62 552v-38M1138 552h-38M1138 552v-38" class="olive" stroke-width="3" fill="none"/>
        <g transform="translate(92 102)" stroke="#ffb020" stroke-width="2" fill="none">
          <circle cx="24" cy="24" r="18"/><circle cx="24" cy="24" r="6"/><path d="M24 0v12M24 36v12M0 24h12M36 24h12"/>
        </g>
        <text x="158" y="133" class="data amber">IRONNESTPEDIA // ${escapeXml(entityLabel)}</text>
        <text x="1108" y="133" text-anchor="end" class="data">${escapeXml(locale.toUpperCase())}</text>
        ${titleSvg}
        ${descriptionSvg}
        <text x="92" y="585" class="data amber">${route.entity === 'Contact' ? 'CONTACT · CORRECTIONS' : route.entity === 'Compliance' ? 'PUBLIC · SITE RECORD' : route.entity === 'Tool' ? 'LIVE · STEAM API · 33 ACHIEVEMENTS' : 'VERIFIED · DATAMINED · V4'}</text>
        <text x="1108" y="585" text-anchor="end" class="data">${escapeXml(routeLabel)}</text>
      </svg>`;
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(join(outputDir, `${imageName(route.url_path)}.png`));
  }
}

console.log(`Generated ${pages.length * locales.length} page-specific Open Graph PNG images (1200×630).`);
