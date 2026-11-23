# What was built (PM-462)

All in `apps/web` (repository fisha/diabetic-web). Nothing visible on the pages changed: no new sections, no new copy.

## The switch

`src/seo/site.ts` → `INDEXING = false`. While it is false, every answer says `noindex, nofollow` (header and meta), as
since 14 Nov 2026. Setting it to `true` (one-line PR, Guy's go-ahead only):

- public pages send `index, follow, max-snippet:-1, max-image-preview:large` (meta) and no X-Robots-Tag header;
- `/app`, `/api`, `/<locale>/dashboard`, `/<locale>/clinic`, `/<locale>/get` keep `noindex, nofollow` in both the
  header and the meta tag, always (`PRIVATE_PATHS`, plus `robots` metadata in the dashboard and clinic layouts and the
  /get pages);
- robots.txt adds the `Host` line. Crawling is open for every crawler, search and AI alike, in both states.

`test/seo.test.ts` fails if `INDEXING` is turned on without changing the test, so the switch is a deliberate act.

## Metadata (every page)

- `metadataBase` https://stedio.io and a **canonical** link on each public page, so the copies on stedio-web.fly.dev
  and app.stedio.io point at stedio.io.
- Titles: home "Stedio: an AI mentor for people living with diabetes"; others "<page> · Stedio".
- Descriptions from the page's own words (home: `web.sub`; legal pages: the lead, cut at a sentence).
- Open Graph + X/Twitter large card with a share image `/en/opengraph-image` (brand mark, `web.h`, `web.eye`).
- Legal pages: `hreflang` en / he / x-default between /en/<page> and /he/<page>.
- `<link rel="alternate" type="text/markdown">` to the page's Markdown copy.
- Theme colour, `manifest.webmanifest`, `/logo.png` (512 px brand mark for the Organization logo).
- Optional Search Console / Bing HTML-tag verification from build env `GOOGLE_SITE_VERIFICATION` /
  `BING_SITE_VERIFICATION` (only if DNS verification is not used).

## Structured data (home page)

JSON-LD `@graph` in `src/seo/content.ts` `homeJsonLd()`: Organization (Stedio Ltd, Tel Aviv, hello@stedio.io, logo),
WebSite, WebPage, MobileApplication (HealthApplication, iOS + Android, en + he, screenshots) and FAQPage (the four
questions on the page). Deliberately absent: prices/offers (no prices while on the waiting list), ratings, and any
medical schema type (Stedio is not a medical device).

## For AI engines

- `/llms.txt` (llmstxt.org format): what Stedio is, key facts, common questions, links to Markdown pages.
- `/llms-full.txt`: all English public pages in one Markdown file.
- Markdown copy of each public page at its address + `.md`: `/en.md`, `/en/demo.md`, `/en/privacy.md`,
  `/en/terms.md`, `/en/accessibility.md`, `/he/privacy.md`, `/he/terms.md`, `/he/accessibility.md`. Each answers with
  `Link: <html page>; rel="canonical"` so search engines show the HTML page, not the copy.
- All of it is generated from the same catalog strings and legal texts the pages render, so the copies can never say
  something the site does not.

## Sitemap and hosts

- `/sitemap.xml`: /en, /en/demo and the six legal pages (with hreflang). Not listed: app, dashboard, clinic, /get.
- `robots.txt`: `Allow: /` for all + `Sitemap: https://stedio.io/sitemap.xml`.
- `www.stedio.io` pages now 308 to `stedio.io` (one address per page).
