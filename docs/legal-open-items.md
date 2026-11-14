# Legal pages: open items

The privacy policy, terms of use and accessibility statement (G-71, 14 Nov 2026) are on the website at `/privacy`,
`/terms` and `/accessibility` in four languages. Their texts are in `apps/web/src/legal/texts`. Every detail that is
not known from the code or a decision of Guy is a highlighted placeholder `⟦…⟧` on the page. Fill these in every
language file (the test `apps/web/test/legal.test.ts` checks that all four have the same number of placeholders), then
have a privacy lawyer review the whole text. None of this is legal advice.

## Guy to provide

| Item | Pages |
|---|---|
| Legal entity name, registered address, company number | privacy, terms |
| Privacy contact email | privacy |
| Support email | terms |
| Data protection officer (name and contact), if one is appointed | privacy |
| EU representative under GDPR Article 27, if needed (needed when serving people in the EU without an EU office) | privacy |
| Accessibility coordinator: name, phone, email, and the reply time in business days | accessibility |
| Minimum age and the rules for a child's account and parent or guardian consent | privacy, terms |
| Governing law and courts (Israeli law and Tel Aviv courts are the usual choice) | terms |

## To decide or confirm before production

| Item | Pages | Notes |
|---|---|---|
| Country where the server is today (Guy's Mac) | privacy | Israel has an EU adequacy decision, which simplifies transfers |
| Production hosting provider and location | privacy | `docs/release-readiness.md`, Hosting |
| Retention of backups and logs | privacy | No backup policy exists yet |
| Retention of waiting-list requests that were not approved | privacy | The API keeps them today with no limit |
| Email provider for sign-in codes and account emails | privacy | SMTP sender in `services/api/.env` |
| Data processing agreement with OpenAI and its retention setting (zero data retention or 30 days) | privacy | The API sends `store=false` |
| Transfer mechanism per processor (SCCs or Data Privacy Framework) | privacy | OpenAI, Expo, ngrok, email provider |
| Cancellation and refund terms under consumer protection law | terms | When billing opens |
| Liability wording | terms | Lawyer |

## Facts the texts state, with their source

- Read-only device connections: standing rule (Guy); `services/api/steady_api/carelink.py`, `cgm.py`, `tandem.py`.
- Disconnect forgets the sign-in, optional removal of readings: `routers/carelink.py` `disconnect`.
- Account deletion removes rows (cascade) and files at once, and revokes training data: `routers/account.py`
  `delete_account`, `learning.revoke_training`.
- Training consent separate and off by default: G-61, onboarding consent.
- Meal photo retention choices: `routers/settings.py` `photo_retention`. Exports expire after 7 days
  (`EXPORT_DAYS`), invite codes after 7 days (`CODE_DAYS`), refresh tokens after 30 days.
- OpenAI requests with `store=False`: `ai/provider.py`, `ai/food.py`. No voice recordings are written to disk.
- Location rounded to 0.1 degree before Open-Meteo: `environment.py`. USDA gets the search text only: `nutrition.py`.
- Website: sign-in kept in page memory only (`apps/web/src/lib/api.ts`), one cookie `NEXT_LOCALE` (next-intl), no
  analytics, fonts self-hosted.
- Admin read-only access during testing, no change to another person's treatment settings: G-44 and Guy's admin rule.
- Clinical wording (ADA, ketones when high, not a medical device, no doses): Guy's rules; needs the clinical review
  (G-05) like the rest of the copy.
