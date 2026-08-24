import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const layoutPath = path.join(root, 'src/components/Layout.astro');
const stylesheetPath = path.join(root, 'src/styles/global.css');
const expectedBrand = 'IRON NEST';

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function localeFor(filePath) {
  const relative = path.relative(distDir, filePath).split(path.sep).join('/');
  if (relative === 'zh-cn.html' || relative.startsWith('zh-cn/')) return 'zh-cn';
  if (relative === 'zh-tw.html' || relative.startsWith('zh-tw/')) return 'zh-tw';
  return 'en';
}

function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

if (!fs.existsSync(distDir)) {
  throw new Error('dist/ is missing. Run npm run build before validating the header brand.');
}

const htmlFiles = walk(distDir).filter((filePath) => filePath.endsWith('.html'));
const counts = { en: 0, 'zh-cn': 0, 'zh-tw': 0 };
const failures = [];

for (const filePath of htmlFiles) {
  const html = fs.readFileSync(filePath, 'utf8');
  const brandMatches = [...html.matchAll(/<a\b(?=[^>]*\bclass="[^"]*\bbrand\b[^"]*")[^>]*>[\s\S]*?<\/a>/gi)];
  const relative = path.relative(distDir, filePath);

  if (brandMatches.length !== 1) {
    failures.push(`${relative}: expected exactly one header brand link, found ${brandMatches.length}`);
    continue;
  }

  const brandText = visibleText(brandMatches[0][0]);
  if (brandText !== expectedBrand) {
    failures.push(`${relative}: header brand is ${JSON.stringify(brandText)}, expected ${JSON.stringify(expectedBrand)}`);
    continue;
  }

  const locale = localeFor(filePath);
  const expectedHref = locale === 'en' ? '/' : `/${locale}`;
  const href = brandMatches[0][0].match(/\bhref="([^"]+)"/i)?.[1];
  if (href !== expectedHref) {
    failures.push(`${relative}: header brand href is ${JSON.stringify(href)}, expected ${JSON.stringify(expectedHref)}`);
    continue;
  }

  if (/brand[-_ ]subtitle/i.test(html)) {
    failures.push(`${relative}: unexpected header brand subtitle element`);
    continue;
  }

  counts[locale] += 1;
}

const layout = fs.readFileSync(layoutPath, 'utf8');
const stylesheet = fs.readFileSync(stylesheetPath, 'utf8');
const brandRule = stylesheet.match(/\.brand\s*\{([^}]+)\}/)?.[1] ?? '';

if (!layout.includes("const headerBrand = 'IRON NEST';")) {
  failures.push('Layout.astro: missing the shared header-only IRON NEST brand constant');
}
if (!layout.includes('<meta property="og:site_name" content={site.site_name} />')) {
  failures.push('Layout.astro: og:site_name no longer uses the separate site identity');
}
if (!brandRule.includes('white-space: nowrap')) {
  failures.push('global.css: .brand must use white-space: nowrap for narrow screens');
}

if (failures.length > 0) {
  console.error(JSON.stringify({
    status: 'FAIL',
    html_pages: htmlFiles.length,
    pages_by_locale: counts,
    failures,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'PASS',
  html_pages: htmlFiles.length,
  pages_by_locale: counts,
  header_brand: expectedBrand,
  subtitle_elements: 0,
  nowrap: true,
  preserved_site_identity_meta: true,
}, null, 2));
