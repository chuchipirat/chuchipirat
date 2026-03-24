-- =========================================================================
-- Migration: Cron-Job-Zeitpläne via pg_cron + pg_net
-- =========================================================================
-- Registriert die drei Cron-Jobs, die täglich Edge Functions aufrufen:
--   1. cron-event-review-email  — 01:00 UTC (02:00/03:00 Zürich)
--   2. cron-daily-digest        — 02:15 UTC (03:15/04:15 Zürich)
--   3. cron-support-user-cleanup — 02:30 UTC (03:30/04:30 Zürich)
--
-- Die Edge Functions werden via pg_net.http_post() asynchron aufgerufen.
-- Supabase-URL und Service-Role-Key werden als Postgres-Einstellungen
-- (app.supabase_url, app.service_role_key) erwartet.
-- =========================================================================

-- 1. pg_cron Extension aktivieren (benötigt superuser in self-hosted)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Dem postgres-User Zugriff auf das cron-Schema geben
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- 2. Cron-Jobs registrieren
-- Hinweis: Die Einstellungen app.supabase_url und app.service_role_key
-- müssen in postgresql.conf oder via ALTER SYSTEM gesetzt werden:
--   ALTER SYSTEM SET app.supabase_url = 'http://kong:8000';
--   ALTER SYSTEM SET app.service_role_key = 'eyJ...';
--   SELECT pg_reload_conf();

-- Job 1: Event-Review E-Mails (01:00 UTC)
SELECT cron.schedule(
  'cron-event-review-email',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/cron-event-review-email',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  );
  $$
);

-- Job 2: Daily Digest (02:15 UTC)
SELECT cron.schedule(
  'cron-daily-digest',
  '15 2 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/cron-daily-digest',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  );
  $$
);

-- Job 3: Support-User-Cleanup (02:30 UTC)
SELECT cron.schedule(
  'cron-support-user-cleanup',
  '30 2 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/cron-support-user-cleanup',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  );
  $$
);
