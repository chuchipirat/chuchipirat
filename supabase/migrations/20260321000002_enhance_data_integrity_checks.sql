-- ============================================================
-- Phase 13.4b: Erweiterte Datenintegritätsprüfungen + Cleanup-RPCs
--
-- Änderungen:
--   - check_unused_products: zusätzlich event_menue_products + unit_conversion_products prüfen
--   - check_unused_materials: zusätzlich event_menue_materials prüfen
--   - NEU: check_recipes_without_events
--   - NEU: check_users_without_events
--   - NEU: cleanup_unused_products, cleanup_unused_materials, cleanup_recipes_without_events
-- ============================================================

-- 1) Erweiterte Prüfung: Unbenutzte Produkte
--    Jetzt auch event_menue_products und unit_conversion_products berücksichtigt.
CREATE OR REPLACE FUNCTION public.check_unused_products()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
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

-- 2) Erweiterte Prüfung: Unbenutzte Materialien
--    Jetzt auch event_menue_materials berücksichtigt.
CREATE OR REPLACE FUNCTION public.check_unused_materials()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
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

-- 3) NEU: Rezepte ohne Event-Zuordnung
--    Öffentliche Rezepte, die in keinem Event-Menü referenziert werden.
CREATE OR REPLACE FUNCTION public.check_recipes_without_events()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
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

-- 4) NEU: Benutzer ohne Event-Zuordnung
--    Benutzer, die in keinem Event als Koch eingetragen sind.
CREATE OR REPLACE FUNCTION public.check_users_without_events()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', u.id,
    'display_name', u.display_name,
    'email', u.email
  )), '[]'::JSONB)
  FROM public.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.event_cooks ec WHERE ec.user_id = u.id::UUID);
$$;

-- ============================================================
-- Cleanup-RPCs (SECURITY DEFINER, Admin-geschützt via is_admin())
-- ============================================================

-- 5) Cleanup: Unbenutzte Produkte löschen
--    Re-validiert vor dem Löschen, damit nur wirklich unbenutzte Produkte entfernt werden.
CREATE OR REPLACE FUNCTION public.cleanup_unused_products(product_ids TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 6) Cleanup: Unbenutzte Materialien löschen
CREATE OR REPLACE FUNCTION public.cleanup_unused_materials(material_ids TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 7) Cleanup: Rezepte ohne Events löschen
--    CASCADE-Regeln der DB löschen automatisch Zutaten, Schritte und Materialien.
CREATE OR REPLACE FUNCTION public.cleanup_recipes_without_events(recipe_ids TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- ============================================================
-- Berechtigungen für neue Funktionen
-- ============================================================
REVOKE ALL ON FUNCTION public.check_recipes_without_events() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_users_without_events() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_unused_products(TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_unused_materials(TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_recipes_without_events(TEXT[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.check_recipes_without_events() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_users_without_events() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_unused_products(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_unused_materials(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_recipes_without_events(TEXT[]) TO authenticated;
