-- ─────────────────────────────────────────────────────────────────────────────
-- Community Leader darf alle Funktionen der Produkte-/Materialien-Seiten
-- ausführen (vollständige Gleichstellung mit Admin)
--
-- Bisher verlangten die UPDATE/DELETE-Policies auf products/materials, die
-- INSERT/UPDATE/DELETE-Policies auf product_synonyms/
-- product_duplicate_dismissals sowie die RPC-Funktionen merge_products(),
-- merge_materials(), convert_product_to_material() und
-- convert_material_to_product() ausschliesslich is_admin() — obwohl die UI
-- (products.tsx / materials.tsx) den "Bearbeiten"-Button und alle daraus
-- erreichbaren Aktionen (Löschen, Zusammenführen, Konvertieren) bereits für
-- Community Leader anzeigte. Ein Community Leader ohne Admin-Rolle erhielt
-- dadurch stets Fehler 42501 bzw. eine RPC-Exception.
--
-- Auf ausdrücklichen Wunsch (Produktentscheid): Community Leader soll auf
-- beiden Seiten uneingeschränkt dieselben Aktionen wie Admin ausführen
-- können — inklusive Duplikaterkennung und Synonym-Verwaltung. Die Buttons
-- "Duplikate suchen" / "Synonyme verwalten" in products.tsx wurden dafür
-- zusätzlich von "nur Admin" auf "Admin oder Community Leader" umgestellt.
--
-- Hinweis: find_similar_products() prüfte schon vorher keinerlei Rolle
-- (SECURITY DEFINER ohne is_admin()-Guard) und ist bereits für jeden
-- authentifizierten Benutzer aufrufbar — hier war keine RLS-Änderung nötig.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── RLS-Policies: products ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "products_update" ON public.products;
CREATE POLICY "products_update" ON public.products FOR UPDATE TO authenticated
  USING (is_admin() OR is_community_leader());

DROP POLICY IF EXISTS "products_delete" ON public.products;
CREATE POLICY "products_delete" ON public.products FOR DELETE TO authenticated
  USING (is_admin() OR is_community_leader());

-- ── RLS-Policies: materials ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "materials_update" ON public.materials;
CREATE POLICY "materials_update" ON public.materials FOR UPDATE TO authenticated
  USING (is_admin() OR is_community_leader());

DROP POLICY IF EXISTS "materials_delete" ON public.materials;
CREATE POLICY "materials_delete" ON public.materials FOR DELETE TO authenticated
  USING (is_admin() OR is_community_leader());

-- ── RPC: merge_products() ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.merge_products(source_product_id text, target_product_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  affected_recipe_ingredients   INTEGER := 0;
  affected_shopping_list_items  INTEGER := 0;
  affected_menue_products       INTEGER := 0;
  affected_unit_conversions     INTEGER := 0;
BEGIN
  -- Admins und Community Leader dürfen Produkte zusammenführen
  IF NOT (public.is_admin() OR public.is_community_leader()) THEN
    RAISE EXCEPTION 'Nur Administratoren oder Community Leader dürfen Produkte zusammenführen.';
  END IF;

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

  UPDATE public.recipe_ingredients
    SET product_id = target_product_id
    WHERE product_id = source_product_id;
  GET DIAGNOSTICS affected_recipe_ingredients = ROW_COUNT;

  UPDATE public.event_shopping_list_items
    SET product_id = target_product_id
    WHERE product_id = source_product_id;
  GET DIAGNOSTICS affected_shopping_list_items = ROW_COUNT;

  UPDATE public.event_menue_products
    SET product_id = target_product_id
    WHERE product_id = source_product_id;
  GET DIAGNOSTICS affected_menue_products = ROW_COUNT;

  UPDATE public.unit_conversion_products
    SET product_id = target_product_id
    WHERE product_id = source_product_id;
  GET DIAGNOSTICS affected_unit_conversions = ROW_COUNT;

  DELETE FROM public.products WHERE id = source_product_id;

  RETURN jsonb_build_object(
    'recipe_ingredients',   affected_recipe_ingredients,
    'shopping_list_items',  affected_shopping_list_items,
    'menue_products',       affected_menue_products,
    'unit_conversions',     affected_unit_conversions
  );
END;
$$;

-- ── RPC: merge_materials() ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.merge_materials(source_material_id text, target_material_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  affected_recipe_materials       INTEGER := 0;
  affected_material_list_items    INTEGER := 0;
  affected_menue_materials        INTEGER := 0;
  affected_shopping_list_items    INTEGER := 0;
BEGIN
  -- Admins und Community Leader dürfen Materialien zusammenführen
  IF NOT (public.is_admin() OR public.is_community_leader()) THEN
    RAISE EXCEPTION 'Nur Administratoren oder Community Leader dürfen Materialien zusammenführen.';
  END IF;

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

  UPDATE public.recipe_materials
    SET material_id = target_material_id
    WHERE material_id = source_material_id;
  GET DIAGNOSTICS affected_recipe_materials = ROW_COUNT;

  UPDATE public.event_material_list_items
    SET material_id = target_material_id
    WHERE material_id = source_material_id;
  GET DIAGNOSTICS affected_material_list_items = ROW_COUNT;

  UPDATE public.event_menue_materials
    SET material_id = target_material_id
    WHERE material_id = source_material_id;
  GET DIAGNOSTICS affected_menue_materials = ROW_COUNT;

  UPDATE public.event_shopping_list_items
    SET material_id = target_material_id
    WHERE material_id = source_material_id;
  GET DIAGNOSTICS affected_shopping_list_items = ROW_COUNT;

  DELETE FROM public.materials WHERE id = source_material_id;

  RETURN jsonb_build_object(
    'recipe_materials',       affected_recipe_materials,
    'material_list_items',    affected_material_list_items,
    'menue_materials',        affected_menue_materials,
    'shopping_list_items',    affected_shopping_list_items
  );
END;
$$;

-- ── RPC: convert_product_to_material() ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.convert_product_to_material(product_id_param text, material_type_param text DEFAULT 'consumable'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  product_record             RECORD;
  new_material_id            TEXT;
  affected_recipe_ingredients   INTEGER := 0;
  affected_shopping_list_items  INTEGER := 0;
  affected_menue_items          INTEGER := 0;
BEGIN
  -- Admins und Community Leader dürfen Produkte in Materialien konvertieren
  IF NOT (public.is_admin() OR public.is_community_leader()) THEN
    RAISE EXCEPTION 'Nur Administratoren oder Community Leader dürfen Produkte in Materialien konvertieren.';
  END IF;

  SELECT id, name INTO product_record
    FROM public.products
    WHERE id = product_id_param;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produkt (%) existiert nicht', product_id_param;
  END IF;

  INSERT INTO public.materials (name, type)
    VALUES (product_record.name, material_type_param::public.material_type)
    RETURNING id INTO new_material_id;

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

  UPDATE public.event_shopping_list_items
    SET product_id = NULL, material_id = new_material_id
    WHERE product_id = product_id_param;
  GET DIAGNOSTICS affected_shopping_list_items = ROW_COUNT;

  WITH deleted_menue_products AS (
    DELETE FROM public.event_menue_products
      WHERE product_id = product_id_param
      RETURNING id, event_id, menue_id, sort_order, quantity, unit
  )
  INSERT INTO public.event_menue_materials (id, event_id, menue_id, sort_order, material_id, quantity, unit)
    SELECT id, event_id, menue_id, sort_order, new_material_id, quantity, unit
    FROM deleted_menue_products;
  GET DIAGNOSTICS affected_menue_items = ROW_COUNT;

  DELETE FROM public.unit_conversion_products WHERE product_id = product_id_param;
  DELETE FROM public.products WHERE id = product_id_param;

  RETURN jsonb_build_object(
    'new_material_id',          new_material_id,
    'recipe_ingredients',       affected_recipe_ingredients,
    'shopping_list_items',      affected_shopping_list_items,
    'menue_items',              affected_menue_items
  );
END;
$$;

-- ── RPC: convert_material_to_product() ──────────────────────────────────────
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

  UPDATE public.event_material_list_items
    SET material_id = NULL
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

-- ── RLS-Policies: product_synonyms ──────────────────────────────────────────
DROP POLICY IF EXISTS "product_synonyms_insert" ON public.product_synonyms;
CREATE POLICY "product_synonyms_insert" ON public.product_synonyms FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR is_community_leader());

DROP POLICY IF EXISTS "product_synonyms_update" ON public.product_synonyms;
CREATE POLICY "product_synonyms_update" ON public.product_synonyms FOR UPDATE TO authenticated
  USING (is_admin() OR is_community_leader()) WITH CHECK (is_admin() OR is_community_leader());

DROP POLICY IF EXISTS "product_synonyms_delete" ON public.product_synonyms;
CREATE POLICY "product_synonyms_delete" ON public.product_synonyms FOR DELETE TO authenticated
  USING (is_admin() OR is_community_leader());

-- ── RLS-Policies: product_duplicate_dismissals ──────────────────────────────
DROP POLICY IF EXISTS "product_duplicate_dismissals_insert" ON public.product_duplicate_dismissals;
CREATE POLICY "product_duplicate_dismissals_insert" ON public.product_duplicate_dismissals FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR is_community_leader());

DROP POLICY IF EXISTS "product_duplicate_dismissals_delete" ON public.product_duplicate_dismissals;
CREATE POLICY "product_duplicate_dismissals_delete" ON public.product_duplicate_dismissals FOR DELETE TO authenticated
  USING (is_admin() OR is_community_leader());
