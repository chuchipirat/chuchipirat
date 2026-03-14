-- ============================================================
-- event_used_recipe_list_meals — Meal-Zuordnung pro Liste
-- ============================================================
-- Junction-Tabelle für die Drift-Erkennung bei verschobenen Menüs.
-- Speichert die zum Erstellungszeitpunkt ausgewählten Mahlzeiten,
-- damit erkannt werden kann, wenn Menüs zwischen Tagen/Mahlzeiten
-- im Menüplan verschoben wurden.
--
-- Spiegelt das Pattern von event_used_recipe_list_menues.
-- ============================================================

CREATE TABLE public.event_used_recipe_list_meals (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  list_id      TEXT        NOT NULL REFERENCES public.event_used_recipe_lists(id) ON DELETE CASCADE,
  meal_id      TEXT        NOT NULL REFERENCES public.event_meals(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (list_id, meal_id)
);

ALTER TABLE public.event_used_recipe_list_meals ENABLE ROW LEVEL SECURITY;

-- RLS: Zugriff über Parent-Tabelle (event_used_recipe_lists → event_id → is_event_cook)
CREATE POLICY event_cooks_select ON public.event_used_recipe_list_meals
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.event_used_recipe_lists l
    WHERE l.id = list_id AND is_event_cook(l.event_id)
  ));
CREATE POLICY event_cooks_insert ON public.event_used_recipe_list_meals
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.event_used_recipe_lists l
    WHERE l.id = list_id AND is_event_cook(l.event_id)
  ));
CREATE POLICY event_cooks_update ON public.event_used_recipe_list_meals
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.event_used_recipe_lists l
    WHERE l.id = list_id AND is_event_cook(l.event_id)
  ));
CREATE POLICY event_cooks_delete ON public.event_used_recipe_list_meals
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.event_used_recipe_lists l
    WHERE l.id = list_id AND is_event_cook(l.event_id)
  ));

CREATE INDEX idx_used_recipe_list_meals_list ON public.event_used_recipe_list_meals(list_id);

-- Audit-Trigger
CREATE TRIGGER trg_used_recipe_list_meals_updated_at
  BEFORE UPDATE ON public.event_used_recipe_list_meals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_used_recipe_list_meals_updated_by
  BEFORE UPDATE ON public.event_used_recipe_list_meals
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();
