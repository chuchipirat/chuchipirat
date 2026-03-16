-- ============================================================
-- Material Lists — Materiallisten pro Event
-- ============================================================
-- Zwei Tabellen + eine VIEW ersetzen die Firebase-Struktur:
-- - event_material_lists (Kopftabelle mit Auswahl-Arrays)
-- - event_material_list_items (normalisierte Positionen)
-- - event_material_list_items_view (aufgelöste Namen + Koch-Zuordnung)
--
-- Vereinfachungen gegenüber Firebase:
-- - Kein noOfLists (aus Array-Länge abgeleitet)
-- - Kein ChangeRecord / Trace (audit columns + on-the-fly Berechnung)
-- - selected_menues/meals als TEXT[] (keine Junction-Tabellen)
-- - edit_source ENUM wiederverwendet (shopping_list_edit_source)
-- - Neues Feature: assigned_cook_id / assigned_cook_name
-- ============================================================

-- ============================================================
-- 1. event_material_lists — Kopftabelle der Materiallisten
-- ============================================================

CREATE TABLE public.event_material_lists (
  id                       TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  event_id                 TEXT        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name                     TEXT        NOT NULL,
  selected_menues          TEXT[]      NOT NULL DEFAULT '{}',
  selected_meals           TEXT[]      NOT NULL DEFAULT '{}',
  has_manually_added_items BOOLEAN     NOT NULL DEFAULT false,
  firebase_uid             TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by               UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.event_material_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_material_lists REPLICA IDENTITY FULL;

-- RLS: Nur Event-Köche haben Zugriff
CREATE POLICY material_lists_select ON public.event_material_lists
  FOR SELECT TO authenticated
  USING (is_event_cook(event_id));
CREATE POLICY material_lists_insert ON public.event_material_lists
  FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id));
CREATE POLICY material_lists_update ON public.event_material_lists
  FOR UPDATE TO authenticated
  USING (is_event_cook(event_id));
CREATE POLICY material_lists_delete ON public.event_material_lists
  FOR DELETE TO authenticated
  USING (is_event_cook(event_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_material_lists TO authenticated;

CREATE INDEX idx_material_lists_event ON public.event_material_lists(event_id);

-- Audit-Trigger
CREATE TRIGGER trg_material_lists_updated_at
  BEFORE UPDATE ON public.event_material_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_material_lists_updated_by
  BEFORE INSERT OR UPDATE ON public.event_material_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- 2. event_material_list_items — Einzelpositionen einer Liste
-- ============================================================

CREATE TABLE public.event_material_list_items (
  id                  TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  list_id             TEXT        NOT NULL REFERENCES public.event_material_lists(id) ON DELETE CASCADE,
  material_id         TEXT        REFERENCES public.materials(id) ON DELETE SET NULL,
  free_text_name      TEXT,
  quantity            NUMERIC     NOT NULL DEFAULT 0,
  checked             BOOLEAN     NOT NULL DEFAULT false,
  edit_source         public.shopping_list_edit_source NOT NULL DEFAULT 'generated',
  sort_order          INT         NOT NULL DEFAULT 0,
  assigned_cook_id    TEXT        REFERENCES public.event_cooks(id) ON DELETE SET NULL,
  assigned_cook_name  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by          UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

-- CHECK: Genau eine Item-Quelle muss gesetzt sein (Material oder Freitext)
ALTER TABLE public.event_material_list_items ADD CONSTRAINT chk_material_item_source CHECK (
  (material_id IS NOT NULL AND free_text_name IS NULL) OR
  (material_id IS NULL AND free_text_name IS NOT NULL)
);

ALTER TABLE public.event_material_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_material_list_items REPLICA IDENTITY FULL;

-- RLS: Zugriff über Parent-Tabelle
CREATE POLICY material_list_items_select ON public.event_material_list_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.event_material_lists h
    WHERE h.id = list_id AND is_event_cook(h.event_id)
  ));
CREATE POLICY material_list_items_insert ON public.event_material_list_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.event_material_lists h
    WHERE h.id = list_id AND is_event_cook(h.event_id)
  ));
CREATE POLICY material_list_items_update ON public.event_material_list_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.event_material_lists h
    WHERE h.id = list_id AND is_event_cook(h.event_id)
  ));
CREATE POLICY material_list_items_delete ON public.event_material_list_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.event_material_lists h
    WHERE h.id = list_id AND is_event_cook(h.event_id)
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_material_list_items TO authenticated;

CREATE INDEX idx_material_list_items_list ON public.event_material_list_items(list_id);

-- Audit-Trigger
CREATE TRIGGER trg_material_list_items_updated_at
  BEFORE UPDATE ON public.event_material_list_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_material_list_items_updated_by
  BEFORE INSERT OR UPDATE ON public.event_material_list_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- 3. VIEW: Aufgelöste Item-Daten (Material-Name + Koch-Name)
-- ============================================================
-- Löst material_id → materials.name auf und berechnet den
-- aufgelösten Koch-Namen (registrierter Koch bevorzugt,
-- Freitext als Fallback).

CREATE VIEW public.event_material_list_items_view
  WITH (security_invoker = true) AS
SELECT
  i.id,
  i.list_id,
  i.material_id,
  i.free_text_name,
  i.quantity,
  i.checked,
  i.edit_source,
  i.sort_order,
  i.assigned_cook_id,
  i.assigned_cook_name,
  i.created_at,
  i.created_by,
  i.updated_at,
  i.updated_by,
  COALESCE(m.name, i.free_text_name)                AS item_name,
  COALESCE(u.display_name, i.assigned_cook_name)     AS resolved_cook_name,
  ec.user_id                                         AS assigned_cook_user_id
FROM public.event_material_list_items i
LEFT JOIN public.materials m     ON m.id = i.material_id
LEFT JOIN public.event_cooks ec  ON ec.id = i.assigned_cook_id
LEFT JOIN public.users u         ON u.auth_uid = ec.user_id;

-- VIEW-Berechtigungen (übernimmt RLS der Basistabelle)
GRANT SELECT ON public.event_material_list_items_view TO authenticated;
