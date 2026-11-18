# Stedio on Fly.io

Decided 16 Nov 2026 (Guy): move the server off the Mac to Fly.io, org `stedio`, smallest machines, region as close to
Israel as possible. Fly has no region in Israel or the Middle East; **fra (Frankfurt)** is the closest.

| App | What | Machine | Always on | Address |
|---|---|---|---|---|
| `stedio-db` | PostgreSQL 16, volume `stedio_db` (1 GB) | shared-cpu-1x, 256 MB + 512 MB swap | yes | `stedio-db.internal:5432` (private network only) |
| `stedio-api` | FastAPI + the worker as a second, niced process (`steady_api.supervise`, PM-164; `STEADY_WORKER_PROCESS=false` for the old thread), volume `stedio_media` (1 GB, meal photos and exports) | shared-cpu-1x, 512 MB + 512 MB swap | yes (syncs, alerts, pushes, retrain, voice) | https://stedio-api.fly.dev |
| `stedio-web` | Next.js website, the app's web build at `/app`, tester install page at `/install` | shared-cpu-1x, 256 MB | no: stops when idle, starts on the next visit | https://stedio-web.fly.dev |
| `stedio-research` | Internal research tool (Streamlit), see below | shared-cpu-1x, 256 MB + 512 MB swap | no: stops when idle, starts on the next visit | https://stedio-research.fly.dev |

Files: `deploy/fly/{db,api,web}/fly.toml`, `deploy/fly/db/*` (image, start and backup scripts),
`deploy/fly/web/Dockerfile` (context: repository root, `.dockerignore` at the root), `services/api/Dockerfile` and
`services/api/deploy/start.sh`. Everything is driven by `scripts/fly/stedio-fly` on the Mac (`stedio-fly help`).
Never run `fly launch` (it rewrites fly.toml and adds machines).

## Backups (health data)

1. Fly snapshots each volume every day: 30 days kept for the database, 14 for photos (`fly volumes snapshots list`).
2. The database machine writes a `pg_dump` to `/data/backups` every night after 01:00 UTC. `stedio-fly backup` takes
   one on demand; `deploy-api` takes one before every deploy (migrations run in the release command). Each backup keeps
   the newest 10 dumps and none older than 14 days (`BACKUP_KEEP_COUNT`, `BACKUP_KEEP_DAYS` in `db/fly.toml`), and
   refuses to start when the volume would be left with less than `BACKUP_MIN_FREE_MB` (200) free, so a backup can never
   fill the disk Postgres writes to (PM-261: 74 dumps filled the 1 GB volume on 18 Nov 2026 and took production down).
   The script is part of the database image: a change to `db/backup.sh` applies after `stedio-fly deploy-db`. Restore: `fly ssh console -a stedio-db`, then `pg_restore -U steady -h /var/run/postgresql --clean -d steady <file>`.

## Secrets

Only in Fly (`fly secrets list -a stedio-api` shows names). `stedio-fly secrets` fills missing ones from
`services/api/.env` on the Mac and never overwrites one already on Fly. The database password is made by
`stedio-fly setup` and never shown. The APNs key file travels as `STEADY_APNS_KEY_P8_B64` (base64) and `start.sh`
writes it back to a file. `STEADY_JWT_SECRET` must stay the Mac's: it also unlocks sealed CareLink sign-ins and photos.

## A new native build

`stedio-fly deploy-web` stages the newest IPA and writes `install/latest.json` (`{"build": 17, "version": "0.6.0"}`)
from the IPA name (`stedio-<version>-<build>.ipa`), else from `release.json` in the install folder. The API reads it
(`STEADY_APP_LATEST_BUILD_URL` in `api/fly.toml`) at most every 10 minutes, so older installs are offered the new build
without `fly secrets set` (PM-217, 18 Nov 2026). `STEADY_APP_LATEST_BUILD` is only the fallback when the file can't
be read.

## Moving from the Mac

1. `stedio-fly setup`, `stedio-fly deploy-db`, `stedio-fly secrets`.
2. Trial: `stedio-fly deploy-api --trial` (worker OFF, so Fly does not sign in to CareLink/LibreLinkUp/Tandem or push
   to phones while the Mac does), `stedio-fly copy-data`, `stedio-fly deploy-web`. Check sign-in, data and the website.
3. Cutover: check no voice call is open on the Mac (`lsof -i :8010`), `stedio stop api`, `stedio-fly copy-data`,
   `stedio-fly deploy-api` (worker on). Then switch the app: set `EXPO_PUBLIC_API_URL` to https://stedio-api.fly.dev in
   the EAS `preview` environment and in `apps/mobile/eas.json` (testers), and publish the testers OTA (both runtimes).
4. Keep the Mac's database untouched until Guy agrees everything works; then stop the Mac services and tunnels.

## Status

16 Nov 2026: trial running on Fly (worker off), data copied from the Mac at 11:19 UTC, counts match. Waiting for
Guy's go-ahead for the cutover. Learned in the trial: uvicorn `--host ::` is IPv6-only (start.sh binds a dual-stack
socket); `grep -q` after a pipe fails under pipefail; ssh is not ready right after a deploy.

## Research tool (`stedio-research`)

Guy, 16 Nov 2026: host the research tool on Fly, smallest machine, not running all the time. It shows people's data,
so it is closed to everyone else:

- **Sign-in**: Google, only the accounts in `STEADY_RESEARCH_EMAILS` (verified email), once
  `STEADY_RESEARCH_GOOGLE_CLIENT_ID` and `STEADY_RESEARCH_GOOGLE_CLIENT_SECRET` are in `services/api/.env`. The Google
  OAuth client (Web application) needs the redirect URI `https://stedio-research.fly.dev/oauth2callback`; creating it
  is a Google console change and needs Guy's OK. Until then the gate is the access token (`STEADY_RESEARCH_TOKEN`, the
  same as the Mac's local tool). Neither set: the page stays closed.
- **Database**: its own login `stedio_research` (`deploy/fly/research/role.sql`): only the tables the tool shows
  (`users`: id, email, created_at only), insert on `ml_jobs` only, 5 connections, 60 s statement timeout. No chat,
  meals, notes or photos. It holds only the derived pseudonym key (`STEADY_ML_SUBJECT_KEY`), never the sealing key or
  the API's JWT secret.
- **Not indexed**: `X-Robots-Tag: noindex` on every response, a robots meta tag in the page, `robots.txt` allows
  crawling so the header is seen. Streamlit usage statistics are off.
- **Running**: the Machine stops when no tab is open and starts on the next visit (a few seconds).

```
scripts/fly/stedio-fly research-setup    # app, database login (new password each run), secrets
scripts/fly/stedio-fly deploy-research   # deploy, then checks health and the noindex header
```

After adding the Google settings to `.env`, run both again.

## Companion regression set on Fly (PM-203, Guy 17 Nov 2026)

`scripts/fly/stedio-fly evals [--repeat N] [--model M]` runs the companion's regression set (PM-198,
`evals/steady_evals/regression.py`, hard rules plus the judge, 3 repeats) on Fly, so no key is needed on a laptop.

- **Image**: `deploy/fly/evals/Dockerfile` with the build-only `deploy/fly/evals/fly.toml` (context: repository root, `Dockerfile.dockerignore` lets in only
  `services/api/steady_api`, its lock file and `evals/`). Pushed to the stedio-api registry as
  `evals-<api sha>-<root sha>`; nothing is deployed.
- **Run**: a one-off Machine in stedio-api (no services, no restart, label `stedio_role=evals`), so it gets the app's own
  `STEADY_OPENAI_API_KEY` and `STEADY_OPENAI_MODEL`. The key stays in the Machine's environment: it is never printed,
  logged or written. Synthetic held-out cases only; the run never opens the database. The script waits (up to 90
  minutes), reads the verdict from the Machine's log, saves it to `evals/reports/fly/` (git-ignored) and destroys the
  Machine.
- **Exit**: 0 passed (the API commit is kept in `evals/reports/fly/last-pass`), 1 a hard rule failed, 2 it did not run
  (no key, no network, provider down; never counted as a pass).
- **Before a deploy**: `deploy-api` runs it first when `steady_api/ai` or `steady_api/config.py` changed since the last
  passing run, and stops the deploy unless it passes. `STEDIO_SKIP_EVALS=1` deploys anyway with a warning; say why in
  the PR.
- **Cost**: one shared-cpu-1x 1 GB Machine for the run (cents) plus the OpenAI calls (about 115 replies and 115 judge
  calls per run with 3 repeats).

## Cost (Fly list prices, Nov 2026, before any regional markup)

About $3.19 (API 512 MB) + $1.94 (database 256 MB) + volumes 2 x $0.15 + website and research tool only while running (cents) +
snapshots (first 10 GB free) ≈ **$5.5–6 a month**. Shared IPv4 and the fly.dev addresses are free.
