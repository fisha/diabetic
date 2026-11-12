# Progress

## Current stage

**Stages 3 to 6 built; waiting on Guy's accounts, keys and devices.** On 11 Nov 2026 Guy asked to build the whole app
without stopping and to ask for everything needed at the end ("תפתח את כל האפליקציה בלי לעצור… ובסוף… תבקש ממני את
כל מה שאתה צריך ממני"). Every slice below is built and verified in the container. None of it has run on Guy's Mac
or on a phone yet, and the outside providers (OpenAI, USDA, Expo push, Apple Health, Health Connect, billing) are
verified only against test stand-ins or not at all. See `docs/integration-status.md`.

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

## Next action

Guy, in one batch (the full list is in the thread): install Docker Desktop and uv on the Mac and start the API
(`services/api/README.md`); put the OpenAI and USDA keys in `services/api/.env`; create an Expo account and run
`eas login` and `eas init`; an Apple developer account and a test iPhone (and an Android phone for Health Connect)
for a dev build. Then: run every flow on the phone, clinical and translation reviews, and the open decisions
(billing, email provider, hosting, G-06, G-16, G-19).
