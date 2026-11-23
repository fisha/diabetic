# Claim → source map (machine-readable copies, PM-462)

Every statement in llms.txt, the .md copies and the JSON-LD is a catalog string or legal text that the HTML pages
show. Catalog: `packages/i18n/messages/en.json`. Generator: `apps/web/src/seo/content.ts`.

| Claim (as machine-readable) | Where | Source string | Shown on |
|---|---|---|---|
| Stedio is a calm AI mentor you can talk to… | llms.txt summary, meta description, WebSite/MobileApplication description | `web.sub` | meta description (all pages) |
| For people living with diabetes | llms.txt, home title, audience | `web.eye` | home hero eyebrow |
| AI mentor; not a medical device; no insulin doses; doesn't replace alarms/care team | llms.txt key facts, .md footer | `web.disclaimer` | footer, every page |
| Never recommends insulin doses or changes treatment; devices read-only | llms.txt, .md | `web.c_safe_b` | home "A mentor, not a doctor" |
| Free, small group, waiting list | llms.txt, .md | `web.free_b`, `web.free_hero` | home plan section, hero |
| Supported devices list | llms.txt, .md | `DEVICES` (shared constant) | home devices card |
| Four FAQ answers | llms.txt, .md, FAQPage | `web.q1..q4`, `web.a1..a4` | home Questions |
| Clinic features | home .md | `web.cl_*` | home For clinic teams |
| Stedio Ltd, Tel Aviv, Israel | llms.txt, Organization | `web.foot_co`; privacy "Who we are" | footer, privacy |
| hello@stedio.io | llms.txt, Organization | privacy "Who we are" | privacy, terms |
| English and Hebrew | llms.txt, MobileApplication.inLanguage | `web.a3` | home Questions |
| Legal texts | /en|he/<page>.md | `apps/web/src/legal/texts/*.ts` | the legal pages |
| HealthApplication, iOS + Android | MobileApplication | store category; /get guides | — (schema category only, no claim) |

Rule for later changes: change the catalog or legal text, never the generator's wording. A new fact in llms.txt needs a
visible source on the site first.
