# Progress

## Current stage

**Stages 3 to 6 built; waiting on Guy's accounts, keys and devices.** On 11 Nov 2026 Guy asked to build the whole app
without stopping and to ask for everything needed at the end ("תפתח את כל האפליקציה בלי לעצור… ובסוף… תבקש ממני את
כל מה שאתה צריך ממני"). Every slice below is built and verified in the container. None of it has run on Guy's Mac
or on a phone yet, and the outside providers (OpenAI, USDA, Expo push, Apple Health, Health Connect, billing) are
verified only against test stand-ins or not at all. See `docs/integration-status.md`.

27 Nov 2026 (Jira epic PM-613, thread "Review Itay's clinic area feedback"): Itay's nine clinic-area points are
PM-614..622; Guy goes through them one by one before anything is built. PM-620 fixed (web #122, merged): clinic dates
took day/month order from the page language, so Itay (Israel, English portal) saw visit dates month first. They now
follow the browser region; month first only for a US region in an American time zone. Live (web v134). PM-614 (Guy approved the mockup): "Choose dates" beside the quick periods on Data, Meals and
Measurements, up to a year back, held across the three tabs (API #298 `period=first..last`, web #124). Meals keep
the 62-day journal limit. Live (API v227, web v136). PM-615 (Guy approved the mockup): Data tab section "Largest
glucose rises": the 5 largest rises (lowest to highest within 3 h, overlaps once) with what was logged from 1 h before
(shared parts only) and the curve on tap (API #299 `patterns.rises`, web #125). PM-616 (Guy approved the mockup):
the Meals tab shows the glucose rise beside each meal (3 largest tinted) and the meal panel shows at the meal / highest /
back in range with the curve, by the app's and the visit report's rule (`meal_response`), only with the glucose
permission (API #300 `after`, web #126). Next: API deploy, then web.

27 Nov 2026 (Jira PM-607, thread "Fix clinic login signing out repeatedly"): Guy said the clinic login kept
signing out. The clinic dashboard kept its session in page memory only, so a reload, a new tab, the English/Hebrew
switch (a full page load, since `[locale]/layout.tsx` is the root layout), coming back from "My app" and every deploy
sent the clinician back to sign-in. The production logs agree: each handoff came 6-10 s after a refused refresh. Fixed
(API #293, web #121, merged): `X-Steady-Session: clinic` keeps the refresh token in its own HttpOnly cookie
`steady_clinic_session`, separate from the website's. Each clinic token lasts 65 min from its refresh, and the
dashboard refreshes every 5 min while in use, so the 1-hour idle sign-out also holds on the server. Refreshes are
serialised across tabs, sign-out reaches every tab, and the cookie policy lists the cookie. Sign-out and reuse
detection stamp only open rows (revocation counts were inflated), and refused refreshes log a reason. Verified
locally end to end. Next: deploy API, then web. Open item PM-608: the privacy policy's stale "sign-in kept only in
the open page" line goes into the next batched privacy version.

27 Nov 2026 (Jira PM-606 and PM-605): Guy reported that Itay's personal data vanished from the iPhone app after Itay
was made a clinic doctor. His data is intact (read-only counts from the server). He has not worn a sensor since 23 Nov,
so the Overview, with no glucose in the last 24 hours, showed the first-day "Connect a device" screen. That screen hid
his kept glucose, meals and Apple Health data. Clinic membership changes no data or app screen; the timing matches a
new sign-in after his session ended. Guy's rule: stored data and all health data always show. Fixed in app #330: the
session keeps `has_data` from /auth/me, and the empty state shows only for an account with nothing kept (OTA). PM-605
(Guy approved): the clinic share part is now "Meals, activity, sleep and heart" / "ארוחות, פעילות, שינה ולב". It
needs no new privacy version, because the policy text did not change.

27 Nov 2026 (Jira PM-602, thread "Add demo patients to Guy's clinic account"): Guy asked for patients on his own
clinic account (doctor) with 1, 3 and 12 months of data, and for Itay as a doctor at the Tel Aviv clinic. Built (API
#290, merged): `python -m steady_api.demo.clinic_patients add --clinician-email <email>` makes Dana Demo (type 2,
Libre, 30 days), Ron Demo (type 1, pens + Dexcom, 90 days) and Lior Demo (type 1, 780G, 365 days) with the demo
generator, quarterly HbA1c and yearly LDL, past visits opened by the clinician (weight, BP, pulse, a "demo" summary),
and accepted links with every part shared. `is_demo` keeps them out of training, priors, forecast, analytics and the
nightly snapshot; the daily demo reset leaves them alone and the worker tops them up to now. `remove` deletes only
them; `member --clinician-email <email> --clinic "<name>" --name "<shown name>"` is Admin > Clinics > Add member.
Tests 59 pass locally. Next: API deploy, then the Mac runs `add` (Guy) and `member` (Itay) on production.

27 Nov 2026 (Jira PM-599, thread "Fix CareLink disconnect on Guy's account"): Guy's CareLink link went to
needs_verification at 02:05:59Z after ONE 403 from the CareLink token endpoint; he signed in again on CareLink's page
at 09:49Z. Cause: `sync_link` treated every refresh error (400/401/403 and even 5xx) as the end of the sign-in and
dropped the tokens; a page sign-in has no password to fall back on. Fixed (API #287): only an OAuth refusal
(`invalid_grant` and kin) ends it; anything else keeps the tokens, goes on with the access token while it lasts, else
retries in 30 min; a rotated refresh token is sealed and committed right after the refresh; the OAuth error code is
logged. The app's CareLink screen now offers only "Sign in on CareLink's page" (app #329; the web app, which can't open
the page, keeps the password form). Next: API deploy and OTA; if it happens again, read the "carelink token refresh
answered" log line for the error code.

27 Nov 2026 (Jira PM-601, thread "Move forecast training off the API server", Guy chose 10:18Z): the hidden glucose
forecast training no longer runs on the machine that serves users. The night of 26-27 Nov it was postponed 13 times for
low free memory on stedio-api (1 GB, uvicorn + worker), so one person got a model. Now a separate 1 GB Machine
`forecast-trainer` in the stedio-api app (no new app, no port, no volume, no worker) is started by Fly every hour,
runs `steady_api.forecast_batch` (who is due: the owner any hour, everyone else 00:00-06:00 UTC; one capped child
process at a time; 40-minute budget) and stops. The API's worker keeps the estimate every 30 minutes and scoring, and
with `STEADY_FORECAST_TRAIN_REMOTE=true` (deploy/fly/api/fly.toml) never trains. `stedio-fly deploy-api` creates the
Machine on first run and gives it each new image without starting it. About $1.5-2 a month. Rollback: set
`STEADY_FORECAST_TRAIN_REMOTE='false'` and destroy the Machine. Tests `test_forecast_batch` 3, forecast suites pass.
Next: API deploy from the Mac, then read the trainer's log line "forecast batch:" after 00:00 UTC.

27 Nov 2026, night (Jira PM-592 epic, PM-593/594/595, thread "Rebuild admin area as management dashboard"): Guy
asked for one website sign-in for everyone, a real admin dashboard and clinic organizations with seats. Built: `/signin`
is the only sign-in; after it an admin lands on `/dashboard/admin`, a clinic team member or organization manager on the
clinic dashboard, everyone else in the app (`POST /auth/handoff-session` gives the area its own session through
sessionStorage; only admins keep the website session; the app's own sign-in screens send to `/signin` on the web). Admin
dashboard rebuilt on the clinic portal's design system: grouped side menu with counts, Overview, Users (search, filters,
sort, pages, row menu, typed-email delete), Profile, Organizations (new), Clinics (detail page, every access change
confirmed, typed-name delete), Support, Demo requests, App updates, Analytics; no page scrolls sideways at 390 px.
Organizations (migration `b8d4f6a0c2e3`): licence seats, clinics take part of them, every team member takes a seat;
existing clinics moved to "Default organization". Clinic dashboard: Organization page for its managers (create a clinic
with its manager, seats, delete without people sharing) and the clinic manager adds, suspends and removes members within
the seats. Privacy `2026-11-27T01:00:00Z` adds organization managers. Verified in the container (API tests, web types,
lint, tests, Playwright en/he, day/night, 1440/390, axe); the handoff into the exported /app is covered by unit tests,
not yet run against an /app export. Next: Guy's OK on the screenshots, merge, deploy API (migration) then web, then OTA.

27 Nov 2026 (Jira PM-591, thread "Add live dev mode to local stedio script"): `stedio sync` pulls main from GitHub
(fast-forward only; skips on local commits, another branch, conflicting local changes or a running build; submodules
follow only when they sat on the recorded commit; pnpm install, uv sync and local migrations only when needed). `up`
pulls once first; live-reload mode pulls every minute (`stedio sync off` stops it). Tested on local copies of the
repositories; not yet on the Mac.

27 Nov 2026, afternoon (Jira PM-604, open item PM-605): Guy: "במדדים שהרופא רואה לא מגיעים כל מדדי ה health". The
clinic Measurements tab now shows, a value a day from Apple Health or Health Connect, steps, distance, active energy,
exercise minutes, stand hours, sleep and day averages of heart rate, HRV and blood oxygen, each with a chart and a
list; gated like resting heart rate. Privacy 2026-11-27T13:00:00Z (users accept again). Merged: api #292, web #120.

27 Nov 2026, night (Jira PM-596, thread "Improve clinic area for care teams"): Guy's clinic follow-ups and the visit
redesign ("הראשון שהוא מבקר יוצר לו ביקור חדש… כל אלה צריכים להתווסף לביקור של אותו יום כיומן תיעודים"). The patient
file opens on visits; the first team member that day opens the visit (date and time pickers) and the others record into
it; a visit's log shows summaries (title + text), measurements and target changes with author, role and time, by
permission; tabs Data (period filter), Meals (calendar + side panel), Measurements (chart + list), Targets. Styled,
keyboard-accessible dropdowns and calendar in all clinic forms. Existing summaries and measurements migrate into visits
(`b8d4f6a0c2e7`, on top of the organizations migration). App Overview shows care-team nutrition, step and activity
targets even before there is data. Privacy line added to 2026-11-27T01:00:00Z. Merged: api #286, web #115, app #328.
Next: deploy API, web, then OTA; Guy to review the screenshots in the thread.

26 Nov 2026, night (Jira PM-589, open item PM-590, thread "Add live dev mode to local stedio script"): `stedio up dev`
and `stedio restart dev` run the Mac's website as `next dev` and the API as `uvicorn --reload`; db and the tunnels
stay; `stedio up` goes back to the built site. Web next.config lets the ngrok host use dev files and live reload
(`STEDIO_DEV_ORIGINS`, web #113). Tested in the container with stand-ins for lsof, zsh and caffeinate; not yet on the Mac.
/app stays the last export in dev mode.

26 Nov 2026, night (Jira PM-582, lawyer PM-583, thread "Build cookie consent manager for website"): Guy asked for a
CookieYes-like cookie manager, identical to MixMaster Pro's, in one new shared repository. Built `fisha/consent-kit`
(submodule `packages/consent-kit`), made generic from MixMaster's own manager: rules, browser store, Google Consent Mode
v2, React banner and preferences dialog, consent-log contract, 30 tests; it reads MixMaster's `mmp_consent` cookies
unchanged (MixMaster itself not touched). Website: banner and dialog (en/he, day/night), US notice with opt-out and GPC,
opt-in elsewhere; GA cookies and the help widget only with consent; "Cookie settings" in the footer and on the new
cookie policy page `/cookies`; API `POST /consent/cookies` (no IP, no account, 2-year cleanup in the worker); privacy
policy `2026-11-26T23:00:00Z` points to the cookie policy (app users accept once more). Open: Guy's OK on the banner
design and the re-accept, then merge and deploy (API before web).

26 Nov 2026, night (Jira PM-584, thread "Fix missing sensor expiry alerts"): Guy's 24-hour sensor-ending reminder did
not come. Production (read only): no reminder sent yet; its time fell at 22:24 Israel time, so the night rule holds it
for 08:00. Bug found and fixed (api #282): a CareLink poll dropped `end_reminded_hours`, so after a sensor's first
reminder every later time counted as sent; the 5-hour one would never have come. Tests 62 pass. Next: API deploy before
27 Nov 15:24Z.

26 Nov 2026 (Jira PM-556..562, PM-569/570 clinic part, lawyer PM-563, thread "Improve clinic area for care teams"):
Guy's seven clinic portal fixes. Every chart shows its values on hover and with the arrow keys; the range bars show
each share. Visit summaries by any team member (sealed, by date, searchable, author-only edits). Each person's page has
tabs: Summary, Visit summaries, Meals (dietitian journal by day and time with photos, foods, nutrients, day totals,
averages against targets), Measurements (clinic-entered height, weight, pulse and blood pressure with the app's height
and weight and the watch's resting heart rate, charts), Targets (nutrition and activity targets set by the team; nutrient
targets reach the app's `/nutrition/summary` while sharing). Per-clinic permissions (`clinic_perms.py`): recommended
templates for doctor, nurse, dietitian, social worker, custom profiles, a manager flag set by an admin, Team access page.
Summary period: since the last visit, 14 or 30 days, 3 or 6 months, 1 year, compared with as many days before; shares
accepted under the first consent stay at 180 days (the app now sends the consent version it showed). The pump's basal
program as set on the pump (Tandem segments, CareLink pattern and rate now), display only. Sideways scroll: a visually
hidden table label widened the page; scroll frames are now positioned. No side menu before sign-in, sign-out after an
hour idle, logo to home. Clinic privacy lines handed to the GA thread for its `2026-11-26T22:00:00Z` version; new clinic
consent text in the app. Tests: API clinic 36 pass, web 17, i18n 20, app 344; checked in Playwright en/he, light/dark,
390 to 1440 px (screenshots `/mnt/project-files/clinic-pm556/`). Next: deploy API (migration `e7b9d1f3a5c6`), then web
and OTA; activity targets are not shown in the app yet (G-141).

26 Nov 2026, later (Jira PM-579..581, same thread): Guy asked for ARCore depth on Android, a reference object for scale
and a photo tip, and to ask amounts in the measures people count carbs in. Built: Android part of `modules/stedio-depth`
(ARCore depth, same `{uri, scale}` as iOS LiDAR, AR Optional, usual camera when ARCore or depth is missing or the flash
is on; app #325, Kotlin not compiled in the container, needs a local Android build); analyzer reference objects (card,
coins, can, fork, spoon) and household measures `ai/carb_measures.py` (ADA exchange amounts, USDA cup weights, Israeli
heaped spoons; amount question in cups, Hebrew rice in heaped spoons; api #276); camera line `meal.frame` now recommends
a fork or card beside the plate. Open: ARCore notice in the privacy policy (27 Nov version), clinical review of the
measures (PM-550), native build iOS + APK.

26 Nov 2026 (Jira PM-568..575, thread "Fix website issues from Guy's list"): Guy's nine website fixes. Live (web
v116, API v203): page loader with the companion between pages (`PageLoader.tsx`, capture-phase click listener), no side
menu on the personal-area sign-in (`DashSide.tsx`), Admin > Support can delete a request that never reached Jira
(`DELETE /admin/support/{id}`, 409 when in Jira; requests #2 and #1 removed by the Mac thread), support portal link in
the home Support section, seaside photo full width from the start, transparent help widget frame, theme kept when
switching language (`ThemeSync`), help widget on Hebrew pages. Clinic sign-in, clinic idle sign-out and the clinic logo
are in the clinic thread. Accessibility (PM-572): every app screen on the web checked with axe-core (AXE=1/2 in
`tools/e2e/duet-shots.cjs`), fixed contrast on teal, nested buttons, stepper role, names that did not start with the
visible words; glucose graph text alternative with values; PDFs with language, title and bookmarks (app #324, API #275);
statement without "What is not yet accessible", dated 26 Nov (web #102, no re-accept). Website pages re-checked clean.
Deployed (API v210, web v118, OTA 1dd3fee). Meal-photo chapter (PM-575, web #108): "Snap your plate" after the logging
chapter, generated photo (gpt-image-2, `/mnt/project-files/site-photos/make_meal_photo.py`) with the camera view
composited on her phone, and the app's food review screen in en and he (`MEALSCAN=<jpg>` and `AFTER=<ms>` in
`tools/e2e/duet-shots.cjs`, mocked analysis in the screenshot tool only). Hebrew site photos (PM-585, web #109): Guy asked
for Israeli people on /he; nine versions made from the English photos with the image edit endpoint
(`/mnt/project-files/site-photos/he/make_he_photos.py`, Hebrew screens put on by `comp_he.py`), served from
`/home/he/`. Next: web deploy; Guy decides whether the kitchen photo keeps a woman in a hijab (`use-3-hijab`).

26 Nov 2026 (Jira PM-577, lawyer PM-578, thread "Set up Google Analytics for site and apps"): Guy asked for Google
Analytics on the website's marketing pages and in the apps, screens and actions only, no user or health data; the
personal areas and the clinic portal only count sign-ins. One GA4 property "Stedio" with two web streams (console steps
for the Mac thread in `/mnt/project-files/google-analytics/console-steps.md`). Apps: no Firebase, no native build; the
opt-in Mixpanel events (same allowlist, never under 18 or while viewing) also go to API `POST /usage/app`, which checks
them again and forwards them by Measurement Protocol without IP, account or Mixpanel id (separate SHA-256 id, country
only) for people who accepted privacy `2026-11-26T22:00:00Z` (API #272, app #322). Website: gtag only on stedio.io
public pages, cookieless (Consent Mode, storage denied; Guy removed the cookie notice 20:41Z until a consent service is
added), GPC not measured, signals and ads personalization off, URLs without query strings, on once `GA_WEB_ID` is set and that privacy version is current (web
#99). Sign-in counts: `POST /usage/sign-in` personal | clinic, random id per event (clinic call to add in `clinicApi.ts`
after the clinic thread's PR). Privacy lines handed to the clinic thread for `2026-11-26T22:00:00Z`. Tests pass in all
three; notice checked with Playwright on a dev server. Measurement ids are in (website G-D789HSTQ55, app G-7QGJ5JZ6X8) and Guy set both secrets. Privacy
`2026-11-26T22:00:00Z` (GA, meal-correction learning, ARCore, clinic lines) merged in API #279 and web #104. Deployed (API v210, web v118, OTA).
Website fix (API #280, web #104 follow-up #105): GA4 keeps cookieless consent-mode pings out of its reports, so the site
now posts each public page to API `POST /usage/page`, which sends one page view by Measurement Protocol (random id per
page view, referrer host only, no Google script or cookie). Next: deploy API and web, check GA Realtime.

26 Nov 2026 (Jira PM-564..566, PM-576, thread "Improve meal photo carb accuracy", nothing visible): Guy's plate (a thin
layer of rice, two breaded stars, a salad, water) came back as 67 g where he counted 25 g (pump 23 g); the gap is the rice
read as a full cup and the breading at fried-food density. Built: food classes with USDA bands of carbs per 100 g, a value
outside held to the edge (`ai/food_classes.py`); analyzer rule to size starchy sides by area x height and breading as
coating only (`_STARCH`); a learned portion factor per person and food class from weighed, changed and kept items and pump
entries for the same meal, against the raw reading, shrunk towards a group prior of consenting adults (ml_priors
`food_portion`, 5+) and bounded 0.5-1.5 (`brain/food_corrections.py`), photo analyses only, in the app and on WhatsApp.
The personal part waits for privacy version 2026-11-26T22:00:00Z (line sent to the clinic thread). Food regression: 5 new
text cases and photo cases from `evals/food/regression/` (out of git, in the Fly evals image when present). Regulatory:
at risk near dosing (pump entries as a signal), lawyer PM-576. Evals not run (food set to be run on Fly). Next: API
deploy, `stedio-fly evals --food`. First food run (26 Nov 20:18Z): 25/27; Guy's photo 67 -> 58 g (band 18-45), clear
noodles lost whole to a long reply (fixed, api #270). Guy chose "ask one short amount question": a starchy side the
analyzer isn't sure of gets one amount question when the photo has no depth measurement (api #271); the photo case passes
when its lowest option brings the meal into the band.

26 Nov 2026 (Jira PM-555, same thread): Guy asked to retake the four "How it works" app screens in Hebrew for the
Hebrew page and in English (the app design changed since PM-236). Captured from the current app with demo scenario
t1-780g (generated data) at 390x844 @2x (`DPR=2` added to `tools/e2e/duet-shots.cjs`), in `apps/web/public/home/{en,he}`,
chosen by page language; alt texts updated. The mosaic photos still carry the older English screens. Web #97.

26 Nov 2026 (Jira PM-554, thread "Add Hebrew language switch to website"): Guy asked for a day/night switch on the
website. `ThemeSwitch` (sun/moon button, `aria-pressed`, string `web.night`) in the top bar, demo, legal, 404 and the
dashboard sets `data-theme` on <html>; the site follows the device until the visitor picks the other look, kept in
localStorage `stedio_theme` and applied in <head> before the first paint. Privacy policy (en, he) names it inside the
pending 2026-11-26T21:00:00Z version. Web #96. Web build, typecheck, lint, tests, Playwright in both modes and
languages. Regulatory and privacy: pass. Next: web deploy with PM-553 and the 21:00Z policy.

26 Nov 2026 (Jira PM-553, thread "Add Hebrew language switch to website"): Guy asked for a Hebrew/English switch on the
website, English by default (replaces the 16 Nov English-only rule, PM-128). `SITE_LOCALES = ['en', 'he']`, no
browser-language detection, the last language opened kept in the `NEXT_LOCALE` cookie the privacy policy already names;
`LangSwitch` (one link to the other language in the top bar, both in the footer and dashboard, same page); `/get` stays
English (install pages rule). Hebrew texts were already complete; fixed the spelling "סכרת" to "סוכרת" in three strings.
The four "How it works" app screens are still English on the Hebrew page (design-gaps). Web build, typecheck, lint, tests,
curl and Playwright in both languages. Regulatory and privacy: pass. Next: web deploy.

26 Nov 2026 (API pool, nothing visible): at 19:28Z the API's pool (5 + 10) ran out for 15 s (14 errors, app reads got
500). A mentor turn and a transcription held their connection idle in transaction through the model wait. API #273:
`db.release()` gives it back before each model call when nothing was written yet; API statement_timeout 60 s and
lock_timeout 10 s; pool 10 + 10 with a 10 s wait; an exhausted pool answers 503 and logs which routes held it (route
templates and seconds only). App #321: expo-task-manager loaded only where the build has it, so OTAs to 0.8.0 start.
Next: API deploy.

27 Nov 2026 (Jira PM-609, Guy): Settings > Privacy shows the motion permission like Notifications: "Motion & Fitness"
(iOS) / "Physical activity" (Android) with On / Not asked yet / Off in system settings; tap asks or opens the phone's
settings; note says it only times glucose check suggestions and stays on the phone. Only in builds with
`modules/stedio-motion`, not for minors. JS only (OTA). Strings `mo.*`.

26 Nov 2026 (Jira PM-542 phase C, Guy approved 19:35Z; lawyer PM-567): glucose check suggestion, built and OFF. API
#267 (`check_suggest.py`, `GET/PUT /check-suggest`, `user_settings.check_suggest_at` / `check_suggest_sent_at`,
migration `f6b8d0e2a4c6`): for an opted-in adult, a background estimate under their own low bound 30-45 minutes after
now sends one silent push (no value or text), at most every 3 hours, claimed atomically. App #320: new native module
`modules/stedio-motion` (Core Motion; Activity Recognition transitions), `expo-task-manager` background task that shows
a quiet local suggestion only while driving or exercising ("When it's safe to stop, it's a good moment to check your
glucose."), the Settings > Privacy switch with the disclosure, shown only while the server offers it; strings `cs.*`.
Nothing changes for anyone until `STEADY_CHECK_SUGGEST` is on (after `forecast.drop_check`; Guy decides) and a native
build with the module is installed. Swift/Kotlin not compiled yet (Linux container). Regulatory: at risk (forecast-driven
prompt, approved exception; the regulatory-check skill text still says no glucose interruption, Guy to decide whether to
record the exception there). Next: native build iOS + APK on the Mac, then turn the switch on for testers.

26 Nov 2026 (Jira PM-546, PM-547, PM-552, Guy approved 19:37Z): the WHO-5 Well-Being Index in conversation, nothing
visible (`brain/wellbeing.py`, tool `note_wellbeing`, table `wellbeing_checks`, migration `e5a7c9b1d3f4`): adults only,
accounts 14+ days old, offered at most every 28 days in a calm conversation; a lower total only makes the mentor gentler
and quieter, never a score or a condition; skip, stop and delete (delete keeps the opt-out); export sheet V. WHO
permission for commercial use requested in parallel (draft in PM-546 for Guy to submit); Hebrew wording is the
mentor's translation until the validated one. Doctor trends in the clinic report (PM-547, `brain/trajectory.py`): 16
weeks of TIR, TBR, GRI and meals logged with a Bayesian change point, labelled "AI-generated summary of past data, not a
treatment recommendation", English and Hebrew. Privacy version 2026-11-26T21:00:00Z (motion stays on the phone, WHO-5,
check suggestion; web #94, #95), a second re-accept today. Forecast training (PM-552, API #266): commits before
training (idle-in-transaction timeout on Fly), shadow trainings only 00-06 UTC on at most 20,000 rows, an
out-of-memory retry halves the rows it used. API #264, #265, #266. Regulatory: at risk PM-547 (trends to doctors) and
PM-546 (licence). Evals not run (PM-436). Next: combined web + API deploy, then Phase C (PM-542).

26 Nov 2026 (Jira PM-551, Guy approved 19:35Z): the privacy policy (English and Hebrew) now describes what the
mentor learns with memory on, the pre-send check, the background glucose estimates (never shown, only accuracy kept),
the reach-out timing test in shadow and the daily summary for improving models (400 days). Privacy version
2026-11-26T20:00:00Z in the API and the website together, so everyone reads and accepts again. Web #92, API #263.

26 Nov 2026 (Jira PM-545, PM-552, nothing visible): in `similar_meals`, how the carbs the person entered on their pump
compare with the app's estimate for the same meal (`brain/carb_estimates.py`: pump entries only, a number they said is
left out, shrunk ratio with a 90% interval, 5+ pairs; words about estimating food only, never which number was right or
any amount; PM-545 labelled needs-lawyer), and the later change (2 to 4 h) after more fat or protein in
`meal_response`. Fixed the hidden forecast training seen failing on Fly (PM-552): an input empty in one horizon band
crashed the trees; after a memory-cap failure the next try uses half the rows, and failures back off up to 72 h.
API #261, #262. Regulatory: at risk near dosing (PM-545). Evals not run (PM-436). Next: API deploy, PM-546.

26 Nov 2026 (Jira PM-543..544, mentor roadmap continued, nothing visible): the personal meal response in hindsight
(`brain/meal_response.py`: their own meals of 180 days, 2-hour change per trait shrunk towards no difference with a 90%
interval, 5+ meals each side; in `similar_meals` as `for_you` only), and when/where to reach out learned in shadow
(`brain/bandit.py`, table `bandit_decisions`, migration `d4f6b8c0e2a3`: Thompson sampling over part of day x channel with
a pooled prior, each decision only from what was known at send time, propensity kept, reward = answered within 2 hours,
export sheet W; nothing it picks is sent; going live waits for Guy and ~300 decisions per group). API #259, #260.
Regulatory and privacy: pass; at risk PM-551 (policy line). Evals not run (PM-436). Next: API deploy (migration), PM-545.

26 Nov 2026 (Jira PM-540..542, mentor roadmap continued, nothing visible): a nightly de-identified learning snapshot
(`brain/snapshot.py`, table `ml_snapshot_rows`, migration `c3e5a7b9d1f2`: training consent only, pseudonym, aggregates
incl. GRI, 400 days, removed with the consent or the account under a shared per-subject lock); weekly cohort outcomes
(`brain/outcomes.py`, groups of 5+); a pre-send check (`brain/critic.py`, small model) that drops failing lines from
openers and daily/weekly/WhatsApp notes after the code checks (STEADY_MENTOR_CRITIC); and the glucose forecast in shadow
for every non-demo account with a recent sensor (PM-542 phase B, `forecast.shadow_users`, STEADY_FORECAST_SHADOW): one
training at a time, owner first, never shown, scored curves dropped, `drop_check` aggregates for phase C's gate. API
#257, #258. Regulatory and privacy: pass; at risk PM-551 (policy line, waits for Guy). Evals not run (PM-436). Phase C
(motion permission, Settings and policy disclosure) is visible and waits for Guy. Next: API deploy (migration).

26 Nov 2026 (Jira PM-535 epic, PM-536..539): Guy asked for a world-class roadmap that makes the mentor breakthrough
behind the scenes, the same in the app, voice and WhatsApp, with no change to what the person sees (roadmap:
`/mnt/project-files/mentor-intelligence/roadmap.md`; "implement in order without changing any design; ask before a
visible change"). Built: a person model learned from the person's own use (`brain/person.py`, worker step
`person_models`, only with AI consent and memory on), today's cross-channel outreach for the mentor and openers
(`brain/outreach.py`), a plans ledger with look-backs on the person's own range (`brain/plans.py`, tools `note_plan` /
`update_plan`, memory-gated), sourced general guidance cards and per-type playbooks (`ai/knowledge.py`, tool
`diabetes_guidance`, not yet clinician-reviewed), and mentoring methods in the prompt (MI, if-then plans, teach-back).
New tables `person_models`, `mentor_plans`, in export and deletion. API #256. Regulatory and privacy: pass; at risk
PM-551 (privacy policy line, waits for Guy because it forces re-accept). Evals not run (PM-436). Next: API deploy
(migrations), then PM-540 (nightly de-identified snapshot), PM-541, PM-542 (forecast shadow; visible parts ask Guy).

26 Nov 2026 (Jira PM-533): Guy asked to see the user's name in Mixpanel and chose "name and email with a separate
consent". A new opt-in "Show my name and email with my usage" (onboarding, the consent-update screen, Settings >
Privacy) is offered only while usage analytics is on, off unless ticked, never under 18. With it, the app's Mixpanel
profile `$set` adds `$email` and `$name` (the name the mentor calls the person by, when given; the app holds no other
name), never in events. The app tells the API the random id (`PUT /account/analytics-identity`, `users.mixpanel_id`);
turning it off, turning analytics off or becoming a minor queues an `$unset` of name and email, account deletion (own
or admin) a profile `$delete` (`mixpanel_cleanup`, worker `mixpanel.cleanup`, needs fly secret STEADY_MIXPANEL_TOKEN,
the same public project token). Privacy `2026-11-26T14:00:00Z` (forced re-accept). App #319, web #91, API #255.
Regulatory and privacy: pass with at-risk items for the lawyer (PM-533, needs-lawyer). Next: API deploy (migration),
web, then OTA; Guy sets STEADY_MIXPANEL_TOKEN.

27 Nov 2026 (Jira PM-625, PM-624): Guy: never both channels; with WhatsApp connected send only there, except the kinds
the person keeps in the app (turned off on the app's WhatsApp card), and anything WhatsApp can't take now goes as the
push; an undelivered template sends the push after all. App copy wa.kinds changed (needs OTA). Content templates
stedio_{daily,insight,checkin,meal}_v2 carry the message itself; until Meta approves them the plain template goes. Texts
to submit: docs/whatsapp-templates.md (Mac thread). API #297.

27 Nov 2026 (Jira PM-611): Guy: after glucose under 60 or over 300, at least once ask how they feel, whether they want
to talk and what happened, WhatsApp first. `glucose_reflect` (worker step) makes one app check-in per stretch: a low
once it is over, a high once over or after 2 h; no value or advice in the text, times and unit in the reason; 2 a day
per side, quiet hours, none in a break; the WhatsApp copy goes like every check-in. Fixed numbers: registered exception
in regulatory-check, lawyer PM-612. API #296.

27 Nov 2026 (Jira PM-610, part 2): Guy: the times must follow when the person eats. With no usual time, lunch and
dinner come from meals logged in 60 days and boluses the person gave in 30 days (2+ days), fixed 13:30/19:30 only with
no sign. Yonatan's case: pump carbs counted as "logged", so nothing asked what he ate; now a pump meal entry with no
meal of the person's own gets "I saw a meal on your pump at HH:MM, what did you eat? photo or voice note", and a
WhatsApp photo answer is saved at the pump time, linked to it. His two WhatsApp templates today were sent but not
opened (24 h window); Guy approved content-carrying templates (next). API #295.

27 Nov 2026 (Jira PM-610): Guy asked whether the mentor asked a 13-year-old tester about lunch on WhatsApp and
suggested a photo or a voice note; it had not, because a meal check-in needs a usual time (3 of 14 days) and he rarely
logs. "True not only for the teen": a person with a diabetes profile who signed in within 7 days, or whose device cloud
sent a reading within 24 h, and has no usual lunch or dinner time, is asked at 13:30 (the late-lunch check-in) and
19:30 when nothing is logged. Same caps, fewer nudges, break, quiet hours. Words name a photo or a quick voice note;
lighter words under 18. API #294. Regulatory and privacy: pass. Next: API deploy.

27 Nov 2026 (Jira PM-600): Guy on the 06:03 morning message: after a repeating evening high, offer to go over that
meal's carbs together before it today and to talk about it; and at 06:00, before his day starts, Today should say Stedio
is following along and here for anything, not suggest comparisons. The prompt now makes the question that offer (never
amounts to eat or insulin); `whatsapp/proactive.day_started` (own quiet hours, else a wake-up recorded this morning,
else 08:00) keeps only heads-ups in Today before the day starts and adds the fixed line. API #288, 102 tests pass.
Regulatory and privacy: pass. Evals not run. Next: API deploy, then the next morning message.

26 Nov 2026 (Jira PM-532): Guy liked the WhatsApp "had lunch yet?" question and asked that it refer back to
yesterday's same meal when it was hard after it. A meal check-in going to WhatsApp now adds one fixed line when
yesterday's first logged meal of that part of the day was followed by 90+ of 180 minutes above the person's own range
(`whatsapp/proactive.meal_look_back`): the meal time, about how long, and an invitation to log today's meal and compare
together. WhatsApp only; the app push stays without glucose data (and, by design, a kind on WhatsApp sends no app push).
API #254, WhatsApp tests 53 pass. Regulatory and privacy: pass. Next: API deploy.

26 Nov 2026 (Jira PM-529): Guy said the WhatsApp conversation is anemic, too general and sometimes old news, and should
think ahead and interpret like a concierge (screenshot of the 07:00 morning message). The morning note now reads the
day's longest stretches out of the person's own range with what was logged in the 3 h before and how many of the 7 days
before had the same part of the day out of range (`day_detail`), and what the app holds for today (`today_ahead`:
sensor end, set change, a visit, the person's reminders). The logging-drop fact needs a whole meal under the usual,
sleep is only last night, the last two mornings are passed in so they are not repeated, and WhatsApp gets an opening
line, a "Today" part and one specific question (`data.wa`, same checks plus no treatment words; the app card is
unchanged). A waiting morning text expires at local midnight. API #250, 133 tests pass. Regulatory and privacy: pass.
Evals not run (PM-436). Next: API deploy, then read the next 07:00 message.

26 Nov 2026 (Jira PM-528): Guy reported that after saving a meal, "Back to main screen" or the Journal opened inside a
sheet, with the meal screen still under it when swiped down. The saved screen popped one meal screen and then pushed a
second set of tabs over the still-open full-screen flow. Now "Back to main screen" and "View in journal" use
`router.dismissTo` to the existing tab, and the flow's own close goes back from the `meal` route, so the whole modal
closes. App #316, typecheck pass, app tests 338 pass; e2e `tools/e2e/meal-closes-after-save.cjs` 15/15 (en light, he
dark) and its checks fail on the old code. Regulatory and privacy: pass (navigation only). Not yet tried on a phone.
Next: OTA.

25 Nov 2026 (Jira PM-523, follow-up): after playing, Guy said the runner's levels were too short and too easy and asked
the screen to shake when the character is low. The whole scene shakes while the game meter is low (a pulsing frame with
Reduce motion), and the start card says so. Levels are 45 s with a goal of 18 coins +4 a level (at most 80), a steeper
climb in speed, obstacles and meter drift, double rocks from level 3 and swooping bees from level 5. App #312, app tests
338 pass. Next: OTA.

25 Nov 2026 (Jira PM-523, PM-525): Guy asked for levels that get harder in the runner, the brick wall and the clouds, a
countdown in the maze, and favourite games with an All / Favorites filter. Run with Stedio, Brick bounce and Cloud
climb have levels (design gap G-140): a level pill, a level-up card with 5 bonus coins, a start-level picker, and
harder settings each level (runner: coin goal in 30 s, faster, more obstacles; bricks: more rows, patterns, two-hit
bricks, faster ball; clouds: every 150 m, wider gaps, moving then breaking clouds). The highest level and the starred
games are kept in `user_settings.games` (`POST /games/level`, `POST /games/favorite`, both in `GET /games` and the
export). The maze counts down 90 s. Fixed: the clouds and bricks end card showed tips from an earlier round. API #247,
`tests/test_games.py` 15 pass; app #309, `test/games.test.ts`, app tests 328 pass, typecheck pass; e2e
`tools/e2e/games-levels.cjs` 15/15 (en light, he dark) on the web export against the test server. Not yet played on a
phone. Next: API deploy, then OTA.

25 Nov 2026 (Jira PM-524): Guy asked for "a Candy Crush style game". Built as "Garden match" / "התאמות בגינה"
(Puzzles), an original match-3 in the games web view: foods drawn in the app's style (strawberry, broccoli, blueberries,
lemon, grapes, carrot), Stedio as the special tile, own name, jokes and levels, nothing taken from Candy Crush. Swap
neighbours to line up 3+, cascades, line tile (4), burst (L/T), Stedio (5) who collects every food of one kind, special
combos, hint after 5 s, shuffle when stuck. Endless levels on the shared store (PM-523): collect 1 to 3 foods in 24 down
to 15 moves, 5 then 6 kinds; tuned with a simulated player (level 1 about 98%, level 20+ about a third). Coins =
score/100 + 2 per move left on a win. API accepts `garden` for score and level (API #249, app #311). App tests 329
pass (new `test/garden.test.ts` runs the engine), typecheck pass, API `test_games.py` 16/16, e2e
`tools/e2e/garden-match.cjs` 11/11 (en light, he dark). Regulatory and privacy: pass. Companion regression set not run
(no companion change). Next: API deploy, then OTA.

25 Nov 2026 (Jira PM-526): Guy asked for a first-person game where you chase friendly cartoon people with a glucose
meter above the head: above the range they get an insulin shot, below it a sweet drink, in range a high-five or a hug.
Built as "Glucose chase" (arcade) in the games web view: drawn street and people, cartoon syringe and juice box, no
amounts or units anywhere, the person's own range and unit (70-180 mg/dL when no range is set), levels on the shared
store (PM-523), coins, Hebrew and English, day and night. API accepts `chase` for score and level. App tests 329 pass
(new: page script parses, chase strings in both languages, no "units"), typecheck pass, API `test_games.py` 15/15.
Played end to end in Chromium (he light, en dark mmol): reaching friends, right picks, level-up and end screen, no page
errors. Regulatory check: two items at risk (glucose-to-treatment pairing, 70-180 fallback), Guy kept the mechanic,
legal review PM-527 (needs-lawyer). Then Guy asked to choose the tool first and then tap the friend: friends no longer stop, a gold ring marks those in reach, a tap elsewhere steers, Space gives to the nearest in reach. App tests 329 pass, typecheck pass, played in Chromium (he light, en dark mmol/L) through a level-up, no page errors. Then (Guy) the shared level-up card holds the game (runner, bricks, clouds, chase) until a tap or 2.4 s; checked in Chromium (timer stands still under the card, runs after a tap). Next: OTA.

25 Nov 2026 (Jira PM-522): Guy's screenshot showed the games button alone on a second line under "Tap to talk" in
English (iPhone Pro Max, default text). The row (Conversations, Type instead, Quiet mode, Games) never wraps now: a
hidden copy measures it with its labels, and when that is wider than the screen the two labelled pills show their icon
only, as round buttons. Names stay as accessibility labels. App #307, e2e `tools/e2e/talk-row.cjs` (440/390/320 px, en and he, light and dark) all pass, app tests
325 pass, typecheck pass. OTA live (app a1b6191). Guy then asked for short labels rather than icons only: the row shows
the full labels when they fit, else "History" and "Type" (`com.history_short`, `com.type_short`; Hebrew keeps its
labels), and icons only only when neither fits. Full English labels need about 407 px, so a Pro Max shows History and
Type. e2e `talk-row.cjs` all pass (440/390/345/320, en and he). Next: OTA.

25 Nov 2026 (Jira PM-520): Guy asked the Journal to show up to a week and to pick dates on the "All" filter. The
Journal now loads today and the six days before it. The All filter's options start with Dates: "Last 7 days" or
"Choose dates" (first the week before; From and To in the device region's order, at most 92 days, never later than
today). Picked dates hold on every tab, show on the Filtered line with Clear, and count on the All tab. The list draws
days as they scroll (FlatList), so a week of 5-minute readings opens in under a second on the web build; while picked
dates load, rows carried from the earlier window show the loader, not "nothing on these dates". No API change (the
lists allow 92 days). App #305, unit tests in `test/journal.test.ts`, e2e `tools/e2e/journal-range.cjs` 20/20 (en, he),
`journal-filters.cjs` 36/36. Companion regression set not run (no companion change). Next: OTA.

25 Nov 2026 (Jira PM-518): on WhatsApp Guy said the date cookies (12 g) were his breakfast meal, already logged at
11:19 in the app with a pump copy. The mentor saved them as a new meal "now", and his correction then moved that meal
to 11:20 at an estimated 26 g, which left two breakfasts. `propose_meal` now takes `logged_meal_at` (the time as listed
in the records). The card changes that meal and keeps its time. A pump entry is never edited: a pump-only meal gets the
person's entry linked to it. A meal an earlier card in the conversation saved for it is soft-deleted on save. A new meal
within 30 min of a logged one is asked about first (`separate_meal`), and `carbs_g` keeps the carbs the person said. A
correction with no time keeps the meal's time, and the prompt says past times are never now. On WhatsApp, the save
question now gives the meal's time and carbs. API #243, `tests/test_conversation_entries.py` (4 new). Companion
regression set not run (PM-436). Next: API deploy (no OTA needed).

25 Nov 2026 (Jira PM-521, Guy approved): after finding an old meal Guy asked how to add it now. A meal's Journal
detail (alone or merged with a pump's carb entry) has a "Log it again" button when the meal has foods: it opens
`/meal?repeat=<id>`, which loads the record and opens Check the foods with its foods and the time now, saved only from
the review, like Recent and search. Not while viewing someone else. App only. e2e `tools/e2e/log-again.cjs` 10/10.
Next: OTA.

25 Nov 2026 (Jira PM-517): Itay forgot to photograph his food and could not find last week's meal under "Recent"; he
asked to search meals. Meals are kept for as long as the account exists; the Journal shows today and yesterday, and
"Recent" reads only the last 60 days, each meal once, at most 8. Log a meal now has a "Search past meals" field under
the ways to log (shown once there are recent meals): from two letters, `GET /meal/history/search?q=` searches the
person's own meals over the whole history on food names and the meal's note (case, accents, niqqud and Hebrew final
letters ignored, every word must match), newest first, each meal once, at most 20; hidden and deleted meals and other
people's are left out, viewers are refused. The results replace Recent ("Past meals", with the year for meals about a
year old or more); a tap opens the review with the time now, saved only from the review. Clearing the field brings
Recent back. The field scrolls to the top when focused so the matches show above the keyboard. The uvicorn access log
now replaces any `q=` value with `-` (food search too). API `tests/test_meal_search.py`, e2e `tools/e2e/meal-search.cjs`
25/25. Companion regression set not run (no companion change). Next: API deploy, then OTA.

25 Nov 2026 (Jira PM-514): Guy sent Stedio a voice message on WhatsApp and got the "not supported" line ("צריך
לתמוך"). A WhatsApp `audio` message (voice note or audio file) is now downloaded from the Cloud API media endpoint,
transcribed with the app's own OpenAI speech to text (`ai/voice.py`, the person's conversation language) and handled
as a typed message: the request matchers (stop/restart updates) and the companion turn, reply in text. STOP said out
loud never unlinks. Same gates (linked number, AI switch). The audio stays in memory only (max 3 MB); only the words
are kept, as the person's message. Fixed lines `voice_failed`, `voice_long`, `voice_empty` (en+he); the "media" line no
longer says voice works only in the app. Privacy `2026-11-25T12:00:00Z` (WhatsApp paragraph and Meta processor line,
en+he). API `tests/test_whatsapp_voice.py`. Companion regression set not run (no companion change). Next: API + web
deploy.

25 Nov 2026 (Jira PM-515): Guy asked to fix the Known issues of the install page for iOS 0.8.0 (31) / Android 0.8.0
(9). "Accessibility > Contrast says Coming soon" was already fixed in that build (row removed, PM-499); the note was
left over. "The clinic portal's tests table shows number results only": the clinic summary now lists a lab result
printed in words (PM-347) with its words as entered, and the portal shows it under Tests and follow-up (also among the
earlier results); the chart button and the labs chart use number results only. API #239, web #89. API
`tests/test_labs.py`; local portal check en light and he dark. Both items removed from the install page's
`release.json`. Next: API deploy, web deploy.

25 Nov 2026 (Jira PM-510): Guy asked for the depth sensor too ("אני רוצה גם את החיישן עומק"). On an iPhone with a
LiDAR camera the meal camera now takes the photo with the local native module `apps/mobile/modules/stedio-depth`
(AVFoundation LiDAR camera, depth delivered with the photo but never embedded in it). It measures the median distance in
the middle of the frame and the size the whole photo covers there (camera calibration, else field of view); only those
three numbers go with `POST /meal/photos/{id}/analyze` as `scales` and are added to the analyzer's instructions. Nothing
new is stored. No visible change; other phones, Android and older builds keep the usual camera, and a LiDAR failure
falls back to it. API `tests/test_meal_depth.py`, app `test/meal-depth.test.ts`. The Swift module is not compiled in the
container: it needs the next local native build (iOS + Android APK) and a check on Guy's iPhone 16 Pro Max. Deploy the
API before that build.

25 Nov 2026 (Jira PM-509): Guy reported wrong meal-photo carbs: a mug of plain tea became "milk in tea", 1¼ cup of
milk, 15 g, and the answer to the clarifying question changed nothing; clear noodles (≈ 63 g, Guy counted 8 g) and a few
pieces of loaf cake (≈ 74 g, Guy counted 12 g). Model-only fix in the analyzer instructions (`ai/food.py`): a drink is
one item for the whole drink (plain tea, black coffee, water ≈ 0 g; milk in tea is a splash; unseen additions are asked
with a plain option), the person's answer decides over the first reading, low-carb look-alikes are asked about
(shirataki vs glass noodles, cauliflower rice, zero-sugar drinks), values are as served, and portions are judged from
objects in the photo without rounding up. The app's re-estimate states the answer as the person's own (`refineText`).
Tests: API `tests/test_food_rules.py`, app `test/meal.test.ts`; new `evals/steady_evals/food_regression.py` (21 text
cases, `stedio-fly evals --food`), not yet run against the model (no key in the container). Guy's choice open on a
camera-screen scale tip or LiDAR. Next: API deploy, then OTA, then one food regression run.

24 Nov 2026 (Jira PM-506, PM-507): Guy asked for more nutrients on Overview > Nutrition (only what meal analysis
gives), a tile chooser like Apple Health, and targets the person types from their care team, shown beside the total and
the average (Stedio never suggests one). At Guy's choice the analysis now also gives calories, sugars, saturated fat and
sodium (AI model, USDA, Open Food Facts; the Israeli list has none, so they stay empty). Built: meal item and total
fields, `nutrition_targets.py` (`food.targets` checked on profile save, minors limited), summary averages and
`targets`, `food_tiles` in settings, mentor context and `app_data`, export columns and a "nutrition_targets" file; app
tiles, chooser sheet, breakdown, Nutrition targets screen. Privacy `2026-11-24T22:00:00Z`. Design gap G-137. API tests
pass (1048), app 319, i18n 20, web 17; e2e `tools/e2e/nutrition-targets.cjs` 32/32 en+he light+dark. Companion
regression set not run (context change). Next: API + web deploy, then OTA.

24 Nov 2026 (Jira PM-508): Guy asked that a "Medicines taken" habit offer the person's own medicines. The habit sheet
shows the profile's medicines (PM-503) as optional chips; the picks are the habit's name (API limit 60 -> 200), the
journal shows them, and the mentor's record line now includes a habit's name. API #235, app #300; e2e body-history
adds the habit step (en/he, light/dark). Deploy the API before the OTA.

24 Nov 2026 (Jira PM-505): Guy said the Last period screen looked broken (the Add button out of line with the date
field, loose info rows). It now uses Duet groups: the first day and an "Add period" row in one group, the periods or the
empty line in the next, the note as a footnote. Medicines are one grouped list with an "Add a medicine" row. Height and
weight history was checked and needed no change. e2e body-history 22/22 (en/he, light/dark); app 315 tests; app #297.

24 Nov 2026 (Jira PM-501, PM-502, PM-503): Guy asked for (1) the earlier heights and weights on the edit screen with a
growth chart from two measurements, (2) a last-period list for people whose profile sex is female, (3) medicines one per
row instead of one text, all known to the mentor and the models. Built: table `body_entries` (migration `c3e5a7b9d1f4`,
backfilled from the profile change history), each profile save that changes height or weight adds an entry (a same-day
correction replaces it), `GET /profile/body`, `POST /profile/body/periods` (female only), `DELETE /profile/body/{id}`
(not the current value, not a health-app weight); Apple Health / Health Connect weights listed read-only; never for
followers (not in the viewer paths); in the export. `meds.items` with `meds.more` kept as the joined text (an older app
changing the text re-splits the rows). Mentor: own-conversation lines, `app_data` section `body_history`, insight and
agent `profile` tool; never a prediction about periods. App: lists and charts under Height and weight, "Last period" row
and screen, medicine rows. Privacy `2026-11-24T21:00:00Z` (also fixes "edit any record", PM-373). Design gap G-136. API
1039 pass, app 315, i18n 20, web 17; e2e `tools/e2e/body-history.cjs` 22/22 en+he light+dark. Next: API + web deploy,
then OTA.
24 Nov 2026 (Jira PM-500): Guy, following his son, saw "Couldn't load the averages" on Overview > Averages. Cause:
`GET /metrics/averages` was never in the viewer allowlist (`deps.py`), so followers got 403 `view_only`. It now goes with
the always-shared glucose scope, GET only (api #232, merged). Sharing tests 6/6 (fail without the fix), metrics,
learning, minors, demo 55 pass, ruff clean. Other Overview reads for viewers checked: none missing. Next: API deploy
via the Mac thread; no OTA.
24 Nov 2026 (Jira PM-487, PM-497, PM-498, PM-499): Guy asked for Settings polish. Routine tab: the Activity & fitness
block titles (Steps, Active energy, Exercise minutes, Stand hours, Workouts) are headings, 20 pt bold, larger than the
rows. Settings: a "Profiles" block before Diabetes profile (Quiet profile row to the Quiet page; one Simple / Advanced
profile switch; they replace the Quiet mode and Simple mode rows), no description line under any row (search still
finds them), the mentor row "My Stedio", My milestones beside My Stedio and WhatsApp. WhatsApp: the "If you haven't
written to Stedio in the last day" note removed. Accessibility: "Increase contrast" removed. App #293 merged.
typecheck, app tests 315, i18n 20 pass; e2e `tools/e2e/settings-polish.cjs` 40/40 and `simple-mode.cjs` all pass
(en, he, light, dark). Not yet seen on a phone. Next: OTA via the Mac thread.
24 Nov 2026 (Jira PM-489): Guy asked that the website meet accessibility level AA. Audited every website route (public, legal
en+he, dashboard, admin, clinic portal) with axe-core (WCAG 2.2 A+AA) light/dark at 1280 and 320 px plus a keyboard,
headings, titles and reflow pass, against the local test API. Fixed (web #85, merged): darker day secondary grey, night
teal fills under white, focusable table frames, skip links and landmarks, page titles from the heading, the home
companion's motion stops within 5 s, the dashboard day chart is one slider, segments wrap at 320 px; accessibility
statement updated (en, he). App web build (app #295): aria-checked on web radios, tab list holds only tabs,
reading-tile contrast, night teal fills via `accentFill` (Guy chose the darker teal, merged). axe 0 violations after. Web deployed (v105);
app #295 merged, OTA requested. Remaining: outside expert / screen-reader user test, the Atlassian
help widget (third party, did not open on stedio.io), full manual pass of every app screen, chart text alternatives, PDFs.
24 Nov 2026 (Jira PM-484): Guy said a meal-review question ("What was the bread slice size?") vanished after one tap,
so the answer could not be changed. Now the question stays with every option and the answer shown as a selected chip;
another tap re-estimates the food, and a late estimate for a replaced answer is dropped (app #289). typecheck, lint,
app tests 313 pass. Not yet seen on a phone. Next: OTA via the Mac thread.
24 Nov 2026 (Jira PM-486, PM-490): Guy asked that a parent can like a meal the child ate, and ask about one journal row
("What did you eat here?" on an insulin entry) with the child answering on that row, the question popping up for the
child with a tap to the row; everything in the demos too. Built: likes as a cheer kind "like" on one meal
(`cheers.record_id`, migration `f1a3c5e7b9d2`; once per meal, 10 a day apart from cheers; only through a share with the
journal), a button in the meal's Journal detail and a chip on the cheer card, the child's cheer overlay names the meal's
time; questions on rows (`row_questions`, migration `a2c4e6f8b0d3`, `routers/row_questions.py`), the person's and the
asker's pop-ups (`QuestionWatcher`), a card on the row (`RowQuestions`); never to the mentor, pushes without the words;
in both exports; the family demo has a like, an answered and an open question. Privacy `2026-11-24T17:00:00Z`. Design
gap G-135. API tests pass; app 315, web 17; e2e `tools/e2e/row-questions.cjs` en+he on the test server. Next: API and
web deploy, then OTA.
24 Nov 2026 (Jira PM-485): Guy asked that a parent's cheer also reach the child on WhatsApp, "only if he has not seen it
in the app". Built (api #230, web #83): worker step `cheer_whatsapp` sends a cheer still unopened in the app after 30
minutes once as WhatsApp text, only inside the child's free 24-hour window (never a template), with the usual stop,
consent, quiet mode and quiet hours checks; dropped after a day. `cheers.whatsapp_at`, migration `d4f6a8c0e2b4`. Privacy
`2026-11-24T16:00:00Z`. API tests for it pass, web 17. Next: API and web deploy (no OTA needed).
24 Nov 2026 (Jira PM-477..483): Guy asked how to get a teen to answer insights and log meals, then approved all eight
proposal ideas ("את כולן", no coins for adults; a meal photo may stay a draft; meal photos on WhatsApp). Built: habit
coins for minors (meal logged up to 4 a day, insight answered up to 3, challenge met once a week; own entries only,
not in Classic or with Games off; `games.habit_coins`, worker step `habit_coins`, toast `CoinsWatcher`); teen insight
answers on Overview (one insight card a day, "That's me / Not really / Why?") and the "insights" weekly challenge;
meal photo drafts ("Finish later", `POST /meal/photos/{id}/draft`, `GET /meal/drafts`, migration `b7d9f1a3c5e8`, a
draft card on Overview, deleted after a day like every unlinked photo); meal photos on WhatsApp (read, estimate shown,
Save / Not now buttons, Not now keeps a draft; parent's photo switch respected); teen mentor lines (ask once what would
make the app worth opening, remember it, link habits to their own goals, never pressure); the parent's cheer card after
the child logs a meal. Privacy `2026-11-24T15:00:00Z` (WhatsApp photos to Meta, drafts, cheer). Design gap G-134.
Merged api #229, app #290, web #82. Regression evals not run for the mentor lines (PM-436). Next: API deploy, then OTA; check with Yonatan.
24 Nov 2026 (Jira PM-476): Guy approved the mockup and asked for it pixel for pixel. Built (app #284): the Overview is the
first tab and the screen the app opens on (tabs Overview, Talk, Journal, Settings); Overview has no title, the glucose
tile beside the time-in-range tile on top (a tap steps 24 h / Day / Week and moves the period below), no period TIR
card; Talk's card line (alerts, reminders, mentor moments, insights) sits on Overview in the Insights row's place (Guy's
decision card); Talk shows only the reading's line; Journal and Settings have no title and the reading's line on top.
Follow-up (app #285, #286, Guy 24 Nov): the insights line sits right under the two tiles (kids' My days too, tiles and cards before the quest cards); Settings shows the name and photo before the search box (app #287); viewing someone uses the same layout and opens on their Overview (app #288, was Talk per PM-384); simple mode keeps the period's graph on Overview (app #291); the reading line on Journal and Settings is at Talk's height; kids mode follows the same design (My days first, no title, the child's reading tile beside time in range with the cards above; Talk with only the reading line, then the name, quest and character). e2e overview-first 50/50 en+he incl. kids. typecheck and app tests 313 pass, lint no new errors, e2e
`tools/e2e/overview-first.cjs` 28/28 (en, he). Next: OTA via the Mac thread; check on a phone.
23 Nov 2026 (Jira PM-473): Guy asked to see session replay in Mixpanel. Built: Mixpanel's native recorder
(`@mixpanel/react-native-session-replay` 2.1.0, US) in app `src/analytics/replay.ts`, recording only while analytics is
on and the yes was given to the new wording that names masked screen recordings (`analyticsReplay`; earlier yeses are
asked once more on the re-accept screen), same random id, stops while viewing, never under 18. Everything is masked on
the phone: text, images, web, maps (recorder) and every drawn chart of the person's data (`MaskedSvg`). Native module:
app version 0.8.0, needs a LOCAL native build; older builds ignore it. Privacy `2026-11-24T02:00:00Z` (forced
re-accept). pnpm check pass (app 312), web 17, API legal 7. Not yet run on a phone. Next: merge, deploy API + web,
OTA, local 0.8.0 build on the Mac; replay seen in Mixpanel.
23 Nov 2026 (Jira PM-470): Guy said the website's admin sign-in keeps signing him out. Cause: the dashboard kept its
session in page memory only since G-12, so every reload or new tab signed out (not Cloudflare or the new domains).
Now the website's session lives in an HttpOnly, Secure, SameSite=Strict cookie (`steady_web_session`, set by the API
when the website sends `X-Steady-Session: cookie`, host-only on the website through `/api/steady`, path
`/api/steady/auth`, 30 days); the access token stays in memory, refreshes are one at a time across tabs (Web Locks),
sign-out ends all tabs; the admin handoff from the app moves into the cookie at once. Privacy policy
`2026-11-24T01:00:00Z` names the cookie (forced re-accept). API auth tests 15 pass; web tests, typecheck, lint pass;
Playwright on a production build: reload, new tab, two tabs reloading at once, access token expiry, sign-out in all
tabs. Next: deploy API, then website.
24 Nov 2026 (PM-466/474/475): support in Jira Service Management is live end to end (SUP-1 from the app, Jira reply back in the app). Fixes api#222, #225, #226, #227. Portal "Stedio Support" branded with logo and #0B7A75 and the HELP articles linked (PM-474). Guy chose an open portal with Atlassian's help widget on the website (PM-475, web#81, privacy `2026-11-24T09:00:00Z`, api#228); live chat with an agent is not on the Free plan. Next: deploy API then web, check the widget on stedio.io, make the knowledge base visible to customers.

23 Nov 2026 (Jira PM-466): Guy asked to connect support requests opened in the app to Jira Service Management (SUP)
instead of the website's admin support, with the person synced as the customer, a customer portal with onboarding and
how-to articles, all on the JSM Free plan. Built: each request is a JSM customer request raised for the person (email,
display name from the email), their app replies go to Jira, support's public comments and the status come back to the
app with a push (worker every 2 min, REST only, no Automation or webhooks); account deletion and the year clean-up
delete the Jira request and customer entry. The website's Support list is titles linking to Jira. Privacy policy
`2026-11-24T00:30:00Z` (Atlassian as support desk), forced re-accept; legal item for the lawyer. API migration
`d2f4a6c8e0b1` (after `d2f4a6b8c0e1`). API 996 pass; pnpm check pass; e2e admin-area 46/46 with a JSM stand-in.
Knowledge-base drafts in project files `pm-466/kb-articles.md`. Next: deploy API + website, OTA; Guy's OK for the
portal settings and the knowledge-base space.
23 Nov 2026 (Jira PM-464, open items PM-467): Guy approved Mixpanel product analytics, opt-in, usage events only.
App `src/analytics/`: a small client (no SDK, so it ships by OTA) sends to Mixpanel's US endpoint with `ip=0`, under a
random id made on the phone, never the account; every property is a closed word from an allowlist, so no value, text
or id can pass (`test/analytics.test.ts`). Events: App Opened, Screen Viewed (route file only), Signed In, Onboarding
Step Completed, Consent Accepted, Entry Logged (kind and source), meal photo/description/usual, Mentor Message Sent,
Voice Call Started/Ended (length bucket), Device Connected, Setting Changed, Game Played, follow invites, support,
clinic report, export. Off unless the person ticks it (onboarding, re-accept screen, Settings > Privacy; G-133); never
under 18 or while viewing. Privacy policy `2026-11-24T00:00:00Z` names Mixpanel (forced re-accept). Session replay not
built (Guy suggested full masking; drawn glucose charts are not text, and it needs a native build). Next: Guy creates
the Stedio Mixpanel project (US) and sets `EXPO_PUBLIC_MIXPANEL_TOKEN` in EAS; deploy API and web, then OTA; then the
dashboards, funnels, flows and retention reports in Mixpanel.
23 Nov 2026 (Jira PM-468): Guy asked that the admin Analytics page show the real numbers instead of "<5" and show the
values when hovering the charts. The API returns exact counts for platforms, countries, personas and connected devices
(the admin Users page already shows each person's platform and region); the two 30-day charts show the day and its
count on hover, and on keyboard focus with the arrow keys; the "<5" sentence left the subtitle (en + he). API tests,
web typecheck, lint and tests pass; checked in a browser against the local test server. Next: API and web deploy.
23 Nov 2026 (Jira PM-463): Guy asked for one email template in the spirit of the website (white, logo in the header,
footer with unsubscribe, company name and address) and approved the design preview. Every API email (verification and
reset codes, approvals, clinic, demo, iPhone, support, parent safety alerts) now goes out as HTML in that layout plus the
same plain text, `steady_api/mail_layout.py` and `mailer.py`: codes in a tinted box, a minor's words in a grey box,
Hebrew emails right to left, footer "Stedio Ltd · 6908716 Tel Aviv, Israel" (Hebrew in Hebrew emails). Email copy is
unchanged. Unsubscribe (`/email/unsubscribe`, an encrypted token so the address never shows in the link; the page asks
before acting, one-click POST per RFC 8058) stops "updates" emails only, which carry List-Unsubscribe headers; none are
sent yet. Account and safety emails always arrive and their footer says so. Opt-outs are kept as keyed hashes
(`email_optouts`, migration `d2f4a6b8c0e1`). Logo PNG served at `/email/logo.png`. API tests pass. Next: API deploy.
23 Nov 2026 (Jira PM-472): on a tester's account the poor-air card's opening suggested indoor activity although a
43-minute walk was logged that morning; the walk was in the prompt, but the card's note and the weather line pushed the
suggestion. The mentor now checks what the person already did today before suggesting anything (prompt rule, "talk
about this" note, weather line), and an activity check-in is also answered by a health-store workout. API 1009 pass;
eval cases he-mentor-26 and en-mentor-28; regression set not run (PM-436). Next: API deploy.
23 Nov 2026 (Jira PM-459): Guy asked that the mentor know everything the app knows and can do, e.g. when to change the
sensor or the infusion set. The always-on app block now has the set (last change, day N, the day a change is
recommended, from set_end) and the sensor's warm-up, start and "end not known"; the app_data tool gains games (coins,
shop, daily question, weekly challenges read without awarding, milestones), support (request subjects and status) and
app_guide (where each feature is, no prompt cost), and settings/devices/sharing gain the set reminder, set type, quiet
schedule, Simple/Classic/Games/Challenges switches, warm-up and the follower's own reminders. A follower's mentor gets
only the two Overview equipment rows. Eval cases with a new `app_lines` field. API tests pass; regression set not run
(PM-436). Next: API deploy.
23 Nov 2026 (Jira PM-451, PM-455): Guy asked to fix the website's certificate on its new domain and move to it. Cause:
Cloudflare error 525, because Fly had no certificate for stedio.io. Fly certificates issued for stedio.io, www.stedio.io
and api.stedio.io (DNS-01 via `_acme-challenge` CNAMEs, DNS only); Cloudflare SSL mode Full (strict); api.stedio.io is
DNS only (voice WebSocket, no extra processor). Website, API (CORS, links, latest.json), stedio-fly, EAS preview env
and the testers OTA (0.7/0.6/0.5) now use https://stedio.io and https://api.stedio.io; the fly.dev hosts keep working.
Verified live: stedio.io, www, /app (calls api.stedio.io), api.stedio.io/health, noindex header + meta. Legal pages
give hello@stedio.io (privacy and terms `2026-11-23T19:00:00Z`, forced re-accept). Open: Guy sets up the hello@
mailbox; Guy decides whether stedio.io stays behind the Cloudflare proxy (a processor) or goes DNS only; web sign-in on
stedio.io needs the Google web client origin and the Apple Services ID return URL.
23 Nov 2026 (Jira PM-452, PM-453, lawyer PM-454): the deploy gate blocked API 674ec7b on yg-he-02 (the mentor named
ERAN 1201, and promised a teen it wouldn't pass what he wrote to his mom). Guy: ERAN is allowed, verified crisis lines are
approved for everyone in distress, and a minor's safety concern must reach the parent. (1) PM-452: a closed list of
verified crisis lines (`steady_api/ai/crisis_lines.py`: IL ERAN 1201, US 988), chosen by the device region country; a
distress rule for every person; the young-person lines about what parents see are gone; judge rubric `2026.11.23a`;
eval cases carry `region`, new case ad-he-distress-01. (2) PM-453: the worker reads each minor's new own messages with
the small model (eating / self_harm); a concern emails every confirmed parent with the words and pushes a wordless
alert; the parent's app shows it as a dialog (G-132) until marked read; once an hour per kind, kept 30 days, in the
export. Privacy policy `2026-11-23T21:00:00Z`, parent confirmation `guardian-2026-11-23`. API migration `c1e3a5b7d9f2`
(after `b8d0f2a4c6e9`).
23 Nov 2026 (Jira PM-450): Guy asked for a Simple mode switch in Settings that shows only meal photo logging, the
sensor and set days, time in range, insights, the current reading, the main screen as it is, every "+" option and the
mentor by voice and text. Built in the app only (no API change): the switch sits on the Settings screen under Quiet mode
(`companion.simple` in the profile answers); while on, the Journal tab and the games are hidden and Overview shows the
latest reading, the period with time in range, the Insights row and the set and sensor rows, with no graph. Choices in
design gap G-131. App tests 302 pass, typecheck pass; e2e `tools/e2e/simple-mode.cjs` 25/25 (en light, he light, he
dark). Screenshots in /mnt/project-files/pm-450. Next: OTA.
23 Nov 2026 (Jira PM-445..448): Guy asked to put the website's admin area in order. (1) An admin opening the app on the
website still landed in the app: the app kept an account viewed from the admin pages ("In the app") and only the bare
/app address counted. Now any app address sends an admin to the new admin hub, and "My area (the app)" opens the
admin's own data (`?own=1`). (2) Analytics: people, features, data volume, models and agents, counts only, without demo
and admin accounts, groups under 5 hidden. (3) Help & support has only "Contact support": a request (subject, topic,
urgency, text) with a two-way conversation, read receipts, pushes from support, an email to support with the number and
topic only, the mixmaster-pro clean-up (resolved after 5 quiet days, closed 2 days later, archived 7 days later,
deleted a year later) and a "Create Jira issue" button (project SUP, text written by the admin only). (4) User profile:
country of the phone's region setting, time zone, phones and browsers, last sign-in and how, password reset by an
emailed code. Privacy policy `2026-11-23T18:00:00Z` (device details, support requests, Atlassian), so everyone reads and
accepts again; export includes requests and installs. API migration `b8d0f2a4c6e9` (after `a7c9e1b3d5f8`). API 970
tests pass; e2e `tools/e2e/admin-area.cjs`. Next: Guy creates Jira project SUP and sets the two Jira secrets; deploy API,
website, OTA.
23 Nov 2026 (Jira PM-444): Guy asked that a parent viewing their child's data sees, in Settings, statistics of what
the child does in the app. Built: on the viewer's Settings, a confirmed parent of a minor gets "{name}'s app use" with
the child's last activity; it opens counts for 7 or 30 days: days with activity, entries the child logged themselves
(meals, insulin, glucose checks, activity, notes; device data never counts), conversations with the mentor, messages
sent and how many out loud, the question of the day and each game played. Counts and a time only, never content; not
the challenges or stickers, which the child is told are theirs alone. API `GET /sharing/{id}/young/activity`, game plays
now kept per day for 35 days (G-129). Privacy policy 2026-11-23T16:00:00Z (forced re-accept). API 957 pass; app 299
pass; root `pnpm check` passes; e2e `tools/e2e/child-activity.cjs` 32/32. Next: API deploy, web deploy, OTA.
23 Nov 2026 (Jira PM-443): Guy found the mentor still called "sweet spot" on Itay's account, a name kept from when it
could be changed (PM-295 renamed only "Noa" on accounts made after 14 Nov). Fixed: API migration `a7c9e1b3d5f8` (after
`d6f8a0b2c4e7`) sets the name to "Stedio" on every profile, a save always stores "Stedio", and the prompts, pushes and
voice preview use the fixed name, never the stored one (api #200); the app replaces any saved or cached name with
"Stedio" when it loads the answers (app #269). API suite 956 pass on Postgres; app tests 299 pass and typecheck pass.
Regression set not run here (no key; prompt text unchanged for anyone already called Stedio). Next: API deploy
(migration, eval gate), then OTA.
23 Nov 2026 (Jira PM-442): Guy found Food today > "Meals today" opening empty although the tile said 2. A fresh account
lists the meals correctly and the production logs a few minutes later showed no errors. The tile shows its kept answer
when a read fails, but the sheet had no kept answer (a failed read read as "No meals logged today yet") and was blank
while its two reads were on their way. Fixed (app #268): the meals list needs only the meals read, today's meals and the
7-day summary use the offline cache, a spinner while reading, and "Couldn't load this list" with Try again when the read
fails. e2e `tools/e2e/meals-today-sheet.cjs` 18/18 (he dark, en light). Next: OTA (app only, no API change).
23 Nov 2026 (Jira PM-438): Guy approved the character games mockup (round 3) and asked to build, merge and deploy it.
Built: Settings > Stedio has three switches (Classic, Games, Challenges); a game button beside quiet mode on the main
screen and a once-a-day invitation bubble; the Games screen with 12 games in four categories, drawn tile icons in the
app's line style (Guy asked for them instead of emoji), coins, a streak and the wardrobe shop; each game full screen in
the existing web view with the latest reading on top and a pause below the person's own range ("I took care of it,
continue"). API `/games` (state in `user_settings.games`, migration `d6f8a0b2c4e7` after `e8b2d4f6a1c3`), today's
question tied to a logged meal, coins capped, walk minutes from the health store, and one push inviting people who never
played. Product rules in design gap G-127. API tests pass; app tests and typecheck pass; every game runs in he and en
in a browser with no errors. Next: API deploy (migration), then OTA.
23 Nov 2026 (Jira PM-440): Guy asked that an admin can send pushes with text about updates to all users. Built: Admin >
App updates on the website (Hebrew and English text, preview, reach, confirm with the number, sent list with counts);
API `/admin/broadcasts` sends each person one push in their app language, only to real accounts with a phone, never on
WhatsApp, and never to someone with the new "App updates" switch off (Settings > Notifications, on by default), All
notifications off, in quiet mode or in quiet hours (not sent later). A changed reach, a send still going or the same
words within the hour are refused. Lawyer question on default-on PM-441. API tests pass; root `pnpm check` passes; e2e
`tools/e2e/admin-updates.cjs` 10/10 (push service stubbed). Next: API deploy (migration), web deploy, OTA.
23 Nov 2026 (Jira PM-436): Guy gets $60-80 a week of OpenAI invoices with 4 testers. Fly logs 16-22 Nov: production
text calls (mentor, agents, titles, openers, meal photos, labs) about 5M input / 0.24M output tokens in 6 days, about $12
a week at gpt-6.1-sol list price; live voice negligible. The rest is the Fly regression set (44 runs 17-23 Nov, 138
turns plus a judge each). Approved and built: staged eval repeats (a failing first repeat stops the run; deploy-api asks
for 3 repeats only when the companion's own rules changed or the last full pass is over a day old, else 1), repeats as
passes over all cases for the prompt cache, tokens per model (and cost with STEADY_OPENAI_PRICES) in the verdict, the
mentor prompt's changing parts moved last for caching, conversation titles on gpt-6-luna with fallback (api #194). Next:
Guy sets STEADY_OPENAI_PRICES='{"gpt-6.1-sol":[2,0.1,10],"gpt-6-luna":[0.1,0.01,0.5]}' on stedio-api; read the
first runs' usage to confirm the saving.
Evening (Guy, 23 Nov 2026): the new stedio key reached $13 in a day, nearly all regression runs. Guy decided: the daily
and weekly summary notes on a model half the price (`openai_summary_model` = gpt-6.1-terra, main model as fallback;
visit prep and the mentor stay on gpt-6.1-sol), prompt_cache_key per model, and NO regression run on each change or
deploy: `stedio-fly deploy-api` only prints a note when the companion is untested, and a run (`stedio-fly evals`) is
suggested to Guy near the end of a day with many companion changes (CLAUDE.md, replaces the 17 Nov PM-198 rule).

23 Nov 2026 (Jira PM-428, app #261): Guy asked that a clinic's connection request pop up in the app so the person can
approve it at once, with a push too. The request now opens as a sheet over the main screens: when the app opens or comes
back, at once when its push arrives while the app is open (no second banner then; it stays in the notification list),
and when the push is tapped (which used to open Settings > Sharing > the request page). It is the request page's content
(clinic, who asked, the parts with glucose always, the consent lines) with Share, Decline and Not now. Each request pops
up by itself once per phone (ids only, in the phone's preferences); Not now leaves it on the main screen and in Settings.
Not while viewing someone, during sign-in, onboarding or a consent update, under the app lock or in Quiet mode. The push
itself was already sent (`clinic_request`) and still follows All notifications off and Quiet mode. The request page's
decline button now says "Decline" (it used to say "Not now" but declined). Guy then found his own invite (to his account email) never reached the app: the
request of 19 Nov had been stored without an account (`patient_id` NULL, no `clinic_request` push ever), and asking
again only returned the open request. Now `/care-team` joins a waiting request to the account with the same keyed email,
and asking again while it waits joins a newer account and pushes again (at most once an hour, no second email; api
#193). The clinic portal's Patients list shows waiting invites too (web #65). Root `pnpm check` passed; e2e
`tools/e2e/clinic-request.cjs` 34/34 (web; the push paths need a phone). No API change. Next: OTA.
23 Nov 2026 (Jira PM-437): Guy: when the infusion set was changed three days ago, recommend changing it on the fourth
day, and add a "Change recommended" (מומלץ להחליף) badge where Overview shows the set change. From the start of the local
day after the set's rated days (the change day is day 1; standard 3, extended 7 from Treatment settings; 3 when no set
type is chosen, Guy's rule) `GET /devices/equipment` says `set_change_recommended` and Overview's set row shows the badge,
for the person and for followers (the yes/no only, never the set type). People who turned on the set reminder, and
followers with set reminders, get one push that day from 08:00 (once per set; it replaces any set reminder still ahead);
All notifications off, Quiet mode and quiet hours withhold it as for every push. API tests pass; root `pnpm check` passes;
e2e `tools/e2e/set-change-recommended.cjs` 13/13. Next: API deploy, then OTA.
23 Nov 2026 (Jira PM-429): Guy: an admin who signs in on the website was taken straight into their own app; the admin
pages should come first. The website's "Sign in" opens the app (/app), and the admin pages keep their own in-memory
sign-in (G-12), so the app now hands them a session: API `POST /auth/admin-session` (admins only) issues a separate
token family; the app on the website (not the phone, not the demo frame) passes it through this tab's sessionStorage
(read and removed at once by the dashboard, ignored after 2 minutes) and opens /dashboard/admin, right after an
admin signs in and when an admin opens /app at its start. The admin pages' "My area (the app)" link now opens
/app/companion, so it stays in the app; Profile > Admin uses the same handoff. API auth tests, root `pnpm check`
parts (guard, typecheck, lint, app 289 and web 13 tests) pass; e2e in the container (API + Next + app web export,
Playwright): admin lands on Accounts, "My app" opens the app, a regular user is unchanged. Next: API deploy, web
deploy, OTA.
23 Nov 2026 (Jira PM-432, PM-434): Guy: insights repeat every day; general ones belong in the insights list, and a
recurring pattern should prepare the person before the meal, like a mentor. Plan approved (behaviour-only words before
the meal, in the app only, all users, lows never, 45 minutes before; lawyer question PM-433). Built: general insights
(rise, timing, above, range_good, meal_time) leave the main screen; one mentor moment a day before a usual meal (log it,
or an earlier dinner; a meal usually followed by a rise is chosen but never named before it), a look back 2 to 5 hours
after the logged meal that opens it in the journal, rest after two days left; steadier insight tracking (a change must
hold two runs, a topic back within 14 days returns quietly); the late-lunch "not yet" reply no longer says "keeps
diabetes balanced" (PM-434). API `GET /insights/moment`, read keys `mo:`/`mb:`, history in `routine_state` and the
export (`mentor_moments.csv`); no migration. API tests pass except `test_body_over_the_last_24_hours_rolls_past_midnight`,
which fails on main too at this hour; root `pnpm check` passes; e2e `tools/e2e/mentor-moments.cjs` 8/8 en and he.
Merged 23 Nov (api #191, app #263). Next: API deploy, then OTA.

23 Nov 2026 (Jira PM-439, api #196): the eval gate for the PM-428/429/435/437 deploy failed on he-scope-09 ("my
daughter is at 300"): the mentor listed symptoms and added its own "seek urgent help". One prompt rule: with only a
number and no symptoms, it lists no symptoms and adds no urgent-care instruction, pointing only to the care plan, care
team and the emergency call (PM-205 unchanged). Fly regression set passed on fcbb583 (189/189). Next: API deploy.

23 Nov 2026 (Jira PM-431, api #189): Guy's feedback on the morning recap and weekly comparison (WhatsApp and app):
don't open with yesterday's in-range share (he knows it, and on a bad day "you were in your range" reads wrong); one
meal logged by someone who logs three matters more than what it was; the weekly bullet had too many numbers; nudge to
action in a measured, mentor-like way. The recap now compares the day honestly with the week before, leads with a drop
in meal logging against the person's own 14-day usual (app-logged, not hidden, no pump carbs) with one open question,
keeps to two figures a fact, and may end with one small step about noticing or logging. The weeks are told in words,
up to four facts; a recap or weekly fact with more than 5 figures is dropped in code. The chat prompt no longer adds
its own "don't change your settings" (he-hard-04). API tests pass; Fly regression set on bf1720b passed (189/189 hard
rules). Next: API deploy (no OTA needed).

23 Nov 2026 (Jira PM-425): Guy asked for favorites in meal logging: save a meal to favorites, pick one when logging (the
same breakfast every day, fewer photo-analysis calls), and suggest once to photograph a favorite that has no photo.
Usual meals (DAP-15) are now "Favorites"/"מועדפים" with a star. The meal review has "Also save to favorites" with a
name (saved with the meal; hidden for a favorite, a journal edit or after a correction); the saved screen keeps "Add to
favorites". A favorite keeps the meal's first photo, shown in its row; one without a photo gets a single suggestion on
the saved screen (camera only, uploaded and kept with the favorite, never analysed; not offered with "delete after
analysis", a parent's photo block or the web demo). Logging a favorite clears earlier photos and calls no model. The
favorite photo follows the photo setting like any meal photo and goes with the favorite or the account. API migration
`c5e7a9b1d3f6`, `PATCH /meal/usual/{id}`. Root `pnpm check` and API tests pass; e2e `tools/e2e/favorites.cjs` 43/43.
Next: API deploy, then OTA.

23 Nov 2026 (Jira PM-424, app #260, api #184): Guy saw "Your first days" still listing meal-time impressions he had
already answered ("no need to show what they already answered; the model should learn from it"). Impressions answered
before the screen opens are hidden (one answered in this visit stays until leaving, so a mis-tap can be changed); with
all answered, the intro about impressions is dropped. The API keeps the time shown with each answer and tells the
companion which meal times were confirmed, which were wrong (not to be assumed) and not to ask again; the answers are in
every export (`first_days_answers.csv`). Root `pnpm check` and the API suite pass (3 numpy forecast tests fail as on
main). Companion regression set not run here (no key); deploy-api runs it first. Next: API deploy, then OTA.

23 Nov 2026 (Jira PM-423, app #257): Guy saw a face mask on the character and didn't know why (the poor-air weather
look, European AQI above 60). The Talk greeting bubble now adds one line for each weather look the character has on
(mask, sunglasses, hat and scarf), in the conversation language; not in Classic Stedio or while viewing someone. The
bubbles sit 14 pt higher, clear of the character (Guy: too close). Root `pnpm check` passed. No integration changed.
Next: OTA.

23 Nov 2026 (Jira PM-420): Guy at 01:13 on Overview > 24h saw "Food today" with 0 meals and 0 g carbs (and 18 steps)
although he ate at 13:34: the Body and Food cards treated 24h as the calendar day. 24h is now the rolling last 24 hours
for every tile (meals, carbs, protein, weighed; steps, distance, heart rate, exercise, energy; resting heart rate the
latest in the window; sleep the last night that ended in it), titles "Body/Food, last 24 hours", and the tiles' sheets
show the same window. Day stays the calendar day. API `GET /health-data/window`; no migration. Root `pnpm check` and API
body tests pass; e2e `tools/e2e/rolling-24h.cjs` on the web export. Next: API deploy, then OTA.

23 Nov 2026 (Jira PM-426, PM-427): Guy agreed to name in the privacy policy what followers see since PM-422 (sensor
state, last set change, the pump's sensor time left) and their own reminders; the always-shared part is now "Readings,
time in range, sensor and set changes". Folded in Guy's rename of the AI to "mentor" in privacy and terms (en, he) and
six consent strings, so there is one re-consent: privacy and terms versions `2026-11-23T08:00:00Z` (api #186, #187;
web #62, #63). Root `pnpm check` and `tests/test_legal.py` pass. Next: API and web deploy, then OTA.

22 Nov 2026 (Jira PM-422): Guy asked that someone viewing another person's data see the set change and sensor rows
at the bottom of Overview, view only; that the viewer can set a reminder for themselves about that person's set or
sensor change; and that a person can set a reminder before a set change like the sensor one. API: `GET /devices/equipment`
(followers read it with the glucose part; the device connection and its events stay private), set change reminder from
the set type in Treatment settings plus the last change, viewer reminders kept on the share (migration `a3c5e7f9b1d4`).
App: StatusRows reads the new endpoint, Notifications has "Infusion set change", viewer settings have "Reminders for
you about {name}". API tests and root `pnpm check` pass; e2e `tools/e2e/viewer-equipment.cjs` 29/29. Next: API deploy,
then OTA.

22 Nov 2026 (Jira PM-419, api, root i18n): Guy: someone who had just installed the app already had a new item in
Stedio's wardrobe, earned from history the first sync imported, and "it's the sensor that does it, not him". Every
companion unlock rule now counts only what the person did after joining (messages, meals they logged, workouts that
happened after joining counted once, days they logged or talked, steps and active energy bests after the joining day);
the sensor-days rule is gone and time-in-range wins no longer open items. Small wins (G-43) are kept only for days and
periods after the joining day. Young mode's "move" needs an activity that happened that day. Items already opened stay.
API #181 merged (full suite passes except 3 forecast tests that need numpy, failing the same on main); i18n tests pass. No integration changed. Next: API deploy, then OTA for the two "days" strings.

22 Nov 2026 (Jira PM-418, api #179): the fc-v2 retrain ran inside the worker on the shared 512 MB API machine and
pushed it into swap (every screen slow, health check failed ~20:25 UTC). Training now runs in its own child process
(nice 19, one thread, 350 MB data cap, dies with the worker, 15 min limit, starts only with >= 300 MB free) on at most
60,000 sampled rows of 90 days with float32 features (local run: 438 MB -> ~210 MB, one core). Requests never unpickle
an older model. Next: API deploy (no OTA).

22 Nov 2026 (Jira PM-413, api #178): Guy: the glucose estimate should use the sensor's rate of change and every signal
that can affect glucose. fc-v2 adds slopes over 15 and 30 minutes, their change and the trend arrow, protein and fat,
the pump's automatic insulin apart from boluses, time since meal and bolus, heart rate, steps, sleep and pump modes;
boosted trees per horizon band, ridge penalty by GCV, input importance in the metrics. Forecast tests pass. Next: API
deploy (no migration; the model retrains on the next worker pass).

22 Nov 2026 (Jira PM-417, app #255): Guy asked to zoom the Overview 24h and Day graph with two fingers. A pinch zooms the
time axis around the fingers (down to one hour); while zoomed a sideways drag moves it, a vertical drag still scrolls,
and a double tap (or a new period or day) shows the whole period. Every layer follows the zoom (line, dots, band, now
line, the owner-only estimate, meal icons and tap slots); nothing else in the look changed. Plain React Native, so it
ships by OTA. Root `pnpm check` passed; e2e `tools/e2e/graph-zoom.cjs` 11/11 with touch input on the web export. No
integration changed. Next: OTA, then a pinch on Guy's phone.

22 Nov 2026 (Jira PM-416, app #254, web #61): Guy saw "Tue 03/11" on the Test results list, without the year. Lab
dates always carry the year (PM-389): the report-day rows now show weekday + date with the year in the device's order,
Journal lab entries show that date instead of the stored ISO text, and the clinic portal's lab rows and lab chart add
the year. The web demo runs the app's web build. Root `pnpm check` passed. No integration changed. Next: OTA and web
deploy.

22 Nov 2026 (Jira PM-413, api, app): Guy asked for an ML estimate of the rest of today's glucose as a dashed line on the
Overview day chart, for his own account only, and on a finished day the estimate beside the sensor line, so it can be
judged and learn. This is an owner-only research experiment: the 17 Nov "no forecasting" rule stays for everyone else.
`users.forecast_enabled` is set by migration `f9b1c3d5e7a2` for one account, matched by the SHA-256 of its email;
`GET /forecast/day` answers 404 to every other account and to any request with X-View-As. The worker retrains a per-person
model once a day (five candidates; per horizon the one with the lowest validation MAE; test MAE beside persistence and
the time-of-day average is kept in the model's metrics), keeps an estimate every 30 minutes and scores it once its day
is over. The app draws the dashed line (hindsight an hour ahead, then the live estimate), a legend item and a note with
the typical error. API tests and app tests pass; e2e `tools/e2e/forecast.cjs` 9/9 on the web export with simulated
data. Next: API deploy (scikit-learn joins the image), then OTA.

22 Nov 2026 (Jira PM-412, api #175, app #252): Guy was asked to sign in again while the app was open, and the re-login
screen offered only email and password. Cause, from the code (production logs could not be read: the Mac was offline):
refresh tokens rotate, and any rotated token coming back ended the whole session family, so a refresh whose answer
never reached the app (a deploy restarting the server, the 15 s timeout, iOS suspending the app) signed the person out
on the next refresh. Now a rotated token whose successor was never used rotates again and the unused one is
withdrawn; a reuse after a later use, or a withdrawn token coming back, still ends the family. The refresh waits up to
60 s. The session-expired screen offers Apple and Google like sign-in. Next: API deploy, then OTA.

22 Nov 2026 (Jira PM-407, api #174): Guy got "Had dinner?" on WhatsApp at 11:02 the morning after logging a late dinner,
then "Had breakfast?". The dinner question had waited behind a WhatsApp template overnight and was released, unchecked,
when he tapped the next check-in. A meal check-in from the routine now lapses once any meal is logged since that part of
the day began (a dinner after 23:00, or a meal entered later with an earlier time, counts) and once that part of the day
is over; `tick` withdraws it and `deliver_waiting` drops its waiting WhatsApp text. No meal question is made after its
part of the day ends. API tests pass. Next: API deploy.

22 Nov 2026 (Jira PM-408, app #250): Guy: when a card on the Talk screen's insights card asks the person to log
something ("Had breakfast? You can log it"), the card has a button that opens the logging form straight away. A
check-in or reminder whose follow-up `topic` is meal, insulin, glucose or activity (the API already sends it; the
routine's meal check-ins and the companion's check-ins set it) gets a third chip, "Log meal" / "Log insulin" / "Log
glucose" / "Log activity", beside "Answer now" and "Mark as read". It opens Log a meal or the matching Quick log form
with the form's own time (now); nothing is prefilled from the question. Hidden while viewing someone else. Removing the
card after the record is logged is the API's job (PM-407, separate thread). App 268 tests; e2e
`tools/e2e/log-from-checkin.cjs` 5/5 in Hebrew and English. Not yet seen on a phone. Next: OTA.

22 Nov 2026 (Jira PM-406, api #172): Guy: while the app's quiet mode is on, WhatsApp sends nothing either. The
agents' notes (yesterday, the weeks, a visit) now wait for the end of quiet mode while still fresh, a text waiting
behind a template goes only when its button is tapped, and `proactive.deliver` refuses any proactive kind (pushes were
already withheld in `push.send`). Replies to what the person writes are unchanged. Full API suite passes (881). Next:
API deploy.

22 Nov 2026 (Jira PM-410, app #251, api #173): Guy: the meal sheet's "Back to start" becomes "Back in range". With the
person's own range it is the time from the meal until glucose was back inside the range after leaving it (the reading
at the meal counts), or "Stayed in range". It is searched as in PM-315 (up to 6 h, stopping at the next meal or
workout). Without a range it stays "Back to start". The biggest-rises card and the clinic report use the same rule.
Typecheck, 273 app tests and 878 API tests pass; not yet seen on a phone. API deploy first, then OTA.

22 Nov 2026 (Jira PM-409, app #249): Guy: an Overview tile with no data for the chosen period (awakenings, in bed)
is not shown. Body and Nutrition leave such tiles out until they have data (still chosen); a Body section whose chosen
tiles are all empty keeps its heading and pencil with one "No data" line. Typecheck and 267 app tests pass; OTA next.

21 Nov 2026 (Jira PM-402, app #246): Guy: the add sheet's Insulin taken, Activity and Glucose forms, and the journal's
edit form, pick the day as well as the time. Each gets the calendar beside the time that the meal form has (PM-343);
`TimeField`'s `pastDay` prop holds the rule once (a time later than now on the picked day goes to the day before, a
picked day is never later than now, the calendar stops at today), and the day beside the time shows the device-region
date with the year (PM-389). Note and Habit have no time field and are unchanged. Type check, app tests (262) and the
i18n tests pass; journal edit checked on the web dev build. Not yet seen on a phone. Next: OTA.

21 Nov 2026 (Jira PM-404, api #171, app #248): Guy's follow-up on the Zz sheet. It shows the daily schedule when it is
on (hours and days), adds "Starting from" (now or a chosen time; "How long" counts from the start; the server keeps the
start in `break_since` and holds nothing until it comes; a start still to come shows with Cancel, and in Settings as
"Off · starts at"), and a hold on Zz no longer switches it to its selected look (selected = schedule on or a later start).
Checked on the web export against the e2e server in Hebrew (screenshots in /mnt/project-files/steady/quiet-pm404/); not
yet on a phone. The API must be deployed before the OTA.

21 Nov 2026 (Jira PM-398, app #241): Guy: when anything is set in Zz (quiet mode), such as a schedule, the Zz button on
the Talk screen shows its selected state. It is selected while quiet mode is on (by hand or timed) or its daily schedule
is on, in Duet's selected look (accent-soft fill, accent ring, accent icon) with VoiceOver "selected". Type check, lint
and the app's 257 tests pass; not yet seen on a simulator or phone (ships in the next testers OTA).

21 Nov 2026 (Jira PM-386, PM-388): Guy chose all six parental permissions for Kids and Teen mode. A confirmed parent's
"{name}'s Kids/Teen mode" screen now also has: meal photo reading, and in Teen mode WhatsApp, lab report reading and
weather and location (all on by default; off closes the server path with 403 `off_by_parent`, unlinks WhatsApp, forgets
the weather), quiet hours' times (on the half hour), and "My OK for new followers" (a young person's new follower is kept
with `shares.parent_needed` and sees nothing until the parent approves; declining ends the share). Migration
`e2f4a6b8c0d5`. The child sees every switch on "Set by your parent" (now for teens too); closed ways leave the app (meal
photo buttons, lab photo buttons, weather toggle). Privacy policy updated (en, he), version `2026-11-21T21:00:00Z`.
PM-388: relationship chips on Sharing and the invite screen are a dropdown (`components/SelectRow.tsx`). Checks: API
tests, app 257, browser runs `tools/e2e/parent-permissions.cjs` 13/13 and `tools/e2e/sharing.cjs` relation step.
G-121, G-122. Next: API deploy, web deploy, OTA.

21 Nov 2026 (Jira PM-394, thread "Add Journal sub-filters"): Guy: the main card of the "What would you like to log?"
sheet reads "Meal photo" / "צילום ארוחה" (existing `com.ql_photo`; `com.qa_m` unchanged elsewhere). App #236. Next: OTA.

21 Nov 2026 (Jira PM-385): Guy: while viewing someone who shares with him, Settings shows his own "Sharing settings"
last, under "Your own sharing", since they are not about the person viewed. A "Name or nickname" field at the top lets
the viewer call the person by a name of their own (`shares.viewer_nickname`, migration `d1e3f5a7b9c4`, `PUT
/sharing/{id}/nickname`, viewer only). It shows in the viewing strip, switcher, viewer wording and the viewer's
companion; the owner's account is unchanged; empty goes back to the person's name. API tests, app 257, browser run
`tools/e2e/viewer-nickname.cjs` 11/11 (en light, he dark). Next: API deploy, then OTA. G-120.

21 Nov 2026 (Jira PM-383): Guy: Settings > Membership ends with "Invite someone to Stedio" ("להזמין מישהו ל-Stedio").
It opens WhatsApp with a ready message (`sub.invite_msg`: a short pitch and the website install page `/en/get`); without
WhatsApp the system share sheet opens. No personal data in the message, nothing sent to the server. App #227. Not yet
seen on a phone. Next: OTA.

21 Nov 2026 (Jira PM-405, same thread): Guy: when the Talk pull is let go, the crushed character jumps out and does a
different trick each time (somersault, double spin, boing, wiggle, proud puff, shake; never twice in a row). App #247.

21 Nov 2026 (Jira PM-400, same thread): Guy: on the Talk pull to refresh the character is really crushed (to about a
third of its height) and looks scared (eyes wide and open, a round gasp) while pulled. App #243.

21 Nov 2026 (Jira PM-393, same thread): Guy: the Talk screen layout stays as it was. Stedio's follow-up question
(Duet 3.4, PM-340) no longer replaces "Tap to talk" with a row of voice/text answers; it takes turns with the greeting
in the speech bubble (tap for text or voice). App #234.

21 Nov 2026 (Jira PM-390, same thread): Guy's iPhone screenshot: the Talk tiles' top was cut under the status bar,
both tiles should be smaller, and the hat covered the greeting bubble. The idle scroll area now starts below the status
bar (filled with the glow's first colour), the tiles are smaller (number 48, padding 12/15, after Guy found 44 too small), and `VoiceOrb` keeps room
above the idle character for what is on its head. App #231.

21 Nov 2026 (Jira PM-381): Guy: the Talk screen gets pull to refresh like Overview and Journal (sources synced, then
the reading, records, device events, pump active insulin, sensor state, insight tiles/cards and young-mode cards load
again; also on the viewer's Talk home without a source sync). While pulling on iOS the character is pressed flat from
the top in proportion to the pull and springs back on release (`features/refresh/pullSquash.ts`, `VoiceOrb`
`pressDown`); Android squashes once when the refresh starts. App #226. Native pull not yet seen on a phone.

21 Nov 2026 (Jira PM-384, thread "Add Journal sub-filters"): Guy: switching to view someone else's data lands on
Talk, not Overview (Switch menu, view-as link, and app launch while viewing). `tools/e2e/switch-person.cjs` checks the
landing; 0 failures in three looks. App #229. Next: OTA.

21 Nov 2026 (Jira PM-397, same thread): Guy: the period tabs come before time in range and the whole Overview follows the
chosen period. Order: latest reading, period and dates, time in range, Insights, graph, biggest rises, Body, Food, then the
rest. Body and Food for any period other than today are a day on average over the period's days (capped at today and 92),
with "On N days" under each tile; one past day shows that day; a tile with no data says so. New API
`GET /health-data/period?from&to` (API #170); food uses `/nutrition/summary?from&to`. Device status rows stay "now" only.
App #245; API 876 tests, app 261; Playwright he light and en dark (week). Next: deploy API, then OTA.

21 Nov 2026 (Jira PM-395, same thread): Guy changed his mind on PM-382: the latest reading card is back on the Overview,
first on the page ("צריך להחזיר את התוצאת סוכר ... שיהיה ראשון בעמוד"), with its stale, warm-up and sensor-updating states
and strings. Order: latest reading, time in range, Insights, period and graph, biggest rises, Body today, Food today,
then the rest. App #237; root `pnpm check` green (app 257); Playwright he light and en dark. Next: OTA.

21 Nov 2026 (Jira PM-391, same thread): Guy: on the Overview the Insights row comes right after time in range ("תובנות
צריכות להיות אחרי זמן בטווח"). Order: time in range, Insights, period and graph, biggest rises, Body today, Food today,
then the rest. App #235; root `pnpm check` green (app 257); Playwright he light and en dark. Next: OTA.

21 Nov 2026 (Jira PM-382, thread "Reorder the Overview sections"): Guy: the Overview no longer shows the latest reading
card ("לא צריך את הקומפוננטה של המדידה האחרונה"; the Talk screen keeps the reading and its stale note). Order now: time in
range, period, graph, the biggest rises, Body today, Food today, then the rest. The "Choose what to show" row is gone; a
pencil right after the Body today title (left of it in Hebrew) opens the same tile picker. Strings `ovr.r_pick` and
`ovr.stale*` removed. App #228; root `pnpm check` green (app 257); Playwright on the web export (he light, en dark): pencil
opens the picker, screenshots `/mnt/project-files/steady/overview-pm382/`. Next: OTA.

21 Nov 2026 (Jira PM-378, same thread): Guy: the Overview graph no longer shows the "Your range ... · your
time-in-range setting in CareLink" and "No data" legend lines (five unused strings removed); the range band is still
drawn. App #224. Next: OTA.

21 Nov 2026 (Jira PM-377, same thread): Guy: the source settings screen (MiniMed · CareLink) no longer shows the pump
alerts and messages card (its four `set.cl_note*` strings removed); the connection and pump status cards stay, and
the alerts stay in the Journal's Alerts tab. App #223. Next: OTA.

21 Nov 2026 (Jira PM-376, same thread): Guy asked to show only the kind of entry, not the source's name ("חיישן •
CareLink" read as both). Journal reading rows say Sensor, the device badge says Device, pump alerts and modes say "From
the pump", and the Overview latest reading, its graph readout and the Talk screen's reading lines say Sensor or Meter.
An entry's detail keeps its labelled Source row. App #222; browser run 39/39 (a check that no row shows "CareLink").
Next: OTA.

21 Nov 2026 (Jira PM-375, same thread): Guy changed the Insulin options to "auto correction" (the pump's automatic
corrections, CareLink and Tandem) and "bolus" (boluses the person gave, meal or manual). Basal is no longer an option
(pumps record boluses only); it shows only with no insulin option. On All a row shows only if, for each kind with a
choice, one of its entries of that kind passes, so a reading holding only an automatic correction stays out under Bolus.
App #221; app tests 257, browser run 36/36, screenshots `/mnt/project-files/steady/journal-filters/pm-375/`. Next: OTA.

21 Nov 2026 (Jira PM-372, thread "Add sub-filters to Journal tabs"): Guy asked for options inside the Journal's filter
tabs. A long press on Glucose, Insulin, Meals, Alerts or All opens a sheet (a tap on the selected tab, which shows a
chevron, opens it too): glucose continuous or one reading every 2 hours (first reading of each local two-hour block),
bolus or basal (basal = logged as basal or an insulin named as basal in the person's own profile; pump records are
boluses), small meals (<= 30 g carbs) or large (> 30 g), alerts low / high / set change / sensor change; All offers
every kind and each choice narrows only its own kind. The tab shows its choice ("Insulin · Bolus", "All · 3") and a
"Filtered" line with Clear shows while a choice is on. App only, no API (app #220). Tests: app 256, i18n 20, browser run
`tools/e2e/journal-filters.cjs` 33/33 (he dark, en light, he light), screenshots `/mnt/project-files/steady/journal-filters/`.
Not yet seen at iOS large text sizes or on a phone. Next: testers OTA.

21 Nov 2026 (Jira PM-368, thread "Open meal photos full screen on tap"): Guy asked that tapping a photographed meal's
photo wherever it shows later opens it full screen. Built one shared `PhotoViewer` (app `components/`): black
background, pinch or double tap to zoom (up to 4x), drag while zoomed, close with the X on the leading side (right in
Hebrew) or a swipe down; plain Animated + PanResponder, so it ships by OTA. `MealPhoto` opens it, which covers every
place a saved meal photo appears (Journal meal detail, Overview meal/day sheet). Chat and the meal curve card show no
photo, so nothing changed there; the review screen while logging is not a "later" record and was left as it is.
`pnpm check` passes (app 245 tests); e2e `tools/e2e/photo-viewer.cjs` 9/9 on the web build. Merged (app #217) on Guy's
go-ahead to merge and deploy everything finished; next: testers OTA (app only, no API).

21 Nov 2026 (Jira PM-365, thread "Stop WhatsApp messages after opt-out"): a tester asked on WhatsApp not to get
updates; the companion promised to stop but nothing recorded it, so a meal nudge still went. Guy's rule: once a person
asks to stop, Stedio sends no proactive WhatsApp message of any kind and only answers when they write. Built in the API
(#163): `whatsapp_links.proactive_off_at` (migration `b3d5f7a9c1e2`), a narrow Hebrew/English matcher
(`texts.asks_updates_off` / `asks_updates_on`) checked before the companion with a fixed confirmation line, one gate in
`proactive.deliver`, `deliver_waiting` and `notes_due` (waiting template texts are dropped), the Settings > WhatsApp card
shows every kind off (`updates_off`) and turning one on restarts them, relinking keeps the stop. STOP still unlinks.
One-off `python -m steady_api.whatsapp.stop_backfill [--apply]` sets the stop for earlier asks (counts only). What
WhatsApp no longer takes goes as the app push, under the app's own notification switches. Next: deploy API, run the
backfill.

21 Nov 2026 (Jira PM-389, thread "Stop Overview listing every lab result"): Guy saw a 3 Nov 2026 test as "11.03".
Numeric dates (`apps/mobile/src/i18n/dates.ts`) now follow the device locale's day/month order and separator instead
of the app language (this replaces the 17 Nov "mm.dd in English" rule); lab dates and the date of birth always carry
the year (03/11/2026). Stored dates were right. App #232. App only. Next: testers OTA; check on Guy's iPhone that
Hermes gives the region order.

21 Nov 2026 (Jira PM-379, thread "Stop Overview listing every lab result"): Guy saw labs twice on Overview. The
"Latest lab result" row in the status group (beside "Choose what to show") is removed; "Recent labs" under "Labs and
habits" (PM-363) stays. `ovr.r_lab` string removed. App #225 (also carries PM-378). Next: testers OTA (app only).

21 Nov 2026 (Jira PM-363, thread "Stop Overview listing every lab result"): after Itay uploaded a lab report, the
Overview "Labs and habits" card listed every test. Guy chose (21 Nov): one "Recent labs" row (number of tests and the
date) that opens all lab results, shown only when tests were done in the last 31 days; habits as before. Labs now read
from `/labs` (no 92-day window; Guy's 2025 report was outside it, which is why he saw no card). The key-labs list of
app #213 was replaced before any OTA. App #213, #215. App tests 242; web shots `/mnt/project-files/steady/release/pm-363/`.
Next: testers OTA (app only, no API).

21 Nov 2026 (Jira PM-362, thread "Lock device-sourced data from editing"): Guy: data that came from a source (carbs,
insulin, glucose) must not be editable anywhere. API: `steady_api/sources.py` (person sources manual, voice,
photo-estimate, conversation); PATCH and DELETE on `/records` and `/glucose` return 409 `source_read_only` for anything
else; the companion's meal clarification never changes a device's entry (api #164). App: device entries use the board's
device state (no Edit, no swipe delete, the device note and Hide); the Overview breakdown treats every non-person
source as the pump's (app #216). Web was already read-only. Still allowed on device data: Hide, the pump meal food note
(PM-110), the same-meal link (G-47), bulk removal on disconnect, account deletion. Open: privacy policy says "edit any
record" (Guy to choose when to release the wording). Next: deploy API, then OTA.

21 Nov 2026 (Jira PM-359, PM-367, thread "Simplify birth date and add sex in onboarding"): Guy asked for the date of
birth as one field with a wheel and for a sex question. Built and merged: one Duet-style field that opens the native
day/month/year wheel (dd.mm.yyyy in Hebrew, mm.dd.yyyy in English), Sex chips (Female, Male, Prefer not to say) on the
same step, `sex` in the profile answers (no migration), "sex female/male" in the companion's context, privacy policy EN+HE
with version 2026-11-21T17:30:00Z (forced re-accept), G-119. PM-367 (Guy's screenshot): Back, Skip and Continue all did
the same thing and every tap was saved; now a step's answers are saved only by Continue, Skip moves on without saving,
Back saves nothing, and "Complete your profile" walks the open questions. Seen on the iOS simulator with a local test
account (app #218, api #165, web #59). Next: deploy API and web, then OTA.

21 Nov 2026 (Jira PM-353, thread "Let iPhone testers register their device themselves"): Guy's new iPhone tester got
stuck: the /get/iphone step sent people to sign in (which hung at Google on the iPhone) although self-registration is
off (no STEADY_EXPO_TOKEN). Correction to PM-290: the Mac found that `eas device:create` returns the same team link
every time (expo.dev/register-device/2f2b16a0-…) and several phones registered through it, so the link is team-wide,
not one phone. Built: API public `GET /auth/ios-device/available` (#161); web: while it is false the step shows the
standing link and no sign-in (#58). Google sign-in on iPhone Safari (button renders, click does nothing) is still
open in PM-353: no COOP header in our code, so the next suspect is the OAuth client's authorized origins or Safari's
popup handling. Next: deploy API then web.

21 Nov 2026 (Jira PM-380, thread "Detect infusion set changes from CareLink"): a false "set changed" showed at 18:57
Israel; Guy had not changed his set. PM-327 kept any reservoir rise of 5 U between polls and dated it at the poll when
no pump stop came before. Now a rise needs a pump stop in the 3 h before it, at least 20 U / 10 %, and the pump in
reach on both polls; migration `c4e6a8b0d2f3` removes live set changes with no stop before them (api #167). API tests
871 passed. Deploy: API with the data migration, no app change.

20 Nov 2026 (Jira PM-335 under design PM-334, thread "Implement the Duet design"): Guy approved the round 4 "Duet"
design and asked to implement all of it, never removing a feature or inventing data, and to see it on the simulator
before any deploy, OTA or build. Built in app branch `claude/project-thread-ja0cv9`: Rubik (OFL, bundled, OTA-safe),
the Duet day and night palettes and type scale (`packages/tokens/src/duet.ts`, app only; web keeps tokens.css), core
components, Settings hub with search and a WhatsApp screen, Home (solid glucose block beside time in range, the day's
line from real sensor readings when it fits without shrinking the character, insight card, labelled pills, moon button
for Quiet mode), Overview in the p02 order with the week card (x92) moved from Home, Journal groups and slim reading
rows, quick log, Log a meal, insight rows, Quiet mode colours, and an early onboarding WhatsApp step (y01-y03, Guy 20
Nov: consent, one-time code sent from WhatsApp, connected; only for accounts the server offers WhatsApp to). API: the
WhatsApp fixed lines point to Settings > WhatsApp. `pnpm check` passes. Not yet restyled to the board: sign-in and the
other onboarding steps (shared components only), history, viewer, kids home (p30 tab set needs Guy), most Settings
sub-screens. Next: show Guy on the iOS simulator; nothing is deployed until he approves.

21 Nov 2026 (Jira PM-340, PM-341, thread "Implement the Duet design"): continued the one to one Duet pass, each screen
checked by overlay against `round4/mockups` (overlays in `round4/compare/`). Overview p02: a period line card (dates
and range above, sensor line in the band, labels under it, tap opens the detailed graph with earlier periods, the two
views and the coverage line; "Show less" closes it), time in range with below/above under a gapped bar, latest
reading at 38 with a dotted range tag, Learning and the period summary as rows; six periods kept (Guy). Settings:
devices p19, clinic p24 (a saved next visit as an accent card), report p25, export p26, language p27, accessibility
p28 (contrast says Coming soon), help p29, privacy p22, AI engine sheet z31, sensor connect x80, delete x83,
membership x87, viewer settings p35. Learning p08 (day strip, collected and learned rows) and routine p09. Quiet
mode timing (PM-341: schedule, turn on now, hold the Zz button) in API and app. Deliberate deviations kept: existing
longer consent and help texts, report options and the visit card stay on the report screen (x89 visit screen and
"remind me the day before" not built: new feature, needs Guy), z31 "what is / is never sent" rows not added (needs
lawyer wording), Apple Health "what it sends" rows not added (no per-type data on web), viewer strip kept (Guy).
App tests 240 pass, typecheck clean, lint unchanged. Not deployed; API (break schedule) must go before the OTA.
Next: show Guy on the simulator; kids home p30 tab set needs Guy.
Later on 21 Nov: labs index p16, test date x90 and review x91 (labs e2e now follows the date screen), change history
x86, export ready x85, care team request x88 and shared z34 (ToggleRow takes an icon tile), Overview states (x69 an old
sensor reading first, outlined and grey without its range tag; x70 meter readings never "out of date", the day card
says why there is no time in range and the line shows each reading as a ring on the full 00 to 24 day; z22 the
character with Connect a device and Add a reading), Body and Food today as three-to-a-row tiles (z21), device status as
an icon row (x82). Fixes from the simulator review: the language preview shows no sample reading (unit and the time
now), the Day line spans 00 to 24, the training switch's line no longer says "off by default". Deviations kept: the
x90 Edit link and x91 "Hard to read" flag (no such data or feature), z21 rows for infusion set, sensor end and latest
lab (new composition, needs Guy), z30 WhatsApp keeps its full Meta consent card, line card has no Y labels (as the
board). Shot tooling: CARE (care team), AHEAD (clock ahead), SCROLL and EVAL options in `tools/e2e/duet-shots.cjs`.

21 Nov 2026, later (PM-340, PM-342, Guy on the simulator): Overview opens straight on the detailed graph (no compact
line, no Show less); its time in range card shows only the figure and bar. Week bars: today fills only the part of the
day that has passed. Home has no glucose line any more (Guy: too much information); the time-in-range tile names its
period even without a figure. z21 status rows under Body today (set change, sensor time left, latest lab, tile chooser)
from real data only. Kids mode: tabs Talk / My days / Stickers (journal and Settings rows at the end of My days), My
milestones book with round places (p31), home with "Hi {name}", Your number, Today's challenge and Sticker book tiles
(p30), My days with the quest, week ring, weekly challenge and Stedio grows with you (z54; API now gives a child the
week ring and challenge, Guy's choice). Viewer: strip says only "Viewing {name}", no hint under the title, short privacy
line, room under the strip; cheer card as z40-z43. Not deployed. API change needs deploy before the kids week shows.

21 Nov 2026, night (PM-340, Guy asleep, "keep going"): kids tab bar now follows the young store and the sign-in (a
child who opens straight on Settings got the adult tabs). z52 "Set by your parent" (Settings row for a child, read-only
switches, who and when from the last change only), z58 under-8 screen gains Sign out, Journal filter row fades at its
end, z50 cheer dim 0.97, z51 cheer push names the kind with its sticker ("Mom sent you a high-five! 🙌", api), p33
parent's Kids mode controls in the list style, z54 week as day letters with one list for the challenge and growth
("Last week kept" kept beside the skip-days line). z44 viewer chat follows Guy's later choices (strip "Viewing {name}",
short privacy line), not the board's header card. Not deployed; API (kids week, cheer text) needs deploy first.
Same night, old-design sweep (Guy: no screen may stay in the old design): teen and adult week ring and challenge as
x92 (day letters, trophy card with a bar per day), weekly wins picture flat accent in Rubik, infusion set as a radio
group, first days x67 (answer buttons; the wrong "Logged on 14 of 3 days" line dropped), people I follow as list rows
with swipe to stop following, clinic report preview bar z35 (the preview already existed; no new dependency). Apple
Health "Body today" checked with sample data (shots option BODY=1); it hides only when Health sent nothing today.
The Mac simulator runs against production with Guy's account, so kids/teen screens need a choice from Guy (local test
server, stay on prod, or deploy the API).
20 Nov 2026 (Jira PM-336, thread "Add free barcode food sources"): Guy asked to add only free sources to the barcode
scan, which found Israeli products but few US ones. When Open Food Facts has no product (or no carbohydrate value), the
API now asks USDA FoodData Central's branded foods by GTIN/UPC with the existing food search key (api `barcodes.py`).
FatSecret was checked and left out: barcode lookup is only in Premier Free (application, US data, in-app credit), not
in the free Basic edition; Nutritionix is paid. The privacy policy's USDA line now names the barcode number (privacy
version 2026-11-20, so the app asks everyone to accept again) and the scan screen credits both sources. Next: a real
US product scan on Fly.

20 Nov 2026 (Jira PM-327, thread "Detect infusion set changes from CareLink"): Guy changed his infusion set at about
09:50 Israel time and the journal only showed "basal resumed". CareLink's only set change signal was the 30-day
history's `Agg1d[].setChange` day flag (hourly, dated at midnight); live data has no rewind or prime marker. Each poll
now compares the reservoir (units, else percent) with the previous poll: a rise of 5 U / 5 % or more means a new
reservoir was loaded, and a `set_change` event is kept at the pump stop within 3 h before, else at the poll. The
history's day-only row for that day is moved to the real time or left out (api #153). API tests 809 passed. Deploy:
API only, no app change. Next: confirm on Guy's next set change that the row appears at the right time.

20 Nov 2026 (Jira PM-326, thread "Redo UX audit with UI skills"): Guy asked to install the nine UI skills from the
article "9 Best UI Skills for Claude Code in 2026" and redo the UX audit with them for comparison. Eight are vendored
in `.claude/skills/` after reading them (root #272); shadcn/ui was skipped (not used in Stedio), and parts that download
or run outside code were left out (see `.claude/skills/README.md`). Round 2 of the audit (doc "Stedio UX audit, round
2 (with UI skills)", https://claude.ai/artifact/AmkV1dP77eBTHtb64CZ1mj): 35 findings, native audit 12/20, Nielsen 24/40,
with a side-by-side comparison against round 1 (PM-323). New items include text contrast in the tokens, unvirtualised
Journal lists, the "Estimated A1c" insight title, and unused haptics. Research only; nothing is built until Guy picks.

20 Nov 2026 (Jira PM-328, thread "Fix journal mixing my and Yonatan's data"): switching in the Journal between Guy's own
data and Yonatan's sometimes mixed their entries, or kept the first person's until a pull to refresh. Causes: the
range reads (`useRange`) were keyed only by time window, so a mounted tab kept the other person's answers; an answer
on its way during a switch could land on the new person; `X-View-As` was decided after the token refresh, not when the
screen asked; the Journal showed the phone's own unsent records while viewing. Now every read carries the person it was
asked for, `useRange` keys and drops answers by person, the Journal and Overview tabs start fresh per person
(`PersonScope`), the viewer home is keyed by person, and unsent records show only on one's own data. App #198.
Tests: app typecheck, 239 unit tests (lint errors unchanged from main), browser run `tools/e2e/switch-person.cjs`
(en light, he light, he dark), which fails 6 checks on the app before the fix. App only. Next: testers OTA.

20 Nov 2026 (Jira PM-324, thread "Show glucose scale on meal curve"): Guy could not tell the scale of "Glucose after
this meal" (70-180 or 100-200?). Every glucose chart now has a value column on the right: the person's own range bounds
in the range colour and heavier, plus round values with faint gridlines (`components/glucoseAxis.ts`,
`GlucoseYAxis.tsx`). The meal/workout curve (meal detail, journal, meal sheet, rises, viewer) uses round values, is never
narrower than 100 mg/dL (6 mmol/L) so a small wiggle no longer looks like a spike, is taller (132), and has a legend
("Your range 70-180 mg/dL", "--- At the meal"; existing strings). The Overview day graph and Typical day show
100/200/300 (5/10/15 mmol) plus the range bounds. App #196. App tests 239, e2e `meal-impact.cjs` (en light, he light,
he dark) all pass; screenshots `/mnt/project-files/steady/meal-scale/`. Typical day type-checked only. App only. Next: OTA.

20 Nov 2026 (Jira PM-325, thread "Fix quiet mode on Itay's iPhone"): on Itay's iPhone 17 the quiet mode switch turned
on (the API log shows PUT /follow-ups/break 200) but the reading screen never showed; on Guy's iPhone 16 Pro Max it
did. `BreakScreen` was a plain view after the native stack and also re-checked the stored session's waiting, guardian
and profile flags that the switch does not. It is now a `Modal` (native full-screen layer above the stack and its
sheets), gated like the switch (signed in, own data; the waitlist, onboarding, re-consent and invite screens stay in
NEVER_OVER), and it steps aside while the app lock covers the app (`useLockCovering`). App #197. Tests: app typecheck,
235 unit tests, e2e `take-a-break.cjs` 143/143 on web. Next: testers OTA, then Itay retries on his iPhone 17.

20 Nov 2026 (Jira PM-320, thread "Show sensor updating state with elapsed timer"): Guy asked that "Sensor updating"
look like the warm-up, with a counter of how long it has been happening, and no reading that is not current. API: the
pump's own "Sensor updating" message (CareLink 801) with no sensor reading since, while the CareLink status is fresh and
no later sensor message (change, expired, signal lost, connected) came, is the update (`warmup.updating`, technical
limit 12 h); `GET /devices/warmup` returns `updating {source, since}`, and a follower may read it with the glucose. The
Live Activity push sends it once (`_up` marker) with the warm-up fields too, so today's builds show "Sensor updating" and
"No current reading" without a value; `WordsIn` takes `ut`/`ul`/`un`. App: the main screen's reading tile and pill (adult,
teen, kid) show "Sensor updating", a stopwatch counting up (00:23:14), "No current reading" and since when; the
Overview's latest-reading card (also what a follower sees) shows the same instead of the value; widgets, watch and the
lock-screen card get `us`/`ut`/`ul`, drawn counting up by the next native build (Swift not compiled here). Tests: API 803,
app 234, i18n 20; browser run `tools/e2e/sensor-updating.cjs` (he light, en light, he dark, follower), screenshots in
`/mnt/project-files/steady/sensor-updating/`. Next: deploy API first (the app sends new card words that an older API
refuses), then OTA; the next local native build for the counter on the lock screen, widgets and watch.

20 Nov 2026 (Jira PM-321, PM-322, thread "Fix companion settings and quiet mode layout"): Profile > Companion shows the
accessories (or the plain character while Classic is on) right under the Classic Stedio switch; the kids growth card
and the WhatsApp card come after them. Quiet mode's big number is sized from the width and height it has
(`bigNumberSize`, glyph widths per character), ignores the system text size and has a 1.25x line, so 3-digit mg/dL and
mmol with a decimal fit every phone. Regression fixed on the way: since the main-screen fit change the idle character
never shrank (the rest of its box was measured as 0), so on 375x667 the quiet mode switch slid under the tab bar. App
#195. App tests 235, e2e `take-a-break.cjs` 143/143 (320, 375, 440 wide; he/en; mg/dL and mmol) and
`classic-mode.cjs` pass; screenshots `/mnt/project-files/steady/quiet-mode-fit/`. App only. Next: OTA.

19 Nov 2026 (Jira PM-313, thread "Use third person when viewing someone's account"): Guy asked that while someone
views another person's account, text that says "your" ("בטווח שלך") names the person instead ("בטווח של יונתן"). App:
182 catalog ids now have a viewer variant (`<id>@v`, en and he, `{person}` = the name the share shows) for the main
screen, insights and their details, charts and breakdowns, journal sources, wins, learning days, routine summaries and
the insights strip in the viewer's conversation; `src/i18n/viewer.ts` picks the variant while viewing, so ids without
one (the viewer's own conversation, the viewing strip) are unchanged. Hebrew variants avoid gendered verbs ("נרשם על
ידי", "הסוכר של {person} היה"). Widgets, Live Activity and watch stay one's own and use `tOwn`. API: the viewer
companion is told to speak of the person by name in the third person, never "your range". App tests 227 (new
`viewer-wording.test.ts`), i18n 20, API 787; browser run `tools/e2e/viewer-wording.cjs` 14/14 (he light, en light, he
dark), screenshots in `/mnt/project-files/steady/viewer-wording/`. Regression set not run here (no key); deploy-api runs
it. Next: deploy API, then OTA to testers.

19 Nov 2026 (Jira PM-316, PM-317, clinic portal thread): a suspended clinic member sees "Your clinic access is
suspended" instead of "not on a clinic team", and Admin > Clinics shows the status as text with a separate
Suspend/Restore button (the old status button toggled on click, which is how Guy's own membership was suspended).
A clinic request now also emails the account holder (existing accounts only, no health data) and shows a row on the
app's main screen until answered. A clinician may ask for their own summary. API #147, web #55, app #190.

19 Nov 2026 (Jira PM-318, same thread): Overview shows the biggest rises for a single day too ("Biggest rises today",
"in the last 24 hours", or a date), following a late meal past the end of the day (readings and the next logged meal or
workout up to 6 h after); and the insights come back to Overview as one row "Insights · N" that opens All insights
(not while viewing someone who doesn't share insights). App only. Next: OTA.

19 Nov 2026 (Jira PM-315, thread "Show actual return-to-baseline time after meals"): the meal curve's "Back to start"
now shows the actual time past 3 h (searched up to 6 h, stopping at the next logged meal or workout; the curve extends
to the whole hour after the return), every past meal in the journal shows the curve (pump meals merged into a reading's
or bolus's row too), and Thursday to Saturday the main screen offers "This week's biggest rises", opening Overview's
week at the list (G-118). API: the card's read mark `rises:<date>` (home-read). Same rule as the clinic report
(api #144). App tests 226, API insights tests pass. Next: deploy API, then OTA.

19 Nov 2026 (Jira PM-314, thread "Upgrade the visit report"): Guy asked for the meal sheet's examples in the clinic
report. A new section "Glucose after meals" shows the three meals of the period with the largest rise and one typical
meal (the middle rise of the rest): the meal, carbs and the insulin for it, the curve with the person's own range
shaded, glucose at the meal, the highest and when, the rise and the time back to start. Same rule as the app's meal
sheet: the return is looked for up to 6 h after the meal and not past the next logged meal or workout ("Not within
6 h", "Not before the next meal"). Food names only with the detailed log. API only; no app change.

19 Nov 2026 (Jira PM-309, thread "Make "Today so far" insights about today"): Guy said the Today so far sheet still
listed 14-day patterns ("two hours after dinner: usually 134 -> 153") and asked that it be about today, e.g. what
happened today two hours after dinner and how that compares with the other days. Each routine there now leads with a
"Today" line from today's own readings and meals, with the server's definitions (sensor reading within 15 min of the
meal and 2 h +/- 20 min after; a part of the day is the middle value of its readings, "so far" while it lasts; a
workout's start and an hour after its end; the meal's time), then a "Usually" line with the routine's own medians or
day counts (`Insight.usual`). Keep or improve follows today's value against the person's own range (no other
threshold); routines not tied to today (foods, untimed patterns) go under More patterns; a part of the day still ahead
that is worth preparing for keeps its badge. App only (no API change). App tests 221, e2e `tools/e2e/today-so-far.cjs`
13/13 (he dark, he light, en light), screenshots in `/mnt/project-files/steady/today-so-far/`. Next: OTA to testers.

19 Nov 2026 (Jira PM-297..307, thread "Design a kids mode for under-18 users"): Kids mode (8-12) and Teen mode
(13-17), built from the mockups Guy approved (`/mnt/project-files/steady/young-mode/`), plus the adult items he chose.
API: age band from the date of birth (`users.teen_from`, under 8 refused with `too_young`), parent switches (voice,
quiet hours 21-07, Teen mode a year early) for the confirmed guardian only, cheers (5 a day, quiet push), stickers and
brave badges (`give_badge` tool, `stickers` table), a child's daily quest, a private week ring with two free skip days,
self-chosen weekly challenges, the 18th-birthday handover, quiet hours for every notification (any age), companion tone
and safety lines by age (no weight talk, trusted adult, helplines, no secrets, never parent alerts), Kids mode closes
labs, clinic report, care-team accept and weather; minors cannot follow others; the voice WebSocket now applies the
guardian gate too. Demo: kid, teen and teen-parent scenarios open with a parent and a cheer. Migration `f2a4c6e8b0d1`.
App: quest card, week ring and challenge picker, colourful sticker book / My milestones, brave badge card in chat,
cheer overlay, parent cheer card and young-mode switches, handover sheet, under-8 screen, softer character reactions for
kids, no TIR tile for kids, membership hidden under 18, clinic and weather hidden for kids, quiet hours switch, weekly
wins card saved as an image (adults). Legal: privacy and terms children's section, versions 2026-11-19T21:00:00Z.
Evals: 8 `minors` cases in the regression set. Checked in a browser with the demo scenarios (en, he). Lawyer questions
in PM-302. Next: deploy API (migration), web, then OTA to testers.

19 Nov 2026 (Jira PM-296, thread "Upgrade the visit report"): Itay (Libre, own range 70-120) said the clinic report
showed 70-180. The report now uses the person's own range (from the profile, or the pump's when connected) as the main
one: the headline "In own range" tile, the ranges bar and legend (below / in / above), the day-by-day bars, the day
table and the shaded band in the glucose-by-time-of-day profile. The international consensus 70-180 stays as a
labelled reference line under the bar ("For reference, the international consensus range 70 to 180: ...") and as grey
dashed lines on the profile. Without an own range the report keeps the five consensus ranges. API only; no app change.

19 Nov 2026 (Jira PM-295, thread "Fix companion default name for new users"): a new tester's companion was called "Noa";
it should be "Stedio". Cause: the name has been fixed since 14 Nov (no field), but the app's onboarding draft still
started with the old default "Noa" and saved it. App: default and fallbacks are "Stedio". API: a new profile always
gets "Stedio" and later saves keep the saved name (`profile_answers.keep_companion_name`), so apps before the OTA never
write "Noa" back; migration `e1f3a5c7d9b2` renames "Noa" to "Stedio" for accounts made after 14 Nov 17:00 UTC (older
accounts may have chosen it and are kept). Voice sample default and demo accounts use "Stedio". API tests
`test_companion_name_is_not_set_by_a_save`, `test_a_name_saved_before_the_fixed_name_is_kept`; migration SQL checked on
Postgres; app tests pass. Next: deploy API (runs the migration), OTA to testers.

19 Nov 2026 (Jira PM-310, same thread): Guy did not see his son's meal photo while viewing. Photos had been kept from
followers since 13 Nov; Guy chose (decision card) to show them to followers who see the journal, at once for existing
shares. `GET /meal/photos/{id}` joined the journal share scope and admin view paths (delete still refused); `MealPhoto`
loads it with X-View-As when the journal is shared; `shr.sc_journal` now names photos (en, he). Lawyer question PM-311
(`needs-lawyer`). API 786 tests, app 221. api #143, app #186. Next: deploy API, OTA.

19 Nov 2026 (Jira PM-319, same thread): inside a conversation about his son, Guy had no way back to the Talk screen with
his son's data. `AboutChat` now has a home view (character, insights, cheer, "Continue the conversation" under the
character and as a history icon in the header) and a conversation view (messages, Back in the header). Sending opens the
conversation; Back or tapping the Talk tab goes home. String `shr.chat_continue` (en, he). e2e sharing.cjs checks Back,
Continue and the tab tap. App 230 tests. app #193. Next: OTA only (no API change).

19 Nov 2026 (Jira PM-294, same thread): Guy asked that the viewer also see the insights of the person viewed. The
follower's conversation tab (`AboutChat`) shows the main screen's `NowInsights` when insights are shared (only the line
once a conversation is going); read only, as before (no mark-read or changes, refused by the API too); "Talk about this"
puts `shr.chat_about` into the viewer's own message box. Browser e2e `tools/e2e/sharing.cjs` has new checks (he light,
en light, he dark, no failures). App #181. Next: OTA to testers (no API change).

19 Nov 2026 (Jira PM-293, thread "Restyle the parent viewing-child companion screen"): Guy asked that the follower view
show the conversation page and let the viewer talk about the profile of the person viewed, and that the Live Activity
show the viewer's own data, never the person viewed. Found: an admin who also follows someone got no companion tab
while viewing (app hid it for admins; the API answered admins' X-View-As with admin rules, which refuse chat paths).
Now an admin with an active share gets the follower's conversation (`deps.current_user`); when the owner shares the
profile, the viewer's conversation context includes `context.about` for them (`viewer_instructions`). In the app the tab
shows for an admin who follows the person, and the lock-screen card, home widgets and watch read with `session.authed`
`self` (no X-View-As) while viewing; the Overview no longer hands the viewed person's range to the card. API test
`test_viewer_talks_about_the_shared_profile_and_an_admin_who_follows_gets_the_same_chat`; app 218 tests. The Live
Activity change needs a phone to see (not checked in the container). Next: deploy API, OTA to testers.

19 Nov 2026 (Jira PM-292, thread "Fix onboarding restarting after Meet companion"): an under-18 tester whose parent had
accepted the invite tapped "Meet your companion" and was sent back to the start of onboarding; API logs showed no
`PUT /profile`. Cause: the finish step's pre-save check accepted only `ageGate 'adult'`, so `'under18'` went to the date
of birth, the parent invite and all of setup again. Fixed in app #178: `missingForSave()` accepts `under18` (the server
still checks the parent), a `guardian_required` save refusal opens the parent invite, and the invite returns to where it
was opened from. App tests 218/218, typecheck clean; not yet tried on a phone. Next: testers OTA (0.6.0 and 0.5.0).

19 Nov 2026 (Jira PM-290, thread "Let iPhone testers register their device themselves"): Guy wants new iPhone testers
to add their own phone instead of us running `eas device:create` for each one. Finding: an Expo registration link
(`expo.dev/register-device/<id>`, an `AppleDeviceRegistrationRequest`) has one `resolvedAppleDevice` and a `closedAt`
in EAS's schema (eas-cli 27.10.0), so it serves one phone; the fixed 12 Nov link on /get/iphone was replaced. Built: API
`steady_api/ios_devices.py` and `routers/ios_device.py` (`GET/POST /auth/ios-device`, open to waitlisted accounts,
blocked for demo accounts): the server makes each signed-in tester their own link with an Expo robot token
(`STEADY_EXPO_TOKEN`, account `mingdev`, team S6L7799Q36) and keeps only the link id, time added and model, never the
UDID (table `ios_device_registrations`, migration `d7b3e1a9c5f2`, in the export as `test_iphone`, deleted with the
account). Worker step `ios_devices` checks open links every 2 minutes for 14 days, emails the admins "a new iPhone needs
a build" once, and emails the tester once a newer iPhone build is published. Website `/get/iphone` step 2 signs the
tester in on the page and opens their link, then shows "on the list" or "ready". API 13 new tests; web typecheck and
lint; page states checked in Chromium at iPhone 13 size against an API stand-in. Privacy policy line for Expo and Apple
receiving the tester's device identifier: open item PM-291. Next: Guy creates the Expo robot token and sets the fly
secret, then deploy API and web.

19 Nov 2026 (Jira PM-289, thread "Toggle time-in-range period on tap"): Guy asked that a tap on the main screen's
time-in-range tile switch the period instead of opening Overview, with a small arrow that still opens Overview and
the person's range in brackets by the title (his pick on a decision card). Built: a tap steps Last 24 hours -> Today
so far -> Last 7 days -> back (`features/companion/tirPeriod.ts`, one week of readings and the Overview's
`timeInRange` rule), round arrow beside the title, "(70–180)" under the title, glucose tile head the same height so the
numbers line up. diabetic-app #177 merged; `pnpm check` passes (app 217); e2e `tools/e2e/tir-period.cjs` 61/61 and
`main-top.cjs` (en light small) 22/22 on the web export. Next: testers OTA for 0.6.0 and 0.5.0 (app only, no API).

19 Nov 2026 (Jira PM-286, thread "Fix bolognese parsing and food deletion"): Guy logged "בולונז ברוטב עגבניות, רוטב
בלבד" and the parser made "sauce only" a food with no values, so the meal's protein read "—". The food analyzer's
instructions now keep describing words ("sauce only", "without pasta") with their food, count a meat sauce's protein, and
ask for typical values for every named food; a food still left without carbs or protein takes only the missing values
from the Israeli food list when a food there has every word of its name (`ai/food.py` `filled_from_list`). Meal protein,
fat and fiber totals (app `mealMacro`, companion `ai/entries.py`) sum the foods that have a value, as carbs do. API #132,
app #173 merged; API 746 tests, app 211 tests and typecheck pass. Swipe-to-delete already existed (PM-222); Guy's hint
request went to the PM-222 thread. Next: deploy-api (runs the companion eval gate, food analyzer changed), then OTA.

19 Nov 2026 (Jira PM-285, thread "Show trend arrows for Libre readings"): Guy saw "74 →" in LibreLinkUp and "74" with
no arrow on Stedio's Overview. Prod aggregates (counts only) showed the LibreLinkUp arrow is stored (about 74% of Libre
rows in 48 h, 87% for CareLink); the Overview "Latest reading" card simply never drew an arrow for any source. Built:
app Overview card arrow (fresh readings, 15 min, shared `freshTrend`/`TREND_ARROW` in `features/devices/age.ts`),
Live Activity `tr` field drawn as SF Symbols like the watch (Swift needs the next local native build), API Live
Activity push sends `tr`, and cross-source dedupe keeps a dropped reading's arrow on the health-store copy already held.
diabetic-api #131, diabetic-app #171 merged. Next: deploy API, then OTA; Swift in the next native build.

19 Nov 2026 (Jira PM-275, thread "Build doctor portal with pre-visit summary"): Guy asked for a desktop portal for
clinic teams, in the demo and the real system: a team member asks for a patient by email, the patient accepts in the
app, and the clinic sees a one-page pre-visit summary in 10 sections (last 90 days next to the 90 before, numbers first,
"Missing" for any gap, no dosing; section 10 states the data and the topic, never a treatment: Guy's decision card).
Then (via the coordinator): a separate clinic sign-in on the website on the same users table, roles doctor, nurse,
dietitian and social worker, a chart behind every number, a marketing "Clinics" section with no screenshots, and an
admin screen to create clinics and add team members. Built: API `routers/clinic.py` (admin clinics and members, clinic
`/clinic/*`, the person's `/care-team/*`, push on a new request, retention in the worker), `clinic_summary.py` (facts
from the same metrics as the app, model wording checked by the notes filters, rule wording without AI consent),
`demo/clinic.py` + `/demo/clinic-session` (demo clinic with the demo people, read-only), migration `c4e8a2f6d1b3`;
website `/{en,he}/clinic` (own session in page memory, patients, requests, account, summary with charts and one-page
print), Admin > Clinics, home "Clinics" section, Demo "Clinic view"; app Settings > Sharing "Clinics" card and
`/settings/care-team/[id]` (approve with parts, change parts, questions for the visit, stop; push tap opens it).
Privacy policy version `2026-11-19T12:00:00Z` (clinic sharing, clinic team data, retention) forces re-accept. Checks:
API full suite, web and app typecheck, lint and tests, i18n tests. Next: deploy API, then web and OTA; Guy looks at the
demo clinic view. The demo keeps 90 days, so every "before" in the demo shows Missing.

19 Nov 2026 (Jira PM-280, thread "Celebrate wins on Apple Watch"): Guy asked for wins to be celebrated on the watch like
Fitness's "You did it". He saw the mockup (`/mnt/project-files/steady/watch-wins/`) and chose the plain push now and the
watch screen in the next native build. API `steady_api/wins.py`: one `win` push a day at most for behaviour wins only (a
steps or active energy best on the day, a workout that just ended, a companion unlock), never glucose; quiet hours, insight
pushes off, fewer nudges, Take a break and all notifications off send nothing; Classic Stedio is plain with no unlocks; no
numbers in the words (G-116). Watch: `targets/watch/WinNotification.swift`, a custom notification screen for category
`win` (ring, check, sparkles, success haptic), not compiled yet. API `tests/test_wins.py` 13 pass.
19 Nov 2026 (Jira PM-284, thread "Add a take a break glucose-only mode"): Guy renamed Take a break to Quiet mode.
English "Quiet mode" / "End quiet mode" / "Quiet mode on"; Hebrew "מצב שקט" / "לצאת ממצב שקט" / "מצב שקט פעיל". The
App Intent (Action Button, Shortcuts) is "Quiet mode" too, and the companion's app-data line says Quiet mode. Behavior
unchanged; code ids keep "break". e2e `tools/e2e/take-a-break.cjs` 73/73, app tests 210 pass, API break and app-data
tests pass.

19 Nov 2026 (Jira PM-282, thread "Fix Hebrew placeholder in chat input"): in Hebrew the companion chat placeholder
"הודעה לStedio" was laid out left to right on iOS, so "Stedio" jumped to the right edge. Text inputs now take the app
language's base direction (`useInputDirection` in `apps/mobile/src/i18n/I18nProvider.tsx`: writingDirection for iOS,
a direction mark at the start of translated placeholders for Android and web): companion and follower chat boxes, food
search and every non-LTR TextField. Hebrew string is now "הודעה ל־{name}". Guard in `test/rtl.test.ts`. `pnpm check`
passes (app 211). Visual check on Guy's iPhone after the OTA.

19 Nov 2026 (Jira PM-279, thread "Add a master switch for all notifications"): Guy asked for one switch at the top of
the Notifications list that turns all notifications on or off with one tap. App: "All notifications" is the first card
(`features/settings/notifyAll.ts`, kept on the phone and the server); off shows every row off and locked but keeps each
choice, so on restores them; no local reminders are scheduled and nothing shows while the app is open; Profile says
"All off". API: `notifications_on` in `/settings` (in `routine_state`, no migration); `push.send` withholds every kind
while off, the out-of-range look-back included (Guy's "all"), and WhatsApp proactive messages with it. API full suite
719 pass; `pnpm check` passes (app 210); e2e `tools/e2e/notify-all.cjs` 43/43 on the web export (en light, he light,
he dark 375x667). Next: deploy API, then OTA; look on Guy's phone.

19 Nov 2026 (Jira PM-273, thread "Skip \"how much did you eat\" when amount is given"): Guy logged "I ate half a
banana"; the review showed ½ piece but still asked "How much did you eat?" with "All of it", and "Half" would have halved
it again. App: the question is hidden for meals described in words or voice (`asksAte` in `features/meal/model.ts`),
kept for photos, recent, usual and manual meals, and still shown when a described meal already carries a fraction.
API: `propose_meal` no longer takes `ate` (the amount eaten is in the description; cards use `ate: all`). App 210 tests,
e2e `tools/e2e/meal.cjs` 22/22 on the web export; companion regression set runs on Fly with the API deploy.

19 Nov 2026 (Jira PM-269, thread "Add a WhatsApp companion channel"): Guy asked to chat with the same companion on
WhatsApp, directly through Meta's WhatsApp Cloud API with no provider, with proactive messages in the first version
("זה כל החוויה") and only his own account at first. Spec approved ("מאושר"), in Jira PM-269; lawyer review PM-270.
Built: API `steady_api/whatsapp/` (link by a one-time code the person sends from WhatsApp, Meta's signature on the
webhook, messages stored once by Meta's id and handled in order per number, the app's companion pipeline with the dose
filter, replies split for WhatsApp, emergency number by country code, Save / Not now buttons for records, STOP),
proactive messages through `push.send` (free text inside the 24-hour window, a template with a button outside it, at most
3 a day, nothing 22:00 to 07:00, push fallback, never glucose alerts or device alarms) and the agents' notes; app card in
Profile > Companion and the "On WhatsApp" mark. API `tests/test_whatsapp.py` 20 pass with a Graph API stand-in, full API suite 711 pass;
`pnpm check` passes. Nothing has reached Meta: next, Guy's Meta setup and secrets (deploy/fly/README.md), then the
templates, then a real message from his phone.

19 Nov 2026 (Jira PM-268, thread "Give the companion access to all app data"): Itay asked the companion when his next
clinic visit is and it said it had no access, though the visit is saved on "Report for my clinic". Guy: the companion
must have full access to everything in the app. API: `steady_api/ai/app_data.py` puts the saved next visit (weekday,
date, time, with whom, when the preparation starts) and the preparation's suggested questions, the current sensor's
end, reminders in the next 7 days and Take a break into the companion's instructions (text and voice), and adds the
read-only tool `app_data` (visit, labs, summaries, reminders, food_by_day, body_by_day, settings, devices, small_wins,
sharing, usual_meals). The live voice note now delegates for anything else in the app. Phone-only items (questions for
the coming visit, earlier visits with the person's own summary, PM-214) go with each message, voice delegation and live
call start as `phone`, for that answer only: never stored, logged or put in a tool result. Lab results are read only
through the tool (data minimisation). API tests: 690 pass plus the new `tests/test_app_data.py` (6 ML tests in
`test_ope`/`test_ranker_pipeline` fail only in the full-suite order and pass alone, with and without this change);
`pnpm check` passes (app 209). Gaps: questions typed on the report screen are kept on the phone only once a report is
made (existing behaviour), and the WebSocket voice fallback does not send the phone items. Not yet seen on a phone.
Next: companion evals on Fly, deploy API, then OTA (0.6.0 and 0.5.0).

18 Nov 2026 (Jira PM-264, thread "Add automatic theme option"): Guy asked for an Automatic choice in Accessibility >
Appearance next to Day and Night ("גם אוטומטי לפי הגדרות המכשיר"). The design already lists system, day, night; the theme
provider already resolved `system` live from the phone, but the screen had no chip for it. Added the Automatic chip and
chips now show the saved choice. New users stay on Automatic; saved Day/Night choices are untouched. JS + strings only.
App #156 merged; `pnpm check` passes (app 208). Not yet seen on a phone. Next: testers OTA (0.6.0 and 0.5.0).

18 Nov 2026 (Jira PM-263, thread "Upgrade the visit report"): Guy asked to turn the visit report entry into "Clinic &
tests" ("מרפאה ובדיקות"). Profile now opens a Clinic & tests screen with "My test results" (the PM-213 lab results),
"Report for my clinic" (the PM-214 report and visits) and the "Read a lab report" card for new tests. JS only, no API
change. `pnpm check` passes; `tools/e2e/visit-report.cjs` now enters through Clinic & tests and passes in en light, he
light and he dark. Follow-up the same evening (Guy): reading a lab report moved inside "My test results" only, and the
results list one row per test date that opens that day's results (`labDays`, `labsOn`, route `/labs/[date]`). Next:
testers OTA (0.6.0 and 0.5.0).

18 Nov 2026 (Jira PM-260, thread "Choose sensor expiry reminder timing"): Guy asked that Notifications let the person
choose how long before a sensor ends to be reminded, per sensor type: 3 days, 24 hours or 5 hours. There was no app
reminder before (only the pump's own "sensor ending" alert relayed from CareLink). Now Profile > Notifications has a
"Sensor ending" card with Off / 3 days / 24 hours / 5 hours per sensor type the connected services can tell the end of
(G-112). API: `sensor_end_reminder` and `sensor_end_types` in `/settings`, worker step `sensor_end` (`sensor_end.py`):
CareLink's own sensor time left, else the reported start plus the maker's rated days; one push per sensor; the longer
reminders wait for the morning. API #119 and app #150 merged; API 682 tests pass (2 failures not from this change:
`test_logs` on `routers/demo.py`, and a flaky `test_environment` case that passes alone), app 208, i18n 20; e2e
`tools/e2e/sensor-end.cjs` 18/18. The push itself was checked in tests only, not on a phone. Live 18 Nov: API v76 and testers OTA.
Follow-up (Guy 21:07): "7 days" for sensors rated 14 days or more (FreeStyle Libre); `/settings`
`sensor_end_options` lists the times per type, a time not offered is refused. API #120, app #152; e2e 21/21. Next:
deploy API, then OTA (0.6.0 and 0.5.0).

18 Nov 2026 (Jira PM-261, thread "Stop backups from filling the DB disk"): production was down 20:22 to 20:41 UTC
because the stedio-db 1 GB volume filled up (Postgres crashed writing WAL; volume now 3 GB, no data lost). Every
`deploy-api` takes a pg_dump on the volume and the backup script pruned only by age, so 74 dumps (641 MB) piled up.
`deploy/fly/db/backup.sh` now keeps the newest 10 dumps (and the 14-day limit) and refuses to dump when less than
200 MB plus the last dump's size would stay free. Tested against a scratch folder (prune to 10, refusal path). Needs
`stedio-fly deploy-db` to take effect; the first backup after it removes the older dumps (still in the daily snapshots).

19 Nov 2026 (Jira PM-274, thread "Add a take a break glucose-only mode"): Guy asked to move the Take a break switch
from Profile to the main screen, under the character, only the switch and its label; after the mockup he asked for the
label on the switch's other side. Built: `BreakToggle` in the row of the history and text icons (a row of its own was cut
off by the tab bar on 375x667), label after the switch; the Profile card is gone; hidden while viewing and in the web
demo. App #164 merged; app 210 tests, typecheck; e2e `tools/e2e/take-a-break.cjs` 73/73. Next: OTA (0.6.0 and 0.5.0).

18 Nov 2026 (Jira PM-257, thread "Add a take a break glucose-only mode"): Guy asked for a quick "Take a break" switch in
Profile: no pushes from the app except high and low glucose, no insights, and the whole app becomes one clean screen with
the sensor reading in big (iPhone StandBy style, upright) and a small icon that ends it; also from the iPhone Action
Button. Built: Profile switch card; `BreakScreen` over every tab (black, value huge in the person's own range tint, unit,
fresh trend arrow, time and age; "Not current" with the time and no value past 15 minutes); the server keeps
`routine_state.break_since` (`/follow-ups/break`) and `push.send` withholds every kind but `glucose_alert` (the quiet
look-back the person turned on), check-ins are held as in a pause and the app starts none, insight and compliment pushes
stay in the app; the phone cancels its local reminder notifications and hides foreground banners. Action Button: the
"Take a break" App Intent (native, next local build) and, for current builds, a Shortcut that opens `steady://break`.
API 681 tests pass; app tests and typecheck pass; e2e `tools/e2e/take-a-break.cjs` 61/61 (en/he, light/dark, small/large).
Not yet seen on a phone. Next: deploy API, OTA (0.6.0 and 0.5.0), then a local native build for the App Intent.

18 Nov 2026 (Jira PM-256, thread "Upgrade the visit report"): Guy said the next-visit date ("05.10") was unclear and
not like other dates, and there was no hour. The date field now shows the weekday with the date (dd.mm in Hebrew,
mm.dd in English, the year only when it is not this year) and a time field sits next to it (native picker, optional;
older apps send no time). The API keeps the time with the saved visit, the visit preparation starts 3 days before the
visit's date and time, and the saved line, My visits, the report header and the export show it. API tests for the
visit, report and account pass; `pnpm check` passes; `tools/e2e/visit-report.cjs` passes in en light, he light and he
dark. Next: deploy the API, then the testers OTA (0.6.0 and 0.5.0).

18 Nov 2026 (Jira PM-255, thread "Show daily carbs and protein summary"): Guy asked that the Carbs and Protein tiles
(Overview > Food today), which show a full-day average, also lead to a list of days with each day's total carbs and
protein, for a week, a month or a range of dates. The Carbs so far and Protein so far sheets have a "Day by day" row; the
new sheet `/breakdown/days` has Week (last 7 days), Month (last 30) and Dates (from-to, up to 92 days), the period's
full-day averages (the tiles' own rule) and full days N/M, then a carbs and protein column per day, newest first (dd.mm
in Hebrew, mm.dd in English; "≥" when some meals lack protein); a day opens its day detail (PM-172). API:
`/nutrition/summary` takes `from`/`to`. Descriptive totals only. API #116 and app #146 merged; API 674 tests, app 204,
i18n 20; e2e `tools/e2e/day-by-day.cjs` 37/37. Not yet seen on a phone. Next: deploy API, then OTA (0.6.0 and 0.5.0).

18 Nov 2026 (Jira PM-254, thread "Stop showing already-read insights again"): Guy saw the same card ("Check-in 17:58:
Had dinner?", "Above your range now") on the main-screen Insights card again and again; once read there it should not
come back. The G-77 mark-read existed, but check-ins, out-of-range readings and pump alerts had no read key, and the
PM-238 card marked a card read only through its chip. Now a card in view in the open card for 1.5 s is read (server-kept,
every device); it stays while the card is open and is gone after folding. New `home-read` keys: `fu:<id>`, `al:<id>`,
`reading:high|low:<first reading of the run>` (one key per out-of-range episode: same side, no gap over 30 min).
Read logic only, no layout change. API #114 and app #143 merged; API test_insights 13 pass, app 203. Not yet seen on a
phone. Next: deploy API, then OTA (0.6.0 and 0.5.0).

18 Nov 2026 (Jira PM-251, thread "Restyle the parent viewing-child companion screen"): Guy asked that the companion tab
a parent sees while viewing a child's data look like the regular main screen, with the character in the middle, and
that the "Viewing … · view only" line above the tab bar become a more prominent strip on top. `AboutChat` now has the
main screen's top glow, the character beside the title, the privacy note, and the character in the middle ("Ask me
about {name}") until the conversation starts; still text only. While viewing, `ViewingBanner place="top"` is a strip in
the accent colour across every tab with a Switch pill; the quiet "My data" line stays above the tab bar (G-110). App 201
tests, i18n 20; browser e2e `tools/e2e/sharing.cjs` 31/31 (he light, en light, he dark; it now accepts the current legal
versions first). App #141 merged. Next: OTA to testers.

18 Nov 2026 (Jira PM-248, thread "Allow under-18 users with a parent following"): Guy asked that people under 18 can
use the app, but only with a parent invited to follow them. The date of birth step now leads under-18s to "Invite a
parent" (the old adults-only stop screen, G-109): the server keeps only the day they turn 18 (`users.minor_until`,
`PUT /auth/birth`), and until a parent accepts the parent invite and confirms being the parent or legal guardian, it
answers nothing but sign-in, sharing, consents, export and deletion (`guardian_required`); so no profile, device or AI
before the parent. The minor cannot remove the last parent; if the parent stops following, the account waits again;
it all ends at 18. A waitlisted parent is approved by accepting a parent invite from an approved account. Minors never
train models, priors or the quality review. Terms and privacy (en, he) `2026-11-18T18:30:00Z`, so everyone accepts
again. Lawyer points PM-249 (`needs-lawyer`). API 672 tests pass, app 201, i18n 20; browser e2e `tools/e2e/minors.cjs`
22/22. Next: deploy API (migration `c4e8a2d6f1b3`) and web together, then OTA to testers.

18 Nov 2026 (Jira PM-245, thread "Connect data sources during onboarding"): Guy asked for real device connections inside
onboarding, early, with onboarding going on afterwards. New step `connect` after `sensor` (G-107): the connection that
fits the chosen pump and sensor first, then Apple Health / Health Connect and the rest, each opening the existing
connection screen; skippable. API: `POST /consent/onboarding` records the consent step's answers before the first
connection (the profile save used to be the first record, so a device could sync with no consent on the server), with
the same rules as the profile save (`record_consents`); `GET /profile/device` gives a connected pump's range and ratios
before a profile exists. No privacy text change (consent is still given at sign-up). Screenshots en/he, day/night, from
the web export against a local API. Guy asked to merge and deploy (18 Nov); app #136, api #112 merged. Next: deploy API, then OTA to testers.

18 Nov 2026 (Jira PM-236, thread "Redesign website with scroll motion"): Guy asked for a home page that feels like
Stelo's how-it-works page: scroll motion, photos of people using the app (AI-generated, approved by Guy) and real app
screens. Built in apps/web: the hero keeps only the phone (Guy: the photo did not belong there), a full-width photo that opens on scroll, "How it works" as a
sticky phone that swaps four real app screens (e2e captures with sample data) per chapter (`Story.tsx`), a mosaic of people using the app (real screens warped onto generated green-screen
photos, incl. a woman in a hijab and an African-American man) with parallax, and rising reveals. CSS scroll-driven animations only; nothing moves with reduced motion; the
photos carry no caption (Guy). Built on the demo branch (PM-233, "Ask for a
demo"). Typecheck clean for these files, lint and web tests pass; checked in Chromium at desktop and phone widths.
Next: Guy's look on his Mac, then PR and deploy-web.
Round 2 (Guy, 18 Nov evening, web #48): on phones "How it works" is tabs, one chapter open at a time; the mosaic keeps four photos and three moved into the chapters. Under-18 with a parent following is its own thread; the site stays 18+ until the terms change.

18 Nov 2026 (Jira PM-239 to PM-244, thread "Stelo adopt-first items", from the Dexcom Stelo research PM-237): Guy asked
to build the "Adopt first" list. Built, all retrospective and descriptive, no score and no threshold of the app's own:
meal glucose curve from the meal to +3 h (at the meal, highest, rise, back to start; the person's own range drawn when
set) in the meal sheet and the journal (`features/meal/curve.ts`, `MealCurveCard.tsx`); the morning recap holds at most
one fact per topic (glucose, activity, food, sleep) plus one "went well" or none, with a new sleep tool
(`agents/notes.py`); the week view lists the biggest rises after logged meals and workouts, each opening its journal
entry (`overview/rises.ts`, `RisesCard.tsx`); fat and fiber per meal end to end (`fiber_g`, `fiber_total_g`); workout and
sleep icons on the day graph with their own sheets (`GET /health-data/nights`); barcode scan on Log a meal with
expo-camera (no new native module) and `GET /meal/barcode/{code}` from Open Food Facts (Guy chose it; only the number is
sent; Israeli and EU label carbs taken as already net of fiber, North American labels have fiber subtracted). Privacy
`2026-11-18T15:00:00Z` adds the Open Food Facts line. API tests, app 200 tests, e2e `tools/e2e/meal-impact.cjs` 31/31 (en
light, he light, he dark). Open Food Facts is not reachable from the container, so a real lookup is first tried on Fly.
Next: deploy API (before the OTA: the app sends `fiber_g`), web, OTA; try a real scan on a phone.

18 Nov 2026 (Jira PM-233, thread "Add investor demo to the website"): Guy asked for an "Ask for a demo" button next to
"Join the waiting list", admin approval, and the real app shown in a phone frame on the website (web only) with a side
panel of scenarios and talking points for investors, pharma, insurers, hospitals and health funds. Demo data never trains
models, viewers need no username or password, and the team uses it to test scenarios. Guy chose shared demo accounts that
go back to the generated data every 24 hours. Built: API `steady_api/demo/` (7 scenarios, 90 generated days each,
one shared account per scenario and language, made with COPY in about 2 s, a per-account advisory lock, remade at 03:00
Israel time under a new id, carried on to the moment it is opened), `routers/demo.py` (request form, personal link
`#k=` stored as a hash, 30 days, one-day demo sessions, admin approve/renew/revoke/decline/delete, team link),
demo accounts left out of training, priors, the ranker and the admin user list, account/device/sharing writes refused;
app demo mode (`features/demo/`, session in sessionStorage so the viewer's own sign-in is untouched, Devices, Privacy,
Sharing, Admin, Sign out and Delete hidden); web `/demo` page, home buttons, admin page Dashboard > Admin > Demo
requests. Privacy `2026-11-18T14:00:00Z` adds demo request data, demo retention and the stored link. API 21 demo tests,
e2e 13/13 in Chromium against a local API. Lawyer review PM-235 (`needs-lawyer`). Next: deploy API (migration
e5d1a7c3b9f2) and web together, OTA.
Later the same day: admin invite by email (api #109, web #43), and two family scenarios through the existing sharing
(api #110, web #44): a parent without diabetes, and a parent with type 2 and their own data, each following Maya, a
child with type 1 whose demo account resets nightly and never trains. The app in the frame opens viewing Maya. No
migration. Chromium check 5/5.

18 Nov 2026 night (Jira PM-262, same thread): the header plus on Overview and Journal is gone (the round plus beside the

18 Nov 2026 night (Jira PM-265, same thread): the time-in-range tile on the main screen counts the last 24 hours (not since midnight) and is always shown when the person has a range, with a dash and "Not enough data" when coverage is too low. It had hidden itself every night just after 00:00. App PR #157.

19 Nov 2026 (Jira PM-266/PM-267, same thread): CareLink's history tirSettings is a report preference, not the pump's range. A tester had 70-140 there while her pump's SG Review was 70-180. The API now keeps the pump's own range (device.pump_band), found by matching the pump's live time-in-range figures, ahead of tirSettings (api #122). scripts/carelink_range_sample.py prints the ranges plus a masked JSON sample (api #121). App: a fatal JS error is saved and sent to /app/client-error (where=fatal) on the next run (app #158), to catch Guy's intermittent launch crash on build 18.
tab bar covers it); in a wide window the side bar gets a Quick log row instead. e2e `main-top.cjs` 106/106 (one plus on
Overview and Journal). JS only. Next: OTA.

18 Nov 2026 night (Jira PM-238, same thread): Guy said the bordered insights pill looked like a search box and approved a
mockup: the collapsed line is a card like the tiles (same fill, radius, hairline), light bulb in a soft square, "Insights"
small above the start of the first card, count with an accent dot, chevron. e2e `main-top.cjs` 96/96. JS only. Next: OTA.

18 Nov 2026 night (Jira PM-259, same thread): Guy asked to remove the insights from Overview since they are on the main
screen. Overview no longer shows the Insights heading, last analysis, small wins or insight cards; the last analysis and
the corrected/ended notes (G-42) moved to All insights. WinCard and useProgress removed; `ovr.ins_t` / `ovr.ins_src`
strings removed. e2e insights/findings/progress open insights from All insights (and accept the current legal versions;
progress puts off the companion unlock); offline drops the Overview analysis check. insights.cjs "summary wins" fails
before and after this change (not investigated here). Next: OTA.

18 Nov 2026 night (Jira PM-238, same thread): from Guy's phone screenshot, the opened insights card now starts under the
"Insights" line, which stays in place (a second tap on the line folds the card), and lies over the tiles. The card
shows only "N/M" and the arrows, since the line above names it. The line's star icon became a light bulb (`bulb`).
e2e `main-top.cjs` 91/91 (adds: card under the line, the line opens and folds). JS only. Next: OTA.

18 Nov 2026 evening (Jira PM-238, same thread): Guy approved a second main-screen design from screenshots. On the idle
voice view the top row is only the insights line (no character or name there); its opened card lies over the time in
range and glucose tiles. History and text are plain icons under "Tap to talk", and the top takes only its own height,
so they stay clear of the tab bar on a 375x667 phone. The companion tab in the floating bar is a sound-wave icon named
"Talk" / "שיחה" (`com.tab_c`; Guy: too many circles); the wide-window side bar keeps the orb. JS only. App 202 tests,
i18n 20, e2e `main-top.cjs` 81/81 (adds: no name header, icons above the tab bar, Talk tab), `tab-bar.cjs` 17/17. Other
e2e scripts that opened the tab by "Companion" now use "Talk". Next: OTA to testers.

18 Nov 2026 (Jira PM-238, thread "Redesign main screen like Stelo"): Guy sent two screenshots of Dexcom Stelo's app
(inspiration only, no assets or branding) and approved the design from screenshots before any upload. The companion's
voice view is now two halves: on top, on a soft accent glow, one "Insights" line with a count that opens into one card at
a time (back/next, "2/7", swipe, fold; talk about this, mark as read and all insights stay), and under it one row with
"Time in range, so far today" (sensor readings against the person's own range, hidden without enough coverage) and the
latest glucose with its age, "not current" past 15 minutes, and an arrow to Overview; below, the character with "Tap to
talk". The header keeps plus, history and text. The tab bar is a floating pill with icons and labels (the companion orb
now has its label) and a round plus beside it for Quick log. "Report for my clinic" moved from Account to Health in
Profile (Guy's ask). JS only. App 192 tests, i18n 20, e2e `tools/e2e/main-top.cjs` 51/51 (en/he, light/dark, 375x667 and
440x956), `tab-bar.cjs` 17/17. `insight-card.cjs` (PM-210) is superseded. Next: OTA to testers (0.6.0 and 0.5.0), a
look on Guy's phone.

18 Nov 2026 (Jira PM-234, same thread): Guy asked for no placeholders on the legal pages. Every `⟦…⟧` in privacy,
terms and accessibility (en and he) is filled: support and accessibility contact guy@mi-ng.com, hosting on Fly.io in
Frankfurt (the Mac server and ngrok lines removed), no email provider line, OpenAI 30-day abuse retention, backups and
logs up to 30 days, unapproved waiting-list requests until the end of testing, minimum age 18. One new version: privacy
`2026-11-18T13:15:00Z`, terms `2026-11-18`, accessibility `2026-11-18`. Lawyer points added to PM-230. Next: deploy API
and web together.

18 Nov 2026 (Jira PM-229, thread "Fill privacy contact in the privacy policy"): Guy gave the privacy contact
guy@mi-ng.com. The privacy policy (en and he) names it in "Who we are" and "Contact"; the data protection officer and EU
representative placeholders are removed for the closed Israeli testing stage, and whether either is needed before a
wider launch is with the lawyer (PM-230, label `needs-lawyer`). New privacy version `2026-11-18T12:45:00Z` in
`legal.CURRENT` and `LEGAL_UPDATED`, so the app asks everyone to read and accept again. Other placeholders remain
(support email, accessibility coordinator, minimum age, retention, hosting text): see `docs/legal-open-items.md`.
Next: deploy API and web together.

18 Nov 2026 (Jira PM-226, thread "Fix glucose display on Apple Watch"): two photos from Guy's Apple Watch Ultra.
(1) The Smart Stack card (small family) was lavender with near-invisible text, "79" was clipped inside a dark box, and
the age was cut off. The watch does not resolve the phone's dynamic or semantic colours, so the small card now has a
fixed dark background and night-token colours, no character image, no clipping, and the reading's clock time. (2) When
there was no recent reading the card showed only "Noon". It now shows "Not current" with the last reading's time and
never the value (server `no_value_state` and the app). CareLink had no gaps; the value went missing because the app
redrew the card from stale memory when it was left. The app now skips the redraw until it knows the range and unit and
registers again on each leave, and the server resends on re-register. app #123, api #102 and #103 merged; API v60;
OTA 0.6.0/0.5.0 from 7371619. Swift compiled on the Mac. Next: native build (Guy's go-ahead), then a look on the watch.

18 Nov 2026 (Jira PM-228, thread "Fix slow API requests and sensor insight errors"): API logs 00:00-11:16 UTC showed
2x 500 on the "sensors ending early" reading (a finding's `days` is a number, the interpret route iterated it), /insights
computing ~950 ms on almost every poll, and health uploads of 1000 samples cut off after the 15 s timeout (the app then
says "No connection to Stedio"). Fixed: the 500 (test), readings for the 28-day comparisons loaded once, A1c skips
windows the readings can't cover, uploads insert rows as parameters (compiled once), app uploads in batches of 400
with a 60 s wait. api #104, app #130 merged. Next: deploy-api, OTA, then check the logs again.

18 Nov 2026 (Jira PM-220, thread "Improve the conversations list"): Guy's screenshot of the Conversations sheet
(first message as title, three lines of reply, no time, tap did nothing). Each row now has a short title the AI engine
writes in the background (`conversation_titles.py`: AI consent only, no digits or dose wording, else the first
message), one line with today/yesterday or dd.mm (mm.dd in English) and the time, then the last reply. A tap opens that
conversation in text with the design's "Resumed conversation from" line; writing goes on in it (`conversation_id` on
send), and voice makes it current first (`POST /conversations/{id}/resume`). Guy also asked for delete by swiping:
`DELETE /conversations/{id}` and the shared SwipeRow (PM-222) with a confirm dialog. Migration `b7d2e4f6a8c1`.
API 624 tests pass; app typecheck and tests pass; web e2e `tools/e2e/history.cjs` passes in en light, he light and he
dark. Privacy policy wording for the titles is open (PM-227). Next: merge after PM-222, deploy-api, OTA.
18 Nov 2026 (Jira PM-222, thread "Delete by swiping across the app"): Guy asked that every deletion in the app is a
sideways swipe, never a delete button, and that a conversation can be deleted. New shared `SwipeRow` (app, JS only:
PanResponder + Animated): toward the start of the reading direction (left in English, right in Hebrew), a short swipe
uncovers Delete, a long one deletes; optional confirm; a trash button only while VoiceOver/TalkBack is on. Used on
journal entries, Overview breakdown meals, usual meals, foods in a meal being logged, check-ins, memories, kept visits,
the next visit, sharing (people and invites) and onboarding carb-ratio periods; the Delete buttons on the journal entry
and visit screens are gone. Conversation delete is PM-220 (its own thread) on the same component. App #127 merged.
`pnpm typecheck`, app tests 192, i18n tests pass; new e2e `tools/e2e/swipe-delete.cjs` 43/43 (en light, he light,
he dark). Not yet on a phone: next is the testers OTA (0.6.0 and 0.5.0) together with PM-220.

18 Nov 2026 (Jira PM-224, thread "Open meal details from the glucose chart"): Guy asked to tap the meal icons under
the Overview glucose graph to see what he ate. On 24h and Day, a meal icon opens a sheet with that meal's journal row
(foods or pump note, carbs, the pump bolus in the same row), protein, photos, and "Open in journal", which opens the
meal's own entry (also on older days). Overlapping icons open together. App only, no API change, no companion change
(no eval run needed). `pnpm check` passes; e2e `tools/e2e/meal-graph.cjs` 21/21 (en light, he light, he dark). Next:
OTA (0.6.0 and 0.5.0), then Guy checks on his phone.
18 Nov 2026 (Jira PM-225, thread "Fix insight showing yesterday as today"): Guy's main screen at 12:37 read "68
active minutes logged today" while showing "No connection to Stedio"; the minutes were yesterday's. Range reads
(records, glucose, heart rate) reaching now share one offline cache key for the calendar day and the rolling 24 hours,
and the kept answer returned while offline was shown whole, so after midnight yesterday's rows counted as today. Kept
answers and answers held over from another window now keep only their rows inside the window (app
`keptAnswer`, `useRange`; app PR #124). No copy, companion or API change, so no eval run. `pnpm check` passes (mobile
184 tests, one new). Next: OTA (0.6.0 and 0.5.0); find why the phone could not reach the API since 07:16.
18 Nov 2026 (Jira PM-223, thread "Suggest repeating yesterday's meal"): Guy eats the same breakfast every morning and
asked to log it from history instead of a photo. Log a meal now opens with a "Same as yesterday?" card when a meal was
logged yesterday within two hours of this time of day and nothing is logged today around then; "Log it again" opens the
review with its foods and the time now, saved only from the review. Recent meals and usual meals (DAP-15) stay as they
were. App only (diabetic-app#125), strings in `packages/i18n`; no API, companion or data change. `pnpm check` passes
(app 188 tests, 5 new); e2e `tools/e2e/repeat-meal.cjs` 19/19 (en light, he light, he dark). Next: OTA.
18 Nov 2026 (Jira PM-221, thread "Rename sport mode to temporary target"): Guy asked that the label "מצב ספורט" read
"יעד זמני" (MiniMed 780G Temp Target). `mode.temp_target` and `mode.b_temp_target` now read "יעד זמני" in Hebrew and
"Temp target" in English (row and badge alike). Strings only: no companion, API or data change, so no eval run is
needed. `pnpm check` and `tools/e2e/pump-modes.cjs` (7/7, updated for the shared label) pass. Next: OTA.
18 Nov 2026 (Jira PM-219): the companion regression gate stopped deploy-api: one blocking judge verdict of 114,
en-mentor-18 no_forecast ("a breakfast that may help keep glucose steadier"). The no-forecast rule in the companion's
prompt (and the viewer's) now covers general food and activity answers: describe the choice, never what it will or
may do to glucose, and offer a look-back at their own records. The similar_meals medians are called typical,
not average, and two evals-checker false positives are fixed ("מה נרשם", low-treatment supplies). Fly regression
set PASSED (api d6cb4f9, 114 turns, 0 blocking). Next: deploy-api (also ships PM-217 and PM-218).
18 Nov 2026 (Jira PM-217, thread "Detect new app builds automatically"): Guy approved ending the
`fly secrets set STEADY_APP_LATEST_BUILD=N` step after each native build. `stedio-fly deploy-web` now writes
`install/latest.json` (build and version, from the IPA name or `release.json`) next to the manifest, and the API's
`GET /app/version` reads it (`STEADY_APP_LATEST_BUILD_URL` in `deploy/fly/api/fly.toml`) with a 10 minute cache and a
3 s timeout, keeps the last good number through a website outage, and falls back to `STEADY_APP_LATEST_BUILD`. No
migration, no app change. API tests pass. Next: deploy-web (publishes build 17), then deploy-api; check
`/app/version` says 17.
18 Nov 2026 (Jira PM-218, later the same day): APK build 6 is on the install page (local Mac build; the cloud build ran out
of memory in release lint: app #128 turns release lint off, gives Gradle 4 GB and builds 64-bit only; app #131 keeps
WebRTC's classes in R8). On Guy's emulator Overview and Journal were empty: on Android the scroll view puts itself inside
its refresh control, and our control dropped it (app #132, JS only, OTA). Guy created the Android OAuth client; app #133
turns on Google sign-in on Android (needs the same variable in the EAS "preview" environment for OTAs). Guy asked for
short tester install guides on the website: web #37 adds `/get`, `/get/iphone` and `/get/android` (English, noindex).

18 Nov 2026 (Jira PM-218, thread "Ship an Android build for testers"): a new tester has an Android phone and Guy
approved a native Android build. The testers and preview profiles build a sideloadable APK. `expo prebuild` for Android
showed CAMERA and RECORD_AUDIO blocked in the manifest (the camera and image-picker plugins' `false` options block a
permission for every module), so meal and lab photos and the voice call would have failed on Android; the plugins now
get the same permission texts (iOS Info.plist unchanged, checked with `expo config --type introspect`), and WebRTC's
SYSTEM_ALERT_WINDOW is blocked. `GET /app/version` adds `android_latest_build`, read from an `android` entry in
`install/latest.json` (written by `stedio-fly deploy-web` from `stedio-<version>-<build>.apk`), else
`STEADY_APP_ANDROID_LATEST_BUILD`; Android compares only with it (EAS counts Android builds from 1). Google sign-in on
Android waits for an Android OAuth client (`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`); email sign-in works. The Android
notification channels are now only the quiet glucose look-back channel. API tests for app_version pass; `pnpm check`
passes; Android JS bundle exports. Gradle not compiled here (no Android SDK). Next: the APK build on the Mac, the
install page's Android section, then the tester's phone.

17 Nov 2026 (Jira PM-214, thread "Upgrade the visit report"): Guy asked for a much richer visit report. The PDF is
redesigned (logo band, the person's name, the visit day and everyone it is with, KPI tiles, ranges bar, AGP, daily
in-range bars, carbs and insulin bars, an optional Apple Health page with steps and sleep, and a log where meal,
insulin and reading share one row like the journal, with optional small meal photos that link to full-size copies).
A visit can be with several people; questions are ticked (suggested and the person's own). Earlier visits, the
person's own summary and the PDFs made are kept on the phone only, sealed (Guy chose "only on the phone"; no privacy
policy change). No migration. API tests 605 passed; `pnpm check` passes; new web e2e `tools/e2e/visit-report.cjs`
24/24 (en light, he light, he dark). Next: deploy the API, OTA to testers (0.6.0 and 0.5.0), Guy checks on his phone.
17 Nov 2026 (Jira PM-213, thread "Upload and explain medical test results"): Guy asked to upload lab tests by photo or
file, have them read into Stedio's own view, and show them in a table with a short explanation of each test. Built
(G-102): API `POST /labs/scan` (up to 4 photos or one PDF, read by the external AI engine with `store=false`, held in
memory only, never stored; needs the AI consent and privacy version `2026-11-17T23:45:00Z`) and `GET /labs` (every
saved lab result, no 92-day window, readable by a viewer with the journal shared); `LabData` gains 34 tests and the
printed `range_text`. App: "Read a lab report" (camera or up to 4 photos) on the lab sheet and the new Lab results
screen, a review with checkboxes, and the results table with explanations for 45 tests in English and Hebrew. Privacy
policy (en/he) and `legal.CURRENT` / `LEGAL_UPDATED` moved to `2026-11-17T23:45:00Z` with a forced re-accept. API 611
tests pass; app typecheck, lint, 183 tests; root i18n and web tests; e2e `tools/e2e/labs.cjs` 16/16 on the web export
(en light, he light, he dark). Then Guy chose PDF upload for the next native build: `expo-document-picker`
(~58.0.5) and an "Upload a PDF" button shown only where the module exists; camera and photo permission texts now
name lab reports too. e2e 17/17 with a PDF. Needs the next native build (Guy approved it after the current deploy). Next: API and web
deploy, then the OTA to 0.6.0 and 0.5.0.

17 Nov 2026 (Jira PM-212, thread "Show every selected Body today tile"): Guy had all 8 "Body today" tiles switched on
but the card showed 4 ("כולם מסומנים אבל לא כולם מוצגים"). The card dropped a chosen tile with no data today, and at
00:38 the new day has no night, resting heart rate or exercise yet (not a sync failure). Now every chosen tile shows;
an empty one shows "—" and "No data today" and still opens its breakdown. JS only. `pnpm check` passes; new web e2e
`tools/e2e/body-tiles-all.cjs` passes its tile checks (the old build shows 4 of 8). Next: OTA to testers for 0.6.0
and 0.5.0, then Guy checks on his phone.

17 Nov 2026 (Jira PM-211, thread "Show the text field above the keyboard in chat"): Guy's screenshot showed the
keyboard covering the companion's message box. The library `KeyboardAvoidingView` took the view's position inside its
parent as its place on the window, so inside a sheet the padding came up short by the sheet's offset. New
`KeyboardAvoider` (app #116) measures the real window position (`viewPositionInWindow`, already in build 16) on layout
and when the keyboard starts to open, pads by the true overlap and scrolls to the latest message; used by the companion
conversation, `AboutChat` and the quick-log sheets. JS only. `pnpm check` passes; web export builds. Not yet seen on a
phone: next is the testers OTA (0.6.0 and 0.5.0) and Guy's check on iPhone.

17 Nov 2026 (Jira PM-210, thread "Fix cut-off insight card on main screen"): Guy's screenshot showed the insight card
under "Tap to talk" cut off, only its bottom and "Talk about this" visible. The voice-mode box under the character
scrolled to its end on every content change, also in the idle state, and on iOS kept the offset left by a
conversation. It now remounts between insight and captions and shows the insight from its top (app #117, a06222e).
`pnpm check` passes; `tools/e2e/insight-card.cjs` 10/10 (the old build fails on small phones). Next: OTA to testers
for 0.6.0 and 0.5.0, then Guy checks on his phone.

17 Nov 2026 (Jira PM-207, PM-208, PM-209, thread "Strengthen ML for diabetes mentor"): Guy approved releasing the
next legal version now and fixing the eval weaknesses ("אתה יכול להוציא גרסה משפטית חדשה. לגבי החולשות - תקן אותן
עכשיו"). Privacy version `2026-11-17T21:30:00Z` adds the real-conversation quality review and the group priors lines
(en/he, api `legal.CURRENT`, web `LEGAL_UPDATED`), with a forced re-accept. `quality.POLICY` is set to that version, so
sampled replies are reviewed only for people who allow model improvement, allow AI and accepted it
(`STEADY_QUALITY_SAMPLE_SHARE=0.05`). en-mentor-21 (recall before giving routine ideas, PM-207) and en-mentor-24
(no invented numbers, PM-208) pass on Fly. Live API v54, web v37 (root fe3ac6a). PM-209 (web #35): Hebrew speakers'
re-consent link `/he/privacy` redirected to English because the site is English only; now `/he/privacy`, `/he/terms`
and `/he/accessibility` show the Hebrew text, and every other `/he` page still redirects. Next: web deploy of #35.

17 Nov 2026 (Jira PM-203, same thread): Guy asked to run the hard-case set on Fly.io. `scripts/fly/stedio-fly evals`
builds an evals image (companion code plus synthetic cases) and runs it as a one-off Machine in stedio-api with the
app's own key, saves the verdict on the Mac and removes the Machine; `deploy-api` runs it first when the companion
changed since the last passing run. Image built and run in the container with Docker (no network: exit 2, "did not
run", as intended); evals 32 tests pass. Not yet run on Fly.

17 Nov 2026 (Jira PM-197..201, thread "Strengthen ML for diabetes mentor"): Guy approved the ML consultant plan,
items 2 and 5 first, then 1, 3 and 4 (G-100, `docs/ml-ranker.md` 4 and 5a). Built: logged place probabilities with a
shuffle on 10% of days, SNIPS and Doubly Robust off-policy evaluation with people-bootstrap intervals, and a shadow step
before a model becomes current (PM-197); the companion quality track: hard-case regression set and gate
(`evals/steady_evals/regression.py`), no-forecast hard rule, a shared judge rubric, calibration against Guy's and Itay's
labels, and a production review of sampled replies that stays off until the privacy policy names it (PM-198); sensor
noise flags (PM-201); effect size, 90% interval and a weekday/weekend check on every day comparison (PM-200); group
priors by diabetes type, treatment and sensor for certainty (PM-199). API: 595 tests pass, lint clean, migration
`c4e8a1f2b6d9` round-trips. Evals harness tests pass; the regression set was not run against the model (no key in the
container). Needs the API deploy (migration). No app change.

17 Nov 2026 (Jira PM-195, thread "Strengthen the ML for the companion"): Guy asked to build items 1 to 9 of the ML
proposal, "patterns in hindsight and inside a conversation only". Built (G-98): per-person statistics with
Benjamini-Hochberg on every pattern insight; companion tools `similar_meals` and `recall_conversations` (embeddings of
the person's own messages, memory- and consent-gated); a once-only journal-gap question in text conversations; new
insights best days, weekends and the day before's steps (`kinds=6`, app and web cards); carb-habit context; ranker
exploration on 10% of days; a `mentor` eval category (9 cases, English and Hebrew). API: 554 tests pass, lint clean, migration
`d9b3f1e7a2c5`. Evals: 27 harness tests pass; not yet run against the model (no key in the container). Cards seen on
the web export in en/he, day and night (project files `steady/g98/`). Needs the API deploy, a web deploy and an OTA.

17 Nov 2026 (Jira PM-194, thread "Remove Arabic and Russian from the app"): Guy asked to remove Arabic and Russian
from the app. The app now has English and Hebrew (`LOCALES` in `packages/i18n`); a phone in any other language opens
in English, and a saved Arabic or Russian app or conversation language becomes English on the phone, on the server
(migration `a1d3e5f7b902`) and when an older app sends it. The ar/ru catalogs, the API's ar/ru push, email, greeting
and voice texts, and the website's ar/ru legal texts and Arabic font are removed; `/ar` and `/ru` on the website still
redirect to English. Kept on purpose: Arabic and Russian dose patterns in `ai/safety.py` and spoken goodbyes (G-99).
The website FAQ answer on languages (`web.a3`) and the accessibility statement (dated 2026-11-17) now say English and
Hebrew. Root i18n 20 tests, app 174, web 9 and web build, typecheck pass; API tests pass and the migration was run on a
seeded database. App lint shows the same 18 errors as main in this container. Not changed: the Arabic and Russian eval
cases in `evals/` (held-out set). Needs the API deploy
(migration) and an OTA to 0.6.0 and 0.5.0; `supportedLocales` in `app.config.ts` takes effect with the next native build.

17 Nov 2026 (Jira PM-62, thread "Show official Apple Health logo"): Guy accepted Apple's HealthKit Developer Artwork
License. On iPhone the Body card and the tile chooser show Apple's own Apple Health icon (unaltered file from Apple's
DMG, `assets/health/apple-health.png`) next to the name "Apple Health" (`HealthStoreMark.ios.tsx`); Android and the web
keep the text. App #112 merged; typecheck, test typecheck and 173 tests pass, lint unchanged from main. Not seen on a
phone yet: needs the OTA to 0.6.0 and 0.5.0, then the install page's known-issue line comes off.

17 Nov 2026 (Jira PM-192, same thread): Guy approved the dark-mode finding. Website declares `color-scheme: light dark`
in a meta tag (Next viewport) and the primary button's day/night colours are `.w` tokens with `light-dark()` and a
media/data-theme fallback; manual night hover now matches system night. Web #29 merged; typecheck, lint, 9 tests,
build pass, legacy-scan 0. Screenshots in project files `steady/pm192/`. Needs a web deploy.

17 Nov 2026 (Jira PM-191, thread "Add modern guidance skills for web and app"): Guy approved adding agent skills for
modern practice. Website: Google Chrome's Modern Web Guidance skill in `apps/web/.claude/skills` (telemetry off);
its `legacy-scan` found 3 items, 2 fixed (`toSorted`, lib es2023; web #28 merged, typecheck, lint, 9 tests and build
pass), the dark-mode `color-scheme` / `light-dark()` item left for a visual review. App: Expo's official expo-router,
expo-native-ui, expo-animation, expo-module, expo-upgrade and Callstack's react-native-best-practices in
`apps/mobile/.claude/skills` (Expo's outbound feedback step removed; eas-* and expo-ui left out; app #111 merged).
Markdown only, no OTA or build needed.

17 Nov 2026 (Jira PM-182, PM-183, PM-184, thread "Build daily summary, pattern and visit-prep agents"): Guy approved
three more background agents on the PM-139 LangGraph infrastructure. Built: `agents/notes.py` (one graph, read-only
tools limited to the run's window, code checks: evidence, no cause, no dose or treatment, no escalation or "safe /
dangerous", visit questions never about treatment) and `agents/prepare.py` (daily summary of yesterday from 06:00 local,
weekly comparison of the 4 complete weeks before, visit preparation from 3 days before a visit saved on the clinic report
screen). Only for people active in the last 7 days, with data in the window, the AI consent and the privacy policy
version 2026-11-18 (web PR #27 rides on the PM-177 bump; until it is accepted nothing is prepared). Notes kept 35 days in
`agent_notes` (migration `b7e2c4a9d351`), in the export (`prepared_notes.csv`, `saved_visit.csv`). App: "In words" card
in the summary (G-97) and "Next visit" on the clinic report. API 549 tests (1 pre-existing date-dependent failure in
`test_tracking.py`, also on main), app 173, e2e `tools/e2e/agents.cjs` 22/22 (en light, he light, he dark, AI off).
Dates on these screens are digits without the year (Guy 17 Nov: dd.mm, mm.dd in English; api#85). Guy approved the
screens 17 Nov; app #107 merged. Next: deploy API (migration), OTA.

17 Nov 2026 (Jira PM-186, thread "Return to main screen after meal entry"): Guy: the "back to conversation" button
after logging a meal should go to the main screen. The Meal saved button is now "Back to main screen" (4 languages,
`meal.back_conv`) and opens the companion's voice view via `/companion?home=1` instead of the text conversation (app
JS + strings only). E2E `tools/e2e/meal-back-home.cjs` 5/5; typecheck, lint and 173 tests pass. App PR #108 merged.
Not yet seen on a phone. Next: OTA.

17 Nov 2026 (thread "Fix speech bubble tail over character"): Guy's screenshot showed the main-screen bubble's tail
detached at the bubble's side in Hebrew. The tail was placed with `left: 50%` and a negative margin; it now sits in a
full-width row pinned to both sides of the bubble, so it is centred in RTL and LTR (app JS only, OpenerBubbles.tsx).
App PR #106 merged; typecheck, 173 tests and lint pass. Not yet seen on a phone. Next: OTA.

17 Nov 2026 (Jira PM-181, thread "Highlight the active tab in the footer"): Guy: "the relevant tab should be
highlighted so a user can tell where he is at". Before, the active tab only changed colour and the companion orb only
its opacity. Now (G-96, app JS only): a soft accent capsule behind the active icon with a heavier line and bold label,
an accent ring around the companion orb when it is active (the inactive orb fades to 50%), the accent fill in the wide
window side bar, and `aria-selected` on web (never set before). E2E `tools/e2e/tab-bar.cjs` 16/16 (en/he, light/dark);
before/after in project files `steady/tab-highlight/`. App PR #105 merged; 173 tests. Next: OTA.

17 Nov 2026 (Jira PM-179, thread "Stop companion repeating answered questions"): the main-screen bubble re-asked
a question Guy had already answered. The follow-ups were rewritten from scratch with no record of what was asked, and a
kept question stayed after it was answered in a conversation. Now every question written is kept 21 days
(`user_settings.openers.asked`, no migration) and given to the model as never to ask again nor its topic, a reworded
repeat is dropped in code (`openers.same_question`), kept questions hide once the person says anything after them, and
the text and voice prompt says never to ask about what the person already told it and gets the asked list. Asked
questions are in the export with conversations (`companion_questions.csv`). API PR #79 merged; API 521 tests. Next:
API deploy (no migration, no OTA needed).

17 Nov 2026 (Jira PM-180, thread "Speed up app launch with character loader"): Guy asked for a loader with the
character and a progress bar for the second of "building all the data" when the app opens, and a faster launch. Built
(app only, JS): `features/launch` (G-95), a loader over the first screen whose bar fills by real steps (session,
profile draft, latest reading, conversation; 3 s ceiling); widgets, health sync, push token, follow-up sync and the
update check now start after the first screen has its data instead of competing with its ~27 opening reads. Measured in
the container (web export, 4x CPU throttle, local test API): sign-in to latest reading ~1.1 s; sealing the kept answers
(XChaCha20 in plain JS) costs ~0.5 ms per KB without JIT, so not the main cost. Native cold start not timed on a phone
yet. App PRs #103, #104 merged; 173 tests. Next: OTA, time a cold start on the phone.

17 Nov 2026 (Jira PM-141, thread "Book doctor, dietitian and nurse appointments"): Guy approved phase A of
appointment booking: Stedio gathers the information and gives the person the link or phone, for all four health funds
(Clalit, Maccabi, Meuhedet, Leumit); no partner or fund integration for now. None of the funds has a booking API for
outside apps (research in the PM-141 comment). Built: companion tool `show_booking_help` (family doctor, diabetes
doctor, dietitian, diabetes nurse), shown only when the person's own message asks for an appointment (en/he/ru/ar) and
not for someone else; the app card shows the fund's own booking page and phone line (fixed in
`apps/mobile/src/features/companion/booking.ts`, sources listed there), fund kept sealed on the device. Nothing is
booked or sent for the person. API PR #77 and app PR #100 merged; API 514 tests (1 unrelated timestamp flake passes on
re-run), app 169, e2e `tools/e2e/booking.cjs` 16/16. Next: API deploy (no migration), OTA.

17 Nov 2026 (Jira PM-177 and PM-109 #5, thread "Close open items from background agent"): Guy approved an AI
features off switch and removing the last 250 mg/dL. API: `POST /consent/ai/off` (withdrawal record; every AI route
and the background readings already check the consent), `ai_off` in `GET /consent`, the AI consent left out of
`pending` while off, profile saves never turn it on again; the companion prompt has no ketone number and defers to the
person's care plan. App: the Privacy switch, AI-off states on the companion, meal photo and description, and insight
reading; "Continue without AI features" on the consent screen (G-94). API PR #80 (520 tests), app PR #102 (169 tests),
e2e `tools/e2e/ai-off.cjs` 31/31 (en light, he light, he dark). Guy chose to release the policy tonight instead of
18 Nov: web #26 (AI switch) and #33 (carries #27 background texts and #31 recall; English and Hebrew only after PM-194)
and API #89 set privacy version `2026-11-17T18:00:00Z` (second version of the day; it shows 17 November). API suite
557 passed. Next: joint deploy of stedio-api and stedio-web; everyone gets the read-and-accept screen once.

17 Nov 2026 (Jira PM-144, thread "Close open items from background agent"): Guy approved closing the PM-139 open
items. The insight reading prompt (`interpret.py`) no longer names 250 mg/dL; for very high readings it defers to the
person's own care plan on ketones and sets no number (the companion prompt's `KETONE_MGDL` stays, PM-109 #5). Insight
readings are in the account export with conversations (`insight_readings.csv`). The privacy policy (4 languages) says
explanations may be prepared in the background with the same engine, consent and settings; privacy version
`2026-11-17` in API and website, so everyone gets the blocking read-and-accept screen. API PR #76 (514 tests pass), web
PR #25 (typecheck, lint, 9 tests) merged. Open item PM-177: withdraw AI consent without deleting the account. Next:
deploy API and web together.

17 Nov 2026 (Jira PM-174, thread "Move time in range above the chart"): Guy asked for the time-in-range card ("Today
so far") to appear right after the latest reading and before the graph. Built (app only, JS): Overview renders the
period summary card under the latest reading card, above the period picker and the Over time / Averages graph; the
cards that followed it (body, pump days, nutrition, labs) stay after the graph. App typecheck and 165 tests pass; e2e
`tools/e2e/tir-first.cjs` 10/10 (en light, he light, he dark), `tools/e2e/averages.cjs` 19/19. Next: OTA to testers.

17 Nov 2026 (Jira PM-173, thread "Clear chat meal cards from main screen"): Guy's screenshot showed meal cards from a
companion conversation ("Not saved") still under the insights on the main screen after returning to it. The voice view
showed the conversation's cards for 5 minutes after the last message. Now they show under the character only while a
call is going; an unanswered card stays in the conversation, where it can still be saved. App PR #97 merged; pnpm
check passes (app 165); e2e `tools/e2e/logging.cjs` 15/15 (it now also accepts the current legal documents up front).
Next: OTA to testers.

17 Nov 2026 (Jira PM-175, thread "Make companion aware of live glucose"): Guy asked that the companion always know the
current sensor reading during a conversation and, when glucose rises fast (double arrow), bring it up anyway and ask
whether he saw it and is handling it; and that it look up past glucose itself instead of asking (it may ask which time).
Built: `steady_api/glucose_now.py` (newest sensor reading with the sensor service's arrow and its age; older than 15 min
is told as not current and never raised; raised only below/above the person's own range or on a double arrow up/down,
once per episode; fewer nudges: low side only, once per 3 h; state in `routine_state`, no migration). Text gets it in
every turn's prompt; WebRTC calls poll `POST /voice/live/rtc/glucose` and hand the note/check-in to the model at a
quiet moment; the relay does the same server-side. New tool `glucose_history` (a local day and times, 90 days back).
API 513 tests, app 166; not yet on a phone. Regulatory: at risk (a conversational mention of a current reading, only
inside a conversation the person opened). Next: deploy the API (no migration), OTA.

17 Nov 2026 (Jira PM-172, thread "Show daily protein in Full days"): Guy asked for grams of protein per day in the
Overview "Full days" sheet, and for each day row to open more about that day's protein, carbs and insulin. Built (app
only, no API change): rows read "N meals · X g carbs · Y g protein" ("≥ Y g" when some meals have no protein value);
a day with meals opens `/breakdown/day?day=` with carbs, protein and recorded insulin totals, meals by part of the day
(time, carbs, protein) and the insulin entries. Nothing graded or advised. pnpm check passes (app 165), e2e
`tools/e2e/full-days.cjs` all PASS (en light, he light, he dark). Next: OTA to testers.

16 Nov 2026 (Jira PM-171, thread "Capture every pump and sensor event"): Guy was in Sport mode on the pump and the app
did not show it; every reading and insulin dose during the mode should carry a "Sport mode" badge, and everything the
device sources expose should come in and be shown. Inspection of Guy's real CareLink data (names and enums only): a
Temp Target exists only as the live `pumpBannerState` entry `{TEMP_TARGET, timeRemaining}`, never as a marker or in the
history, so today's mode could not be recovered. Built: pump modes as windows from each CareLink poll (Temp Target, temp
basal, SmartGuard off, Safe Basal) and from Tandem's pump log (Control-IQ exercise and sleep, exact times); `GET
/devices/modes`; journal mode rows and a badge on every reading and insulin row inside a window; the pump card shows
Sport mode and minutes left; modes and device events in the insulin export. API 505 tests, app 165, e2e
`tools/e2e/pump-modes.cjs` 10/10 (en light, he light, he dark). Audit and remaining gaps: `docs/device-data-inventory.md`
("Audit, 16 Nov 2026"). Next: deploy the API with migration a1d7c3e5f902, OTA, then the next audit item.

16 Nov 2026 (Jira PM-169, thread "Add average glucose by time of day"): Guy asked for an averages view in Overview, like
a CGM report screenshot he shared, in Stedio's own design. Built: `GET /metrics/averages?days=7|14|30|90`
(`metrics.average_by_time`: time-weighted means per local 3-hour part of the day and over the period, today included,
and the number of days with readings; a part without readings has no mean, nothing is filled in, no threshold). App:
"Average by time of day" card under the day/days card for every period, with 7/14/30/90-day tabs, bars from zero, the
person's own range shaded when set, the period average and "Readings on X of Y days" (four languages, day and night,
RTL). API 469 tests, app typecheck and 163 tests, i18n tests and e2e `tools/e2e/averages.cjs` (en light, he light, he
dark; 15/15) pass; not yet seen on a phone. Next: deploy the API (no migration), then OTA (JS only).
Same day, Guy's follow-up: the averages became a second view of Overview's own graph ("Over time" / "Averages"),
over the shown period (24h, day, week, 2 weeks, month and a new 90-day period), and the separate card with its own
tabs was removed. `GET /metrics/averages` also takes `from`/`to` (at most 92 days). Checked on Guy's real data before
the change: the 7-day slots matched a plain SQL mean within 1 mg/dL. e2e `tools/e2e/averages.cjs` 19/19.

16 Nov 2026 (Jira PM-168, thread "Show only today's items in Today so far"): Guy said "What to keep" in today's summary
showed "two hours after dinner" before dinner had happened. Today's summary now lists a routine only when its time already
came today, from today's own records (`apps/mobile/src/features/overview/looks.ts`): meal routines after a meal in that
slot today plus two hours, workouts an hour after today's ended, part-of-day routines once today has readings there
("Ahead of ..." rows for high/low/pump kept). New basis line in four languages. App 164 and i18n 19 tests pass; JS only
(0.5.0 OTA); not yet seen on a phone.

16 Nov 2026 (Jira PM-161, thread "Speed up the app and API"): Guy asked for a full speed review of the app and the API
and what may be cached on the phone. Review and plan: Claude Doc "Stedio performance review: app and API". Measured
with `services/api/scripts/perf_bench.py` (synthetic, local `_perf` database): the server answers most reads in under
35 ms; the slowness was screens waiting for the network, /insights recomputing (0.4 to 0.6 s), uncompressed answers
and whole model replies. Built: the app shows the answer kept on the phone at once and then the server's
(`session.kept`, `useRange`, insights, conversation; rows outside the window dropped, never while viewing); API gzip
over 1 KB, /insights about 2x faster with identical output, a log line for requests over 1 s (route template only).
API 471 tests, app 163 tests and typecheck, `tools/e2e/offline.cjs` 36/36 pass; not yet on a phone. Deploy the API (no
migration) and an OTA (JS only). Streaming replies (PM-162) on hold by Guy's choice; next items PM-163 and follow-ups.
Follow-ups the same day (Guy: "open Jira tasks and work through all of them"): PM-163 /insights answers from an
in-process cache keyed by a per-person data version (table `data_versions`, raised by triggers on every write insights
read; 5 minute cap, same local day), about 18 ms on repeat; PM-165 composite indexes (user_id, measured_at) and (user_id,
type, start_at) (api #66, migrations d8e2f4a6c913 and e9f3a5b7d024). PM-164 the worker runs as its own niced process
next to uvicorn (`steady_api.supervise`, exactly one worker, SIGTERM reaches both, `STEADY_WORKER_PROCESS=false` goes
back to the thread) (api #67). PM-166 the main screen reads the last 3 hours and widens to 24 only when empty; PM-167
the 15-minute access token is kept sealed so a cold start skips a refresh round-trip (app #90). API 480 tests, app 164
tests, e2e `offline.cjs` 36/36. Next: deploy the API with both migrations (backup first, no open voice call), watch
memory with two processes, OTA, then check on a phone and rerun the bench.
Evening: deployed (v24..v28), memory stable (~315 MB of 473, no swap), Fly CPU not throttled. Found and fixed: the app
asks /insights with `until` a minute ahead, which skipped the kept answer (api #70); a slow /insights now logs its phases
(api #69). Opening the app sent ~33 reads at once and the single API process answers a burst together (1-3 s each), so
PM-170: identical GETs in flight share one answer and insights ask up to the whole minute (app #92, OTA; e2e GETs
121 -> 103, /insights 13 -> 5), and /metrics/progress is kept per day while its readings are unchanged (api #71, 122 ->
17 ms). Next: confirm on a real open after the deploy and OTA.

16 Nov 2026 (Jira PM-156, thread "Check app against App Store review rules"): Guy asked that a change to the privacy
policy, the terms or a consent like the AI one makes the app ask the person to read and accept before they keep using
it. Built (G-93): versions per document in `steady_api/legal.py` (Terms and Privacy 2026-11-16, AI consent
2026-11-16), a `version` on each consent row (migration c3d9e1a7b456, existing "ai" rows set to the first version),
`GET /consent` lists what is pending and `POST /consent/accept` records the versions shown (409 if one changed); the AI
engine works only with the current AI consent. The app's one-time AI screen became a general update screen with read
links; onboarding asks for the Terms and Privacy explicitly. Website shows a date per document; the "Changes" sections
of both texts now say the app asks again. API 467 tests, app 153 tests and typecheck, web 9 tests pass; not yet on a
phone. Deploy the API (with its migration) and the OTA together: every account will see the screen once. To change a
document later: edit the text, then set the same new date in `legal.py` and the website's `LEGAL_UPDATED`.

16 Nov 2026 (Jira PM-159, thread "Support right-to-left across the app"): Guy asked that Hebrew and Arabic be right to
left everywhere, text direction too, not only alignment. The layout was already RTL; text took its paragraph direction
from its first strong character, so Hebrew sentences starting with "Stedio", "AI" or a number (180 in he.json) were
laid out LTR. Fixed in AppText for the whole app (iOS writingDirection, web dir, Android direction marks), with
"auto" for the person's own words and "ltr" for numbers; guard test `apps/mobile/test/rtl.test.ts`. JS only (0.5.0
OTA). App tests, typecheck, i18n tests and a web export check (he, ar) pass; not yet seen on a phone.

16 Nov 2026 (Jira PM-158, thread "Add classic Stedio mode without games"): Guy asked for a switch at the top of
Profile > Companion that releases the person from the games ("Stedio הקלאסי", no wardrobe). Built: "Classic Stedio"
(`companion.classic` in the profile answers, off by default, shared by app and website). While on, the accessories
card and locked picker are hidden, the companion shows the plain character (no accessories, weather wear, seasonal
crown, moment props, nightcap or costume morphs), and no unlock dialog or Unlocks card shows (nothing is marked
celebrated). The saved accessories come back when it is turned off. JS only (0.5.0 OTA), no API change. App tests,
i18n, web checks and e2e `tools/e2e/classic-mode.cjs` (en light, he light, he dark; 18/18) pass; not yet seen on a
phone. Guy asked to turn it on for Itay's account after the deploy.

16 Nov 2026 (Jira PM-149, thread "Check app against App Store review rules"): Guy approved explicit consent before
data goes to the AI engine (App Store 5.1.2(i)), in generic words ("external AI engine"; OpenAI named in a details
dialog and the privacy policy). Built (G-92): third, required onboarding checkbox, a one-time screen for existing
accounts and viewers, a locked row in Privacy, and server refusal of every engine route without the consent record.
API tests, app tests, typecheck and the i18n catalogue pass; not yet run on a phone. Deploy the API together with the
OTA (an app without the screen can't give the consent). The other App Store items (PM-147, PM-148, PM-150 to PM-153)
are on hold by Guy's choice.

16 Nov 2026 (Jira PM-154, thread "Add weather-based glucose insights"): Guy asked about location and weather insights.
Location (opt-in, coarse, rounded on the phone) and today's weather tips existed since 13 Nov; what was missing was a
link to his own data. Built, after Guy's go-ahead: `POST /environment` now also keeps a daily weather summary per local
day (highest and lowest felt temperature, highest air quality index; never a place) for 90 days; turning weather off
deletes it; it is in the activity export (`weather_days.csv`) and goes with the account. New finding `heat_glucose`
(`environment.heat_relation`, clients sending `kinds=5`): over the last 56 full days, hot days (felt 30 °C or more, the
existing weather band) against other days on time in range, time below range (the person's own range) and, when the
health app has steps for both, middle daily steps. Shown with at least 4 days per side and a 5-point difference; worded
as a pattern, never advice. App and website show it with a two-bar chart; privacy policy updated in four languages. The
summary only sees the hours the app was open, so the comparison needs a few weeks of use before it can show. API tests
and ruff, app typecheck and tests, web typecheck and tests (new `heat-insight.test.ts`), i18n tests pass. Next: deploy
the API, then OTA (JS only, no migration).

16 Nov 2026 (Jira PM-146, thread "Show glucose on CarPlay"): Guy asked for glucose on CarPlay. A CarPlay app is not
allowed for health, but iOS 26 shows Live Activities and small widgets on the CarPlay Dashboard. The glucose Live
Activity now declares the `small` supplemental family on iOS 18+ (diabetic-app #79, merged): CarPlay and the Watch Smart
Stack draw a compact card (value, unit, range label, age; no number once not current; warm-up ready time), no buttons,
sound or alert look. iOS 17 keeps the old configuration (one Widget with an `if #available` branch; WidgetBundleBuilder
has no if/else). Widget target compiled for the simulator on the Mac (Xcode 27.2). Next: the next native build (Guy's
go-ahead), then a look in a car or the CarPlay simulator.

16 Nov 2026 (Jira PM-145, thread "Fix worker CPU overload on Fly"): with the worker on, stedio-api (shared-cpu-1x)
went to ~100% CPU minutes after each start and the app timed out. Measured with per-step timing on a local copy of the
schema (6 people, 60 days of readings): the meal check-in step `routine.suggest` computed every person's full routine
(two weeks of readings scanned per meal) on every 20-second pass, ~0.7 s of a ~0.95 s pass. Fixed (diabetic-api #57,
merged): it reads only meal times; `_nearest` is a binary search; the worker logs a warning for a step over 2 s and a
per-step CPU summary every 10 minutes; `tests/test_worker_cost.py` bounds the rows a quiet pass reads. Pass now ~0.12 s.
Next: deploy the API from the Mac with the worker on and read the first "worker cost" log line.

16 Nov 2026 (Jira PM-131, thread "Host the Streamlit research tool on Fly"): Guy asked to put the research tool on
Fly, smallest machine, not running all the time. Built (diabetic-api #56): own Fly app `stedio-research`
(`deploy/fly/research/`), shared-cpu-1x 256 MB + swap, auto-stop with no Machine kept running; Google sign-in limited
to `STEADY_RESEARCH_EMAILS` once a Google OAuth client exists, until then the access token; its own database login
`stedio_research` with SELECT on the tables it shows only and INSERT on `ml_jobs`; noindex header and meta; only the
derived pseudonym key on that server. API tests (444) pass; the image ran locally against Postgres with that role.
Next: `scripts/fly/stedio-fly research-setup` and `deploy-research` on the Mac; Google client needs Guy's OK. Privacy
open item: no view log yet (PM-138).

16 Nov 2026 (Jira PM-130, thread "Show data age on every glucose value"): device syncs stopped in production after
the 14:07 deploy. A replaced API process died mid-transaction, stayed "idle in transaction" with a row lock on
`device_links`, and every worker pass blocked on it. Permanent prevention (diabetic-api #55): every database connection
has `idle_in_transaction_session_timeout` 120 s and TCP keepalives; the worker has its own pool with `lock_timeout` 15 s
and `statement_timeout` 5 min; each link syncs on its own and a locked one waits for the next pass; `last_attempt_at` is
committed before any vendor call; shutdown joins the worker and disposes the pools. API tests (445) pass. No migration.
Deploy the API. DAP-14 (data age, connection-lost banner) reached the app in build 15 and the 0.5.0 OTA.

16 Nov 2026 (Jira PM-128, thread "Make the website English only for now"): Guy asked to remove Hebrew, Arabic and
Russian from the website for now and keep the app's languages as they are. The website routes English only
(`SITE_LOCALES` in `apps/web/src/i18n/routing.ts`); `/he`, `/ar`, `/ru` and the pages under them redirect (307) to the
same page in English; the language links are hidden. Translations are kept, so a language comes back by adding it to
that list. Typecheck, lint, website tests and a production build checked with curl (redirects, `/en` pages, dashboard,
admin, `/app`, noindex) pass. The legal pages now show in English only: open item PM-129. Deploy the website.

16 Nov 2026 (DAP-19, Jira PM-121, thread "Share a simple view with a trusted person"): Guy asked to move DAP-19
forward around the existing sharing code, and added that a person with diabetes who follows their son needs a simple
switch, that viewing is always view only, and that each person's chat about it is their own. Built (G-91): parts chosen
per person and enforced by the server, consent before an invite, relation and last viewed, an invite link with a preview,
the switcher bar, a private text chat about the followed person's shared data, and an invite code field for "someone
close" (G-90). Migration `5a8e3c1f9b27`. API (439), app (153), website (8), i18n tests and the browser run (28 checks,
he/en, light/dark) pass. JS and API only (OTA), no native build. Not seen on a phone.

16 Nov 2026 (DAP-7, Jira PM-125, thread "Ask who the user is here for at sign-up"): Guy asked to move Itay's
"Who are you here for?" forward. New accounts are asked first, in the app and on the website: for myself, for myself
with pre-diabetes, for my child, or for someone close. Only "for myself" continues (waitlist, setup); the others are
saved and see a "not ready yet, you're on the waiting list" note with "Change my answer". `users.persona` (migration
d0e1f2a3b4c8), `PUT /auth/persona`, admin list shows it, privacy policy updated in four languages (G-90). API tests,
i18n, app and web tests, and e2e `tools/e2e/persona.cjs` (app web export, en light, he light, he dark) and
`tools/e2e/persona-web.cjs` (website) pass. JS and API only: deploy the API (migration) and the website, then the
testers OTA. Not seen on a phone.

16 Nov 2026 (PM-117, idea DAP-14 from Itay's plan, thread "Show data age on every glucose value"): every glucose value
shows its age ("25 min ago"), also the one-line reading above a conversation, and past 15 minutes says "Not current"
with a clock. A device connection (CareLink, Dexcom, LibreLinkUp, Tandem Source) is "lost" when the service refused the
saved sign-in or no fetch worked for 30 minutes (technical sync interval); the main screen and Overview then show a
banner with the service, the time of its last good fetch and "Check connection", and the worker sends one push per lost
episode after quiet hours (`steady_api/link_watch.py`, `GET /devices/connections`, no migration: the marker is kept in
`device_links.device`). Nothing is retried or signed in again. API tests and ruff, app typecheck and tests (142), i18n
tests and web e2e `tools/e2e/data-age.cjs` (en light, he light, he dark) pass. JS only (OTA); deploy the API first. Not
seen on a phone.
16 Nov 2026 (DAP-16, Jira PM-119, thread "Add Israeli Hebrew food list with portions"): Itay's plan asks for local
dishes in Hebrew with typical portions. The source is the Ministry of Health national nutrient database "Tzameret"
(data.gov.il `nutrition-database`, licence `other-open`: copy, adapt and commercial use allowed, the source must be
stated, no implied endorsement). The official CSVs were downloaded on the Mac (data.gov.il is blocked from the cloud)
and built into `services/api/steady_api/data/tzameret.json` by `scripts/build_tzameret.py` (4,508 foods, 3,815 with
portions; questionnaire "FFQ" rows left out). Its carbohydrate field is "available carbohydrate", already net of fiber,
so it is taken as published. `GET /meal/foods` answers Hebrew from this list (spelling variants: vowel letters, ט/ת,
ק/כ, geresh, niqqud) and adds up to five of its foods after USDA for Latin queries; it works without the USDA key. The
app's search sheet shows the typical portion and the source line, and a picked food starts at that portion. API tests
(392) and ruff, app typecheck and tests (141), i18n tests, and web e2e `tools/e2e/israeli-foods.cjs` pass. JS and API
only: deploy the API before the OTA. Lawyer sign-off DAP-67 is still open. Not seen on a phone.

16 Nov 2026 (PM-118, thread "Add burnout mode with fewer nudges"): Guy approved idea DAP-18 from Itay's plan. A
"Fewer nudges" switch on Routine > Check-ins (a week, two weeks or until turned off): the app starts at most one
check-in a day and no late-lunch question, pushes no insights, wins or move compliments, shows only the greeting bubble
and no insight cards on the main screen, and the companion keeps it short and stops nudging. Reminders the person set
and device alerts are unchanged. A gentle offer card appears when most recent check-ins went unanswered (G-88). API
tests (397) and ruff, app typecheck and tests (140), i18n tests and web e2e `tools/e2e/fewer-nudges.cjs` (en light,
he light, he dark) pass. JS and API only; deploy the API before the OTA. Not seen on a phone.
16 Nov 2026 (G-87, Jira PM-112, thread "Show past data when offline"): Guy: "we need an internal memory or cache in the
app so past data shows even without a connection to the server". The app now keeps the last answer of its main reads
(glucose, records and heart rate of the shown window, insights, today's part of day, Body today, learning, food summary,
labs and habits, progress, the conversation and past conversations) in the existing protected store (sealed files, key
in the Keychain / Keystore, this device only; in the browser memory only). When the server can't be reached, the same
read returns the kept answer and an offline banner (designed Banner, Components 12.7) shows on the main screen,
Overview and Journal: "No connection to Stedio - showing what was saved on this phone, last updated today at 14:02".
"Today" reads are not shown on another day; nothing older than 30 days, at most 60 entries; everything is removed when
the session ends (sign-out, expiry, account deletion); nothing is kept while viewing someone else's data; the widgets
and Live Activity ignore kept readings. Privacy policy (4 languages) says so. App typecheck and tests (incl.
`test/offline-cache.test.ts`), i18n and web tests, and web e2e `tools/e2e/offline.cjs` (en light, he light, he dark,
server cut with the page open) pass. JS only (OTA). Keeping across an app restart is verified with a stand-in store only;
not seen on a phone.

16 Nov 2026 (same thread, Guy: "תדאג גם שאנחנו מייצרים פה skills של compliance ו regulatory ובכל פיתוח שלנו אנחנו
בודקים את זה"): two project skills, `.claude/skills/regulatory-check` (medical-device boundaries) and
`.claude/skills/privacy-compliance` (health-data privacy), a CLAUDE.md rule in all four repositories, and a "Regulatory
and privacy check" section in every repository's PR template. Every PR runs both. Tasks are tracked in Jira (PM-114).

16 Nov 2026 (DAP-10 / PM-116, thread "Build one-tap clinic report"; Guy approved the five "Now" items): a clinic
report the person makes in one tap and shares themselves (G-89). Privacy > "Share with my care team" (was "Planned") and
Profile > Account open it: 14, 30 or 90 days, Hebrew or English, optional name and questions, optional full meal and
insulin lists. The server makes the PDF (`steady_api/clinic_report.py`, `POST /reports/clinic`): consensus time in
ranges, mean, GMI, CV, SD, the person's own range, an AGP-style profile by hour, a day-by-day table, the questions and a
"record, not advice" footer. API tests (414) and ruff, app typecheck and tests (150), i18n tests and web e2e
`tools/e2e/clinic-report.cjs` pass. JS and API only; deploy the API before the OTA. Not seen on a phone.
16 Nov 2026 (PM-120, DAP-15 from Itay's plan, thread "Show carb estimates as ranges, save usual meals"): Guy approved
taking DAP-15 into development. Photo and description analysis now asks the food provider for the lowest and highest
plausible weight of each food's served amount and its own confidence (high, medium, low); the server keeps a range only
when it holds the estimate. The meal review shows "Likely 34–62 g · medium confidence" under each estimated food and
the meal's range under the total; once the person changes the amount, weighs it or types the carbs, that food's range
goes away. Saved meals keep the range and confidence, and the first estimate next to a correction (`est_carbs_g`, for
the carb accuracy evaluation PM-72). Usual meals: "Save as a usual meal" on the saved screen (name field), a "Usual
meals" list on Log a meal to log one again or remove it (`/meal/usual`, table `usual_meals`, migration `7c1e9a4b2d63`,
max 30, in the meals export, deleted with the account). Meal cards from the conversation store the same range. Nothing
is shown next to insulin (DAP-61). API tests, app typecheck and tests, i18n tests and web e2e `tools/e2e/carb-range.cjs`
(en light, he light, he dark) pass. API and JS only: deploy the API (migration) before the OTA. Not seen on a phone.

16 Nov 2026 (PM-113, thread "Fix diabetes profile change history labels"): Guy saw saved field names and raw values in
Profile > Diabetes profile > Change history. Each row now shows the profile question's label in the app language and the
values as the questions show them (choices by label, times and dates formatted, glucose and body values with units, ratio
periods in words). New strings `set.pf_from` / `set.pf_to` (from/to, for sleep and quiet hours). App typecheck and tests
(140) and i18n tests pass. JS only (OTA). Not seen on a phone.

16 Nov 2026 (G-86, Jira PM-110, thread "Let users note food on pump carb entries"): Guy: when the pump shows carbs
were entered, let the person write what they ate. A meal the pump recorded (CareLink or Tandem) has a "What did you
eat?" field in its journal detail that saves itself as it is typed (`PUT /records/{id}/food-note`, max 300 characters,
stored as `note` in the meal's data, no migration). The pump's carbs and time are never changed, nothing is written to
the device, and no revision is made. The note is the meal's line in the journal row, goes to the companion with the
meal ("what they ate, in their words"; pump carbs are now told as entered on the pump, not as an estimate), and is in
the meals CSV export. API tests (391) and ruff, app typecheck and tests (140), i18n tests and web e2e
`tools/e2e/pump-food-note.cjs` (en light, he light, he dark) pass. Deploy the API before the OTA. Not seen on a phone.

16 Nov 2026 (thread "Check app against medical-device rules"): Guy shared SaMD guidance (FDA / EU MDR) and asked for an
audit; the findings are in the Claude Doc "Stedio vs medical device rules - audit" (22 items). He then asked to fix the
two non-compliant ones now: (1) the 10-minute "insulin before eating" win and timing insight are removed; (2) glucose
alerts with sound became a quiet "out-of-range look-back" (no sound, no urgent low, only after a whole hour out of
range). API tests, i18n tests and app typecheck/tests pass. JS and API only, no native build. The at-risk items wait for
Guy's choice.

16 Nov 2026 (thread "Move the server to Fly.io"): Guy opened a Fly.io org `stedio` and asked to move the server there
on the smallest machines, as close to Israel as possible. Fly has no Middle East region; Frankfurt (fra) is the closest.
Three apps: `stedio-api` (512 MB, always on: the worker does the device syncs, alerts, pushes and the retrain; volume
for photos and exports), `stedio-db` (Postgres 16 on a 256 MB machine with a volume, daily volume snapshots kept 30
days and a nightly pg_dump kept 14 days; private network only), `stedio-web` (256 MB, stops when idle). About $6 a
month. Images built and run in the container (API health, migrations on an empty DB, website pages, noindex, restore
of a dump). Nothing created on Fly yet. Runbook: `deploy/fly/README.md`; script `scripts/fly/stedio-fly` on the Mac.
The trial runs the API with the worker off so it never signs in to CareLink/LibreLinkUp/Tandem beside the Mac.

16 Nov 2026 (G-85, thread "Let users choose Body today tiles"): Itay asked to replace "Times awake" with resting heart
rate; Guy: let each person choose what the "Body today" card shows, and show the official Apple Health logo instead of
"From Apple Health". A pencil in the card header opens a list of switches (steps, walk and run, average and resting heart
rate, sleep, times awake, and new: exercise minutes and active energy, each with a breakdown), saved as it changes on
the server (`body_tiles` in settings; no migration). API tests (381) and ruff, app typecheck and tests, i18n tests and
web e2e `tools/e2e/body-tiles.cjs` (en light, he light, he dark) pass. JS only; deploy the API before the OTA. The Apple
Health icon follows once Apple's file is downloaded on the Mac (Apple's CDN is blocked from the cloud). Not seen on a
phone.

15 Nov 2026 (thread "Fix push-opened banner on main screen"): Guy tapped a check-in push ("you have a check-in from
the companion") and the main screen opened with a banner that pushed everything down and only said "opened from the
19:03 check, sent, not confirmed seen". Now the follow-up opened from a notification floats over the screen under the
header (`FollowUpCard`) with "Check-in · time", the companion's question, the app's fixed reason (app-made check-ins
only), a close button and the quick answers; a meal check-in also offers "Yes, log my meal". The push (server) and the
phone's local notification carry the follow-up's title instead of the generic line, unless it has a digit or is over
110 characters (api 3a57e8e, app fb5336c, JS only). API tests (377) and ruff, app typecheck, lint and tests (129) pass;
seen in a web export against the e2e API. Deploy the API, then the testers OTA. Not seen on a phone.

15 Nov 2026 (G-84, thread "Add conversation bubbles to home screen"): Guy: like the website's "Hi, how was your day?",
the main screen opens with the companion's speech bubbles, a greeting or a question about earlier conversations, and
offers to go on in text or by voice. Up to two bubbles above the character: a fixed greeting for the time of day when
nothing was said for an hour, and questions the model writes in the background from recent conversations, memories and
logged meals, activity and notes (`GET /conversation/openers`, kept in `user_settings.openers`, migration
`c9d0e1f2a3b7`). No numbers, doses or alarming words; such questions are dropped. Tap: "Reply in text" opens the
conversation with the bubble; "Talk by voice" starts the live call, which opens by asking it. "Tap to talk" and the
carousel are smaller. API tests (369) and ruff, app typecheck and tests (129), i18n tests and web e2e
`tools/e2e/openers.cjs` (en light, he light, he dark) pass. Voice from a bubble verified in the API test only. Later
the same day (Guy): one bubble at a time, taking turns every 7 s, shaped as a speech bubble with a tail to the
character (app 7e3b3c2, JS only). Deploy
the API (migration, back up first) before the OTA. Not seen on a phone.

15 Nov 2026 (G-82, thread "Align the learning progress screens"): Guy: Routine said "day 5 of about 6" while Overview's
learning bar said "5 days left to warm up", which looked like one clock adding up to 9. They were two clocks: the routine
counts from the day the account was opened (3 days, plus the 3 Guy added), the learning bar counted down to a week after
the first insight was shown (13 Nov, when insight listings started being kept). Now both use one day count, day 1 = the
day the account was opened: the bar says "Today is day 5. On day 10 (20 Nov) the first insights you saw become
examples". The bar opens a new Learning screen: day tiles from day 1 to today and on to the first examples' day, and for
the chosen day what was collected (entries, readings, meals, insulin, insights shown) and what became known (first
impressions of meal times, insights turning into examples, a checked order going live), plus how days are counted and
the four stages. `GET /insights/learning/days`; `GET /insights/learning` gains `day`, `first_shown_on`,
`first_ready_day`. API tests and ruff, app typecheck and tests, i18n tests and web e2e `tools/e2e/learning.cjs` pass.
API 8b47eb3, app df91df5. JS only; deploy the API before the OTA (an older API has no day count; the bar then falls back to its general line and
the new screen shows no tiles). Not seen on a phone.

15 Nov 2026 (thread "Improve the today so far summary"): Guy: the summary should not repeat the A1c, drop "logged
something on 1 of 1 days", show time in range as a share, and say more about what is worth checking, with round charts,
"what to keep" and "what to improve", and more charts inside first-impression insights. Summary now: time-in-range donut
plus small donuts by part of the day; routines split into keep / improve / more patterns, each with what was seen
(medians), what to look at and a tap into the insight. Insight screens get an "at a glance" card (how often seen, median
per day against the range, before/after for meals and workouts, time in range on two kinds of days for body
relations). JS only (app d4111b5). App typecheck, tests (125) and i18n tests pass; screenshots from the web preview with
fixtures. Not seen on a phone.

15 Nov 2026 (thread "Make the website calmer and inviting"): Guy: the site felt stressful, too much information,
colours should be softer and lighter, keeping our brand colours. Home page redesigned with the brand tokens used lightly:
the companion orb (face, float, blink) in the hero, one call to action (waiting list, free), three one-line steps,
safety and devices in two cards, privacy in one line, FAQ, light footer with the language links. New `web.c_*` texts in
four languages. noindex, legal links, RTL, day/night unchanged. Web typecheck, lint, tests, build and screenshots in four
languages pass (web 441d785). Needs a website deploy on the Mac. Later the same day: the companion sits inside an
iPhone-style frame beside the words, and (Guy: "we're not only for type 1") the website eyebrow and disclaimer, the
app's welcome title and the privacy/terms texts say "diabetes" instead of "type 1 diabetes" (web 569ab45). The app's
onboarding note for other types ("designed for type 1") is no longer shown (app 4e99447, JS only, next OTA).

15 Nov 2026 (G-80 follow-up, same thread): Guy saw "the app may not be updated" on Overview during his warm-up; the
note now says a new sensor is warming up and when it is ready. A push "Sensor is reading again" when the first reading of
a new sensor arrives (CareLink, Libre, Tandem). API and app tests pass. Not seen on a phone.

15 Nov 2026 (G-81, same thread): one lock-screen card only (the app keeps its card id and token in a file, updates the
newest and ends the rest after a restart or update) and no value on the card without a recent reading (server sends it
without the value 15 min after the reading). JS and API only; Swift also hides it locally from the next build. API tests
and app tests pass. Not seen on a phone.

15 Nov 2026 (G-80, thread "Show sensor warm-up countdown"): while a new sensor warms up, the main screen shows how long
until it reads ("Ready in about 40 min", then "Ready any moment") instead of the last reading. Known from CareLink's
WARM_UP state, LibreLinkUp's activation time and Tandem's sensor start; lengths from the makers (Guardian 4/Simplera 2 h,
Libre 60 min, G6 2 h, G7 30 min). Dexcom Share gives no start, so not shown there. API tests (new `tests/test_warmup.py`)
and ruff, app typecheck, tests and lint (no new problems), i18n tests pass. Main screen is JS only (API first, then
OTA). Lock screen, widgets and watch need the next native build (Swift not compiled here). Not seen on a phone.

15 Nov 2026 (G-78, thread "Nudge when lunch is late"): a push 45 minutes after the person's usual lunch time when no
meal and no bolus are recorded since 11:00, once a day, within the check-in cap and quiet hours. It asks whether they ate,
with buttons "I ate, log it" (meal logging) and "Not yet" (the companion's fixed line on regular meal times). API 346
tests and ruff, app typecheck, 118 tests and lint (no new problems), i18n tests pass. JS only, no migration; the API must
be deployed before the OTA (an older API rejects `answer`). Not seen on a phone.

16 Nov 2026, ~16:50 UTC (same thread, PM-157): Guy on build 15 with the direct path on: "the voice talk sounds great
now". Two asks, both JS only (0.5.0 OTA): the call is now one for the whole app (`liveCall.ts`), so leaving the
companion screen keeps it and coming back shows it; a small accent bar above the tabs ("In a call with {name}") taps
back to the call or ends it; signing out ends a call. Saying goodbye (bye, goodbye, להתראות, ביי, مع السلامة, пока...
at the end of a short utterance, judged once the words settle) makes her say one short goodbye, then the call ends
(direct path only; the relay keeps going). App #82, API #61 (the goodbye instruction), call-bar strings in four
languages. Next: deploy the API (not during an open call), OTA for 0.5.0, Guy tries.

16 Nov 2026, ~14:30 UTC (same thread, PM-111): the first sim run of the direct path took the production API down twice
(13:53-13:58 and ~14:00-14:07 UTC): opening a session built the companion's context on Fly's one shared CPU for minutes,
the app timed out at 30 s and asked again, the builds ran at once and could not be cancelled, and each waiting request
held a pooled DB connection (QueuePool exhausted, health check failing). API #45: the direct path is OFF unless
`STEADY_LIVE_RTC_ENABLED` is set (GET /voice reports `rtc`, phones use the relay otherwise); no pooled connection while
waiting (`BriefUser`); one open per person, two on the server, six per person per 10 min (429); preparation on its own
two threads, answered within 22 s, the build stops at 20 s and each query at 10 s; the slow context parts (routine,
findings, Overview order) cached 5 min per person (also for delegations), purged on account deletion. App #69: direct
path only when the server says `rtc`, opens never overlap, backoff 2 s/6 s (10 s when busy), session wait 60 s, leaving
the screen ends a call still opening. Next: a controlled test of the direct path with the switch on, timing lines
`live rtc session … queued/prepare/openai` and `companion slow context ms`, before build 15 and before switching it on.

16 Nov 2026 (thread "Fix companion voice call cutting off"): on Fly, the relay still cut the greeting ("איך הו"): the
server sent only 2.2 s of it (its hold-and-slice of the model's audio), with no mic or network cause (Fly CPU/memory fine,
Fly to OpenAI 0.7 s). Guy chose (decision card) the mixmaster-pro way: the phone connects to GPT-Live directly over
WebRTC (react-native-webrtc, call-mode echo cancellation, loudspeaker by react-native-incall-manager); the server opens
the session with its key (`/voice/live/rtc/session`), answers delegations dose-checked (`/turn`), keeps her own turns
(`/said`) and checks her words as she speaks (`/check`; a dose sentence mutes and stops her, a failed check fails
closed). API #42, app #65 (version 0.5.0, native). Real WebRTC probe from the Mac passed (greeting audio 0.9 s after the
channel opened, input transcript and delegation work). Builds without the module keep the relay. Next: one testers
build (with the warm-up/Live Activity Swift changes), Guy tries a call.

15 Nov 2026, ~16:00 UTC (same thread): Guy, on API 8b47eb3: "still keeps jumping". His call's log: the first socket
ended about 5 s after a 1.4 s greeting, a second opened with a new greeting, answered one question (10.2 s of audio) and
ended; no talk-over, cut, ignored or playback-gap keys, no warnings, no close reason logged. E2E run 6 (real model): no
cuts from noise or echo; a meal said with a 1.2 s pause was answered after its first half (the simulated phone cannot
talk over; on a phone the talk-over detector covers it). Merged: API #26 (nudge after 5 s of silence, "working on it"
line for slow app answers, audio placed by the model's timeline, settle 1.3/3.0 s, the log now says who ended a session,
the close code, the app update/runtime and why a resumed call dropped) and app #46 (sends those codes; JS only). 353 API
tests, 129 app tests. Next: deploy the API, OTA, Guy tries; read the new "live start/resume" and "session ended" lines.

15 Nov 2026, afternoon (same thread): Guy: better but far from ChatGPT's live voice (same engine). Research: GPT-Live has no
VAD/turn settings; its prompting guide's turn-taking lines are the lever. New `scripts/live_e2e.py` (simulated phone, real
relay and GPT-Live, test DB only), run twice on the Mac: a long first sentence waited 8.2 s, now 2.98 s (a part of a
sentence up to a comma goes out early when it holds no number or unit; the rest is checked with it); meal said with a pause
now answered whole (delegation waits 0.9 s quiet, max 2.5 s); Hebrew from the start; no cuts. API 3500efc, 348 tests.
Remaining: gaps inside long answers (held per sentence for the dose check).

15 Nov 2026, later (same thread): Guy: much better, but light noises still stop her. Log: a talk-over stop before her
answer started playing (`barge_played_s=0.0`, noise in the jitter lead). Now nothing counts before her first sound is
due, and a loud frame counts only if it repeats at a speaking pitch (`voicing`, 70-400 Hz after a 100 Hz high-pass);
synthetic noise, hum and clicks give 0, voices 0.8-0.93 (app 8399a8d, JS only). 118 app tests pass. Next: OTA, Guy tries.

15 Nov 2026 (G-79, thread "Show breakdowns and Itay's workouts"): tester Itay asked to tap Overview's body and food
tiles for a breakdown (protein per meal, etc.): each tile opens a sheet (today by hour or by meal, the last week, last
night's stages and awakenings; `GET /health-data/today/details`). His empty Activity filter: workouts did arrive (21), but
a Health sync interrupted by the phone locking made the server mark missing types deleted, workouts and their journal
entries among them (DB: 128 of 177 exercise-minute samples, 23 of 52 stand hours, 1 of 2 recent workouts). Now only the
types the phone read can be found deleted (`window_types`), a re-sent sample comes back with its journal entry, and
iPhones re-read 30 days once (`readTypes` 3). API tests and ruff, app typecheck, tests and lint (no new problems), i18n
tests, web preview e2e `tools/e2e/breakdown.cjs` pass. JS only for the app; deploy the API before the OTA (an older API
refuses `window_types`). Itay needs no new permission.
Follow-up the same day (app ef5a03c, JS only): the food breakdown can be edited (meal editor from a row, delete with
confirmation, autosave when changing a saved meal); web e2e passes.
Same day: the insight's personal reading loads by itself (no button, one line on what it is, quiet on failure, 60 s
wait); its failure for the A1c estimate was a 500 (`days` is a count there), fixed in the API with a regression test.

15 Nov 2026 (G-83, thread "Show CareLink fingerstick readings"): Guy entered a blood meter reading on his pump while
the sensor warmed up; it reached CareLink but not Stedio. Cause: the CareLink import read only `sgs` (sensor) and the
MEAL and INSULIN markers; BG_READING and CALIBRATION markers were skipped. Now they are saved as meter readings
(`method` "meter", source carelink, key `carelink-bg-<ts>`), once (a calibration of the same value within 2 minutes, or
the marker re-sent a second later, is the same reading); the 30-day history import no longer skips sensor points near
a meter reading. The companion is told fingerstick readings on their own line and the sensor list is sensor-only. The
app already shows `method` meter as "מד דקירה" (journal, Overview dots). Field names follow the open CareLink clients
(`unitValue`, older `value`/`bgValue`); `scripts/carelink_marker_shape.py` prints the real shape (names only) on the
Mac. API tests and ruff pass. Deployed and checked on Guy's real data (BG_READING with `unitValue`).
Follow-up (Guy, same day): the character did not react to his high fingerstick. The reaction lasted 20 minutes and the
pump-entered reading arrived later than that; now a meter reading keeps its reaction 30 minutes and fades out by 60,
also during a warm-up (display times, not clinical). App 593d5b5, JS only; tests 129/129, typecheck pass.

15 Nov 2026 (thread "Fix companion voice call cutting off"): Guy: in the voice call the companion still starts and
stops. The API log of his test showed talk-over stops (`barged=1`) 0.7 s and 1.8 s into answers: the phone's talk-over
detector learned the loudspeaker's echo level as an average, which drifted down until her own voice counted as the
person talking (933 of 1200 simulated speech-like echo runs stopped her). Now the echo level is the loudest echo seen,
slowly forgotten, learned from a full second of her speaking, and microphone frames are timed by the recorder's sample
count (app 748dd26, JS only). Simulation: 0 of 1200 stops, with or without JS stalls; loud talk-over still stops her.
App 115 tests, typecheck and lint pass. Not yet heard on a phone. Next: OTA, then Guy tries a call.

15 Nov 2026 (G-77, fourth follow-up): steps and energy personal bests are now detected during the day on every health-data sync (a later, higher sync raises the same win). A small win shows on its own day, or the next day only if it was found then, never later (`winShownNow`). API 812ecbe, app eb386c1. Needs an API restart, then a JS-only OTA.

15 Nov 2026 (G-77, third follow-up): Itay's main screen had no insights left. Every unread insight now shows there
whatever its age or time of day (this time of day first, at most 5); reading or marking takes it off. App typecheck, 130
tests, web preview e2e (`insights-page.cjs`, `mark-read.cjs`) pass. JS only.

15 Nov 2026 (G-77, second follow-up): Guy still saw yesterday's insights on the main screen. An insight now stays
there only while unread and new or changed today (opening it reads it on the server, as before); small wins only on their
day. New page "All insights" (`/insights`), linked under the cards: unread first, then "Read". App typecheck, 130 tests,
lint (no new problems), i18n tests, web preview e2e `tools/e2e/insights-page.cjs` pass. JS only, no API change.

15 Nov 2026 (G-77 follow-up, same thread): Guy did not see the button, because insight cards show under the companion
only when they are about this time of day. Now every card that is not urgent has it (part of the day, compliments, small
wins, weather, insights); non-insight marks go to `POST /insights/home-read` and come back the next day. API 338 tests and
ruff, app typecheck, 116 tests and lint (no new problems), web preview e2e passes. API deploy before the OTA.

15 Nov 2026 (G-77, thread "Let users mark insights as read"): a "mark as read" chip on insight cards in the carousel
under the companion. The card leaves at once; the server keeps it per account (feedback `read`, `InsightsOut.done`), so
it stays off the main screen on every device until the insight changes; Overview still lists it. Fed to learning (an open
for the ranker; the companion hears it). API 337 tests and ruff, app typecheck, 110 tests and lint (no new problems),
web typecheck, i18n tests pass; web preview e2e `tools/e2e/mark-read.cjs` passes (hide, kept after reload, still in
Overview), Hebrew day and night checked. JS only, no migration. Next: deploy the API, then OTA.

15 Nov 2026 (G-76 follow-up, Guy approved): meal carbs are net carbs (total carbohydrate minus dietary fiber, floor 0).
The vision schema asks for fiber per 100 g; USDA uses nutrient 291. Labels read "פחמימות נטו" with a note on the review
screen. Only new estimates change; saved meals keep their values. API 378 tests pass. Deploy the API before the OTA.

15 Nov 2026 (G-76 follow-up, Guy): each food's carbs read "פחמימות ≈ N גרם" (Guy took the number for weight), and a
pencil on the carbs and protein chips shows they can be typed. App tests, typecheck, lint, meal e2e pass. JS only.

15 Nov 2026 (G-76 follow-up, Itay via Guy): protein on the meal. Food search already brought protein per 100 g and
stored it, but it was never shown. Each food now shows its protein (or "unknown · add") and can be typed (scaled with
later amount changes); the total and the saved card show protein when every food has it. App typecheck, 131 tests, lint
(no new problems), meal e2e 19/19 pass. JS only.

15 Nov 2026 (G-76, thread "Improve meal photo capture and editing"): a meal can have up to two photos (another angle,
or a side dish), taken one after the other or picked together; both go to one analysis and stay with the saved meal
(`photo_ids`), side by side in the journal. An optional text about the photos goes with them to the analysis. The review screen is easier to correct: type the amount, type the carbs
(scaled with later amount changes), rename a food without losing its estimate, an estimated weight and the model's
assumption under each food, the photos at the top. API 336 tests and ruff, app typecheck, 112 tests and lint (no new
problems), i18n tests, browser e2e (`tools/e2e/meal.cjs`, two photos, typed amount, typed carbs, rename) pass; Hebrew day
and night checked in the web preview. JS only for the app; the API must be deployed before the OTA (older API refuses
`photo_ids`). Not run on a phone; real two-photo quality with OpenAI not checked.

14 Nov 2026 (G-75, thread "Log food and readings by chat and voice"): the companion logs from the text chat and live
voice: cards for a meal (with the food estimate), activity, insulin the person says they took (never with a connected
pump) and a note; Save on the card or "save it" in words; a clarified meal replaces its card or updates the saved meal.
Itay's note fixed: answering a food question in the meal editor re-estimates its carbs. API 335 tests and ruff, app
typecheck, 108 tests and lint (no new problems), i18n tests pass. JS only, no migration. Cards not yet seen on a phone
or in the web preview.

14 Nov 2026 (G-74, same thread): a logged meal and its pump bolus share one journal row; the food card shows today's
meals, carbs and protein so far with the full-day average beside them; a full day is read from the journal and the
pump's carb entries once the day ends (no button); Overview shows how far insight ordering has learned ("למידה":
warming up, learning, checking, tailored to you); Devices lists only data connections. API 325 tests and ruff, app
typecheck, 104 tests and lint (no new problems), i18n tests pass; cards checked in the web preview (Hebrew). JS only,
no migration. Not run on a phone.

14 Nov 2026 (G-73, same thread): a compliment from the companion while moving (exercise minutes or brisk steps, once per
stretch, quiet hours kept), activity details in the journal (distance, steps, energy, heart rate), Overview's body and
food cards as icon tiles, and the "logged all of today" button only from 18:00 with today kept out of the averages
until it ends. API 323 tests and ruff, app typecheck and 102 tests, i18n tests pass; tiles checked in the web preview
(day and night, Hebrew). JS only. Not run on a phone; the 15-minute timing depends on iOS background delivery.

14 Nov 2026 (G-72, thread "Show Health data insights in overview"): Overview has a "Body today" card from Apple Health /
Health Connect (steps and a usual day, distance, average heart rate, resting heart rate, last night's sleep against the
person's usual night, times awake, deep and REM), and three new insights: glucose after shorter and longer nights, on
days with fewer and more steps, and with a lower and higher resting heart rate (28 days, `kinds=4`). Website insights
too; the companion hears them. API tests (new `test_body.py`) and ruff, app typecheck and tests, web typecheck, lint
and tests, i18n tests pass. No migration, no native change (OTA). Not run on a phone. Next: deploy the API, then OTA.

15 Nov 2026 (G-71 follow-up): company details from Guy (Ming GF Ltd, Tel Aviv, Israel) in the privacy policy,
terms and accessibility statement in all four languages and on the website footer; governing law Israel, courts in
Tel Aviv. The app's Privacy policy button opens the website's policy when `EXPO_PUBLIC_WEBSITE_URL` is set (the web
build uses its own origin); without it the old "not published yet" note stays. Remaining placeholders are in
`docs/legal-open-items.md`.

14 Nov 2026 (G-71, thread "Write privacy and terms pages"): the website's footer links open real pages: privacy
policy (GDPR and Israeli Amendment 13: controller, data, legal bases with explicit consent for health data, processors,
read-only devices, transfers, retention, rights, security), terms of use (mentor, no treatment instructions or doses,
ADA guidance, not a medical device, not for emergencies) and an accessibility statement (IS 5568 / WCAG 2.1 AA), in
all four languages. Unknown details are highlighted placeholders, listed in `docs/legal-open-items.md` for Guy and a
lawyer. Accessibility fixes: localized not-found page with `lang`, reduced motion, 320 px reflow, night primary button
contrast; fonts self-hosted instead of Google Fonts. axe-core: 0 violations on 20 pages in day and night; web typecheck,
lint, tests and build pass. Next: Guy fills the placeholders; deploy the website.

14 Nov 2026 (thread "Build the diabetes companion app"): the approved batch. Forgot password by emailed code;
Routine first-days summary (RTN-02), snooze and pause dialogs with the paused banner, remove-all confirmation;
"not today" and pause on the server (migration `a7b8c9d0e1f5`); notification buttons; background sync from Apple Health
and Health Connect (native, next build); recent days by weekday; RTL chat bubbles; voice fixes (delegations always
answered with a 20 s limit, a held reply released when the model's audio stops, a moment kept before speech, the
microphone started before the greeting); meal time editable, previous meals. API 312 tests and ruff, root check
(typecheck, lint, tests) pass; iOS and Android bundles export. Not run on a phone; Swift and Kotlin not compiled here.
Next: deploy and OTA at runtime 0.3.0, then raise the version, simulator compile check and the native build.

14 Nov 2026 (G-70 follow-up, thread "Add gamified unlocks for the companion"): Guy asked for a fixed companion name and
fewer unlocks at once. The name field is removed (onboarding, Profile › Companion, website). The server opens at most
one new item a local day, and no counts are shown. API rewards tests and full suite, app tests and typecheck, website
typecheck and lint pass. No migration. JS only for the app (OTA on 0.3.0).

13 Nov 2026 (G-68 moments, same thread): trend glance, back-in-range cheer, night nap with a startled wake on a low,
meal chewing and lip licking, workout sweatband, new set held up, Hanukkah crown, and a hug on hard moments (API
`show_support` tool, `flags.support`). App 96 tests and typecheck, API 285 tests and ruff pass; web preview only.
Next: deploy the API for the hug, OTA, Guy's look on the phone.

13 Nov 2026 (G-68 follow-up, thread "Turn the companion orb into a character"): the character's body follows the
latest fresh reading: cold sweat and shivers below the range, hot sweat and a rising red flush above it, a thumbs-up
now and then in range; fades out as the reading ages. App tests (87), typecheck and lint pass; checked in the web
preview. JS only. Next: Guy's look on the phone; then the next character moments (trend glance, night nap, meals,
workouts, set changes, seasons, a hug).

13 Nov 2026 (G-70, thread "Add gamified unlocks for the companion"): companion unlocks. 18 new accessories open over
time for habits (meals logged, workouts, days with a sensor, days in a row, messages, small wins, days together),
never for a glucose value; nothing is ever taken back. API (table `unlocks`, migration `f8a9b0c1d2e4`, worker step,
`GET /rewards`, `POST /rewards/state`) 293 tests and ruff pass; app 94 tests and typecheck pass; website typecheck,
lint and build pass. The new drawings, the locked picker and the "unlocked!" dialog were checked in the web preview
with a temporary stand-in for the server answer; not run on a phone. JS only for the app (OTA on 0.3.0). Next: run
the migration and deploy the API before the app OTA.

13 Nov 2026 (G-69, thread "Write insulin and glucose to Apple Health"): Apple Fitness and Health Connect activity:
exercise minutes and stood hours read on iPhone, a routine for them and for workouts on the Routine card, and lows in
the 12 hours after workouts added to the workout insight. API 269 tests, ruff, app 85 tests and typecheck pass; no
migration and no native change. Not run on a device. Next: deploy the API before app code that sends the new types.

13 Nov 2026 (G-68, thread "Turn the companion orb into a character"): the orb has a face in every state, an idle
life (hops, somersault, boredom with a yawn, and costumes: syringe, insulin pump, vial, pen, juice box) and
accessories chosen in Profile > Companion instead of the look picker (hat, glasses, mustache, bow tie or scarf), saved
with the profile. App tests (84) and typecheck pass; checked in the web preview in day and night. JS only, so it can
also go to the 0.2.0 testers as an update. Next: Guy's look on the phone; decide what happens to onboarding's
"choose a look" step.

13 Nov 2026 (G-67, same thread): steps and active energy as a routine on the Routine screen and personal bests as
small wins (iPhone and watch counted once). API 263 tests, ruff, app tests and typecheck pass; no migration. Screen not
checked visually. Next: deploy (API and app), then a look on the phone with build 5.

13 Nov 2026 (G-66, thread "Write insulin and glucose to Apple Health"): writing glucose, insulin and meals to Apple
Health and Health Connect (no insulin there), off until the person turns it on, with sync ids so nothing written is
read back or written twice. App unit tests, typecheck pass; app version 0.3.0 (native change). Not run on a device.
Merged to main (app version 0.3.0). Next: Xcode compile check on the Mac and testers build 5 with Guy's go-ahead.

13 Nov 2026 (G-65, thread "Add Dexcom and Tandem integrations"): Tandem Source connection (t:slim X2, Tandem Mobi),
reading only, following tconnectsync; Dexcom stays on Share because the official API is 1 to 3 hours late. API, app
and website built; API 255 tests and `pnpm check` pass; no migration. Not run against Tandem (no account yet); the app
screens were not checked visually. Next: deploy, then a real Tandem Source account.

13 Nov 2026 (G-62, thread "Build the diabetes companion app"): Guy's 8-item batch, built end to end (details in
`docs/design-gaps.md` G-62): Sol on the Responses API, the model's personal reading of an insight with tools and
evidence checks, "Why am I seeing this?", prediabetes, goals and difficulties, food/meds/fitness details, labs and
habits, questions asked later, companion profile proposals and change history. Same morning: moving confetti on the
small-win card and a closable "complete your profile" banner on Profile. Migration `f3a4b5c6d7e8` is on the Mac.
API 241 tests and `pnpm check` (app 66 tests) pass. Not yet seen on a phone; the app screens were not checked
visually in a browser in this round. Next: deploy, then Guy's look on the phone.

13 Nov 2026 (progress metrics and insight ranker, G-61; thread "Build progress metrics and insight ranking model"):
Guy asked for lasting progress measurement, learning data, a small trained insight ranker, a research tool and
consent enforcement. All of it is built (design and rules in `docs/ml-ranker.md`). Shared metrics now measure each
sensor's own rhythm instead of assuming 288 readings a day. That assumption had made a full LibreLinkUp day count as
33 %, emptying the day bars and hiding the estimated A1c; it is fixed in the app's day bars, the estimated A1c, the
follow-up coverage and the daily check. The other changes:
- duplicates and overlapping sources resolved;
- the person's range kept apart from the consensus thresholds;
- a baseline period, with a change counted as sustained only after 3 sufficient weeks;
- "A typical day" and "Progress against your starting period" in the Overview for week, 2 weeks and month;
- insight listings, clicks, actions, feedback and 7/14/28-day outcomes kept apart;
- the training consent enforced, with withdrawal removing rows and models;
- `steady_ml`: versioned datasets, logistic regression, an evaluation gate on unseen people and later periods
  against the rules, a registry with rollback, and jobs run by the worker;
- the ranker in shadow mode by default, with a tester flag and a fallback to the rules;
- a Streamlit research tool behind a token, local only.

Migration `e2f3a4b5c6d7` is on the Mac (13 Nov). API 231 tests pass. The browser e2e `tools/e2e/progress.cjs`
passes on the web build. Nothing is seen with real data yet, and there is no trained model, because no real
listings exist yet.

12 Nov 2026 (night, launch crash): from the update with meal-time insights on, the app crashed right after loading:
the finding title for `meal_time` (and later `workout`) needs values the generic title call did not give, and the
message formatter threw while building the Overview. Fixed: titles get every value they use, a missing value returns
the message text instead of throwing, and the API sends the new kinds only to clients that ask with `kinds=2`, so
older app code on a phone (the embedded bundle, or a rolled-back update) no longer meets them. Reproduced in the web
build with a signed-in account before the fix; API 188 tests and `pnpm check` pass.

12 Nov 2026 (night, G-54): meals store protein and fat; insights for a later rise after meals richer in protein and
fat and for glucose around each kind of workout, in the app, on the website and for the companion. API 188 tests and
`pnpm check` pass; not yet seen with real data.

12 Nov 2026 (night, G-53): optional medicines (not type 1), food and fitness steps in onboarding, shift work and
cycle in the routine step, editable in the app's Diabetes profile and on the website; the companion gets them as
facts. API 187 tests and `pnpm check` pass; the three new steps were checked on the app's web build; not yet seen on a
phone.

12 Nov 2026 (night, G-52): diabetes type 2 in onboarding and the website profile, "I don't use insulin" skips the
insulin steps, Devices offers only the connections that fit the profile's pump and sensor, "FreeStyle Libre" without
a number. API 187 tests and `pnpm check` pass; not yet seen on a phone.

12 Nov 2026 (night, meal times as insights): the usual meal times from Routine's "What I've learned so far" are also
insights (finding kind `meal_time`, one per meal, first impression below 3 days), in the app and on the website. API
187 tests and `pnpm check` pass; not yet seen on a phone.

12 Nov 2026 (night, one row per moment, G-51): the Journal joins a pump meal to its bolus and pump insulin to the
sensor reading taken at that moment, as one row. `pnpm check` passes with new journal tests; not yet seen on a phone.

12 Nov 2026 (night, pump insulin): a CareLink insulin entry now says how the pump gave it (automatic correction, bolus,
manual bolus, from CareLink's activationType already kept as the record's reason) instead of "insulin you reported
taking", and shows the carbs of a pump meal recorded within 5 minutes of it. LibreLinkUp gives glucose only.
`pnpm check` passes; not yet seen on a phone.

12 Nov 2026 (night, Journal fixes from Guy): a sensor reading says "Sensor" instead of the logging form's "(I'm
entering it)"; heart rate is a heart icon and the number, without "per minute"; insulin titles always show the number of
units (Hebrew plural rules read 0.4 as "one", which printed "one unit" for pump micro-doses) and the pump's own entries
are named "Insulin from the pump" in the interface language instead of "Pump". JS only, so it goes out as an update.
`pnpm check` passes; not yet seen on a phone.

12 Nov 2026 (night, lock screen): the card shows the part of the day without its hours and says "Not live · X ago";
15 minutes after the reading iOS marks it stale and the card greys the value and shows "Not current" (patched
expo-live-activity passes `staleDate`, `patches/`). The update runtime moved from the fingerprint to the app version
(0.2.0) because the fingerprint differed between the Mac and the EAS build, so the first `eas update` could not reach
build dc325b8f; raise `version` with every native change. Needs a new build. Swift not compiled here (no Xcode).

12 Nov 2026 (night): meal photo analysis worked once on the iPhone, then failed: the model gave an amount in grams
above the item limit of 100 and the whole answer was refused. The limit is now 1000 (as a saved meal allows), a single
out-of-bounds food is left out instead of failing the meal, and the failure kind is logged. API 187 tests pass.

12 Nov 2026 (evening, G-50): "Update available" in the app: `expo-updates` (channels per EAS profile, fingerprint
runtime) with a banner that downloads and restarts, and "New version to install" from `GET /app/version`. Needs a new
iPhone build (Guy approved); updates are then published with `eas update --channel testers`. `pnpm check` and the API
tests pass; the web preview starts; not yet run on a phone.

12 Nov 2026 (evening, fixes): meal photos never reached the server from the iPhone. Expo's fetch (the global fetch
since SDK 54) cannot send React Native's `{ uri, name, type }` form parts and threw before any request, which the app
showed as "photo analysis unavailable". The upload now sends an expo-file-system `File`; the server recognises a photo
by its first bytes when its type is missing or unusual. Also: registering the same push token twice at once no longer
returns 500 (one upsert), and a failed USDA search logs its status (never the address, which carries the key). API 185
tests pass. Not yet verified on the phone.

12 Nov 2026 (evening, third batch, G-49): the Overview gains a rolling 24-hour period (app: 24 hours, Day, Week, 2 weeks,
Month; website: 24 hours beside 14/30/90 days), so its time in range can match the pump's; the Google profile picture
of a Google account shows on the app's account card and the website's account box (migration `c2d3e4f5a6b8`); the
companion header shows the chosen companion picture and no "AI companion" line. API 184 tests and `pnpm check` pass;
checked in the browser (app 24-hour overview, profile picture, companion header; website 24-hour overview).

12 Nov 2026 (evening, second batch): trend arrows from CareLink (lastSGTrend), Dexcom Share (Trend) and
LibreLinkUp (TrendArrow) are kept with the reading (`glucose_records.trend`, migration `b1c2d3e4f5a7`) and shown beside
the latest reading in the app (while under 15 minutes old) and in the website's timeline; the website timeline shows
the heart rate from Apple Health / Health Connect beside a reading, as the app does; sharing moved to the Account group
in the app's Profile; the app reloads its screens every 5 minutes while open and on coming to the front, and reads the
health store every 5 minutes (was 15). API 183 tests and `pnpm check` pass; the website timeline was checked in the
browser with a trend and a heart rate.

12 Nov 2026 (evening): the website shows only settings and asks which connection to set up until the account holds
data (`has_data` on /auth/me); Libre's logbook (about 14 days) is read on the first fetch; the app's Profile shows the
signed-in account with a real sign-out and a sign-in button when signed out; pull to refresh asks the server to fetch
from every connected service now (`POST /devices/sync`, a service tried in the last minute is skipped) and sends new
Apple Health readings; the Journal shows a loader while its first load runs. API 183 tests and `pnpm check` pass;
checked in the browser (website first visit, app profile and sign-out, journal loader).

12 Nov 2026 (latest): LibreLinkUp's first real sign-in was refused; the answer is now logged, the app no longer
repeats a refused sign-in, and the headers follow the maintained client (G-45). API 181 tests pass. Waiting on Guy's
next try.

12 Nov 2026 (later still): G-48, the target range from the pump or CareLink wins over a typed one and cannot be edited
in the app, on the website or through the API (`device_target` on the profile). CareLink gives no carb ratio,
sensitivity, target or basal settings, so those stay typed. API 180 tests and `pnpm check` pass; checked here in the
app's web build and on the website with a CareLink link given alert limits; not yet seen on a phone.

12 Nov 2026 (later): G-47, repeated CareLink pump events removed (migration `a8c9d0e1f2b4`) and a pump meal linked to the
meal logged in the app, with the carb difference followed two hours later; prices $25/month and $250/year shown
without buying; mobile menus and a sticky home header on the website. API 179 tests and `pnpm check` pass; the
migration's cleanup was run here on sample rows. The journal's pair card has not been seen on a phone yet.

12 Nov 2026: pull to refresh on Overview and Journal (`features/refresh/usePullRefresh.tsx`; the spinner stops when
the screen's server loads have answered), and the app's account screens set for email and password plus Google
(G-46). Checked in the container on the web build (sign-up shows the closed note, a wrong password is refused by the
server); the pull gesture and the Google button need the iPhone build.

## Stage 1 record

**What was inspected**

- The project folder `/Volumes/Studio SSD/Workspace/diabetic` was empty. It had no code, no repository
  instructions and no git repository.
- The Claude Design canvas "Steady — T1D companion design" at https://claude.ai/artifact/WYuW5K5Be1Y42WZ8PR92Ni,
  published version `1794329313-76e8`. It has 16 boards:
  - 8 interactive phone flows
  - the website
  - the web dashboard
  - tokens, components, localization, inventory and handoff
- The design handoff (`design/claude-design/handoff.md`) and tokens (`design/claude-design/tokens.json`), which
  carry the day/night values.
- The engineering brief `docs/handoff/Diabetes_Companion_Claude_Code_Handoff.md`, read in full.

**What was added to the repository**

| File or folder | Contents |
|---|---|
| `design/claude-design/` | Boards, canvas.json, handoff.md, tokens.json and a README that marks them as reference only |
| `docs/handoff/` | The engineering brief |
| `docs/design-inventory.md` | 103 screens, each with its source state key, native route, interactions, states and dependencies |
| `docs/design-gaps.md` | 15 gaps and conflicts (G-01..G-15), native adaptations and missing assets |
| `docs/implementation-plan.md` | Structure, dependency candidates with versions checked against the registries, the Stage 2 plan, and environment blockers |
| `docs/integration-status.md` | Every integration, all **unconfigured** |
| `CLAUDE.md` | Rules and pointers for future sessions |

**Verification done in Stage 1**

- The design state keys cited in the inventory were checked against the board files with grep.
- Package versions were read from npm, from PyPI and from `expo@58.0.23` `bundledNativeModules.json`.
- No code was written and nothing was built, so there are no build or test results.

## Decisions from Guy (11 Nov 2026)

| # | Item | Decision |
|---|---|---|
| 1 | G-01 Apple Health / Health Connect | Approved: a row in Devices (SET-04) opening the existing device-detail layout |
| 2 | G-02 Minor / guardian | Approved: remove ONB-02 from the flow; under 18 sees a stop screen only |
| 3 | G-03 / G-04 Empty and unavailable states | Approved: proposals in design-gaps |
| 4 | G-07 Treatment defaults | Approved: no defaults; ratios and target band shown only after the user enters them |
| 5 | Native builds | **EAS Build** with an Expo account owned by Guy. Guy must sign in (`eas login`) and connect Apple / Google credentials himself; Claude never handles those passwords. Simulator builds do not need an Apple account; device builds and the HealthKit entitlement do. |
| 6 | Git | 11 Nov 2026: main repository `fisha/diabetic` with `fisha/diabetic-app` (`apps/mobile`), `fisha/diabetic-web` (`apps/web`) and `fisha/diabetic-api` (`services/api`) as submodules, SSH remotes. Shared packages and docs stay in the main repository. |

| 8 | AI provider | Guy will provide an OpenAI API key for the companion conversation (Stage 5). It goes only into `services/api/.env` on the Mac, never into the app, the repository or chat. |
| 7 | Stage 3 accounts and database | **Local only on the Mac**: FastAPI and Postgres in Docker, no cloud provider for now (decision card, 11 Nov 2026). |

Still open (non-blocking for 2.1–2.4): G-08 translations, G-12 web sign-in, G-13 System theme option, G-05 clinical copy, G-06 thresholds, G-10 voice catalog.

## Stages 4 to 6 record (11 Nov 2026)

Decisions taken without asking, as Guy instructed, and recorded in `docs/design-gaps.md` (G-12, G-23 to G-28):
OpenAI vision for meal photos, USDA FoodData Central for food search, one voice for every companion, the web
dashboard session kept in memory only, and the health store screen built on the device detail board.

| Slice | What works | Verified |
|---|---|---|
| Records | Insulin, activity, notes and meals saved with revisions; journal delete, hide and corrections | API tests, `records.cjs` (16 steps) |
| Conversation | Text companion through the server (OpenAI behind a provider interface), proposed records confirmed by the person, dose safety check | API tests, `conversation.cjs` with a rule-based stand-in |
| Follow-ups and memory | Durable worker, routine screen, memories, local notifications; push token per account | API tests, `followups.cjs` |
| Meals | Photo upload and analysis with real progress, description parsing, dictation, USDA search, photo keeping | API tests, `meal.cjs` |
| Voice | Recorded turn, transcription, spoken reply, orb states, mute and stop | API tests, `voice.cjs` with a fake microphone |
| Insights | Day-part patterns from the person's readings and range, summary, feedback; profile synced with the server | API tests, unit tests, `insights.cjs` |
| Account | PDF and CSV export, account deletion, privacy choices saved to the server | API tests, `account.cjs` |
| Web dashboard | Sign-in, overview, timeline, insights, settings, export, in English and Hebrew right to left | `web.cjs` |
| Apple Health / Health Connect | Read-only blood glucose: permission, 30 days back, new readings when the app opens, keep or remove on disconnect | API tests, unit tests for sensor detection, iOS and Android bundles build; the web shows "Not available" (`account.cjs`) |
| Membership | "Not set up yet" from `GET /membership`; nothing charged | API test |

**Checks run on 11 Nov 2026 (container):** `pnpm check` passes (typecheck, lint, 37 mobile unit tests and the
package tests). `uv run pytest`: 86 pass. `expo export` for iOS, Android and web passes. Every browser e2e flow
passes: stage3, records, conversation, followups, meal, voice, insights, account, web.

**Known limits:**
- The database pool (5 plus 10 overflow) times out under about 300 simultaneous requests. Fine for one person on a
  Mac; size it when hosting is decided.
- Health readings removed on disconnect don't return when connecting again (their store ids are kept).
- Native code (HealthKit, Health Connect, Keychain, notifications, microphone, camera) has not run on a device:
  that needs an EAS dev build.

## Stage 3 record

### 3.1 to 3.8 First real end-to-end data flow (done, verified in the container)

API (`services/api`, repository `fisha/diabetic-api`):

- FastAPI 0.162.4, SQLAlchemy 2.1.8, Alembic 1.20.1, psycopg 3.3.8, Python ≥3.12 with uv. PostgreSQL 16 through
  `docker-compose.yml` (bound to 127.0.0.1), plus a `steady_test` database; tests refuse any other database.
- Accounts: email and password (argon2id, at least 10 characters as on the design), 15-minute access JWT, rotating
  refresh tokens stored as SHA-256 hashes. Reusing a rotated refresh token revokes its whole family. Wrong password
  and unknown email answer the same way.
- Profile: `PUT /profile` stores the onboarding answers (validated, unknown keys refused) with locale, diabetes type
  and glucose unit as columns. Needs service consent and the adult age check. Consent changes are append-only.
- Glucose: `measured_at`, `entered_at`, `received_at`, source (manual / voice), method (meter / sensor), the value
  and unit as entered plus mg/dL (factor 18.016), revision number and a revision table, idempotency key unique per
  account. A retry returns the stored record (200); the same key with different content is 409. Another account's
  record is 404. Range check 20–600 mg/dL mirrors the app's unreviewed config (G-06); readings more than 10 minutes
  in the future are refused; times without an offset are refused.
- 21 pytest tests, ruff clean.

Shared: `packages/contracts` holds the OpenAPI schema and TypeScript types generated from it
(`pnpm --filter @steady/contracts generate`).

App (`apps/mobile`, repository `fisha/diabetic-app`):

- `src/api/client.ts` (base URL from `EXPO_PUBLIC_API_URL`; without it every screen keeps its G-04 state),
  `src/api/session.ts` (refresh token in the protected store, access token in memory, one refresh at a time, a
  refused refresh opens AUTH-05 with the email filled in).
- Sign-up opens setup at consent; sign-in opens Companion, or Resume when no profile is saved. New G-22 messages for
  wrong credentials, email taken, offline and server error, in 4 languages (translation review pending).
- "Meet your companion" (ONB-21) saves the profile, then opens Companion.
- Glucose sheet: the reading is written to the offline queue (protected store) first, then sent with its key.
  "Saved to your journal" only after the server confirms; "Waiting to sync" while it can't be reached; the queue
  retries every 30 s, on app foreground and on sign-in, with the same key. Refused readings are kept as "failed".
  Queue items belong to the account that made them.
- Journal: today and yesterday from the server, plus queued readings with "Pending sync" / failed badges. Entry
  detail with correction history; correction (JRN-06) saves a new revision.
- Overview: the latest reading and the day's meter readings from the server. Time in range, summaries and insights
  stay empty (they need sensor data and Stage 5).
- Fixed: a successful save no longer triggers the sheet's "Discard this entry?" check.

Verification on 11 Nov 2026 (container, PostgreSQL 16.15, Python 3.13, Chromium):

- `pnpm check` passes (52 tests), API `pytest` 21 passed, `expo export` for iOS, Android and web succeeds.
- `tools/e2e/stage3.cjs` against the real API and database: 16 of 16 checks passed. Sign-up opens setup; duplicate
  email and wrong password show their messages; sign-in opens Companion; a reading is saved, appears in Journal and
  Overview; a correction makes revision 2 with the original in the history; with the API blocked the reading shows
  "Waiting to sync" and "Pending sync", then syncs once (the server holds exactly 2 readings); a second account gets
  404 for the first account's record and sees an empty journal.

Not verified yet: a native build on a device or Simulator (survival across an app restart uses the protected store,
which only the native build has; the web preview keeps the session in memory and signs out on reload), and the
whole onboarding walked through the screens to the profile save (the e2e run saved the profile through the API).

## Stage 2 record

### 2.1 Monorepo and Expo app (done)

- pnpm 10 workspace (`apps/*`, `packages/*`) with `nodeLinker: hoisted` in `pnpm-workspace.yaml`. A `.npmrc` cannot
  be written through Claude's remote tools, so the setting lives in the workspace file.
- `apps/mobile`: Expo SDK 58 (`blank-typescript@sdk-58` template), expo-router with routes in `src/app`, typed routes,
  React Compiler, `userInterfaceStyle: automatic`. `app.config.ts` takes `APP_DISPLAY_NAME` and `APP_BUNDLE_ID` from
  the environment (defaults "Steady" and `com.example.steady.dev`, to be replaced by Guy's identifiers).
- Native modules installed with `npx expo install` at the SDK 58 versions (router, screens, safe area, reanimated,
  worklets, gesture handler, svg, localization, font, haptics, system UI, dev client).
- ESLint 9 with `eslint-config-expo` 58.0.4. ESLint 10 was tried first and fails: `eslint-plugin-react` 7.37.5 only
  supports ESLint up to 9.
- `eas.json` profiles: `development-simulator`, `development`, `preview`. No build has been run on EAS yet.
- Runtime import guard (`pnpm guard`) plus an ESLint `no-restricted-imports` rule for `design/` and `tests/fixtures/`.

### 2.2 Tokens and day/night (done)

- `packages/tokens`: `scripts/generate.mjs` turns `design/claude-design/tokens.json` into
  `src/generated/tokens.ts` (React Native) and `src/generated/tokens.css` (web, `data-theme` plus
  `prefers-color-scheme`). `--check` fails when the committed output is stale. The canvas annotation colours
  (`color.label.*`) are not generated.
- `apps/mobile/src/theme`: `ThemeProvider` with the preference System / Day / Night (default System, following the
  design note "Follows your phone's setting by default"), the resolved palette, the system reduce-motion flag, and the
  expo-router navigation theme. A forced Day or Night also sets `Appearance.setColorScheme` so native pickers and the
  keyboard match. The preference lasts for the session until the settings store exists (2.8).
- Contrast check `pnpm --filter @steady/tokens contrast`: 48 pairs. **5 pairs in the design fall below the
  handoff's thresholds**; they are recorded as G-16 with proposed colours, and the tokens stay as designed until Guy
  decides.

### 2.3 Translations and RTL (done)

- `packages/i18n`: the catalog in `messages/{en,he,ar,ru}.json` plus `meta.json` (source board, review tags, translator
  notes). It is ICU MessageFormat, formatted with `intl-messageformat` 12.1.5.
- `scripts/import-design.mjs` imported the four-language tables of the Onboarding, Companion and Website boards and the
  33 ICU strings of board 13. That gives **420 ids** in every language. From now on the catalog is the source of truth.
- **Excluded from the catalog (28 strings), because they are design-only:** sample companion and user speech, sample
  conversation history, the sample reminder text and device name, canvas annotations ("Demo data", "Voice names are
  catalog placeholders"), the mock iOS notification dialog, and `onb.minor.body` (superseded by G-02). In production the
  companion's words come from the conversation service.
- **Rewritten with ICU arguments (6 strings), because they were drawn with sample values:** `com.stale_b`,
  `ovr.reading.stale`, `ovr.insight.recurring`, `rtn.day`, `com.type_ph` (companion name) and `com.notif_from`.
- Every id is tagged `translation` review (G-08). Board 13's clinical strings are also tagged `clinical`, and
  `needsClinicalReview(id)` gates them (G-05).
- Helpers: `matchLocale` (device languages, including legacy `iw`), `direction` / `isRTL`, and Unicode isolates for
  values with units and times (`valueWithUnit`, `isolateLtr`, `isolateAuto`).
- Mobile `src/i18n`:
  - `I18nProvider` and `useI18n`. They use the device language by default and fall back to English.
  - RTL bootstrap through `I18nManager`, with a `restartRequired` flag. React Native applies a direction change only
    after a reload, so the language screen will warn first, as the design notes describe.
  - Intl polyfills (`@formatjs/intl-pluralrules`, `intl-locale`, `intl-getcanonicallocales`) are loaded only when the
    engine lacks them, with CLDR data for the 4 languages.
  - `expo-localization` plugin: `supportsRTL`, plus `supportedLocales` so that iOS per-app language settings list the
    4 languages.
- **Not yet in the catalog:** the strings of the English-only boards (Journal, Meal, Overview, Routine, Settings,
  Subscription, Web dashboard). Each one is added, with HE, AR and RU drafts tagged for review, in the step that
  builds its screen (2.5 to 2.9). The catalog test fails if any language is missing an id.

**2.3 verification**

| Check | Result |
|---|---|
| i18n tests | 12 of 12 pass. They check identical ids in 4 languages, valid ICU, the same arguments per language, CLDR plural categories, no sample names or readings, review tags, the translator fallback, plural output in he/ar/ru, the Hebrew gender select, and isolates. |
| Plural formatting with `Intl.PluralRules` removed (simulating Hermes) and the polyfill loaded | correct ar/ru/he/en forms |
| `expo export` iOS and Android | pass, 3.1 MB Hermes bundles. The catalog is in the bundle; the excluded sample text is not. |
| `pnpm check` | pass |

Not verified: behaviour on a device (Hermes Intl, RTL reload). That needs an EAS build.

### 2.4 Primitives and component preview (done)

**Components in `apps/mobile/src/components`** (from board 12)
- Actions: `Button` (primary, secondary, tertiary, destructive, regular 52 / large 56, pressed, disabled, loading),
  `IconButton` (44 pt target, plain / filled / toggled) and `PressScale` (120 ms press motion, off with reduced
  motion).
- Choice: `Chip` / `ChipGroup` (a selected chip shows a border, a fill and a check, so the state is not carried by
  colour alone), `Segmented` and `ToggleRow` (helper text, plus a locked state for the required consent).
- Inputs: `NumericField`, `TextField` and `TimeField`.
  - `NumericField` keeps the unit inside the field and stays left to right in RTL. It has an "I don't know" (Not set)
    state, a read-only state and an error state; the error is shown as text and announced.
  - `TimeField` uses the platform picker, with 12 or 24 h following the locale.
- Containers: `Card` (flat, pressable, selected, stale), `Banner` (info / warning / error), `Dialog`,
  `Toast` / `ToastProvider` (4 s, or 8 s with an action, announced) and `ListRow` / `ListGroup` (the chevron flips in
  RTL).
- Data:
  - `ProvenanceBadge`: 11 kinds, kept separate as board 12.4 requires.
  - `LatestReading`: value, unit, age in words, source, stale state and a no-reading state.
  - `GlucoseGraph`:
    - Time runs left to right in every language. There is no band without the user's own range (G-07).
    - Sensor line breaks at gaps, with manual dots, event chips and a now line.
    - Empty copy comes from the design's `chartEmpty`. Screen readers get a one-sentence summary.
  - `TimeInRangeBar`: shows a "not enough data" hatch when there is no data.
  - `LifecycleTimeline`.
- Companion: `VoiceOrb` with all 8 states, using the board's sizes, keyframes and CSS filters. The state text is
  always visible and the orb is static under reduced motion. `MessageBubble` has sending and failed states.
- Navigation: the 4-tab `TabBar` (G-14), `Header` (large or inline, with back) and `ProgressSteps` ("Step 6 of 20").
- Loading: `Skeleton` (static under reduced motion, hidden from screen readers) and `EmptyState`.
- 23 new catalog ids (`cmp.*`). Each has HE, AR and RU drafts tagged for review. "Unsure" uses an impersonal form in
  Hebrew and Arabic.
- Icons: 45 icons copied from the board SVGs, plus a `minus` icon for the stepper.

**Decisions taken in this step (reversible)**
- G-17: destructive buttons use `dangerBg` / `dangerText` from tokens. Disabled buttons use the neutral fill.
- Sheets will use expo-router's native `formSheet` presentation, which the design handoff allows, instead of
  `@gorhom/bottom-sheet`. That avoids an extra dependency whose Reanimated 4.7 compatibility is unverified. It is
  built in 2.6.

**Component preview (development only)**
- Route `/dev/components?theme=day|night&locale=en|he|ar|ru&scale=1|1.6|2`. It nests its own theme, language and
  text-scale providers, so it does not change app settings.
- Specimen values (a synthetic curve and similar) are in `src/dev/specimens.ts` and labelled as such.
- **Production builds do not contain the preview.** The route requires it lazily behind
  `__DEV__ || EXPO_PUBLIC_APP_VARIANT === 'preview'`, which is inlined at build time.
  - Checked: the iOS production bundle is 3.1 MB and contains no preview strings; with the preview it was 4.4 MB.
  - The preview web build does contain it.
- Import guard extended: code outside `src/dev` and `src/app/dev` may not import `@/dev/*` (tested with a deliberate
  violation, which failed as expected).

**2.4 verification**

| Check | Result |
|---|---|
| `pnpm check` | pass (guard, typecheck, lint, 19 tests, contrast 50 pairs) |
| `expo export` iOS + Android | pass |
| Preview rendered on the web (react-native-web, Playwright 390 px) | day/night × en/he/ar/ru and text at 100 / 160 / 200 %: no page errors |
| Found and fixed from the screenshots | the unit overflowed the numeric field; the unit was on the wrong side in RTL; shared SVG gradient ids (muted and unavailable orbs were not grey); orb filters now match the board |

Not verified: native rendering on iOS and Android (needs an EAS build). On the web the Switch thumb draws in the wrong
place in RTL, which is a react-native-web limitation; the native switch has to be checked on a device.

### 2.5 Account and onboarding screens (done)

**Screens**
- Account: `app/(auth)/` holds welcome, sign-up, sign-in, recover, session-expired and resume (AUTH-01..06).
- Onboarding: one route, `app/onboarding/[step]`, with a screen per step (ONB-01..21). Each step is its own native
  stack screen, so the system back gesture works.
- Order, skip rules, the progress bar (21 positions), "pens skip the pump step" and "from Review, Continue returns to
  Review" follow the board's logic (`features/onboarding/flow.ts`).
- `app/index.tsx` now opens Welcome. With no account service, nobody is signed in.

**What works without services**
- Every step validates locally: the board's email check, the 10-character password, the required consent, and a
  real past date of birth.
- Under 18 stops at the adults-only screen (G-02). The guardian card and "notify me" are left out. Only the result of
  the age check is kept; the date is cleared.
- Answers are kept as a draft on the device ("Setup saves as you go"). The draft is stored in `storage/protectedStore`:
  - It is sealed with XChaCha20-Poly1305 (`@noble/ciphers` 2.4.0).
  - The key is in the Keychain / Keystore via expo-secure-store (this device only, while unlocked).
  - Writes go to a temp file first, then replace the old one. A tampered file is discarded.
  - Email and password are never stored.
- In the web preview the draft lives in memory only, and the last screen says so.
- The language choice is saved as a plain preference (it is not health data) and applied on the next launch. On
  native, a change of direction offers "Restart now" (`reloadAppAsync`), which is the approved RTL adaptation.
- Notifications (ONB-19) use the real system prompt through expo-notifications, replacing the board's mock dialog.
  Allowed, denied and "Open system Settings" are handled. No push token is requested yet.

**Shown as unavailable (G-04, "Not available in this build")**
- Create account, sign in, reset link, Apple and Google: no auth provider is chosen, and nothing is sent.
- The privacy summary link: the website comes in 2.9.
- Voice previews (G-10): the conversation language choice stays.
- "Meet your companion": saving the profile needs the profile API.
- Session expired and Resume open only from the auth layer. In development they can be opened from the dev screen
  list `/dev/screens`, which is removed from production like the component preview.

**Decisions taken in this step (reversible)**
- Time and date answers (meals, sleep, quiet hours, ratio dates) start as "Not set". The board's example times are
  not saved as anyone's answers. The design's preselected choices (units mg/dL, type 1, avatar, companion name
  "Noa", style, check-in frequency) are kept as defaults.
- Target range is a text field, as on the board, since a range needs a dash. It is stored as typed.
- Session expired: the board pre-fills the account email, but it is typed until the auth layer can supply it.
- The Apple mark follows the text colour, because the board's #111 disappears on the night button.
- New strings (8): `cmp.unavailable`, `cmp.rtl.*` and `onb.unavail_*` / `onb.vo_unavail`. HE, AR and RU are drafts,
  tagged for review.
- Board 14 calls ONB-02 "Who is setting up". The Onboarding board has no such screen; that step is "What your
  companion does" (can / can't, emergency note). It is kept, because it carries the safety limits. See G-02.

**2.5 verification**

| Check | Result |
|---|---|
| `pnpm check` | pass: guard, typecheck, lint, 32 tests (19 + 13 new for flow rules, age check, consent, sealed-store round trip, tamper and wrong-key rejection), contrast |
| `expo export` iOS + Android | pass. The production bundle has no dev screen list or preview. |
| Web preview (Playwright 390 px) | all 27 screens rendered, 42 shots spread over day/night and en/he/ar/ru (not every screen in every combination): no page errors |
| Fixed from the screenshots | RTL rows on the web (now follows the document direction), language rows in their own direction, avatar grid columns, review values wrapping |

Not verified:
- Keychain/Keystore storage, the notification prompt, the restart after a direction change and the date and time
  pickers. These need a device build (EAS).
- Native layout in general.

### 2.6 Tabs, Companion and log sheets (done)

**Screens**
- `app/(tabs)/` holds the four tabs (Companion, Overview, Journal, Profile) with the board's tab bar (G-14).
  Overview, Journal and Profile show only their large title until 2.7 and 2.8.
- Companion (`app/(tabs)/companion.tsx`, COM-01/02): header with the companion's name from the profile draft,
  history and voice/text toggle, the orb, the quick log chips, voice controls in voice mode and the composer in text
  mode.
- Sheets are routes in `app/(sheets)/` shown as native form sheets (90% height, grabber): Quick log `/log`, glucose
  `/log/glucose`, insulin `/log/insulin`, activity `/log/activity`, note `/log/note`, reminder `/reminder/new` and
  conversation history `/history`.
- A sheet with typed input asks "Discard this entry?" before it closes, whether closed by X, Cancel, swipe or back
  (`usePreventRemove`).

**What works without services**
- Glucose: number check, mg/dL and mmol/L switch that converts what was typed, time and "measured with". Out of range
  and empty show the board's errors.
- Insulin: amount check (positive, up to the typo limit), the person's insulins from onboarding as chips (none are
  invented when the draft has none), optional reason, time. The note "Steady doesn't recommend doses" is shown.
- Activity (board defaults walk, 30 min, moderate), note with symptoms (Unwell shows the care-team hint), reminder
  presets or a picked time ("Pick a time" schedules the next occurrence; tested).
- The limits (20 to 600 mg/dL, low below 70, insulin up to 100 units) are in `src/clinical/config.ts`, marked as not
  clinically reviewed (G-06).

**Shown as unavailable (G-04)**
- Voice: the orb shows "Not available in this build" with "Talking needs the voice provider…", Talk and Mute are
  disabled, "Continue in text" works.
- Text: Send reports that replies need the language model and that the message was not sent. The text stays in the
  composer. There is no greeting, because the board's greeting was demo text.
- Save on every sheet: "Saving records needs the server…"; the entry stays in the form. Reminders: "…nothing was
  scheduled."
- Meal chip and the two meal tiles: a short note that meal logging arrives with the Meal screens (2.7).
- The context card (latest reading) is hidden while there are no readings (G-03). History shows "Nothing here yet".
- Low panel (COM-06): its wording is not clinically reviewed (G-05), so it appears only in development and preview
  builds, tagged "Clinical review". A production build shows no low guidance yet.

**Reachability:** "Meet your companion" still ends at the profile-save notice, so the tabs open only from the dev
screen list until the account and profile services exist (Stage 3).

**Not reached yet:** microphone denied, offline, stale reading, opened from a check-in, extracted-input confirmation
(COM-04). Each needs a service that is not there.

**New strings (2):** `com.unavail_voice`, `com.unavail_meal` (HE, AR, RU drafts tagged for review).

**2.6 verification**

| Check | Result |
|---|---|
| `pnpm check` | pass: guard, typecheck, lint, 39 tests (7 new: glucose parsing, conversion, range and low checks, insulin check, reminder time), contrast |
| `expo export` iOS + Android | pass (Hermes, about 5 MB each). The dev screen list is not in the production bundle. |
| Web preview (Playwright 390 px) | 18 shots of the Companion and every sheet across day/night and en/he/ar/ru, including the error, low, unavailable and discard states: no page errors. Discard returns to Companion; an untouched sheet closes directly. |

Not verified: native form sheets, swipe-to-dismiss with the discard check, keyboard handling of the composer and the
time pickers. On the web, sheets render as full pages. These need a device build (EAS).

### 2.7 Overview, Journal and Meal (done)

**Overview (OVR-01..06)** `app/(tabs)/overview.tsx`, `features/overview/`
- Runtime: the no-readings card with "Log a reading", period tabs (day, week, 2 weeks, month), day navigation and an
  empty day card. Readings, insights and summaries come from services that do not exist yet (G-03), so
  `useOverviewData` returns the empty shape and never examples.
- Built and shown in preview: latest reading (sensor, manual-only, stale), day graph with two-hour tap slots and a
  readout, gaps, event markers, multi-day time-in-range bars, insights list, insight detail (OVR-04) and the daily
  and weekly summary (OVR-05/06). Insight feedback and mute end in the G-04 note.
- The target range is not set (G-07), so no range band is drawn and no reading is called in or out of range at
  runtime. Time in range needs at least 70% coverage and a reading counts as stale after 15 minutes; both are in
  `src/clinical/config.ts` as unreviewed defaults (G-06).
- Dates and times use `Intl` in the chosen language (`src/i18n/format.ts`).

**Journal (JRN-01..07)** `app/(tabs)/journal.tsx`, `features/journal/`
- Runtime: filter chips and the empty state. Export shows "Not available in this build".
- Built and shown in preview: day groups, offline pending, sync failed, entry detail with provenance, lifecycle,
  history, possible duplicate, meter vs sensor note, edit with reason, delete. Delete, merge, hide and save end in
  "Saving changes needs the server…".

**Meal (MEAL-01..10)** `app/meal/` (full-screen modal), `features/meal/`
- Entry points: the Meal chip in Companion and the "Meal photo" and "Meal" tiles in Quick log (the 2.6 placeholder
  note is gone).
- Real: camera permission (asked once per visit; a refusal shows MEAL-01b with Open Settings), the camera with flash
  and capture (`expo-camera`), the photo picker (`expo-image-picker`), and manual entry: add your own food, typed
  carbs, amount stepper, unit chips, "I weighed it", how much was eaten, total as an estimate, eaten-at time. The
  arithmetic is in `features/meal/model.ts` and tested.
- Shown as unavailable (G-04): "Use this photo" (the photo is not sent or saved), Find foods from a description,
  Dictate, food search (you can still add the typed name as your own food) and Save meal. Nothing leaves the phone
  and the flow state is in memory only.
- Built and shown in preview: analyzing, no food found, service down, blurry photo, review with the board's four
  photo scenarios, the description result, clarifying questions, search results, editing a saved meal and the saved
  screen. Recent meals are hidden until the meals API returns some.

**Dev previews:** `/dev/states?s=<id>` (development and preview builds only; the production bundle contains none of
the fixtures). Ids: overview-sensor, overview-manual, overview-stale, overview-week, insight, summary,
journal-normal, journal-pending, journal-failed, journal-detail, journal-edit, meal-denied, meal-preview,
meal-blurry, meal-analyzing, meal-nofood, meal-down, meal-review-(multipleFoods, mixedDish, lowConfidence,
missingNutrition, text, recent), meal-search, meal-edit, meal-saved.

**Strings:** 76 `ovr.*`, 64 `jrn.*` and 106 `meal.*` ids (HE, AR, RU drafts tagged for review, G-08).
`com.unavail_meal` was removed. Carb amounts with a translated unit ("גרם") follow the language's direction; other
numbers stay left to right.

**Dependencies added:** `expo-camera ~58.0.14`, `expo-image-picker ~58.0.10` with their config plugins (camera
without microphone; photo library text). **Run `pnpm install` on the Mac before the next start.**

**2.7 verification**

| Check | Result |
|---|---|
| `pnpm check` | pass: guard, typecheck, lint, 49 tests (mobile 30; new: period windows, slot readout, journal grouping, meal carbs, totals, stepping, units, fractions), contrast |
| `expo export` iOS + Android | pass (Hermes, about 5 MB each). Searched the bundles for fixture text: none. |
| Web preview (Playwright 390 px) | shots of Overview, Journal and Meal (21 for Meal) across day/night and en/he/ar, including the runtime unavailable paths (search, save, describe): no page errors. |

Not verified: the real camera, the photo picker and its permission prompt, the fullscreen modal and the food search
sheet on a device. On the web the camera shows the denied state because the browser has no camera. These need an
EAS build.

### 2.8 Settings, Routine and Membership (done)

**Settings (SET-01..14)** `app/(tabs)/profile.tsx`, `app/settings/*`, `features/settings/`
- Profile hub with an account card ("Not signed in", accounts are not connected) and the Health, Companion, App and
  Account groups. Sign out shows "Not available in this build".
- Diabetes profile and treatment settings read the protected onboarding draft. Edit reopens the matching onboarding
  step (`?from=review`); "Still current" stamps the date. Nothing is filled in by default (G-07).
- Devices: Apple Health / Health Connect row (G-01) plus the sensor and pump from onboarding. The device detail goes
  from "Not connected" to the explanation and then the G-04 note; the other device states are previews.
- Work locally: companion look, name and style (saved to the draft), app language with the RTL reload banner and
  a direction preview, conversation language, Day/Night, text size (scales all text), reduce motion (combined with
  the system setting), captions, haptics, digit-by-digit, voice speed, notification kinds, photo retention and the
  training consent. Preferences are non-health choices in generic storage; health answers stay in the protected draft.
- Notifications show the real system permission (ask, or open system Settings) and disable the kinds when it is off.
- Export, delete, support, contact, privacy policy and vendor connect end in "Not available in this build" notes.
  The delete form's DELETE check works; nothing is deleted.
- Increase contrast is shown disabled: there is no high-contrast palette yet (G-19).

**Routine (RTN-01..06)** `app/routine/index.tsx`, `features/routine/`
- Three tabs. What was learned, suggested check-ins, upcoming and earlier check-ins and memories come from services
  that do not exist yet, so each list is empty and says so. Frequency and quiet hours edit the onboarding answers;
  "Remember things" is a preference; Pause check-ins explains that check-ins are not running yet.
- RTN-02 first-days summary is a component shown only in the preview. RTN-07 (lock-screen notification) is Stage 3.

**Membership (SUB-01..06)** `app/membership.tsx`, `features/membership/`
- Runtime state "Membership isn't set up yet": no trial, no billing, nothing charged. Join, restore, manage and
  cancel show "Memberships need billing, which isn't set up yet. Nothing was charged." Prices are not shown without
  a store, so the runtime plan card lists what is included only.
- The seven board states (trial active and ending, trial ended, payment failed, member, cancelled, expired) with
  placeholder prices are previews (`/dev/states?s=sub-<state>`).

**Strings:** 343 new ids in en, he, ar and ru (boards Settings, Routine, Subscription), marked for translation review;
safety texts (notification and emergency notes, FAQ medical answers) also for clinical review.

**Previews:** `/dev/states?s=` set-device-<state>, set-export-running/ready, set-delete-running/done,
rtn-routine/checkins/memory, rtn-famdone, rtn-summary, sub-<state>. The screens index lists every SET, RTN and SUB route.

**Checks (11 Nov 2026, Linux):** `pnpm check` passed (guard, typecheck, lint, 49 tests). Native export (iOS and
Android) passed and contains no preview text. Web export: 38 screenshots in day/night and all four languages with
no page errors.

### 2.9 Website and web dashboard (done)

**Web app** `apps/web` (Next.js 16.4.6 App Router, next-intl 4.14.10, React 19.3.0). Run with `pnpm web`.
- Uses the shared tokens (`@steady/tokens/tokens.css`, day and night, following the system setting) and the shared
  catalog (`@steady/i18n`; the `web` and `wd` namespaces are sent to the browser). Locale routing: `/en`, `/he`,
  `/ar`, `/ru` with `dir` set per language; `/` redirects by Accept-Language (`src/proxy.ts`).
- Fonts as on the boards: Inter, Rubik (Hebrew) and IBM Plex Sans Arabic from Google Fonts.

**Website (WEB-01..07)** `src/app/[locale]/page.tsx`
- Hero with language links, how it works, can / can't, the "Planned" note, membership, privacy, FAQ accordion,
  footer with the disclaimer. The phone illustration keeps the board's "Demo data" tag.
- Not yet possible, so not shown as working (G-20): store buttons are disabled with "isn't in the App Store or
  Google Play yet"; prices and the trial length are replaced by "aren't final yet" (preview builds,
  `NEXT_PUBLIC_APP_VARIANT=preview`, show the board's placeholder prices); the support email is left out until a
  domain exists.

**Dashboard (WD-01..05)** `src/app/[locale]/dashboard/*`
- Shell with navigation and a "Not signed in" card (web sign-in, G-12, is not connected). Overview and Timeline
  show their controls and an empty state; Insights is empty; Settings explains each choice; Export has the form and
  "Create export" ends in "Not available in this build". No records are read: there is no web API yet.

**Strings:** 114 new ids (boards Website, WebDashboard) in en, he, ar and ru; medical limits and the disclaimer are
marked for clinical review.

**Checks (11 Nov 2026, Linux):** `pnpm check` passed (guard, typecheck, lint and tests for all packages, now 52
tests including 3 web catalog tests). `next build` passed (26 static pages). Screenshots at 375, 768 and 1280 in
day/night and all four languages: no page errors and no horizontal overflow.

### 2.10 Design comparison (done)

Method: `tools/design-compare/` (see its README). 49 pairs over 33 screens, 390 × 844, day and night, en and he.
Board renders are in `design/reference-screens/`. App shots come from the web export of the preview variant.

Fixed in this step:

- English dates and times now follow the design: 24-hour clock and "Tue 10 Nov" (`intlLocale` in
  `apps/mobile/src/i18n/format.ts`, also used by `TimeField`). The US style ("01:05 PM", "Tue, Nov 10") is gone.
- New `outline` button variant (board `.btn-o`: card fill, ink label, line border). Used where the boards draw it:
  Cancel / Keep / Retake / Replace / Correct this meal, Useful / Not quite right / Open journal / Export, Privacy
  policy, Export your data, Quiet hours, Report a problem, Export my data first, Keep my account, Stay connected,
  Create another, Manage in App Store, the companion discard confirm. Tinted `secondary` stays where the boards use `.btn-s`.
- Onboarding review rows: quiet label, bold ink value (`ListRow summary`).
- Journal header: download icon instead of a globe, as on the board.

Remaining differences, accepted or recorded:

- Runtime screens show honest unavailable states where the boards show sample data (G-03, G-04, G-07, G-18 to G-20).
- Selected chips use the soft fill with a check (Components board) where some screen boards fill with the accent.
- Destructive confirm buttons use the soft danger colours; the boards' solid red `#B5371A` is not a token (G-21).
- Membership: no Terms / Privacy links until the documents exist; plan cards put the price on the title line.
- Settings language rows show the direction under the name; the companion "Look" row shows avatar art, not swatches.
- Web export only: no status-bar inset (screens sit about 54 px higher) and small web switches; native uses the
  platform Switch.

Checks: `pnpm check` passes (12 + 7 + 30 + 3 = 52 tests). `expo export` for iOS, Android and web succeeds.
Native screenshots on a Simulator or emulator are still not possible from Claude's shell.

### Verification run on 11 Nov 2026 (2.1 and 2.2) (Linux, Node 22.23.4)

| Check | Result |
|---|---|
| `pnpm check` (guard, typecheck, lint, test) | pass |
| `tsc --noEmit` in apps/mobile and packages/tokens | pass |
| `expo lint` | pass, 0 problems |
| Token tests (`node --test`) | 7 of 7 pass |
| `expo export --platform ios --platform android` | pass: Hermes bundles built for both platforms. The bundle contains the token colours and nothing from `design/`. |
| `expo-doctor` 1.21.6 | 18 of 20 pass. The 2 that failed need the Expo API and React Native Directory, which this environment's network blocks. Re-run on the Mac. |
| Same token checks re-run in the project folder on the device | pass |

Not run: no native build, simulator or device run yet. That needs EAS (Guy's `eas login`).

**Visual status:** nothing comparable to the design yet (only the token layer). **Functional status:** theme
switching works in code; it has not been seen on a device.

## Live voice fix (11 Nov 2026)

Guy's first real live conversation got no answer. The relay used the older Realtime API (`gpt-realtime`); Guy's
reference project (mixmaster-pro, Maya) uses GPT-Live (`gpt-live-1`). The relay now speaks GPT-Live's server WebSocket
(`session.start`, `session.input_audio.append`, transcript and audio deltas, client delegation answered by the text
companion with its tools), still holding each reply for the dose check. The web client now starts its audio inside the
tap (iOS Safari). Verified with stand-ins: 95 API tests and the voice browser e2e. Not yet verified against the real
API: run `uv run python scripts/live_probe.py` in `services/api` on the Mac.

## Guy's five points on the companion and CareLink (11 Nov 2026, evening)

- Voice greeting repeated: echo of the phone's speaker into its microphone (no echo cancellation in react-native-audio-api on
  iOS). The server now sends the model silence while the phone plays a reply, never re-sends audio, and splits replies
  only on pauses over 1.2 s. App loggers (`steady.*`) now print at INFO.
- Companion sees the data: `ai/context.py` adds onboarding facts (age, height, weight, treatment, pump, sensor) and a data
  snapshot to the text and live prompts.
- CareLink meals and insulin: MEAL and completed INSULIN markers import as records. Pump alerts and messages: fault ids
  mapped to English texts from paul1956/CareLink (MIT), shown on the CareLink screen and to the companion (G-31).
- Prompt: mentor role per Guy; timing and correct-use reminders without amounts allowed; doses still never (safety check
  only blocks sentences with an amount).
- Latest reading card above the talk button (Guy's request; G-30).
- ML: the brief's separate model-evaluation track (section 10) was not started; a separate thread now runs it.

## Companion evaluation track (started 11 Nov 2026)

The separate model-experiment track from brief section 10 had not been started; Guy asked about the missing "ML
layer" on 11 Nov 2026. It now lives in `evals/` (main repository), outside the app and the API, and never changes
production behaviour. See `evals/README.md` and `evals/FINDINGS.md`.

- 60 held-out and 8 dev cases in English, Hebrew, Arabic and Russian, run through the production prompt, data block
  and tools (fixture records only), with deterministic checks for tools, numbers, dose and judgement limits, unbacked
  claims and language.
- A candidate structured scope check (`evals/steady_evals/scope.py`): dose requests, someone else's readings, minors,
  other diabetes types, acute symptoms.
- Curated sources with dates, population tags, rights status and attribution (`evals/sources/sources.toml`); none
  cleared for reuse yet.
- Meal-photo carbohydrate error against weighed meals (`evals/steady_evals/food.py`); LogMeal and Passio adapters wait
  for their documentation and trial keys.
- First real runs (11 Nov 2026, on the Mac, Guy approved): gpt-5-mini 148/180, gpt-5 49/60 after regrading; see
  `evals/reports/report-2026-11-11.md`. 25 harness tests pass.
- MedGemma: Guy decided on 11 Nov 2026 to continue without it for now. LogMeal/Passio: not needed (Guy); the meal
  evaluation covers the production OpenAI adapter and waits for about 30 weighed meals from Guy.
- Findings F-1 to F-7 and the run results were handed to the build work as proposals.

## Guy's follow-ups the same evening (11 Nov 2026)

- Voice speed: replies were held until the whole answer was spoken; now each sentence is sent once its audio is in, into
  the same reply message. Log lines with timestamps: "live turn latency" and "live delegation answered in".
- Dose check widened (eval F-1): numbers in words, treatment changes without a number. recent_records in local time (F-4).
- Reading pill (G-30 revised), companion tab orb (G-33), insights range from pump limits (G-32, card open), CareLink pump
  alerts (G-31).
- The mobile typecheck had been failing since the CareLink page commit (one `string | undefined`); `pnpm -s check` hid the
  exit code. Fixed; always check the exit code.
- Overview week / 2 weeks / month: CareLink's API returns only the last 24 hours, so history builds up from the day of
  connection; days under 70% sensor coverage show no split by design.

## Spec audit gaps, follow-ups (11 Nov 2026)

- Failed push: tried again after 5 and 15 minutes, then left unsent (never shown as sent).
- Check-ins wait for the end of the person's quiet hours (onboarding `checkIns.quietFrom/quietTo`); reminders keep their time.
- Frequency (`onlyWhenIStart` 0, `fewTimesADay` 3, `moreAtFirst` 5 in the first 3 days) caps check-ins the app starts on
  its own (`followups.proactive_allowed`, used by data-driven suggestions, origin `app`).
- A check-in with a `topic` (glucose, meal, insulin, activity) is withdrawn when such a record arrives before it is due.
- Daily repeats keep the local clock across DST. Each follow-up can carry a `reason`, shown in the Journal as "Why".

## Spec audit gaps, privacy and safety (11 Nov 2026)

- Meal photos and exports are Fernet-encrypted on disk (`sealing.seal_file`); older plain files still read.
  Database rows are not encrypted per field: at rest they rely on disk encryption of the host (FileVault on the Mac).
  Field-level or managed-database encryption is a hosting decision for Guy's batch.
- Logs: the engine hides SQL parameters; `tests/test_logs.py` checks every log call only names kinds, types or timings.
- Push lock-screen text in the person's language (still generic).
- propose_glucose refuses a reading about someone else (eval F-2); the prompt uses the stored diabetes type (F-3); what
  the app should do for "other" / "not sure" is a decision for Guy.
- Cross-source sensor dedupe (CareLink vs health store), 3 min and 1 mg/dL. Journal "merge duplicate" still unavailable.

## Spec audit gaps, health store (11 Nov 2026)

- Deletions and corrections in Apple Health / Health Connect reach the account (G-35): sync batches carry the time
  window they cover, the server removes readings from that store missing in the window, keeps ones the person
  corrected, and never removes on an empty read. API test `test_window_removes_readings_deleted_in_the_store`, app
  test for the batch windows.
- The health device screen shows the newest reading time apart from the last sync, how many were removed, and a
  "Not updated since" banner after a day without a successful sync. Typechecked only; the screen needs an iPhone.

## Spec audit gaps, first days (11 Nov 2026)

- Familiarization (brief section 6, RTN-01, G-36): `GET /insights/familiarization` gives the day of about three,
  entries per day, first impressions of meal times and what is still unknown; the Routine tab shows them and the
  companion's instructions carry them. API test `test_familiarization_first_days`; web e2e `followups.cjs` checks the
  card (screenshot f04-first-days). The e2e's journal step now uses the reminder due in minutes, because one due "in 2
  hours" lands on tomorrow's journal page late in the evening.

## Spec audit gaps, structured memory (11 Nov 2026)

- Memories have a kind, fact or impression (G-37, migration `c3d4e5f6a7b8`; the Mac needs `uv run alembic upgrade
  head`). API test `test_impression_is_kept_apart_from_facts_until_the_person_confirms`; web e2e `followups.cjs`
  checks the "not confirmed" line (screenshot f03-memory).

## Release readiness (11 Nov 2026)

- `docs/release-readiness.md`: verdict (not ready for release; fit for Guy's own development use), coverage matrix
  over brief sections 7 to 10 with evidence and open items, build/run, environment variables, migrations.
- `services/api/.env.example` now lists every setting, including `STEADY_SEALING_KEY` and why to set it once.

## Guy's "insights are the key" request (11 Nov 2026, night)

- Routines from all sources (G-38): foods usually followed by high glucose or by glucose in range, late meals and
  the morning after, pump suspends / high alerts / leaving automatic mode by time of day, insulin before eating and
  times of day in range; each with fixed advice (carb count, care team). Meal patterns say before and after values.
- Estimated A1c (GMI) when 14+ days of sensor data cover 70 %.
- CareLink alerts are now kept in `device_events` at every import (CareLink shows only the last day); readings, meals
  and boluses were already kept, so the history grows past CareLink's window. Migration `97f70b09db11` also adds
  `health_samples` for the coming Apple Health types.
- The companion gets all findings and the A1c estimate. Tests: `test_findings.py`, `test_carelink.py`; web e2e
  `tools/e2e/findings.cjs` (screens r01-r03).

- All health store types (G-39): `health_samples` table, `POST/GET /health-data/samples`, iOS and Android readers,
  windowed sync, companion context (activity, heart rate incl. at insulin, sleep, weight). API tests
  `test_health_data.py` and the snapshot test; app unit test; iOS and Android bundles export. Device run pending.

- Lock-screen widget (G-40): `GET /insights/hours`, `features/widget` (texts per hour, App Group storage, refresh on
  opening), Swift target `targets/widget`. `expo prebuild` creates the widget target with the App Group entitlement;
  not built in Xcode or run on a phone (needs a new dev build). Tests: `test_hours_for_the_widget`, app unit test.
- 12 Nov 2026: CareLink 30-day history (`carelink.fetch_history`, `history_readings`, `_sync_history`, migration
  `a1b2c3d4e5f7` adds `device_links.last_history_at`), tests in `test_carelink.py`. Lock-screen Live Activity (G-41):
  `features/widget/live.ios.ts`, `targets/widget/HourActivity.swift`; `expo prebuild` passes with it; needs a new dev
  build. Push for reminders: the APNs key is attached to the EAS project (no code change needed).
- 12 Nov 2026 (Guy's reports): charts and insights were empty because Guy typed a single target value and his pump's
  high alert is off (CareLink sends highLimit 0), so no range existed. The range now falls back to CareLink's own
  time-in-range setting (`personalWebView` tirSettings, band source `carelink`, labelled as such). The website now
  uses the server's range (it used only a typed one) and shows routines, meal patterns and the A1c on Insights.
  Meals and insulin the pump recorded are labelled CareLink, not "entered by you".
- 12 Nov 2026 (Guy): the app Overview's summary card shows the time-in-range percent with below/above, for the
  selected period (day, week, 2 weeks, month), with period-correct titles. The Live Activity shows the latest
  reading and a three-hour part of the day with an icon (G-41 update; `span` on `/insights/hours`). Needs a new iOS
  build; Swift not compiled in the container.
- 12 Nov 2026 (Guy): today's time in range counts against the part of the day that has passed. Heart rate from the
  health store is shown beside glucose readings (Overview latest card, Journal), nearest sample within 10 minutes.
  Health workouts become journal activity entries (source apple_health / health_connect, no intensity), created on
  import and backfilled by migration `b2c3d4e5f6a9`; a workout deleted in the health app removes its unedited entry.
- 12 Nov 2026 (Guy): companion chat clears the composer on send; long dashes become hyphens; an occasional emoji in
  writing; with sensor readings in the last day the companion does not ask whether they checked. Insights gained
  activity findings (`activity_gap` after 7 quiet days, `activity_good` on 3+ of 14 days, with mean daily steps).
  Today's summary leaves out later parts of the day unless worth preparing for ("ahead of the evening"). Live
  Activity layout centred (needs a new iOS build).
- 12 Nov 2026 (Guy): follow-ups can be deleted (a daily one: this time or every day) and show "every day"; a
  12/24-hour clock choice under Language (default follows the language). Companion replies were slow: the model
  (`gpt-5-mini`) ran at its default medium reasoning effort; now `STEADY_OPENAI_REASONING_EFFORT` (default low). Context
  building measured at 160-300 ms with 30 days of CareLink data; the API logs context and model round durations.
- 12 Nov 2026 (Guy's spec, G-42; not deployed at his request): insights are kept on the server as topics with
  provenance, read state shared by the app and the website, periodic follow-up updates on fresh data (default every
  14 days), corrections, and insight pushes with quiet hours, a weekly cap (default 2), a digest and an off switch.
  Migration `c4d5e6f7a8b0`. API tests `test_tracking.py` (5 scenarios); app unit test `track.test.ts`; `pnpm check`
  passes. Not deployed to the Mac and not run on a phone; push delivery untested end to end.
- 12 Nov 2026 (Guy, G-43; not deployed): a daily progress check against the person's own range (day against the day
  before, week against week, fair windows only, safety gate on time below and low episodes), small-win messages in
  the app and on the website, a one-time confetti for week wins (setting to turn it off; respects reduced motion),
  pushes only for week wins under the G-42 policy, and an internal KPI with data coverage. Migration `d5e6f7a8b9c1`.
  API tests `test_progress.py` (7 scenarios); app unit test `progress.test.ts`; `pnpm check` passes. Not run on a
  phone or viewed in a browser.
- 12 Nov 2026 (Guy): view-only sharing with invite codes and an admin page with read-only "view as" (G-44,
  migration `e6f7a8b9c0d2`, `STEADY_ADMIN_EMAILS`); unofficial Dexcom Share and LibreLinkUp connections like CareLink
  (G-45, stand-in servers only); the app renamed to Stedio in everything people see (identifiers unchanged); an EAS
  `testers` profile (internal distribution, API https://stedio.ngrok.app). API 166 tests and `pnpm check` pass.
- 12 Nov 2026 (Guy, G-46): Google sign-in (website button, native sheet in the app), a waitlist approved from the
  Admin page with an approval email, and email verification codes (email sign-up closed until a mail sender is set).
  Migration `f7a8b9c0d1e3`. API 174 tests, `pnpm check` and a browser run of waitlist and approval pass. Google itself
  untested until the client ids exist.
- 12 Nov 2026 (Guy, G-55): the app itself is the website's personal area at `/app` (web export with base URL, side
  bar on wide screens, Google's own sign-in button, sign-in kept across reloads), the website's sign-in buttons open
  it. A session read race on screens opened by address fixed. G-56: a time of day usually in range no longer lists a
  first impression in the other direction. API 190 tests and `pnpm check` pass; checked in a browser at phone and
  desktop widths against the local API (Google sign-in itself not tried: needs Google's servers).
- 12 Nov 2026 (Guy, G-57): pump alerts and messages in the journal under an "Alerts" filter, named in the interface
  language (`GET /devices/events`). LibreLinkUp reads now follow a region redirect and keep the region (Itay's link
  read nothing from 19:34 UTC because reads went to the global host and the redirect counted as "no new readings"); a
  graph answer without graphData now fails instead of counting as a successful sync. API 193 tests, `pnpm check` pass;
  journal checked in a browser with stand-in alerts.
- 12 Nov 2026 (Guy, G-58): set and sensor changes from CareLink and LibreLinkUp in the journal, and three insights
  (usual set interval, set past its rated days, sensors ending early) gated on `kinds=3`; infusion set kind in Treatment
  settings. Device data inventory in docs/device-data-inventory.md. API 195 tests and `pnpm check` pass; not seen on
  real data yet.
- 12 Nov 2026 (Guy, G-59): pump status card in Devices > CareLink (active insulin, reservoir, battery, sensor time
  left, transmitter, SmartGuard, paused, out of range) and the pump's active insulin under the latest reading on the
  companion screen. API 196 tests and `pnpm check` pass; checked in the app's web build with the CareLink stand-in.
- 12 Nov 2026 (Guy, G-60): the pump's daily totals in Overview (insulin per day, time in SmartGuard, exits, sensor
  wear) from CareLink's 30-day history. API 197 tests, app tests and `pnpm check` pass; checked in the app's web build
  with stand-in days.

- 13 Nov 2026 (morning): Guy and Itay saw CareLink and Libre as signed out. Cause: the API on the Mac stopped with
  the Mac thread's session at ~02:00 UTC (now started detached); the links stayed connected. The app showed the
  sign-in form whenever the first read of a link failed; now an unreachable server shows "status unknown", the
  server-unreachable note and a try-again button, never the form. `pnpm check` passes; checked in the web build with
  the API answering 502.

- 13 Nov 2026 (Guy): the lock-screen card showed only "usually in range". It now shows the most useful insight for
  the time it appears (set past its days or sensors ending early, then recurring highs or lows, pump suspends, high
  alerts or SmartGuard exits in this part of the day, first impressions, the usual meal time, what goes well), titles
  only, and falls back to the part's usual line. Unit tested; not seen on the phone yet.

- 13 Nov 2026 (Guy: "Libre pulls only 24 hours"): LibreLinkUp's graph holds about 12 hours; the logbook (about two
  weeks of the readings the sensor logged, scans and alarms, not every 5 minutes) was read only on a link's first
  fetch, and Itay's first fetch read nothing (region bug). Now the logbook is read on the first fetch and then about
  daily (`last_history_at`). Continuous history further back needs LibreView (the main-account sign-in waiting on
  Guy). API tests pass.

- 13 Nov 2026 (Guy's batch):
  - Libre drops fixed reconnecting. A read refused in its body (status not 0), or a passing failure, set the link to
    "failed", and the app then showed the sign-in form, so the tester signed in again each time. Now a refused read
    signs in again on its own, at most twice an hour per link. The sign-in is renewed before the ticket's expiry.
    Failures are retried after 5, 10, 20, then 30 minutes; a lockout waits an hour. The app shows "connected,
    retrying" with an optional sign-in instead of the form. Logs record the answer's status and keys only.
  - Voice continuity. The server guessed when the phone finished playing from the audio length. The microphone could
    open while the phone still played, between sentences of one answer, or when audio arrived late. Echo or a late
    transcript then stopped the reply ("walkie-talkie", cut answers). Now the phone reports `played`, and the
    microphone stays closed while the model is still speaking the rest of the answer. Words placed in a closed
    stretch are ignored. `reply_end` carries `more`, so the orb stays on speaking through gaps. The Stop button still
    cuts at once. A per-turn timing line is logged (first audio, parts, audio length, play end, ignored words, cuts,
    phone underruns). A dropped connection resumes on its own up to twice, without a new greeting. The orb stays in
    place while the captions scroll under it.
  - Orb: on the home screen, a little hop, puff or tilt every 5-11 s. In conversation, soft smoke inside and a small
    face: the smoke drifts and swells with the voice while listening, swirls while thinking, and the mouth moves while
    speaking. Reduced motion keeps everything still.
  - API tests and `pnpm check` pass; the orb was checked in the web build. On a real iPhone still to check: echo with
    the speaker, noise, pauses, a network switch and the app in the background.
- 13 Nov 2026 (Guy, after testers build 3): three separate home screen widgets instead of one with an edit menu
  (he saw only one), the lock-screen widget no longer offered on the home screen, gallery names translated; Face ID
  lock in Privacy; Sign in with Apple (API `POST /auth/apple`, migration b2c3d4e5f6a0 `users.apple_sub`, setting
  `STEADY_APPLE_AUDIENCES`, default the bundle id). G-63. API tests (4 new) and `pnpm check` pass; needs a new build.
- 13 Nov 2026 (Guy, later): G-64, no live captions in a voice call, orb smile/wink/frown, audio jitter buffer, pump
  alert pushes chosen in Notifications (migration c3d4e5f6a7b1). API tests pass except the known-flaky ranker pipeline
  test (passes on rerun, also without these changes); `pnpm check` passes; orb faces checked in the web build.

## Next action

Guy, in one batch (the full list is in the thread): install Docker Desktop and uv on the Mac and start the API
(`services/api/README.md`); put the OpenAI and USDA keys in `services/api/.env`; create an Expo account and run
`eas login` and `eas init`; an Apple developer account and a test iPhone (and an Android phone for Health Connect)
for a dev build. Then: run every flow on the phone, clinical and translation reviews, and the open decisions
(billing, email provider, hosting, G-06, G-16, G-19).

### 14 Nov 2026: free waiting list, supported devices
- Website membership shows no prices: a "free during the waiting list" card with a join button to the dashboard sign-in
  (Google sign-in joins the waitlist). The app's membership screen has a `free` state with no prices, buy or restore.
- Website "planned" note replaced by the devices supported today (CareLink, Dexcom Share, LibreLinkUp, Tandem Source,
  Apple Health, Health Connect), read-only. FAQ answer 1 updated. All four languages.

### 14 Nov 2026: reminders, day names, alert thresholds, voice
- Reminder detail: Done / Snooze (15, 30, 60 min, tomorrow) / Cancel on the reminder itself; Done on a set-change
  reminder also records the set change. The time row is shown once.
- Day names for the last week also in small wins (app and website), website insights, routine, journal source, meals.
- Glucose alert thresholds step by 1 mg/dL (0.1 mmol/L), can be typed, and save after a pause (no jumps). The
  celebrate setting now describes companion unlocks only (small wins have no confetti).
- Live voice: loudspeaker in the default mode (louder); a watchdog wakes paused audio and counts a finished answer as
  played; interruptions and device route changes restart the session, audio and microphone.

19 Nov 2026 (Jira PM-287, thread "Delete by swiping across the app"): Guy had not noticed the swipe. SwipeRow takes a
`hint` key; the first deletable row of each list slides 44 px toward the delete action and back, 0.7 s after the list
appears, at most twice per list, and never again once the person has swiped any row (`swipeHints` and
`swipeLearned` in the phone's local preferences). Skipped under Reduce Motion and screen readers; RTL-mirrored.
App tests 213/213, typecheck clean, e2e `tools/e2e/swipe-delete.cjs` passes in en light, he light and he dark (hint
44 px out, back to 0, no hint after a swipe). Next: OTA, then Guy checks it on his iPhone.

- 20 Nov (PM-340): Duet one to one pass done on onboarding, auth, log forms, Overview, journal, routine, insights, Settings and the viewer home. Deliberate deviations listed for Guy (insight list z06, opener z05, quick-log More, insights filter, kids three tabs, treatment list, time row). WhatsApp open to every account with Meta in the privacy policy (PM-270). Not deployed: waiting for Guy on the simulator.

25 Nov 2026 (Jira PM-511, thread "Fix loud camera shutter vs quiet voice on Android"): an Android tester found the meal
camera's shutter deafening while the companion's voice was hard to hear. Meal photos skip the shutter sound on Android
(`takePictureAsync({ shutterSound })`; expo-camera plays it on the system stream), and on the direct WebRTC call the
companion's remote track gets gain 2 (about +6 dB) on Android, where call mode plays it on the softer call stream. iOS
and the relay path unchanged. App #302 (typecheck, lint, 30 tests pass). Next: OTA, then the tester tries it.
