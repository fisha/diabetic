---
name: regulatory-check
description: Check a Stedio change against the medical-device (SaMD, FDA, EU MDR, Israel AMAR) boundaries before merging. Use for any change to the companion prompts, insights, alerts, notifications, device or health integrations, onboarding, app or website copy, legal pages or store text.
---

# Regulatory check (medical-device boundaries)

Stedio must stay outside medical-device regulation. Software that calculates doses, gives treatment instructions,
raises real-time medical alarms or is *presented* as managing or treating diabetes can be a medical device (FDA SaMD;
EU MDR Rule 11, Class IIa or higher; Israel AMAR). What decides is what the software does **and** its stated intended
purpose, so wording counts as much as code. This is a product check, not legal advice.

Guy's rule (16 Nov 2026): every piece of development is checked against this skill. The audit that set these rules is
the Claude Doc "Stedio vs medical device rules - audit" (Jira PM-107, PM-108, PM-109).

## Intended purpose (the line every change must fit)

Stedio is a lifestyle, routine and reflection companion for people living with diabetes: it logs what they tell it,
organises their routine and supplies, and shows patterns in their own data. It is not a medical device and does not
diagnose, give dosing advice or provide treatment.

## How to run the check

1. List what the change touches: code paths, strings (all four languages in `packages/i18n/messages`), prompts
   (`services/api/steady_api/ai/prompt.py`, `interpret.py`), pushes, website and legal texts.
2. Go through every rule below. For each one, mark **pass**, **at risk** or **fail**, and name the file and line.
3. A **fail** blocks the merge. Fix it, or stop and ask Guy (a decision card) if the change is something he asked for.
4. An **at risk** item goes into the PR description and, if not fixed now, into Jira as an `open-item` task under the
   PM-12 epic (Privacy and legal).
5. Put the result in the PR under "Regulatory and privacy check" (see the PR template).

## Rules

### 1. Dosing and treatment (fail if broken)

- No insulin or medication amount, ratio, correction, basal change or treatment change is calculated, suggested or
  implied, in code, prompts or copy. Stored carb ratio, sensitivity, basal, max bolus and active insulin are only
  stored and displayed; they never feed a calculation and never go into the companion's context.
- The code-level dose filter (`steady_api/ai/safety.py`) stays on every companion reply, voice included. New reply
  paths must go through it. New phrasings need tests in `tests/test_safety.py`.
- No clinical threshold of the app's own (a mg/dL number, a number of minutes for insulin timing, a ketone level, a
  "safe" or "dangerous" value). Use only the person's own target range. Consensus metrics that are pure description
  (time in range against the person's range) are fine; new computed clinical estimates (like an A1c estimate) are at risk.
- No instruction triggered by a glucose value ("you are at X, do Y"). Prompting reflection is fine ("Do you know what
  happened? Checking the carb count is a good start"), and so is referring to the person's own care plan.
- Logging what the person says they already took is fine, with their confirmation. Never from a question.

### 2. Alerts and notifications (fail if broken)

- No real-time high/low alarm that competes with the sensor's or pump's own alarms: no sound, no time-sensitive or
  critical interruption, no urgent-low level, for anything about glucose values.
- Glucose notices are a quiet look back only (`steady_api/glucose_alerts.py`: an hour out of the person's own range,
  passive, no value in the text, "not an alarm", rely on the device alarms).
- Relaying a device's own alarms is at risk; supply logistics (reservoir, battery, sensor ending, set change) are fine.
- Routine prompts (meal check-ins, reminders the person set, summaries) are fine. They carry no medical claim.

### 3. Devices and health data (fail if broken)

- Device integrations are read-only: sign-in, token and data reads only. No command, bolus, basal, suspend or
  settings write to any pump, sensor or service, even if the service allows it.
- Writing glucose or insulin to Apple Health / Health Connect is at risk (other apps, including dosing apps, may read
  it). Any new write type needs Guy's decision.
- Lock screen, widgets and watch show data passively. Never add alarms to them.

### 4. Language and marketing (at risk, fail for clear claims)

- Fail: "manage your diabetes", "control your glucose", "lower your A1c", "prevent hypos/lows", "treats", "improves
  your diabetes", "keeps diabetes balanced", "follows the ADA Standards of Care", or any claim that the app improves a
  clinical outcome.
- Prefer: "reduce daily friction", "organise your routine", "notice patterns in your own data", "less to carry".
- Insights say they are patterns in the person's records, not causes and not treatment advice.
- Goals and onboarding options describe understanding, not outcomes ("Understand my lows", not "Fewer lows").
- The companion is a routine and reflection companion, not a mentor for treatment success.
- The "not a medical device" notice stays visible: website footer, onboarding, Settings/FAQ, terms.
- Check all four languages (en, he, ar, ru), not only English.

## Quick searches

```bash
# Dose-like wording and claims in copy
grep -nEi "manag|control|prevent|lower your|a1c|balance|treat|cure|safe|danger" packages/i18n/messages/en.json
grep -nE "לנהל|לשלוט|למנוע|איזון|לאזן|מסוכן|בטוח" packages/i18n/messages/he.json
# Thresholds and sounds in the API
grep -rnE "\b(54|70|180|250)\b|sound|critical|time-sensitive" services/api/steady_api --include=*.py
# Any write/command call in device integrations
grep -nE "\.(post|put|patch|delete)\(" services/api/steady_api/{carelink,tandem,cgm_share}.py
```

Every match needs a reason to stay. A new match is a finding until explained.
