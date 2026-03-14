-- ============================================================
-- Shopping Lists — Einkaufslisten pro Event
-- ============================================================
-- Zwei Tabellen + eine VIEW ersetzen die Firebase-Struktur:
-- - event_shopping_lists (Kopftabelle mit Auswahl-Arrays)
-- - event_shopping_list_items (normalisierte Positionen)
-- - event_shopping_list_items_view (aufgelöste Namen + Abteilungen)
--
-- Vereinfachungen gegenüber Firebase:
-- - Kein ShoppingListCollection-Wrapper (Header-Tabelle genügt)
-- - Kein noOfLists (aus Array-Länge abgeleitet)
-- - Kein ChangeRecord / Trace (audit columns + on-the-fly Berechnung)
-- - Kein generated/generated_from_display_name (audit columns)
-- - selected_menues/meals/departments als TEXT[] (keine Junction-Tabellen)
-- - edit_source ENUM statt manual_add/manual_edit Booleans
-- ============================================================

-- ============================================================
-- 1. ENUM: Herkunft einer Einkaufslistenposition
-- ============================================================

CREATE TYPE public.shopping_list_edit_source AS ENUM (
  'generated',    -- Automatisch aus Menuplan generiert
  'manual_add',   -- Manuell hinzugefügt
  'manual_edit'   -- Generiert, aber manuell bearbeitet (Menge/Einheit)
);

-- ============================================================
-- 2. event_shopping_lists — Kopftabelle der Einkaufslisten
-- ============================================================

CREATE TABLE public.event_shopping_lists (
  id                       TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  event_id                 TEXT        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name                     TEXT        NOT NULL,
  selected_menues          TEXT[]      NOT NULL DEFAULT '{}',
  selected_meals           TEXT[]      NOT NULL DEFAULT '{}',
  selected_departments     TEXT[]      NOT NULL DEFAULT '{}',
  has_manually_added_items BOOLEAN     NOT NULL DEFAULT false,
  firebase_uid             TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by               UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.event_shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_shopping_lists REPLICA IDENTITY FULL;

-- RLS: Nur Event-Köche haben Zugriff
CREATE POLICY shopping_lists_select ON public.event_shopping_lists
  FOR SELECT TO authenticated
  USING (is_event_cook(event_id));
CREATE POLICY shopping_lists_insert ON public.event_shopping_lists
  FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id));
CREATE POLICY shopping_lists_update ON public.event_shopping_lists
  FOR UPDATE TO authenticated
  USING (is_event_cook(event_id));
CREATE POLICY shopping_lists_delete ON public.event_shopping_lists
  FOR DELETE TO authenticated
  USING (is_event_cook(event_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_shopping_lists TO authenticated;

CREATE INDEX idx_shopping_lists_event ON public.event_shopping_lists(event_id);

-- Audit-Trigger
CREATE TRIGGER trg_shopping_lists_updated_at
  BEFORE UPDATE ON public.event_shopping_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_shopping_lists_updated_by
  BEFORE INSERT OR UPDATE ON public.event_shopping_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- 3. event_shopping_list_items — Einzelpositionen einer Liste
-- ============================================================

CREATE TABLE public.event_shopping_list_items (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  list_id         TEXT        NOT NULL REFERENCES public.event_shopping_lists(id) ON DELETE CASCADE,
  product_id      TEXT        REFERENCES public.products(id) ON DELETE SET NULL,
  material_id     TEXT        REFERENCES public.materials(id) ON DELETE SET NULL,
  department_id   TEXT        REFERENCES public.departments(id) ON DELETE SET NULL,
  free_text_name  TEXT,
  quantity        NUMERIC     NOT NULL DEFAULT 0,
  unit            TEXT        REFERENCES public.units(key) ON DELETE SET NULL,
  checked         BOOLEAN     NOT NULL DEFAULT false,
  edit_source     public.shopping_list_edit_source NOT NULL DEFAULT 'generated',
  sort_order      INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

-- CHECK: Genau eine Item-Quelle muss gesetzt sein (Produkt, Material oder Freitext)
ALTER TABLE public.event_shopping_list_items ADD CONSTRAINT chk_item_source CHECK (
  (product_id IS NOT NULL AND material_id IS NULL AND free_text_name IS NULL) OR
  (product_id IS NULL AND material_id IS NOT NULL AND free_text_name IS NULL) OR
  (product_id IS NULL AND material_id IS NULL AND free_text_name IS NOT NULL)
);

ALTER TABLE public.event_shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_shopping_list_items REPLICA IDENTITY FULL;

-- RLS: Zugriff über Parent-Tabelle
CREATE POLICY shopping_list_items_select ON public.event_shopping_list_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.event_shopping_lists h
    WHERE h.id = list_id AND is_event_cook(h.event_id)
  ));
CREATE POLICY shopping_list_items_insert ON public.event_shopping_list_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.event_shopping_lists h
    WHERE h.id = list_id AND is_event_cook(h.event_id)
  ));
CREATE POLICY shopping_list_items_update ON public.event_shopping_list_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.event_shopping_lists h
    WHERE h.id = list_id AND is_event_cook(h.event_id)
  ));
CREATE POLICY shopping_list_items_delete ON public.event_shopping_list_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.event_shopping_lists h
    WHERE h.id = list_id AND is_event_cook(h.event_id)
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_shopping_list_items TO authenticated;

CREATE INDEX idx_shopping_list_items_list ON public.event_shopping_list_items(list_id);

-- Audit-Trigger
CREATE TRIGGER trg_shopping_list_items_updated_at
  BEFORE UPDATE ON public.event_shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_shopping_list_items_updated_by
  BEFORE INSERT OR UPDATE ON public.event_shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- 4. VIEW: Aufgelöste Item-Daten (Namen, Abteilung, Einheit)
-- ============================================================
-- Liest aus der Basistabelle, löst FKs auf und berechnet die
-- effektive Abteilung (department_id auf dem Item hat Vorrang
-- vor der Produkt-Abteilung).

CREATE VIEW public.event_shopping_list_items_view AS
SELECT
  i.id,
  i.list_id,
  i.product_id,
  i.material_id,
  i.free_text_name,
  i.quantity,
  i.unit,
  i.checked,
  i.edit_source,
  i.sort_order,
  i.created_at,
  i.created_by,
  i.updated_at,
  i.updated_by,
  COALESCE(p.name, m.name, i.free_text_name)         AS item_name,
  COALESCE(i.department_id, p.department_id)          AS resolved_department_id,
  d.name                                              AS department_name,
  d.pos                                               AS department_pos,
  u.name                                              AS unit_name
FROM public.event_shopping_list_items i
LEFT JOIN public.products p    ON p.id = i.product_id
LEFT JOIN public.materials m   ON m.id = i.material_id
LEFT JOIN public.departments d ON d.id = COALESCE(i.department_id, p.department_id)
LEFT JOIN public.units u       ON u.key = i.unit;

-- VIEW-Berechtigungen (übernimmt RLS der Basistabelle)
GRANT SELECT ON public.event_shopping_list_items_view TO authenticated;
