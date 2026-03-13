-- ============================================================
-- UsedRecipeLists — Benannte Listen von Rezepten aus dem Menuplan
-- ============================================================
-- Jede Liste referenziert ausgewählte Menüs; die zugehörigen Rezepte
-- werden per RPC-Funktion aus dem Menuplan abgeleitet (nicht gespeichert).
--
-- Firebase speicherte zusätzlich selectedMeals als Resilience-Anker
-- (Menüs konnten per DnD zwischen Mahlzeiten verschoben werden).
-- Mit stabilen Supabase-UUIDs ist dies nicht mehr nötig → nur 2 Tabellen.
-- ============================================================

-- ============================================================
-- 1. event_used_recipe_lists — Kopftabelle der benannten Listen
-- ============================================================
CREATE TABLE public.event_used_recipe_lists (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  event_id     TEXT        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  firebase_uid TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.event_used_recipe_lists ENABLE ROW LEVEL SECURITY;

-- RLS: Nur Event-Köche haben Zugriff
CREATE POLICY event_cooks_select ON public.event_used_recipe_lists
  FOR SELECT USING (is_event_cook(event_id));
CREATE POLICY event_cooks_insert ON public.event_used_recipe_lists
  FOR INSERT WITH CHECK (is_event_cook(event_id));
CREATE POLICY event_cooks_update ON public.event_used_recipe_lists
  FOR UPDATE USING (is_event_cook(event_id));
CREATE POLICY event_cooks_delete ON public.event_used_recipe_lists
  FOR DELETE USING (is_event_cook(event_id));

CREATE INDEX idx_used_recipe_lists_event ON public.event_used_recipe_lists(event_id);

-- Audit-Trigger
CREATE TRIGGER trg_used_recipe_lists_updated_at
  BEFORE UPDATE ON public.event_used_recipe_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_used_recipe_lists_updated_by
  BEFORE UPDATE ON public.event_used_recipe_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- 2. event_used_recipe_list_menues — Menü-Auswahl pro Liste
-- ============================================================
CREATE TABLE public.event_used_recipe_list_menues (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  list_id      TEXT        NOT NULL REFERENCES public.event_used_recipe_lists(id) ON DELETE CASCADE,
  menue_id     TEXT        NOT NULL REFERENCES public.event_menues(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (list_id, menue_id)
);

ALTER TABLE public.event_used_recipe_list_menues ENABLE ROW LEVEL SECURITY;

-- RLS: Zugriff über Parent-Tabelle (event_used_recipe_lists → event_id → is_event_cook)
CREATE POLICY event_cooks_select ON public.event_used_recipe_list_menues
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.event_used_recipe_lists l
    WHERE l.id = list_id AND is_event_cook(l.event_id)
  ));
CREATE POLICY event_cooks_insert ON public.event_used_recipe_list_menues
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.event_used_recipe_lists l
    WHERE l.id = list_id AND is_event_cook(l.event_id)
  ));
CREATE POLICY event_cooks_update ON public.event_used_recipe_list_menues
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.event_used_recipe_lists l
    WHERE l.id = list_id AND is_event_cook(l.event_id)
  ));
CREATE POLICY event_cooks_delete ON public.event_used_recipe_list_menues
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.event_used_recipe_lists l
    WHERE l.id = list_id AND is_event_cook(l.event_id)
  ));

CREATE INDEX idx_used_recipe_list_menues_list ON public.event_used_recipe_list_menues(list_id);

-- Audit-Trigger
CREATE TRIGGER trg_used_recipe_list_menues_updated_at
  BEFORE UPDATE ON public.event_used_recipe_list_menues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_used_recipe_list_menues_updated_by
  BEFORE UPDATE ON public.event_used_recipe_list_menues
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- 3. RPC: Rezeptauflösung für eine Liste
-- ============================================================
-- Leitet die Rezepte einer UsedRecipeList über die Menuplan-Tabellen ab.
-- Joins: list_menues → event_menues → event_menue_recipes → recipes
--                     → event_meals → event_meal_types
-- SECURITY DEFINER, damit die Funktion auch bei aktiver RLS funktioniert.
CREATE OR REPLACE FUNCTION public.get_used_recipe_list_recipes(p_list_id TEXT)
RETURNS TABLE (
  recipe_id   TEXT,
  recipe_name TEXT,
  menue_id    TEXT,
  meal_id     TEXT,
  meal_date   DATE,
  meal_type_name TEXT
) AS $$
  SELECT DISTINCT
    COALESCE(r.id, '') AS recipe_id,
    COALESCE(r.name, mr.deleted_recipe_name, '') AS recipe_name,
    mr.menue_id,
    m.id AS meal_id,
    m.meal_date,
    mt.name AS meal_type_name
  FROM public.event_used_recipe_list_menues ulm
  JOIN public.event_menue_recipes mr ON mr.menue_id = ulm.menue_id
  LEFT JOIN public.recipes r ON r.id = mr.recipe_id
  JOIN public.event_menues men ON men.id = ulm.menue_id
  JOIN public.event_meals m ON m.id = men.meal_id
  JOIN public.event_meal_types mt ON mt.id = m.meal_type_id
  WHERE ulm.list_id = p_list_id
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;
