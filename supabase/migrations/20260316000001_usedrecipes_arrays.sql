-- ============================================================
-- UsedRecipes: Junction-Tabellen → TEXT[] Arrays
-- ============================================================
-- Vereinfacht das Datenmodell: selectedMenues und selectedMeals
-- werden als TEXT[] direkt auf der Kopftabelle gespeichert.
-- Dies eliminiert 2 Junction-Tabellen, vereinfacht den
-- save_menuplan RPC (~75 Zeilen weniger), und macht das Modell
-- konsistent mit den Shopping-List-Tabellen (die ebenfalls
-- TEXT[] für Auswahllisten verwenden).
--
-- Stale Menü-/Meal-IDs in den Arrays (z.B. nach Löschung im
-- Menuplan) werden durch die bestehende Drift-Erkennung im
-- App-Code behandelt.
-- ============================================================

-- ============================================================
-- 1. TEXT[] Spalten zur Kopftabelle hinzufügen
-- ============================================================

ALTER TABLE public.event_used_recipe_lists
  ADD COLUMN selected_menue_ids TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN selected_meal_ids  TEXT[] NOT NULL DEFAULT '{}';

-- ============================================================
-- 2. Bestehende Junction-Daten in Arrays übertragen
-- ============================================================

UPDATE public.event_used_recipe_lists ul SET
  selected_menue_ids = COALESCE((
    SELECT array_agg(ulm.menue_id ORDER BY ulm.id)
    FROM public.event_used_recipe_list_menues ulm
    WHERE ulm.list_id = ul.id
  ), '{}'),
  selected_meal_ids = COALESCE((
    SELECT array_agg(ulml.meal_id ORDER BY ulml.id)
    FROM public.event_used_recipe_list_meals ulml
    WHERE ulml.list_id = ul.id
  ), '{}');

-- ============================================================
-- 3. Junction-Tabellen entfernen
-- ============================================================
-- CASCADE entfernt RLS-Policies, Indexe und Constraints automatisch.

DROP TABLE IF EXISTS public.event_used_recipe_list_menues CASCADE;
DROP TABLE IF EXISTS public.event_used_recipe_list_meals CASCADE;

-- ============================================================
-- 4. RPC get_used_recipe_list_recipes anpassen
-- ============================================================
-- Vorher: JOIN über Junction-Tabelle event_used_recipe_list_menues.
-- Nachher: unnest(selected_menue_ids) auf der Kopftabelle.

CREATE OR REPLACE FUNCTION public.get_used_recipe_list_recipes(p_list_id TEXT)
RETURNS TABLE (
  recipe_id      TEXT,
  recipe_name    TEXT,
  menue_id       TEXT,
  meal_id        TEXT,
  meal_date      DATE,
  meal_type_name TEXT
) AS $$
  SELECT DISTINCT
    COALESCE(r.id, '')                              AS recipe_id,
    COALESCE(r.name, mr.deleted_recipe_name, '')    AS recipe_name,
    mr.menue_id,
    m.id                                            AS meal_id,
    m.meal_date,
    mt.name                                         AS meal_type_name
  FROM public.event_used_recipe_lists ul
  CROSS JOIN LATERAL unnest(ul.selected_menue_ids) AS sel(menue_id)
  JOIN public.event_menue_recipes mr ON mr.menue_id = sel.menue_id
  LEFT JOIN public.recipes r         ON r.id = mr.recipe_id
  JOIN public.event_menues men       ON men.id = sel.menue_id
  JOIN public.event_meals m          ON m.id = men.meal_id
  JOIN public.event_meal_types mt    ON mt.id = m.meal_type_id
  WHERE ul.id = p_list_id
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

-- ============================================================
-- 5. save_menuplan RPC vereinfachen
-- ============================================================
-- Temp-Table Backup/Restore für Junction-Tabellen entfällt komplett.
-- TEXT[] Spalten auf event_used_recipe_lists sind nicht von
-- CASCADE auf event_meal_types betroffen.

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
  -- Schritt 3: Tracking-Zeile aktualisieren
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
