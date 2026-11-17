# Legal pages: open items

The privacy policy, terms of use and accessibility statement (G-71, 14 Nov 2026) are on the website at `/privacy`,
`/terms` and `/accessibility` (texts in English and Hebrew; the website shows English only, and Arabic and Russian were
removed on 17 Nov 2026, PM-194). Their texts are in `apps/web/src/legal/texts`. Every detail that is
not known from the code or a decision of Guy is a highlighted placeholder `⟦…⟧` on the page. Fill these in every
language file (the test `apps/web/test/legal.test.ts` checks that both have the same number of placeholders), then
have a privacy lawyer review the whole text. None of this is legal advice.

## Filled in

- 15 Nov 2026 (Guy): the company is **Ming GF Ltd, Tel Aviv, Israel**. It is the controller (privacy), the provider
  and owner (terms), the operator (accessibility statement) and the footer line. No company number is shown (not
  needed for GDPR; add it if the lawyer wants it).
- Governing law set to the laws of the State of Israel and the competent courts in Tel Aviv, following the company's
  seat. Change it in the four `terms.*.ts` files if the lawyer advises otherwise.

## Guy to provide

| Item | Pages |
|---|---|
| Privacy contact email | privacy |
| Support email | terms |
| Data protection officer (name and contact), if one is appointed | privacy |
| EU representative under GDPR Article 27, if needed (needed when serving people in the EU without an EU office) | privacy |
| Accessibility coordinator: name, phone, email, and the reply time in business days | accessibility |
| Minimum age and the rules for a child's account and parent or guardian consent | privacy, terms |

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
| Sharing with a trusted person (DAP-19): consent text, the viewer's chat about shared data, and older shares without a consent record | privacy, terms | Lawyer (PM-127); texts in `packages/i18n` `shr.consent_*` and privacy "Sharing" |
| Cancellation and refund terms under consumer protection law | terms | When billing opens |
| Liability wording | terms | Lawyer |
| General 15 g / 15 minutes low rule in companion replies, given as general information with the person's own care plan first, plus an emergency call button (Guy, 17 Nov 2026) | none (product behaviour) | Lawyer and clinical advisor (PM-206): is it general information or treatment guidance? If it is guidance, remove it or replace it with a fixed text a clinician approved (G-05). |
| Consent to the external AI engine (PM-149) required for using Stedio, withdrawn only by deleting the account; whether an optional version (journal without the companion) is needed for consent to count as freely given | privacy | Lawyer (PM-99); texts `onb.c3`, `onb.c3b`, `ai.*`, `set.pv_ai*`; privacy policy "Who we share it with" names OpenAI |

## Queued for the next legal version

**Released 17 Nov 2026 as privacy `2026-11-17T21:30:00Z` (PM-208, Guy: "אתה יכול להוציא גרסה משפטית חדשה").** Both
lines below are in the policy in English and Hebrew (plus a retention line for the verdicts), `quality.POLICY` names that
version, and `STEADY_QUALITY_SAMPLE_SHARE=0.05` is set in `deploy/fly/api/fly.toml`. Nothing is queued now; add new
approved lines here.

- **Quality review of real companion replies (PM-198, PM-202; Guy 17 Nov 2026: "כן, בגרסה המשפטית הבאה").** Under
  "How the AI uses your data":
  - en: "If you turned on the optional consent to improve our models, we may check a small random share of the
    companion's replies to you for safety and quality. An external AI engine reads the reply and the messages just
    before it and records only a verdict (for example, whether the reply stayed within safe, general information).
    The verdict is kept for 90 days and is deleted with the conversation, your account, or when you turn that consent
    off. It is never used to decide anything about you."
  - he: "אם הפעלת את ההסכמה האופציונלית לשיפור המודלים שלנו, אנחנו עשויים לבדוק חלק קטן ואקראי מהתשובות של
    המלווה אלייך, לבטיחות ואיכות. מנוע בינה מלאכותית חיצוני קורא את התשובה ואת ההודעות שלפניה ושומר רק הערכה (למשל,
    אם התשובה נשארה במסגרת מידע כללי ובטוח). ההערכה נשמרת 90 יום ונמחקת עם השיחה, עם החשבון, או כשמכבים את ההסכמה. היא
    אף פעם לא משמשת להחליט משהו לגביך."
  - Then: set `quality.POLICY` in `services/api/steady_api/quality.py` to that legal version (it must be <= the
    released privacy version), and set `STEADY_QUALITY_SAMPLE_SHARE` and `STEADY_QUALITY_JUDGE_MODEL` on Fly.
- **Group priors (PM-199, PM-202), suggested with the same version.** en: "How sure an insight is called may also take
  into account averages from people with a similar setup who turned on the consent to improve our models (groups of
  at least five; no one's own data is shown to anyone else). The numbers you see are always from your own records."
  he: "כמה תובנה נחשבת ודאית עשוי להתחשב גם בממוצעים של אנשים עם הגדרות דומות שהפעילו את ההסכמה לשיפור המודלים
  (קבוצות של חמישה לפחות; אף אחד לא רואה נתונים של מישהו אחר). המספרים שמוצגים לך הם תמיד מהרשומות שלך."

## Facts the texts state, with their source

- Read-only device connections: standing rule (Guy); `services/api/steady_api/carelink.py`, `cgm.py`, `tandem.py`.
- Disconnect forgets the sign-in, optional removal of readings: `routers/carelink.py` `disconnect`.
- Account deletion removes rows (cascade) and files at once, and revokes training data: `routers/account.py`
  `delete_account`, `learning.revoke_training`.
- Training consent separate and off by default: G-61, onboarding consent.
- Explicit, separate consent before anything goes to the external AI engine (PM-149): `steady_api/ai_consent.py` refuses
  every engine route without the latest "ai" consent record (and the shared person's, for a viewer's chat);
  `tests/test_ai_consent.py`.
- Re-acceptance when a document changes (PM-156): `steady_api/legal.py` versions the Terms, the Privacy Policy and the AI
  consent; each acceptance is a `consents` row with the version; the app blocks until the current versions are
  accepted; the "Changes" sections of both texts say so. `tests/test_legal.py`.
- Meal photo retention choices: `routers/settings.py` `photo_retention`. Exports expire after 7 days
  (`EXPORT_DAYS`), invite codes after 7 days (`CODE_DAYS`), refresh tokens after 30 days.
- OpenAI requests with `store=False`: `ai/provider.py`, `ai/food.py`. No voice recordings are written to disk.
- Location rounded to 0.1 degree before Open-Meteo: `environment.py`. USDA gets the search text only: `nutrition.py`.
- Website: sign-in kept in page memory only (`apps/web/src/lib/api.ts`), one cookie `NEXT_LOCALE` (next-intl), no
  analytics, fonts self-hosted.
- Admin read-only access during testing, no change to another person's treatment settings: G-44 and Guy's admin rule.
- Clinical wording (ADA, ketones when high, not a medical device, no doses): Guy's rules; needs the clinical review
  (G-05) like the rest of the copy.
- Conversation embeddings (G-98, PM-196): the person's own messages go to OpenAI's embeddings endpoint (same processor,
  same AI consent, request storage off) for recall in the companion; table `message_embeddings`, deleted with memory
  off, AI off, the message or the account; not exported (derived). Privacy policy sentence pending.
