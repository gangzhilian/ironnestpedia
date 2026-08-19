#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ID = 2950790;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(ROOT, '.env');
const ACHIEVEMENTS_FILE = path.join(ROOT, 'data/en/entities/achievements.json');
const SAMPLE_DIR = path.resolve(ROOT, '../gametest/project-data/iron-nest/06-api-samples');
const TIMEOUT_MS = 30_000;

function parseEnv(source) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return [];
    const separator = trimmed.indexOf('=');
    if (separator < 1) return [];
    return [[trimmed.slice(0, separator), trimmed.slice(separator + 1).trim()]];
  }));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = { non_json_body: bodyText.slice(0, 500) };
  }
  return { status: response.status, status_text: response.statusText, body };
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const env = parseEnv(await fs.readFile(ENV_FILE, 'utf8'));
if (!env.STEAM_API_KEY) throw new Error('STEAM_API_KEY is missing from .env');
if (!/^\d{17}$/.test(env.STEAM_PUBLIC_ID ?? '')) throw new Error('STEAM_PUBLIC_ID must be a 17-digit SteamID64');

const fetchedAt = new Date().toISOString();
const date = fetchedAt.slice(0, 10);
const globalUrl = new URL('https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/');
globalUrl.searchParams.set('gameid', String(APP_ID));
const playerUrl = new URL('https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/');
playerUrl.searchParams.set('key', env.STEAM_API_KEY);
playerUrl.searchParams.set('steamid', env.STEAM_PUBLIC_ID);
playerUrl.searchParams.set('appid', String(APP_ID));

const [globalResult, playerResult] = await Promise.all([fetchJson(globalUrl), fetchJson(playerUrl)]);
const globalRows = globalResult.body?.achievementpercentages?.achievements;
const playerRows = playerResult.body?.playerstats?.achievements;
if (globalResult.status !== 200 || !Array.isArray(globalRows)) throw new Error(`Unexpected global percentages response: HTTP ${globalResult.status}`);
if (playerResult.status !== 200 || playerResult.body?.playerstats?.success !== true || !Array.isArray(playerRows)) {
  throw new Error(`Unexpected public player response: HTTP ${playerResult.status}`);
}

const localAchievements = JSON.parse(await fs.readFile(ACHIEVEMENTS_FILE, 'utf8'));
const localKeys = localAchievements.map((row) => row.name).sort();
const playerKeys = playerRows.map((row) => row.apiname).sort();
const globalKeys = globalRows.map((row) => row.name).sort();
const localSet = new Set(localKeys);
const playerSet = new Set(playerKeys);
const globalSet = new Set(globalKeys);
const difference = (left, right) => left.filter((key) => !right.has(key));
const achievedCount = playerRows.filter((row) => Number(row.achieved) === 1).length;

const redactedPlayerBody = structuredClone(playerResult.body);
if (redactedPlayerBody?.playerstats?.steamID) redactedPlayerBody.playerstats.steamID = '[redacted: test account]';

await writeJson(path.join(SAMPLE_DIR, `get-global-achievement-percentages-live-${date}.json`), {
  endpoint: 'ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2',
  fetched_at: fetchedAt,
  appid: APP_ID,
  http_status: globalResult.status,
  raw_response: globalResult.body,
});
await writeJson(path.join(SAMPLE_DIR, `get-player-achievements-public-${date}.json`), {
  endpoint: 'ISteamUserStats/GetPlayerAchievements/v1',
  fetched_at: fetchedAt,
  appid: APP_ID,
  http_status: playerResult.status,
  privacy_case: 'game_details_public',
  redactions: ['playerstats.steamID'],
  raw_response: redactedPlayerBody,
});
await writeJson(path.join(SAMPLE_DIR, `step25-achievement-join-report-${date}.json`), {
  checked_at: fetchedAt,
  appid: APP_ID,
  local_achievement_count: localKeys.length,
  player_api_achievement_count: playerKeys.length,
  global_percentage_count: globalKeys.length,
  public_profile_achieved_count: achievedCount,
  public_profile_unachieved_count: playerRows.length - achievedCount,
  player_apiname_exact_match: difference(localKeys, playerSet).length === 0 && difference(playerKeys, localSet).length === 0,
  global_name_exact_match: difference(localKeys, globalSet).length === 0 && difference(globalKeys, localSet).length === 0,
  missing_from_player_api: difference(localKeys, playerSet),
  extra_in_player_api: difference(playerKeys, localSet),
  missing_from_global_api: difference(localKeys, globalSet),
  extra_in_global_api: difference(globalKeys, localSet),
  private_profile_test: {
    status: 'pending',
    reason: 'No real private-profile test account was available on 2026-08-19.',
  },
});

console.log(`Steam public-profile test passed: ${playerKeys.length} achievements, ${achievedCount} unlocked, ${playerRows.length - achievedCount} locked.`);
console.log(`apiname exact match: ${difference(localKeys, playerSet).length === 0 && difference(playerKeys, localSet).length === 0 ? 'PASS' : 'FAIL'}`);
console.log(`global percentage name exact match: ${difference(localKeys, globalSet).length === 0 && difference(globalKeys, localSet).length === 0 ? 'PASS' : 'FAIL'}`);
console.log(`Sanitized samples saved in ${SAMPLE_DIR}`);
