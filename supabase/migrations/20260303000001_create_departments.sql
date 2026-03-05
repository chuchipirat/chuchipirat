-- Migration: departments Tabelle erstellen
-- Stammdaten-Tabelle fuer Abteilungen (z.B. Gemuese, Milchprodukte).
-- Ersetzt das Firestore-Dokument masterData/departments.

CREATE TABLE public.departments (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid  TEXT,
  name          TEXT NOT NULL DEFAULT '',
  pos           INTEGER NOT NULL DEFAULT 0,
  usable        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten Benutzer duerfen lesen
CREATE POLICY departments_select ON public.departments
  FOR SELECT TO authenticated USING (true);

-- Nur Admins duerfen schreiben
CREATE POLICY departments_insert ON public.departments
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY departments_update ON public.departments
  FOR UPDATE USING (is_admin());

CREATE POLICY departments_delete ON public.departments
  FOR DELETE USING (is_admin());

GRANT SELECT ON public.departments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.departments TO authenticated;

CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_departments_updated_by
  BEFORE INSERT OR UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();
