import routesSource from '../../data/routes.json';
import placeholdersSource from '../../data/skeleton-placeholder-pages.json';
import linkingRules from '../../data/en/relations/linking-rules.json';
import enSite from '../../data/en/site.json';
import zhCnSite from '../../data/zh-cn/site.json';
import zhTwSite from '../../data/zh-tw/site.json';
import enHome from '../../data/en/home.json';
import zhCnHome from '../../data/zh-cn/home.json';
import zhTwHome from '../../data/zh-tw/home.json';
import enTools from '../../data/en/tools.json';
import zhCnTools from '../../data/zh-cn/tools.json';
import zhTwTools from '../../data/zh-tw/tools.json';
import enCompliance from '../../data/en/compliance.json';
import zhCnCompliance from '../../data/zh-cn/compliance.json';
import zhTwCompliance from '../../data/zh-tw/compliance.json';
import enPrivacy from '../../data/en/pages/privacy.json';
import enCookies from '../../data/en/pages/cookies.json';
import zhCnPrivacy from '../../data/zh-cn/pages/privacy.json';
import zhCnCookies from '../../data/zh-cn/pages/cookies.json';
import zhTwPrivacy from '../../data/zh-tw/pages/privacy.json';
import zhTwCookies from '../../data/zh-tw/pages/cookies.json';
import shells from '../../data/en/entities/shells.json';
import missions from '../../data/en/entities/missions.json';
import achievements from '../../data/en/entities/achievements.json';
import medals from '../../data/en/entities/medals.json';
import punchcards from '../../data/en/entities/punchcards.json';
import mutators from '../../data/en/entities/mutators.json';
import mapEntities from '../../data/en/entities/map-entities.json';
import enAchievementLabels from '../../data/en/entities/achievements.labels.json';
import enMapEntityLabels from '../../data/en/entities/map-entities.labels.json';
import enMedalLabels from '../../data/en/entities/medals.labels.json';
import enMissionLabels from '../../data/en/entities/missions.labels.json';
import enMutatorLabels from '../../data/en/entities/mutators.labels.json';
import enPunchcardLabels from '../../data/en/entities/punchcards.labels.json';
import zhCnAchievementLabels from '../../data/zh-cn/entities/achievements.labels.json';
import zhCnMapEntityLabels from '../../data/zh-cn/entities/map-entities.labels.json';
import zhCnMedalLabels from '../../data/zh-cn/entities/medals.labels.json';
import zhCnMissionLabels from '../../data/zh-cn/entities/missions.labels.json';
import zhCnMutatorLabels from '../../data/zh-cn/entities/mutators.labels.json';
import zhCnPunchcardLabels from '../../data/zh-cn/entities/punchcards.labels.json';
import zhTwAchievementLabels from '../../data/zh-tw/entities/achievements.labels.json';
import zhTwMapEntityLabels from '../../data/zh-tw/entities/map-entities.labels.json';
import zhTwMedalLabels from '../../data/zh-tw/entities/medals.labels.json';
import zhTwMissionLabels from '../../data/zh-tw/entities/missions.labels.json';
import zhTwMutatorLabels from '../../data/zh-tw/entities/mutators.labels.json';
import zhTwPunchcardLabels from '../../data/zh-tw/entities/punchcards.labels.json';
import achievementPercentages from '../../data/live/achievement-percentages.json';

export const localeCodes = ['en', 'zh-cn', 'zh-tw'] as const;
export type Locale = (typeof localeCodes)[number];
export type RouteEntry = (typeof routesSource.pages)[number];
export type GuideEntry = Record<string, any>;
type AnyRecord = GuideEntry;

export const routes = routesSource.pages as RouteEntry[];
export const routeMap = new Map(routes.map((route) => [route.url_path, route]));
export const placeholders = placeholdersSource.pages;

const sites: Record<Locale, AnyRecord> = { en: enSite, 'zh-cn': zhCnSite, 'zh-tw': zhTwSite };
const homes: Record<Locale, AnyRecord> = { en: enHome, 'zh-cn': zhCnHome, 'zh-tw': zhTwHome };
const tools: Record<Locale, AnyRecord> = { en: enTools, 'zh-cn': zhCnTools, 'zh-tw': zhTwTools };
const compliance: Record<Locale, AnyRecord> = {
  en: { ...enCompliance, pages: { ...enCompliance.pages, privacy: enPrivacy, cookies: enCookies } },
  'zh-cn': { ...zhCnCompliance, pages: { ...zhCnCompliance.pages, privacy: zhCnPrivacy, cookies: zhCnCookies } },
  'zh-tw': { ...zhTwCompliance, pages: { ...zhTwCompliance.pages, privacy: zhTwPrivacy, cookies: zhTwCookies } },
};
export const site = enSite;
export const getSite = (locale: Locale = 'en') => sites[locale];
export const getHome = (locale: Locale = 'en') => homes[locale];
export const getTools = (locale: Locale = 'en') => tools[locale];
export const getCompliance = (locale: Locale = 'en') => compliance[locale];

export function localizedPath(path: string, locale: Locale = 'en') {
  if (locale === 'en') return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

export function translate(locale: Locale, key: string, values: Record<string, string | number> = {}) {
  let text = String(getSite(locale).ui[key] ?? key);
  for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

export function entityName(entity: string, locale: Locale = 'en') {
  return getSite(locale).entity_names[entity] ?? entity;
}

export function fieldLabel(field: string, locale: Locale = 'en') {
  return getSite(locale).field_labels[field] ?? field;
}

const entities: Record<string, AnyRecord[]> = {
  Shell: shells, Mission: missions, Achievement: achievements, Medal: medals,
  Punchcard: punchcards, Mutator: mutators, MapEntity: mapEntities,
};

export function getDataScope() {
  const rows = Object.values(entities).flat();
  return {
    recordCount: rows.length,
    versions: [...new Set(rows.map((row) => String(row.game_version)).filter(Boolean))],
    sources: [...new Set(rows.map((row) => String(row.data_source)).filter(Boolean))],
  };
}
const idFields: Record<string, string> = {
  Shell: 'ShellId', Mission: 'id', Achievement: 'name', Medal: 'id', Punchcard: 'ID', Mutator: 'displayName', MapEntity: 'ID',
};
const labels: Record<Locale, Record<string, AnyRecord>> = {
  en: { Achievement: enAchievementLabels, MapEntity: enMapEntityLabels, Medal: enMedalLabels, Mission: enMissionLabels, Mutator: enMutatorLabels, Punchcard: enPunchcardLabels },
  'zh-cn': { Achievement: zhCnAchievementLabels, MapEntity: zhCnMapEntityLabels, Medal: zhCnMedalLabels, Mission: zhCnMissionLabels, Mutator: zhCnMutatorLabels, Punchcard: zhCnPunchcardLabels },
  'zh-tw': { Achievement: zhTwAchievementLabels, MapEntity: zhTwMapEntityLabels, Medal: zhTwMedalLabels, Mission: zhTwMissionLabels, Mutator: zhTwMutatorLabels, Punchcard: zhTwPunchcardLabels },
};

const seoModules = import.meta.glob('../../data/{en,zh-cn,zh-tw}/seo/*.json', { eager: true }) as Record<string, { default: { pages: AnyRecord[] } }>;
const seoMaps = Object.fromEntries(localeCodes.map((locale) => [locale, new Map<string, AnyRecord>()])) as Record<Locale, Map<string, AnyRecord>>;
for (const [file, module] of Object.entries(seoModules)) {
  const locale = localeCodes.find((code) => file.includes(`/data/${code}/seo/`));
  if (!locale) continue;
  for (const page of module.default.pages) seoMaps[locale].set(page.url_path, page);
}

export function getSeo(path: string, locale: Locale = 'en') {
  return seoMaps[locale].get(path) ?? {
    title: `${path === '/' ? 'IronNestPedia' : path.split('/').filter(Boolean).at(-1)} | IronNestPedia`,
    description: getSite(locale).data_note,
    primary_keyword: '', keyword_candidates: [],
  };
}

const guideModules = import.meta.glob('../../data/{en,zh-cn,zh-tw}/guides/*.json', { eager: true }) as Record<string, { default: GuideEntry }>;
const guideMaps = Object.fromEntries(localeCodes.map((locale) => [locale, new Map<string, GuideEntry>()])) as Record<Locale, Map<string, GuideEntry>>;
for (const [file, module] of Object.entries(guideModules)) {
  const locale = localeCodes.find((code) => file.includes(`/data/${code}/guides/`));
  if (!locale) continue;
  guideMaps[locale].set(module.default.url_path, module.default);
}

export const guidePaths = [...guideMaps.en.keys()].sort();
export function getGuide(path: string, locale: Locale = 'en') {
  return guideMaps[locale].get(path);
}
export function getGuidesForSource(path: string, locale: Locale = 'en') {
  return [...guideMaps[locale].values()].filter((guide) => guide.inbound_from.includes(path));
}

function rowsForIds(entity: string, ids: string[]) {
  const idField = idFields[entity];
  return (entities[entity] ?? []).filter((row) => ids.includes(String(row[idField])));
}

export function getPrimaryRows(route: RouteEntry): AnyRecord[] {
  if (route.page_type === 'index') return getIndexRows(route);
  const filterIds = (route as any).data_source?.filter?.ID_in as string[] | undefined;
  if (filterIds?.length) return rowsForIds(route.entity, filterIds);
  if (route.source_record_id) return rowsForIds(route.entity, [route.source_record_id]);
  return [];
}

export function getIndexRows(route: RouteEntry): AnyRecord[] {
  const allRows = entities[route.entity] ?? [];
  const childRoutes = routes.filter((candidate) => candidate.entity === route.entity && candidate.page_type === 'data_entity');
  if (childRoutes.length) {
    const ids = childRoutes.flatMap((child: any) => child.data_source?.filter?.ID_in ?? [child.source_record_id]);
    const rows = rowsForIds(route.entity, ids.filter(Boolean));
    return route.entity === 'Shell' ? allRows : rows;
  }
  if (route.entity === 'Medal') {
    const ids = new Set(routes.flatMap((candidate: any) =>
      (candidate.embedded_data_sources ?? [])
        .filter((source: any) => source.file.endsWith('/medals.json'))
        .flatMap((source: any) => source.source_record_ids ?? []),
    ));
    return allRows.filter((row) => ids.has(row.id));
  }
  if (route.entity === 'Punchcard') return allRows.filter((row) => row.ID !== 'TESTING' && !row.ID.endsWith('Demo'));
  if (route.entity === 'Mutator') {
    const seen = new Set<string>();
    return allRows.filter((row) => {
      const key = JSON.stringify([row.displayName, row.description, row.tier]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return allRows;
}

export function getEmbeddedRows(route: RouteEntry) {
  return ((route as any).embedded_data_sources ?? []).map((source: AnyRecord) => {
    const entity = source.file.includes('medals') ? 'Medal'
      : source.file.includes('map-entities') ? 'MapEntity'
      : source.file.includes('achievements') ? 'Achievement'
      : source.file.includes('punchcards') ? 'Punchcard' : '';
    let rows = entities[entity] ?? [];
    if (source.source_record_ids) rows = rowsForIds(entity, source.source_record_ids);
    if (source.filter) {
      const match = String(source.filter).match(/^missionRef == "([^"]+)"$/);
      rows = match ? rows.filter((row) => row.missionRef === match[1]) : [];
    }
    return { source, entity, rows };
  });
}

function mutatorKey(row: AnyRecord) { return `${row.displayName}::${row.description}`; }

export function localizeRows(rows: AnyRecord[], entity: string, locale: Locale = 'en') {
  const dictionary = labels[locale][entity] ?? {};
  return rows.map((row) => {
    const output = { ...row };
    if (entity === 'MapEntity') output.Name = dictionary[row.Name]?.displayName ?? row.Name;
    if (entity === 'Medal') {
      output['displayNameV2.Key'] = dictionary[row.id]?.displayName ?? row['displayNameV2.Key'];
      output['hintTextV2.Key'] = dictionary[row.id]?.hintText ?? row['hintTextV2.Key'];
    }
    if (entity === 'Punchcard') {
      output['Title.Key'] = dictionary[row.ID]?.title ?? row['Title.Key'];
      output['Description.Key'] = dictionary[row.ID]?.description ?? row['Description.Key'];
    }
    if (entity === 'Mission') {
      output.displayName = dictionary[row.id]?.displayName ?? row.displayName;
      output.location = dictionary[row.id]?.location ?? row.location;
    }
    if (entity === 'Achievement') {
      output.displayName = dictionary[row.name]?.displayName ?? row.displayName;
      output.description = dictionary[row.name]?.description ?? row.description;
    }
    if (entity === 'Mutator') {
      output.displayName = dictionary[mutatorKey(row)]?.displayName ?? row.displayName;
      output.description = dictionary[mutatorKey(row)]?.description ?? row.description;
    }
    return output;
  });
}

export function getAchievementLabels(locale: Locale = 'en') {
  return labels[locale].Achievement;
}

function routeRows(route: RouteEntry) { return route.page_type === 'data_entity' ? getPrimaryRows(route) : []; }

export function getRelatedRoutes(route: RouteEntry): RouteEntry[] {
  const paths = new Set<string>((route as any).internal_link_candidates ?? []);
  if (route.entity === 'Shell' && route.page_type === 'data_entity') {
    routes.filter((candidate) => candidate.entity === 'Shell' && candidate.page_type === 'data_entity').forEach((candidate) => paths.add(candidate.url_path));
  }
  if (route.entity === 'Achievement' && route.page_type === 'data_entity') {
    const missionRefs = new Set(routeRows(route).map((row) => row.missionRef));
    routes.filter((candidate) => candidate.entity === 'Achievement' && candidate.page_type === 'data_entity')
      .filter((candidate) => routeRows(candidate).some((row) => missionRefs.has(row.missionRef)))
      .forEach((candidate) => paths.add(candidate.url_path));
  }
  if (route.entity === 'MapEntity' && route.page_type === 'data_entity') {
    const missionRefs = new Set(routeRows(route).map((row) => row.missionRef));
    routes.filter((candidate) => candidate.entity === 'MapEntity' && candidate.page_type === 'data_entity')
      .filter((candidate) => routeRows(candidate).some((row) => missionRefs.has(row.missionRef)))
      .forEach((candidate) => paths.add(candidate.url_path));
  }
  const reciprocalFix = linkingRules.fixes.find((fix) => fix.id === 4);
  if (Array.isArray(reciprocalFix?.applies_to) && reciprocalFix.applies_to.includes(route.url_path)) {
    reciprocalFix.applies_to.filter((path) => path !== route.url_path).forEach((path) => paths.add(path));
  }
  paths.delete(route.url_path);
  return [...paths].map((path) => routeMap.get(path)).filter(Boolean) as RouteEntry[];
}

export function labelForRoute(route: RouteEntry, locale: Locale = 'en') {
  const seo = getSeo(route.url_path, locale);
  return seo.primary_keyword || seo.title || route.url_path;
}

const achievementPercentageMap = new Map(
  achievementPercentages.raw_response.achievementpercentages.achievements.map((item) => [item.name, Number(item.percent)]),
);

export function getAchievementPercentage(name: string) {
  return achievementPercentageMap.get(name);
}

export function missionDisplayName(id: string, locale: Locale = 'en') {
  return String(labels[locale].Mission?.[id]?.displayName ?? id).replace(/\s+/g, ' ').trim();
}

export function getOfficialNamesForRoute(route: RouteEntry, locale: Locale = 'en') {
  if (route.entity !== 'MapEntity') return [];
  const statementKeys = [...String((route as any).unique_value_statement ?? '').matchAll(/STR_ENTITYNAME_[A-Z_]+/g)]
    .map((match) => match[0]);
  const rowKeys = getPrimaryRows(route).map((row) => String(row.Name ?? '')).filter(Boolean);
  const keys = [...new Set(statementKeys.length ? statementKeys : rowKeys)];
  return [...new Set(keys.map((key) => labels[locale].MapEntity?.[key]?.displayName ?? key))];
}

type Readout = { label: string; value: string };

function formatMetric(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '0';
  return String(value);
}

function numericRange(values: unknown[]) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (!numbers.length) return '—';
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  return min === max ? String(min) : `${min}–${max}`;
}

export function getEntityReadouts(route: RouteEntry, locale: Locale = 'en'): Readout[] {
  const sourceRows = getPrimaryRows(route);
  const rows = localizeRows(sourceRows, route.entity, locale);
  const row = rows[0] ?? {};
  if (route.entity === 'Shell') {
    const chargeValues = Object.values(row.charge_N_maxRange ?? {});
    const punchcard = getEmbeddedRows(route).find((group) => group.entity === 'Punchcard')?.rows?.[0];
    return [
      { label: fieldLabel('Damage', locale), value: formatMetric(row.Damage) },
      { label: translate(locale, 'maximum_range'), value: numericRange(chargeValues) },
      { label: fieldLabel('ImpactRadius', locale), value: formatMetric(row.ImpactRadius) },
      { label: fieldLabel('ShellSpeed', locale), value: formatMetric(row.ShellSpeed) },
      { label: translate(locale, 'requisition_cost'), value: formatMetric(punchcard?.Cost) },
    ];
  }
  if (route.entity === 'Mission') {
    const embedded = getEmbeddedRows(route);
    const targets = embedded.find((group) => group.entity === 'MapEntity')?.rows.length ?? 0;
    const achievementsCount = embedded.find((group) => group.entity === 'Achievement')?.rows.length ?? 0;
    return [
      { label: fieldLabel('location', locale), value: formatMetric(row.location) },
      { label: translate(locale, 'prerequisites'), value: formatMetric(row.unlockedBy?.length ?? 0) },
      { label: translate(locale, 'following_missions'), value: formatMetric(row.unlocks?.length ?? 0) },
      { label: translate(locale, 'medal_slots'), value: formatMetric(row.medalRefs?.length ?? 0) },
      { label: translate(locale, 'mission_targets'), value: formatMetric(targets) },
      { label: entityName('Achievement', locale), value: formatMetric(achievementsCount) },
    ];
  }
  if (route.entity === 'Achievement') {
    const percentage = getAchievementPercentage(String(row.name));
    return [
      { label: fieldLabel('type', locale), value: formatMetric(row.type) },
      { label: entityName('Mission', locale), value: missionDisplayName(String(row.missionRef), locale) },
      { label: translate(locale, 'steam_completion'), value: percentage === undefined ? '—' : `${percentage}%` },
      { label: fieldLabel('hidden', locale), value: formatMetric(row.hidden) },
    ];
  }
  if (route.entity === 'MapEntity') {
    const names = getOfficialNamesForRoute(route, locale);
    return [
      { label: translate(locale, 'official_names'), value: names.join(' / ') },
      { label: translate(locale, 'source_records'), value: formatMetric(rows.length) },
      { label: translate(locale, 'mission_appearances'), value: formatMetric(new Set(sourceRows.map((item) => item.missionRef)).size) },
      { label: fieldLabel('Role', locale), value: [...new Set(rows.map((item) => item.Role))].join(' / ') },
      { label: fieldLabel('Armour', locale), value: numericRange(rows.map((item) => item.Armour)) },
      { label: fieldLabel('Health', locale), value: numericRange(rows.map((item) => item.Health)) },
    ];
  }
  return [];
}

export function ogImagePath(path: string, locale: Locale = 'en') {
  const slug = path === '/' ? 'home' : path.replace(/^\//, '').replaceAll('/', '--');
  return `/og/${locale}/${slug}.png`;
}

export function pathForPrefix(prefix: string) {
  return routes.filter((route) => route.url_path.startsWith(`/${prefix}/`) && route.page_type === 'data_entity');
}
