-- ============================================================
-- Phase 13.5: Mail-Log-Tabelle
--
-- Speichert die Historie aller über die Mail-Konsole versendeten
-- E-Mails. Ersetzt die Firebase-Mailbox-Kollektion.
-- ============================================================

CREATE TABLE public.mail_log (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  recipients        JSONB NOT NULL DEFAULT '[]'::JSONB,
  recipient_type    TEXT NOT NULL DEFAULT 'email',  -- 'email', 'uid', 'role'
  subject           TEXT NOT NULL DEFAULT '',
  body              TEXT NOT NULL DEFAULT '',
  template_name     TEXT,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_by           UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  delivery_status   TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'success', 'error'
  error_message     TEXT,
  details           JSONB
);

ALTER TABLE public.mail_log ENABLE ROW LEVEL SECURITY;

-- Nur authentifizierte Benutzer dürfen lesen
CREATE POLICY mail_log_select ON public.mail_log
  FOR SELECT TO authenticated USING (true);

-- Nur der Service-Role-Key darf schreiben (Edge Function)
CREATE POLICY mail_log_insert ON public.mail_log
  FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT, INSERT ON public.mail_log TO authenticated;

-- Indizes
CREATE INDEX idx_mail_log_sent_at ON public.mail_log (sent_at DESC);
CREATE INDEX idx_mail_log_delivery_status ON public.mail_log (delivery_status);
