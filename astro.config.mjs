import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const routes = JSON.parse(readFileSync(new URL('./data/routes.json', import.meta.url), 'utf8'));
const skeleton = JSON.parse(readFileSync(new URL('./data/skeleton-placeholder-pages.json', import.meta.url), 'utf8'));
const noindexPaths = new Set([
  ...routes.pages.filter((page) => page.page_type === 'tool_placeholder').map((page) => page.url_path),
  ...skeleton.pages.map((page) => page.url_path),
  '/404',
]);

export default defineConfig({
  site: 'https://ironnestpedia.com',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [
    sitemap({
      filter: (page) => {
        const pathname = new URL(page).pathname.replace(/\/$/, '') || '/';
        const basePath = pathname.replace(/^\/(?:zh-cn|zh-tw)(?=\/|$)/, '') || '/';
        return !noindexPaths.has(basePath);
      },
    }),
  ],
});
