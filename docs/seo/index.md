# Website search and AI-answer readiness (PM-462)

Guy, 23 Nov 2026: make https://stedio.io ready for search engines (Google, Bing) and AI answer engines (ChatGPT,
Gemini, Perplexity, Copilot, Claude), including llms.txt, and prepare Google Search Console. The site **stays
noindex, nofollow** until Guy says otherwise.

| Document | What it holds |
|---|---|
| [implementation.md](implementation.md) | What was built in `apps/web`, where, and the one switch that opens the site to search engines |
| [geo-findings.md](geo-findings.md) | Audit findings: entity consistency, sources, crawl controls, what is still open |
| [claim-source-map.md](claim-source-map.md) | Every fact the machine-readable copies state, and the site text it comes from |
| [search-console.md](search-console.md) | Google Search Console + Bing Webmaster setup, and the launch-day checklist |

Limitations: no live engine observations were taken (the site is noindex, so no engine can cite it yet), and the
container cannot reach stedio.io, so live checks of the Cloudflare edge (for example Cloudflare's own robots.txt or AI
crawler settings) are listed as open items, not results.
