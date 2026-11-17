---
name: privacy-compliance
description: Check a Stedio change against the health-data privacy rules (Israeli Privacy Protection Law and Amendment 13, GDPR special-category data, FTC Health Breach Notification Rule, Washington MHMDA) and Guy's data-handling rules before merging. Use for any change that collects, stores, sends, shows, logs or exports user data, adds a processor or provider, or touches admin, sharing, consent or legal pages.
---

# Privacy and compliance check

Almost everything Stedio holds is health data: glucose, insulin, pump settings, meals, heart rate, sleep, voice and
conversations, and the fact that the person has diabetes. Treat all of it as special-category data. The full list of
production requirements is in `docs/release-readiness.md` ("Before production and before submitting to the stores")
and the legal pages' open items in `docs/legal-open-items.md`. This is a product check, not legal advice.

Guy's rule (16 Nov 2026): every piece of development is checked against this skill and `regulatory-check`.

## How to run the check

1. List the data the change touches: what is collected, where it is stored, who can see it, where it is sent, what
   is logged, and how long it is kept.
2. Go through the rules below and mark each **pass**, **at risk** or **fail** with the file and line.
3. A **fail** blocks the merge. An **at risk** item goes into the PR description and, if not fixed now, into Jira as an
   `open-item` task under PM-12 (Privacy and legal).
4. If the change adds a data type, a processor or a purpose, update the privacy policy texts in English and Hebrew
   (`apps/web/src/legal/texts/privacy.*.ts`) and `docs/legal-open-items.md`.

## Rules

### Collection and consent
- Collect only what a feature needs. A new data type needs a stated purpose.
- Training or model-improvement use is a separate consent and off by default (`training: false`).
- Optional features that read extra data (weather location, health stores) are off until the person turns them on.
  Location is rounded (0.1°) and only the derived state is kept.
- Web onboarding answers stay in the page only, never in browser storage.

### Processors and transfers
- A new outside service that receives user data (AI model, email, push, hosting, analytics) is a processor: add it to
  the privacy policy and `docs/legal-open-items.md` (DPA and transfer mechanism to confirm).
- Send the minimum. OpenAI calls use `store=false`. Never send a person's email or name to a provider unless the
  feature needs it.
- Production data and all user data live on Fly.io (org `stedio`, region fra). Never copy user data elsewhere.

### Access (need to know)
- An admin never changes another person's treatment settings or preferences, only device connection settings.
- Admin view of health data is accepted for testing only; production needs time-limited, person-granted support
  access with a view log (`docs/release-readiness.md`). New admin views of health data are at risk.
- "View as" stays read-only. Never while viewing someone else's data write to a health store.

### Logs, inspection and secrets
- Logs hold names of kinds, counts and timings only: no values, no free text, no tokens, no audio
  (`tests/test_logs.py` checks log call shapes; keep it passing).
- Inspections of logs or the database report aggregates and metadata only, never personal values, and nothing from
  them is saved to the repo, Jira or Confluence.
- Secrets live in Fly secrets and the Mac's `.env`, never in code, chat, docs, Jira or Confluence.
- Sealed fields (device sign-ins, photos, exports) stay sealed; new credentials use `steady_api/sealing.py`.

### Rights and retention
- Every new table or stored field is covered by account export and account deletion (check `steady_api/export.py`
  and the deletion path, and their tests).
- State how long new data is kept. Photos follow the person's photo retention setting.
- Deleting a test account never touches a real account.

### Pages and notices
- Privacy policy, terms and accessibility statement exist in English and Hebrew with the same placeholders
  (`apps/web/test/legal.test.ts`). Changes go to both.
- The website stays noindex until Guy says otherwise.

## Quick searches

```bash
# New outbound calls (possible new processor)
grep -rnE "httpx\.(get|post)|requests\.|fetch\(" services/api/steady_api apps/web/src apps/mobile/src | grep -v test
# Logging of values or text
grep -rnE "log\.(info|warning|error)\(.*(value|text|body|token|email)" services/api/steady_api
```
