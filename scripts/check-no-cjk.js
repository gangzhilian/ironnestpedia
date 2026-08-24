#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const distRoot = join(projectRoot, 'dist');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const htmlFiles = walk(distRoot).filter((file) => {
  if (!file.endsWith('.html')) return false;
  const relativePath = relative(distRoot, file).split('/').join('/');
  return relativePath !== 'zh-cn.html' && relativePath !== 'zh-tw.html'
    && !relativePath.startsWith('zh-cn/') && !relativePath.startsWith('zh-tw/');
});
const matches = htmlFiles.flatMap((file) => {
  // The English header intentionally names Chinese languages in their native
  // scripts. Remove only that known selector before scanning English content.
  const html = readFileSync(file, 'utf8').replace(/<div class="language-menu"[\s\S]*?<\/div><\/div>/i, '');
  const characters = html.match(/[一-鿿]/g) ?? [];
  return characters.length ? [{ file: relative(distRoot, file), cjk_characters: characters.length }] : [];
});

if (matches.length) {
  console.error(JSON.stringify({
    status: 'FAIL',
    english_html_pages: htmlFiles.length,
    files_with_cjk: matches.length,
    cjk_characters: matches.reduce((total, item) => total + item.cjk_characters, 0),
    matches,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'PASS',
  english_html_pages: htmlFiles.length,
  files_with_cjk: 0,
  cjk_characters: 0,
}, null, 2));
