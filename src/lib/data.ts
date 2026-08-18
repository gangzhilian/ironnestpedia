import routesSource from '../../data/routes.json';
import placeholdersSource from '../../data/skeleton-placeholder-pages.json';
import linkingRules from '../../data/en/relations/linking-rules.json';
import site from '../../data/en/site.json';
import shells from '../../data/en/entities/shells.json';
import missions from '../../data/en/entities/missions.json';
import achievements from '../../data/en/entities/achievements.json';
import medals from '../../data/en/entities/medals.json';
import punchcards from '../../data/en/entities/punchcards.json';
import mutators from '../../data/en/entities/mutators.json';
import mapEntities from '../../data/en/entities/map-entities.json';

export type RouteEntry = (typeof routesSource.pages)[number];
type AnyRecord = Record<string, any>;

export const routes = routesSource.pages as RouteEntry[];
export const routeMap = new Map(routes.map((route) => [route.url_path, route]));
export const placeholders = placeholdersSource.pages;
export { site };

const entities: Record<string, AnyRecord[]> = {
  Shell: shells,
  Mission: missions,
  Achievement: achievements,
  Medal: medals,
  Punchcard: punchcards,
  Mutator: mutators,
  MapEntity: mapEntities,
};

const idFields: Record<string, string> = {
  Shell: 'ShellId',
  Mission: 'id',
  Achievement: 'name',
  Medal: 'id',
  Punchcard: 'ID',
  Mutator: 'displayName',
  MapEntity: 'ID',
};

const seoModules = import.meta.glob('../../data/en/seo/*.json', { eager: true }) as Record<string, { default: { pages: AnyRecord[] } }>;
const seoPages = Object.values(seoModules).flatMap((module) => module.default.pages);
const seoMap = new Map(seoPages.map((page) => [page.url_path, page]));

export function getSeo(path: string) {
  return seoMap.get(path) ?? {
    title: `${path === '/' ? 'IronNestPedia' : path.split('/').filter(Boolean).at(-1)} | IronNestPedia`,
    description: site.data_note,
    primary_keyword: '',
  };
}

function rowsForIds(entity: string, ids: string[]) {
  const idField = idFields[entity];
  return (entities[entity] ?? []).filter((row) => ids.includes(String(row[idField])));
}

export function getPrimaryRows(route: RouteEntry): AnyRecord[] {
  const allRows = entities[route.entity] ?? [];
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
  if (route.entity === 'Punchcard') {
    return allRows.filter((row) => row.ID !== 'TESTING' && !row.ID.endsWith('Demo'));
  }
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

function routeRows(route: RouteEntry) {
  return route.page_type === 'data_entity' ? getPrimaryRows(route) : [];
}

export function getRelatedRoutes(route: RouteEntry): RouteEntry[] {
  const paths = new Set<string>((route as any).internal_link_candidates ?? []);

  if (route.entity === 'Shell' && route.page_type === 'data_entity') {
    routes.filter((candidate) => candidate.entity === 'Shell' && candidate.page_type === 'data_entity')
      .forEach((candidate) => paths.add(candidate.url_path));
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

export function labelForRoute(route: RouteEntry) {
  const seo = getSeo(route.url_path);
  return seo.primary_keyword || seo.title || route.url_path;
}

export function pathForPrefix(prefix: string) {
  return routes.filter((route) => route.url_path.startsWith(`/${prefix}/`) && route.page_type === 'data_entity');
}

