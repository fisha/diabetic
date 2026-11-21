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
- 18 Nov 2026 (Guy, PM-229): the privacy contact is **guy@mi-ng.com** (privacy policy "Who we are" and "Contact", en
  and he; privacy version `2026-11-18T12:45:00Z`). The data protection officer and EU representative lines were removed
  for the closed Israeli testing stage; whether either is needed before a wider launch is with the lawyer (PM-230,
  `needs-lawyer`).
- 18 Nov 2026 (Guy, PM-234: "אני לא רוצה placeholders"): no `⟦…⟧` is left on any page. Support email and
  accessibility contact guy@mi-ng.com (reply within 5 business days); hosting Fly.io, Frankfurt, Germany (EU), backups
  in region; the old Mac-server text and the ngrok line removed; no email provider line (none is configured,
  `integration-status.md` "Transactional email"); OpenAI may keep API requests up to 30 days for abuse detection;
  backups up to 30 days (Fly snapshots 30 days, nightly dumps 14 days), server logs up to 30 days; unapproved
  waiting-list requests until the end of testing; minimum age 18 (matches the app's adult-only onboarding,
  `onb.mi_b`); billing terms to be added before billing opens. Versions: privacy `2026-11-18T13:15:00Z`, terms
  `2026-11-18`, accessibility `2026-11-18`. Lawyer points are in PM-230.
- Governing law set to the laws of the State of Israel and the competent courts in Tel Aviv, following the company's
  seat. Change it in the four `terms.*.ts` files if the lawyer advises otherwise.

## Guy to provide

Nothing. On 18 Nov 2026 Guy asked for no placeholders on the pages (PM-234); every `⟦…⟧` was filled with the values
below, which Guy and the lawyer can still change.

## To decide or confirm before production

| Item | Pages | Notes |
|---|---|---|
| Data protection officer and EU representative (GDPR Article 27) before a wider launch | privacy | Lawyer (PM-230). Removed from the page for the closed Israeli testing stage |
| Delete unapproved waiting-list requests when testing ends, as the policy now says | privacy | PM-234 follow-up; the API keeps them with no limit today |
| Data processing agreement with OpenAI; the policy says it may keep requests up to 30 days for abuse detection | privacy | The API sends `store=false`; lower it if zero data retention is agreed |
| Transfer mechanism per processor (SCCs or Data Privacy Framework) | privacy | OpenAI, Fly.io, Expo, Apple, Google (PM-230) |
| Accessibility coordinator's name and phone (the page gives email only) | accessibility | Lawyer (PM-230): Israeli accessibility regulations may require them |
| Under 18 with a parent following (PM-248, 18 Nov 2026): the parent's in-app confirmation as parental consent, one parent or both, a lower age limit, self-declared age, minors and the external AI engine, turning 18, the parent's delete right, the contracting party | privacy, terms | Lawyer (PM-249, `needs-lawyer`). Built defaults: any age under 18 with one confirmed parent (18+), no profile, device or AI before that, minors never train models |
| Sharing with a trusted person (DAP-19): consent text, the viewer's chat about shared data, and older shares without a consent record | privacy, terms | Lawyer (PM-127); texts in `packages/i18n` `shr.consent_*` and privacy "Sharing" |
| Cancellation and refund terms under consumer protection law | terms | When billing opens; the terms say they will be added first |
| Liability wording | terms | Lawyer (PM-230); the page marker was removed on Guy's request |
| General 15 g / 15 minutes low rule in companion replies, given as general information with the person's own care plan first, plus an emergency call button (Guy, 17 Nov 2026) | none (product behaviour) | Lawyer and clinical advisor (PM-206): is it general information or treatment guidance? If it is guidance, remove it or replace it with a fixed text a clinician approved (G-05). |
| Consent to the external AI engine (PM-149) required for using Stedio, withdrawn only by deleting the account; whether an optional version (journal without the companion) is needed for consent to count as freely given | privacy | Lawyer (PM-99); texts `onb.c3`, `onb.c3b`, `ai.*`, `set.pv_ai*`; privacy policy "Who we share it with" names OpenAI |

## Queued for the next legal version
- (Done 20 Nov 2026, privacy version `2026-11-20`, PM-270.) WhatsApp companion channel (PM-269): Meta (WhatsApp Cloud
  API, Meta Platforms Ireland / Meta Platforms Inc.) is now in the privacy policy, English and Hebrew: data collected,
  legal basis (its own optional consent), processor entry with no end-to-end encryption and Meta's up-to-30-day
  retention, transfers, and retention on our side. Guy opened WhatsApp to every account the age rules allow (the
  allowlist is gone). Still for the lawyer (PM-270, `needs-lawyer`): Meta's WhatsApp Business data processing terms as
  the DPA, the transfer mechanism (DPF / SCCs), and confirm Meta's 30-day Cloud API retention wording. The separate
  `whatsapp` consent (strings `wa.body`, `wa.agree`, version `2026-11-19` in `steady_api/whatsapp/links.py`) is recorded
  before linking.

**Released 18 Nov 2026 as privacy `2026-11-18T14:00:00Z` (PM-233):** demo request data under "What we collect", demo
retention under "How long we keep data", and the stored demo link under "Cookies and storage", in English and Hebrew.
Lawyer review: PM-235. Still open from before: approval and verification emails go out over SMTP, and the policy names
no email provider.


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
- Location rounded to 0.1 degree before Open-Meteo: `environment.py`. USDA gets the search text only (`nutrition.py`), and the barcode number for products Open Food Facts lacks (`barcodes.py`, PM-336; privacy text 2026-11-20). Open Food Facts gets the barcode number only, from the server, with a generic user agent and no account (`barcodes.py`, PM-242); its data is ODbL, so the scan screen credits it.
- Website: sign-in kept in page memory only (`apps/web/src/lib/api.ts`), one cookie `NEXT_LOCALE` (next-intl), no
  analytics, fonts self-hosted.
- Admin read-only access during testing, no change to another person's treatment settings: G-44 and Guy's admin rule.
- Clinical wording (ADA, ketones when high, not a medical device, no doses): Guy's rules; needs the clinical review
  (G-05) like the rest of the copy.
- Conversation embeddings (G-98, PM-196): the person's own messages go to OpenAI's embeddings endpoint (same processor,
  same AI consent, request storage off) for recall in the companion; table `message_embeddings`, deleted with memory
  off, AI off, the message or the account; not exported (derived). Privacy policy sentence pending.
- Lab report reading (PM-213, privacy version `2026-11-17T23:45:00Z`): photos or a PDF of a lab report go to OpenAI
  (same processor, same AI consent, `store=False`) only after the person accepted that privacy version
  (`routers/labs.py` `POLICY`). The document is read in memory and never written to disk, the database or a log; only
  the rows the person checks are saved, as `lab` records (covered by export and deletion). To confirm with the lawyer:
  the photo itself carries the person's name and ID number to the processor (the model is told to leave them out of
  its answer, but it sees them), and whether lab reports need a consent of their own beyond the AI consent.
- Clinic sharing (PM-275, privacy version `2026-11-19T12:00:00Z`): a clinic team sees a person's pre-visit summary only
  after the person accepts in the app (`consent: true`, `consent_version` stored on the link), with the parts they
  chose; view log 12 months; questions until 7 days after the visit (30 without a date); summary wording 1 day; an
  unanswered request ends after 14 days; the clinic never learns whether an email has an account. Clinic team members'
  name, role and licence number are kept for the clinic. To confirm with the lawyer: Stedio's role towards the clinic
  (independent controller sharing at the person's request, or processor for the clinic), whether a data-sharing
  agreement with each clinic is needed, and whether the printed copy in the clinic's file is outside Stedio's
  responsibility once printed.

- Sex (PM-359, privacy text 2026-11-21T17:30:00Z): asked with the date of birth (female, male, prefer not to say),
  stored in the profile answers (exported and deleted with the profile), in the profile change history; the companion's
  context gets only "sex female" or "sex male" (`ai/context.py` `about`), under the existing AI consent. Purpose:
  things that differ by sex, such as the menstrual cycle. Lawyer to confirm the wording with the rest (G-05).
