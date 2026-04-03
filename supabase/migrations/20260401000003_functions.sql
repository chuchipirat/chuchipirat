-- =============================================================================
-- Chuchipirat – Baseline Migration (3/7): Functions
-- Generated: 2026-04-01
-- =============================================================================
-- This file is part of the baseline schema. Do NOT modify after first deploy.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Trigger Functions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_updated_by() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_by = (SELECT auth.uid());
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.sync_auth_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.users
    SET email = NEW.email::text
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_recipe_rating_aggregate() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  target_recipe_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_recipe_id := OLD.recipe_id;
  ELSE
    target_recipe_id := NEW.recipe_id;
  END IF;

  UPDATE public.recipes
  SET
    avg_rating = COALESCE((
      SELECT ROUND(AVG(rating)::NUMERIC, 2)
      FROM public.recipe_ratings
      WHERE recipe_id = target_recipe_id
    ), 0),
    no_ratings = (
      SELECT COUNT(*)
      FROM public.recipe_ratings
      WHERE recipe_id = target_recipe_id
    )
  WHERE id = target_recipe_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_recipe_no_comments() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.recipes
    SET no_comments = no_comments + 1
    WHERE id = NEW.recipe_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.recipes
    SET no_comments = GREATEST(0, no_comments - 1)
    WHERE id = OLD.recipe_id;
  END IF;
  RETURN NULL;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS Helper Functions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid()) AND 'admin'::public.user_role = ANY(roles)
  );
$$;

CREATE FUNCTION public.is_community_leader() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
      AND ('admin'::public.user_role = ANY(roles) OR 'communityLeader'::public.user_role = ANY(roles))
  );
$$;

CREATE FUNCTION public.is_event_cook(p_event_id text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_cooks
    WHERE event_id = p_event_id AND user_id = (SELECT auth.uid())
  );
$$;

CREATE FUNCTION public.event_has_cooks(p_event_id text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_cooks
    WHERE event_id = p_event_id
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. User Functions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE FUNCTION public.increment_logins(user_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  -- Nur der eigene Login-Zähler darf erhöht werden
  UPDATE public.users
  SET no_logins = no_logins + 1
  WHERE id = user_id AND id = (SELECT auth.uid());
$$;

CREATE FUNCTION public.increment_found_bugs(p_user_id uuid, p_delta integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  -- Nur der Benutzer selbst oder ein Admin darf den Bug-Zähler ändern
  IF (SELECT auth.uid()) != p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nicht autorisiert: Bug-Zähler kann nur vom Benutzer selbst oder einem Admin geändert werden.';
  END IF;

  UPDATE public.users
  SET no_found_bugs = GREATEST(0, no_found_bugs + p_delta)
  WHERE id = p_user_id;
END;
$$;

CREATE FUNCTION public.find_user_id_by_email(
    lookup_email text,
    p_event_id text DEFAULT NULL
) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  call_count    INTEGER;
  max_calls     INTEGER;
  result_id     UUID;
BEGIN
  -- Service-Role (Login-Fallback, Migration) oder Admin: keine Einschränkungen
  IF (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
     OR public.is_admin() THEN
    SELECT id INTO result_id
    FROM public.users
    WHERE LOWER(email) = LOWER(TRIM(lookup_email))
    LIMIT 1;
    RETURN result_id;
  END IF;

  -- Event-Koch-Prüfung (wenn Event-ID angegeben)
  IF p_event_id IS NOT NULL AND NOT public.is_event_cook(p_event_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung für dieses Event.';
  END IF;

  -- Rate Limit aus global_settings lesen
  SELECT email_lookup_rate_limit INTO max_calls
  FROM public.global_settings
  WHERE id = 'default';

  -- Fallback falls kein Wert gesetzt
  IF max_calls IS NULL THEN max_calls := 10; END IF;

  -- Alte Einträge bereinigen
  DELETE FROM public.rpc_rate_limits
  WHERE called_at < NOW() - INTERVAL '1 hour';

  -- Aktuelle Aufrufe zählen
  SELECT COUNT(*) INTO call_count
  FROM public.rpc_rate_limits
  WHERE user_id = auth.uid()
    AND function_name = 'find_user_id_by_email';

  IF call_count >= max_calls THEN
    RAISE EXCEPTION 'Rate-Limit erreicht. Bitte später erneut versuchen.';
  END IF;

  INSERT INTO public.rpc_rate_limits (user_id, function_name)
  VALUES (auth.uid(), 'find_user_id_by_email');

  -- Eigentliche Abfrage
  SELECT id INTO result_id
  FROM public.users
  WHERE LOWER(email) = LOWER(TRIM(lookup_email))
  LIMIT 1;
  RETURN result_id;
END;
$$;

CREATE FUNCTION public.get_comment_author_profiles(uids uuid[]) RETURNS TABLE(id uuid, display_name text, picture_src text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT u.id, u.display_name, u.picture_src
  FROM public.users u
  WHERE u.id = ANY(uids);
$$;

CREATE FUNCTION public.get_event_cook_profiles(p_event_id text) RETURNS TABLE(id text, user_id uuid, display_name text, motto text, picture_src text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT
    ec.id,
    ec.user_id,
    COALESCE(u.display_name, '') AS display_name,
    COALESCE(u.motto, '') AS motto,
    COALESCE(u.picture_src, '') AS picture_src
  FROM public.event_cooks ec
  LEFT JOIN public.users u ON u.id = ec.user_id
  WHERE ec.event_id = p_event_id
    AND (is_event_cook(p_event_id) OR is_admin());
$$;

CREATE FUNCTION public.get_user_profile_stats(p_user_id uuid) RETURNS TABLE(field text, value bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  -- Prüfen ob der Aufrufer berechtigt ist, private Statistiken zu sehen
  is_privileged BOOLEAN;
BEGIN
  is_privileged := (
    p_user_id = (SELECT auth.uid())
    OR public.is_admin()
    OR public.is_community_leader()
  );

  RETURN QUERY
  SELECT 'noRecipesPublic'::TEXT,  COUNT(*)
    FROM recipes
   WHERE created_by = p_user_id AND recipe_type = 'public'

  UNION ALL
  SELECT 'noRecipesPrivate'::TEXT,
    CASE WHEN is_privileged THEN
      (SELECT COUNT(*) FROM recipes WHERE created_by = p_user_id AND recipe_type = 'private')
    ELSE 0::BIGINT
    END

  UNION ALL
  SELECT 'noRecipesVariants'::TEXT, COUNT(*)
    FROM recipes
   WHERE created_by = p_user_id AND recipe_type = 'variant'

  UNION ALL
  SELECT 'noComments'::TEXT,       COUNT(*)
    FROM recipe_comments
   WHERE created_by = p_user_id

  UNION ALL
  SELECT 'noRatings'::TEXT,        COUNT(*)
    FROM recipe_ratings
   WHERE user_id = p_user_id

  UNION ALL
  SELECT 'noEvents'::TEXT,         COUNT(DISTINCT event_id)
    FROM event_cooks
   WHERE user_id = p_user_id

  UNION ALL
  SELECT 'noDonations'::TEXT,      COUNT(*)
    FROM donations
   WHERE donor_uid = p_user_id AND status IN ('confirmed', 'migrated')

  UNION ALL
  SELECT 'noFoundBugs'::TEXT,      COALESCE(no_found_bugs, 0)::BIGINT
    FROM users
   WHERE id = p_user_id;
END;
$$;

CREATE FUNCTION public.get_platform_stats() RETURNS TABLE(field text, value numeric)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT 'noUsers',              COUNT(*)::NUMERIC FROM users
  UNION ALL SELECT 'noCooks',              COUNT(DISTINCT user_id)::NUMERIC FROM event_cooks
  UNION ALL SELECT 'noRecipesPublic',      COUNT(*)::NUMERIC FROM recipes WHERE recipe_type = 'public'
  UNION ALL SELECT 'noRecipesPrivate',     COUNT(*)::NUMERIC FROM recipes WHERE recipe_type = 'private'
  UNION ALL SELECT 'noRecipesVariants',    COUNT(*)::NUMERIC FROM recipes WHERE recipe_type = 'variant'
  UNION ALL SELECT 'noRatings',            COUNT(*)::NUMERIC FROM recipe_ratings
  UNION ALL SELECT 'noComments',           COUNT(*)::NUMERIC FROM recipe_comments
  UNION ALL SELECT 'noEvents',             COUNT(*)::NUMERIC FROM events
  UNION ALL SELECT 'noParticipants',       COALESCE(SUM(servings), 0)::NUMERIC FROM event_groupconfiguration_portions
  UNION ALL SELECT 'noPlanedDays',         COALESCE(SUM(date_to - date_from + 1), 0)::NUMERIC FROM event_dates
  UNION ALL SELECT 'noPortions',           COALESCE(SUM(total_portions), 0)::NUMERIC FROM event_menue_recipes
  UNION ALL SELECT 'noShoppingLists',      COUNT(*)::NUMERIC FROM event_shopping_lists
  UNION ALL SELECT 'noMaterialLists',      COUNT(*)::NUMERIC FROM event_material_lists
  UNION ALL SELECT 'avgEventDuration',     COALESCE(ROUND(AVG(date_to - date_from + 1), 1), 0) FROM event_dates
  UNION ALL SELECT 'avgCooksPerEvent',     COALESCE(ROUND(AVG(cook_count), 1), 0) FROM (SELECT COUNT(*) AS cook_count FROM event_cooks GROUP BY event_id) sub
  UNION ALL SELECT 'avgRecipesPerEvent',   COALESCE(ROUND(AVG(recipe_count), 1), 0) FROM (SELECT COUNT(*) AS recipe_count FROM event_menue_recipes GROUP BY event_id) sub
  UNION ALL SELECT 'avgPortionsPerEvent',  COALESCE(ROUND(AVG(portion_sum), 1), 0) FROM (SELECT SUM(total_portions) AS portion_sum FROM event_menue_recipes GROUP BY event_id) sub
  UNION ALL SELECT 'avgShoppingListItems', COALESCE(ROUND(AVG(item_count), 1), 0) FROM (SELECT COUNT(*) AS item_count FROM event_shopping_list_items GROUP BY list_id) sub
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Recipe Functions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE FUNCTION public.save_menuplan(p_event_id text, p_payload jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
AS $$
BEGIN
  -- Tages-Notizen (menue_id IS NULL) werden NICHT durch CASCADE
  -- auf event_meal_types erfasst, daher explizit löschen.
  DELETE FROM event_notes
    WHERE event_id = p_event_id
      AND menue_id IS NULL;

  -- CASCADE auf event_meal_types räumt alle Kindtabellen auf
  DELETE FROM event_meal_types
    WHERE event_id = p_event_id;

  -- event_meal_types
  INSERT INTO event_meal_types (id, event_id, name, sort_order)
  SELECT
    elem->>'id',
    p_event_id,
    elem->>'name',
    (elem->>'sort_order')::INTEGER
  FROM jsonb_array_elements(p_payload->'mealTypes') AS elem
  WHERE p_payload->'mealTypes' IS NOT NULL
    AND jsonb_array_length(p_payload->'mealTypes') > 0;

  -- event_meals
  INSERT INTO event_meals (id, event_id, meal_date, meal_type_id)
  SELECT
    elem->>'id',
    p_event_id,
    (elem->>'meal_date')::DATE,
    elem->>'meal_type_id'
  FROM jsonb_array_elements(p_payload->'meals') AS elem
  WHERE p_payload->'meals' IS NOT NULL
    AND jsonb_array_length(p_payload->'meals') > 0;

  -- event_menues
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

  -- event_menue_recipes
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

  -- event_menue_products
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

  -- event_menue_materials
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

  -- event_notes
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

  -- event_menuplan_item_plans
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

  -- Tracking aktualisieren
  UPDATE event_menuplan_tracking
  SET updated_at = NOW()
  WHERE event_id = p_event_id;

END;
$$;

CREATE FUNCTION public.delete_recipe(p_recipe_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  -- Nur der Ersteller oder ein Community Leader darf ein Rezept löschen.
  IF NOT EXISTS (
    SELECT 1 FROM public.recipes
    WHERE id = p_recipe_id
      AND (created_by = (SELECT auth.uid()) OR public.is_community_leader())
  ) THEN
    RAISE EXCEPTION 'Nicht autorisiert: Rezept kann nur vom Ersteller oder Community Leader gelöscht werden.';
  END IF;

  UPDATE event_menue_recipes
  SET deleted_recipe_name = (SELECT name FROM recipes WHERE id = p_recipe_id),
      recipe_id = NULL
  WHERE recipe_id = p_recipe_id;

  DELETE FROM recipes WHERE id = p_recipe_id;
END;
$$;

CREATE FUNCTION public.get_used_recipe_list_recipes(p_list_id text) RETURNS TABLE(recipe_id text, recipe_name text, menue_id text, meal_id text, meal_date date, meal_type_name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
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
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Admin Operations
-- ─────────────────────────────────────────────────────────────────────────────

CREATE FUNCTION public.merge_products(source_product_id text, target_product_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  affected_recipe_ingredients   INTEGER := 0;
  affected_shopping_list_items  INTEGER := 0;
  affected_menue_products       INTEGER := 0;
  affected_unit_conversions     INTEGER := 0;
BEGIN
  -- Nur Admins dürfen Produkte zusammenführen
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen Produkte zusammenführen.';
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

CREATE FUNCTION public.merge_materials(source_material_id text, target_material_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  affected_recipe_materials       INTEGER := 0;
  affected_material_list_items    INTEGER := 0;
  affected_menue_materials        INTEGER := 0;
  affected_shopping_list_items    INTEGER := 0;
BEGIN
  -- Nur Admins dürfen Materialien zusammenführen
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen Materialien zusammenführen.';
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

CREATE FUNCTION public.convert_product_to_material(product_id_param text, material_type_param text DEFAULT 'consumable'::text) RETURNS jsonb
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
  -- Nur Admins dürfen Produkte in Materialien konvertieren
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen Produkte in Materialien konvertieren.';
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

CREATE FUNCTION public.convert_material_to_product(material_id_param text, department_id_param text DEFAULT NULL::text, shopping_unit_param text DEFAULT NULL::text) RETURNS jsonb
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
  -- Nur Admins dürfen Materialien in Produkte konvertieren
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen Materialien in Produkte konvertieren.';
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

CREATE FUNCTION public.where_used(item_id text, item_type text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  results JSONB := '[]'::JSONB;
BEGIN
  IF item_id IS NULL OR item_type IS NULL THEN
    RAISE EXCEPTION 'item_id und item_type dürfen nicht NULL sein';
  END IF;

  IF item_type = 'product' THEN
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

CREATE FUNCTION public.find_similar_products(similarity_threshold double precision DEFAULT 0.3) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH
    trigram_pairs AS (
      SELECT
        product_a.id   AS product_a_id,
        product_a.name AS product_a_name,
        product_b.id   AS product_b_id,
        product_b.name AS product_b_name,
        similarity(product_a.name, product_b.name) AS similarity_score,
        'trigram' AS match_type
      FROM public.products product_a
      JOIN public.products product_b
        ON product_a.id < product_b.id
      WHERE similarity(product_a.name, product_b.name) >= similarity_threshold
    ),
    synonym_pairs AS (
      SELECT
        product_a.id   AS product_a_id,
        product_a.name AS product_a_name,
        product_b.id   AS product_b_id,
        product_b.name AS product_b_name,
        1.0::FLOAT     AS similarity_score,
        'synonym' AS match_type
      FROM public.product_synonyms synonym
      JOIN public.products product_a
        ON LOWER(product_a.name) = LOWER(synonym.name_a)
      JOIN public.products product_b
        ON LOWER(product_b.name) = LOWER(synonym.name_b)
      WHERE product_a.id <> product_b.id
    ),
    combined AS (
      SELECT DISTINCT ON (
        LEAST(product_a_id, product_b_id),
        GREATEST(product_a_id, product_b_id)
      )
        product_a_id,
        product_a_name,
        product_b_id,
        product_b_name,
        similarity_score,
        match_type
      FROM (
        SELECT * FROM synonym_pairs
        UNION ALL
        SELECT * FROM trigram_pairs
      ) all_pairs
      ORDER BY
        LEAST(product_a_id, product_b_id),
        GREATEST(product_a_id, product_b_id),
        match_type DESC
    ),
    filtered AS (
      SELECT combined.*
      FROM combined
      LEFT JOIN public.product_duplicate_dismissals dismissal
        ON dismissal.product_a_id = LEAST(combined.product_a_id, combined.product_b_id)
       AND dismissal.product_b_id = GREATEST(combined.product_a_id, combined.product_b_id)
      WHERE dismissal.id IS NULL
    )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'product_a_id',   product_a_id,
      'product_a_name', product_a_name,
      'product_b_id',   product_b_id,
      'product_b_name', product_b_name,
      'similarity',     ROUND(similarity_score::NUMERIC, 3),
      'match_type',     match_type
    )
    ORDER BY similarity_score DESC
  ), '[]'::JSONB)
  INTO result
  FROM filtered;

  RETURN result;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Data Integrity (check_* / cleanup_*)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE FUNCTION public.check_auth_users_sync() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'user_id', u.id,
      'auth_uid', u.auth_uid,
      'display_name', u.display_name,
      'issue', 'public.users hat keinen auth.users-Eintrag'
    )), '[]'::JSONB)
    FROM public.users u
    WHERE u.auth_uid IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.auth_uid)
  );
END;
$$;

CREATE FUNCTION public.check_duplicate_emails() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'email', lower(u.email),
      'count', sub.cnt,
      'user_ids', sub.ids
    )), '[]'::JSONB)
    FROM (
      SELECT lower(email) AS email_lower, COUNT(*) AS cnt, array_agg(id) AS ids
      FROM public.users
      WHERE email IS NOT NULL AND email != ''
      GROUP BY lower(email)
      HAVING COUNT(*) > 1
    ) sub
    JOIN public.users u ON lower(u.email) = sub.email_lower
    GROUP BY lower(u.email), sub.cnt, sub.ids
  );
END;
$$;

CREATE FUNCTION public.check_events_without_dates() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'event_id', e.id,
    'event_name', e.name
  )), '[]'::JSONB)
  FROM public.events e
  WHERE NOT EXISTS (SELECT 1 FROM public.event_dates ed WHERE ed.event_id = e.id);
$$;

CREATE FUNCTION public.check_orphaned_event_cooks() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'cook_id', ec.id,
    'event_id', ec.event_id,
    'user_id', ec.user_id
  )), '[]'::JSONB)
  FROM public.event_cooks ec
  WHERE NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = ec.event_id);
$$;

CREATE FUNCTION public.check_orphaned_recipes() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'recipe_id', r.id,
    'recipe_name', r.name,
    'created_by', r.created_by
  )), '[]'::JSONB)
  FROM public.recipes r
  WHERE r.created_by IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.created_by);
$$;

CREATE FUNCTION public.check_recipes_without_events() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'recipe_id', r.id,
    'recipe_name', r.name,
    'recipe_type', r.recipe_type,
    'created_by', r.created_by
  )), '[]'::JSONB)
  FROM public.recipes r
  WHERE r.recipe_type = 'public'
    AND NOT EXISTS (SELECT 1 FROM public.event_menue_recipes emr WHERE emr.recipe_id = r.id);
$$;

CREATE FUNCTION public.check_unused_products() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', p.id,
    'product_name', p.name
  )), '[]'::JSONB)
  FROM public.products p
  WHERE NOT EXISTS (SELECT 1 FROM public.recipe_ingredients ri WHERE ri.product_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.event_shopping_list_items si WHERE si.product_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.event_menue_products mp WHERE mp.product_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.unit_conversion_products uc WHERE uc.product_id = p.id);
$$;

CREATE FUNCTION public.check_unused_materials() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'material_id', m.id,
    'material_name', m.name
  )), '[]'::JSONB)
  FROM public.materials m
  WHERE NOT EXISTS (SELECT 1 FROM public.recipe_materials rm WHERE rm.material_id = m.id)
    AND NOT EXISTS (SELECT 1 FROM public.event_material_list_items mi WHERE mi.material_id = m.id)
    AND NOT EXISTS (SELECT 1 FROM public.event_menue_materials mm WHERE mm.material_id = m.id);
$$;

CREATE FUNCTION public.check_users_without_events() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'user_id', u.id,
      'display_name', u.display_name,
      'email', u.email
    )), '[]'::JSONB)
    FROM public.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM public.event_cooks ec WHERE ec.user_id = u.id
    )
  );
END;
$$;

CREATE FUNCTION public.cleanup_unused_products(product_ids text[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  DELETE FROM public.products p
  WHERE p.id = ANY(product_ids)
    AND NOT EXISTS (SELECT 1 FROM public.recipe_ingredients ri WHERE ri.product_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.event_shopping_list_items si WHERE si.product_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.event_menue_products mp WHERE mp.product_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.unit_conversion_products uc WHERE uc.product_id = p.id);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE FUNCTION public.cleanup_unused_materials(material_ids text[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  DELETE FROM public.materials m
  WHERE m.id = ANY(material_ids)
    AND NOT EXISTS (SELECT 1 FROM public.recipe_materials rm WHERE rm.material_id = m.id)
    AND NOT EXISTS (SELECT 1 FROM public.event_material_list_items mi WHERE mi.material_id = m.id)
    AND NOT EXISTS (SELECT 1 FROM public.event_menue_materials mm WHERE mm.material_id = m.id);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE FUNCTION public.cleanup_recipes_without_events(recipe_ids text[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  DELETE FROM public.recipes r
  WHERE r.id = ANY(recipe_ids)
    AND r.recipe_type = 'public'
    AND NOT EXISTS (SELECT 1 FROM public.event_menue_recipes emr WHERE emr.recipe_id = r.id);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Donations
-- ─────────────────────────────────────────────────────────────────────────────

CREATE FUNCTION public.generate_donation_receipt_number() RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT EXTRACT(YEAR FROM NOW())::TEXT || '-' ||
         LPAD(nextval('public.donation_receipt_seq')::TEXT, 4, '0');
$$;

CREATE FUNCTION public.get_donation_goal_stats() RETURNS TABLE(total_cents bigint, donor_count bigint, donation_count bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(SUM(amount_in_cents), 0)::BIGINT AS total_cents,
    COUNT(DISTINCT donor_uid)::BIGINT AS donor_count,
    COUNT(*)::BIGINT AS donation_count
  FROM donations
  WHERE status = 'confirmed'
    AND EXTRACT(YEAR FROM paid_at) = EXTRACT(YEAR FROM NOW());
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Session Management
-- ─────────────────────────────────────────────────────────────────────────────

CREATE FUNCTION public.revoke_user_sessions(target_user_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'auth', 'public'
AS $$
BEGIN
  DELETE FROM auth.refresh_tokens
  WHERE session_id IN (
    SELECT id FROM auth.sessions
    WHERE user_id = ANY(target_user_ids)
  );

  DELETE FROM auth.sessions
  WHERE user_id = ANY(target_user_ids);
END;
$$;
