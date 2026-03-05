-- Migration: units Tabelle erstellen
-- Stammdaten-Tabelle fuer Einheiten (z.B. kg, l, Stk).
-- Ersetzt das Firestore-Dokument masterData/units.

CREATE TABLE public.units (
  key           TEXT PRIMARY KEY NOT NULL,
  firebase_uid  TEXT,
  name          TEXT NOT NULL DEFAULT '',
  dimension     TEXT NOT NULL DEFAULT 'DLS' CHECK (dimension IN ('VOL', 'MAS', 'DLS')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten Benutzer duerfen lesen
CREATE POLICY units_select ON public.units
  FOR SELECT TO authenticated USING (true);

-- Nur Admins duerfen schreiben
CREATE POLICY units_insert ON public.units
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY units_update ON public.units
  FOR UPDATE USING (is_admin());

CREATE POLICY units_delete ON public.units
  FOR DELETE USING (is_admin());

GRANT SELECT ON public.units TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.units TO authenticated;

CREATE TRIGGER trg_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_units_updated_by
  BEFORE INSERT OR UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();
