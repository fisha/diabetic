# Design gaps, conflicts and decisions

The design deliverable is the Claude Design canvas, which is copied into `design/claude-design/`. The
engineering brief is `docs/handoff/Diabetes_Companion_Claude_Code_Handoff.md`. When the design and the brief
disagree, the disagreement is recorded here and is **not** resolved silently. Each item has a proposal, which is
the smallest change that fits the design, and a status.

Status values:
- **Decision needed**: Guy has to choose before the affected screen is treated as settled. Unaffected work continues.
- **Proposed**: an engineering or native adaptation. It is reversible and needs no product decision, so it will be
  applied unless Guy objects.
- **Blocked**: waiting on an external input such as clinical copy, a provider or credentials.

## A. Conflicts between the design and the brief

### G-01 · There is no Apple Health or Health Connect connection screen (**approved by Guy, 11 Nov 2026**)

**Conflict**
- The brief (§8 and Stage 4) promotes HealthKit and Health Connect into "existing connection screens".
- The design's Devices area (SET-04 and SET-05) only covers vendor devices: MiniMed 780G, Guardian 4 and the
  others. It labels them all "Planned" and has no Apple Health or Health Connect entry.
- Onboarding (ONB-11 and ONB-12) records the equipment but has no health-data permission step.

**Proposal**
- Add one row to SET-04, "Apple Health" on iOS and "Health Connect" on Android. It opens the existing SET-05 device
  detail layout and reuses SET-05's states: none, explain, connecting, connected, stale, partial (needs one more
  label), failed, disconnected and revoked.
- Do not add an onboarding step. The connection is offered later from Profile, in context.

**Why it is needed:** without this there is no designed place to ask for health permissions in Stage 4. The
Stage 2 spike does not need the UI.

### G-02 · The minor, guardian and "who is setting up" steps conflict with the adult-only scope (**approved by Guy, 11 Nov 2026**)

**Conflict**
- The brief (§4) says the initial audience is adults, and pediatric and caregiver workflows need a separate
  specification.
- The design has ONB-02 ("Who is setting up: self, parent, guardian") and ONB-05 (a minor and guardian step, with
  the guardian card labelled Planned).

**Proposal**
- Remove ONB-02 from the runtime flow.
- Keep ONB-04 date of birth. Under 18 shows ONB-05 as an "not available yet for under 18" stop screen, using the
  existing layout without the guardian card.
- Store nothing beyond the age-gate result.

**Alternative:** keep both steps as designed, but behind a disabled feature flag.

**Applied in 2.5:** the under-18 stop screen without the guardian card or "notify me". Correction found while
building: board 14 lists ONB-02 as "Who is setting up", but the Onboarding board has no such choice. Its step there is
"What your companion does" (can / can't, emergency number). That step has nothing to do with minors and carries the
safety limits, so it is kept. The only guardian elements were on the minor screen, and they are removed.

### G-03 · Populated states use demo data, and many screens lack an approved empty state (**approved by Guy, 11 Nov 2026**)

The brief (§3) says a new account starts empty and shows approved empty states.

**Empty states the design supplies**
- Overview: `isNew` and `chartEmpty`
- Journal: `empty`
- Memory: `noMem`
- Check-ins: `noUpcoming`
- Insights: `fbNone` is feedback only and is **not** an empty insights list
- Meal recents: none

**Missing empty states, with proposals**

| Screen | Proposal |
|---|---|
| COM-03 context card with no reading yet | Hide the card. The orb and greeting stay. |
| COM-11 history with no conversations | One line, "Nothing here yet". Reuse the Journal empty style. |
| OVR-03 insights list with no insights | Reuse the Overview `isNew` copy pattern: "Insights appear after a few days of records". |
| OVR-02 week/month with no data | Reuse the existing `d.na` "not enough data" bars. |
| MEAL-01 recent meals list | Hide the section. |
| WD-01 to WD-05 web dashboard, all empty | Reuse the `d.na` bars and a table "No records in this period". |
| RTN-01 familiarization day 1 with nothing learned | Reuse the "What I've learned" card with "Nothing yet". |

Each of these needs approval before it is treated as settled UI (brief §2).

### G-04 · Services that are not configured have no designed disabled state (**approved by Guy, 11 Nov 2026**)

The brief (§3) says actions that cannot work yet must be explicitly unavailable.

**Where the design has no such state**
- Voice (COM-01): `unavail` exists, but it is styled as a temporary outage.
- Meal analysis: `down` exists as an outage.
- Billing (SUB-02).
- Voice previews (ONB-17).
- Export and delete jobs.
- Device connect.

**Proposal**
- Reuse the existing outage states with a neutral copy variant: "Not available in this build".
- For meal analysis, keep "Describe" and "Enter manually" active.
- On SUB-02, show plans with the buy button disabled.

### G-05 · Clinical copy is placeholder (blocked)

**Affected copy**
- COM-06 low reading panel
- The `sys.disclaimer` string
- Insight disclaimers
- Escalation wording

Board 13 marks all of it "Clinical review". The brief (§10) says not to invent thresholds or escalation text.

**Proposal**
- Ship the panel structure with the copy key wired.
- Release builds refuse to show any string still marked `needsClinicalReview`. Development builds show it with a
  visible "Clinical review" label.

**Needs:** reviewed text from a clinician for each market.

### G-06 · Clinical thresholds appear in the design (decision needed)

**Thresholds in the design**
- Time-in-range band 70–180 mg/dL
- "Days under 70 % sensor coverage are shown as not enough data"
- Stale reading after 15 minutes
- Glucose input range 20–600 mg/dL

**Proposal**
- Keep every value in one reviewed `clinicalConfig` file with a source note.
- Use the design values only as `UNREVIEWED_DEFAULTS`, until reviewed.
- Show the target band only when the user has set a target (see G-07).

### G-07 · Treatment defaults could look like the user's own settings (**approved by Guy, 11 Nov 2026**)

**Conflict**
- SET-03 and ONB-13 show demo ratios.
- The graph shows a 70–180 band.
- The brief (§7 profile) says not to create defaults that appear to be the user's treatment settings.

**Proposal**
- Ratios start empty, using the existing "Not set" state.
- The target band is hidden until the user enters a range in SET-03.
- The Overview graph keeps the axis labels without a band.

### G-08 · Only part of the copy is translated (decision needed on who translates)

**Current state**
- Onboarding and Companion are in EN, HE, AR and RU.
- Meal, Overview, Journal, Routine, Settings, Membership and the web dashboard are English only.

**Proposal**
- In Stage 2, extract every string into `packages/i18n`.
- Draft HE, AR and RU for the missing screens, all tagged `translation-review`.
- Native-speaker review before release.

This is copy, not new UI.

### G-09 · Avatars and equipment art are simple SVG drawings (decision needed)

**Conflict**
- The brief (§7) asks for "approved mature illustrated companions" and "approved illustrations" for equipment.
- The design has 4 simple illustrated avatars plus an orb. Equipment uses generic category glyphs (pump, patch,
  sensor, shell, pen), not product images.

**Proposal**
- Implement exactly these SVGs as the approved art.
- Do not use vendor product photos or logos, for trademark reasons.
- Swap in final illustrations later if Guy commissions them.

### G-10 · The voice catalog is a placeholder (blocked)

ONB-17 and SET-06 show "Voice A, B, C". The brief says not to invent voices or language support.

**Proposal**
- Render the list from the provider catalog API once a provider is chosen.
- Until then, the step shows the G-04 unavailable state and keeps the conversation language choice.

## B. Inconsistencies inside the design

### G-11 · The screen ids in the board files differ from the inventory board (proposed)

**Examples**
- Onboarding.dc.html comment "ONB-02 Consent" is ONB-01 on board 14.
- Companion "COM-03" is history in the file but the context card on board 14.
- Settings "SET-02" is treatment in the file but SET-03 on board 14.

**Proposal**
- Board 14 ids are canonical. `docs/design-inventory.md` maps both.
- Test ids use the canonical ids.

### G-12 · The web dashboard has no sign-in screen (**decision taken, 11 Nov 2026**, under Guy's "build everything, ask at the end")

**Conflict**
- The website nav has "Sign in", and the dashboard shows "Signed in as …".
- No web sign-in, recovery or session-expired page is designed.

**Proposal**
- Reuse the mobile AUTH-02..05 layouts in a centred 440 px card on the web. These are the same fields and copy.

**Implemented**
- A centred sign-in card with the mobile fields and copy. The session is kept in memory only, so a reload or a new
  tab signs out. Nothing about the session is stored in the browser. Recovery keeps its G-04 state (no email
  provider). To revisit: a secure HTTP-only cookie once the API is hosted.

### G-13 · Theme setting: "System" option missing (proposed)

**Conflict**
- SET-08 offers Day and Night, and its helper text says "Follows your phone's setting by default".
- There is no way to go back to following the system once Day or Night is picked.

**Proposal**
- Make it three chips: System, Day, Night.
- Default to System.

### G-14 · Quick log entry point (proposed)

**Conflict**
- Components.dc.html describes a centre "Log" button in the tab bar.
- The phones (the reference) show 4 tabs and open Quick log from the Companion quick actions and from the
  Overview and Journal header "+".

**Proposal:** follow the phones.

### G-15 · Device selection lists named products (decision needed later)

**Conflict**
- ONB-11 and ONB-12 list MiniMed 780G, Omnipod 5, t:slim X2, mylife YpsoPump, Guardian 4, Dexcom G7 and
  FreeStyle Libre 3 with model numbers.
- The brief (§7) says selecting equipment never implies a connection. The design follows that.

**Proposal**
- Keep the catalog as server-side data so it can be corrected without a release.
- Before release, legal should review the use of product names.

### G-16 · Contrast below the handoff's own thresholds (decision needed)

**Conflict**
- The design handoff requires 4.5:1 for body text and 3:1 for large text and graphical marks.
- `pnpm --filter @steady/tokens contrast` measures these pairs from `tokens.json` below that:

| Theme | Pair | Use | Measured | Needed |
|---|---|---|---|---|
| Day | `below` #E39A72 on white | glucose mark | 2.30:1 | 3:1 |
| Day | `inrange` #7FA6C9 on white | glucose mark | 2.56:1 | 3:1 |
| Day | `above` #B597D3 on white | glucose mark | 2.52:1 | 3:1 |
| Day | `tertiary` #8E8E93 on `group` #F5F5F7 | tertiary text | 2.99:1 | 3:1 |
| Night | white on `accent` #14958D | primary button label | 3.68:1 | 4.5:1 |

**Proposal** (colours checked with the same script)
- Day glucose marks: below #C26A3D (3.87:1), in range #5A86AE (3.85:1), above #9572B8 (3.91:1). The night values
  stay as they are, so the hue would differ between day and night. That changes the handoff rule "glucose marks keep
  their hue in both modes".
- Day tertiary: #86868B (3.33:1 on group).
- Night accent: #0F837C (4.61:1 with white).

Until Guy decides, the tokens are implemented exactly as designed. The check lists these 5 pairs as known (G-16)
and fails on any new failure.

### G-17 · Button colours on board 12 that are not tokens (proposed)

**Conflict**
- The destructive button uses #FBE9E4 / #8A2A12 by day and #42241C / #E6A08F at night. In tokens.json those day values
  are only the "clinical" annotation label, and the night values differ.
- The disabled button uses a warm beige (#E7E2D9 by day, #453F35 at night) left over from the earlier direction. It
  is not in tokens.json.

**Proposal (implemented, reversible)**
- Destructive: `dangerBg` / `dangerText`, generated from `color.label.clinical-*`. The text contrast is 7.4:1 by day and
  8.1:1 at night (#F1AE9C on #3C1F18).
- Disabled: `surfaceFill` with `tertiary` text, which are neutral tokens in both themes.

### G-18 · Meal, Overview and Journal states without a service (proposed)

- "Use this photo" while the food provider is not connected reuses the "service down" layout (MEAL-04b) with the
  text "Photo analysis needs the food provider, which isn't connected yet. The photo wasn't sent or saved." and the
  actions Enter foods manually and Retake photo. The board's "Try again" is left out because it cannot succeed.
- Find foods (MEAL-10), food search (MEAL-06/07) and Save meal show the G-04 banner; the typed text and the items
  stay on screen.
- Recent meals (MEAL-01) are hidden while there are none; the board shows two examples.
- The insight detail, summary, journal entry detail and edit, analyzing and saved screens have no runtime route
  yet, because nothing can open them without data. They exist as components and in the dev previews.
- The saved screen's companion line and meal name ("Lunch") come from the companion and the meals API; the preview
  uses the board's text.

### G-19 · Settings, Routine and Membership without services (proposed)

- The account card on SET-01 says "Not signed in" instead of a name and email, because accounts are not connected.
- Diabetes profile and treatment edits reopen the onboarding steps instead of the board's inline editors. Same
  fields and validation; the inline editors can follow once a profile API exists.
- Check-in frequency uses the three onboarding answers (only when I start, a few times a day, more at first) instead
  of the board's Fewer / Balanced / More while learning, so onboarding and settings agree. Needs a decision.
- Increase contrast is shown disabled: the design has no high-contrast palette.
- Membership has a runtime state the board does not have: "Membership isn't set up yet" (no trial, no billing).
- The snooze, change-time and pause sheets, the paused banner and the clear-all memories dialog are not built yet,
  because nothing can be snoozed or paused without the check-in service. They will be built with Stage 3.
- RTN-07 (lock-screen notification) is Stage 3. G-13 (System theme option) is still open.
- The annual plan's "[SAVING]% less" line is left out until real prices exist.

### G-20 · Website and dashboard without services (proposed)

- Store buttons are shown disabled with "Steady isn't in the App Store or Google Play yet." The board links them.
- Prices and the trial length are open, so the membership card says they aren't final. The board's
  "[PRICE_…]" placeholders and the 14-day trial line appear only in preview builds.
- The support email (support@[domain]) is left out until there is a domain.
- The dashboard has no sign-in (G-12): a "Not signed in" card replaces "Signed in as Dana K." and every section
  shows an empty state. The board's demo figures are not shown.
- The footer text uses a fixed light grey: the board's `--line` is unreadable on the night footer.
- At phone width the dashboard navigation stacks above the content, as the board's flex layout does. A compact
  phone navigation is not designed.

### G-21 · Solid destructive button colour (proposed)

The boards draw "Delete account permanently", "Delete entry" and "Remove all" with a solid red `#B5371A`
(disabled `#E3B5A6`). Neither colour is in `tokens.json`, and no night value exists. The app uses the soft danger
tokens (`dangerBg` / `dangerText`). Proposal: keep the soft style, or add `danger` and `dangerDisabled` tokens with
night values checked for contrast.

### G-22 · Stage 3 states the boards don't show (proposed, implemented)

- Account errors on AUTH-02/03/05: wrong email or password (one message, so it doesn't reveal whether the email
  exists), email already registered, no connection, server error. Shown as an error banner above the fields
  (`onb.a_e_*`, 4 languages, translation review pending).
- A failed journal reload keeps the entries already shown and says nothing; a first load that fails shows the empty
  journal. Proposal: a small "Couldn't refresh" note, to design.
- JRN-06 correction edits glucose in mg/dL only (as the board), so a reading entered in mmol/L becomes mg/dL in its new
  revision; the original stays in the history. The reason chips are not sent: the API has no reason field yet.
- The onboarding draft is kept per device, not per account: another account signing in on the same phone would see
  it. Proposal: clear the draft on sign-out once the profile is saved, or key it by account.
- ~~Delete and "hide from summaries" in the entry detail still show the G-04 note.~~ Both work since the records
  slice (soft delete, hide).

### G-23 · Conversation and follow-up states the boards don't show (proposed, implemented)

- Notes (symptoms and free text) appear under the Journal's "Companion" filter, next to check-ins, because the boards
  have no Notes filter. Proposal: keep, or add a Notes chip.
- Check-in suggestions from the companion and the answer chips on a follow-up notification are not drawn; they use the
  existing chip and card components.
- The text shown when a reply is withheld because it read as a dose recommendation is placeholder copy and needs
  **clinical review** (G-05). Nothing about doses is ever shown.

### G-24 · Meal analysis (proposed, implemented)

- Provider: OpenAI vision through the server, instead of LogMeal or Passio. One provider for the companion, voice and
  photos, and no second contract. Food search uses USDA FoodData Central.
- The board's analysis step 3 is merged into step 2: progress shows only what really happened (upload, then
  analysis), never a timer.
- A meal in the journal is titled by its carbs ("Meal ≈ 45 g carbs"), with the foods in the detail, because
  the board's titles ("Lunch") are sample text with no source in the record.
- A food of your own can be added only when search has no matches. Proposal: also offer it under the results.
- Dictation on the description screen is wired to the voice transcription service (Dictate, then Finish).

### G-25 · Insights without a target range (proposed, implemented)

- Insights need the person's own target range from onboarding. Without one, Overview and Insights show
  `ins.no_band` ("set your range") instead of patterns.
- The counting rules (a pattern is recurring when seen on at least 3 days and on at least half of the days with
  readings in 14 days; a first impression when seen on 2) are product rules, not clinical thresholds. Wording needs
  clinical review.

### G-26 · Voices and live conversation (**decided by Guy, 11 Nov 2026**, implemented)

Guy asked for the voice conversation to run on OpenAI's live model, in the voice and with the name the person chose,
knowing the person's name, greeting by time of day and asking questions. Done as follows:
- **Voice choice** (ONB-17 and SET-06): the provider's own voices (Marin, Cedar, Alloy, Ash, Ballad, Coral, Echo,
  Sage, Shimmer, Verse), the ones both the speech and live models offer, with "Play a sample" (a fixed sentence with
  the companion's name). This replaces G-10's placeholder catalog. Default Marin.
- **What the companion calls you** (ONB-18 and SET-06): a new optional field, not on the boards.
- **Greeting and initiative**: the prompt greets by the person's local part of day (morning 05-12, afternoon 12-17,
  evening 17-21, night) and asks one short open question at a time, never about doses.
- **Live conversation** (OpenAI GPT-Live, `gpt-live-1`, as in mixmaster-pro's Maya; moved from gpt-realtime after the
  first real try got no answer) in the web build: Talk opens a conversation the companion starts, the person
  talks freely and can interrupt (Stop), Finish ends it. Every reply is held on the server until its words pass the
  dose check, so a reply starts about one reply-length later than raw live audio would. Turns are stored in the
  thread like text. Phones keep one spoken turn at a time, in the chosen voice, until a native audio streaming module
  is added in a dev build.
- Echo: in a browser the phone's own echo cancellation keeps the companion from hearing itself; on a loudspeaker it
  can still cut itself off. To check on Guy's phone.

### G-27 · Export and photo keeping details (proposed, implemented)

- PDF column headings are partly English (for example `value_mgdl`), so other apps and clinicians read the same names
  as the CSV. Proposal: translated headings in the PDF only.
- "Notify me when ready" sends no push yet (no push credentials); the export screen shows the file when it is ready.
- "Delete after analysis" deletes the photo as soon as the meal is saved; "Keep 90 days" is enforced by the worker.

### G-28 · Apple Health and Health Connect screen (proposed, implemented)

The device detail board shows a vendor sign-in. The health store connection uses the same screen with its own words:
- Connect, then "Before you connect" (what is read, from when, and that nothing is written), then the system
  permission sheet, then Connected with the last sync and how many readings it added.
- Refused permission shows "Not connected" with "Open {store} settings". Apple Health never says whether reading was
  refused, so after a sync with no readings the iPhone screen adds a note on where to check.
- A web browser or a phone without the store shows "Not available" with "Log a reading".
- Disconnect asks the board's keep / remove question. Disconnecting stops reading; the system permission stays until
  the person removes it in the store. Readings removed this way don't come back when connecting again.
- Readings are labelled with the store ("Apple Health", "Health Connect") in the journal, overview and dashboard. A
  source that writes every few minutes is treated as a sensor; other readings as a meter.

## C. Native adaptation (proposed)

| Topic | Design (web prototype) | Native implementation |
|---|---|---|
| Phone frame | 390 × 844 with 54 px top padding | `react-native-safe-area-context`; layouts flex to any width from 320 to 430 pt. Tablet is out of scope until designed. |
| Text size | 3 fixed steps (16/20/24 base) | `allowFontScaling` with Dynamic Type / font scale up to 200 %. Layouts are checked at 100, 130, 160 and 200 %. |
| Bottom sheets | CSS slide-up, scrim tap to close, "Discard this entry?" | `@gorhom/bottom-sheet` with keyboard handling via `react-native-keyboard-controller`, Android back closes, the same discard dialog |
| Charts | SVG with absolute-positioned hit areas | `react-native-svg` paths. Scrub uses a gesture-handler pan plus accessibility hourly focus points. Time axis is always left to right. |
| RTL | `dir` attribute per board | `I18nManager.forceRTL` requires an app reload when the direction changes. The language screen warns before reloading. |
| Day / Night | CSS variables switched by `data-theme` | `useColorScheme` plus the user override, through a ThemeProvider of tokens |
| Fonts | System stack with web fallbacks | The platform system font in the app (no bundled fonts). Web: system stack with Inter, Rubik and IBM Plex Sans Arabic from Google Fonts (OFL). |
| Font weight 650 | Variable-font weight 650 for titles | React Native accepts only the standard weights, so 650 renders as semibold (600) natively. The web keeps 650. |
| Haptics, captions | Toggles | `expo-haptics`; captions come from the provider transcript stream |
| Notifications | Lock-screen mock | `expo-notifications` categories with actions. Content is generic by default (no glucose values on the lock screen). |
| Purchase sheet | HTML mock | Native StoreKit / Play Billing sheet. Not app UI. |

## D. Missing assets

- The app icon, splash screens (day and night) and store artwork are not designed.
- Illustrations for empty states: the design uses text and icons only, so none are needed.
- The orb animation exists only as CSS keyframes (breathe 6 s, listen 1.6 s, speak 0.9 s). It will be reproduced
  with Reanimated, and no Lottie file is needed.

### G-29 · CareLink connection (**decided by Guy, 11 Nov 2026**, implemented)

Guy asked for MiniMed pump and sensor data through CareLink, with the CareLink username and password entered where
devices are chosen. Medtronic has no public API, so the connection is unofficial (the way the CareLink Connect app signs
in). Guy asked (11 Nov 2026) not to show the "unofficial" note to the person, so the screen no longer carries it. New row on SET-04 "MiniMed · CareLink" and a screen on the SET-05 pattern: username,
password, region (outside the US / US), Connect; when connected, the last reading, the pump model, Sync now and
Disconnect (keep or remove imported readings). Not on the boards. Readings are labelled "CareLink" like Apple Health ones.
The EU sign-in page carries a captcha. Guy chose (11 Nov 2026) to also have a sign-in on CareLink's own page, where he
answers the captcha himself (nothing tries to answer or avoid it): "Sign in on CareLink's page" opens the page in the
phone app (WebView, needs the development build) and hands back the address CareLink returns; on the Mac,
`scripts/carelink_browser_sign_in.py` does the same in a browser window. After that the server keeps the connection by
refreshing its token; if CareLink ends it, the screen asks to sign in on the page again.

### G-30 · Latest reading above the companion's talk button (**requested by Guy, 11 Nov 2026**, implemented)

Not in the boards. The Overview's latest-reading card (value, unit, time, age, source such as CareLink) is shown above
the talk button in voice mode, only when a reading exists.
