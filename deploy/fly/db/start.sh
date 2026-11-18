#!/bin/bash
# Starts PostgreSQL and, beside it, the nightly logical backup loop.
# Backups, two layers (health data):
#   1. Fly takes a snapshot of the whole volume every day (kept STEDIO_SNAPSHOT_DAYS, set when the volume is created).
#   2. This loop writes a pg_dump to /data/backups once a day (after BACKUP_HOUR_UTC); backup.sh keeps the newest BACKUP_KEEP_COUNT,
#      none older than BACKUP_KEEP_DAYS.
#      The dumps are on the volume, so the daily snapshots carry them too; `stedio-backup` also runs on demand
#      (scripts/fly/stedio-fly backup) before every migration.
set -euo pipefail

mkdir -p /data/backups
chown postgres:postgres /data/backups
chmod 700 /data/backups

(
  # Wait for the server to accept connections the first time.
  until pg_isready -q -h /var/run/postgresql -U "${POSTGRES_USER:-postgres}"; do sleep 5; done
  while true; do
    today="$(date -u +%F)"
    if [ "$(date -u +%H)" -ge "${BACKUP_HOUR_UTC:-1}" ] && ! ls /data/backups/"${POSTGRES_DB:-postgres}"-"$today"T*.dump >/dev/null 2>&1; then
      /usr/local/bin/stedio-backup || echo "stedio-backup: nightly backup FAILED" >&2
    fi
    sleep 900
  done
) &

# The official entrypoint: initialises PGDATA on the first start, then runs the server (as the postgres user).
exec docker-entrypoint.sh postgres \
  -c listen_addresses='*' \
  -c shared_buffers="${PG_SHARED_BUFFERS:-64MB}" \
  -c max_connections="${PG_MAX_CONNECTIONS:-40}" \
  -c work_mem=4MB \
  -c maintenance_work_mem=32MB \
  -c effective_cache_size=128MB \
  -c wal_compression=on \
  -c log_min_duration_statement=2000
