#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');

const APPID = 2950790;
const ENDPOINT = `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2?gameid=${APPID}`;
const OUTPUT_FILE = path.resolve(__dirname, '../14-live-data/achievement-percentages.json');
const TIMEOUT_MS = 30_000;

function validateResponse(rawResponse) {
  const achievements = rawResponse?.achievementpercentages?.achievements;
  if (!Array.isArray(achievements)) {
    throw new Error('Unexpected Steam response: achievementpercentages.achievements is not an array');
  }

  for (const [index, achievement] of achievements.entries()) {
    if (typeof achievement?.name !== 'string'
      || !['string', 'number'].includes(typeof achievement?.percent)) {
      throw new Error(`Unexpected Steam response: invalid achievement at index ${index}`);
    }
  }
}

async function writeSnapshot(snapshot) {
  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  const temporaryFile = `${OUTPUT_FILE}.tmp-${process.pid}`;
  try {
    await fs.writeFile(temporaryFile, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryFile, OUTPUT_FILE);
  } catch (error) {
    await fs.rm(temporaryFile, { force: true });
    throw error;
  }
}

async function main() {
  const response = await fetch(ENDPOINT, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Steam request failed: HTTP ${response.status} ${response.statusText}`);
  }

  let rawResponse;
  try {
    rawResponse = await response.json();
  } catch (error) {
    throw new Error(`Steam returned invalid JSON: ${error.message}`);
  }
  validateResponse(rawResponse);

  const snapshot = {
    endpoint: ENDPOINT,
    fetched_at: new Date().toISOString(),
    appid: APPID,
    raw_response: rawResponse,
  };
  await writeSnapshot(snapshot);
  process.stdout.write(`Saved ${snapshot.raw_response.achievementpercentages.achievements.length} achievement percentages to ${OUTPUT_FILE}\n`);
}

main().catch((error) => {
  process.stderr.write(`fetch-achievement-percentages failed: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});

