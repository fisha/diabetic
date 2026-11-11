# Steady

Type 1 diabetes companion: mobile app, website with web dashboard, and API.

```
git clone --recurse-submodules git@github.com:fisha/diabetic.git
cd diabetic
corepack enable && pnpm install
cd apps/mobile && npx expo start --web    # the app in the browser; all screens at /dev/screens
pnpm web                                  # website and dashboard, http://localhost:3000 (from the main folder)
```

| Path | What | Repository |
|---|---|---|
| `apps/mobile` | Expo app (iOS, Android) | `fisha/diabetic-app` |
| `apps/web` | Next.js website and dashboard | `fisha/diabetic-web` |
| `services/api` | API (Stage 3, not started) | `fisha/diabetic-api` |
| `packages/` | Shared design tokens and translations | this repository |
| `docs/` | Progress, plan, design gaps, integration status | this repository |

Requirements: Node 22.18 or newer, pnpm 10 (via corepack). The iOS Simulator needs Xcode.
`pnpm check` runs the import guard, type checks, lint and tests.
