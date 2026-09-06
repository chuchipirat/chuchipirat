-- =============================================================================
-- Fix CHUCHIPIRAT-H2: convert_material_to_product() verletzt
-- chk_material_item_source auf event_material_list_items
--
-- Beim Konvertieren eines Materials in ein Produkt setzte die Funktion auf
-- betroffenen Materiallisten-Positionen nur `material_id = NULL`. Der Check
-- `chk_material_item_source` verlangt aber, dass genau eines von
-- (material_id, free_text_name) gesetzt ist — die Position blieb mit beiden
-- Spalten NULL zurück und der gesamte RPC-Aufruf schlug fehl (Transaktion
-- rollte zurück, es entstanden keine Teildaten).
--
-- event_material_list_items kann — anders als event_shopping_list_items —
-- keine Produkte referenzieren (keine product_id-Spalte). Die Position wird
-- deshalb in einen Freitext-Eintrag mit dem bisherigen Materialnamen
-- umgewandelt. `edit_source` bleibt bewusst unverändert; die Materialliste
-- wird beim nächsten Speichern ohnehin komplett neu geschrieben
-- (MaterialListRepository.saveListItems: delete-all + re-insert).
--
-- Nur diese eine UPDATE-Anweisung wurde geändert; der Rest der Funktion ist
-- identisch zur Definition aus 20260715000001.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.convert_material_to_product(material_id_param text, department_id_param text DEFAULT NULL::text, shopping_unit_param text DEFAULT NULL::text) RETURNS jsonb
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

  INSERT INTO public.products (name, department_id, shopping_unit)
    VALUES (material_record.name, department_id_param, shopping_unit_param)
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
