-- Tabelle für manuelle Synonym-Paare (z.B. Rüebli/Karotten).
-- Wird bei der Duplikaterkennung zusätzlich zu pg_trgm-Ähnlichkeit verwendet.

CREATE TABLE public.product_synonyms (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name_a     TEXT NOT NULL,
  name_b     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (name_a, name_b)
);

-- RLS aktivieren
ALTER TABLE public.product_synonyms ENABLE ROW LEVEL SECURITY;

-- Lese-Zugriff für alle authentifizierten Benutzer
CREATE POLICY "product_synonyms_select"
  ON public.product_synonyms FOR SELECT
  TO authenticated
  USING (true);

-- Schreibzugriff nur für Admins
CREATE POLICY "product_synonyms_insert"
  ON public.product_synonyms FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "product_synonyms_update"
  ON public.product_synonyms FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "product_synonyms_delete"
  ON public.product_synonyms FOR DELETE
  TO authenticated
  USING (is_admin());

-- Berechtigungen
GRANT SELECT ON public.product_synonyms TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_synonyms TO authenticated;

-- Audit-Trigger
CREATE TRIGGER trg_product_synonyms_updated_at
  BEFORE UPDATE ON public.product_synonyms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_product_synonyms_updated_by
  BEFORE INSERT OR UPDATE ON public.product_synonyms
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();
