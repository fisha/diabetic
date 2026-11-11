# Steady (working name): developer handoff
Design canvas: https://claude.ai/artifact/WYuW5K5Be1Y42WZ8PR92Ni (boards 00 to 15). Screen ids are listed on board 14.

## Visual direction
Direction B: clean white, system font, flat grouped surfaces, one teal accent. Every colour token has a day and a night value (tokens.json). Night is the inversion of day: black background, dark grey groups, light text. Default follows the system setting; the user can override in Profile, Accessibility, Appearance (system, day, night). Glucose marks keep their hue in both modes.

## Repository shape
```
apps/mobile (Expo SDK, expo-router, TypeScript strict)
  app/
    (auth)/welcome.tsx  sign-up.tsx  sign-in.tsx  recover.tsx
    (onboarding)/[step].tsx          # ONB-01..21, one route, step registry
    (tabs)/_layout.tsx               # custom tab bar with centre Quick log
    (tabs)/companion/index.tsx       # COM-01/02
    (tabs)/overview/index.tsx  insight/[id].tsx
    (tabs)/journal/index.tsx   entry/[id].tsx
    (tabs)/profile/...               # SET-*, SUB-*, RTN-06 memory
    (sheets)/log/[type].tsx          # presentation: 'formSheet' or gorhom
    (sheets)/reminder/[id].tsx
    meal/(flow)/start|camera|review|saved
  src/theme  src/i18n  src/components  src/features/*  src/data
apps/web (Next.js App Router)
  app/[locale]/(marketing)/page.tsx  pricing  privacy  faq
  app/[locale]/(dashboard)/overview  timeline  insights  settings  export
packages/tokens   (tokens.json -> tokens.ts + tokens.css via Style Dictionary)
packages/i18n     (ICU messages en/he/ar/ru, shared ids)
packages/schema   (zod: Entry, Reading, Dose, Meal, Reminder, Insight, Consent)
packages/api      (typed client, offline queue contract)
```

## Libraries
| Need | Expo / React Native | Next.js |
|---|---|---|
| Navigation | expo-router (Stack, Tabs, modal and formSheet presentation) | Next.js App Router |
| Safe areas | react-native-safe-area-context | n/a |
| Bottom sheets | @gorhom/bottom-sheet | Radix Dialog / Vaul |
| Keyboard | react-native-keyboard-controller | n/a |
| Animation | react-native-reanimated, react-native-gesture-handler | CSS transitions, Framer Motion optional |
| Microphone and playback | expo-audio (recording with metering, playback) | n/a |
| Realtime voice | WebSocket / WebRTC client to the voice provider (provider open) | n/a |
| Speech fallback | expo-speech for offline text-to-speech of short system lines | n/a |
| Camera | expo-camera (CameraView) | <input type=file accept=image/*> |
| Photo library | expo-image-picker | same |
| Image resize | expo-image-manipulator (max 1600 px, JPEG 0.8, strip EXIF location) | sharp on server |
| Notifications | expo-notifications (categories, actions, deep links) | Web Push later |
| Purchases | react-native-purchases (RevenueCat) over StoreKit 2 / Play Billing | Stripe Checkout and customer portal |
| Charts | react-native-svg (hand-built paths); victory-native optional | SVG / visx |
| Haptics | expo-haptics (selection on chip, success on save) | n/a |
| Secure storage | expo-secure-store (tokens) | httpOnly cookies |
| Local data | expo-sqlite + offline mutation queue | n/a |
| Localization | expo-localization + i18next with ICU; I18nManager for RTL | next-intl |
| Accessibility | AccessibilityInfo (reduce motion, screen reader), allowFontScaling | prefers-reduced-motion, axe in CI |
| Fonts | Platform system font (no bundled fonts) | -apple-system stack; next/font for Inter, Heebo, IBM Plex Sans Arabic fallbacks |
| Day and night | useColorScheme + Appearance; ThemeProvider maps tokens day / night; user override stored in settings (system, day, night) | data-theme on <html>, prefers-color-scheme default, cookie for the override |

## Backend needs by interaction
| Interaction | Backend | Screens |
|---|---|---|
| Sign up, sign in, recover | Auth service with email link and password; session refresh; resume token for incomplete onboarding | AUTH-* |
| Consents | Versioned consent records: service (required), model training (opt-in), photo retention; audit trail | ONB-01, SET-10 |
| Profile and treatment | Profile store with per-field source and updated date; ratio schedule by time of day; unknown is a value | ONB-*, SET-02/03 |
| Voice conversation | Streaming speech in and out; barge-in; transcript stored; tool calls produce draft entries, never saved entries | COM-01 |
| Text conversation | Same conversation thread as voice; message status; retry | COM-02 |
| Extracted entries | Draft entity with fields + source utterance id; confirm creates Entry with provenance reported | COM-04 |
| Manual logging | Entry API with idempotency key; offline queue replays; conflict response returns server copy | COM-05..10, OVR-06 |
| Meal analysis | Server proxy to food recognition provider (LogMeal first, Passio alternative) behind one interface; provider name never sent to UI; returns items, portion options, nutrition or null | MEAL-04/06 |
| Food search | Nutrition database search through the same proxy | MEAL-08 |
| Familiarization | Per-user plan with day index; learned facts with evidence; summary at day 3 | RTN-01/02 |
| Check-ins and follow-ups | Scheduler with states scheduled, sent, opened, completed, snoozed, dismissed, withdrawn, not answered, expired; quiet hours; pause | RTN-03..05, RTN-07 |
| Memory | Memory items with category, source, created date; edit, delete, delete all; memory off stops writing and reading | RTN-06 |
| Insights | Pattern jobs over entries; each insight lists evidence ids and exclusions; feedback and mute stored | OVR-03/04 |
| Journal | Entry history (edits with reason), soft delete with undo window, duplicate detection, hide-from-summary flag | JRN-* |
| Devices (Planned) | Integration service per vendor; connection state machine as in SET-05; device readings tagged device recorded | SET-04/05 |
| Membership | RevenueCat entitlements + Stripe webhooks unify into one entitlement; trial length from remote config (7 or 14) | SUB-* |
| Export and delete | Async export job (CSV + PDF) with signed link; account deletion job with grace period; store subscription warning | SET-11/12, WD-05 |

## Accessibility
- Every interactive element has an accessible name, role and state; ids in the inventory become testID and accessibilityIdentifier.
- Touch targets at least 44 x 44 pt; primary buttons 52 to 56 pt.
- Text scales to 200% on native without truncation; layouts tested at 130% and 160% on this canvas.
- Contrast: body text at least 4.5:1, large text and graphical marks at least 3:1. Glucose states use label + shape + colour.
- The glucose graph has a one-sentence summary label and focusable hourly points (or a data table on web).
- The voice orb always has visible state text; captions available for every companion utterance; text mode is one tap away.
- Live regions announce saves, errors and the low reading panel (assertive only for the low reading panel).
- Reduced motion: no loops, sheets fade, orb static. Respect the system setting and the in-app switch.
- Focus order follows reading order and flips correctly in RTL; sheets trap focus and return it on close.
- No time limits on input; sessions resume drafts.

## Responsive
| Context | Width | Layout |
|---|---|---|
| Phone | < 768 | Single column, tab bar, sheets from bottom |
| Tablet (app) | 768 to 1023 | Two panes: conversation + context (companion), list + detail (journal), sheets become centred modals 560 wide |
| Website mobile | < 768 | Hero stacks, phone mock below copy, nav collapses to menu button, pricing cards stack |
| Website desktop | 1024 + | As drawn on board 09, content max 1200 |
| Dashboard | 1024 + | Sidebar 248 + content; below 1024 sidebar becomes top tabs; timeline table scrolls horizontally |

## Assets
| Asset | Naming | Folder |
|---|---|---|
| Icons | icon-{name}.svg, 24 grid, stroke 1.8 | assets/icons |
| Avatars | avatar-{a|b|c|d}.svg, orb.svg | assets/avatars |
| App icon | app-icon-1024.png, adaptive foreground / background | assets/brand |
| Splash | splash-day.png (white), splash-night.png (black) | assets/brand |
| Illustrations | empty-{journal|insights}.svg | assets/illustrations |
| Fonts | None bundled in the app; web fallbacks from Google Fonts (OFL) | n/a |

## Open decisions
| Decision | Options | Recommendation | Owner |
|---|---|---|---|
| Final pricing | [PRICE_MONTHLY], [PRICE_ANNUAL], annual saving | Set per market in the stores; UI reads prices from store | Product |
| Trial length | 7 or 14 days | 14 days, remote-config switch already designed | Product |
| Access after trial / lapse | Read-only, export only, or core logging free | Keep logging, journal and export; pause voice, insights, meal photo | Product |
| Meal recognition provider | LogMeal, Passio | Start with LogMeal behind a provider-neutral proxy | Engineering |
| Voice provider and voices | Catalog of 3 placeholder voices | Choose provider with barge-in and he / ar / ru quality | Engineering |
| CGM / pump integration | Medtronic (780G, Guardian 4), Dexcom, Abbott | Ship manual-first; pursue partner APIs; states already designed | Partnerships |
| Minors and guardians | Under 18 blocked, guardian-led, or teen with guardian link | Guardian-led accounts for under 18 at launch (age bands per country) | Legal |
| Low glucose guidance | Generic placeholder vs clinically approved copy | Clinician-written, per market, shown as information only | Clinical |
| Default target range | 70–180 mg/dL (3.9–10.0 mmol/L) or user-set | Use international consensus default, editable | Clinical |
| Regulatory classification | Wellness vs medical device software | Get a regulatory opinion before insights ship | Regulatory |
| Data retention | Photos, voice audio, transcripts, entries | Photos 30 days default, audio not kept, transcripts kept until deleted | Privacy |
| Model training consent | Opt-in scope and de-identification | Opt-in, off by default, revocable, separate from service | Privacy |
| Arabic grammatical gender and digits | Masculine default vs user choice; Western vs Arabic-Indic digits | Let users choose form of address; Western digits for clinical values | Localization |
| Product name | Steady is a working name | Run trademark search in all four markets | Brand |

## Build order
1. Tokens package, fonts, theme provider, RTL bootstrap, i18n with ICU.
2. Core components from board 12 with Storybook (native + web) and tests for states.
3. Auth and onboarding (ONB) with local draft persistence.
4. Entry schema, offline queue, manual logging sheets, journal with provenance.
5. Overview graph and summaries.
6. Companion text, then voice with drafts and confirmation cards.
7. Familiarization, check-ins, notifications, memory.
8. Meal photo flow through the provider proxy.
9. Membership with RevenueCat and Stripe; entitlement gating.
10. Website and dashboard; export and delete jobs.
