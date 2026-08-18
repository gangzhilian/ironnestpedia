#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(fileURLToPath(new URL('..', import.meta.url)));
const dataRoot = join(projectRoot, 'data');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const schema = readJson(join(dataRoot, 'schema.json'));
const routeSource = readJson(join(dataRoot, 'routes.json'));

const files = {
  Shell: 'shells.json',
  Mission: 'missions.json',
  Achievement: 'achievements.json',
  Medal: 'medals.json',
  Punchcard: 'punchcards.json',
  Mutator: 'mutators.json',
  MapEntity: 'map-entities.json',
};
const idFields = { Shell: 'ShellId', Mission: 'id', Achievement: 'name', Medal: 'id', Punchcard: 'ID', Mutator: 'displayName', MapEntity: 'ID' };
const errors = [];
const rowsByEntity = {};
let recordCount = 0;

for (const [entity, file] of Object.entries(files)) {
  const path = join(dataRoot, 'en', 'entities', file);
  const rows = readJson(path);
  rowsByEntity[entity] = rows;
  if (!Array.isArray(rows)) errors.push(`${file}: root must be an array`);
  for (const [index, row] of rows.entries()) {
    recordCount += 1;
    for (const field of schema.required_meta_fields) {
      if (!Object.hasOwn(row, field) || row[field] === null || row[field] === '') {
        errors.push(`${file}[${index}]: missing required meta field ${field}`);
      }
    }
  }
}

const routePaths = new Set();
for (const route of routeSource.pages) {
  if (routePaths.has(route.url_path)) errors.push(`duplicate route: ${route.url_path}`);
  routePaths.add(route.url_path);
  if (route.page_type !== 'data_entity') continue;
  const rows = rowsByEntity[route.entity] ?? [];
  const idField = idFields[route.entity];
  const ids = route.data_source?.filter?.ID_in ?? [route.source_record_id];
  const matches = rows.filter((row) => ids.includes(row[idField]));
  if (matches.length === 0) errors.push(`${route.url_path}: approved route join matched no ${route.entity} records`);
}

const seoFiles = readdirSync(join(dataRoot, 'en', 'seo')).filter((file) => file.endsWith('.json'));
const seoPages = seoFiles.flatMap((file) => readJson(join(dataRoot, 'en', 'seo', file)).pages);
const seoPaths = new Set(seoPages.map((page) => page.url_path));
for (const route of routeSource.pages.filter((page) => page.page_type !== 'tool_placeholder')) {
  if (!seoPaths.has(route.url_path)) errors.push(`${route.url_path}: missing SEO record`);
}

if (recordCount !== 452) errors.push(`entity record total ${recordCount}; expected 452`);
if (routeSource.pages.length !== 105) errors.push(`route total ${routeSource.pages.length}; expected 105`);
if (seoPages.length !== 104) errors.push(`SEO page total ${seoPages.length}; expected 104`);
const shellPages = routeSource.pages.filter((page) => page.entity === 'Shell' && page.page_type === 'data_entity');
if (shellPages.length !== 20 || shellPages.some((page) => page.source_record_id === 'EMPT')) {
  errors.push('Shell routes must contain exactly 20 player pages and exclude EMPT');
}

if (errors.length) {
  console.error(JSON.stringify({ status: 'FAIL', record_count: recordCount, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'PASS',
  entity_files: Object.keys(files).length,
  records: recordCount,
  required_meta_fields: schema.required_meta_fields,
  routes: routeSource.pages.length,
  seo_pages: seoPages.length,
  shell_data_pages: shellPages.length,
}, null, 2));

