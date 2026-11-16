# Stedio's PostgreSQL on a Fly Machine with a volume (cheaper than Fly Managed Postgres; Guy, 16 Nov 2026).
# Same major version as the Mac (services/api/docker-compose.yml), so a pg_dump from the Mac restores as is.
ARG PG_IMAGE=postgres:16
FROM ${PG_IMAGE}
COPY backup.sh /usr/local/bin/stedio-backup
COPY start.sh /usr/local/bin/stedio-db-start
RUN chmod +x /usr/local/bin/stedio-backup /usr/local/bin/stedio-db-start
ENTRYPOINT ["/usr/local/bin/stedio-db-start"]
