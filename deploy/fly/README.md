# Stedio on Fly.io

Decided 16 Nov 2026 (Guy): move the server off the Mac to Fly.io, org `stedio`, smallest machines, region as close to
Israel as possible. Fly has no region in Israel or the Middle East; **fra (Frankfurt)** is the closest.

| App | What | Machine | Always on | Address |
|---|---|---|---|---|
| `stedio-db` | PostgreSQL 16, volume `stedio_db` (1 GB) | shared-cpu-1x, 256 MB + 512 MB swap | yes | `stedio-db.internal:5432` (private network only) |
| `stedio-api` | FastAPI + the in-process worker, volume `stedio_media` (1 GB, meal photos and exports) | shared-cpu-1x, 512 MB + 512 MB swap | yes (syncs, alerts, pushes, retrain, voice) | https://stedio-api.fly.dev |
| `stedio-web` | Next.js website, the app's web build at `/app`, tester install page at `/install` | shared-cpu-1x, 256 MB | no: stops when idle, starts on the next visit | https://stedio-web.fly.dev |

Files: `deploy/fly/{db,api,web}/fly.toml`, `deploy/fly/db/*` (image, start and backup scripts),
`deploy/fly/web/Dockerfile` (context: repository root, `.dockerignore` at the root), `services/api/Dockerfile` and
`services/api/deploy/start.sh`. Everything is driven by `scripts/fly/stedio-fly` on the Mac (`stedio-fly help`).
Never run `fly launch` (it rewrites fly.toml and adds machines).

## Backups (health data)

1. Fly snapshots each volume every day: 30 days kept for the database, 14 for photos (`fly volumes snapshots list`).
2. The database machine writes a `pg_dump` to `/data/backups` every night after 01:00 UTC and keeps 14 days.
   `stedio-fly backup` takes one on demand; `deploy-api` takes one before every deploy (migrations run in the release
   command). Restore: `fly ssh console -a stedio-db`, then `pg_restore -U steady -h /var/run/postgresql --clean -d steady <file>`.

## Secrets

Only in Fly (`fly secrets list -a stedio-api` shows names). `stedio-fly secrets` fills missing ones from
`services/api/.env` on the Mac and never overwrites one already on Fly. The database password is made by
`stedio-fly setup` and never shown. The APNs key file travels as `STEADY_APNS_KEY_P8_B64` (base64) and `start.sh`
writes it back to a file. `STEADY_JWT_SECRET` must stay the Mac's: it also unlocks sealed CareLink sign-ins and photos.

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

## Cost (Fly list prices, Nov 2026, before any regional markup)

About $3.19 (API 512 MB) + $1.94 (database 256 MB) + volumes 2 x $0.15 + website only while running (cents) +
snapshots (first 10 GB free) ≈ **$5.5–6 a month**. Shared IPv4 and the fly.dev addresses are free.
