-- Migration: products Tabelle erstellen
-- Stammdaten-Tabelle fuer Produkte (Zutaten).
-- Ersetzt das Firestore-Dokument masterData/products.

-- Enum fuer Diät-Klassifikation. Werte entsprechen Diet in product.class.ts
-- (Meat=1, Vegetarian=2, Vegan=3).
CREATE TYPE public.diet_type AS ENUM ('meat', 'vegetarian', 'vegan');

-- Enum fuer Allergene. Allergen.None (0) entspricht einem leeren Array,
-- daher kein 'none'-Wert noetig. Werte entsprechen Allergen in product.class.ts
-- (Lactose=1, Gluten=2).
CREATE TYPE public.allergen_type AS ENUM ('lactose', 'gluten');

CREATE TABLE public.products (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid    TEXT,
  name            TEXT NOT NULL DEFAULT '',
  name_singular   TEXT NOT NULL DEFAULT '',
  department_id   TEXT REFERENCES public.departments(id) ON DELETE SET NULL,
  shopping_unit   TEXT REFERENCES public.units(key) ON DELETE SET NULL,
  allergens       public.allergen_type[] NOT NULL DEFAULT '{}',
  diet            public.diet_type NOT NULL DEFAULT 'meat',
  usable          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten Benutzer duerfen lesen
CREATE POLICY products_select ON public.products
  FOR SELECT TO authenticated USING (true);

-- Alle authentifizierten Benutzer duerfen neue Produkte erstellen
CREATE POLICY products_insert ON public.products
  FOR INSERT TO authenticated WITH CHECK (true);

-- Nur Admins duerfen aendern und loeschen
CREATE POLICY products_update ON public.products
  FOR UPDATE USING (is_admin());

CREATE POLICY products_delete ON public.products
  FOR DELETE USING (is_admin());

GRANT SELECT, INSERT ON public.products TO authenticated;
GRANT UPDATE, DELETE ON public.products TO authenticated;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_products_updated_by
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();
