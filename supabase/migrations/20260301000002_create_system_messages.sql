-- Migration: system_messages Tabelle erstellen
-- Multi-Row-Tabelle für Systemmeldungen (Alert-Banner auf der Startseite).
-- Ersetzt das Firestore-Dokument _configuration/systemMessage.

CREATE TABLE public.system_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  title TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('success','info','warning','error')),
  valid_to TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.system_messages ENABLE ROW LEVEL SECURITY;

-- Jeder darf lesen (Startseite zeigt Meldung auch ohne Auth)
CREATE POLICY system_messages_select ON public.system_messages
  FOR SELECT USING (true);

-- Nur Admins dürfen schreiben
CREATE POLICY system_messages_update ON public.system_messages
  FOR UPDATE USING (is_admin());

-- Nur Admins dürfen einfügen
CREATE POLICY system_messages_insert ON public.system_messages
  FOR INSERT WITH CHECK (is_admin());

-- Nur Admins dürfen löschen
CREATE POLICY system_messages_delete ON public.system_messages
  FOR DELETE USING (is_admin());

GRANT SELECT ON public.system_messages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.system_messages TO authenticated;

CREATE TRIGGER trg_system_messages_updated_at
  BEFORE UPDATE ON public.system_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_system_messages_updated_by
  BEFORE INSERT OR UPDATE ON public.system_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();
