#!/bin/bash
# One logical backup of the Stedio database into /data/backups, then prune old ones. Prints the file name and size only.
set -euo pipefail
umask 077
db="${POSTGRES_DB:-postgres}"
user="${POSTGRES_USER:-postgres}"
keep="${BACKUP_KEEP_DAYS:-14}"
stamp="$(date -u +%FT%H%MZ)"
out="/data/backups/${db}-${stamp}.dump"
tmp="${out}.partial"

su postgres -s /bin/sh -c "pg_dump -h /var/run/postgresql -U '$user' -d '$db' -Fc -Z 6 -f '$tmp'"
# A dump that pg_restore cannot list is not a backup.
su postgres -s /bin/sh -c "pg_restore -l '$tmp' > /dev/null"
mv "$tmp" "$out"
find /data/backups -name "${db}-*.dump" -mtime "+${keep}" -delete
find /data/backups -name '*.partial' -mmin +120 -delete
echo "stedio-backup: $(basename "$out") $(du -h "$out" | cut -f1)"
