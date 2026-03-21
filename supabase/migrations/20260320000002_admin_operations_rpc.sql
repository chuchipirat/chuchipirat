-- ============================================================
-- Phase 13.3: Admin-Operationen als Postgres-RPC-Funktionen
--
-- Ersetzt die Firebase Cloud Functions für:
--   - Produkte zusammenführen (merge)
--   - Materialien zusammenführen (merge)
--   - Produkt → Material konvertieren
--   - Material → Produkt konvertieren
--   - Verwendungsnachweis (where-used)
-- ============================================================

-- ============================================================
-- 1) merge_products
--    Aktualisiert alle FK-Referenzen von source → target,
--    löscht dann das Quellprodukt.
--    Gibt die Anzahl betroffener Zeilen pro Tabelle zurück.
-- ============================================================
CREATE OR REPLACE FUNCTION public.merge_products(
  source_product_id TEXT,
  target_product_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_recipe_ingredients   INTEGER := 0;
  affected_shopping_list_items  INTEGER := 0;
  affected_menue_products       INTEGER := 0;
  affected_unit_conversions     INTEGER := 0;
BEGIN
  -- Validierung
  IF source_product_id IS NULL OR target_product_id IS NULL THEN
    RAISE EXCEPTION 'source_product_id und target_product_id dürfen nicht NULL sein';
  END IF;
  IF source_product_id = target_product_id THEN
    RAISE EXCEPTION 'Quell- und Zielprodukt dürfen nicht identisch sein';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = source_product_id) THEN
    RAISE EXCEPTION 'Quellprodukt (%) existiert nicht', source_product_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = target_product_id) THEN
    RAISE EXCEPTION 'Zielprodukt (%) existiert nicht', target_product_id;
  END IF;

  -- recipe_ingredients: Quellprodukt → Zielprodukt
  UPDATE public.recipe_ingredients
    SET product_id = target_product_id
    WHERE product_id = source_product_id;
  GET DIAGNOSTICS affected_recipe_ingredients = ROW_COUNT;

  -- event_shopping_list_items: Quellprodukt → Zielprodukt
  UPDATE public.event_shopping_list_items
    SET product_id = target_product_id
    WHERE product_id = source_product_id;
  GET DIAGNOSTICS affected_shopping_list_items = ROW_COUNT;

  -- event_menue_products: Quellprodukt → Zielprodukt
  UPDATE public.event_menue_products
    SET product_id = target_product_id
    WHERE product_id = source_product_id;
  GET DIAGNOSTICS affected_menue_products = ROW_COUNT;

  -- unit_conversion_products: Quellprodukt → Zielprodukt
  UPDATE public.unit_conversion_products
    SET product_id = target_product_id
    WHERE product_id = source_product_id;
  GET DIAGNOSTICS affected_unit_conversions = ROW_COUNT;

  -- Quellprodukt löschen
  DELETE FROM public.products WHERE id = source_product_id;

  RETURN jsonb_build_object(
    'recipe_ingredients',   affected_recipe_ingredients,
    'shopping_list_items',  affected_shopping_list_items,
    'menue_products',       affected_menue_products,
    'unit_conversions',     affected_unit_conversions
  );
END;
$$;

-- Nur authentifizierte Benutzer dürfen diese Funktion aufrufen
REVOKE ALL ON FUNCTION public.merge_products(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_products(TEXT, TEXT) TO authenticated;

-- ============================================================
-- 2) merge_materials
--    Aktualisiert alle FK-Referenzen von source → target,
--    löscht dann das Quellmaterial.
-- ============================================================
CREATE OR REPLACE FUNCTION public.merge_materials(
  source_material_id TEXT,
  target_material_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_recipe_materials       INTEGER := 0;
  affected_material_list_items    INTEGER := 0;
  affected_menue_materials        INTEGER := 0;
  affected_shopping_list_items    INTEGER := 0;
BEGIN
  -- Validierung
  IF source_material_id IS NULL OR target_material_id IS NULL THEN
    RAISE EXCEPTION 'source_material_id und target_material_id dürfen nicht NULL sein';
  END IF;
  IF source_material_id = target_material_id THEN
    RAISE EXCEPTION 'Quell- und Zielmaterial dürfen nicht identisch sein';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.materials WHERE id = source_material_id) THEN
    RAISE EXCEPTION 'Quellmaterial (%) existiert nicht', source_material_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.materials WHERE id = target_material_id) THEN
    RAISE EXCEPTION 'Zielmaterial (%) existiert nicht', target_material_id;
  END IF;

  -- recipe_materials: Quellmaterial → Zielmaterial
  UPDATE public.recipe_materials
    SET material_id = target_material_id
    WHERE material_id = source_material_id;
  GET DIAGNOSTICS affected_recipe_materials = ROW_COUNT;

  -- event_material_list_items: Quellmaterial → Zielmaterial
  UPDATE public.event_material_list_items
    SET material_id = target_material_id
    WHERE material_id = source_material_id;
  GET DIAGNOSTICS affected_material_list_items = ROW_COUNT;

  -- event_menue_materials: Quellmaterial → Zielmaterial
  UPDATE public.event_menue_materials
    SET material_id = target_material_id
    WHERE material_id = source_material_id;
  GET DIAGNOSTICS affected_menue_materials = ROW_COUNT;

  -- event_shopping_list_items: Quellmaterial → Zielmaterial
  UPDATE public.event_shopping_list_items
    SET material_id = target_material_id
    WHERE material_id = source_material_id;
  GET DIAGNOSTICS affected_shopping_list_items = ROW_COUNT;

  -- Quellmaterial löschen
  DELETE FROM public.materials WHERE id = source_material_id;

  RETURN jsonb_build_object(
    'recipe_materials',       affected_recipe_materials,
    'material_list_items',    affected_material_list_items,
    'menue_materials',        affected_menue_materials,
    'shopping_list_items',    affected_shopping_list_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_materials(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_materials(TEXT, TEXT) TO authenticated;

-- ============================================================
-- 3) convert_product_to_material
--    Erstellt ein neues Material aus einem Produkt,
--    aktualisiert alle Referenzen, löscht das Produkt.
--    Gibt die neue Material-ID und betroffene Zeilen zurück.
-- ============================================================
CREATE OR REPLACE FUNCTION public.convert_product_to_material(
  product_id_param TEXT,
  material_type_param TEXT DEFAULT 'consumable'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  product_record             RECORD;
  new_material_id            TEXT;
  affected_recipe_ingredients   INTEGER := 0;
  affected_shopping_list_items  INTEGER := 0;
  affected_menue_items          INTEGER := 0;
BEGIN
  -- Produkt laden
  SELECT id, name INTO product_record
    FROM public.products
    WHERE id = product_id_param;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produkt (%) existiert nicht', product_id_param;
  END IF;

  -- Neues Material erstellen
  INSERT INTO public.materials (name, type)
    VALUES (product_record.name, material_type_param::public.material_type)
    RETURNING id INTO new_material_id;

  -- recipe_ingredients: Produkt-Referenzen → neue recipe_materials-Einträge
  -- (Ingredient-Zeilen mit diesem Produkt in Material-Zeilen umwandeln)
  WITH deleted_ingredients AS (
    DELETE FROM public.recipe_ingredients
      WHERE product_id = product_id_param
      RETURNING recipe_id, sort_order, quantity, unit, detail
  )
  INSERT INTO public.recipe_materials (recipe_id, sort_order, material_id, quantity, unit, detail)
    SELECT recipe_id, sort_order, new_material_id, quantity, unit, detail
    FROM deleted_ingredients;
  GET DIAGNOSTICS affected_recipe_ingredients = ROW_COUNT;

  -- event_shopping_list_items: product_id → material_id
  UPDATE public.event_shopping_list_items
    SET product_id = NULL, material_id = new_material_id
    WHERE product_id = product_id_param;
  GET DIAGNOSTICS affected_shopping_list_items = ROW_COUNT;

  -- event_menue_products: Zeilen in event_menue_materials umwandeln
  WITH deleted_menue_products AS (
    DELETE FROM public.event_menue_products
      WHERE product_id = product_id_param
      RETURNING id, event_id, menue_id, sort_order, quantity, unit
  )
  INSERT INTO public.event_menue_materials (id, event_id, menue_id, sort_order, material_id, quantity, unit)
    SELECT id, event_id, menue_id, sort_order, new_material_id, quantity, unit
    FROM deleted_menue_products;
  GET DIAGNOSTICS affected_menue_items = ROW_COUNT;

  -- Unit-Conversions für das Produkt löschen (Material hat keine)
  DELETE FROM public.unit_conversion_products WHERE product_id = product_id_param;

  -- Produkt löschen
  DELETE FROM public.products WHERE id = product_id_param;

  RETURN jsonb_build_object(
    'new_material_id',          new_material_id,
    'recipe_ingredients',       affected_recipe_ingredients,
    'shopping_list_items',      affected_shopping_list_items,
    'menue_items',              affected_menue_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.convert_product_to_material(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_product_to_material(TEXT, TEXT) TO authenticated;

-- ============================================================
-- 4) convert_material_to_product
--    Erstellt ein neues Produkt aus einem Material,
--    aktualisiert alle Referenzen, löscht das Material.
-- ============================================================
CREATE OR REPLACE FUNCTION public.convert_material_to_product(
  material_id_param TEXT,
  department_id_param TEXT DEFAULT NULL,
  shopping_unit_param TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  material_record              RECORD;
  new_product_id               TEXT;
  affected_recipe_materials    INTEGER := 0;
  affected_material_list_items INTEGER := 0;
  affected_menue_items         INTEGER := 0;
  affected_shopping_list_items INTEGER := 0;
BEGIN
  -- Material laden
  SELECT id, name INTO material_record
    FROM public.materials
    WHERE id = material_id_param;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material (%) existiert nicht', material_id_param;
  END IF;

  -- Neues Produkt erstellen
  INSERT INTO public.products (name, department_id, shopping_unit)
    VALUES (material_record.name, department_id_param, shopping_unit_param)
    RETURNING id INTO new_product_id;

  -- recipe_materials: Material-Referenzen → neue recipe_ingredients-Einträge
  WITH deleted_materials AS (
    DELETE FROM public.recipe_materials
      WHERE material_id = material_id_param
      RETURNING recipe_id, sort_order, quantity, unit, detail
  )
  INSERT INTO public.recipe_ingredients (recipe_id, sort_order, product_id, quantity, unit, detail)
    SELECT recipe_id, sort_order, new_product_id, quantity, unit, detail
    FROM deleted_materials;
  GET DIAGNOSTICS affected_recipe_materials = ROW_COUNT;

  -- event_material_list_items: material_id → product (als Shopping-List-Item)
  -- Material-Listen-Einträge können nicht 1:1 in Shopping-List-Einträge umgewandelt
  -- werden, daher nur die Referenz entfernen
  UPDATE public.event_material_list_items
    SET material_id = NULL
    WHERE material_id = material_id_param;
  GET DIAGNOSTICS affected_material_list_items = ROW_COUNT;

  -- event_shopping_list_items: material_id → product_id
  UPDATE public.event_shopping_list_items
    SET material_id = NULL, product_id = new_product_id
    WHERE material_id = material_id_param;
  GET DIAGNOSTICS affected_shopping_list_items = ROW_COUNT;

  -- event_menue_materials: Zeilen in event_menue_products umwandeln
  WITH deleted_menue_materials AS (
    DELETE FROM public.event_menue_materials
      WHERE material_id = material_id_param
      RETURNING id, event_id, menue_id, sort_order, quantity, unit
  )
  INSERT INTO public.event_menue_products (id, event_id, menue_id, sort_order, product_id, quantity, unit)
    SELECT id, event_id, menue_id, sort_order, new_product_id, quantity, unit
    FROM deleted_menue_materials;
  GET DIAGNOSTICS affected_menue_items = ROW_COUNT;

  -- Material löschen
  DELETE FROM public.materials WHERE id = material_id_param;

  RETURN jsonb_build_object(
    'new_product_id',           new_product_id,
    'recipe_materials',         affected_recipe_materials,
    'material_list_items',      affected_material_list_items,
    'shopping_list_items',      affected_shopping_list_items,
    'menue_items',              affected_menue_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.convert_material_to_product(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_material_to_product(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 5) where_used
--    Sucht alle Tabellen, in denen ein Produkt, Material oder
--    Rezept referenziert wird.
--    Gibt eine JSONB-Array mit Fundstellen zurück.
-- ============================================================
CREATE OR REPLACE FUNCTION public.where_used(
  item_id TEXT,
  item_type TEXT  -- 'product', 'material', 'recipe'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  results JSONB := '[]'::JSONB;
BEGIN
  IF item_id IS NULL OR item_type IS NULL THEN
    RAISE EXCEPTION 'item_id und item_type dürfen nicht NULL sein';
  END IF;

  IF item_type = 'product' THEN
    -- recipe_ingredients
    SELECT results || COALESCE(jsonb_agg(jsonb_build_object(
      'table_name',  'recipe_ingredients',
      'column_name', 'product_id',
      'record_id',   ri.id,
      'context',     r.name
    )), '[]'::JSONB)
    INTO results
    FROM public.recipe_ingredients ri
    JOIN public.recipes r ON r.id = ri.recipe_id
    WHERE ri.product_id = item_id;

    -- event_shopping_list_items
    SELECT results || COALESCE(jsonb_agg(jsonb_build_object(
      'table_name',  'event_shopping_list_items',
      'column_name', 'product_id',
      'record_id',   si.id,
      'context',     e.name
    )), '[]'::JSONB)
    INTO results
    FROM public.event_shopping_list_items si
    JOIN public.event_shopping_lists sl ON sl.id = si.list_id
    JOIN public.events e ON e.id = sl.event_id
    WHERE si.product_id = item_id;

    -- event_menue_products
    SELECT results || COALESCE(jsonb_agg(jsonb_build_object(
      'table_name',  'event_menue_products',
      'column_name', 'product_id',
      'record_id',   mp.id,
      'context',     e.name
    )), '[]'::JSONB)
    INTO results
    FROM public.event_menue_products mp
    JOIN public.event_menues m ON m.id = mp.menue_id
    JOIN public.event_meals em ON em.id = m.meal_id
    JOIN public.events e ON e.id = em.event_id
    WHERE mp.product_id = item_id;

    -- unit_conversion_products
    SELECT results || COALESCE(jsonb_agg(jsonb_build_object(
      'table_name',  'unit_conversion_products',
      'column_name', 'product_id',
      'record_id',   uc.id,
      'context',     'Einheitenumrechnung'
    )), '[]'::JSONB)
    INTO results
    FROM public.unit_conversion_products uc
    WHERE uc.product_id = item_id;

  ELSIF item_type = 'material' THEN
    -- recipe_materials
    SELECT results || COALESCE(jsonb_agg(jsonb_build_object(
      'table_name',  'recipe_materials',
      'column_name', 'material_id',
      'record_id',   rm.id,
      'context',     r.name
    )), '[]'::JSONB)
    INTO results
    FROM public.recipe_materials rm
    JOIN public.recipes r ON r.id = rm.recipe_id
    WHERE rm.material_id = item_id;

    -- event_material_list_items
    SELECT results || COALESCE(jsonb_agg(jsonb_build_object(
      'table_name',  'event_material_list_items',
      'column_name', 'material_id',
      'record_id',   mi.id,
      'context',     e.name
    )), '[]'::JSONB)
    INTO results
    FROM public.event_material_list_items mi
    JOIN public.event_material_lists ml ON ml.id = mi.list_id
    JOIN public.events e ON e.id = ml.event_id
    WHERE mi.material_id = item_id;

    -- event_menue_materials
    SELECT results || COALESCE(jsonb_agg(jsonb_build_object(
      'table_name',  'event_menue_materials',
      'column_name', 'material_id',
      'record_id',   mm.id,
      'context',     e.name
    )), '[]'::JSONB)
    INTO results
    FROM public.event_menue_materials mm
    JOIN public.event_menues m ON m.id = mm.menue_id
    JOIN public.event_meals em ON em.id = m.meal_id
    JOIN public.events e ON e.id = em.event_id
    WHERE mm.material_id = item_id;

    -- event_shopping_list_items (Materialien in Einkaufslisten)
    SELECT results || COALESCE(jsonb_agg(jsonb_build_object(
      'table_name',  'event_shopping_list_items',
      'column_name', 'material_id',
      'record_id',   si.id,
      'context',     e.name
    )), '[]'::JSONB)
    INTO results
    FROM public.event_shopping_list_items si
    JOIN public.event_shopping_lists sl ON sl.id = si.list_id
    JOIN public.events e ON e.id = sl.event_id
    WHERE si.material_id = item_id;

  ELSIF item_type = 'recipe' THEN
    -- event_menue_recipes
    SELECT results || COALESCE(jsonb_agg(jsonb_build_object(
      'table_name',  'event_menue_recipes',
      'column_name', 'recipe_id',
      'record_id',   mr.id,
      'context',     e.name
    )), '[]'::JSONB)
    INTO results
    FROM public.event_menue_recipes mr
    JOIN public.event_menues m ON m.id = mr.menue_id
    JOIN public.event_meals em ON em.id = m.meal_id
    JOIN public.events e ON e.id = em.event_id
    WHERE mr.recipe_id = item_id;

  ELSE
    RAISE EXCEPTION 'Ungültiger item_type: %. Erlaubt: product, material, recipe', item_type;
  END IF;

  RETURN results;
END;
$$;

REVOKE ALL ON FUNCTION public.where_used(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.where_used(TEXT, TEXT) TO authenticated;
