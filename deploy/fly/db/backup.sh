#!/bin/bash
# One logical backup of the Stedio database into /data/backups, then prune old ones. Prints the file name and size only.
# Retention (PM-261): the newest BACKUP_KEEP_COUNT dumps, and none older than BACKUP_KEEP_DAYS. Every deploy-api takes a
# dump too, so a day-based limit alone filled the 1 GB volume on 18 Nov 2026 (74 dumps) and Postgres crashed writing WAL.
# Older history stays in Fly's daily volume snapshots (30 days).
set -euo pipefail
umask 077
db="${POSTGRES_DB:-postgres}"
user="${POSTGRES_USER:-postgres}"
keep="${BACKUP_KEEP_DAYS:-14}"
keep_count="${BACKUP_KEEP_COUNT:-10}"
min_free_mb="${BACKUP_MIN_FREE_MB:-200}"
dir=/data/backups
stamp="$(date -u +%FT%H%MZ)"
out="$dir/${db}-${stamp}.dump"
tmp="${out}.partial"

find "$dir" -name '*.partial' -mmin +120 -delete
# Never let a backup fill the disk Postgres writes to: the new dump needs about the size of the last one, and
# BACKUP_MIN_FREE_MB must stay free after it.
last="$(find "$dir" -maxdepth 1 -name "${db}-[0-9]*.dump" | sort | tail -n 1)"
last_mb=0
if [ -n "$last" ]; then last_mb="$(du -m "$last" | cut -f1)"; fi
need_mb=$(( min_free_mb + last_mb ))
free_mb="$(df -Pm "$dir" | awk 'NR == 2 { print $4 }')"
if [ "$free_mb" -lt "$need_mb" ]; then
  echo "stedio-backup: FAILED, only ${free_mb} MB free on the volume and ${need_mb} MB needed" >&2
  exit 1
fi

su postgres -s /bin/sh -c "pg_dump -h /var/run/postgresql -U '$user' -d '$db' -Fc -Z 6 -f '$tmp'"
# A dump that pg_restore cannot list is not a backup.
su postgres -s /bin/sh -c "pg_restore -l '$tmp' > /dev/null"
mv "$tmp" "$out"
find "$dir" -name "${db}-[0-9]*.dump" -mtime "+${keep}" -delete
# File names carry the UTC time, so a name sort is oldest first.
find "$dir" -maxdepth 1 -name "${db}-[0-9]*.dump" | sort | head -n "-${keep_count}" | xargs -r rm -f --
echo "stedio-backup: $(basename "$out") $(du -h "$out" | cut -f1), $(find "$dir" -maxdepth 1 -name "${db}-[0-9]*.dump" | wc -l) kept, $(df -Ph "$dir" | awk 'NR == 2 { print $4 }') free"
