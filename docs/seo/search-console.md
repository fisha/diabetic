# Search Console, Bing and launch checklist (PM-462)

## Now (site still noindex)

1. **Google Search Console, Domain property `stedio.io`** (covers apex, www, app., api.). Verify with the DNS TXT
   record Google gives (`google-site-verification=…`) in Cloudflare DNS, zone stedio.io. Console change: Guy.
   (Alternative: URL-prefix property https://stedio.io/ with the HTML tag: set `GOOGLE_SITE_VERIFICATION` at build.)
2. Add the Claude-assisted account as a user (Guy said he would), at least "Full" to read reports and submit sitemaps.
3. **Do not submit the sitemap yet** (optional either way: Google would list the URLs as "Excluded by noindex",
   which is expected and harmless). Submitting on launch day gives a clean first crawl.
4. **Bing Webmaster Tools**: import the site from Search Console (one click after step 1). Bing's index feeds
   ChatGPT search and Copilot answers.
5. **Cloudflare check** (O1, checked 23 Nov 2026: no managed block, GPTBot gets 200; re-check at launch): Security → Bots / AI Crawl Control: make sure "Block AI bots" / "managed
   robots.txt" is off, or set to allow search/answer crawlers (OAI-SearchBot, ChatGPT-User, PerplexityBot,
   Claude-SearchBot, Googlebot, Bingbot). Whether training crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot) are
   allowed is Guy's choice; today robots.txt allows everyone.

## Launch day (when Guy says the site may be indexed)

1. PR: `INDEXING = true` in `apps/web/src/seo/site.ts` and update `test/seo.test.ts`; deploy web.
2. Check live: `curl -sI https://stedio.io/en` has no X-Robots-Tag; page meta says index; `/en/dashboard` and `/app`
   still say noindex; `https://stedio.io/robots.txt` is ours (no Cloudflare additions).
3. Search Console: submit `https://stedio.io/sitemap.xml`; URL Inspection → Request indexing for /en.
4. Bing: submit the sitemap; optional IndexNow.
5. Rich results test (https://search.google.com/test/rich-results) on /en: Organization, FAQ parse without errors.
6. After 1–2 weeks: Search Console Pages report, queries; ask ChatGPT/Gemini/Perplexity "what is Stedio" and record
   dated answers (monitoring, not a guarantee).
