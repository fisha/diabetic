# Progress

## Current stage

**Stages 3 to 6 built; waiting on Guy's accounts, keys and devices.** On 11 Nov 2026 Guy asked to build the whole app
without stopping and to ask for everything needed at the end ("תפתח את כל האפליקציה בלי לעצור… ובסוף… תבקש ממני את
כל מה שאתה צריך ממני"). Every slice below is built and verified in the container. None of it has run on Guy's Mac
or on a phone yet, and the outside providers (OpenAI, USDA, Expo push, Apple Health, Health Connect, billing) are
verified only against test stand-ins or not at all. See `docs/integration-status.md`.

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
