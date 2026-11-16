-- The research tool's own database login, stedio_research (Guy, 16 Nov 2026). Need to know: it reads only the tables
-- the tool shows (users: id, email and created_at only), and may only add rows to ml_jobs (the "Queue" buttons; the
-- API's worker runs the job). No chat, meals, notes, photos, exports or anything else. A new table the tool needs is
-- added here on purpose; nothing is granted by default. Sealed device sign-ins in device_links stay sealed: the
-- tool's server has no sealing key.
-- Idempotent. Run by `scripts/fly/stedio-fly research-setup` on stedio-db as the owner (steady), with the password in
-- the psql variable pw (never stored in this file).
\set ON_ERROR_STOP on
SELECT format('CREATE ROLE stedio_research LOGIN PASSWORD %L', :'pw')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stedio_research') \gexec
SELECT format('ALTER ROLE stedio_research LOGIN PASSWORD %L', :'pw') \gexec
ALTER ROLE stedio_research NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;
ALTER ROLE stedio_research SET statement_timeout = '60s';
ALTER ROLE stedio_research SET idle_in_transaction_session_timeout = '60s';
SELECT format('GRANT CONNECT ON DATABASE %I TO stedio_research', current_database()) \gexec
REVOKE CREATE ON SCHEMA public FROM stedio_research;
GRANT USAGE ON SCHEMA public TO stedio_research;
-- Start from nothing every run, so a table dropped from the list below loses its grant.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM stedio_research;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM stedio_research;
GRANT SELECT (id, email, created_at) ON users TO stedio_research;
GRANT SELECT ON consents, user_settings, profiles, device_links, glucose_records,
  insight_exposures, insight_events, insight_outcomes, ranking_decisions, ml_datasets, ml_models, ml_jobs
  TO stedio_research;
GRANT INSERT ON ml_jobs TO stedio_research;
