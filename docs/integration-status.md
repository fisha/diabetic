# Integration status

Status values: **unconfigured**, **implemented-unverified**, **verified-test**, **verified-device**.

- **verified-test**: run end to end in the container, with the real API and database, and with test stand-ins only
  for outside providers (OpenAI, USDA, Expo push) inside `tests/`.
- Nothing is **verified-device** yet: no native build has run on a phone, and nothing has run on Guy's Mac.

Visual implementation is tracked separately in `docs/design-inventory.md`. Updated 11 Nov 2026.

| Integration | Status | What exists | Blocker for the next status |
|---|---|---|---|
| Accounts (email and password) | verified-test | FastAPI auth with argon2id, rotating refresh tokens, sign-out revokes the family. App and dashboard sign in against it. | Run on the Mac; password reset needs an email provider |
| Backend API and PostgreSQL | verified-test | `services/api`, 86 tests. Alembic migrations. Runs locally only (decision of 11 Nov 2026). | Docker Desktop and uv on the Mac; hosting is not decided |
| Offline record queue | verified-test | Records wait in the protected store and are sent with idempotency keys. Web preview e2e. | Native restart survival on a device |
| Protected on-device store | implemented-unverified | XChaCha20-Poly1305 file, key in expo-secure-store. Sealing code verified-test; Keychain / Keystore not run on a device. | Dev build on a phone |
| Records (glucose, insulin, activity, notes, meals) | verified-test | Revisions, corrections, soft delete, hide from summaries. Journal and Overview read them. | Device run |
| Profile sync | verified-test | Onboarding answers saved to the server and loaded after sign-in on another phone. | Device run |
| Companion conversation (LLM) | implemented-unverified | OpenAI behind a provider interface (`steady_api/ai/provider.py`), tools that propose records for confirmation, dose safety check. Verified with a rule-based stand-in in tests and e2e only. | Guy's OpenAI key in `services/api/.env`; then a real conversation check in all four languages |
| Voice (speech to text, text to speech) | implemented-unverified | OpenAI transcription and speech; the app records a turn, sends it, plays the stored reply. Stand-in in tests and e2e. One voice for every companion (G-26). | OpenAI key; microphone on a device |
| Meal photo analysis | implemented-unverified | OpenAI vision adapter chosen instead of LogMeal or Passio (one provider, no extra contract). Stand-in in tests and e2e. | OpenAI key; quality check on real meals |
| Food search (nutrition database) | implemented-unverified | USDA FoodData Central. Stand-in in tests and e2e. | Free USDA key in `.env` |
| Follow-ups and reminders | verified-test (local) | Durable worker in the API; the phone schedules local notifications for upcoming follow-ups. | Device run |
| Push notifications | implemented-unverified | Expo push adapter on the server; the app registers its token per account and removes it on sign-out. A token exists only with an EAS project id (`EAS_PROJECT_ID`). | Expo account, `eas init`, a dev build, Apple push key |
| Apple Health (read only) | implemented-unverified | `@kingstinct/react-native-healthkit` 16.2: permission for blood glucose, read the last 30 days then new readings each time the app opens, send to `POST /glucose/import`. The iOS bundle builds. | Apple developer account, a dev build, a test iPhone |
| Android Health Connect (read only) | implemented-unverified | `react-native-health-connect` 4.1.3 with its config plugin, `READ_BLOOD_GLUCOSE`, minSdk 26. The Android bundle builds. | A dev build and an Android phone with Health Connect |
| CareLink / MiniMed, Dexcom and other vendor clouds | unconfigured | No official access; no scraping. Only through Apple Health / Health Connect where the vendor app writes there. | Partnership or official API |
| Insights and summaries | verified-test | Day-part patterns from the person's own readings and target range (product rules, not clinical rules). | Clinical review of wording |
| Data export | verified-test | PDF (Hebrew and Arabic shaped, right to left) and CSV zip, kept 7 days, downloaded in the app and the dashboard. | "Ready" push needs push |
| Account deletion | verified-test | Deletes every record, photo and export; the app clears its local data. | Backup retention policy text |
| Billing and membership | unconfigured | Membership screens show "not set up yet"; `GET /membership` says the same. Nothing is charged. | Billing provider and store decision (G-19) |
| Website and web dashboard | verified-test | `apps/web`: signed-in dashboard with overview, timeline, insights, settings and export; English and Hebrew right to left checked. Not deployed. | Hosting decision; G-12 (session kept in memory only) |
| Transactional email | unconfigured | Needed for password reset. The recover screen keeps its G-04 state. | Email provider |
| App preferences (non-health) | implemented-unverified | Appearance, text size, motion, captions, haptics, voice speed, notification kinds. | Device run |
| Native builds (EAS) | unconfigured | `eas.json` has development, simulator, preview and production profiles. `expo export` for iOS and Android passes. | Guy's Expo account (`eas login`), Apple and Google developer accounts |
