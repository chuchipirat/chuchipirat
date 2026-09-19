-- ============================================================
-- Datenintegrität: Events ohne Zeitscheibe/Köch:innen löschbar,
-- Admin-Guards für alle check_*-Funktionen
--
-- 1. Interner Helfer event_integrity_details(): Inhalt eines Events
--    (Köch:innen, Mahlzeiten, Listen, Spenden) und «leer»-Definition
--    an einer einzigen Stelle für Checks und Cleanups.
-- 2. check_events_without_dates() liefert zusätzlich den Inhalt,
--    check_events_without_cooks() ist neu.
-- 3. cleanup_events_without_dates()/cleanup_events_without_cooks()
--    löschen Events; standardmässig nur leere.
-- 4. Fünf bisher ungeschützte check_*-Funktionen (LANGUAGE sql,
--    SECURITY DEFINER, GRANT an authenticated) bekommen den
--    is_admin()-Guard der übrigen Funktionen — der Rumpf bleibt
--    unverändert. (check_events_without_dates folgt aus Punkt 2.)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helfer: Inhalt eines Events
--    «Leer» = keine Mahlzeiten, Menüs, Einkaufs-/Material-/
--    Verwendete-Rezepte-Listen und keine verknüpfte Spende
--    (donations.event_id würde beim Löschen sonst still auf NULL
--    gesetzt). Köch:innen zählen nicht: Bei einem abgebrochenen
--    Anlegen ist der Ersteller bereits als Koch eingetragen.
-- ------------------------------------------------------------
CREATE FUNCTION public.event_integrity_details(p_event_ids text[] DEFAULT NULL)
RETURNS TABLE(
  event_id text,
  event_name text,
  created_at timestamptz,
  created_by_name text,
  cook_count integer,
  meal_count integer,
  list_count integer,
  donation_count integer,
  last_activity_at timestamptz,
  is_empty boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT e.id,
         e.name,
         e.created_at,
         COALESCE(
           NULLIF(u.display_name, ''),
           NULLIF(trim(u.first_name || ' ' || u.last_name), '')
         ),
         counts.cooks,
         counts.meals,
         counts.lists,
         counts.donations,
         GREATEST(
           e.updated_at,
           (SELECT t.updated_at FROM public.event_menuplan_tracking t WHERE t.event_id = e.id)
         ),
         (counts.meals = 0 AND counts.menues = 0 AND counts.lists = 0 AND counts.donations = 0)
  FROM public.events e
  LEFT JOIN public.users u ON u.id = e.created_by
  CROSS JOIN LATERAL (
    SELECT
      (SELECT count(*) FROM public.event_cooks c WHERE c.event_id = e.id)::integer AS cooks,
      (SELECT count(*) FROM public.event_meals m WHERE m.event_id = e.id)::integer AS meals,
      (SELECT count(*) FROM public.event_menues mn WHERE mn.event_id = e.id)::integer AS menues,
      (
        (SELECT count(*) FROM public.event_shopping_lists sl WHERE sl.event_id = e.id)
        + (SELECT count(*) FROM public.event_material_lists ml WHERE ml.event_id = e.id)
        + (SELECT count(*) FROM public.event_used_recipe_lists ul WHERE ul.event_id = e.id)
      )::integer AS lists,
      (SELECT count(*) FROM public.donations d WHERE d.event_id = e.id)::integer AS donations
  ) counts
  WHERE p_event_ids IS NULL OR e.id = ANY(p_event_ids);
$$;

-- ------------------------------------------------------------
-- 2. Prüfungen für Events
--    event_id/event_name bleiben erhalten (ältere Clients lesen nur diese).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_events_without_dates() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.created_at), '[]'::jsonb)
    FROM public.event_integrity_details() d
    WHERE NOT EXISTS (SELECT 1 FROM public.event_dates ed WHERE ed.event_id = d.event_id)
  );
END;
$$;

CREATE FUNCTION public.check_events_without_cooks() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.created_at), '[]'::jsonb)
    FROM public.event_integrity_details() d
    WHERE NOT EXISTS (SELECT 1 FROM public.event_cooks ec WHERE ec.event_id = d.event_id)
  );
END;
$$;

-- ------------------------------------------------------------
-- 3. Cleanups (Muster: cleanup_unused_products)
--    Das Kriterium wird im DELETE erneut geprüft: Ein Event, das
--    inzwischen eine Zeitscheibe/Köch:in bekommen hat, bleibt bestehen.
--    Bei only_empty (Standard) werden nicht leere Events still
--    übersprungen; der Rückgabewert ist die Anzahl gelöschter Events.
-- ------------------------------------------------------------
CREATE FUNCTION public.cleanup_events_without_dates(
  event_ids text[],
  only_empty boolean DEFAULT true
) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  DELETE FROM public.events e
  WHERE e.id = ANY(event_ids)
    AND NOT EXISTS (SELECT 1 FROM public.event_dates ed WHERE ed.event_id = e.id)
    AND (
      NOT only_empty
      OR EXISTS (
        SELECT 1 FROM public.event_integrity_details(ARRAY[e.id]) d WHERE d.is_empty
      )
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE FUNCTION public.cleanup_events_without_cooks(
  event_ids text[],
  only_empty boolean DEFAULT true
) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  DELETE FROM public.events e
  WHERE e.id = ANY(event_ids)
    AND NOT EXISTS (SELECT 1 FROM public.event_cooks ec WHERE ec.event_id = e.id)
    AND (
      NOT only_empty
      OR EXISTS (
        SELECT 1 FROM public.event_integrity_details(ARRAY[e.id]) d WHERE d.is_empty
      )
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ------------------------------------------------------------
-- 4. Admin-Guard für die übrigen ungeschützten Checks.
--    Rümpfe 1:1 aus der bestehenden Definition (pg_get_functiondef),
--    nur mit plpgsql-Hülle und Guard.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_orphaned_recipes() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'recipe_id', r.id,
      'recipe_name', r.name,
      'created_by', r.created_by
    )), '[]'::jsonb)
    FROM public.recipes r
    WHERE r.created_by IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.created_by)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_orphaned_event_cooks() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'cook_id', ec.id,
      'event_id', ec.event_id,
      'user_id', ec.user_id
    )), '[]'::jsonb)
    FROM public.event_cooks ec
    WHERE NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = ec.event_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_recipes_without_events() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'recipe_id', r.id,
      'recipe_name', r.name,
      'recipe_type', r.recipe_type,
      'created_by', r.created_by
    )), '[]'::jsonb)
    FROM public.recipes r
    WHERE r.recipe_type = 'public'
      AND NOT EXISTS (SELECT 1 FROM public.event_menue_recipes emr WHERE emr.recipe_id = r.id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_unused_products() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'product_id', p.id,
      'product_name', p.name
    )), '[]'::jsonb)
    FROM public.products p
    WHERE NOT EXISTS (SELECT 1 FROM public.recipe_ingredients ri WHERE ri.product_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.event_shopping_list_items si WHERE si.product_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.event_menue_products mp WHERE mp.product_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.unit_conversion_products uc WHERE uc.product_id = p.id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_unused_materials() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'material_id', m.id,
      'material_name', m.name
    )), '[]'::jsonb)
    FROM public.materials m
    WHERE NOT EXISTS (SELECT 1 FROM public.recipe_materials rm WHERE rm.material_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM public.event_material_list_items mi WHERE mi.material_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM public.event_menue_materials mm WHERE mm.material_id = m.id)
  );
END;
$$;

-- ------------------------------------------------------------
-- Grants: nur angemeldete Nutzer, Berechtigung prüft is_admin() im Body.
-- Der Helfer ist nur für die Funktionen oben gedacht (SECURITY DEFINER)
-- und darf von Clients nicht direkt aufgerufen werden.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.event_integrity_details(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_events_without_cooks() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cleanup_events_without_dates(text[], boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cleanup_events_without_cooks(text[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_events_without_cooks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_events_without_dates(text[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_events_without_cooks(text[], boolean) TO authenticated;
