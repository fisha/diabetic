# Release readiness

Stage 6 of the brief asks for a requirement coverage matrix with evidence and open items, build and run
instructions, environment variables, migrations, and an honest readiness verdict. Updated 11 Nov 2026 (main
`1af4481` and later).

## Verdict

**Not ready for release.** It is ready for Guy's own use on his Mac and phone as a development build.

These items block a release:

1. Nothing has run as a native build on a phone. Everything marked verified was checked in the cloud container,
   through the web build with a browser and the real API and database. Outside providers were replaced by test
   stand-ins there. On Guy's Mac the API, the web app and the iOS bundle serve, and his voice tries are the only real
   provider use so far.
2. There has been no clinical review (G-05) of any wording: insights, meal patterns, pump alert texts, the mentor
   prompt or safety replies.
3. There is no hosting, no backup policy, and no database row encryption decision. The API runs only on the Mac
   (decision of 11 Nov 2026).
4. There is no transactional email, so there is no password reset.
5. Billing is not connected. Membership shows "not set up yet".
6. CareLink is an unofficial connection that Guy accepted for his own use (G-29). It is not fit for other users
   without Medtronic's approval.
7. The model evaluation (brief section 10) is a separate thread. Its findings 5 (early "saved" claims) and 6
   (averages from too few readings) are still open.

## Coverage matrix

Status words: **done-test** means it was verified in the container (`docs/integration-status.md` "verified-test").
**built** means the code is there with automated tests, but it was not seen on a device. **partial** means part is
missing, and the Open column says what. **open** means it was not built.

### 7. Features

| Requirement | Status | Evidence | Open |
|---|---|---|---|
| Real accounts: sign-up, sign-in, session expiry, sign-out | done-test | `test_auth*.py`, `tools/e2e/account.cjs` | Password recovery needs an email provider (G-04) |
| Resumable onboarding, one decision per step, unknown allowed | done-test | `onboarding-flow.test.ts`, stage3 e2e | Device run |
| Equipment with exact models; selecting is not connecting | done-test | Onboarding steps, devices screen | None |
| Permissions in context, with alternatives | built | Mic denied banner, health "Not available", camera fallback | Device run for each permission |
| Companions, custom name, voice preview | built | Onboarding companion steps; voice list = provider voices | Voice preview on a device |
| First three days as learning the routine; known, missing, corrections | done-test | G-36, `test_familiarization_first_days`, e2e `followups.cjs` f04 | First-days summary RTN-02 not at runtime |
| Text and voice share context | built | Same conversation and instructions for both (`conversation.instructions`) | Native live audio needs a dev build module |
| Orb states, interruption, transcript, retry, text-only path | built | `CompanionScreen`, `test_live.py`, voice e2e | Real latency numbers pending Guy's next try |
| Spoken values validated before saving; actions confirmed from tool results | done-test | `propose_glucose` card, unit and other-person guards, `test_conversation.py` | None |
| Cards for glucose, food, insulin taken, activity, photo | done-test | Records e2e, meal e2e | Device run |
| Measured, entered and imported times; source and corrections | done-test | Revisions tables, journal detail | None |
| No duplicates across conversation, form and devices | done-test | Idempotency keys, `dedupe.drop_cross_source`, tests | Journal merge of near-duplicates the person typed twice |
| Food photo: analysis, items, portions, corrections, estimate kept as estimate | built | OpenAI vision adapter (stand-in in tests), meal e2e | Quality check on real meals; LogMeal/Passio not evaluated (OpenAI chosen) |
| Carbohydrate error measured on weighed meals | open | None | Needs reference meals and the evaluation thread |
| Charts, summaries and filters from real records | done-test | Overview and journal e2e | Week and month fill in only as data builds up (CareLink gives 24 h) |
| Insights linked to observations; correlation not cause | done-test | `test_insights.py`, G-34 wording | Clinical review |
| Follow-ups: why, answer, snooze, dismiss, retries, dedupe, time zones, quiet hours, withdraw when answered | done-test | `test_followups.py`, G-34 | RTN-04 sheets (G-19), lock-screen notification on a device |
| Facts, hypotheses, preferences, treatment settings, tasks stored apart | done-test | G-37, memory kinds, profile, follow-ups | None |
| Treatment settings stored as given, unknown allowed, no defaults | done-test | Profile ratios with unknown | Per-value source and update dates not re-checked against the brief |
| No dose recommendations | done-test | `ai/safety.py`, `test_safety.py`, dose check on every reply including voice | Clinical review of the refusal text |
| RTL for Hebrew and Arabic, LTR for English and Russian | done-test | e2e in he/ar, `packages/i18n` tests | Device run with forced RTL reload |
| Complete localization | partial | 4 catalogues, every new string has all four | Translation review (meta `review: translation`) |
| Accessibility and reduced motion | built | Roles and labels, reduce-motion paths, contrast test in tokens | Screen reader and 200 % text on a device |
| Multilingual voice quality | open | None | Real tries in all four languages |
| One membership, monthly and annual; no sales in conversations | partial | Screens and "not set up yet" | Price, trial and billing provider (G-19) |
| Website and web dashboard with the same account | done-test | `apps/web`, web e2e | Hosting |

### 8. Health stores and devices

| Requirement | Status | Evidence | Open |
|---|---|---|---|
| Read-only glucose from Apple Health and Health Connect | built | `features/health`, iOS and Android bundles build | Dev build on a phone; feasibility report on a real device |
| Idempotent import, corrections and deletions, checkpoints | done-test | `test_health_import.py` (window removal), `health.test.ts` | Device run |
| Account isolation on a shared phone | done-test | Health state keyed by account | None |
| Stale, failed, refused, unavailable states | built | G-28, G-35 | Seen only in code and on the web "Not available" path |
| Last sync and newest measurement shown separately | built | G-35 | Device run |
| Manual entry when health data is missing | done-test | "Log a reading" path | None |
| MiniMed / CareLink | built | Unofficial (G-29), sensor, meals, boluses, alerts; stand-in tests | Real sign-in with Guy's account; captcha path on the Mac |

### 9. Backend, data and security

| Requirement | Status | Evidence | Open |
|---|---|---|---|
| Typed contracts, migrations, real auth, ownership checks | done-test | `packages/contracts` generated from OpenAPI, Alembic, per-user queries, 135 API tests | None |
| Durable jobs | done-test | Worker with retries | Separate worker process when hosted |
| Units, time zones, idempotency, revisions | done-test | Tests for conversion, DST, keys | None |
| Protected offline queue | built | XChaCha20 store, key in secure store | Keychain/Keystore on a device |
| Encryption in transit and at rest | partial | Sealed CareLink sign-in, photos and exports; log parameters hidden | Database rows (hosting decision); TLS comes from hosting |
| Retention, deletion, export, revocation | done-test | Account deletion and export e2e | Backup retention text |
| Separate consent for training | done-test | Consent screen, `training: false` default | None |
| AI behind interfaces; failures never fake results | done-test | `ai/provider.py`, 503 states | None |

### 10. AI evaluation

Section 10 runs in the separate thread "Run companion model experiments". Findings 1, 2 and 4 are fixed here. Finding
2's decision card is still open. Findings 5 and 6 are open. No medical model has been selected or validated.

## Screens

`docs/design-inventory.md` lists 103 screens and states, and 81 are marked implemented. Some rows are older than the
slices that later touched them, so they need a re-audit before any launch claim:

- COM-04, the confirmation card for extracted input. It now exists for glucose.
- COM-12, microphone denied. The banner exists.
- COM-13, opened from a notification.
- RTN-06, memory. It works at runtime.
- RTN-07, the lock-screen notification.

RTN-02 (first-days summary) and the RTN-04 sheets are not built.

## Build and run

- API on the Mac: see `services/api/README.md` ("Run on the Mac": Docker Postgres, `uv sync`,
  `uv run alembic upgrade head`, uvicorn). On Guy's Mac it runs on port 8010.
- App: see `apps/mobile/README.md`. Run Metro on 8081, with `EXPO_PUBLIC_API_URL` pointing at the API. Expo Go cannot
  run the app because it uses native modules, so the iPhone needs a development build (EAS, blocked on Apple sign-in).
- Web dashboard: `apps/web`, `pnpm dev`.
- Checks: `pnpm check` at the root (read the exit code), and `uv run ruff check . && uv run pytest` in
  `services/api`. The browser e2e scripts are in `tools/e2e/`; usage is at the top of each file.

## Environment variables

All of them are listed in `services/api/.env.example`, without values. Two need special care:

- Keys stay in `services/api/.env` on the Mac only.
- `STEADY_SEALING_KEY` should be set once and kept. If it is unset, it is derived from `STEADY_JWT_SECRET`, and then
  changing that secret makes the sealed CareLink sign-in, meal photos and exports unreadable.

## Migrations

Run `uv run alembic upgrade head` after every pull that adds a file in `services/api/alembic/versions/`. The latest is
`f7a8b9c0d1e3` (Google sign-in, waitlist and email verification, G-46). `a8c9d0e1f2b4` (same meal from two sources, G-47) also soft-deletes repeated CareLink pump events (rows are kept). Each migration so far only adds columns, tables or rows. None is destructive.
