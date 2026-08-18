# IronNestPedia

Astro static-site skeleton for <https://ironnestpedia.com>. The site is generated from the approved page matrix and migrated project data; route or entity classifications must not be inferred again from raw records.

## Local workflow

```sh
npm ci
npm run migrate
npm run verify
```

`npm run migrate` reads the research outputs from `../gametest/project-data/iron-nest/` and recreates the website `data/` inputs. `npm run verify` builds the production site, validates required entity metadata, and audits inbound links from the built HTML.

The compliance and guide/tool index pages are intentional `noindex,follow` skeleton placeholders in step 21. They are excluded from the sitemap until real content is supplied in later steps. No `ads.txt` is created until AdSense provides a real publisher ID.

