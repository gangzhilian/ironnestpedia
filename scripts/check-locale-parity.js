#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const dataRoot = join(projectRoot, 'data');
const translatedLocales = ['zh-cn', 'zh-tw'];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function localizableFiles(locale) {
  const root = join(dataRoot, locale);
  return walk(root)
    .map((file) => relative(root, file).split(sep).join('/'))
    .filter((file) => file === 'site.json' || file === 'home.json' || file.startsWith('seo/') || file.startsWith('guides/') || /^entities\/[^/]+\.labels\.json$/.test(file))
    .sort();
}

function keyShape(value) {
  if (Array.isArray(value)) return ['array', value.length, value.map(keyShape)];
  if (value && typeof value === 'object') {
    return ['object', Object.keys(value).sort().map((key) => [key, keyShape(value[key])])];
  }
  return ['value'];
}

const errors = [];
const sourceFiles = localizableFiles('en');
const sourceData = new Map();
for (const file of sourceFiles) {
  sourceData.set(file, JSON.parse(readFileSync(join(dataRoot, 'en', file), 'utf8')));
}

let seoPagesChecked = 0;
let labelsChecked = 0;
let guidesChecked = 0;
for (const locale of translatedLocales) {
  const files = localizableFiles(locale);
  if (JSON.stringify(files) !== JSON.stringify(sourceFiles)) {
    errors.push(`${locale}: localizable file set differs from en; expected=${JSON.stringify(sourceFiles)}, actual=${JSON.stringify(files)}`);
  }
  for (const file of sourceFiles) {
    const targetPath = join(dataRoot, locale, file);
    let target;
    try {
      target = JSON.parse(readFileSync(targetPath, 'utf8'));
    } catch (error) {
      errors.push(`${locale}/${file}: cannot parse JSON: ${error.message}`);
      continue;
    }
    const source = sourceData.get(file);
    if (JSON.stringify(keyShape(target)) !== JSON.stringify(keyShape(source))) {
      errors.push(`${locale}/${file}: recursive JSON key/array structure differs from en`);
    }
    if (file.startsWith('seo/')) {
      const sourceByPath = new Map(source.pages.map((page) => [page.url_path, page]));
      for (const page of target.pages) {
        seoPagesChecked += 1;
        const en = sourceByPath.get(page.url_path);
        if (!en) errors.push(`${locale}/${file}: unexpected SEO path ${page.url_path}`);
        for (const field of ['title', 'description']) {
          if (!String(page[field] ?? '').trim()) errors.push(`${locale}${page.url_path}: ${field} is empty`);
          if (page[field] === en?.[field]) errors.push(`${locale}${page.url_path}: ${field} is byte-for-byte identical to en`);
        }
      }
    }
    if (file.startsWith('guides/')) {
      guidesChecked += 1;
      for (const field of ['seo_title', 'seo_description', 'h1']) {
        if (!String(target[field] ?? '').trim()) errors.push(`${locale}/${file}: ${field} is empty`);
        if (target[field] === source?.[field]) errors.push(`${locale}/${file}: ${field} is byte-for-byte identical to en`);
      }
      if (target.url_path !== source?.url_path) errors.push(`${locale}/${file}: url_path differs from en`);
    }
    if (file.endsWith('.labels.json')) {
      labelsChecked += Object.keys(target).length;
      for (const [id, labels] of Object.entries(target)) {
        for (const [field, value] of Object.entries(labels)) {
          if (typeof value !== 'string') errors.push(`${locale}/${file} ${id}.${field}: label must be a string`);
        }
      }
    }
  }
}

if (errors.length) {
  console.error(JSON.stringify({ status: 'FAIL', errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'PASS',
  locales: ['en', ...translatedLocales],
  localizable_files_per_locale: sourceFiles.length,
  seo_pages_checked: seoPagesChecked,
  translated_labels_checked: labelsChecked,
  translated_guides_checked: guidesChecked,
  identical_translated_seo_fields: 0,
}, null, 2));
