-- =========================================================================
-- Migration: pg_net Extension + cron_job_log Grants
-- =========================================================================
-- Die Willkommens-E-Mail wird jetzt vom Client (verifyEmail.tsx) nach
-- erfolgreicher E-Mail-Verifizierung gesendet. Der DB-Trigger wurde
-- in 20260322000003_unify_user_id.sql entfernt.
--
-- Diese Migration behält nur die pg_net Extension und die cron_job_log
-- Grants bei, die von anderen Funktionen (Cron-Jobs) benötigt werden.
-- =========================================================================

-- pg_net Extension aktivieren (benötigt von Cron-Jobs)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grants: Service Role muss in cron_job_log schreiben können
GRANT INSERT, UPDATE ON public.cron_job_log TO service_role;
