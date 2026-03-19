-- =====================================================================
-- get_user_profile_stats(p_auth_uid) — Statistiken für ein Benutzerprofil
-- =====================================================================
-- SECURITY DEFINER: Umgeht RLS, weil recipes nur vom Ersteller oder
-- bei public sichtbar sind, und event_cooks restriktive Policies hat.
-- Gibt nur aggregierte Zähler für einen einzelnen Benutzer zurück.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_user_profile_stats(p_auth_uid UUID)
RETURNS TABLE(field TEXT, value BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Rezepte
  SELECT 'noRecipesPublic',  COUNT(*)
    FROM recipes
   WHERE created_by = p_auth_uid AND recipe_type = 'public'

  UNION ALL
  SELECT 'noRecipesPrivate', COUNT(*)
    FROM recipes
   WHERE created_by = p_auth_uid AND recipe_type = 'private'

  UNION ALL
  SELECT 'noRecipesVariants', COUNT(*)
    FROM recipes
   WHERE created_by = p_auth_uid AND recipe_type = 'variant'

  -- Community-Engagement
  UNION ALL
  SELECT 'noComments',       COUNT(*)
    FROM recipe_comments
   WHERE created_by = p_auth_uid

  UNION ALL
  SELECT 'noRatings',        COUNT(*)
    FROM recipe_ratings
   WHERE user_id = p_auth_uid

  -- Anlässe
  UNION ALL
  SELECT 'noEvents',         COUNT(DISTINCT event_id)
    FROM event_cooks
   WHERE user_id = p_auth_uid

  -- Sonstiges
  UNION ALL
  SELECT 'noFoundBugs',      COALESCE(no_found_bugs, 0)::BIGINT
    FROM users
   WHERE auth_uid = p_auth_uid
$$;

GRANT EXECUTE ON FUNCTION public.get_user_profile_stats(UUID) TO authenticated;
