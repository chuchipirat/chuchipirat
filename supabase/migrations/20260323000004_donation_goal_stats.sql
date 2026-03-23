-- =====================================================================
-- RPC: get_donation_goal_stats() — aggregierte Spendenstatistik
-- =====================================================================
-- Gibt Total bestätigter Spenden in Rappen, Anzahl Spender und
-- Anzahl Spenden für das aktuelle Jahr zurück.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_donation_goal_stats()
RETURNS TABLE(total_cents BIGINT, donor_count BIGINT, donation_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(amount_in_cents), 0)::BIGINT AS total_cents,
    COUNT(DISTINCT donor_uid)::BIGINT AS donor_count,
    COUNT(*)::BIGINT AS donation_count
  FROM donations
  WHERE status = 'confirmed'
    AND EXTRACT(YEAR FROM paid_at) = EXTRACT(YEAR FROM NOW());
$$;

GRANT EXECUTE ON FUNCTION public.get_donation_goal_stats() TO authenticated;

-- =====================================================================
-- get_user_profile_stats erweitern: noDonations hinzufügen
-- =====================================================================
-- Parameter wurde in einer früheren Migration als p_user_id definiert.
-- CREATE OR REPLACE kann keine Parameternamen ändern → DROP zuerst.
-- =====================================================================

DROP FUNCTION IF EXISTS public.get_user_profile_stats(UUID);

CREATE OR REPLACE FUNCTION public.get_user_profile_stats(p_user_id UUID)
RETURNS TABLE(field TEXT, value BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Rezepte
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

  -- Community-Engagement
  UNION ALL
  SELECT 'noComments',       COUNT(*)
    FROM recipe_comments
   WHERE created_by = p_user_id

  UNION ALL
  SELECT 'noRatings',        COUNT(*)
    FROM recipe_ratings
   WHERE user_id = p_user_id

  -- Anlässe
  UNION ALL
  SELECT 'noEvents',         COUNT(DISTINCT event_id)
    FROM event_cooks
   WHERE user_id = p_user_id

  -- Spenden
  UNION ALL
  SELECT 'noDonations',      COUNT(*)
    FROM donations
   WHERE donor_uid = p_user_id AND status IN ('confirmed', 'migrated')

  -- Sonstiges
  UNION ALL
  SELECT 'noFoundBugs',      COALESCE(no_found_bugs, 0)::BIGINT
    FROM users
   WHERE id = p_user_id
$$;

GRANT EXECUTE ON FUNCTION public.get_user_profile_stats(UUID) TO authenticated;
