-- Migration: global_settings Tabelle erstellen
-- Singleton-Tabelle für globale Einstellungen (allowSignUp, maintenanceMode).
-- Ersetzt das Firestore-Dokument _configuration/globalSettings.

-- Trigger-Funktion: setzt updated_by automatisch auf den aktuellen
-- Supabase-Auth-User (auth.uid()). Bei Service-Role-Zugriffen (kein JWT)
-- wird NULL gesetzt.
CREATE OR REPLACE FUNCTION update_updated_by()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

CREATE TABLE public.global_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  allow_sign_up BOOLEAN NOT NULL DEFAULT false,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT single_row CHECK (id = 'default')
);

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- Jeder darf lesen (SignIn-Seite braucht maintenanceMode vor Auth)
CREATE POLICY global_settings_select ON public.global_settings
  FOR SELECT USING (true);

-- Nur Admins dürfen schreiben
CREATE POLICY global_settings_update ON public.global_settings
  FOR UPDATE USING (is_admin());

GRANT SELECT ON public.global_settings TO anon, authenticated;
GRANT UPDATE ON public.global_settings TO authenticated;

CREATE TRIGGER trg_global_settings_updated_at
  BEFORE UPDATE ON public.global_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_global_settings_updated_by
  BEFORE INSERT OR UPDATE ON public.global_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- Standardzeile einfügen
INSERT INTO public.global_settings (id) VALUES ('default');
