#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');
const sampleDir = join(root, '..', 'gametest', 'project-data', 'iron-nest', '06-api-samples');
const origin = 'https://ironnestpedia.com';
const locales = ['en', 'zh-cn', 'zh-tw'];
const basePaths = ['/tools', '/tools/achievement-completion'];
const localizedPath = (path, locale) => locale === 'en' ? path : path === '/' ? `/${locale}` : `/${locale}${path}`;
const errors = [];

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
function latestSample(prefix) {
  const file = readdirSync(sampleDir).filter((name) => name.startsWith(prefix) && name.endsWith('.json')).sort().at(-1);
  return file ? JSON.parse(readFileSync(join(sampleDir, file), 'utf8')) : null;
}
function recursiveKeys(value, prefix = '') {
  if (Array.isArray(value)) return value.flatMap((item, index) => recursiveKeys(item, `${prefix}[${index}]`));
  if (!value || typeof value !== 'object') return [prefix];
  return Object.keys(value).flatMap((key) => recursiveKeys(value[key], prefix ? `${prefix}.${key}` : key));
}

const htmlFiles = walk(dist).filter((file) => file.endsWith('.html'));
const htmlByRoute = new Map(htmlFiles.map((file) => [fileToRoute(file), readFileSync(file, 'utf8')]));
const toolCopies = Object.fromEntries(locales.map((locale) => [locale, JSON.parse(readFileSync(join(root, 'data', locale, 'tools.json'), 'utf8'))]));
const expectedCopyKeys = recursiveKeys(toolCopies.en).sort();
for (const locale of locales) {
  const keys = recursiveKeys(toolCopies[locale]).sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedCopyKeys)) errors.push(`${locale}: tools copy key structure differs from en`);
  if (locale !== 'en') {
    for (const section of ['index', 'achievement_completion']) {
      if (toolCopies[locale][section].seo_title === toolCopies.en[section].seo_title) errors.push(`${locale}:${section} title was not translated`);
      if (toolCopies[locale][section].seo_description === toolCopies.en[section].seo_description) errors.push(`${locale}:${section} description was not translated`);
    }
  }

  for (const basePath of basePaths) {
    const path = localizedPath(basePath, locale);
    const html = htmlByRoute.get(path) ?? '';
    if (!html) { errors.push(`${path}: built HTML missing`); continue; }
    if (/name="robots" content="noindex/i.test(html)) errors.push(`${path}: published tool is noindex`);
    if (!html.includes(`<link rel="canonical" href="${origin}${path}">`)) errors.push(`${path}: canonical mismatch`);
    if (!html.includes('application/ld+json')) errors.push(`${path}: structured data missing`);
    if (!html.includes(`/og/${locale}/tools${basePath === '/tools' ? '' : '--achievement-completion'}.png`)) errors.push(`${path}: dedicated OG image missing`);
    for (const target of locales) {
      const targetPath = localizedPath(basePath, target);
      if (!html.includes(`hreflang="${target === 'en' ? 'en' : target === 'zh-cn' ? 'zh-CN' : 'zh-TW'}" href="${origin}${targetPath}"`)) errors.push(`${path}: ${target} hreflang missing`);
    }
  }

  const detailPath = localizedPath('/tools/achievement-completion', locale);
  const detail = htmlByRoute.get(detailPath) ?? '';
  for (const expected of ['id="achievement-checker"', 'id="steam-profile-input"', '/api/achievement-completion', 'WebApplication']) {
    if (!detail.includes(expected)) errors.push(`${detailPath}: missing ${expected}`);
  }
  if ((detail.match(/ACHIEVEMENT_[A-Z0-9_]+/g) ?? []).filter((value, index, all) => all.indexOf(value) === index).length !== 33) errors.push(`${detailPath}: expected 33 localized achievement keys in page payload`);
  if (!detail.includes(toolCopies[locale].achievement_completion.profile_unavailable.replaceAll('&', '&amp;'))) errors.push(`${detailPath}: private-profile guidance missing`);
  if (!detail.includes(toolCopies[locale].achievement_completion.tutorial_heading)) errors.push(`${detailPath}: tutorial missing`);
  for (const faq of toolCopies[locale].achievement_completion.faq) if (!detail.includes(faq.question)) errors.push(`${detailPath}: FAQ question missing: ${faq.question}`);

  for (const sourcePath of ['/', '/achievements']) {
    if (!htmlByRoute.get(localizedPath(sourcePath, locale))?.includes(`href="${detailPath}"`)) errors.push(`${locale}:${sourcePath} does not link to achievement tool`);
  }
}

for (const [path, html] of htmlByRoute) {
  const locale = path === '/zh-cn' || path.startsWith('/zh-cn/') ? 'zh-cn' : path === '/zh-tw' || path.startsWith('/zh-tw/') ? 'zh-tw' : 'en';
  if (!html.includes(`class="footer-tools" href="${localizedPath('/tools', locale)}"`)) errors.push(`${path}: localized footer Tools link missing`);
}

const sitemapUrls = new Set();
for (const file of walk(dist).filter((file) => /sitemap.*\.xml$/.test(file))) {
  for (const match of readFileSync(file, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapUrls.add(new URL(match[1]).pathname.replace(/\/$/, '') || '/');
}
for (const locale of locales) for (const path of basePaths) if (!sitemapUrls.has(localizedPath(path, locale))) errors.push(`${locale}${path}: missing from sitemap`);
for (const locale of locales) if (sitemapUrls.has(localizedPath('/tools/mission-map', locale))) errors.push(`${locale}: mission-map placeholder leaked into sitemap`);

const functionSource = readFileSync(join(root, 'functions', 'api', 'achievement-completion.js'), 'utf8');
for (const expected of ['context.env.STEAM_API_KEY', 'GetPlayerAchievements/v1', 'GetGlobalAchievementPercentagesForApp/v2', 'ResolveVanityURL/v1', "playerResult.status === 500", "code: 'profile_unavailable'"]) {
  if (!functionSource.includes(expected)) errors.push(`Pages Function missing ${expected}`);
}
if (!functionSource.includes('.sort(') && !readFileSync(join(root, 'src', 'components', 'AchievementCompletionTool.astro'), 'utf8').includes('.sort(byRarity)')) errors.push('rarest-first sort missing');

const { onRequestPost } = await import('../functions/api/achievement-completion.js');
const originalFetch = globalThis.fetch;
let privateErrorMocksHandled = 0;
for (const playerResponse of [
  new Response(JSON.stringify({ playerstats: { error: 'Profile is not public', success: false } }), { status: 500 }),
  new Response(JSON.stringify({ playerstats: { error: 'Profile is not public', success: false } }), { status: 200 }),
]) {
  globalThis.fetch = async (url) => String(url).includes('GetPlayerAchievements')
    ? playerResponse.clone()
    : new Response(JSON.stringify({ achievementpercentages: { achievements: [] } }), { status: 200 });
  const result = await onRequestPost({
    env: { STEAM_API_KEY: 'test-only-key' },
    request: new Request('https://example.test/api/achievement-completion', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: '76561198000000000' }),
    }),
  });
  const resultBody = await result.json();
  if (result.status === 422 && resultBody.code === 'profile_unavailable') privateErrorMocksHandled += 1;
}
globalThis.fetch = originalFetch;
if (privateErrorMocksHandled !== 2) errors.push(`private-profile mock handling passed ${privateErrorMocksHandled}/2 cases`);

const publicSample = latestSample('get-player-achievements-public-');
const globalSample = latestSample('get-global-achievement-percentages-live-');
const joinReport = latestSample('step25-achievement-join-report-');
if (publicSample?.http_status !== 200 || publicSample?.raw_response?.playerstats?.success !== true || publicSample?.raw_response?.playerstats?.achievements?.length !== 33) errors.push('public GetPlayerAchievements sample is missing or invalid');
if (globalSample?.http_status !== 200 || globalSample?.raw_response?.achievementpercentages?.achievements?.length !== 33) errors.push('live global percentage sample is missing or invalid');
if (joinReport?.player_apiname_exact_match !== true || joinReport?.global_name_exact_match !== true) errors.push('achievement key join report did not pass');
if (joinReport?.private_profile_test?.status !== 'pending') errors.push('private-profile test must remain explicitly pending');

const envText = readFileSync(join(root, '.env'), 'utf8');
const apiKey = envText.match(/^STEAM_API_KEY=(.+)$/m)?.[1]?.trim();
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
if (tracked.includes('.env')) errors.push('.env is tracked by Git');
if (!readFileSync(join(root, '.gitignore'), 'utf8').split(/\r?\n/).includes('.env')) errors.push('.env is not ignored');
if (apiKey && tracked.some((file) => existsSync(join(root, file)) && statSync(join(root, file)).isFile() && readFileSync(join(root, file)).includes(apiKey))) errors.push('Steam API key leaked into a tracked file');

if (!/\.tool-input-row\s*\{\s*grid-template-columns:\s*1fr;/s.test(readFileSync(join(root, 'src', 'styles', 'global.css'), 'utf8'))) errors.push('mobile single-column tool form rule missing');
if (htmlByRoute.has('/tools/patch-notes') || htmlByRoute.has('/tools/player-count')) errors.push('out-of-scope tool page was built');

console.log(JSON.stringify({
  status: errors.length ? 'FAIL' : 'PASS',
  published_tool_urls: basePaths.length * locales.length,
  localized_achievement_keys: 33,
  sitemap_tool_urls: basePaths.length * locales.length,
  public_api_sample_achievements: publicSample?.raw_response?.playerstats?.achievements?.length ?? 0,
  public_profile_unlocked: joinReport?.public_profile_achieved_count ?? null,
  public_profile_locked: joinReport?.public_profile_unachieved_count ?? null,
  apiname_exact_match: joinReport?.player_apiname_exact_match ?? false,
  global_name_exact_match: joinReport?.global_name_exact_match ?? false,
  private_profile_test: joinReport?.private_profile_test?.status ?? 'missing',
  private_profile_mock_cases_handled: privateErrorMocksHandled,
  errors: errors.slice(0, 50),
}, null, 2));
if (errors.length) process.exitCode = 1;
