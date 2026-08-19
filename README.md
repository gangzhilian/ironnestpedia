# IronNestPedia

Astro static-site skeleton for <https://ironnestpedia.com>. The site is generated from the approved page matrix and migrated project data; route or entity classifications must not be inferred again from raw records.

## Local workflow

```sh
npm ci
npm run migrate
npm run verify
```

`npm run migrate` reads the research outputs from `../gametest/project-data/iron-nest/`, recreates the shared English fact inputs, and generates independent `en`, `zh-cn`, and `zh-tw` labels and SEO copy. `npm run verify` builds the production site and checks entity metadata, internal links, locale key parity, translated SEO fields, canonical/hreflang sets, redirects, and the 315-URL sitemap.

English uses the unprefixed route; Simplified and Traditional Chinese use `/zh-cn` and `/zh-tw`. All three languages share `data/routes.json` and `data/en/entities/*.json`; localized entity text lives only in each locale's `*.labels.json` files.

The compliance and guide/tool index pages are intentional `noindex,follow` skeleton placeholders in step 21. They are excluded from the sitemap until real content is supplied in later steps. No `ads.txt` is created until AdSense provides a real publisher ID.
