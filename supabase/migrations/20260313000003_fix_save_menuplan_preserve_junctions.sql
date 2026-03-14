-- ============================================================
-- Fix: save_menuplan soll Junction-Daten der UsedRecipeLists erhalten
-- ============================================================
-- Problem: save_menuplan löscht event_meal_types mit CASCADE, was über
-- event_meals → event_used_recipe_list_meals und
-- event_menues → event_used_recipe_list_menues alle Junction-Einträge
-- der Mengenberechnungs-Listen mitnimmt.
--
-- Lösung: Junction-Daten vor dem DELETE in temporäre Tabellen sichern
-- und nach dem Re-Insert wiederherstellen (nur für IDs die noch existieren).
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

  CREATE TEMP TABLE _saved_used_recipe_menues ON COMMIT DROP AS
    SELECT ulm.*
    FROM event_used_recipe_list_menues ulm
    JOIN event_used_recipe_lists ul ON ul.id = ulm.list_id
    WHERE ul.event_id = p_event_id;

  CREATE TEMP TABLE _saved_used_recipe_meals ON COMMIT DROP AS
    SELECT ulml.*
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

  INSERT INTO event_used_recipe_list_menues (
    id, list_id, menue_id, created_at, created_by, updated_at, updated_by
  )
  SELECT s.id, s.list_id, s.menue_id,
         s.created_at, s.created_by, s.updated_at, s.updated_by
  FROM _saved_used_recipe_menues s
  WHERE EXISTS (SELECT 1 FROM event_menues m WHERE m.id = s.menue_id);

  INSERT INTO event_used_recipe_list_meals (
    id, list_id, meal_id, created_at, created_by, updated_at, updated_by
  )
  SELECT s.id, s.list_id, s.meal_id,
         s.created_at, s.created_by, s.updated_at, s.updated_by
  FROM _saved_used_recipe_meals s
  WHERE EXISTS (SELECT 1 FROM event_meals m WHERE m.id = s.meal_id);

  -- Temp-Tabellen werden durch ON COMMIT DROP automatisch aufgeräumt.
END;
$$;

-- Berechtigungen beibehalten
REVOKE ALL ON FUNCTION public.save_menuplan(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_menuplan(TEXT, JSONB) TO authenticated;
