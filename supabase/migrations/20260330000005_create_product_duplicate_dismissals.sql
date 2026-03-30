-- Tabelle für bestätigte/abgelehnte Duplikat-Paare.
-- Paare, die hier eingetragen sind, werden von find_similar_products() ausgeschlossen.
-- Die IDs werden normalisiert gespeichert (LEAST/GREATEST), damit (A,B) und (B,A)
-- als dasselbe Paar erkannt werden.

CREATE TABLE public.product_duplicate_dismissals (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  product_a_id  TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_b_id  TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Normalisierung: product_a_id < product_b_id erzwingen
  CONSTRAINT chk_normalized_order CHECK (product_a_id < product_b_id),
  CONSTRAINT uq_dismissal_pair UNIQUE (product_a_id, product_b_id)
);

-- RLS aktivieren
ALTER TABLE public.product_duplicate_dismissals ENABLE ROW LEVEL SECURITY;

-- Lese-Zugriff für alle authentifizierten Benutzer
CREATE POLICY "product_duplicate_dismissals_select"
  ON public.product_duplicate_dismissals FOR SELECT
  TO authenticated
  USING (true);

-- Schreibzugriff nur für Admins
CREATE POLICY "product_duplicate_dismissals_insert"
  ON public.product_duplicate_dismissals FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "product_duplicate_dismissals_delete"
  ON public.product_duplicate_dismissals FOR DELETE
  TO authenticated
  USING (is_admin());

-- Berechtigungen
GRANT SELECT, INSERT, DELETE ON public.product_duplicate_dismissals TO authenticated;

-- Audit-Trigger
CREATE TRIGGER trg_product_duplicate_dismissals_updated_at
  BEFORE UPDATE ON public.product_duplicate_dismissals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_product_duplicate_dismissals_updated_by
  BEFORE INSERT OR UPDATE ON public.product_duplicate_dismissals
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();
