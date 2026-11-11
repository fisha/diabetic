# Diabetes Companion — Claude Code Implementation Handoff

Owner: Guy Fisher  
Date: 10 November 2026  
Purpose: A self-contained implementation prompt. Read this entire document before changing code.

## 1. Your assignment

Act as the lead engineer implementing an existing, fully designed diabetes companion application. The owner has already created the application design in Claude Design. Your task is to inspect that deliverable, faithfully implement it in a native mobile application, and connect real functionality in controlled stages.

Do actual implementation work within the active stage. Do not answer only with an architecture proposal. Do not attempt to build the entire product in one uncontrolled pass.

The design files have not been inspected by the author of this handoff. Do not assume any particular export format, route names, component names, assets, or completeness. Find the supplied project/export in the current workspace. If it is absent, request the Claude Design project/export and assets from Guy. Do not invent a replacement design while waiting. You may inspect the repository and prepare nonvisual infrastructure independently.

Communicate with Guy in Hebrew unless he requests otherwise. Keep source code, identifiers, and technical project documentation in English. Explain real blockers directly and avoid repeated questions about routine implementation choices.

## 2. Source of truth and change control

1. Guy's latest explicit instructions govern product decisions.
2. The supplied Claude Design deliverable governs appearance, screen structure, navigation, interactions, assets, and motion.
3. This document governs product context, engineering constraints, data integrity, and implementation order.
4. Existing repository instructions and conventions apply where consistent with these requirements.

If the design and this brief disagree, record the discrepancy and ask for the specific decision. Continue unaffected work. Do not silently redesign, remove scope, or implement contradictory behavior.

Never create additional product screens, navigation items, buttons, flows, or features without Guy's approval. Missing error, empty, loading, or permission states are design gaps: list them, propose the smallest consistent solution, and obtain approval before presenting them as settled product UI. Required native system permission dialogs are platform behavior, not invented product screens.

Treat the feature inventory below as a coverage checklist, not permission to replace an approved layout. Preserve design fidelity while adapting to native safe areas, keyboards, gestures, accessibility, and platform constraints. Document any visible deviation.

## 3. Hard rules: no invented data or fake completion

- No sample patients, glucose measurements, meals, insulin records, charts, conversations, insights, subscription states, or health connections in the normal application path.
- A new account starts with no health history. Display approved empty states, not attractive fabricated charts.
- No mock API success, simulated uploads, fake AI answers, hardcoded nutrition results, or pretend device connections.
- Never replace a failed request with fixture data. Surface the actual failure and an appropriate retry path.
- A loading animation must correspond to real work. Do not use timers to pretend that a service completed.
- A pending local record is not server-saved. Show pending synchronization separately from confirmed persistence.
- Unsupported or unconfigured services must be explicitly unavailable in development. Do not enable an action that can only produce a fake result. Follow approved disabled states; request a design decision if missing.
- Test fixtures are allowed only in isolated automated tests or explicitly separate component previews. Use a separate test database. Fixtures must never be bundled into a fallback for normal runtime or automatically seeded into user accounts.
- Existing demo data inside the design export is visual reference only. Isolate it from application runtime.
- Never claim that a test, device build, integration, or deployment succeeded without actually running and observing it. Report environment limitations accurately.

Track design implementation and functional integration separately. A screen can be visually complete while its service remains disconnected. Neither status implies the other.

## 4. Product purpose and initial audience

Build a personal AI companion for adults with type 1 diabetes. Reduce the continuous mental workload of logging, remembering context, understanding observations, and following up. The companion should feel calm, attentive, mature, and personal.

The user can initiate a voice/text conversation, and the companion can initiate relevant follow-ups according to user preferences and available information. The product must remain useful with manual entry and without connected devices.

This is an AI companion, not a licensed nurse or physician. It must not claim continuous clinical supervision. Pediatric and caregiver workflows require separate specification; do not add them automatically.

The product name is not finalized. Preserve the name present in the approved design as a configurable working name; do not begin a branding exercise.

## 5. Technology direction

| Layer | Implementation direction |
| --- | --- |
| iOS and Android | React Native + Expo + TypeScript |
| Native development | Expo development builds; native modules as required |
| iOS health integration | HealthKit through an evaluated native bridge/module |
| Android health integration | Health Connect through a separate evaluated adapter |
| Supporting website/dashboard | Next.js + TypeScript |
| Backend | Python + FastAPI |
| Authoritative structured storage | PostgreSQL |
| Durable follow-ups | Background workers and persistent scheduled jobs |

Expo Go is not the acceptance environment for HealthKit. Validate actual native builds. Select compatible maintained dependencies from current official documentation, record versions and rationale, and pin them. Do not assume any specific community health library has been approved. Evaluate licensing, maintenance, supported data types, background behavior, and compatibility before selecting it.

Use Swift/Kotlin for small platform-specific modules where needed. Do not switch the entire product to Flutter or two fully separate native applications without an explicit decision.

If Claude Design exported browser React, reuse appropriate assets, tokens, types, and behavior references. Reimplement DOM/CSS-dependent components as native components. Do not wrap the entire web design in a WebView and call it a native implementation. The web dashboard can reuse suitable browser components. Share nonvisual logic and contracts where useful without forcing identical rendering code across platforms.

Keep the architecture simple. Adapt to an existing suitable repository instead of restructuring it unnecessarily. Keep provider credentials on the server, with only narrowly scoped short-lived client tokens where a provider requires them.

## 6. Design ingestion and implementation inventory

Inspect the actual export before coding screens. Create:

- `docs/design-inventory.md`: source screen/route, source file or reference, native destination, interactions, all supplied states, implementation status, and missing dependencies.
- `docs/design-gaps.md`: missing assets/states, conflicts, proposed native adaptations, and decisions needed.
- `docs/implementation-plan.md`: milestones, acceptance criteria, and dependencies.
- `docs/progress.md`: current stage, completed work, evidence, blockers, and exact next action.
- `docs/integration-status.md`: each integration marked unconfigured, implemented-unverified, verified in test, or verified on a real device as appropriate.

Extract the real design tokens, typography, spacing, colors, icons, illustrations, avatar assets, and motion behavior. Preserve asset licensing and font availability. Build shared primitives before replicating screens. Avoid placeholder icons or substituted artwork being passed off as finished design.

Compare screenshots of the native implementation to the matching design references at comparable viewport sizes. Verify safe areas, keyboard avoidance, scroll behavior, bottom sheets, large text, RTL, and reduced motion. Report discrepancies instead of merely saying the design looks correct.

## 7. Complete feature inventory

### Account and progressive onboarding

- Registration, sign-in, recovery, returning-user state, session expiry, and sign-out using real authentication.
- Resumable onboarding, one main decision per step, back navigation, and progressive collection instead of a long initial medical form.
- Preferred name, date of birth, confirmation of diabetes type, diagnosis date/year, glucose units, treatment method, insulin type, pump/sensor models, and height/weight with measurement dates where designed.
- Allow unknown/skipped values where appropriate. Never infer missing treatment parameters.
- Equipment selection using the approved illustrations and exact model names, with other/unsure/no-sensor and pens/injections options where designed.
- MiniMed 780G and Guardian 4 are initial investigation targets. Selecting equipment does not establish a connection.
- Request microphone, camera, health, and notification permissions in context. Preserve usable alternatives when declined.

### Companion selection and familiarization

- Use the approved mature illustrated companions, custom name, voice preview, and voice/language selection.
- Avatar identity and voice provider are separate. Do not invent available voices or language support.
- All companions have the same capabilities and safety constraints; personality changes communication style only.
- Present approximately the first three days as learning routines, not achieving validated physiological understanding.
- Record known information, missing information, and user corrections. Provide immediate value during familiarization.

### Voice and text conversation

- Conversation is the main experience. Preserve shared context between text and voice.
- Implement the approved orb/companion states: idle, listening, processing, speaking, muted, interrupted, and disconnected.
- Support interruption, transcript access, corrections, retry, and a complete text-only path.
- Never imply microphone activity when recording is inactive.
- Validate spoken values and units before saving ambiguous numerical information.
- Confirm actions from tool results, not from language-model assertions.

### Input cards and health records

- Approved in-conversation cards/bottom sheets for glucose, food, insulin already taken, activity, and photos.
- Large readable buttons, explicit units, suitable keyboards, edit/cancel/confirm, and validation.
- Distinguish measurement time from entry time and import time. Distinguish measured, entered, estimated, and inferred information.
- Store source and corrections. Avoid duplicate events when the same information arrives by conversation, manual form, and device import.
- Recording insulin already taken is not recommending a dose.

### Food photography and carbohydrate estimates

- Capture/upload, preview, real analysis progress, detected items, portion confirmation, ingredient correction, carbohydrate estimate, and confirmed save.
- Familiar units: grams, pieces, cups, spoons, and appropriate portion descriptions.
- Support corrections such as “I ate half.” Ask focused questions about hidden ingredients or uncertain portions.
- Keep estimates visibly identified as estimates after user confirmation. Do not derive an insulin recommendation from an image result.
- Preserve designed manual/text alternatives; barcode/label entry only where supplied and technically supported.
- Start with an external provider evaluation: LogMeal is the initial candidate; Passio is a comparison candidate. Neither is selected as a validated production solution.
- Implement a replaceable provider adapter returning structured foods, quantities, nutrient estimates, assumptions, status, and provenance. Do not fabricate confidence scores absent provider evidence.
- Verify current API access, plans, endpoint costs, and portion-estimation capabilities before committing. Previous pricing discussion is not a purchase authorization or current quote.
- Evaluate carbohydrate error in grams on weighed/reference meals, including local foods and mixed dishes, before and after portion correction. Food-name recognition accuracy alone is insufficient.
- User corrections are feedback, not automatically trustworthy training labels. Independent model development is a future option, not a dependency for the first application release.

### Dashboard, timeline, and insights

- Implement all designed charts, summaries, overlays, filters, and detail views using real records.
- Unified timeline: measurements, meals, reported insulin, activity, conversations, reminders, observations, suggestions, and confirmed actions.
- Show timestamps, units, source, freshness, missing intervals, and traceable edits.
- Never turn sparse manual readings into a claimed continuous glucose history or unsupported continuous metrics.
- Insights must link to supporting observations. Distinguish correlation from cause and uncertainty from measured facts.
- Suggestions, scheduled actions, and user-confirmed completion are separate states. Do not interpret no response as completion or safety.
- No judgmental health scores or invented achievements.

### Proactive follow-ups and memory

- Explain why a follow-up is being made and what observation prompted it.
- Answer, snooze, dismiss, adjust preferences, and resume the relevant conversation, according to the design.
- Persist scheduled work; implement retries, cancellation, deduplication, and time-zone handling.
- Cancel redundant questions when new information resolves them. Respect quiet hours and contact preferences.
- Do not hardcode a universal two-hour follow-up rule. Timing follows explicit user requests or reviewed product policy.
- Separate facts, hypotheses, preferences, treatment settings, and pending tasks in structured storage. Chat history alone is not memory.
- Missing insulin records do not prove that insulin was not taken.

### Profile and treatment information

- Store user-provided insulin-to-carbohydrate ratios, time-of-day schedules, correction factors, and targets where designed, with source and update dates.
- Support unknown/review-required states. Do not create defaults that appear to be the user's treatment settings.
- Collect relevant history, medications, and routines progressively and only as needed.
- Do not derive doses from height, weight, ratios, or personal history as part of this implementation scope.

### Localization, accessibility, and motion

- Hebrew and Arabic: RTL. English and Russian: LTR.
- Change interface language in settings independently from conversation language.
- Localize complete journeys, validation, errors, permission explanations, notifications, dates, and numbers.
- Preserve explicit chart time direction rather than blindly mirroring plots.
- Handle mixed-direction units/device names and long Russian text. Never truncate a treatment value or hide a unit.
- Large touch targets, strong contrast, scalable typography, screen-reader ordering/labels, and non-color status cues.
- Match approved animations and micro-interactions with reduced-motion alternatives. Motion must not delay data entry or reading.
- Verify voice recognition of numbers and units in all four languages; do not claim multilingual quality based only on UI translation.

### Membership and supporting web experience

- One membership with monthly and discounted annual billing, not invented tiers or credits.
- Price and trial duration are undecided; previous discussion included 7 or 14 days. Keep configuration explicit. Do not invent live pricing or collect payment before decisions and real integration.
- Implement designed renewal, cancellation, payment failure, trial expiry, and expired membership states when billing is connected.
- Verify applicable platform billing requirements before selecting a billing approach. Do not assume web checkout automatically covers native requirements.
- No sales prompts inside health conversations.
- Supporting website and authenticated responsive web dashboard use the same identity and authorized data. The web experience complements the mobile app.
- A browser/server does not directly read the phone's HealthKit store; the mobile app is the authorized ingestion point.

## 8. Apple Health, Android Health Connect, and device access

Start with read-only health integration. Request only the types required for implemented features. Candidate types include glucose, activity, sleep, heart rate, weight, nutrition, and insulin delivery where the platform and source actually support them. Verify each separately; do not assume identical schemas or availability across platforms.

HealthKit is a local health-data repository, not a universal pump/CGM API. Available measurements depend on other apps/devices writing them and the user granting access. Do not claim MiniMed/Guardian support merely because HealthKit works.

Investigate MiniMed Mobile/CareLink separately: official access, permissions, commercial terms, available data, freshness, and reliability remain unverified. Do not implement scraping, store device-account passwords, or use unofficial connectors as a silent fallback. Present any such proposal separately.

Implement:

- Native capabilities, purpose descriptions, per-type permissions, and user-controlled connection settings.
- Initial import and incremental synchronization, with source identifiers, native record IDs, timestamps, units, and receipt times.
- Idempotent upserts, imported-record corrections/deletions, sync checkpoints, and safe retry after interruption.
- Account isolation and deliberate handling of logout/account switching, so phone health data cannot silently transfer to another account.
- Foreground refresh plus supported background mechanisms. Verify behavior on a real device, including unavailable/locked-device conditions.
- Connected, pending, stale, partial, failed, disconnected, and revoked-access behavior to the extent the platform exposes them.
- Do not infer denied read permission solely from an empty HealthKit result; privacy behavior may prevent distinguishing denial from absent data.
- Last successful synchronization and actual measurement time as separate values.
- A usable manual-entry path when health data is absent, delayed, or unavailable.

Background delivery is not guaranteed real-time monitoring. Do not use it or push notifications as a replacement for CGM alarms or emergency care.

Before substantial integration work, produce a short real-device feasibility result: build configuration, requested types, observed available types, data-source names, foreground results, background observations, and remaining limitations. Use developer-owned/test-device data with consent; do not copy identifiable readings into committed evidence.

## 9. Backend, data integrity, and security

Define typed API contracts and validation before connecting screens. Use migrations and real authentication. Every record and tool action must enforce user ownership on the server.

Use PostgreSQL for users/preferences, health records, meal estimates, conversations, structured memory, follow-ups, consent, and relevant audit events. Use a durable job mechanism for scheduled work. Do not make a dedicated vector database mandatory before retrieval requirements justify it.

Normalize health ingestion while retaining original units, values, timestamps, and source metadata. Test glucose unit conversion and timezone boundaries. Use stable event IDs and idempotency keys; distinguish revisions from new measurements. Avoid double counting overlapping data sources.

Support offline input with an appropriate protected local queue. Represent pending/failed synchronization accurately and reconcile retries and corrections. Do not store sensitive records in unprotected generic application storage by default.

Encrypt transport and sensitive stored data, use secure token storage, isolate environments and users, redact health information from logs/telemetry, and keep secrets out of repositories. Upload photos/audio through controlled authenticated paths. Define retention, deletion, export, and revocation behavior.

Health access consent is not blanket permission to upload all available data, retain audio/photos indefinitely, or train models. Define the minimum required server data and explain it in the consent flow. Shared-model training participation must be separately optional. Avoid sensitive lock-screen notification contents by default.

Keep AI providers behind interfaces. Use validated tool schemas, server-side permission checks, and recorded tool outcomes. Provider failure must not create fabricated observations or confirmed actions.

## 10. AI evaluation and medical boundaries

Guy wants model experiments from the beginning, alongside application work. Maintain a separate evaluation track; it must not block faithful UI implementation or silently alter production behavior.

- Evaluate candidate medical models such as MedGemma against a strong general baseline. No candidate has been selected or clinically validated.
- Start with curated authoritative diabetes/device sources with dates, usage rights, population tags, and source attribution.
- Enforce type 1 diabetes and adult scope through structured constraints, not only a prompt.
- Test tool correctness, missing data, unsupported claims, uncertainty, numerical transcription, and all four languages with held-out cases.
- Model-generated text is not clinical ground truth. Use professionally reviewed examples for clinical content and evaluations.
- Personal memory is not per-user model retraining. Do not train on user records without an appropriate separate process and consent.
- No autonomous treatment changes, insulin dosing engine, or claims of validated prediction in this scope. Any expansion requires a separate clinical/regulatory decision.
- Escalation content and medical thresholds require professional review; do not invent them to complete screens.

## 11. Staged implementation and acceptance gates

Do not automatically progress to the next numbered stage. Finish the active stage, provide evidence, update progress, and wait for Guy to authorize the next stage. Within a stage, make routine engineering decisions and keep working. Ask only for material missing input or a product/design decision. Do not repeatedly request approval for already authorized work.

### Stage 1 — Inspect and map the existing design

Inspect repository instructions, existing code, the Claude Design export, assets, and supplied flows. Create the inventory/gap/plan/progress documents. Determine which code can be reused and which requires native conversion. Map every supplied screen and interaction; do not reduce coverage to a few demonstration screens.

Acceptance: full inventory with source references, explicit gaps, chosen project structure, documented dependencies, and an exact Stage 2 implementation plan. No invented screens or product behavior.

### Stage 2 — Native foundation and complete design implementation

Create the Expo/TypeScript native project and reusable design system. Implement all supplied mobile screens and their approved navigation in manageable screen groups. Track corresponding web screens and implement the supplied web designs in the supporting Next.js app within this stage, after the mobile shell. Keep infrastructure lightweight and adapt an existing suitable repository.

No live backend behavior is implied by this stage. Use real local UI interactions where appropriate; leave unconnected service actions explicitly unavailable. Use approved empty states in the runtime. Use reference fixtures only in a separate component-preview/test environment for visual comparison of populated states.

Run a small HealthKit native feasibility spike alongside this stage, not a new product UI. If signing/device access is unavailable, finish independent UI work and report the spike as unverified.

Acceptance: all supplied screens accounted for; navigation and local interactions work; design comparison evidence; RTL/LTR and accessibility checks; no normal-runtime fixtures; real native build evidence or exact environment blockers. Visual status and functional status reported separately.

### Stage 3 — First real end-to-end data flow

Connect real account access and minimum persisted profile, backend/migrations, and manual glucose entry through an existing designed card. Implement entry -> confirmation -> persistence -> timeline/dashboard -> reload. Add editing, offline pending state, validation, ownership checks, and idempotent retry.

Acceptance: a measurement entered on a test account survives restart and is returned by the server; another account cannot access it; retries do not duplicate it; failure is not shown as success. No fixture-backed endpoints.

### Stage 4 — Real health integration

Promote the verified HealthKit spike into the actual ingestion path and existing connection screens. Implement Health Connect as the Android counterpart with its own capability matrix and device verification. Preserve manual records and existing history.

Acceptance: real authorized records appear with correct source/time/unit; reimport is idempotent; missing/stale/partial data is represented honestly; permission and offline behavior is tested; platform-specific gaps are recorded. Do not claim both platforms are verified if only one was tested.

### Stage 5 — Connect remaining features one vertical slice at a time

Suggested order: text companion and controlled tools -> persistent memory and durable follow-ups -> real voice conversation -> real meal-photo analysis and correction -> evidence-backed insights -> membership and remaining account/privacy functionality. Follow dependencies and Guy's priorities. Connect each slice to existing screens rather than inventing new ones.

The target companion journey is: user speaks/types a reading, confirms it, sees it persisted, requests a follow-up, receives the scheduled reminder, and resumes the same conversation with context. Verify interrupted speech, ambiguous numbers, duplicate tool calls, offline conditions, and duplicate jobs.

Acceptance for each slice: actual provider/service integration, persisted effects, meaningful error handling, relevant automated tests, and observed user flow. An integration requiring unavailable credentials stays explicitly blocked, never simulated.

### Stage 6 — Full product verification and release preparation

Verify the complete screen inventory, four-language journeys, device builds, accessibility, reduced motion, privacy flows, account deletion/export, sync recovery, AI failure paths, billing state integrity, and responsive web behavior. Review integration and clinical gaps before making launch claims.

Acceptance: requirement coverage matrix with evidence and explicitly unresolved items, reproducible build/run instructions, environment-variable documentation without secrets, migration instructions, and an accurate release-readiness report.

Do not deploy publicly, submit to app stores, buy services, or run destructive migrations against production without explicit authorization. Local development and relevant tests within the active stage are authorized.

## 12. Validation and progress reporting

Use meaningful tests for data conversion, authentication/ownership, idempotency, sync corrections, offline recovery, tool effects, and durable reminders. Use visual comparison and real-device checks for UI/platform behavior. Do not inflate coverage with tests that merely repeat implementation constants.

At each stage report:

1. What changed and which existing design screens it implements.
2. What is functional versus visually implemented only.
3. What was actually tested, on which environment/device, and the result.
4. Remaining gaps, unavailable credentials, and decisions required.
5. Files changed and the next stage's concrete scope.

Keep the progress document current so a new Claude session can continue without reconstructing decisions. Record approved changes and their rationale. Preserve user work and avoid unrelated refactors.

## 13. Decisions that remain open

Final product name; supplied design's actual completeness/export format; authentication provider; hosting/data residency; retention policy; native health bridge selection; verified pump/CGM access; food provider and plan; voice/model provider and multilingual quality; membership pricing/trial duration; launch jurisdictions; clinical review and any regulatory pathway; future pediatric/caregiver scope.

Choose reversible internal implementation details yourself and document them. Ask Guy only when an unresolved choice changes visible product behavior, cost, data handling, clinical scope, or deployment. Do not block independent work on unrelated open decisions.

## 14. First action — begin now

Start Stage 1. Inspect the current repository and supplied Claude Design deliverable, then create the mapping and implementation documents. If the design export is missing, ask Guy for it once and continue repository inspection and nonvisual planning. Do not start inventing screens, seeding data, selecting paid services, or claiming health integration works.

Finish Stage 1 with the exact design inventory, gaps, and a concrete proposal for Stage 2. The objective is faithful implementation of the existing complete design, followed by real functionality in reviewable increments.

## Reference starting points

These are starting points for implementation verification, not a claim that every integration is already available or validated. Check current official documentation before choosing packages, features, or plans.

- Expo development builds: https://docs.expo.dev/develop/development-builds/introduction/
- Expo native code: https://docs.expo.dev/workflow/customizing/
- HealthKit: https://developer.apple.com/documentation/healthkit
- HealthKit configuration: https://developer.apple.com/documentation/xcode/configuring-healthkit-access
- Health Connect: https://developer.android.com/health-and-fitness/health-connect
- LogMeal documentation: https://docs.logmeal.com/
- Passio Nutrition AI documentation: https://passio.gitbook.io/nutrition-ai/
- MedGemma: https://developers.google.com/health-ai-developer-foundations/medgemma/model-card

End of handoff.
