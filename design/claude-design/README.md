# Claude Design export (reference only)

- Source: Claude Design canvas "Steady — T1D companion design", https://claude.ai/artifact/WYuW5K5Be1Y42WZ8PR92Ni
- Version: `1794329313-76e8`, published 10 Nov 2026 (direction B: clean white, with day and night)
- `boards/*.dc.html` are browser prototypes in the Claude Design format: an HTML template and a `DCLogic` class.
  They need the canvas runtime (`support.js`, which is not included), so they will not run on their own.
- `handoff.md` and `tokens.json` are the design-side handoff and the token values for day and night.

Rules:
- Never import anything from this folder at runtime.
- All glucose, meal, insulin, profile and price values here are demonstration data.
- Where this design and the engineering brief disagree, see `docs/design-gaps.md`.
