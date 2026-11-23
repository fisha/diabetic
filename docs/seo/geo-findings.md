# GEO / SEO findings (23 Nov 2026)

Scope: the public pages of https://stedio.io as built from fisha/diabetic-web at the PM-462 branch. Method: code and
rendered-HTML review of a local production build. No engine answers were observed (site is noindex); nothing here
predicts rankings or citations.

## Fixed in PM-462

| # | Dimension | Finding | Severity | Fix |
|---|---|---|---|---|
| F1 | entity_consistency | Every page had the title "Stedio" or "<page> · Stedio"; the home page had no words saying what Stedio is in its title | important | Home title states the category in the site's own words; per-page descriptions |
| F2 | entity_consistency | No canonical links; the same pages answer on stedio.io, www.stedio.io, stedio-web.fly.dev and app.stedio.io | important | Canonical to stedio.io on every public page; www → apex 308 |
| F3 | evidence_traceability | No machine-readable statement of who publishes Stedio (legal entity, place, contact) | important | Organization JSON-LD from the footer/legal facts; llms.txt names Stedio Ltd and hello@stedio.io |
| F4 | citation_suitability | No llms.txt, no Markdown versions; the FAQ answers render in collapsed accordions | important | llms.txt, llms-full.txt, .md copies; FAQPage JSON-LD (answers are also in the HTML) |
| F5 | documented_engine_control | No sitemap; robots.txt had no sitemap line | important | sitemap.xml with hreflang; Sitemap line |
| F6 | citation_suitability | No share image or Open Graph data: links pasted in chats/social showed no preview | minor | OG/Twitter metadata + share image |
| F7 | documented_engine_control | Opening the site later would have meant editing headers, meta and private areas by hand | important | One `INDEXING` switch; private areas noindex regardless |

## Open (need Guy or the live site)

| # | Finding | Owner | Why open |
|---|---|---|---|
| O1 | Cloudflare managed robots.txt / AI-crawler blocking. Checked 23 Nov 2026 20:38 UTC: robots.txt on stedio.io has no Cloudflare block and GPTBot gets 200. Re-check on launch day | done | — |
| O2 | The home page H1 "Less to carry, every day." says nothing an engine can match to diabetes or AI mentor; the eyebrow above it does | Guy (copy) | Visible copy change needs approval. Suggestion: keep the H1, the title/description already carry the category |
| O3 | Only one indexable content page (home). Engines answer "what is the best app for X" from pages that explain topics; Stedio has no "how it works with Dexcom / Libre / 780G", "for parents", "for clinics" pages | Guy (new pages need approval) | Biggest lever for AI answers after launch; propose a short page set when Guy wants it |
| O4 | No third-party sources about Stedio (App Store / Google Play listing, press, LinkedIn/Crunchbase company page). AI engines lean on independent sources for entity facts | Guy | Add `sameAs` links to Organization when these exist |
| O5 | `/` answers 307 to `/en`; the canonical home is https://stedio.io/en | engineering | Works; a root without /en would be cleaner but touches the whole routing. Revisit at launch |
| O6 | Privacy text (legal page, pre-existing) says general guidance "follows the Standards of Care of the ADA"; the regulatory-check skill lists that phrase as a marketing fail. It is mirrored, not added, by the .md copies | Guy / lawyer | Pre-existing legal wording; not changed here |
