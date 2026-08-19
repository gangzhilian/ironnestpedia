#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const locales = ['en', 'zh-cn', 'zh-tw'];
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const writeJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
const routes = (await readJson(join(root, 'data/routes.json'))).pages;
const entities = {
  Shell: await readJson(join(root, 'data/en/entities/shells.json')),
  Mission: await readJson(join(root, 'data/en/entities/missions.json')),
  Achievement: await readJson(join(root, 'data/en/entities/achievements.json')),
  MapEntity: await readJson(join(root, 'data/en/entities/map-entities.json')),
  Punchcard: await readJson(join(root, 'data/en/entities/punchcards.json')),
};
const live = await readJson(join(root, 'data/live/achievement-percentages.json'));
const percentages = new Map(live.raw_response.achievementpercentages.achievements.map((item) => [item.name, Number(item.percent)]));
const idFields = { Shell: 'ShellId', Mission: 'id', Achievement: 'name', MapEntity: 'ID', Punchcard: 'ID' };
const fileFor = { Shell: 'shells.json', Mission: 'missions.json', Achievement: 'achievements.json', MapEntity: 'units.json' };

function rowsFor(route, entity = route.entity) {
  const ids = route.data_source?.filter?.ID_in ?? [route.source_record_id];
  return (entities[entity] ?? []).filter((row) => ids.includes(row[idFields[entity]]));
}

function embeddedRows(route, entity) {
  const source = route.embedded_data_sources?.find((item) => item.file.includes(entity === 'Punchcard' ? 'punchcards' : entity === 'MapEntity' ? 'map-entities' : entity.toLowerCase()));
  if (!source) return [];
  if (source.source_record_ids) return entities[entity].filter((row) => source.source_record_ids.includes(row[idFields[entity]]));
  const mission = String(source.filter ?? '').match(/^missionRef == "([^"]+)"$/)?.[1];
  return mission ? entities[entity].filter((row) => row.missionRef === mission) : [];
}

function labelSets(locale) {
  return Promise.all(['missions', 'achievements', 'map-entities'].map((name) => readJson(join(root, `data/${locale}/entities/${name}.labels.json`))))
    .then(([Mission, Achievement, MapEntity]) => ({ Mission, Achievement, MapEntity }));
}

function format(value) { return value === null || value === undefined || value === '' ? '—' : String(value); }
function range(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return '—';
  return Math.min(...nums) === Math.max(...nums) ? String(nums[0]) : `${Math.min(...nums)}–${Math.max(...nums)}`;
}

const missionTargetFrequency = new Map();
for (const route of routes.filter((item) => item.entity === 'Mission' && item.page_type === 'data_entity')) {
  const count = embeddedRows(route, 'MapEntity').length;
  missionTargetFrequency.set(count, (missionTargetFrequency.get(count) ?? 0) + 1);
}

function localizedLabel(route, labels, locale) {
  if (route.entity === 'Shell') return route.source_record_id;
  if (route.entity === 'Mission') return String(labels.Mission[route.source_record_id]?.displayName ?? route.source_record_id).replace(/\s+/g, ' ').trim();
  if (route.entity === 'Achievement') return String(labels.Achievement[route.source_record_id]?.displayName ?? route.source_record_id).replace(/\s+/g, ' ').trim();
  const rows = rowsFor(route);
  const preferred = rows.find((row) => String(labels.MapEntity[row.Name]?.displayName ?? '').toLowerCase() === String(route.source_record_id).toLowerCase()) ?? rows[0];
  return String(labels.MapEntity[preferred?.Name]?.displayName ?? route.source_record_id).replace(/\s+/g, ' ').trim();
}

function officialNames(route, labels) {
  const statementKeys = [...String(route.unique_value_statement ?? '').matchAll(/STR_ENTITYNAME_[A-Z_]+/g)].map((match) => match[0]);
  const keys = [...new Set(statementKeys.length ? statementKeys : rowsFor(route).map((row) => row.Name).filter(Boolean))];
  return [...new Set(keys.map((key) => labels.MapEntity[key]?.displayName ?? key))];
}

function officialKeyCount(route) {
  const statementKeys = [...String(route.unique_value_statement ?? '').matchAll(/STR_ENTITYNAME_[A-Z_]+/g)].map((match) => match[0]);
  return new Set(statementKeys.length ? statementKeys : rowsFor(route).map((row) => row.Name).filter(Boolean)).size;
}

function shellSeo(route, label, locale) {
  const row = rowsFor(route)[0];
  const punchcard = embeddedRows(route, 'Punchcard')[0];
  const maxRange = Math.max(...Object.values(row.charge_N_maxRange));
  const facts = { damage: format(row.Damage), radius: format(row.ImpactRadius), maxRange, speed: format(row.ShellSpeed), cost: format(punchcard?.Cost) };
  if (locale === 'en') return {
    title: `${label} Shell: ${facts.damage} DMG · ${facts.radius} Blast · Req ${facts.cost} | IRON NEST`,
    description: `${label} shell data records ${facts.damage} damage, ${facts.radius} impact radius, ${facts.speed} speed, a ${facts.maxRange} maximum charge range and requisition cost ${facts.cost}, with the full charge table.`,
    primary_keyword: `IRON NEST ${label} shell`, keyword_candidates: [`${label} shell damage`, `${label} shell range`, `${label} requisition cost`],
  };
  if (locale === 'zh-cn') return {
    title: `IRON NEST ${label}炮弹：${facts.damage}伤害、${facts.radius}爆炸半径、征用${facts.cost}`,
    description: `${label}炮弹实录数据：伤害${facts.damage}、爆炸半径${facts.radius}、速度${facts.speed}、最大装药射程${facts.maxRange}、征用花费${facts.cost}，并列出完整装药射程表。`,
    primary_keyword: `IRON NEST ${label}炮弹`, keyword_candidates: [`${label}炮弹伤害`, `${label}炮弹射程`, `${label}征用花费`],
  };
  return {
    title: `IRON NEST ${label}炮彈：${facts.damage}傷害、${facts.radius}爆炸半徑、徵用${facts.cost}`,
    description: `${label}炮彈實錄資料：傷害${facts.damage}、爆炸半徑${facts.radius}、速度${facts.speed}、最大裝藥射程${facts.maxRange}、徵用花費${facts.cost}，並列出完整裝藥射程表。`,
    primary_keyword: `IRON NEST ${label}炮彈`, keyword_candidates: [`${label}炮彈傷害`, `${label}炮彈射程`, `${label}徵用花費`],
  };
}

function missionSeo(route, label, labels, locale) {
  const row = rowsFor(route)[0];
  const targets = embeddedRows(route, 'MapEntity').length;
  const medals = row.medalRefs?.length ?? 0;
  const previous = row.unlockedBy?.length ?? 0;
  const next = row.unlocks?.length ?? 0;
  const location = labels.Mission[route.source_record_id]?.location || row.location || '—';
  const locationQualifier = missionTargetFrequency.get(targets) > 1 ? ` · ${location}` : '';
  if (locale === 'en') return {
    title: `${label} Mission: ${targets} Targets${locationQualifier} · ${medals} Medals | IRON NEST`,
    description: `${label}: ${targets} target records at ${location}, ${medals} medal slots, ${previous} prerequisites, ${next} follow-ups and linked achievements, with verified source fields.`,
    primary_keyword: `IRON NEST ${label} mission`, keyword_candidates: [`${label} mission targets`, `${label} medals`, `${label} mission order`],
  };
  if (locale === 'zh-cn') return {
    title: `IRON NEST“${label}”任务：${targets}个目标${locationQualifier}、${medals}个勋章`,
    description: `“${label}”任务数据包括${location}的${targets}条生成目标记录、${medals}个勋章槽、${previous}个前置任务和${next}个后续任务，并列出关联成就。`,
    primary_keyword: `IRON NEST ${label}任务`, keyword_candidates: [`${label}任务目标`, `${label}勋章`, `${label}任务顺序`],
  };
  return {
    title: `IRON NEST「${label}」任務：${targets}個目標${locationQualifier}、${medals}個勳章`,
    description: `「${label}」任務資料包含${location}的${targets}筆生成目標記錄、${medals}個勳章欄位、${previous}個前置任務及${next}個後續任務，並列出相關成就。`,
    primary_keyword: `IRON NEST ${label}任務`, keyword_candidates: [`${label}任務目標`, `${label}勳章`, `${label}任務順序`],
  };
}

function achievementSeo(route, label, labels, locale) {
  const row = rowsFor(route)[0];
  const mission = String(labels.Mission[row.missionRef]?.displayName ?? row.missionRef).replace(/\s+/g, ' ').trim();
  const percent = percentages.get(row.name);
  if (locale === 'en') return {
    title: `${label}: ${row.type} ${mission} · ${percent}% Steam | IRON NEST`,
    description: `${label}: ${row.type} achievement for ${mission}, with its official unlock text, a ${percent}% Steam global completion snapshot, version and source metadata.`,
    primary_keyword: `IRON NEST ${label} achievement`, keyword_candidates: [`${label} unlock`, `${mission} ${row.type} achievement`, `${label} Steam percentage`],
  };
  if (locale === 'zh-cn') return {
    title: `IRON NEST“${label}”成就：${mission} ${row.type}、Steam ${percent}%`,
    description: `“${label}”是关联“${mission}”任务的${row.type}成就；页面列出官方解锁说明、Steam全球完成率快照${percent}%以及数据来源信息。`,
    primary_keyword: `IRON NEST ${label}成就`, keyword_candidates: [`${label}解锁条件`, `${mission}${row.type}成就`, `${label}Steam完成率`],
  };
  return {
    title: `IRON NEST「${label}」成就：${mission} ${row.type}、Steam ${percent}%`,
    description: `「${label}」是關聯「${mission}」任務的${row.type}成就；頁面列出官方解鎖說明、Steam全球完成率快照${percent}%及資料來源資訊。`,
    primary_keyword: `IRON NEST ${label}成就`, keyword_candidates: [`${label}解鎖條件`, `${mission}${row.type}成就`, `${label}Steam完成率`],
  };
}

function mapEntitySeo(route, label, labels, locale) {
  const rows = rowsFor(route);
  const names = officialNames(route, labels);
  const nameText = names.join(' / ');
  const keyCount = officialKeyCount(route);
  const missions = new Set(rows.map((row) => row.missionRef)).size;
  const armour = range(rows.map((row) => row.Armour));
  const health = range(rows.map((row) => row.Health));
  const id = route.source_record_id;
  const mixedNameSuffix = keyCount > 1
    ? locale === 'en' ? ` [${keyCount} locale keys]`
      : locale === 'zh-cn' ? ` [${keyCount}个本地化键]`
        : ` [${keyCount}個本地化鍵]`
    : '';
  if (locale === 'en') return {
    title: `${label}${mixedNameSuffix}: ${rows.length} Records · ID ${id} | IRON NEST`,
    description: `${nameText}: ${rows.length} verified spawn records across ${missions} missions; health ${health}, armour ${armour}; stable ID ${id}.`,
    primary_keyword: `IRON NEST ${label} unit`, keyword_candidates: [`${label} armour`, `${label} mission appearances`, `${nameText} data`],
  };
  if (locale === 'zh-cn') return {
    title: `IRON NEST ${label}${mixedNameSuffix}：${rows.length}条记录、ID ${id}`,
    description: `${nameText}：合并${missions}个任务中的${rows.length}条已核实生成记录；生命值范围${health}、装甲范围${armour}；稳定ID为${id}。`,
    primary_keyword: `IRON NEST ${label}单位`, keyword_candidates: [`${label}装甲`, `${label}任务记录`, `${nameText}数据`],
  };
  return {
    title: `IRON NEST ${label}${mixedNameSuffix}：${rows.length}筆記錄、ID ${id}`,
    description: `${nameText}：合併${missions}個任務中的${rows.length}筆已核實生成記錄；生命值範圍${health}、裝甲範圍${armour}；穩定ID為${id}。`,
    primary_keyword: `IRON NEST ${label}單位`, keyword_candidates: [`${label}裝甲`, `${label}任務記錄`, `${nameText}資料`],
  };
}

for (const locale of locales) {
  const labels = await labelSets(locale);
  for (const entity of Object.keys(fileFor)) {
    const file = join(root, `data/${locale}/seo/${fileFor[entity]}`);
    const document = await readJson(file);
    document.pages = document.pages.map((page) => {
      const route = routes.find((item) => item.url_path === page.url_path);
      if (!route || route.page_type !== 'data_entity') return page;
      const label = localizedLabel(route, labels, locale);
      const generated = entity === 'Shell' ? shellSeo(route, label, locale)
        : entity === 'Mission' ? missionSeo(route, label, labels, locale)
        : entity === 'Achievement' ? achievementSeo(route, label, labels, locale)
        : mapEntitySeo(route, label, labels, locale);
      return { url_path: page.url_path, ...generated };
    });
    await writeJson(file, document);
  }
}

console.log('Step 23 meta generated for 288 localized entity pages.');
