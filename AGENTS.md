# IronNestPedia project instructions

## Source-of-truth order

1. Project task specifications and structured files under `../gametest/project-data/iron-nest/`.
2. Current official documentation for frameworks, search, advertising, and deployment services.
3. Third-party tools and tutorials only when they do not conflict with the two sources above.

Do not infer route groupings, entity merges, record filters, or SEO copy from raw records. `data/routes.json` is the route and join authority, and the migrated files under `data/` are the website build inputs.

## Tool positioning and triggers

| Tool or reference | Role | Required trigger | Guardrail |
|---|---|---|---|
| Context7 | Current library/framework documentation | Query before writing or changing unfamiliar framework/library APIs, especially Astro configuration, integrations, and `getStaticPaths()` | Treat as a development documentation tool, not an SEO tool |
| `adsense-site-auditor` | AdSense readiness and policy audit | Run after core pages are complete, before launch, and before applying for AdSense | Google official documentation wins on conflict; compare the local external skill with upstream before use and ask the owner before updating |
| `web-analytics-agent-skill` | Search/analytics data retrieval for later monitoring | Use only for the step 32 monitoring workflow after a small-scope validation | Not on the critical path until validated |
| OpenCodeReview.ai | Optional code review | Use only when explicitly useful | Unverified and never on the critical path |
| Local SEO specification | Project SEO rules | Consult whenever code or content affects URLs, indexing, metadata, internal links, compliance, or deployment | See `../gametest/游戏资讯站流程v2.md`, section `# 附录 A · 规范库` |
| English writing specification | Anti-generic writing rules for game database/wiki copy | Consult for every English title, description, OG field, label, or prose change | See `../gametest/04-英文写作skill基础版.md` and the project terminology file referenced by config |

## Official documentation baselines

- At project start, before a new page type launches, and before SEO copy templates are finalized, fetch the current Google Search Central helpful-content guidance: <https://developers.google.com/search/docs/fundamentals/creating-helpful-content>. Do not answer from a stale snapshot.
- For AdSense eligibility, policy, restrictions, privacy, or ad-serving decisions, refresh and follow the current official Google AdSense and Google Publisher documentation. The checklist links are maintained in Appendix A-7 and in the `adsense-site-auditor` skill.

## Project-specific implementation constraints

- Keep game facts, routes/joins, SEO copy, and relations in separate JSON inputs. Join them at build time.
- Generate dynamic paths only from `data/routes.json`, never by enumerating raw entity records.
- Preserve the approved no-trailing-slash URL set. Canonicals, sitemap entries, navigation, and internal links must agree.
- Both page-matrix tool placeholders and skeleton placeholder pages are `noindex,follow` and excluded from the sitemap.
- Implement relationship links from verified data fields and `data/en/relations/linking-rules.json`; do not invent categories or hard-code a precomputed final graph.
- Do not publish extracted game art. Use data, text, and original site assets only.
- English database pages should prefer exact labels, tables, lists, and numbers over marketing prose. Avoid the banned phrases in the writing specification and back-translate new prose to reject empty wording.
