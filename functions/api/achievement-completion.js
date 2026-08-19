const APP_ID = 2950790;
const STEAM_API = 'https://api.steampowered.com';
const TIMEOUT_MS = 12_000;

const responseHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

async function fetchSteam(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await response.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* Steam occasionally returns an empty or non-JSON error body. */ }
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

function parseSteamInput(value) {
  const input = String(value ?? '').trim();
  if (/^\d{17}$/.test(input)) return { steamId: input };
  if (!input || input.length > 240) return null;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  if (!['steamcommunity.com', 'www.steamcommunity.com'].includes(url.hostname.toLowerCase())) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0]?.toLowerCase() === 'profiles' && /^\d{17}$/.test(parts[1] ?? '')) return { steamId: parts[1] };
  if (parts[0]?.toLowerCase() === 'id' && /^[a-z0-9_-]{2,64}$/i.test(parts[1] ?? '')) return { vanity: parts[1] };
  return null;
}

async function resolveSteamId(parsed, apiKey) {
  if (parsed.steamId) return parsed.steamId;
  const url = new URL(`${STEAM_API}/ISteamUser/ResolveVanityURL/v1/`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('vanityurl', parsed.vanity);
  const result = await fetchSteam(url);
  if (!result.ok) throw new Error('resolve_failed');
  if (Number(result.body?.response?.success) !== 1 || !/^\d{17}$/.test(result.body?.response?.steamid ?? '')) return null;
  return result.body.response.steamid;
}

function profileFailure(playerResult) {
  const error = String(playerResult.body?.playerstats?.error ?? '').toLowerCase();
  const success = playerResult.body?.playerstats?.success;
  return playerResult.status === 500
    || playerResult.status === 403
    || success === false
    || error.includes('not public')
    || error.includes('private');
}

export async function onRequestPost(context) {
  const apiKey = context.env.STEAM_API_KEY;
  if (!apiKey) return json({ ok: false, code: 'service_not_configured' }, 503);

  const contentLength = Number(context.request.headers.get('content-length') ?? 0);
  if (contentLength > 2048) return json({ ok: false, code: 'invalid_input' }, 400);
  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ ok: false, code: 'invalid_input' }, 400);
  }

  const parsed = parseSteamInput(payload?.input);
  if (!parsed) return json({ ok: false, code: 'invalid_input' }, 400);

  let steamId;
  try {
    steamId = await resolveSteamId(parsed, apiKey);
  } catch {
    return json({ ok: false, code: 'steam_unavailable' }, 502);
  }
  if (!steamId) return json({ ok: false, code: 'profile_not_found' }, 404);

  const playerUrl = new URL(`${STEAM_API}/ISteamUserStats/GetPlayerAchievements/v1/`);
  playerUrl.searchParams.set('key', apiKey);
  playerUrl.searchParams.set('steamid', steamId);
  playerUrl.searchParams.set('appid', String(APP_ID));
  const globalUrl = new URL(`${STEAM_API}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/`);
  globalUrl.searchParams.set('gameid', String(APP_ID));

  let playerResult;
  let globalResult;
  try {
    [playerResult, globalResult] = await Promise.all([fetchSteam(playerUrl), fetchSteam(globalUrl)]);
  } catch {
    return json({ ok: false, code: 'steam_unavailable' }, 502);
  }

  if (profileFailure(playerResult)) return json({ ok: false, code: 'profile_unavailable' }, 422);
  const playerRows = playerResult.body?.playerstats?.achievements;
  if (!playerResult.ok || playerResult.body?.playerstats?.success !== true || !Array.isArray(playerRows)) {
    return json({ ok: false, code: 'steam_unavailable' }, 502);
  }
  const globalRows = globalResult.body?.achievementpercentages?.achievements;
  if (!globalResult.ok || !Array.isArray(globalRows)) return json({ ok: false, code: 'steam_unavailable' }, 502);

  const globalByName = new Map(globalRows.map((row) => [row.name, Number(row.percent)]));
  const achievements = playerRows.map((row) => ({
    apiname: String(row.apiname),
    achieved: Number(row.achieved) === 1,
    unlocktime: Number(row.unlocktime) || 0,
    globalPercent: globalByName.has(row.apiname) ? globalByName.get(row.apiname) : null,
  }));
  if (achievements.some((row) => row.globalPercent === null)) return json({ ok: false, code: 'data_mismatch' }, 502);

  return json({
    ok: true,
    fetchedAt: new Date().toISOString(),
    achievements,
  });
}

export function onRequest() {
  return json({ ok: false, code: 'method_not_allowed' }, 405);
}
