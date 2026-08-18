#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');

const APPID = 2950790;
const ENDPOINT = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2?appid=${APPID}&count=20&maxlength=0`;
const OUTPUT_FILE = path.resolve(__dirname, '../14-live-data/news.json');
const TIMEOUT_MS = 30_000;

function validateResponse(rawResponse) {
  const appNews = rawResponse?.appnews;
  if (!appNews || Number(appNews.appid) !== APPID || !Array.isArray(appNews.newsitems)) {
    throw new Error('Unexpected Steam response: expected appnews.appid and appnews.newsitems[]');
  }

  for (const [index, item] of appNews.newsitems.entries()) {
    if (typeof item?.gid !== 'string' || typeof item?.title !== 'string' || !Number.isInteger(item?.date)) {
      throw new Error(`Unexpected Steam response: invalid news item at index ${index}`);
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

  // Keep contents/tags/HTML/BBCode exactly as Steam returned them. This snapshot
  // is only a new-announcement trigger; diffing and article generation belong to step 34.
  const snapshot = {
    endpoint: ENDPOINT,
    fetched_at: new Date().toISOString(),
    appid: APPID,
    raw_response: rawResponse,
  };
  await writeSnapshot(snapshot);
  process.stdout.write(`Saved ${snapshot.raw_response.appnews.newsitems.length} news items to ${OUTPUT_FILE}\n`);
}

main().catch((error) => {
  process.stderr.write(`fetch-news failed: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});

