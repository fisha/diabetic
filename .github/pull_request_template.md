## What changed

<!-- Short description and why. Link the Jira task (PM-…). -->

## Checks run

<!-- Tests, type checks, lint, screenshots. Only what you actually ran. -->

## Regulatory and privacy check

Run the `regulatory-check` and `privacy-compliance` skills from `fisha/diabetic/.claude/skills/`. Mark each line.

- [ ] No dose, ratio, correction or treatment change is calculated, suggested or implied (code, prompts, copy)
- [ ] No clinical threshold of the app's own; only the person's own range
- [ ] No real-time glucose alarm: no sound, time-sensitive or critical interruption for glucose values
- [ ] Device integrations stay read-only; no new write to Apple Health / Health Connect without Guy's decision
- [ ] No medical claims in any of the four languages ("manage", "control", "prevent", "lower A1c", "balance")
- [ ] Health data: minimum collected, consent where needed, no new processor without a policy update
- [ ] Logs hold no values, text or tokens; new data is covered by export and deletion

At-risk items (with Jira open-item keys), or "none":
