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

Deviation from the brief (section 8, device-account passwords and unofficial connectors): Guy explicitly accepted the
unofficial connection, including the encrypted saved password path, on 11 Nov 2026 ("מקובל עליי").

### G-30 · Latest reading above the companion's talk button (**requested by Guy, 11 Nov 2026**, implemented)

Not in the boards. A small centred pill fixed under the header (value and unit; time, source and age), only when a reading
exists; one line while a conversation is going or in text mode (Guy's follow-up, 11 Nov 2026).

### G-31 · Pump alerts and messages on the CareLink screen (**Guy's request, 11 Nov 2026**, implemented, review pending)

Not in the boards. CareLink sends only fault ids; texts come from paul1956/CareLink's MIT-licensed English table and
include the pump's own clinical wording (alerts, limits). Shown as the pump's words with the code and a note that they are
unreviewed. Needs the clinical review (G-05) and translations before a release.

### G-32 · Insights range from the pump's alert limits (**recommended to Guy, 11 Nov 2026; decision card open**, implemented)

With no target range typed, insights, time in range and the Overview legend use the low and high alert limits set on the
pump (CareLink `limits`, latest entry), labelled as such. A typed target always wins. Reverted if Guy picks "profile only".

### G-33 · Companion tab shows the breathing orb without a label (**requested by Guy, 11 Nov 2026**, implemented)

Replaces the board's small dot and "Companion" label: a 46 px orb with the companion's gradient and the idle breathing
motion (still with reduced motion). The tab keeps its accessible name.

### G-34 · Routine and meal patterns from the person's data (**Guy's "brain" request, 11 Nov 2026**, implemented)

`services/api/steady_api/routine.py`. Product rules, not clinical ones: last 14 days; a usual meal time needs meals in
that slot (breakfast 04-11, lunch 11-16, dinner 16-23) on 3+ days; a meal's insulin is the nearest non-automatic bolus
from 60 min before to 30 min after; the two-hour change uses the sensor reading nearest the meal (within 15 min) and
nearest two hours later (within 20 min); a pattern needs 3+ meals (timing: 3+ in each group, "before" = 10+ min early).
Shown as insight cards on the Overview (no range needed), given to the companion, and used for app check-ins: one per
meal slot per day when the usual time passed by 1-3 h with no meal logged, within the person's frequency choice and
quiet hours, withdrawn if a meal is logged first. Correlation only; worded as such. Needs the clinical review (G-05).

### G-35 · Health store deletions and the "not updated" state (proposed, implemented)

Brief section 8 asks for imported-record corrections and deletions and an honest stale state. Each sync sends its
readings in batches, each with the stretch of time it covers; the stretches run without a gap over the whole read
(the last day again, or 30 days on the first sync). A reading from that store inside a stretch that the phone no
longer has was deleted in the health app (an edit there is a delete plus a new sample), so it is removed here too and
the screen says how many. Readings the person corrected in Steady are kept. An empty read never removes anything,
because Apple Health returns nothing when reading is refused. The screen shows the newest reading's time apart from
the last sync time, and "Not updated since …" when the last successful sync is more than a day old (a product rule).

### G-36 · First days from the person's records (proposed, implemented)

RTN-01 now reads `GET /insights/familiarization` (`routine.familiarization`). Product rules: the first three local
days from account creation are "getting to know your routine"; a day card counts entries (records and readings, sensor
streams not counted); a meal time seen on 2 days is a first impression and on 3+ days fairly consistent, with "N of M
days" (M = days with any record). "Still unknown" lists the meal times not seen yet and whether there are no readings,
meals or insulin records (missing insulin records never mean insulin was not taken). The companion gets the same day,
first impressions and unknowns, and is told to ask about one missing thing at a time and to call anything a first
impression. Suggested check-in toggles and the first-days summary (RTN-02) stay empty: the app's meal check-ins come
from the routine (G-34) instead, and the summary needs its own decision.

### G-37 · Facts and impressions in memory (proposed, implemented)

Brief section 6 asks to store facts, hypotheses, preferences, treatment settings and pending tasks apart. Preferences,
routine and health facts are memory groups; treatment settings are the profile; pending tasks are follow-ups. A
hypothesis is a memory with kind "impression": the companion saved its own impression (`remember` with
`stated=false`). Routine > Memory shows it as "{name}'s impression, not confirmed" with the same Edit and Remove;
editing it makes it the person's fact. The companion gets impressions in their own list, told not to treat them as
facts and to check one with the person when it fits. Migration `c3d4e5f6a7b8`.

### G-38 · Routines, the meal before/after wording and the estimated A1c (**Guy's request, 11 Nov 2026 night**, implemented)

Guy: "insights are the key"; find routines and say what to do. `services/api/steady_api/findings.py`, product rules:
14 days; a routine needs 3+ meals or days. Foods: by item name, with a reading at the meal (within 15 min) and two
hours later (within 20 min); "usually above your range" when at least half end above the person's own range high,
"usually in range" when more than half end in it. Late meals: 21:00 to 03:00 on 3+ days; mornings (05:00-08:00) after
them against other mornings. Pump: CareLink alerts kept in `device_events` (suspend on/before low 803/809/811; high
alerts 816/817/823/3.330/3.335; leaving automatic mode 819-841) on 3+ days, at the time of day they gather. Good: insulin
at least 10 minutes before eating on more than half the meals with insulin; a time of day in range on more than half of
its days. Advice is fixed text: check the carb count, and talk with the care team about the insulin for it; never an
amount. Meal patterns now say the middle value before and two hours after ("before lunch around 160, two hours later
230"). Estimated A1c: the published GMI formula (3.31 + 0.02392 x mean mg/dL) over the longest of 90/30/14 days with
70 % of sensor readings, labelled an estimate. All of it goes to the companion as [good]/[watch] lines with the mentor
instruction to praise first and coach one thing. Needs the clinical review (G-05).

### G-39 · All Apple Health / Health Connect types (**Guy's request, 11 Nov 2026 night**, implemented-unverified)

Besides glucose the phone reads heart rate, resting heart rate, heart rate variability, steps, active energy, walking
distance, weight, dietary carbohydrates, insulin delivery (Apple Health only; basal or bolus), oxygen saturation,
sleep stages and workouts, each with its own permission, and sends them to `POST /health-data/samples` in windowed
batches (deletions follow as for glucose). Kept in `health_samples` with the store's ids, units and source app;
removed with "Remove imported readings". The companion gets the last day's steps, active energy, workouts, latest
heart rate, resting heart rate, sleep and weight, and the heart rate at each insulin record today (Guy's example).
"Before you connect" gains one line on what else is read. Not yet shown on its own screen and not yet used by the
routines; that needs data from a phone first. iOS and Android bundles build; nothing ran on a device.

### G-40 · Lock-screen widget: this hour of the day (**Guy's request, 11 Nov 2026 night**, implemented-unverified)

Not in the design; Guy asked for it. An iOS WidgetKit target (`apps/mobile/targets/widget`, through
`@bacons/apple-targets`) for the lock screen (rectangular and inline) and the home screen (small). For each local hour
the app writes one line into the shared App Group, from `GET /insights/hours` (the last 14 days at that hour, each
day by its middle value): "Often above your range around now: 3 of 4 days", "Usually in your range…", "Often below…",
or "Not enough readings at this hour yet" (fewer than 3 days). Words only, no glucose values, because the lock screen
is visible to others (brief section 9). The widget moves to the next hour's line by itself; the lines are refreshed
when the app is opened. It needs a new development build (native code) and the App Group capability, which EAS adds.
Android has no widget yet.

### G-41 · Lock-screen Live Activity: this hour's line on its own (**Guy's request, 12 Nov 2026**, implemented-unverified)

Not in the design; Guy asked for a card that appears on the locked phone without adding a widget ("כמו סוג של push
אבל מעוצב אחר"). An iOS Live Activity: when the person leaves the app, it shows the widget's line for this hour (G-40,
words only) with a bar that runs to the end of the hour, on the lock screen and in the Dynamic Island. Opening the
app refreshes it. It is not an alarm and carries no reading, so it cannot pass for a CGM alert (brief section 8).
`expo-live-activity` 0.4.2 starts it (its own config plugin clashes with `@bacons/apple-targets`, so only its native
module is used); the view is `targets/widget/HourActivity.swift` in the existing widget target, with a copy of the
module's attributes type. Limits: iOS ends it after 8 hours at most, it cannot change hour by itself without Live
Activity pushes from the server (APNs, not built), and if the person swipes it away it stays away until the next
day. iOS Settings can turn Live Activities off for Steady. Needs a new development build; not built in Xcode or run on
a phone.

Update, 12 Nov 2026 (Guy's requests): the card now leads with the latest reading as it was when the app was left
(value, unit, the person's range tag, its time and a running "x min ago" that iOS counts, so an old value reads as
old). This departs from the brief's "no glucose values on the lock screen" at Guy's explicit request; anyone who sees
the phone can read it. The hour line became a three-hour part of the day (`GET /insights/hours?span=3`, eight parts
from "late night" 00-03 to "night" 21-24, each with an SF Symbol sun or moon) with a bar to the end of the part.
Colours are the app's tokens; no red and no urgency. The reading travels as JSON in the module's `imageName` field and
the icon in `dynamicIslandImageName` (the module's state has no other free fields). Swift not compiled here; needs
the new build.

### G-42 · Kept insights, follow-up updates and insight pushes (**Guy's spec, 12 Nov 2026**, implemented-unverified)

Guy's 12 Nov 2026 spec: insights analysed in the background with no goals, questionnaires or logging required; one
server source of truth for the app and the website; pushes separate from insight generation. Additions only; the
existing screens, navigation and flows are unchanged.

Server (`services/api/steady_api/tracking.py`, tables `insight_topics`, `insight_updates`, `insight_pushes`,
migration `c4d5e6f7a8b0`):
- Each insight key is one topic per person, with a status (active, ended, insufficient, corrected), first seen,
  last seen, changed, version, and provenance: sources, the period checked, when it was analysed, data completeness
  (share of days with readings) and certainty (low, medium, high from the days or meals it rests on and coverage).
- Updates: `new`, `changed` (the fingerprint moved), `continuing` (a periodic follow-up), `ended` and `corrected`.
  Each has a dedupe key, so reruns and retries never make the same update twice; a follow-up's key carries its date,
  so it is never blocked as a duplicate of the first finding.
- A follow-up is made only when the interval has passed and there is fresh data: at least 7 of the recent days with
  data covering 50% of them. Without fresh data nothing is said to continue, end or be stable. A pattern is called
  ended only when the recent data was sufficient; otherwise its status is `insufficient` and no update is made.
- Editing, deleting or hiding a reading or record marks a correction; dependent topics that change or disappear are
  marked `corrected` (shown, never pushed).
- The first analysis for someone is a baseline: listed, never pushed.
- Read state: `POST /insights/{key}/state` (`seen` or `read`, via `app`, `web` or `push`). A push is never a read.
  Unread means not read since the last change or update. `GET /insights` returns `topics` and `analyzed_at`;
  `GET /insights/updates` lists updates with their push state.
- Pushes (`push_due`): only `new`, `changed` and `continuing`; skipped when the topic was already read, when pushes
  are off, during quiet hours (the person's check-in quiet hours, else 21:00-08:00 in their time zone), above the
  weekly cap, or within 20 hours of the last insight push. Several pending updates go as one digest. An update not
  sent within 3 days is dropped, not resent. The text is generic, with no values; the data carries the insight key
  (or the list for a digest), and a tap opens that insight (the app's Overview then the insight).
- The worker analyses everyone due every 6 hours (`RUN_EVERY`), whether or not the app is open.

Defaults and where to change them:
- Follow-up interval per topic: 14 days. Person: Settings > Notifications (app) or the settings page (website),
  7, 14 or 30 days (`insight_interval_days`, API accepts 7-60).
- Insight pushes a week: at most 2 (`insight_push_week_cap`, 1-7; the screens offer 1, 2, 3). Pushes on by default
  (`insight_push`).
- Code constants in `tracking.py`: `RUN_EVERY`, `FRESH_DAYS`, `FRESH_COVERAGE`, `MIN_PUSH_GAP`, `PUSH_MAX_WAIT`,
  `DEFAULT_QUIET`.

App and website: a "New" or "Updated" tag on unread cards, the latest update line ("Follow-up from ...: also seen in
the N most recent days with data"), a "Where this comes from" block, the last-analysed time (marked when older than a
day) and a note when unread topics were corrected or ended. The app marks an insight read when its detail opens; the
website when "Where this comes from" is opened. Not in the design: the tags reuse the existing badge, the rest is
footnote text in the existing cards. Push delivery to a phone is untested end to end.

### G-43 · Daily progress check and small wins (**Guy's request, 12 Nov 2026**, implemented-unverified)

Guy asked for a daily automatic check of the person's progress and a gentle celebration of small wins, in the app and
on the website, inside the existing insights. Additions only: a win card in the existing insight card look on the
Overview (app) and the Insights page (website), a confetti burst, and one setting.

Server (`services/api/steady_api/progress.py`, tables `progress_checks` and `achievements`, migration
`d5e6f7a8b9c1`, `GET /progress`, `POST /progress/{id}/state`):
- Once a day per person (worker, or on opening), for the last complete local day: that day against the day before,
  and the last 7 days against the 7 before; every result is kept (`progress_checks`).
- Measures: share of readings in the person's own range, share below it, and low episodes (3 readings in a row below
  the range, at most 15 minutes apart). The range is the typed one, else the pump's or CareLink's. Lower glucose is
  never progress by itself.
- Fair or nothing: a day counts with at least 70% of a sensor's readings; a week with at least 5 such days. Missing
  data is never progress, stability or decline.
- Wins (product defaults in `progress.py`, not clinical targets; for clinical review):
  - a better week: time in range up at least 5 points;
  - less time below: down at least 1 point and at least a third, from at least 2%, with time in range not falling more
    than 2 points;
  - a good day: at least 10 points above the day before and 5 above the previous week's mean (one good day against one
    bad day is noise);
  - steady: 4 fair weeks within 5 points of each other with time below not rising; said as steady, not as progress,
    and not counted as improvement.
- Safety gate: in the same comparison, more time below the range (over 0.5 points) or more low episodes blocks every
  win; the check records that it was blocked.
- Words say what was measured, over which days, on how many full days, and that it does not show the cause. No meals,
  no insulin, no "thanks to us", no score; nothing at all on days without a win.
- Duplicates: each win has a unique dedupe; a week win at most once a week, steady once per 4 weeks; reruns change
  nothing. A correction (edit, hide, delete) re-checks the last 14 days and withdraws wins no longer supported.
- Pushes: only the week wins, through the insight push policy (G-42: off switch, quiet hours, weekly cap, 20-hour gap,
  digest), generic text with no values ("Something went well this week"); never when the win was already seen or was
  withdrawn. Daily wins and steady stretches are shown, never pushed.
- Celebration: a week win gets a short confetti burst once, in whichever interface opens it first (kept on the
  server); off with the "Celebrate small wins" setting (app Settings > Notifications, website settings), and never
  with the system's reduce-motion setting.
- Internal KPI (`progress.kpi`, `uv run python -m steady_api.progress --days 7`, counts only): of the people with
  enough data for a fair comparison in the period, the share with a supported improvement; also how many people
  checked had enough data (coverage) and how many wins safety blocked. It describes people's numbers, not that the
  app caused them.

### G-44 · View-only sharing and the admin page (**Guy's requests, 12 Nov 2026**, implemented-unverified)

Guy asked for a Settings option to let someone (a parent) view his data and insights in the app with no way to change
anything, and for an admin page on the website listing every account, with "view as" that is read-only except for
connecting devices. Neither is in the design; both reuse existing screens and look.

- Server: table `shares` (migration `e6f7a8b9c0d2`), `GET /sharing`, `POST /sharing/invites` (an 8-character code
  valid 7 days, one use), `POST /sharing/accept`, `DELETE /sharing/{id}` (owner removes, or viewer leaves).
- Viewing: requests carry `X-View-As: <owner id>`. The server (`deps.current_user`) answers as the owner only for an
  accepted, unrevoked share and only GET on the data paths (glucose, records, insights, progress, health samples,
  profile, settings, follow-ups); anything else is 403 `view_only`. `/auth/*`, `/sharing*` and `/admin*` are always
  answered as the signed-in account. The app and website hide edit controls too, but the server is what enforces it.
- Admin: `STEADY_ADMIN_EMAILS` (comma separated, in `services/api/.env` on the Mac, never in the repository).
  `GET /admin/users`; an admin may view any account with the same read-only rules, plus any method on
  `/devices/carelink|dexcom|libre` to connect that account's devices. `/auth/me` returns `is_admin` so the website
  shows the Admin page only to admins.
- App: Settings > Sharing (invite, send the code with the system share sheet, remove; enter a code; view). While
  viewing, the tabs show the owner's Overview, Journal and insights with a "view only" bar; logging, editing, the
  companion, health sync and follow-up scheduling are off; the profile tab offers "Back to my own data". A parent
  without a profile of their own can reach it from sign-up ("I have a code to view someone's data").
- Website: Settings has the sharing section and device connections; a "view only" bar while viewing; settings shown
  disabled; export only by the owner; read marks and celebrations are not touched by a viewer.
- No alerts are sent to viewers (said on screen; the sensor maker's follower app is for alarms).

### G-45 · Dexcom and FreeStyle Libre, unofficial (**Guy's decision, 12 Nov 2026**, implemented-unverified)

"לשניהם תעשה כמו שעשינו ל carelink בצורה לא רשמית כרגע רק לצורך הבדיקות". `services/api/steady_api/cgm_share.py`
and `routers/cgm.py`: Dexcom Share (the person's own Dexcom account; regions us, outside the US, Japan; Share must be
on with a follower) and LibreLinkUp (an account the person invited in the Libre app; regional redirect; terms to
accept are reported). Sign-in sealed like CareLink; the worker fetches every 5 minutes; readings saved with source
`dexcom` / `libre`, deduplicated across sources. Screens: app Settings > Devices (two new rows, a screen like
CareLink's), website Settings > Device connections. Tested only against stand-in servers (`test_cgm.py`); never run
against Dexcom or Abbott. Neither maker offers or approves this route and it can break at any time.

### G-15 note · App name

12 Nov 2026: Guy named the app **Stedio** ("תחליף את שם האפליקציה בכל המקומות גם באתר ל Stedio"). Every name people
see changed (texts in all languages, app display name, permission texts, widget and Live Activity, notification
titles, website). Technical identifiers stay as they are (bundle ids `com.fisha.steady.dev`, App Group, Expo slug,
package names, code identifiers), since changing them breaks installed builds and signing.
- First real LibreLinkUp try (Guy, 12 Nov 2026): refused as a wrong email or password although the same details work
  in the LibreLinkUp app. The answer was not logged, and the API returned 401, which the app reads as its own session
  ending, so it signed in again and sent the same sign-in to LibreLinkUp twice. Changed: a refused vendor sign-in is
  422 (`locked` 429 when LibreLinkUp asks to wait), LibreLinkUp's status, message, step and region are logged (never the
  email or password), the request headers follow the maintained nightscout-connect client (`llu.ios`, iPhone user
  agent), and the app's sign-in fields for Dexcom and Libre no longer invite iOS to fill in the password saved for
  Stedio. Waiting on Guy's next try for the logged answer.

### G-46 · Google sign-in, waitlist and email verification (**Guy, 12 Nov 2026**, implemented-unverified)

- Google sign-in: `POST /auth/google` with a Google ID token, checked against Google's keys, issuer, expiry, our OAuth
  client ids (`STEADY_GOOGLE_CLIENT_IDS`) and a verified email. Website: Google's own button (Identity Services,
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID`). App: `@react-native-google-signin/google-signin` (Google's native sheet, no in-app
  web view; `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, needs a new native build). A Google
  sign-in links an existing account with the same email; an unverified one loses its password then.
- Waitlist ("לגבי האתר… הרשמה לרשימת המתנה"): a new account waits (`users.approved_at`, 403 `waitlisted` on the data
  paths) until an admin approves it on the website's Admin page (`POST /admin/users/{id}/approve`), which emails the
  person when an SMTP sender is set; otherwise the page says no email was sent. Applies to accounts made in the app
  too, so the waitlist cannot be skipped. Existing accounts were approved by migration `f7a8b9c0d1e3`.
- Email sign-up: needs a verification code by email (`/auth/verify/send`, `/auth/verify`, 6 digits, 30 minutes, 5
  tries). Guy chose Google only for now, so email sign-up is closed (`GET /auth/options`, 503 `email_sign_up_closed`)
  until an SMTP sender is set. The website offers only Google for new people; existing accounts sign in as before.
- App account screens (Guy, 12 Nov 2026: "תכין את החיבוריות עם שם משתמש וסיסמה / גוגל באפליקציה"): Sign in offers
  Google (when the build has the native module and client ids) and email with password. Create account asks
  `/auth/options`: while email sign-up is closed it shows Google and the existing `onb.a_e_closed` note instead of the
  email form. The design's Apple button is not shown, because Apple sign-in has no provider yet.

### G-47 · Same meal from the app and the pump; repeated CareLink events (**Guy, 12 Nov 2026**, implemented-unverified)

Guy logged a meal in the app (estimate 55 g) and entered 40 g on the pump; the journal showed the pump's meal and
bolus twice each, and the meal as two meals.

- Repeated events: CareLink sends the same pump marker again with its time 1 s or more later on later syncs, so the
  time-based key let each copy in. An event of the same kind and amount within 90 s of one already kept (deleted ones
  included) is now the same event. Migration `a8c9d0e1f2b4` soft-deletes the copies already saved, keeping the first.
- Same meal: a CareLink meal entry from 45 min after to 20 min before a meal logged in the app is linked to it
  (`records.same_as`, nearest one). The journal shows one meal with both amounts and glucose at the meal and two hours
  later (or the time it will be shown); summaries, insights, routines and the companion count it once. The person can
  mark it "separate" or, on an unlinked pump meal near an app meal, "same meal" (the design's duplicate card, JRN-02);
  a link they set or removed is never changed automatically. `PUT /records/{id}/same-as`.
- Different carbs (product rule, for review): the pump's carbs differ from the app's estimate when they are at least
  10 g and 20 % apart. The meal then carries a note that it may be worth checking the carb count and that insulin amounts
  are for the care team. After three such meals in 14 days an insight "Fewer (more) carbs on the pump than estimated"
  shows glucose at those meals and two hours later, with the carbs and care-team advice. No dose or amount is suggested.
- The website shows such a meal once (the pump's copy is left out); it does not show the two amounts yet.

### G-48 · Settings that come from the pump are not edited in Stedio (**Guy, 12 Nov 2026**, implemented-unverified)

Guy asked whether the range, the insulin-to-carb ratio and other settings could be taken from the pump instead of typed,
and: "אם הוא כבר נלקח ואם עוד מידע שיש בהגדרות נלקח, אז צריך לא לתת למשתמש לערוך הגדרה שמגיעה ממשאבה או ממכשיר טיפולי."

- What CareLink gives (field names checked on the Mac, 12 Nov 2026): the pump's low and high alert limits, the
  time-in-range setting of the CareLink account (`tirSettings`), the maximum bolus and maximum automatic basal.
  It does not give the insulin-to-carb ratio, the correction factor (sensitivity), the SmartGuard target, active
  insulin time or the basal schedule, so those stay typed by the person.
- Target range: while the connected equipment gives one (the pump's alert limits, else CareLink's time-in-range
  setting, as before), it is the range used everywhere (insights, the day by hour, progress, the companion's context,
  time in range) and wins over a typed one. `GET /profile` returns it as `device_target`; the app's Treatment
  settings, the setup's ratios question and the website's settings show it with its source and no fields or Edit
  button. `PUT /profile` keeps the typed target as it was while the equipment gives one. Disconnecting the equipment
  brings the typed range back.
- The maximum bolus and maximum automatic basal have no place in the design's settings, so they are not shown (no new
  screen without approval).


### G-49 · A rolling 24-hour period; Google picture; companion picture in the header (**Guy, 12 Nov 2026**, implemented-unverified)

- Guy's pump showed 72% in range while the app showed 83%: the pump counts the rolling last 24 hours and the app's
  "Day" counted since midnight (same readings, same 70-180 range). At Guy's ask the Overview's periods are now
  24 hours, Day, Week, 2 weeks and Month in the app. "24 hours" is the rolling day ending now, drawn on the day graph;
  Day stays the calendar day. The website's Overview gains "24 hours" beside 14/30/90 days; it shows the figures for
  that window and leaves out the per-day bars (one rolling day has nothing to compare).
- An account that signs in with Google keeps the Google profile picture (`users.avatar_url`, migration `c2d3e4f5a6b8`,
  renewed at each Google sign-in, only https on googleusercontent.com). The app's Profile account card and the
  website's account box show it instead of the person icon. An account signed in before this shows it after its next
  Google sign-in.
- The companion screen's header shows the companion picture chosen in onboarding in place of the green dot, and the
  "AI companion" line under the name is gone at Guy's ask. Brief §4 (do not imply a human): screen readers still hear
  "AI companion" with the name, and the welcome screen states it in full (`onb.w_ai`).

### G-50 · "Update available" in the app (**Guy, 12 Nov 2026**, implemented-unverified)

Guy asked for the app to say when there is an update and offer a button, and approved a new iPhone build for it.
Not in the design; built as a banner over the top of any screen (the existing Banner component) with two buttons.
- A JS update published with `eas update` to the build's channel ("testers", "preview", "production"; set in
  `eas.json`) is offered as "Update available" / "Update now": it downloads and restarts the app. `runtimeVersion` uses
  the fingerprint policy, so an update never reaches a build whose native code differs. The app checks at launch and
  when it comes back to the front (at most every 30 minutes) and never downloads without the button.
- A newer native build is offered as "New version to install" with the install link from `GET /app/version`
  (`STEADY_APP_LATEST_BUILD` and `STEADY_APP_INSTALL_URL` in the API's `.env`; unset shows nothing).
- "Not now" hides it until the next check. Development builds (code from Metro) and the web show nothing.
- Publishing: `eas update` does not apply a build profile's `env` from `eas.json`; it bundles only the EAS environment
  named by `--environment` (plus local `.env`). Every `EXPO_PUBLIC_*` the app needs (API address, variant, Google
  client ids) must live in the EAS "preview" environment, or the update ships without a server (it happened on 12 Nov
  2026: the first two updates had no API address). The runtime is the app version (0.2.0); raise it with any native
  change.

### G-51 · Journal: one row per moment for pump events (**Guy, 12 Nov 2026**, implemented-unverified)

Guy: "כשיש בסורס הזנה של פחמימות זה צריך ... להספר כשורה אחת שיש בה אינסולין גלוקוז וארוחה". The board shows one row
per event. Now a pump meal joins the pump bolus within 5 minutes of it, and pump insulin (with its meal) joins the
CareLink sensor reading within 2.5 minutes, shown as extra lines in that row with their own icons; the row's icon is
meal, then insulin. The row appears under the glucose, insulin and meal filters. Its detail lists the merged events,
each opening on its own (edit, delete and hide stay per event). Entries the person typed keep their own rows. Pump
insulin also says how the pump gave it (CareLink activationType: automatic correction, bolus, manual bolus).
`mergeMoments` in `features/journal/model.ts`, tests in `test/journal.test.ts`.

### G-52 · Diabetes type 2, "no insulin", connections that fit the devices (**Guy, 12 Nov 2026**, implemented-unverified)

Guy: type should be type 1, type 2 and other; without type 1 the insulin topics may not apply; choosing MiniMed should
offer only CareLink among the data connections; the sensor is "FreeStyle Libre" without a generation number. Done:
the type step offers type 1, type 2, another type (an earlier "not sure" answer stays valid); the treatment step has
"I don't use insulin", which skips the insulin, pump and ratio steps; the app's Devices list offers CareLink for
MiniMed or Guardian, Dexcom Share for Dexcom, LibreLinkUp for FreeStyle Libre, all of them when no known device was
given, and always keeps a connection already made; the companion is told type 2 and not to assume insulin. Open,
waiting on Guy: questions specific to type 2 (medicines, for example) and extra profile topics (nutrition, fitness).

### G-53 · Lifestyle and medicine questions in the profile (**Guy, 12 Nov 2026**, implemented-unverified)

Guy chose "everything as recommended" on 12 Nov 2026. Three optional onboarding steps that are not on the board, all
skippable and with nothing preselected: `meds` (diabetes medicines other than insulin and how often glucose is
checked, shown only when the type is not type 1), `food` (eating style, sensitivities including celiac, protein
target) and `fitness` (kinds of training, usual times, goal). The routine step adds shift work and whether to take a
menstrual cycle into account. Review, the app's Diabetes profile and the website profile editor show and edit them.
The companion is told the answers as short facts (never advice on medicines). Insights that use them (late rise after
protein or fat, glucose around training) are a next step and need meal macros or workout data per kind.

### G-54 · Insights from protein, fat and workout kind (**Guy, 12 Nov 2026**, implemented-unverified)

Guy asked for the insights that use the new profile topics. Meals now store protein and fat (per food and in total,
the total only when every food has a value) from the photo or description analysis (the model now estimates protein
and fat per 100 g) and from USDA search (nutrients 203 and 204); nothing is shown on the meal screens. Two findings:
`late_rise`, the person's richer half of meals by protein plus fat against the other half, glucose change from two to
four hours after eating, shown when the richer meals rise at least 20 mg/dL more (a product rule) and still rise,
meals followed by another within four hours left out, at least 3 meals each; `workout`, per kind of activity done at
least 3 times in 14 days (logged or from Apple Health), the median at the start and an hour after it ended. Both point
to the care team; no amounts. Only meals logged after this update have protein and fat; pump meals never do.

### G-55 · The app itself as the website's personal area (**Guy, 12 Nov 2026**, implemented-unverified)

Guy asked for the personal area on the website to look exactly like the app, responsive, and chose the app itself
over a copy. The app's web build is exported with `EXPO_BASE_URL=/app` (`pnpm --filter ./apps/mobile export:website`,
into `apps/web/public/app`, before `next build`) and the website serves it at `/app` (route handler for `/app`,
fallback rewrite for deeper paths). The website's sign-in buttons open `/app`; the Next.js dashboard stays for the
admin pages. In a window at least 900 px wide the tabs become a side bar and the app sits in a centred frame (1120 px;
screens other than the tabs 720 px). Sign-in uses Google's own button (Google Identity Services, the website's web
client id). In the browser only the sign-in and whose shared data is viewed are kept in localStorage (health data
stays in memory). Things that live on the phone say "On your phone": Apple Health or Health Connect, and notification
permission; insight push settings are on the server and can be changed from the browser.

### G-56 · A time of day usually in range hides a first impression the other way (**Guy, 12 Nov 2026**, implemented-unverified)

Guy saw "usually in range at night" (11 of 15 days) beside "above your range at night" (a first impression, 4 of 15).
When a time of day has the "usually in range" finding, a first-impression above or below observation for that time of
day is not listed. A recurring one (at least 3 days and half of the days) is always listed.

### G-57 · Pump alerts in the journal (**Guy, 12 Nov 2026**, implemented-unverified)

Guy asked for every alert and message the devices give in the journal, with its own filter, in the interface
language. The pump's alerts and messages (CareLink notification history, kept in `device_events` since 11 Nov) are
listed by `GET /devices/events` with a named kind (`steady_api/alerts.py`: 44 kinds covering every code in
carelink_messages.json except the pump's own "unknown" and "new notification" messages, which show as "Pump
message"). The journal shows each as its own row with a bell icon, under a new "Alerts" filter; the name is the pump's
own event, never advice. LibreLinkUp's logbook carries no alarm fields (field inspection, 12 Nov 2026) and Dexcom Share
gives readings only, so only pump alerts appear for now. The website's old dashboard timeline (admin view) does not show
them; the personal area is the app itself (G-55).
