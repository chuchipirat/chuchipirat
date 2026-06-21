-- =============================================================================
-- Chuchipirat – Migration: copy_event RPC Function
-- Feature: #144 — Copy Event
--
-- Erstellt eine atomare Kopie eines bestehenden Events inkl. aller
-- Menüplan-Objekte. Optional werden Kochcrew und Rezeptvarianten kopiert.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.copy_event(
  p_source_event_id TEXT,
  p_new_event JSONB,
  p_options JSONB
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_event_id TEXT;
  v_caller_uid UUID;
  v_copy_cooks BOOLEAN;
  v_copy_variants BOOLEAN;
  v_new_dates JSONB;
  v_old_dates JSONB;
  v_date_offsets JSONB; -- Array of {old_from, old_to, offset_days}
  v_rec RECORD;
BEGIN
  -- ─────────────────────────────────────────────────────────────────────
  -- 0. Parameter auslesen
  -- ─────────────────────────────────────────────────────────────────────
  v_caller_uid := auth.uid();
  v_copy_cooks := COALESCE((p_options->>'copy_cooks')::BOOLEAN, FALSE);
  v_copy_variants := COALESCE((p_options->>'copy_variants')::BOOLEAN, FALSE);
  v_new_dates := p_new_event->'dates';

  -- ─────────────────────────────────────────────────────────────────────
  -- 1. Validierung
  -- ─────────────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_source_event_id) THEN
    RAISE EXCEPTION 'Quell-Event nicht gefunden: %', p_source_event_id;
  END IF;

  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Nicht authentifiziert.';
  END IF;

  IF NOT is_event_cook(p_source_event_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung: Nur Köche des Events dürfen kopieren.';
  END IF;

  IF v_new_dates IS NULL OR jsonb_array_length(v_new_dates) = 0 THEN
    RAISE EXCEPTION 'Mindestens eine Zeitscheibe muss angegeben werden.';
  END IF;

  -- ─────────────────────────────────────────────────────────────────────
  -- 2. Neue Event-ID generieren
  -- ─────────────────────────────────────────────────────────────────────
  v_new_event_id := gen_random_uuid()::TEXT;

  -- ─────────────────────────────────────────────────────────────────────
  -- 3. Event-Kopfdaten einfügen
  -- ─────────────────────────────────────────────────────────────────────
  INSERT INTO events (id, name, motto, location, picture_src, created_by)
  VALUES (
    v_new_event_id,
    COALESCE(NULLIF(p_new_event->>'name', ''), 'Kopie von ' || (SELECT name FROM events WHERE id = p_source_event_id)),
    COALESCE(p_new_event->>'motto', ''),
    COALESCE(p_new_event->>'location', ''),
    '',
    v_caller_uid
  );

  -- ─────────────────────────────────────────────────────────────────────
  -- 4. Zeitscheiben einfügen + Offsets berechnen
  -- ─────────────────────────────────────────────────────────────────────

  -- Alte Zeitscheiben laden (sortiert)
  SELECT jsonb_agg(
    jsonb_build_object(
      'date_from', d.date_from,
      'date_to', d.date_to,
      'sort_order', d.sort_order
    ) ORDER BY d.sort_order
  ) INTO v_old_dates
  FROM event_dates d WHERE d.event_id = p_source_event_id;

  -- Neue Zeitscheiben einfügen und Offset-Array aufbauen
  v_date_offsets := '[]'::JSONB;

  FOR v_rec IN
    SELECT
      idx - 1 AS idx,
      (elem->>'date_from')::DATE AS new_from,
      (elem->>'date_to')::DATE AS new_to
    FROM jsonb_array_elements(v_new_dates) WITH ORDINALITY AS t(elem, idx)
  LOOP
    INSERT INTO event_dates (event_id, sort_order, date_from, date_to)
    VALUES (v_new_event_id, v_rec.idx * 10, v_rec.new_from, v_rec.new_to);

    -- Offset berechnen: Differenz zwischen altem und neuem Startdatum
    v_date_offsets := v_date_offsets || jsonb_build_object(
      'old_from', (v_old_dates->v_rec.idx::INT->>'date_from'),
      'old_to', (v_old_dates->v_rec.idx::INT->>'date_to'),
      'offset_days', (v_rec.new_from - (v_old_dates->v_rec.idx::INT->>'date_from')::DATE)
    );
  END LOOP;

  -- ─────────────────────────────────────────────────────────────────────
  -- 5. Kochcrew (immer aktuellen Benutzer, optional weitere)
  -- ─────────────────────────────────────────────────────────────────────

  -- Aktuellen Benutzer als Koch hinzufügen
  INSERT INTO event_cooks (event_id, user_id)
  VALUES (v_new_event_id, v_caller_uid)
  ON CONFLICT (event_id, user_id) DO NOTHING;

  -- Weitere Köche kopieren (wenn gewünscht)
  IF v_copy_cooks THEN
    INSERT INTO event_cooks (event_id, user_id)
    SELECT v_new_event_id, user_id
    FROM event_cooks
    WHERE event_id = p_source_event_id
      AND user_id != v_caller_uid
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────
  -- 6. Gruppenconfig kopieren (Diäten + Unverträglichkeiten + Portionen)
  -- ─────────────────────────────────────────────────────────────────────

  -- Temporäre Tabelle für ID-Mapping (alte ID → neue ID)
  CREATE TEMP TABLE _id_map (
    table_name TEXT,
    old_id TEXT,
    new_id TEXT
  ) ON COMMIT DROP;

  -- Diäten kopieren
  INSERT INTO _id_map (table_name, old_id, new_id)
  SELECT 'diets', old.id, gen_random_uuid()::TEXT
  FROM event_groupconfiguration_diets old
  WHERE old.event_id = p_source_event_id;

  INSERT INTO event_groupconfiguration_diets (id, event_id, name, sort_order)
  SELECT m.new_id, v_new_event_id, old.name, old.sort_order
  FROM event_groupconfiguration_diets old
  JOIN _id_map m ON m.old_id = old.id AND m.table_name = 'diets'
  WHERE old.event_id = p_source_event_id;

  -- Unverträglichkeiten kopieren
  INSERT INTO _id_map (table_name, old_id, new_id)
  SELECT 'intolerances', old.id, gen_random_uuid()::TEXT
  FROM event_groupconfiguration_intolerances old
  WHERE old.event_id = p_source_event_id;

  INSERT INTO event_groupconfiguration_intolerances (id, event_id, name, sort_order)
  SELECT m.new_id, v_new_event_id, old.name, old.sort_order
  FROM event_groupconfiguration_intolerances old
  JOIN _id_map m ON m.old_id = old.id AND m.table_name = 'intolerances'
  WHERE old.event_id = p_source_event_id;

  -- Portionen kopieren (mit gemappten diet_id und intolerance_id)
  INSERT INTO event_groupconfiguration_portions (event_id, diet_id, intolerance_id, servings)
  SELECT
    v_new_event_id,
    dm.new_id,
    im.new_id,
    old.servings
  FROM event_groupconfiguration_portions old
  JOIN _id_map dm ON dm.old_id = old.diet_id AND dm.table_name = 'diets'
  JOIN _id_map im ON im.old_id = old.intolerance_id AND im.table_name = 'intolerances'
  WHERE old.event_id = p_source_event_id;

  -- ─────────────────────────────────────────────────────────────────────
  -- 7. Mahlzeitentypen kopieren
  -- ─────────────────────────────────────────────────────────────────────
  INSERT INTO _id_map (table_name, old_id, new_id)
  SELECT 'meal_types', old.id, gen_random_uuid()::TEXT
  FROM event_meal_types old
  WHERE old.event_id = p_source_event_id;

  INSERT INTO event_meal_types (id, event_id, name, sort_order)
  SELECT m.new_id, v_new_event_id, old.name, old.sort_order
  FROM event_meal_types old
  JOIN _id_map m ON m.old_id = old.id AND m.table_name = 'meal_types'
  WHERE old.event_id = p_source_event_id;

  -- ─────────────────────────────────────────────────────────────────────
  -- 8. Mahlzeiten kopieren (mit Datumsverschiebung pro Zeitscheibe)
  -- ─────────────────────────────────────────────────────────────────────
  INSERT INTO _id_map (table_name, old_id, new_id)
  SELECT 'meals', old.id, gen_random_uuid()::TEXT
  FROM event_meals old
  WHERE old.event_id = p_source_event_id;

  INSERT INTO event_meals (id, event_id, meal_date, meal_type_id)
  SELECT
    mm.new_id,
    v_new_event_id,
    -- Datum verschieben: Finde die passende Zeitscheibe und wende den Offset an
    old.meal_date + (
      SELECT (slice->>'offset_days')::INTEGER
      FROM jsonb_array_elements(v_date_offsets) AS slice
      WHERE old.meal_date >= (slice->>'old_from')::DATE
        AND old.meal_date <= (slice->>'old_to')::DATE
      LIMIT 1
    ),
    mtm.new_id
  FROM event_meals old
  JOIN _id_map mm ON mm.old_id = old.id AND mm.table_name = 'meals'
  JOIN _id_map mtm ON mtm.old_id = old.meal_type_id AND mtm.table_name = 'meal_types'
  WHERE old.event_id = p_source_event_id;

  -- ─────────────────────────────────────────────────────────────────────
  -- 9. Menüs kopieren
  -- ─────────────────────────────────────────────────────────────────────
  INSERT INTO _id_map (table_name, old_id, new_id)
  SELECT 'menues', old.id, gen_random_uuid()::TEXT
  FROM event_menues old
  WHERE old.event_id = p_source_event_id;

  INSERT INTO event_menues (id, event_id, meal_id, name, sort_order)
  SELECT
    menm.new_id,
    v_new_event_id,
    mlm.new_id,
    old.name,
    old.sort_order
  FROM event_menues old
  JOIN _id_map menm ON menm.old_id = old.id AND menm.table_name = 'menues'
  JOIN _id_map mlm ON mlm.old_id = old.meal_id AND mlm.table_name = 'meals'
  WHERE old.event_id = p_source_event_id;

  -- ─────────────────────────────────────────────────────────────────────
  -- 10. Rezeptvarianten behandeln (optional kopieren)
  -- ─────────────────────────────────────────────────────────────────────
  IF v_copy_variants THEN
    -- Varianten kopieren: Für jedes Rezept mit variant_event_uid = source_event
    -- eine Kopie erstellen mit neuem variant_event_uid
    FOR v_rec IN
      SELECT r.id AS old_recipe_id, gen_random_uuid()::TEXT AS new_recipe_id
      FROM recipes r
      WHERE r.variant_event_uid = p_source_event_id
        AND r.recipe_type = 'variant'
    LOOP
      -- Rezept-Kopfdaten kopieren
      INSERT INTO recipes (
        id, name, portions, source, time_preparation, time_rest, time_cooking,
        picture_src, note, tags, menu_types, diet, allergens,
        outdoor_kitchen_suitable, is_in_review, usable, avg_rating, no_ratings,
        recipe_type, variant_note, variant_name, variant_event_uid,
        original_recipe_uid, original_recipe_type, original_recipe_creator_uid,
        created_by
      )
      SELECT
        v_rec.new_recipe_id, name, portions, source, time_preparation, time_rest, time_cooking,
        picture_src, note, tags, menu_types, diet, allergens,
        outdoor_kitchen_suitable, is_in_review, usable, 0, 0,
        'variant', variant_note, variant_name, v_new_event_id,
        original_recipe_uid, original_recipe_type, original_recipe_creator_uid,
        v_caller_uid
      FROM recipes WHERE id = v_rec.old_recipe_id;

      -- Zutaten kopieren
      INSERT INTO recipe_ingredients (
        recipe_id, sort_order, pos_type, product_id,
        quantity, unit, detail, scaling_factor, section_name
      )
      SELECT
        v_rec.new_recipe_id, sort_order, pos_type, product_id,
        quantity, unit, detail, scaling_factor, section_name
      FROM recipe_ingredients WHERE recipe_id = v_rec.old_recipe_id;

      -- Zubereitungsschritte kopieren
      INSERT INTO recipe_preparation_steps (
        recipe_id, sort_order, pos_type, step, section_name
      )
      SELECT
        v_rec.new_recipe_id, sort_order, pos_type, step, section_name
      FROM recipe_preparation_steps WHERE recipe_id = v_rec.old_recipe_id;

      -- Materialpositionen kopieren
      INSERT INTO recipe_materials (
        recipe_id, sort_order, material_id, quantity
      )
      SELECT
        v_rec.new_recipe_id, sort_order, material_id, quantity
      FROM recipe_materials WHERE recipe_id = v_rec.old_recipe_id;

      -- Mapping speichern
      INSERT INTO _id_map (table_name, old_id, new_id)
      VALUES ('recipes', v_rec.old_recipe_id, v_rec.new_recipe_id);
    END LOOP;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────
  -- 11. Menü-Rezepte kopieren
  -- ─────────────────────────────────────────────────────────────────────
  INSERT INTO _id_map (table_name, old_id, new_id)
  SELECT 'menue_recipes', old.id, gen_random_uuid()::TEXT
  FROM event_menue_recipes old
  WHERE old.event_id = p_source_event_id;

  INSERT INTO event_menue_recipes (
    id, event_id, menue_id, recipe_id, deleted_recipe_name,
    variant_name, total_portions, sort_order
  )
  SELECT
    mrm.new_id,
    v_new_event_id,
    menm.new_id,
    -- Rezept-ID: Variante gemappt, oder Original, oder NULL
    CASE
      WHEN v_copy_variants AND rm.new_id IS NOT NULL THEN rm.new_id
      WHEN NOT v_copy_variants AND r.recipe_type = 'variant' AND r.variant_event_uid = p_source_event_id THEN
        CASE WHEN r.original_recipe_uid IS NOT NULL AND EXISTS (SELECT 1 FROM recipes WHERE id = r.original_recipe_uid)
          THEN r.original_recipe_uid
          ELSE NULL
        END
      ELSE old.recipe_id
    END,
    -- deleted_recipe_name: setzen wenn Variante nicht kopiert und Original nicht existiert
    CASE
      WHEN NOT v_copy_variants AND r.recipe_type = 'variant' AND r.variant_event_uid = p_source_event_id
        AND (r.original_recipe_uid IS NULL OR NOT EXISTS (SELECT 1 FROM recipes WHERE id = r.original_recipe_uid))
        THEN '[Variante] ' || COALESCE(r.name, old.variant_name, 'Unbekanntes Rezept')
      ELSE old.deleted_recipe_name
    END,
    old.variant_name,
    old.total_portions,
    old.sort_order
  FROM event_menue_recipes old
  JOIN _id_map mrm ON mrm.old_id = old.id AND mrm.table_name = 'menue_recipes'
  JOIN _id_map menm ON menm.old_id = old.menue_id AND menm.table_name = 'menues'
  LEFT JOIN recipes r ON r.id = old.recipe_id
  LEFT JOIN _id_map rm ON rm.old_id = old.recipe_id AND rm.table_name = 'recipes'
  WHERE old.event_id = p_source_event_id;

  -- ─────────────────────────────────────────────────────────────────────
  -- 12. Menü-Produkte kopieren
  -- ─────────────────────────────────────────────────────────────────────
  INSERT INTO _id_map (table_name, old_id, new_id)
  SELECT 'menue_products', old.id, gen_random_uuid()::TEXT
  FROM event_menue_products old
  WHERE old.event_id = p_source_event_id;

  INSERT INTO event_menue_products (
    id, event_id, menue_id, product_id, quantity, unit,
    plan_mode, total_quantity, sort_order
  )
  SELECT
    mpm.new_id,
    v_new_event_id,
    menm.new_id,
    old.product_id,
    old.quantity,
    old.unit,
    old.plan_mode,
    old.total_quantity,
    old.sort_order
  FROM event_menue_products old
  JOIN _id_map mpm ON mpm.old_id = old.id AND mpm.table_name = 'menue_products'
  JOIN _id_map menm ON menm.old_id = old.menue_id AND menm.table_name = 'menues'
  WHERE old.event_id = p_source_event_id;

  -- ─────────────────────────────────────────────────────────────────────
  -- 13. Menü-Materialien kopieren
  -- ─────────────────────────────────────────────────────────────────────
  INSERT INTO _id_map (table_name, old_id, new_id)
  SELECT 'menue_materials', old.id, gen_random_uuid()::TEXT
  FROM event_menue_materials old
  WHERE old.event_id = p_source_event_id;

  INSERT INTO event_menue_materials (
    id, event_id, menue_id, material_id, quantity, unit,
    plan_mode, total_quantity, sort_order
  )
  SELECT
    mmm.new_id,
    v_new_event_id,
    menm.new_id,
    old.material_id,
    old.quantity,
    old.unit,
    old.plan_mode,
    old.total_quantity,
    old.sort_order
  FROM event_menue_materials old
  JOIN _id_map mmm ON mmm.old_id = old.id AND mmm.table_name = 'menue_materials'
  JOIN _id_map menm ON menm.old_id = old.menue_id AND menm.table_name = 'menues'
  WHERE old.event_id = p_source_event_id;

  -- ─────────────────────────────────────────────────────────────────────
  -- 14. Notizen kopieren (mit Datumsverschiebung)
  -- ─────────────────────────────────────────────────────────────────────
  INSERT INTO event_notes (event_id, menue_id, note_date, text)
  SELECT
    v_new_event_id,
    menm.new_id,
    -- Datum verschieben analog zu Mahlzeiten
    old.note_date + COALESCE(
      (SELECT (slice->>'offset_days')::INTEGER
       FROM jsonb_array_elements(v_date_offsets) AS slice
       WHERE old.note_date >= (slice->>'old_from')::DATE
         AND old.note_date <= (slice->>'old_to')::DATE
       LIMIT 1),
      0
    ),
    old.text
  FROM event_notes old
  LEFT JOIN _id_map menm ON menm.old_id = old.menue_id AND menm.table_name = 'menues'
  WHERE old.event_id = p_source_event_id;

  -- ─────────────────────────────────────────────────────────────────────
  -- 15. Menüplan-Portionsplanung kopieren
  -- ─────────────────────────────────────────────────────────────────────
  INSERT INTO event_menuplan_item_plans (
    event_id, menue_recipe_id, menue_product_id, menue_material_id,
    diet_scope, diet_id, intolerance_scope, intolerance_id,
    factor, servings
  )
  SELECT
    v_new_event_id,
    mrm.new_id,
    mpm.new_id,
    mmm.new_id,
    old.diet_scope,
    dm.new_id,
    old.intolerance_scope,
    im.new_id,
    old.factor,
    old.servings
  FROM event_menuplan_item_plans old
  LEFT JOIN _id_map mrm ON mrm.old_id = old.menue_recipe_id AND mrm.table_name = 'menue_recipes'
  LEFT JOIN _id_map mpm ON mpm.old_id = old.menue_product_id AND mpm.table_name = 'menue_products'
  LEFT JOIN _id_map mmm ON mmm.old_id = old.menue_material_id AND mmm.table_name = 'menue_materials'
  LEFT JOIN _id_map dm ON dm.old_id = old.diet_id AND dm.table_name = 'diets'
  LEFT JOIN _id_map im ON im.old_id = old.intolerance_id AND im.table_name = 'intolerances'
  WHERE old.event_id = p_source_event_id;

  -- ─────────────────────────────────────────────────────────────────────
  -- 16. Menüplan-Tracking initialisieren
  -- ─────────────────────────────────────────────────────────────────────
  INSERT INTO event_menuplan_tracking (event_id)
  VALUES (v_new_event_id);

  -- ─────────────────────────────────────────────────────────────────────
  -- 17. Neue Event-ID zurückgeben
  -- ─────────────────────────────────────────────────────────────────────
  RETURN v_new_event_id;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.copy_event(TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.copy_event(TEXT, JSONB, JSONB) TO service_role;
