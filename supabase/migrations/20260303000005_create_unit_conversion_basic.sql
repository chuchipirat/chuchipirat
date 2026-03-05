-- Migration: unit_conversion_basic Tabelle erstellen
-- Standard-Einheitenumrechnungen (nicht produktspezifisch).
-- Ersetzt das Firestore-Dokument masterData/unitConversionBasic.

CREATE TABLE public.unit_conversion_basic (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid  TEXT,
  from_unit     TEXT NOT NULL REFERENCES public.units(key) ON DELETE CASCADE,
  to_unit       TEXT NOT NULL REFERENCES public.units(key) ON DELETE CASCADE,
  numerator     INTEGER NOT NULL DEFAULT 1,
  denominator   INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.unit_conversion_basic ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten Benutzer duerfen lesen
CREATE POLICY unit_conversion_basic_select ON public.unit_conversion_basic
  FOR SELECT TO authenticated USING (true);

-- Nur Admins duerfen schreiben
CREATE POLICY unit_conversion_basic_insert ON public.unit_conversion_basic
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY unit_conversion_basic_update ON public.unit_conversion_basic
  FOR UPDATE USING (is_admin());

CREATE POLICY unit_conversion_basic_delete ON public.unit_conversion_basic
  FOR DELETE USING (is_admin());

GRANT SELECT ON public.unit_conversion_basic TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.unit_conversion_basic TO authenticated;

CREATE TRIGGER trg_unit_conversion_basic_updated_at
  BEFORE UPDATE ON public.unit_conversion_basic
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_unit_conversion_basic_updated_by
  BEFORE INSERT OR UPDATE ON public.unit_conversion_basic
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();
