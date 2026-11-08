-- =============================================================================
-- Neue Funktionalität: Protokoll der Anlegen-Vorgänge (Produkte und Materialien)
--
-- Hält pro Vorgang im Produkt- bzw. Material-Dialog fest, welcher Name
-- eingegeben wurde, welche Hinweise und Vorschläge zu sehen waren, wie
-- entschieden wurde (angelegt, Vorschlag übernommen, abgebrochen) und was
-- daraus entstand. Grundlage, um zu messen, ob die Hinweise beim Anlegen
-- Dubletten verhindern, und um neue Regeln mit alten zu vergleichen
-- (rules_version, 0 = Prüfung vor der neuen Abgleich-Logik).
--
-- Die Tabelle wird nur ergänzt, nie geändert:
--   - Einfügen dürfen alle Angemeldeten (nur mit eigener created_by),
--     lesen nur Admins, ändern und löschen niemand.
--   - Darum nur created_at/created_by, keine updated_*-Spalten und Trigger.
--   - Weil Nicht-Admins nicht lesen dürfen, schreibt die App ohne RETURNING.
--
-- Verweise auf Produkt, Material und Konto sind ON DELETE SET NULL: Die Zeile
-- bleibt beim Zusammenführen/Löschen eines Produkts und beim Löschen eines
-- Kontos erhalten; result_name hält den Namen lesbar.
-- =============================================================================

CREATE TYPE public.item_creation_type AS ENUM ('product','material');

CREATE TYPE public.item_creation_origin AS ENUM ('recipe','menuplan','shopping_list','material_list', 'products_admin','materials_admin');

CREATE TYPE public.item_creation_decision AS ENUM ('created','suggestion_taken','cancelled');

CREATE TABLE public.item_creation_logs (
  id text DEFAULT gen_random_uuid()::text NOT NULL,
  item_type public.item_creation_type NOT NULL,
  origin public.item_creation_origin NOT NULL,
  entered_name text NOT NULL,
  final_name text,
  decision public.item_creation_decision NOT NULL,
  hints jsonb NOT NULL DEFAULT '[]',
  rules_version smallint NOT NULL,
  result_product_id text,
  result_material_id text,
  result_name text,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid DEFAULT auth.uid(),

  CONSTRAINT item_creation_logs_pkey PRIMARY KEY (id),
  CONSTRAINT item_creation_logs_entered_name_check CHECK (LENGTH(trim(entered_name)) BETWEEN 1 AND 200  ),
  CONSTRAINT item_creation_logs_hints_check CHECK (jsonb_typeof(hints) = 'array'),
  CONSTRAINT item_creation_logs_rules_version_check CHECK (rules_version >= 0),
  CONSTRAINT item_creation_logs_result_product_id_fkey FOREIGN KEY (result_product_id) REFERENCES public.products (id) ON DELETE SET NULL,
  CONSTRAINT item_creation_logs_result_material_id_fkey FOREIGN KEY (result_material_id) REFERENCES public.materials (id) ON DELETE SET NULL,
  CONSTRAINT item_creation_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

ALTER TABLE public.item_creation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_creation_logs_select" ON public.item_creation_logs FOR SELECT TO authenticated
  USING (is_admin());
CREATE POLICY "item_creation_logs_insert" ON public.item_creation_logs FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE INDEX idx_item_creation_logs_created_at ON public.item_creation_logs USING btree (created_at DESC);

REVOKE ALL ON public.item_creation_logs FROM anon, authenticated;
GRANT SELECT, INSERT ON public.item_creation_logs TO authenticated;
