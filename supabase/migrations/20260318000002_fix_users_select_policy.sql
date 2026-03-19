-- Fix: Sensible Spalten in public.users schützen
--
-- Problem: Die SELECT-Policy auf public.users wurde auf USING(true) gesetzt,
-- damit Views (request_comments_view, requests_view etc.) Profildaten anderer
-- Benutzer auflösen können. Das exponiert aber auch sensible Felder wie
-- email, first_name, last_name und roles.
--
-- Lösung:
--   1. users_select zurück auf restriktiv (eigene Zeile + communityLeader + admin)
--   2. user_profiles auf SECURITY DEFINER umstellen — die View umgeht RLS,
--      exponiert aber nur öffentliche Profil-Felder (+ no_found_bugs)
--   3. Alle security_invoker-Views, die bisher direkt gegen public.users
--      JOINen, auf public.user_profiles umstellen
--
-- Die SECURITY DEFINER Funktionen (get_event_cook_profiles,
-- get_comment_author_profiles, find_user_id_by_email) umgehen RLS bereits
-- und brauchen keine Änderung.

-- =====================================================================
-- 1. users SELECT-Policy zurück auf restriktiv
-- =====================================================================

DROP POLICY IF EXISTS users_select ON public.users;

CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated
  USING (
    auth_uid = (SELECT auth.uid())
    OR is_community_leader()
    OR is_admin()
  );

-- =====================================================================
-- 2. user_profiles: SECURITY DEFINER + no_found_bugs hinzufügen
-- =====================================================================

DROP VIEW IF EXISTS public.user_profiles;

CREATE VIEW public.user_profiles
  WITH (security_invoker = false)
AS
  SELECT
    id,
    auth_uid,
    display_name,
    created_at,
    member_id,
    motto,
    picture_src,
    no_found_bugs
  FROM public.users;

GRANT SELECT ON public.user_profiles TO anon, authenticated;

-- =====================================================================
-- 3a. requests_view: JOIN gegen user_profiles statt users
-- =====================================================================

DROP VIEW IF EXISTS public.requests_view;

CREATE VIEW public.requests_view
  WITH (security_invoker = true)
AS
SELECT
  r.id,
  r.firebase_uid,
  r.number,
  r.status,
  r.request_type,
  r.author_uid,
  r.assignee_uid,
  r.request_object_uid,
  r.change_log,
  r.resolve_date,
  r.created_at,
  r.created_by,
  r.updated_at,
  r.updated_by,
  -- Autor-Daten (aus öffentlichem Profil)
  ua.display_name   AS author_display_name,
  ua.picture_src    AS author_picture_src,
  -- Assignee-Daten (aus öffentlichem Profil)
  uas.display_name  AS assignee_display_name,
  uas.picture_src   AS assignee_picture_src,
  -- Rezept-Daten
  rec.name          AS recipe_name,
  rec.picture_src   AS recipe_picture_src
FROM public.requests r
LEFT JOIN public.user_profiles ua   ON ua.auth_uid  = r.author_uid
LEFT JOIN public.user_profiles uas  ON uas.auth_uid = r.assignee_uid
LEFT JOIN public.recipes rec        ON rec.id       = r.request_object_uid;

-- =====================================================================
-- 3b. request_comments_view: JOIN gegen user_profiles statt users
-- =====================================================================

DROP VIEW IF EXISTS public.request_comments_view;

CREATE VIEW public.request_comments_view
  WITH (security_invoker = true)
AS
SELECT
  rc.id,
  rc.request_id,
  rc.comment,
  rc.created_at,
  rc.created_by,
  rc.updated_at,
  rc.updated_by,
  -- Kommentar-Autor-Daten (aus öffentlichem Profil)
  u.display_name  AS user_display_name,
  u.picture_src   AS user_picture_src
FROM public.request_comments rc
LEFT JOIN public.user_profiles u ON u.auth_uid = rc.created_by;

-- =====================================================================
-- 3c. feeds_view: JOIN gegen user_profiles statt users
-- =====================================================================

DROP VIEW IF EXISTS public.feeds_view;

CREATE VIEW public.feeds_view
  WITH (security_invoker = true)
AS
SELECT
  f.id,
  f.firebase_uid,
  f.feed_type,
  f.visibility,
  f.user_uid,
  f.source_object_type,
  f.source_object_uid,
  f.source_object_data,
  f.created_at,
  f.created_by,
  f.updated_at,
  f.updated_by,
  -- Benutzer-Daten (aus öffentlichem Profil)
  u.display_name  AS user_display_name,
  u.picture_src   AS user_picture_src,
  -- Quell-Objekt-Name und -Bild (polymorphe Auflösung)
  COALESCE(r.name, e.name, p.name, m.name, u2.display_name, '')  AS source_object_name,
  COALESCE(r.picture_src, e.picture_src, u2.picture_src, '')      AS source_object_picture_src
FROM public.feeds f
LEFT JOIN public.user_profiles u   ON u.auth_uid  = f.user_uid
LEFT JOIN public.recipes r         ON r.id = f.source_object_uid  AND f.source_object_type = 'recipe'
LEFT JOIN public.events e          ON e.id = f.source_object_uid  AND f.source_object_type = 'event'
LEFT JOIN public.products p        ON p.id = f.source_object_uid  AND f.source_object_type = 'product'
LEFT JOIN public.materials m       ON m.id = f.source_object_uid  AND f.source_object_type = 'material'
LEFT JOIN public.user_profiles u2  ON u2.auth_uid::TEXT = f.source_object_uid AND f.source_object_type = 'user';

-- =====================================================================
-- 3d. event_material_list_items_view: JOIN gegen user_profiles statt users
-- =====================================================================

DROP VIEW IF EXISTS public.event_material_list_items_view;

CREATE VIEW public.event_material_list_items_view
  WITH (security_invoker = true)
AS
SELECT
  i.id,
  i.list_id,
  i.material_id,
  i.free_text_name,
  i.quantity,
  i.checked,
  i.edit_source,
  i.sort_order,
  i.assigned_cook_id,
  i.assigned_cook_name,
  i.created_at,
  i.created_by,
  i.updated_at,
  i.updated_by,
  COALESCE(m.name, i.free_text_name)                   AS item_name,
  COALESCE(u.display_name, i.assigned_cook_name)        AS resolved_cook_name,
  ec.user_id                                            AS assigned_cook_user_id
FROM public.event_material_list_items i
LEFT JOIN public.materials m            ON m.id = i.material_id
LEFT JOIN public.event_cooks ec         ON ec.id = i.assigned_cook_id
LEFT JOIN public.user_profiles u        ON u.auth_uid = ec.user_id;
