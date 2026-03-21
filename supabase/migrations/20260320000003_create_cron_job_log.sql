-- ============================================================
-- Phase 13.4: Cron Job Log Tabelle
--
-- Speichert die Ausführungshistorie von geplanten Jobs.
-- Die Tabelle wird in Phase 14 von den migrierten Cron Jobs
-- befüllt und hier als Monitoring-Infrastruktur vorbereitet.
-- ============================================================

CREATE TABLE public.cron_job_log (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  job_name            TEXT NOT NULL,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at         TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'running',  -- 'running', 'success', 'error'
  duration_ms         INTEGER,
  records_processed   INTEGER DEFAULT 0,
  error_message       TEXT,
  details             JSONB
);

-- Nur Admins dürfen die Tabelle lesen
ALTER TABLE public.cron_job_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY cron_job_log_select ON public.cron_job_log
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.cron_job_log TO authenticated;

-- Index für häufige Abfragen
CREATE INDEX idx_cron_job_log_job_name ON public.cron_job_log (job_name, started_at DESC);
CREATE INDEX idx_cron_job_log_status   ON public.cron_job_log (status);
