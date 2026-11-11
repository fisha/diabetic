# Implementation plan

The governing documents are:
- `docs/handoff/Diabetes_Companion_Claude_Code_Handoff.md` (the engineering brief)
- `design/claude-design/` (appearance and behaviour)
- `docs/design-gaps.md` (open decisions)

Stages follow brief §11. Each stage ends with evidence and waits for Guy's go-ahead.

## 1. Repository structure (chosen)

The folder was empty at Stage 1, so this monorepo layout is proposed:

```
diabetic/
  apps/
    mobile/            Expo + expo-router + TypeScript (iOS, Android)
    web/               Next.js App Router + TypeScript (website + dashboard)
  services/
    api/               Python 3.12+, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL
  packages/
    tokens/            tokens.json -> tokens.ts (RN) + tokens.css (web), day/night
    i18n/              ICU messages en/he/ar/ru, ids shared by app and web
    contracts/         TypeScript types generated from the FastAPI OpenAPI schema
    clinical-config/   reviewed thresholds and units (G-06); unreviewed values flagged
  design/
    claude-design/     design export copy (reference only, never imported at runtime)
  docs/                inventory, gaps, plan, progress, integration status, handoff
  tests/fixtures/      test-only fixtures (never bundled)
```

**Rules**
- A lint rule plus a CI check forbids importing `design/`, `tests/fixtures/` or `*.preview.*` from runtime code.
- Workspace manager: pnpm (JS). The Python service uses `uv`, falling back to `venv + pip` if `uv` is not
  installed on the Mac.

## 2. Dependencies (candidates, versions read from the npm and PyPI registries on 10 Nov 2026)

Versions are pinned when the project is scaffolded in Stage 2, using `npx expo install` so native modules match the
SDK.

**Mobile, Expo SDK 58.** These versions come from `expo@58.0.23` `bundledNativeModules.json`.

| Package | Version | Purpose |
|---|---|---|
| expo | 58.0.23 | SDK |
| react / react-native | 19.3.0 / 0.88.1 | runtime |
| expo-router | ~58.0.30 | navigation (route map in Main.dc.html) |
| expo-dev-client | ~58.0.18 | development builds (Expo Go is not the acceptance environment) |
| react-native-reanimated / react-native-worklets | 4.7.1 / 0.13.0 | orb, sheets, press motion |
| react-native-gesture-handler | ~3.3.0 | sheets, graph scrub |
| react-native-safe-area-context / react-native-screens | ~5.11.1 / ~4.30.1 | safe areas, native stacks |
| react-native-svg | 15.16.0 | icons, avatars, charts |
| react-native-keyboard-controller | 1.22.7 | keyboard avoidance in sheets |
| expo-audio | ~58.0.11 | microphone, playback |
| expo-camera / expo-image-picker / expo-image-manipulator | ~58.0.14 / ~58.0.10 / ~58.0.16 | meal photo |
| expo-notifications | ~58.1.8 | follow-ups |
| expo-secure-store | ~58.0.2 | tokens |
| expo-sqlite | ~58.0.15 | protected offline queue (combined with secure-store key; see §5) |
| expo-localization / expo-haptics / expo-linking / expo-constants / expo-system-ui | per SDK | |
| @react-native-community/datetimepicker | 9.2.1 | time and date fields |
| @gorhom/bottom-sheet | 5.2.14 | **not in the Expo bundle**. Peer `reanimated >=4.0.0-`; needs a compatibility check in Stage 2. If it fails, use expo-router `formSheet` presentation. |

**Shared JS**

| Package | Version |
|---|---|
| typescript | 7.0.2 (released 10 Nov 2026; fall back to the latest 6.x if tooling lags) |
| zod | 4.6.7 |
| i18next / react-i18next | 27.1.1 / 18.0.1 |
| intl-messageformat | 12.1.5 |
| @tanstack/react-query | 5.107.1 |
| zustand | 5.1.0 (local UI state only) |

**Web**

| Package | Version |
|---|---|
| next | 16.4.6 |
| next-intl | 4.14.10 |

**API (Python)**

| Package | Version |
|---|---|
| fastapi | 0.162.4 |
| uvicorn | 0.54.0 |
| pydantic | 2.14.3 |
| sqlalchemy | 2.1.8 |
| alembic | 1.20.1 |
| psycopg | 3.3.8 |

Durable jobs: `procrastinate` 3.10.0 (PostgreSQL-backed, so no extra broker) is the first candidate, to be
evaluated in Stage 5.

**Health integration candidates, evaluated in the Stage 2 spike and not yet chosen**

| Package | Version | License | Notes |
|---|---|---|---|
| @kingstinct/react-native-healthkit | 16.2.0 | MIT | Updated Oct 2026. Requires react-native-nitro-modules ≥0.35. |
| react-native-health | 1.19.0 | | Last updated Oct 2024. Maintenance risk, so not preferred. |
| react-native-health-connect | 4.1.3 | MIT | Updated Aug 2026 |
| expo-health-connect | 0.1.1 | MIT | Config plugin, early version |

**Not selected, because these are open decisions:** auth provider, billing (RevenueCat / StoreKit / Play Billing /
Stripe), food provider (LogMeal / Passio), voice and LLM provider, hosting.

## 3. Stage 2: native foundation and complete design implementation

Brief §11 says no live backend is implied. Actions that need a service show the unavailable state (G-04).
Populated states are visible only in a separate preview build that uses `tests/fixtures`.

| Step | Scope | Screens | Acceptance |
|---|---|---|---|
| 2.1 | Scaffold the monorepo, Expo app with dev client, ESLint and Prettier, a runtime-import guard, and CI scripts | none | `pnpm lint`, `pnpm typecheck` and `npx expo-doctor` pass |
| 2.2 | `packages/tokens` from tokens.json, with a day/night ThemeProvider and a System/Day/Night override (G-13) | none | Snapshot tests of the token output; contrast check script for text pairs (≥4.5:1) |
| 2.3 | `packages/i18n`: extract all strings from the boards; RTL bootstrap; number/unit isolation helper | none | Every board string has an id. HE, AR and RU drafts are tagged `translation-review`. |
| 2.4 | Primitives from Components.dc.html: Button, IconButton, Chip/Segmented, ToggleRow, NumericField, TextField, Stepper, Card, Badge, Banner, Toast, Dialog, Sheet, ListRow, TabBar, Header, ProgressSteps, EmptyState, Skeleton, VoiceOrb (8 states), Graph, TimeInRangeBar, LifecycleTimeline, Avatar and equipment glyphs | none | A preview screen shows each primitive in every state, day/night, LTR/RTL, at 100/160/200 %. Screen-reader labels are present. |
| 2.5 | Auth and onboarding | AUTH-01..06, ONB-01..21 | Navigation and local validation work. Auth submit shows the unavailable state. Drafts persist locally. |
| 2.6 | Tab shell, Companion and sheets | COM-01..14 | Orb states driven by a local state machine. Forms validate and convert units. Save shows "not connected" (no fake success). |
| 2.7 | Overview, Journal and Meal | OVR-01..06, JRN-01..07, MEAL-01..10 | The runtime shows empty states (G-03). Populated states appear only in the preview build. Camera and photo permission flows are real. Analysis is unavailable. |
| 2.8 | Routine, Settings and Membership | RTN-01..07, SET-01..14, SUB-01..06 | Permissions, language switch (RTL reload) and accessibility settings work locally. Billing actions are unavailable. |
| 2.9 | Web: website and dashboard shell | WEB-01..07, WD-01..05 | Responsive at 375 / 768 / 1280. Locale routing in 4 languages. The dashboard shows empty states. |
| 2.10 | Design comparison | all | Screenshots of each screen state against the design board at 390 × 844, day and night, en and he. Differences are listed in `docs/progress.md`. |
| 2.S | HealthKit feasibility spike, run in parallel | none | Dev build with the HealthKit entitlement. Read glucose, steps and weight on Guy's test device. Record observed types, source names, foreground and background behaviour. Report as unverified if signing or a device is not available. |

**How design reference images are produced.** A Playwright script renders each board state from
`design/claude-design/boards` with a small DCLogic stub. The images go to `design/reference-screens/`. Native
screenshots come from the iOS Simulator and an Android emulator on the Mac.

## 4. Environment requirements and current blockers for Stage 2

- **Native builds** (decided 11 Nov 2026): EAS Build with Guy's Expo account. Needs: Guy runs `eas login` (or provides an `EXPO_TOKEN` as a secret), an EAS project id, and for device builds Apple Developer / Google Play credentials entered by Guy in EAS. iOS Simulator and Android emulator builds come first because they need no store accounts. Screenshots of native builds still need a simulator or device to run them on (the Mac with Xcode, or EAS-built apps on Guy's phone).
- **HealthKit spike**: needs an Apple Developer team that can sign the HealthKit entitlement, and a physical iPhone
  with Health data. Whether a free Personal Team can sign HealthKit has to be verified.
- **Deleting files in the project folder** is currently not allowed for Claude. Git creates and removes lock files,
  so `git init` / `commit` need delete permission, or Guy can run git himself.
- **Node on the Mac**: version to be confirmed. The VM has Node 22.23.4 and Python 3.10.12. The API targets
  Python ≥ 3.12.

## 5. Data-integrity decisions already fixed by the brief (to implement in Stage 3)

- Every record keeps:
  - `measured_at`, `entered_at` and `received_at` as separate fields
  - `source` (manual, voice, photo-estimate, device, health-import)
  - the original value and unit
  - revision history
  - an idempotency key
- The offline queue is held in SQLite, encrypted with a key stored in secure-store. A queued record shows "Pending
  sync" until the server confirms it.
- Server-side ownership checks run on every query. A separate test database is used for tests.

## 6. Stage 3 plan: first real end-to-end data flow

Guy approved continuing on 11 Nov 2026 ("תמשיך עם פיתוח האפליקציה"). Backend decision: local on the Mac only,
FastAPI and PostgreSQL in Docker, no cloud provider for now. Scope and acceptance come from brief §11 Stage 3.

| Step | What | Done when |
|---|---|---|
| 3.1 | API foundation in `services/api`: uv project, FastAPI, SQLAlchemy 2, Alembic, psycopg 3, settings from env, `docker-compose.yml` with PostgreSQL 16, separate test database | `/health` checks the database; `pytest` runs against the test database |
| 3.2 | Accounts: email and password (argon2id), short access token plus rotating refresh token stored hashed and revocable; sign-up, sign-in, refresh, sign-out, me | Tests cover wrong password, reused refresh token, expired token |
| 3.3 | Minimum profile: the onboarding answers are saved to the server when onboarding finishes, with consent records | Profile survives sign-out and sign-in |
| 3.4 | Glucose records: `measured_at`, `entered_at`, `received_at`, source, original value and unit, revision history, idempotency key; create, list by range, edit (new revision); ownership on every query | Retry with the same key does not duplicate; another account gets 404 |
| 3.5 | Typed contracts: OpenAPI schema → TypeScript types in `packages/contracts` | App and web compile against the generated types |
| 3.6 | App wiring: API base URL from `EXPO_PUBLIC_API_URL`, tokens in secure-store, sign-up / sign-in / session-expired screens, glucose sheet saves to the server, Journal and Overview read from it, editing | Entered reading appears after app restart |
| 3.7 | Offline queue in the protected store: "Pending sync" and "Failed" states, retry with the same idempotency key | Offline entry syncs once when back online; failure never shows as saved |
| 3.8 | Verification: API tests, app tests, and an end-to-end run (API + PostgreSQL + app web export in Playwright) | Brief acceptance: survives restart, isolated between accounts, no duplicates, failure not shown as success |

Not in Stage 3: password reset email (no email provider; the recover screen stays honest), the web dashboard
sign-in (G-12), HealthKit (Stage 4), the AI companion (Stage 5; Guy will provide an OpenAI key, which stays in the
API's local `.env` on the Mac and never in the repository or the app).

Guy's part: install Docker Desktop on the Mac, then `docker compose up -d` in `services/api` and run the API.
A phone on the same Wi-Fi reaches the Mac by its LAN address; the iOS Simulator uses `localhost`.
