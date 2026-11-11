# Diabetes companion: working rules

Read these first, every session:
1. `docs/progress.md`: the current stage and the exact next action.
2. `docs/handoff/Diabetes_Companion_Claude_Code_Handoff.md`: the engineering brief. Its hard rules always apply.
3. `docs/design-inventory.md` and `docs/design-gaps.md`.

Key rules from the brief:
- Communicate with Guy in Hebrew. Code, identifiers and docs are in English.
- Work stage by stage. Do not start the next stage without Guy's explicit approval.
- `design/claude-design/` is visual reference only. Never import it at runtime, and its demo data never reaches the
  app.
- No fake data, mock success, timers that pretend work is done, or fixture fallbacks in the normal runtime. Fixtures
  live only in `tests/fixtures` and preview builds.
- Never add screens, flows or features that are not in the design without approval. Missing states go to
  `docs/design-gaps.md`.
- Never claim a build, test or integration works without running it. Track visual and functional status
  separately.
- No dose recommendations, invented clinical thresholds or escalation text.
- Update `docs/progress.md` and `docs/integration-status.md` at the end of each work session.

## Repository layout

`fisha/diabetic` is the main repository. Three parts are separate repositories, linked as git submodules:

| Path | Repository |
|---|---|
| `apps/mobile` | `fisha/diabetic-app` |
| `apps/web` | `fisha/diabetic-web` |
| `services/api` | `fisha/diabetic-api` |

Shared packages (`packages/tokens`, `packages/i18n`), docs, design references and tooling stay in the main
repository, so the app and the website build only from a full checkout (`git clone --recurse-submodules`).
A change inside a submodule is committed and pushed in that repository first, then the main repository commits the
new submodule pointer.
