-- Migration: materials Tabelle erstellen
-- Stammdaten-Tabelle fuer Materialien (Verbrauchsmaterial, Gebrauchsmaterial).
-- Ersetzt das Firestore-Dokument masterData/materials.

-- Enum fuer Materialtypen: selbstdokumentierend, DB-seitig typsicher.
-- Werte entsprechen MaterialType in material.class.ts (none=0, consumable=1, usage=2).
CREATE TYPE public.material_type AS ENUM ('none', 'consumable', 'usage');

CREATE TABLE public.materials (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid  TEXT,
  name          TEXT NOT NULL DEFAULT '',
  type          public.material_type NOT NULL DEFAULT 'consumable',
  usable        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten Benutzer duerfen lesen
CREATE POLICY materials_select ON public.materials
  FOR SELECT TO authenticated USING (true);

-- Alle authentifizierten Benutzer duerfen neue Materialien erstellen
CREATE POLICY materials_insert ON public.materials
  FOR INSERT TO authenticated WITH CHECK (true);

-- Nur Admins duerfen aendern und loeschen
CREATE POLICY materials_update ON public.materials
  FOR UPDATE USING (is_admin());

CREATE POLICY materials_delete ON public.materials
  FOR DELETE USING (is_admin());

GRANT SELECT, INSERT ON public.materials TO authenticated;
GRANT UPDATE, DELETE ON public.materials TO authenticated;

CREATE TRIGGER trg_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_materials_updated_by
  BEFORE INSERT OR UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();
