-- ============================================================
-- Phase 13.4: Datenintegritätsprüfungen als Postgres-Funktionen
--
-- Jede Funktion gibt Anomalien als JSONB-Array zurück.
-- ============================================================

-- 1) Verwaiste Rezepte — created_by verweist auf keinen auth.users-Eintrag
CREATE OR REPLACE FUNCTION public.check_orphaned_recipes()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
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

-- 2) Verwaiste Event-Köche — event_id verweist auf kein existierendes Event
CREATE OR REPLACE FUNCTION public.check_orphaned_event_cooks()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'cook_id', ec.id,
    'event_id', ec.event_id,
    'user_id', ec.user_id
  )), '[]'::JSONB)
  FROM public.event_cooks ec
  WHERE NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = ec.event_id);
$$;

-- 3) Events ohne Zeitscheiben
CREATE OR REPLACE FUNCTION public.check_events_without_dates()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'event_id', e.id,
    'event_name', e.name
  )), '[]'::JSONB)
  FROM public.events e
  WHERE NOT EXISTS (SELECT 1 FROM public.event_dates ed WHERE ed.event_id = e.id);
$$;

-- 4) Unbenutzte Produkte
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
    AND NOT EXISTS (SELECT 1 FROM public.event_shopping_list_items si WHERE si.product_id = p.id);
$$;

-- 5) Unbenutzte Materialien
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
    AND NOT EXISTS (SELECT 1 FROM public.event_material_list_items mi WHERE mi.material_id = m.id);
$$;

-- 6) Doppelte E-Mail-Adressen (case-insensitive)
CREATE OR REPLACE FUNCTION public.check_duplicate_emails()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
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
  GROUP BY lower(u.email), sub.cnt, sub.ids;
$$;

-- 7) Auth/Users Sync — public.users ohne passenden auth.users-Eintrag
CREATE OR REPLACE FUNCTION public.check_auth_users_sync()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', u.id,
    'auth_uid', u.auth_uid,
    'display_name', u.display_name,
    'issue', 'public.users hat keinen auth.users-Eintrag'
  )), '[]'::JSONB)
  FROM public.users u
  WHERE u.auth_uid IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.auth_uid);
$$;

-- Berechtigungen
REVOKE ALL ON FUNCTION public.check_orphaned_recipes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_orphaned_event_cooks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_events_without_dates() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_unused_products() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_unused_materials() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_duplicate_emails() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_auth_users_sync() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.check_orphaned_recipes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_orphaned_event_cooks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_events_without_dates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_unused_products() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_unused_materials() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_duplicate_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_users_sync() TO authenticated;
