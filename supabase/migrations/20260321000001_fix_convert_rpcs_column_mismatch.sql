-- ============================================================
-- Fix: convert_product_to_material / convert_material_to_product
--
-- recipe_materials hat keine Spalten «unit» und «detail».
-- Die RETURNING-Klauseln und INSERTs müssen diese Spalten
-- auslassen, damit die Konvertierung nicht fehlschlägt.
-- ============================================================

-- 1) convert_product_to_material — unit/detail entfernen
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
  -- recipe_materials hat kein «unit» und «detail» → nur recipe_id, quantity übernehmen
  -- sort_order wird ans Ende der bestehenden Materialliste gesetzt
  WITH deleted_ingredients AS (
    DELETE FROM public.recipe_ingredients
      WHERE product_id = product_id_param
      RETURNING recipe_id, quantity
  ),
  max_sort AS (
    SELECT rm.recipe_id, COALESCE(MAX(rm.sort_order), 0) AS max_order
      FROM public.recipe_materials rm
      WHERE rm.recipe_id IN (SELECT di.recipe_id FROM deleted_ingredients di)
      GROUP BY rm.recipe_id
  )
  INSERT INTO public.recipe_materials (recipe_id, sort_order, material_id, quantity)
    SELECT
      di.recipe_id,
      COALESCE(ms.max_order, 0) + ROW_NUMBER() OVER (PARTITION BY di.recipe_id ORDER BY di.quantity),
      new_material_id,
      di.quantity
    FROM deleted_ingredients di
    LEFT JOIN max_sort ms ON ms.recipe_id = di.recipe_id;
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


-- 2) convert_material_to_product — unit/detail entfernen
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
  -- recipe_materials hat kein «unit» und «detail» → nur recipe_id, quantity übernehmen
  -- sort_order wird ans Ende der bestehenden Zutatenliste gesetzt
  WITH deleted_materials AS (
    DELETE FROM public.recipe_materials
      WHERE material_id = material_id_param
      RETURNING recipe_id, quantity
  ),
  max_sort AS (
    SELECT ri.recipe_id, COALESCE(MAX(ri.sort_order), 0) AS max_order
      FROM public.recipe_ingredients ri
      WHERE ri.recipe_id IN (SELECT dm.recipe_id FROM deleted_materials dm)
      GROUP BY ri.recipe_id
  )
  INSERT INTO public.recipe_ingredients (recipe_id, sort_order, product_id, quantity)
    SELECT
      dm.recipe_id,
      COALESCE(ms.max_order, 0) + ROW_NUMBER() OVER (PARTITION BY dm.recipe_id ORDER BY dm.quantity),
      new_product_id,
      dm.quantity
    FROM deleted_materials dm
    LEFT JOIN max_sort ms ON ms.recipe_id = dm.recipe_id;
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
