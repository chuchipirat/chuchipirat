-- =========================================================================
-- Migration: Vereinheitlichung users.id mit auth.users.id
-- =========================================================================
-- Konvertiert users.id von TEXT (Firebase-UID) auf UUID und macht es
-- identisch mit auth.users(id). Die redundante auth_uid-Spalte wird
-- entfernt. Alle abhängigen Objekte (Views, Policies, Funktionen,
-- Triggers, Indexes) werden neu erstellt.
--
-- Voraussetzungen:
--   - Alle Benutzer müssen eine auth_uid haben (Firebase-Migration abgeschlossen)
--   - Legacy Firebase-UIDs werden in legacy_firebase_uid gesichert
-- =========================================================================

BEGIN;

-- =====================================================================
-- 1. Legacy Firebase-UIDs sichern
-- =====================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS legacy_firebase_uid TEXT;

UPDATE public.users
   SET legacy_firebase_uid = id
 WHERE id != auth_uid::TEXT;

-- =====================================================================
-- 2. Verwaiste Zeilen entfernen (ohne auth_uid — Sicherheitsnetz)
-- =====================================================================

DELETE FROM public.users WHERE auth_uid IS NULL;

-- =====================================================================
-- 3. id auf auth_uid setzen (für alle verbleibenden Zeilen)
-- =====================================================================

UPDATE public.users SET id = auth_uid::TEXT;

-- =====================================================================
-- 4. Abhängige Objekte entfernen
-- =====================================================================

-- 4a. Views entfernen (hängen von auth_uid-Spalte ab)
DROP VIEW IF EXISTS public.event_material_list_items_view;
DROP VIEW IF EXISTS public.feeds_view;
DROP VIEW IF EXISTS public.request_comments_view;
DROP VIEW IF EXISTS public.requests_view;
DROP VIEW IF EXISTS public.user_profiles;

-- 4b. Welcome-E-Mail-Trigger und Funktion entfernen (Part 2 löst das anders)
DROP TRIGGER IF EXISTS trg_welcome_email_insert ON public.users;
DROP TRIGGER IF EXISTS trg_welcome_email_update ON public.users;
DROP FUNCTION IF EXISTS public.notify_welcome_email();

-- 4c. Policies entfernen
DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS users_insert ON public.users;
DROP POLICY IF EXISTS users_update ON public.users;

-- 4d. Index entfernen
DROP INDEX IF EXISTS idx_users_auth_uid;

-- 4e. FK-Constraint auf auth_uid entfernen
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS fk_users_auth_uid;

-- =====================================================================
-- 5. Spaltentyp ändern: id TEXT → UUID
-- =====================================================================

ALTER TABLE public.users ALTER COLUMN id TYPE UUID USING id::UUID;

-- =====================================================================
-- 6. auth_uid-Spalte entfernen
-- =====================================================================

ALTER TABLE public.users DROP COLUMN auth_uid;

-- =====================================================================
-- 7. FK auf auth.users(id) erstellen
-- =====================================================================

ALTER TABLE public.users
  ADD CONSTRAINT fk_users_auth
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- =====================================================================
-- 8. Funktionen neu erstellen (auth_uid → id)
-- =====================================================================

-- 8a. is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid()) AND 'admin'::public.user_role = ANY(roles)
  );
$$;

-- 8b. is_community_leader()
CREATE OR REPLACE FUNCTION public.is_community_leader()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
      AND ('admin'::public.user_role = ANY(roles) OR 'communityLeader'::public.user_role = ANY(roles))
  );
$$;

-- 8c. increment_logins(user_id UUID) — Parametertyp von TEXT auf UUID
DROP FUNCTION IF EXISTS public.increment_logins(TEXT);
CREATE OR REPLACE FUNCTION public.increment_logins(user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.users
  SET no_logins = no_logins + 1
  WHERE id = user_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_logins(UUID) TO authenticated;

-- 8d. sync_auth_email() — auth_uid → id
CREATE OR REPLACE FUNCTION public.sync_auth_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 8e. increment_found_bugs(p_user_id UUID) — Parametertyp von TEXT auf UUID
DROP FUNCTION IF EXISTS public.increment_found_bugs(TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.increment_found_bugs(p_user_id UUID, p_delta INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET no_found_bugs = GREATEST(0, no_found_bugs + p_delta)
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_found_bugs(UUID, INTEGER) TO authenticated;

-- 8f. get_comment_author_profiles(uids UUID[]) — auth_uid → id
-- DROP nötig: Rückgabe-Spalte ändert sich von auth_uid → id
DROP FUNCTION IF EXISTS public.get_comment_author_profiles(UUID[]);
CREATE FUNCTION public.get_comment_author_profiles(uids UUID[])
RETURNS TABLE(id UUID, display_name TEXT, picture_src TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id, u.display_name, u.picture_src
  FROM public.users u
  WHERE u.id = ANY(uids);
$$;

GRANT EXECUTE ON FUNCTION public.get_comment_author_profiles(UUID[]) TO authenticated;

-- 8g. find_user_id_by_email(lookup_email TEXT) — auth_uid → id
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(lookup_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id
  FROM public.users
  WHERE LOWER(email) = LOWER(TRIM(lookup_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_user_id_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT) TO authenticated;

-- 8h. get_event_cook_profiles(p_event_id TEXT) — auth_uid → id
CREATE OR REPLACE FUNCTION public.get_event_cook_profiles(p_event_id TEXT)
RETURNS TABLE(
  id TEXT,
  user_id UUID,
  display_name TEXT,
  motto TEXT,
  picture_src TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.get_event_cook_profiles(TEXT) TO authenticated;

-- 8i. get_user_profile_stats(p_user_id UUID) — Parameter umbenannt
DROP FUNCTION IF EXISTS public.get_user_profile_stats(UUID);
CREATE OR REPLACE FUNCTION public.get_user_profile_stats(p_user_id UUID)
RETURNS TABLE(field TEXT, value BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'noRecipesPublic',  COUNT(*)
    FROM recipes
   WHERE created_by = p_user_id AND recipe_type = 'public'

  UNION ALL
  SELECT 'noRecipesPrivate', COUNT(*)
    FROM recipes
   WHERE created_by = p_user_id AND recipe_type = 'private'

  UNION ALL
  SELECT 'noRecipesVariants', COUNT(*)
    FROM recipes
   WHERE created_by = p_user_id AND recipe_type = 'variant'

  UNION ALL
  SELECT 'noComments',       COUNT(*)
    FROM recipe_comments
   WHERE created_by = p_user_id

  UNION ALL
  SELECT 'noRatings',        COUNT(*)
    FROM recipe_ratings
   WHERE user_id = p_user_id

  UNION ALL
  SELECT 'noEvents',         COUNT(DISTINCT event_id)
    FROM event_cooks
   WHERE user_id = p_user_id

  UNION ALL
  SELECT 'noFoundBugs',      COALESCE(no_found_bugs, 0)::BIGINT
    FROM users
   WHERE id = p_user_id
$$;

GRANT EXECUTE ON FUNCTION public.get_user_profile_stats(UUID) TO authenticated;

-- 8j. check_users_without_events() — auth_uid → id
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
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_cooks ec WHERE ec.user_id = u.id
  );
$$;

-- =====================================================================
-- 9. RLS-Policies neu erstellen (auth_uid → id)
-- =====================================================================

CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR is_community_leader()
    OR is_admin()
  );

CREATE POLICY users_insert ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()) OR is_admin());

CREATE POLICY users_update ON public.users
  FOR UPDATE TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR is_admin()
  )
  WITH CHECK (
    -- Eigenes Profil: roles darf nicht geändert werden
    (id = (SELECT auth.uid())
      AND roles = (SELECT roles FROM public.users WHERE id = (SELECT auth.uid())))
    -- Admin: darf alles ändern
    OR is_admin()
  );

-- =====================================================================
-- 10. Views neu erstellen (auth_uid entfernt, JOIN auf id)
-- =====================================================================

-- 10a. user_profiles
CREATE VIEW public.user_profiles
  WITH (security_invoker = false)
AS
  SELECT
    id,
    display_name,
    created_at,
    member_id,
    motto,
    picture_src,
    no_found_bugs
  FROM public.users;

GRANT SELECT ON public.user_profiles TO anon, authenticated;

-- 10b. requests_view
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
  ua.display_name   AS author_display_name,
  ua.picture_src    AS author_picture_src,
  uas.display_name  AS assignee_display_name,
  uas.picture_src   AS assignee_picture_src,
  rec.name          AS recipe_name,
  rec.picture_src   AS recipe_picture_src
FROM public.requests r
LEFT JOIN public.user_profiles ua   ON ua.id  = r.author_uid
LEFT JOIN public.user_profiles uas  ON uas.id = r.assignee_uid
LEFT JOIN public.recipes rec        ON rec.id = r.request_object_uid;

-- 10c. request_comments_view
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
  u.display_name  AS user_display_name,
  u.picture_src   AS user_picture_src
FROM public.request_comments rc
LEFT JOIN public.user_profiles u ON u.id = rc.created_by;

-- 10d. feeds_view
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
  u.display_name  AS user_display_name,
  u.picture_src   AS user_picture_src,
  COALESCE(r.name, e.name, p.name, m.name, u2.display_name, '')  AS source_object_name,
  COALESCE(r.picture_src, e.picture_src, u2.picture_src, '')      AS source_object_picture_src
FROM public.feeds f
LEFT JOIN public.user_profiles u   ON u.id  = f.user_uid
LEFT JOIN public.recipes r         ON r.id = f.source_object_uid  AND f.source_object_type = 'recipe'
LEFT JOIN public.events e          ON e.id = f.source_object_uid  AND f.source_object_type = 'event'
LEFT JOIN public.products p        ON p.id = f.source_object_uid  AND f.source_object_type = 'product'
LEFT JOIN public.materials m       ON m.id = f.source_object_uid  AND f.source_object_type = 'material'
LEFT JOIN public.user_profiles u2  ON u2.id::TEXT = f.source_object_uid AND f.source_object_type = 'user';

-- 10e. event_material_list_items_view
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
LEFT JOIN public.user_profiles u        ON u.id = ec.user_id;

COMMIT;
