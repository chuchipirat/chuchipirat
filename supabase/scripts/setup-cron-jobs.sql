-- =============================================================================
-- Chuchipirat — Cron-Job-Registrierung (pg_cron + pg_net)
--
-- Dieses Script registriert alle Cron-Jobs für eine Umgebung.
-- Muss NACH dem Setup der Supabase-Instanz ausgeführt werden.
--
-- Voraussetzungen:
--   1. pg_cron und pg_net Extensions aktiviert
--   2. Postgres-Konfiguration gesetzt:
--      ALTER SYSTEM SET app.supabase_url = 'http://kong:8000';
--      ALTER SYSTEM SET app.service_role_key = '<SERVICE_ROLE_KEY>';
--      SELECT pg_reload_conf();
--
-- Anwendung:
--   Im Supabase Studio SQL Editor ausführen.
-- =============================================================================

-- Bestehende Jobs entfernen (idempotent)
SELECT cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname IN (
    'cron-daily-digest',
    'cron-support-user-cleanup',
    'cron-event-review-email',
    'cron-housekeeping'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Daily Digest — Tägliche Aktivitäts-Zusammenfassung für Community Leaders
--    Zeitplan: Täglich um 02:15 UTC (03:15/04:15 Zürich)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'cron-daily-digest',
  '15 2 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/cron-daily-digest',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Support-User Cleanup — Entfernt Support-User aus beendeten Events
--    Zeitplan: Täglich um 02:30 UTC (03:30/04:30 Zürich)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'cron-support-user-cleanup',
  '30 2 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/cron-support-user-cleanup',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Event Review Email — Feedback-E-Mail an Köche nach Anlass-Ende
--    Zeitplan: Täglich um 01:00 UTC (02:00/03:00 Zürich)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'cron-event-review-email',
  '0 1 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/cron-event-review-email',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Housekeeping — Wöchentliche Datenbank-Bereinigung
--    Zeitplan: Sonntag um 03:00 UTC (04:00/05:00 Zürich)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'cron-housekeeping',
  '0 3 * * 0',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/cron-housekeeping',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb
  )$$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Überprüfung
-- ─────────────────────────────────────────────────────────────────────────────
SELECT jobid, jobname, schedule FROM cron.job ORDER BY jobname;
