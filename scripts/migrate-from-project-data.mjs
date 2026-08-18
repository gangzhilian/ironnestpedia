#!/usr/bin/env node

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(projectRoot, '..', 'gametest', 'project-data', 'iron-nest');
const dataRoot = join(projectRoot, 'data');

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};
const copyJson = async (source, target) => {
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target);
};

await mkdir(join(dataRoot, 'en', 'entities'), { recursive: true });
await mkdir(join(dataRoot, 'en', 'seo'), { recursive: true });
await mkdir(join(dataRoot, 'en', 'relations'), { recursive: true });
await mkdir(join(dataRoot, 'live'), { recursive: true });

await copyJson(join(sourceRoot, '16-page-matrix.json'), join(dataRoot, 'routes.json'));
await copyJson(join(sourceRoot, '18-homepage-structure.json'), join(dataRoot, 'en', 'home.json'));
await copyJson(join(sourceRoot, '20-guide-topics.json'), join(dataRoot, 'en', 'guide-topics-reference.json'));
await copyJson(join(sourceRoot, '19-linking-rules.json'), join(dataRoot, 'en', 'relations', 'linking-rules.json'));

for (const file of [
  'shells.json', 'missions.json', 'achievements.json', 'medals.json',
  'punchcards.json', 'mutators.json', 'map-entities.json',
]) {
  await copyJson(join(sourceRoot, '13-clean', file), join(dataRoot, 'en', 'entities', file));
}

for (const file of ['achievement-percentages.json', 'news.json']) {
  await copyJson(join(sourceRoot, '14-live-data', file), join(dataRoot, 'live', file));
}

const schema = await readJson(join(sourceRoot, '11-schema.json'));
await writeJson(join(dataRoot, 'schema.json'), {
  entities: schema.entities,
  relations: schema.relations,
  required_meta_fields: schema.required_meta_fields,
});

const keywordSource = await readJson(join(sourceRoot, '17-keywords.json'));
const seoPageFields = [
  'url_path',
  'primary_keyword',
  'keyword_candidates',
  'title',
  'description',
];
const pickSeoPageFields = (page) => Object.fromEntries(
  seoPageFields
    .filter((field) => Object.hasOwn(page, field))
    .map((field) => [field, page[field]]),
);
const groups = new Map();
for (const page of keywordSource.pages) {
  const prefix = page.url_path.split('/').filter(Boolean)[0] || 'home';
  if (!groups.has(prefix)) groups.set(prefix, []);
  groups.get(prefix).push(pickSeoPageFields(page));
}
for (const [prefix, pages] of groups) {
  await writeJson(join(dataRoot, 'en', 'seo', `${prefix}.json`), {
    source: keywordSource.source,
    updated_at: keywordSource.updated_at,
    game: keywordSource.game,
    pages,
  });
}

for (const file of ['fetch-achievement-percentages.js', 'fetch-news.js']) {
  await cp(join(sourceRoot, '14-scripts', file), join(projectRoot, 'scripts', file));
}

console.log(JSON.stringify({
  status: 'PASS',
  routes: (await readJson(join(dataRoot, 'routes.json'))).pages.length,
  seo_pages: keywordSource.pages.length,
  entity_files: 7,
  live_files: 2,
}, null, 2));
