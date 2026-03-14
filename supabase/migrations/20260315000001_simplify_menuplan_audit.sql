-- ============================================================
-- Menuplan-Audit vereinfachen: Per-Row Audit → Event-Level Tracking
-- ============================================================
-- Problem: save_menuplan macht DELETE-all + INSERT-all über 8 Tabellen.
-- Per-Row audit columns (created_at/by, updated_at/by) sind dadurch
-- bedeutungslos — sie zeigen immer denselben Zeitpunkt/User.
-- Gleiches gilt für die Junction-Tabellen event_used_recipe_list_menues
-- und event_used_recipe_list_meals (CASCADE-Delete bei save_menuplan).
--
-- Lösung: Eine event_menuplan_tracking-Zeile pro Event ersetzt die
-- per-row Audit-Spalten. Triggers und Spalten auf 10 Tabellen entfernen.
-- ============================================================

-- ============================================================
-- 1a. Tracking-Tabelle erstellen
-- ============================================================

CREATE TABLE public.event_menuplan_tracking (
  event_id   TEXT        PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.event_menuplan_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_menuplan_tracking REPLICA IDENTITY FULL;

-- RLS: gleiche is_event_cook()-Policies wie andere Event-Tabellen
CREATE POLICY event_menuplan_tracking_select ON public.event_menuplan_tracking
  FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menuplan_tracking_insert ON public.event_menuplan_tracking
  FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menuplan_tracking_update ON public.event_menuplan_tracking
  FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

GRANT SELECT, INSERT, UPDATE ON public.event_menuplan_tracking TO authenticated;

-- Audit-Trigger
CREATE TRIGGER trg_event_menuplan_tracking_updated_at
  BEFORE UPDATE ON public.event_menuplan_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_event_menuplan_tracking_updated_by
  BEFORE INSERT OR UPDATE ON public.event_menuplan_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- 1b. Bestehende Daten aus event_meal_types ableiten
-- ============================================================
-- created_by/updated_by bleiben NULL (kein JWT-Kontext bei Migration).

INSERT INTO event_menuplan_tracking (event_id, created_at, updated_at)
SELECT DISTINCT e.id,
  COALESCE(
    (SELECT MAX(mt.created_at) FROM event_meal_types mt WHERE mt.event_id = e.id),
    NOW()
  ),
  COALESCE(
    (SELECT MAX(mt.created_at) FROM event_meal_types mt WHERE mt.event_id = e.id),
    NOW()
  )
FROM events e
WHERE EXISTS (SELECT 1 FROM event_meal_types mt WHERE mt.event_id = e.id);

-- ============================================================
-- 1c. Triggers auf 10 Tabellen entfernen (2 pro Tabelle = 20 total)
-- ============================================================

-- 8 Menuplan-Tabellen
DROP TRIGGER IF EXISTS trg_event_meal_types_updated_at        ON public.event_meal_types;
DROP TRIGGER IF EXISTS trg_event_meal_types_updated_by        ON public.event_meal_types;
DROP TRIGGER IF EXISTS trg_event_meals_updated_at             ON public.event_meals;
DROP TRIGGER IF EXISTS trg_event_meals_updated_by             ON public.event_meals;
DROP TRIGGER IF EXISTS trg_event_menues_updated_at            ON public.event_menues;
DROP TRIGGER IF EXISTS trg_event_menues_updated_by            ON public.event_menues;
DROP TRIGGER IF EXISTS trg_event_menue_recipes_updated_at     ON public.event_menue_recipes;
DROP TRIGGER IF EXISTS trg_event_menue_recipes_updated_by     ON public.event_menue_recipes;
DROP TRIGGER IF EXISTS trg_event_menue_products_updated_at    ON public.event_menue_products;
DROP TRIGGER IF EXISTS trg_event_menue_products_updated_by    ON public.event_menue_products;
DROP TRIGGER IF EXISTS trg_event_menue_materials_updated_at   ON public.event_menue_materials;
DROP TRIGGER IF EXISTS trg_event_menue_materials_updated_by   ON public.event_menue_materials;
DROP TRIGGER IF EXISTS trg_event_notes_updated_at             ON public.event_notes;
DROP TRIGGER IF EXISTS trg_event_notes_updated_by             ON public.event_notes;
DROP TRIGGER IF EXISTS trg_event_menuplan_item_plans_updated_at ON public.event_menuplan_item_plans;
DROP TRIGGER IF EXISTS trg_event_menuplan_item_plans_updated_by ON public.event_menuplan_item_plans;

-- 2 Used-Recipe Junction-Tabellen
DROP TRIGGER IF EXISTS trg_used_recipe_list_menues_updated_at ON public.event_used_recipe_list_menues;
DROP TRIGGER IF EXISTS trg_used_recipe_list_menues_updated_by ON public.event_used_recipe_list_menues;
DROP TRIGGER IF EXISTS trg_used_recipe_list_meals_updated_at  ON public.event_used_recipe_list_meals;
DROP TRIGGER IF EXISTS trg_used_recipe_list_meals_updated_by  ON public.event_used_recipe_list_meals;

-- ============================================================
-- 1d. Audit-Spalten von 10 Tabellen entfernen
-- ============================================================
-- CASCADE entfernt FK-Constraints auf created_by/updated_by automatisch.

ALTER TABLE public.event_meal_types
  DROP COLUMN created_at CASCADE,
  DROP COLUMN created_by CASCADE,
  DROP COLUMN updated_at CASCADE,
  DROP COLUMN updated_by CASCADE;

ALTER TABLE public.event_meals
  DROP COLUMN created_at CASCADE,
  DROP COLUMN created_by CASCADE,
  DROP COLUMN updated_at CASCADE,
  DROP COLUMN updated_by CASCADE;

ALTER TABLE public.event_menues
  DROP COLUMN created_at CASCADE,
  DROP COLUMN created_by CASCADE,
  DROP COLUMN updated_at CASCADE,
  DROP COLUMN updated_by CASCADE;

ALTER TABLE public.event_menue_recipes
  DROP COLUMN created_at CASCADE,
  DROP COLUMN created_by CASCADE,
  DROP COLUMN updated_at CASCADE,
  DROP COLUMN updated_by CASCADE;

ALTER TABLE public.event_menue_products
  DROP COLUMN created_at CASCADE,
  DROP COLUMN created_by CASCADE,
  DROP COLUMN updated_at CASCADE,
  DROP COLUMN updated_by CASCADE;

ALTER TABLE public.event_menue_materials
  DROP COLUMN created_at CASCADE,
  DROP COLUMN created_by CASCADE,
  DROP COLUMN updated_at CASCADE,
  DROP COLUMN updated_by CASCADE;

ALTER TABLE public.event_notes
  DROP COLUMN created_at CASCADE,
  DROP COLUMN created_by CASCADE,
  DROP COLUMN updated_at CASCADE,
  DROP COLUMN updated_by CASCADE;

ALTER TABLE public.event_menuplan_item_plans
  DROP COLUMN created_at CASCADE,
  DROP COLUMN created_by CASCADE,
  DROP COLUMN updated_at CASCADE,
  DROP COLUMN updated_by CASCADE;

ALTER TABLE public.event_used_recipe_list_menues
  DROP COLUMN created_at CASCADE,
  DROP COLUMN created_by CASCADE,
  DROP COLUMN updated_at CASCADE,
  DROP COLUMN updated_by CASCADE;

ALTER TABLE public.event_used_recipe_list_meals
  DROP COLUMN created_at CASCADE,
  DROP COLUMN created_by CASCADE,
  DROP COLUMN updated_at CASCADE,
  DROP COLUMN updated_by CASCADE;

-- ============================================================
-- 1e. save_menuplan RPC ersetzen (vereinfachte Junction-Sicherung)
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_menuplan(
  p_event_id TEXT,
  p_payload  JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- ================================================================
  -- Schritt 0: Junction-Daten der UsedRecipeLists sichern
  -- ================================================================
  -- CASCADE auf event_meal_types würde diese Daten sonst löschen.
  -- Vereinfacht: nur strukturelle Spalten (keine Audit-Spalten mehr).

  CREATE TEMP TABLE _saved_used_recipe_menues ON COMMIT DROP AS
    SELECT ulm.id, ulm.list_id, ulm.menue_id
    FROM event_used_recipe_list_menues ulm
    JOIN event_used_recipe_lists ul ON ul.id = ulm.list_id
    WHERE ul.event_id = p_event_id;

  CREATE TEMP TABLE _saved_used_recipe_meals ON COMMIT DROP AS
    SELECT ulml.id, ulml.list_id, ulml.meal_id
    FROM event_used_recipe_list_meals ulml
    JOIN event_used_recipe_lists ul ON ul.id = ulml.list_id
    WHERE ul.event_id = p_event_id;

  -- ================================================================
  -- Schritt 1: Bestehende Daten löschen
  -- ================================================================

  -- Tages-Notizen (menue_id IS NULL) werden NICHT durch CASCADE
  -- auf event_meal_types erfasst, daher explizit löschen.
  DELETE FROM event_notes
    WHERE event_id = p_event_id
      AND menue_id IS NULL;

  -- CASCADE auf event_meal_types räumt alle Kindtabellen auf:
  -- event_meals, event_menues, event_menue_recipes,
  -- event_menue_products, event_menue_materials,
  -- event_notes (mit menue_id), event_menuplan_item_plans
  -- (+ event_used_recipe_list_menues, event_used_recipe_list_meals)
  DELETE FROM event_meal_types
    WHERE event_id = p_event_id;

  -- ================================================================
  -- Schritt 2: Elterntabellen zuerst, dann Kindtabellen einfügen
  -- ================================================================

  -- 2a: event_meal_types
  INSERT INTO event_meal_types (id, event_id, name, sort_order)
  SELECT
    elem->>'id',
    p_event_id,
    elem->>'name',
    (elem->>'sort_order')::INTEGER
  FROM jsonb_array_elements(p_payload->'mealTypes') AS elem
  WHERE p_payload->'mealTypes' IS NOT NULL
    AND jsonb_array_length(p_payload->'mealTypes') > 0;

  -- 2b: event_meals
  INSERT INTO event_meals (id, event_id, meal_date, meal_type_id)
  SELECT
    elem->>'id',
    p_event_id,
    (elem->>'meal_date')::DATE,
    elem->>'meal_type_id'
  FROM jsonb_array_elements(p_payload->'meals') AS elem
  WHERE p_payload->'meals' IS NOT NULL
    AND jsonb_array_length(p_payload->'meals') > 0;

  -- 2c: event_menues
  INSERT INTO event_menues (id, event_id, meal_id, name, sort_order)
  SELECT
    elem->>'id',
    p_event_id,
    elem->>'meal_id',
    elem->>'name',
    (elem->>'sort_order')::INTEGER
  FROM jsonb_array_elements(p_payload->'menues') AS elem
  WHERE p_payload->'menues' IS NOT NULL
    AND jsonb_array_length(p_payload->'menues') > 0;

  -- 2d: event_menue_recipes
  INSERT INTO event_menue_recipes (
    id, event_id, menue_id, recipe_id, deleted_recipe_name,
    variant_name, total_portions, sort_order
  )
  SELECT
    elem->>'id',
    p_event_id,
    elem->>'menue_id',
    NULLIF(elem->>'recipe_id', ''),
    NULLIF(elem->>'deleted_recipe_name', ''),
    NULLIF(elem->>'variant_name', ''),
    (elem->>'total_portions')::INTEGER,
    (elem->>'sort_order')::INTEGER
  FROM jsonb_array_elements(p_payload->'menueRecipes') AS elem
  WHERE p_payload->'menueRecipes' IS NOT NULL
    AND jsonb_array_length(p_payload->'menueRecipes') > 0;

  -- 2e: event_menue_products
  INSERT INTO event_menue_products (
    id, event_id, menue_id, product_id, quantity, unit,
    plan_mode, total_quantity, sort_order
  )
  SELECT
    elem->>'id',
    p_event_id,
    elem->>'menue_id',
    elem->>'product_id',
    (elem->>'quantity')::NUMERIC(12,4),
    NULLIF(elem->>'unit', ''),
    (elem->>'plan_mode')::plan_mode_type,
    (elem->>'total_quantity')::NUMERIC(12,4),
    (elem->>'sort_order')::INTEGER
  FROM jsonb_array_elements(p_payload->'menueProducts') AS elem
  WHERE p_payload->'menueProducts' IS NOT NULL
    AND jsonb_array_length(p_payload->'menueProducts') > 0;

  -- 2f: event_menue_materials
  INSERT INTO event_menue_materials (
    id, event_id, menue_id, material_id, quantity, unit,
    plan_mode, total_quantity, sort_order
  )
  SELECT
    elem->>'id',
    p_event_id,
    elem->>'menue_id',
    elem->>'material_id',
    (elem->>'quantity')::NUMERIC(12,4),
    NULLIF(elem->>'unit', ''),
    (elem->>'plan_mode')::plan_mode_type,
    (elem->>'total_quantity')::NUMERIC(12,4),
    (elem->>'sort_order')::INTEGER
  FROM jsonb_array_elements(p_payload->'menueMaterials') AS elem
  WHERE p_payload->'menueMaterials' IS NOT NULL
    AND jsonb_array_length(p_payload->'menueMaterials') > 0;

  -- 2g: event_notes
  INSERT INTO event_notes (id, event_id, menue_id, text, note_date)
  SELECT
    elem->>'id',
    p_event_id,
    NULLIF(elem->>'menue_id', ''),
    elem->>'text',
    (elem->>'note_date')::DATE
  FROM jsonb_array_elements(p_payload->'notes') AS elem
  WHERE p_payload->'notes' IS NOT NULL
    AND jsonb_array_length(p_payload->'notes') > 0;

  -- 2h: event_menuplan_item_plans
  INSERT INTO event_menuplan_item_plans (
    id, event_id, menue_recipe_id, menue_product_id, menue_material_id,
    diet_scope, diet_id, intolerance_scope, intolerance_id,
    factor, servings
  )
  SELECT
    COALESCE(NULLIF(elem->>'id', ''), gen_random_uuid()::text),
    p_event_id,
    NULLIF(elem->>'menue_recipe_id', ''),
    NULLIF(elem->>'menue_product_id', ''),
    NULLIF(elem->>'menue_material_id', ''),
    (elem->>'diet_scope')::plan_scope_type,
    NULLIF(elem->>'diet_id', ''),
    (elem->>'intolerance_scope')::plan_scope_type,
    NULLIF(elem->>'intolerance_id', ''),
    (elem->>'factor')::NUMERIC(10,4),
    (elem->>'servings')::INTEGER
  FROM jsonb_array_elements(p_payload->'itemPlans') AS elem
  WHERE p_payload->'itemPlans' IS NOT NULL
    AND jsonb_array_length(p_payload->'itemPlans') > 0;

  -- ================================================================
  -- Schritt 3: Gesicherte Junction-Daten wiederherstellen
  -- ================================================================
  -- Nur Einträge wiederherstellen, deren Menü/Meal noch existiert.

  INSERT INTO event_used_recipe_list_menues (id, list_id, menue_id)
  SELECT s.id, s.list_id, s.menue_id
  FROM _saved_used_recipe_menues s
  WHERE EXISTS (SELECT 1 FROM event_menues m WHERE m.id = s.menue_id);

  INSERT INTO event_used_recipe_list_meals (id, list_id, meal_id)
  SELECT s.id, s.list_id, s.meal_id
  FROM _saved_used_recipe_meals s
  WHERE EXISTS (SELECT 1 FROM event_meals m WHERE m.id = s.meal_id);

  -- Temp-Tabellen werden durch ON COMMIT DROP automatisch aufgeräumt.

  -- ================================================================
  -- Schritt 4: Tracking-Zeile aktualisieren
  -- ================================================================
  -- update_updated_by-Trigger setzt updated_by automatisch.
  UPDATE event_menuplan_tracking
  SET updated_at = NOW()
  WHERE event_id = p_event_id;

END;
$$;

-- Berechtigungen beibehalten
REVOKE ALL ON FUNCTION public.save_menuplan(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_menuplan(TEXT, JSONB) TO authenticated;
