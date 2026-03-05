-- Migration: unit_conversion_products Tabelle erstellen
-- Produktspezifische Einheitenumrechnungen.
-- Ersetzt das Firestore-Dokument masterData/unitConversionProducts.

CREATE TABLE public.unit_conversion_products (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid  TEXT,
  from_unit     TEXT NOT NULL REFERENCES public.units(key) ON DELETE CASCADE,
  to_unit       TEXT NOT NULL REFERENCES public.units(key) ON DELETE CASCADE,
  numerator     INTEGER NOT NULL DEFAULT 1,
  denominator   INTEGER NOT NULL DEFAULT 1,
  product_id    TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.unit_conversion_products ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten Benutzer duerfen lesen
CREATE POLICY unit_conversion_products_select ON public.unit_conversion_products
  FOR SELECT TO authenticated USING (true);

-- Nur Admins duerfen schreiben
CREATE POLICY unit_conversion_products_insert ON public.unit_conversion_products
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY unit_conversion_products_update ON public.unit_conversion_products
  FOR UPDATE USING (is_admin());

CREATE POLICY unit_conversion_products_delete ON public.unit_conversion_products
  FOR DELETE USING (is_admin());

GRANT SELECT ON public.unit_conversion_products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.unit_conversion_products TO authenticated;

CREATE TRIGGER trg_unit_conversion_products_updated_at
  BEFORE UPDATE ON public.unit_conversion_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_unit_conversion_products_updated_by
  BEFORE INSERT OR UPDATE ON public.unit_conversion_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();
