# Design comparison (step 2.10)

Dev-only tooling. Nothing here is imported by the apps.

1. `node tools/design-compare/render-boards.js design/claude-design/boards <out> tools/design-compare/boards.txt`
   renders each board state at 390 × 844. Spec lines are `Board|name|{props}|{state}`.
   The committed renders are in `design/reference-screens/`.
2. Export the mobile app for the web in the preview variant:
   `EXPO_OFFLINE=1 EXPO_PUBLIC_APP_VARIANT=preview npx expo export --platform web --output-dir <webdir>` (in `apps/mobile`).
3. `node tools/design-compare/shoot-app.js <webdir> <appshots> tools/design-compare/app.txt`
   serves the export and shoots each route. Spec lines are `route|day|night|locale|click:...`.
4. `python3 tools/design-compare/sheets.py <appshots> <sheets>` pairs line N of `names.json` (design) with line N of
   `app.txt` (app) and writes sheets of four pairs, design on the left.
   Run it from a folder that holds `ref/` (the board renders), `names.json` and `app.txt`.

Needs Playwright with Chromium, and Python with Pillow. The web export has no status bar inset, so app screens sit
about 54 px higher than the boards; that is not a difference.
