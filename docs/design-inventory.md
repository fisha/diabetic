# Design inventory

Source of truth for appearance: the Claude Design canvas "Steady — T1D companion design"
(https://claude.ai/artifact/WYuW5K5Be1Y42WZ8PR92Ni, published version id `1794329313-76e8`, 10 Nov 2026).
A copy of every board is in `design/claude-design/boards/`. The boards are browser prototypes in the
Claude Design `.dc.html` format (HTML template + a `DCLogic` class). They are behaviour and layout references only.
Nothing in them is reusable as React Native code, and their demo data must never reach the app runtime.

How to read a source reference: `Board · state key`. The state key is the condition in the board file that shows
that screen (for example `step==='units'` in Onboarding.dc.html). Each board also has Tweaks (language, text size,
reduced motion, theme day/night, scenario) that reproduce the listed states on the canvas.

Screen ids follow board 14 (Inventory.dc.html). Some in-file HTML comments use an older numbering; the
`comment` note in the Source column shows where they differ (see design-gaps G-11).

Status columns:
- **Visual**: not started / in progress / implemented / compared (screenshot compared against the design).
- **Functional**: unconfigured / implemented-unverified / verified-test / verified-device.

Every screen is **Visual: not started, Functional: unconfigured** at the end of Stage 1.

Cross-cutting variants that apply to every phone screen and must be implemented with it: Day and Night theme,
text size 100 / 130 / 160 % (native: up to 200 %), reduced motion, RTL (he, ar) and LTR (en, ru).
In the design only Onboarding and Companion carry all four languages; see G-08.

## AUTH · Account (board 01, Onboarding.dc.html)

| ID | Screen | Source in design | Native destination | Interactions | States supplied | Functional dependencies | Visual | Functional |
|---|---|---|---|---|---|---|---|---|
| AUTH-01 | Welcome and language | Onboarding · `step==='welcome'` (comment ONB-01) | app/(auth)/welcome.tsx | Pick app language (EN/HE/AR/RU) with direction preview; Get started; I already have an account | default; RTL/LTR flip on language pick | i18n runtime, RTL reload (I18nManager) | implemented | unconfigured (G-04 state shown) |
| AUTH-02 | Create account | Onboarding · `step==='account'`, `acc.signup` | app/(auth)/sign-up.tsx | Email + password fields, show password, submit, link to sign in | empty, invalid email (`errEmail`), submitting | Auth provider (open decision) | implemented | unconfigured (G-04 state shown) |
| AUTH-03 | Sign in | Onboarding · `acc.signin` | app/(auth)/sign-in.tsx | Email + password, forgot link | default, wrong details | Auth provider | implemented | unconfigured (G-04 state shown) |
| AUTH-04 | Recover access | Onboarding · `acc.recover`, `acc.sent` | app/(auth)/recover.tsx | Request reset link; confirmation | request, link sent | Auth provider, transactional email | implemented | unconfigured (G-04 state shown) |
| AUTH-05 | Link / session expired | Onboarding · `acc.expired`; tweak scenario=sessionExpired | app/(auth)/session-expired.tsx | Sign in again | expired | Auth provider (token refresh) | implemented | unconfigured (G-04 state shown) |
| AUTH-06 | Resume incomplete setup | Onboarding · `acc.resume`; scenario=returningIncomplete | app/(auth)/resume.tsx | Continue where you left off; start over | resume | Server-side onboarding progress | implemented | unconfigured (G-04 state shown) |

## ONB · Onboarding (board 01, Onboarding.dc.html)

| ID | Screen | Source in design | Native destination | Interactions | States supplied | Functional dependencies | Visual | Functional |
|---|---|---|---|---|---|---|---|---|
| ONB-01 | Consent: service and model training (separate) | Onboarding · `step==='consent'` (comment ONB-02) | app/onboarding/[step] `consent` | Required service consent checkbox; optional training toggle (off); links to privacy | default, error when required consent missing (`errConsent`) | Consent records API (versioned) | implemented | unconfigured (draft kept on device) |
| ONB-02 | What your companion does (board 14 says "Who is setting up"; see G-02) | Onboarding · `step==='role'` (comment ONB-03) | app/onboarding/[step] `about` | Can / can't lists, emergency note, "I understand" | default | none | implemented | unconfigured (draft kept on device) |
| ONB-03 | Diabetes type | Onboarding · `step==='type'` (comment ONB-04) | app/onboarding/[step] `type` | Type 1 / other / not sure, info note for non-T1 | choice, `typeNote` | Profile API | implemented | unconfigured (draft kept on device) |
| ONB-04 | Date of birth | Onboarding · `step==='dob'` (comment ONB-05) | app/onboarding/[step] `birth` | Date entry, age computed, under 18 routes to ONB-05 | valid, invalid (`errDob`) | Profile API | implemented | unconfigured (draft kept on device) |
| ONB-05 | Minor and guardian | Onboarding · `step==='minor'` (comment ONB-05b); scenario=minor | app/onboarding/[step] `minor` | Guardian card labelled Planned | `guardian` / `noGuardian` | CONFLICT with adult-only scope, see G-02 | implemented | unconfigured (draft kept on device) |
| ONB-06 | Diagnosis year | Onboarding · `step==='dx'` (comment ONB-06) | app/onboarding/[step] `diagnosis` | Year or date, I don't know, skip | value, `dxDate`, skipped | Profile API | implemented | unconfigured (draft kept on device) |
| ONB-07 | Units | Onboarding · `step==='units'` | app/onboarding/[step] `units` | mg/dL or mmol/L | choice | Profile API; unit conversion module | implemented | unconfigured (draft kept on device) |
| ONB-08 | Body details (optional) | Onboarding · `step==='body'` | app/onboarding/[step] `body` | Height, weight with measurement date, skip | filled, skipped | Profile API | implemented | unconfigured (draft kept on device) |
| ONB-09 | Treatment method | Onboarding · `step==='tx'` | app/onboarding/[step] `treatment` | Pump / pens or injections / both / not sure | choice | Profile API | implemented | unconfigured (draft kept on device) |
| ONB-10 | Insulins | Onboarding · `step==='insulin'`, `showBasal` | app/onboarding/[step] `insulin` | Rapid and basal insulin names, I don't know | choices, unknown | Profile API; insulin name list (needs source) | implemented | unconfigured (draft kept on device) |
| ONB-11 | Pump | Onboarding · `step==='pump'` (shared `is.devstep`) | app/onboarding/[step] `pump` | MiniMed 780G (MMT-1880), Omnipod 5, t:slim X2, mylife YpsoPump, injections, other (`devOther`), not sure | choice; selection does not connect | Profile API; equipment catalog | implemented | unconfigured (draft kept on device) |
| ONB-12 | Sensor / meter | Onboarding · `step==='sensor'` (shared `is.devstep`) | app/onboarding/[step] `sensor` | Guardian 4 (MMT-7040), Dexcom G7, FreeStyle Libre 3, none, other, not sure | choice | Profile API; equipment catalog | implemented | unconfigured (draft kept on device) |
| ONB-13 | Ratios by time of day | Onboarding · `step==='icr'`, `icrShow`, `f.icrIdk` | app/onboarding/[step] `ratios` | Add/edit periods, I don't know, source and date | editing, unknown | Treatment settings API (with source + updated date) | implemented | unconfigured (draft kept on device) |
| ONB-14 | Recent history | Onboarding · `step==='hist'` | app/onboarding/[step] `history` | Multi-choice, skip | choices | Profile API | implemented | unconfigured (draft kept on device) |
| ONB-15 | Daily routine | Onboarding · `step==='routine'` | app/onboarding/[step] `routine` | Wake, meals, sleep times | times | Routine/preferences API | implemented | unconfigured (draft kept on device) |
| ONB-16 | Companion avatar | Onboarding · `step==='avatar'` | app/onboarding/[step] `avatar` | 4 illustrated avatars + orb only | selected | Assets (see G-09) | implemented | unconfigured (draft kept on device) |
| ONB-17 | Companion voice and language | Onboarding · `step==='voice'`, `it.playing` | app/onboarding/[step] `voice` | Voice A/B/C preview play/stop; conversation language | idle, playing | Voice provider (unselected); see G-10 | implemented | unconfigured (draft kept on device) |
| ONB-18 | Companion name and style | Onboarding · `step==='name'` | app/onboarding/[step] `name` | Suggested names, custom, tone | suggested, custom | Preferences API | implemented | unconfigured (draft kept on device) |
| ONB-19 | Check-ins, quiet hours, notification permission | Onboarding · `step==='notif'`, `permAsk/permOn/permOff`, `sysDlg` | app/onboarding/[step] `checkins` | Frequency, quiet hours, primer then system permission | ask, allowed, denied (continues) | expo-notifications permission; preferences API | implemented | implemented-unverified (permission only) |
| ONB-20 | Review and edit | Onboarding · `step==='review'`; scenario=review | app/onboarding/[step] `review` | Rows jump back to a step and return (`fromReview`) | filled, not set | Profile API | implemented | unconfigured (draft kept on device) |
| ONB-21 | Familiarization intro | Onboarding · `step==='fam'` | app/onboarding/[step] `familiarization` | Start, goes to Companion | default | Familiarization plan API | implemented | unconfigured (draft kept on device) |

## COM · Companion (board 02, Companion.dc.html)

| ID | Screen | Source in design | Native destination | Interactions | States supplied | Functional dependencies | Visual | Functional |
|---|---|---|---|---|---|---|---|---|
| COM-01 | Voice conversation | Companion · `mode==='voice'`, `isVoice`, orb classes | app/(tabs)/companion.tsx | Tap to talk, stop, mute, interrupt, switch to text | idle, listening (`micLive`), processing, speaking, interrupted, muted, reconnecting, unavailable (`unavail`) | Voice provider, mic permission (expo-audio) | implemented (unavailable state only) | unconfigured |
| COM-02 | Text conversation | Companion · `isText`, `typing` | app/(tabs)/companion.tsx (text mode, same screen) | Composer, send, retry | typing, sending, failed | LLM provider via server, conversation API | implemented | unconfigured |
| COM-03 | Context card (latest reading) | Companion · context block, `ctx.isDemo`, `stale` | component in companion screen | Tap opens Overview | fresh, stale, none | Readings API | hidden until readings exist (G-03) | unconfigured |
| COM-04 | Extracted input confirmation | Companion · `sh.extract` (comment COM-10) | app/(sheets)/confirm-extracted.tsx | Prefilled from speech/text, edit, confirm, discard | draft, editing, confirm | Server tool-call drafts; never saved before confirm | not started | unconfigured |
| COM-05 | Glucose entry sheet | Companion · `showGForm`, `gErr`, `gLow` | app/(sheets)/log/glucose.tsx | Value, unit toggle with conversion, time edit (`editTime`), save | empty, out-of-range error, low panel, saving, saved, offline pending (`offSaved`), failed + retry | Readings API, offline queue | implemented | unconfigured |
| COM-06 | Low reading panel | Companion · `gLow` | inside log/glucose | Shows clinical-review placeholder guidance | shown | BLOCKED: clinically reviewed copy (G-05) | implemented, dev/preview builds only (G-05) | unconfigured |
| COM-07 | Insulin taken sheet | Companion · `sh.insulin`, `iErr` (comment COM-06) | app/(sheets)/log/insulin.tsx | Units, type, time, note that this is not a recommendation | error, saving, saved | Insulin records API | implemented | unconfigured |
| COM-08 | Activity sheet | Companion · `sh.activity` (comment COM-07) | app/(sheets)/log/activity.tsx | Type, duration, intensity | default | Activity records API | implemented | unconfigured |
| COM-09 | Note and symptoms sheet | Companion · `sh.note`, `symUnwell` (comment COM-08) | app/(sheets)/log/note.tsx | Symptoms chips, free text | default, unwell hint, dirty dismiss (`confirmDiscard`) | Notes API | implemented | unconfigured |
| COM-10 | Reminder sheet | Companion · `sh.reminder`, `rCustom` (comment COM-09) | app/(sheets)/reminder/new.tsx | Preset or custom time | default, custom | Durable jobs API | implemented | unconfigured |
| COM-11 | Conversation history | Companion · `sh.history` (comment COM-03) | app/(sheets)/history.tsx (form sheet) | List of messages and records | list | Conversation API | implemented (empty state) | unconfigured |
| COM-12 | Microphone denied | Companion · `sh.micDenied`; simulate=micDenied | inside companion/index | Explain, open settings, use text | denied | expo-audio permission, Linking.openSettings | not started | unconfigured |
| COM-13 | Opened from notification | Companion · `fromNotif`, `notifAnswers`, `resumed`; simulate=fromNotification | deep link steady://companion/c/[id]?turn= | Lands on the right turn with answer chips | resumed | expo-notifications deep links, follow-up jobs | not started | unconfigured |
| COM-14 | Quick log menu | Companion · `sh.quick` (comment COM-11) | app/(sheets)/log/index.tsx | Glucose, meal photo (opens MEAL), insulin, activity, note | open | none (navigation) | implemented | unconfigured |

## MEAL · Meal photo (board 03, Meal.dc.html)

| ID | Screen | Source in design | Native destination | Interactions | States supplied | Functional dependencies | Visual | Functional |
|---|---|---|---|---|---|---|---|---|
| MEAL-01 | Choose method + recent meals | Meal · `view==='start'` | app/meal/index.tsx (full-screen modal) | Take photo, choose from photos, describe, search, recents | default | Meals API | implemented; recent meals hidden until the meals API returns some | unconfigured |
| MEAL-02 | Camera | Meal · `view==='camera'`; camera denied `view==='camDenied'` (comment MEAL-01b) | app/meal/camera.tsx | Shutter, flash, cancel | live, denied | expo-camera | implemented (real camera permission, capture and flash; denied state with Open Settings) | camera: real |
| MEAL-03 | Photo preview | Meal · `view==='preview'`, `isBlurry` | app/meal/preview.tsx | Use photo, retake | ok, blurry warning | Image quality check (source TBD) | implemented; "Use this photo" ends in the G-04 state; blurry warning in preview only | unconfigured |
| MEAL-04 | Analyzing | Meal · `view==='analyzing'`, `st.done` | components only (MealViews AnalyzingView) | Progress steps, cancel | in progress (must reflect real work) | Food provider adapter (unselected) | implemented as component; preview only (no analysis request exists) | unconfigured |
| MEAL-05 | Describe or dictate | Meal · `view==='describe'` (comment MEAL-10) | app/meal/describe.tsx | Text, dictate | empty, typed | Food provider text endpoint or manual | implemented; Find foods and Dictate end in G-04 | unconfigured |
| MEAL-06 | Review items | Meal · `view==='review'`, `it.hasQ/hasQty/isGrams/noData` | app/meal/review.tsx | Per-item quantity stepper, unit chips, provenance badges, how much eaten, total as estimate | multiple foods, mixed dish, low confidence, missing nutrition (manual carbs) | Food provider adapter; meals API | implemented (manual entry works; populated scenarios in preview); Save ends in G-04 | unconfigured |
| MEAL-07 | Clarifying questions | Meal · review `it.hasQ` | inside meal/review | Answer or skip | answered, skipped | Food provider or server logic | implemented; preview only (questions come from the provider) | unconfigured |
| MEAL-08 | Change or add food | Meal · `searchOpen`, `noResults` (comment MEAL-06/07) | sheet inside meal/review | Search, pick, add | results, none | Nutrition database (unselected) | implemented; search shows G-04 note; "Add your own food" works | unconfigured |
| MEAL-09 | No food / service down | Meal · `view==='noFood'`, `view==='down'` (comment MEAL-04b) | MealMessageView in meal flow | Retry, describe instead, enter manually | no food, service down | Food provider error mapping | implemented; no food and service down in preview only | unconfigured |
| MEAL-10 | Saved and correction history | Meal · `view==='saved'`, `edited` | MealSavedView inside meal/review | Correct, edit history | saved, corrected | Meals API with revisions | implemented; reached only after a confirmed save, so preview only | unconfigured |

## OVR · Overview (board 04, Overview.dc.html)

| ID | Screen | Source in design | Native destination | Interactions | States supplied | Functional dependencies | Visual | Functional |
|---|---|---|---|---|---|---|---|---|
| OVR-01 | Overview: latest reading + day graph | Overview · `view==='main'`, `isDay`, `hasCgm`, `manualOnly`, `isStale`, `gap.show`, `chartEmpty` | app/(tabs)/overview.tsx | Period tabs, day nav, graph scrub readout (hourly hit areas), event markers | sensor, manual-only, stale, new user (`isNew`), gaps | Readings API, events API | implemented; runtime shows the no-readings state; populated in preview | unconfigured |
| OVR-02 | Week / 2 weeks / month | Overview · `isMulti`, `d.ok`, `d.na`, `hasTir`, `noTir` | same route, period param | Stacked time-in-range bars, select day | data, not enough data | Aggregation API (thresholds need review, G-06) | implemented; populated in preview | unconfigured |
| OVR-03 | Insights list | Overview · insight list in main (comment OVR-03) | component in overview/index | Open insight | recurring, first impression, none | Insight engine (Stage 5) | implemented; hidden when there are no insights | unconfigured |
| OVR-04 | Insight detail and feedback | Overview · `view==='insight'`, `fbAskWhy`, `fbDone`, `fbNone` | component InsightDetailView | Evidence rows, excluded data, useful / not right with reasons, mute | default, feedback given | Insight engine; feedback API | implemented; feedback ends in G-04; preview only (no insights yet) | unconfigured |
| OVR-05 | Daily and weekly summary | Overview · `view==='summary'` (comment OVR-05/06) | component SummaryView | Read summary | default | Summary job | implemented; preview only (no summary job yet) | unconfigured |
| OVR-06 | Quick log sheet | Overview · `quick` | shared (sheets)/log/index | As COM-14 | open | as COM-14 | implemented | none (navigation) |

## JRN · Journal (board 05, Journal.dc.html)

| ID | Screen | Source in design | Native destination | Interactions | States supplied | Functional dependencies | Visual | Functional |
|---|---|---|---|---|---|---|---|---|
| JRN-01 | Journal list and filters | Journal · `view==='list'`, `empty`, `pending`, `syncFail` | app/(tabs)/journal.tsx | Filter chips, day groups, export, add | normal, empty, offline pending, sync failed | Events API, offline queue | implemented; runtime shows the empty state; normal, pending, failed in preview | unconfigured |
| JRN-02 | Entry detail with provenance | Journal · `view==='detail'`, `cur.*` | component JournalDetailView | Lifecycle, history, duplicate, conflict, edit, delete, hide from summaries (device) | per entry type | Events API | implemented; preview only (no entries yet) | unconfigured |
| JRN-03 | Reminder and suggestion lifecycle | Journal · `cur.hasLife`, `cur.reminder` | inside journal/[eventId] | Read-only steps | scheduled, sent, opened, completed; suggested, acknowledged, reported, device recorded | Jobs + suggestions API | implemented; preview only | unconfigured |
| JRN-04 | Possible duplicate | Journal · `cur.dup`, `dupOpen`, `dupDone` | inside journal/[eventId] | Merge or keep both | open, resolved | Dedup logic (server) | implemented; merge ends in G-04; preview only | unconfigured |
| JRN-05 | Meter vs sensor difference | Journal · `cur.conflict` | inside journal/[eventId] | Info note | shown | Readings API | implemented; preview only | unconfigured |
| JRN-06 | Edit with reason and history | Journal · `view==='edit'` (comment JRN-03), `editGlu`, `editMeal` | component JournalEditView | Change value, reason, save | edit | Revisions API | implemented; save ends in G-04; preview only | unconfigured |
| JRN-07 | Delete and undo | Journal · `delDlg`, `toast`, `canUndo` | inside journal | Confirm, undo toast | confirm, undo | Soft delete API | implemented; delete ends in G-04; preview only | unconfigured |

## RTN · Familiarization and follow-ups (board 06, Routine.dc.html)

| ID | Screen | Source in design | Native destination | Interactions | States supplied | Functional dependencies | Visual | Functional |
|---|---|---|---|---|---|---|---|---|
| RTN-01 | Familiarization progress | Routine · `tab==='routine'`, `inFam` (comment RTN-02) | app/(tabs)/profile/routine.tsx (entry from Companion and Profile) | Day cards, learned items, suggested check-ins toggles | day 1-3 | Familiarization plan API | implemented; day cards, learned items and still unknown from `GET /insights/familiarization` (G-36); suggestions stay empty | implemented-unverified (web e2e) |
| RTN-02 | First days summary | Routine · `view==='summary'`, `famDone` (comment RTN-05) | app/(tabs)/profile/routine/summary.tsx | Review learned facts | complete | Summary job | component only, opened from the preview (no runtime route until the summary job exists) | unconfigured |
| RTN-03 | Check-ins list | Routine · `tab==='checkins'`, `noUpcoming` | app/(tabs)/profile/checkins.tsx | Upcoming and earlier, statuses | upcoming, completed, snoozed, dismissed, withdrawn, not answered, none | Durable jobs API | implemented; empty upcoming and earlier lists at runtime; all statuses in the preview | unconfigured |
| RTN-04 | Snooze, reschedule, dismiss | Routine · `sheet`, `sheetOpts`, `sheetTime` | sheets | Pick time or option | sheet open | Durable jobs API | Snooze, Change time and Dismiss buttons exist; their sheets are not built (G-19) | unconfigured |
| RTN-05 | Frequency, quiet hours, pause | Routine · `paused` | inside checkins | Pause banner, quiet hours | paused | Preferences API | frequency and quiet hours work (onboarding answers); Pause shows a not-running note (G-19) | preferences: local |
| RTN-06 | Memory | Routine · `tab==='memory'`, `m.editing`, `noMem`, `clearDlg` | app/(tabs)/profile/memories.tsx | Toggle, edit, remove, remove all | on, off, editing, empty, confirm clear | Structured memory API | implemented; toggle saved locally; list, edit and remove in the preview; clear-all dialog not built (G-19) | memory service: unconfigured |
| RTN-07 | Notification (lock screen) | Routine · `view==='lock'`, `notifLive`, `notifWithdrawn` | system notification (expo-notifications category) | Reply opens COM-13, Snooze, Not today | live, withdrawn | expo-notifications, jobs | not started (Stage 3) | unconfigured |

## SET · Profile and settings (board 07, Settings.dc.html)

| ID | Screen | Source in design | Native destination | Interactions | States supplied | Functional dependencies | Visual | Functional |
|---|---|---|---|---|---|---|---|---|
| SET-01 | Profile hub | Settings · `v.hub` | app/(tabs)/profile/index.tsx | Rows to all settings, sign out | default | Profile API | implemented (account card says not signed in, G-19) | unconfigured |
| SET-02 | Diabetes profile | Settings · `v.profile` (comment SET-13) | app/(tabs)/profile/diabetes.tsx | View, edit fields | view, edit | Profile API | implemented; edits reuse the onboarding steps (G-19) | protected draft: local |
| SET-03 | Treatment settings and ratios | Settings · `v.treatment`, `icrEditing`, `r.edit`, `r.view` (comment SET-02) | app/(tabs)/profile/treatment.tsx | Ratio schedule edit, still current, correction factor unknown, target range | view, editing, unknown | Treatment settings API; G-07 defaults | implemented; no defaults (G-07); editing reuses the onboarding ratios step (G-19) | protected draft: local |
| SET-04 | Devices list | Settings · `v.devices` (comment SET-03) | app/(tabs)/profile/devices/index.tsx | Planned banner, device rows | planned | GAP: no Apple Health / Health Connect row (G-01) | implemented with the Apple Health / Health Connect row (G-01) | unconfigured |
| SET-05 | Device detail | Settings · `v.device`, `dev.*` (comment SET-03b) | app/(tabs)/profile/devices/[id].tsx | Connect, reconnect, disconnect (keep/remove data) | none, explain, connecting, connected, stale, expired, reconnect, down, unsupported, disconnecting choice, disconnected | Vendor integrations (unverified) | implemented; all 11 states in the preview; connect ends in the G-04 note | unconfigured |
| SET-06 | Companion personalization | Settings · `v.companion`, `compSaved` (comment SET-04) | app/(tabs)/profile/companion.tsx | Avatar, voice, name, style | saved | Preferences API; voice provider | implemented; voice shows the G-10 note | local; voice: unconfigured |
| SET-07 | Language | Settings · `v.language` (comment SET-05) | app/(tabs)/profile/language.tsx | App language vs conversation language, direction preview | default | i18n, RTL reload | implemented; RTL reload banner and preview work | local: real |
| SET-08 | Accessibility + Appearance | Settings · `v.a11y` (comment SET-06) | app/(tabs)/profile/accessibility.tsx | Day / Night, text size, reduce motion, captions, haptics, contrast, digit-by-digit, voice speed | per toggle | Local preferences; G-13 | implemented; contrast disabled (G-19) | local: real |
| SET-09 | Notifications | Settings · `v.notif` (comment SET-07) | app/(tabs)/profile/notifications.tsx | Toggles disabled when permission off | permission on, off | expo-notifications | implemented with the real permission state | expo-notifications permission: real |
| SET-10 | Privacy and consent | Settings · `v.privacy`, `train` (comment SET-08) | app/(tabs)/profile/privacy.tsx | Service consent locked, training opt-in, photo retention, care-team sharing Planned | default | Consent API; retention policy (open) | implemented; care team "Planned"; policy not published | local |
| SET-11 | Export data | Settings · `v.export`, `exp.form/running/ready` (comment SET-10) | app/(tabs)/profile/export.tsx | Choose range and format, export, download | form, running, ready | Export job | form implemented; running and ready in the preview; Create shows the G-04 note | unconfigured |
| SET-12 | Delete account | Settings · `v.delete`, `del.form/running/done` (comment SET-11) | app/(tabs)/profile/delete.tsx | Type DELETE, confirm, store subscription reminder | form, running, done | Deletion job; retention policy | form and DELETE check implemented; running and done in the preview; nothing deleted | unconfigured |
| SET-13 | Help and FAQ | Settings · `v.help`, `q.open` (comment SET-09) | app/(tabs)/profile/help.tsx | Accordion | open/closed | Static content | implemented; contact and report show the G-04 note | static |
| SET-14 | Sign out | Settings · `signOutDlg` | dialog in profile/index | Warn about unsynced data | dialog | Offline queue state | dialog says sign-out is not available in this build; the unsynced-entries text waits for the offline queue | unconfigured |

## SUB · Membership (board 08, Subscription.dc.html)

| ID | Screen | Source in design | Native destination | Interactions | States supplied | Functional dependencies | Visual | Functional |
|---|---|---|---|---|---|---|---|---|
| SUB-01 | Membership status | Subscription · status card `st.*`; tweak scenario | app/(tabs)/profile/membership.tsx | Trial meter | trial active, ending, expired, payment failed, member, cancelled, expired | Billing (undecided) | implemented; runtime "not set up" state (G-19); 7 board states in the preview | billing: unconfigured |
| SUB-02 | Choose plan | Subscription · `showPlans`, plans radiogroup | same route | Monthly / annual, buy | selected | Billing (undecided); prices from store | plan list shown only with store prices; placeholder prices in the preview | billing: unconfigured |
| SUB-03 | Platform purchase sheet | Subscription · `sheet`, `buying` (mock of native sheet) | native StoreKit / Play Billing sheet, not app UI | Confirm, decline | processing | Billing (undecided) | not app UI (native store sheet) | billing: unconfigured |
| SUB-04 | Limited access | Subscription · `st.limited` | same route | Lists what stays and what pauses | shown | Product decision (open) | implemented (preview) | billing: unconfigured |
| SUB-05 | Manage and cancel | Subscription · `isMember`, `manageNote`, `cancelInfo`, `canCancel` | same route | Manage in store / portal; cancel info | member, cancelled | Billing | implemented (preview); runtime actions show the G-04 note | billing: unconfigured |
| SUB-06 | Restore purchases | Subscription · `restore` | same route | Restore | checking, none found | Billing | button implemented; shows the G-04 note | billing: unconfigured |

## WEB · Website (board 09, Website.dc.html)

| ID | Screen | Source in design | Native destination | Interactions | States supplied | Functional dependencies | Visual | Functional |
|---|---|---|---|---|---|---|---|---|
| WEB-01 | Home hero + language | Website · hero, language buttons (`dir`) | apps/web app/[locale]/(marketing)/page.tsx | Language switch, store buttons | 4 languages | next-intl; store URLs (none yet) | implemented; store buttons disabled until store listings exist (G-20) | next-intl: real; stores: none |
| WEB-02 | How it works | Website · section | same page | static | default | none | implemented | static |
| WEB-03 | Can / can't | Website · section | same page | static | default | none | implemented | static |
| WEB-04 | Membership and price | Website · section, monthly/annual toggle | same page | Toggle | monthly, annual | Prices (open) | implemented; prices shown only in preview builds (G-20) | prices: open |
| WEB-05 | Privacy | Website · section | same page | static | default | Privacy policy text (legal) | implemented | static |
| WEB-06 | FAQ | Website · `q.open` | same page | Accordion | open/closed | none | implemented | static |
| WEB-07 | Footer and disclaimer | Website · footer | same page | Links | default | Regulatory wording (open) | implemented; footer text colour fixed for night (G-20) | regulatory wording: open |

## WD · Web dashboard (board 10, WebDashboard.dc.html)

| ID | Screen | Source in design | Native destination | Interactions | States supplied | Functional dependencies | Visual | Functional |
|---|---|---|---|---|---|---|---|---|
| WD-01 | Overview | WebDashboard · `sec==='overview'`, `d.ok`, `d.na` | apps/web app/[locale]/(dashboard)/overview/page.tsx | 14/30/90 days, bar click readout | data, not enough data | Aggregation API; web auth (G-12) | shell and period control; empty state (no web sign-in) | unconfigured |
| WD-02 | Timeline | WebDashboard · `sec==='timeline'` | (dashboard)/timeline/page.tsx | Filters, table, selected entry with history | default | Events API | filters and empty state | unconfigured |
| WD-03 | Insights | WebDashboard · `sec==='insights'` | (dashboard)/insights/page.tsx | List | default | Insight engine | empty state | unconfigured |
| WD-04 | Settings | WebDashboard · `sec==='settings'` | (dashboard)/settings/page.tsx | Membership note, training switch, care-team Planned | default | Consent API | explanations only; choices are made in the app | unconfigured |
| WD-05 | Export | WebDashboard · `sec==='export'`, `expIdle/expRun/expDone` | (dashboard)/export/page.tsx | Form, progress, ready | idle, running, done | Export job | form; Create shows the unavailable note | unconfigured |

**Total: 103 screens** (102 on board 14, plus COM-14 Quick log menu, which board 14 folds into OVR-06).

## Design-only artefacts excluded from the app

These exist on the canvas to demonstrate states. They are not product UI and will not be implemented:

| Where | Element | Why excluded |
|---|---|---|
| Every board | Tweaks panel (language, scenario, simulate, platform, trial days, theme) | Canvas controls, not app UI |
| Routine.dc.html | "Simulate: day 3 complete", "Simulate: lunch logged before 12:30" | Demo buttons |
| Settings.dc.html (Notifications) | "Simulate: allowed" | Demo button; real state comes from the OS |
| Subscription.dc.html | "Simulate: payment declined", mocked purchase sheet | Native store sheet is platform UI |
| All boards | Values labelled "Demo data", "Simulated values", placeholder prices | Visual reference only (handoff §3) |
| Companion, Meal, Settings, Subscription, Journal, Onboarding, WebDashboard | `setTimeout` / `this.later` timers that fake saving, analysis, export, purchase | Loading must reflect real work |

## Reusable from the design

| Item | Location | Use |
|---|---|---|
| Colour, type, spacing, radius, motion, size tokens (day and night) | `design/claude-design/tokens.json` | Source for `packages/tokens` |
| Copy in EN/HE/AR/RU for Onboarding and Companion | `strings()` in Onboarding.dc.html, Companion.dc.html | Seed for `packages/i18n` (translation review still required) |
| Copy deck with ICU plurals and medical flags | Localization.dc.html | Seed for `packages/i18n` |
| Icons (24 grid, 1.8 stroke) | inline SVG paths in Tokens.dc.html 11.9 and boards | Port to react-native-svg components |
| Avatars, orb, equipment category glyphs | inline SVG in Onboarding.dc.html, Tokens.dc.html 11.10 | Port to SVG components (see G-09) |
| Component specs and RN mapping | Components.dc.html | Primitive list for Stage 2 |
| Route map | Main.dc.html | expo-router structure |
