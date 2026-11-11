# Integration status

Status values: **unconfigured**, **implemented-unverified**, **verified-test**, **verified-device**.

Visual implementation is tracked separately in `docs/design-inventory.md`.

| Integration | Status | Candidate / note | Blocker |
|---|---|---|---|
| Authentication | unconfigured | provider not chosen. The account screens validate locally and show "Not available in this build"; nothing is sent (`features/auth/auth.ts`). | decision |
| Backend API (FastAPI) | unconfigured | Stage 3 | |
| PostgreSQL + migrations | unconfigured | Stage 3 | hosting / data residency decision |
| Offline queue (SQLite, encrypted) | unconfigured | Stage 3 | |
| Records API (readings, insulin, activity, notes, reminders, meals) | unconfigured | Stage 3. Save meal also shows the unavailable banner. The log sheets validate locally and show "Not available in this build" on Save (`features/records/records.ts`). | backend |
| Protected on-device store (onboarding draft) | implemented-unverified | XChaCha20-Poly1305 file + key in expo-secure-store. The sealing code is verified-test (round trip, tamper, wrong key); Keychain/Keystore not yet run on a device. | EAS build |
| Apple HealthKit (read-only) | unconfigured | @kingstinct/react-native-healthkit 16.2.0 (candidate) | signing team and test iPhone; G-01 UI placement |
| Android Health Connect | unconfigured | react-native-health-connect 4.1.3 / expo-health-connect 0.1.1 (candidates) | Android test device |
| MiniMed / CareLink | unconfigured | no official access verified; no scraping | partnership investigation |
| Guardian 4 and other CGMs | unconfigured | only via HealthKit / Health Connect where a source writes there | |
| LLM (text companion, tools) | unconfigured | provider not chosen. The Companion composer reports "not sent" (`features/companion/conversation.ts`). | decision |
| Voice (speech in/out, barge-in) | unconfigured | provider not chosen; multilingual quality not verified. The orb shows the G-04 state. | decision |
| Food photo analysis | unconfigured | LogMeal (initial), Passio (comparison); neither selected. "Use this photo" and "Find foods" show "Not available in this build" and send nothing (`features/meal/services.ts`). | API access, plan, cost approval |
| Nutrition search | unconfigured | same provider decision. The search sheet says it is not connected; the user can add their own food with typed carbs. | |
| Camera and photo library | implemented-unverified | expo-camera 58 (capture, flash, permission) and expo-image-picker 58. Photos stay in memory; nothing is stored or sent. | EAS build |
| Push notifications / follow-ups | unconfigured | expo-notifications + durable jobs (procrastinate candidate). The permission request in ONB-19 is implemented-unverified; no push token or scheduling yet. | Apple/Google push credentials |
| Billing | unconfigured | Store and provider not chosen; prices and trial open. The Membership screen shows "not set up yet" and every billing action says nothing was charged (`features/membership/`). | decision |
| Export / account deletion jobs | unconfigured | Stage 5/6 | retention policy |
| App preferences (non-health) | implemented-unverified | Appearance, text size, motion, captions, haptics, voice speed, notification kinds, photo retention and memory are saved with the generic preference store (`features/settings/SettingsProvider.tsx`). Health answers stay in the protected draft. | |
| Website and dashboard (Next.js) | implemented-unverified | `apps/web`, built and checked in the container; not deployed anywhere. | hosting decision |
| Transactional email | unconfigured | depends on auth provider | |
| Web dashboard auth | unconfigured | same identity as mobile | G-12 |
| Accounts and database (Stage 3) | unconfigured | Decided 11 Nov 2026: local only on the Mac, FastAPI and Postgres in Docker. Nothing built yet. | Stage 3 plan approval |
