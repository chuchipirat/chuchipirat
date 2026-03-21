-- ============================================================
-- Erweitert where_used() um parent_id und parent_type
-- für Navigation zu Rezepten/Events in der App.
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
      'parent_id',   ri.recipe_id,
      'parent_type', 'recipe',
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
      'parent_id',   e.id,
      'parent_type', 'event',
      'context',     e.name,
      'list_id',     sl.id
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
      'parent_id',   e.id,
      'parent_type', 'event',
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
      'parent_id',   uc.product_id,
      'parent_type', 'product',
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
      'parent_id',   rm.recipe_id,
      'parent_type', 'recipe',
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
      'parent_id',   e.id,
      'parent_type', 'event',
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
      'parent_id',   e.id,
      'parent_type', 'event',
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
      'parent_id',   e.id,
      'parent_type', 'event',
      'context',     e.name,
      'list_id',     sl.id
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
      'parent_id',   e.id,
      'parent_type', 'event',
      'context',     e.name
    )), '[]'::JSONB)
    INTO results
    FROM public.event_menue_recipes mr
    JOIN public.event_menues m ON m.id = mr.menue_id
    JOIN public.event_meals em ON em.id = m.meal_id
    JOIN public.events e ON e.id = em.event_id
    WHERE mr.recipe_id = item_id;

    -- recipes (Varianten dieses Rezepts)
    SELECT results || COALESCE(jsonb_agg(jsonb_build_object(
      'table_name',  'recipe_variants',
      'column_name', 'original_recipe_uid',
      'record_id',   rv.id,
      'parent_id',   rv.id,
      'parent_type', 'recipe',
      'context',     COALESCE(rv.variant_name, rv.name)
    )), '[]'::JSONB)
    INTO results
    FROM public.recipes rv
    WHERE rv.original_recipe_uid = item_id;

    -- recipes (Original-Rezept, falls das gesuchte eine Variante ist)
    SELECT results || COALESCE(jsonb_agg(jsonb_build_object(
      'table_name',  'recipe_original',
      'column_name', 'id',
      'record_id',   orig.id,
      'parent_id',   orig.id,
      'parent_type', 'recipe',
      'context',     orig.name
    )), '[]'::JSONB)
    INTO results
    FROM public.recipes searched
    JOIN public.recipes orig ON orig.id = searched.original_recipe_uid
    WHERE searched.id = item_id
      AND searched.original_recipe_uid IS NOT NULL;

  ELSE
    RAISE EXCEPTION 'Ungültiger item_type: %. Erlaubt: product, material, recipe', item_type;
  END IF;

  RETURN results;
END;
$$;
