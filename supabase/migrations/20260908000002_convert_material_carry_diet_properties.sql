-- =============================================================================
-- convert_material_to_product(): Diät + Allergene für das neue Produkt setzen
--
-- Der Konvertierungs-Dialog (dialogConvertMaterialToProduct.tsx /
-- convertItem.tsx) fragt Diät (Fleisch/Vegetarisch/Vegan) und Unverträglich-
-- keiten (Laktose/Gluten) ab, gab sie aber nirgends weiter — das neue Produkt
-- wurde immer mit dem Spalten-Default `diet = 'meat'` und ohne Allergene
-- angelegt.
--
-- Die Funktion bekommt zwei zusätzliche Parameter am Ende:
--   diet_param       public.diet_type       (Default 'meat')
--   allergens_param  public.allergen_type[] (Default '{}')
-- und setzt sie beim INSERT INTO products. Der Rest der Funktion ist identisch
-- zur Definition aus 20260906000001.
--
-- Da sich die Signatur ändert (3 → 5 Parameter), wird die alte 3-Parameter-
-- Variante zuerst entfernt.
-- =============================================================================

DROP FUNCTION IF EXISTS public.convert_material_to_product(text, text, text);

CREATE OR REPLACE FUNCTION public.convert_material_to_product(
  material_id_param   text,
  department_id_param text DEFAULT NULL::text,
  shopping_unit_param text DEFAULT NULL::text,
  diet_param          public.diet_type DEFAULT 'meat'::public.diet_type,
  allergens_param     public.allergen_type[] DEFAULT '{}'::public.allergen_type[]
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  material_record              RECORD;
  new_product_id               TEXT;
  affected_recipe_materials    INTEGER := 0;
  affected_material_list_items INTEGER := 0;
  affected_menue_items         INTEGER := 0;
  affected_shopping_list_items INTEGER := 0;
BEGIN
  -- Admins und Community Leader dürfen Materialien in Produkte konvertieren
  IF NOT (public.is_admin() OR public.is_community_leader()) THEN
    RAISE EXCEPTION 'Nur Administratoren oder Community Leader dürfen Materialien in Produkte konvertieren.';
  END IF;

  SELECT id, name INTO material_record
    FROM public.materials
    WHERE id = material_id_param;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material (%) existiert nicht', material_id_param;
  END IF;

  INSERT INTO public.products (name, department_id, shopping_unit, diet, allergens)
    VALUES (
      material_record.name,
      department_id_param,
      shopping_unit_param,
      COALESCE(diet_param, 'meat'::public.diet_type),
      COALESCE(allergens_param, '{}'::public.allergen_type[])
    )
    RETURNING id INTO new_product_id;

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

  -- Materiallisten-Positionen in Freitext umwandeln: material_id entfällt,
  -- der bisherige Name bleibt als free_text_name erhalten (erfüllt
  -- chk_material_item_source). char_length(free_text_name) ist auf 200
  -- begrenzt, deshalb LEFT(...).
  UPDATE public.event_material_list_items
    SET material_id    = NULL,
        free_text_name = LEFT(material_record.name, 200)
    WHERE material_id = material_id_param;
  GET DIAGNOSTICS affected_material_list_items = ROW_COUNT;

  UPDATE public.event_shopping_list_items
    SET material_id = NULL, product_id = new_product_id
    WHERE material_id = material_id_param;
  GET DIAGNOSTICS affected_shopping_list_items = ROW_COUNT;

  WITH deleted_menue_materials AS (
    DELETE FROM public.event_menue_materials
      WHERE material_id = material_id_param
      RETURNING id, event_id, menue_id, sort_order, quantity, unit
  )
  INSERT INTO public.event_menue_products (id, event_id, menue_id, sort_order, product_id, quantity, unit)
    SELECT id, event_id, menue_id, sort_order, new_product_id, quantity, unit
    FROM deleted_menue_materials;
  GET DIAGNOSTICS affected_menue_items = ROW_COUNT;

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

REVOKE ALL ON FUNCTION public.convert_material_to_product(text, text, text, public.diet_type, public.allergen_type[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_material_to_product(text, text, text, public.diet_type, public.allergen_type[]) TO authenticated;
