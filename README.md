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
| `services/api` | FastAPI + PostgreSQL API | `fisha/diabetic-api` |
| `packages/` | Shared design tokens, translations and API types | this repository |
| `docs/` | Progress, plan, design gaps, integration status | this repository |

To use the app with the local server (accounts, saved readings), start the API first (`services/api/README.md`:
Docker Desktop and uv), then:

```
cd apps/mobile && EXPO_PUBLIC_API_URL=http://localhost:8000 npx expo start --web
```

On a phone on the same Wi-Fi, use the Mac's LAN address instead of `localhost` and add it to `STEADY_CORS_ORIGINS`
only for browser use (native apps don't need CORS).

Requirements: Node 22.18 or newer, pnpm 10 (via corepack). The iOS Simulator needs Xcode.
`pnpm check` runs the import guard, type checks, lint and tests.
