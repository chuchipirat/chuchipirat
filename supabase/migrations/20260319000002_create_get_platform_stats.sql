-- =====================================================================
-- get_platform_stats() — Plattform-Statistiken für die Startseite
-- =====================================================================
-- SECURITY DEFINER: Umgeht RLS, weil events, event_shopping_lists und
-- event_material_lists restriktive SELECT-Policies haben (nur Köche).
-- Die Funktion gibt nur aggregierte Zähler zurück — keine Einzeldaten.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS TABLE(field TEXT, value NUMERIC)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Plattform
  SELECT 'noUsers',              COUNT(*)::NUMERIC FROM users
  UNION ALL SELECT 'noCooks',              COUNT(DISTINCT user_id)::NUMERIC FROM event_cooks
  -- Rezepte
  UNION ALL SELECT 'noRecipesPublic',      COUNT(*)::NUMERIC FROM recipes WHERE recipe_type = 'public'
  UNION ALL SELECT 'noRecipesPrivate',     COUNT(*)::NUMERIC FROM recipes WHERE recipe_type = 'private'
  UNION ALL SELECT 'noRecipesVariants',    COUNT(*)::NUMERIC FROM recipes WHERE recipe_type = 'variant'
  UNION ALL SELECT 'noRatings',            COUNT(*)::NUMERIC FROM recipe_ratings
  UNION ALL SELECT 'noComments',           COUNT(*)::NUMERIC FROM recipe_comments
  -- Anlässe
  UNION ALL SELECT 'noEvents',             COUNT(*)::NUMERIC FROM events
  UNION ALL SELECT 'noParticipants',       COALESCE(SUM(servings), 0)::NUMERIC FROM event_groupconfiguration_portions
  UNION ALL SELECT 'noPlanedDays',         COALESCE(SUM(date_to - date_from + 1), 0)::NUMERIC FROM event_dates
  UNION ALL SELECT 'noPortions',           COALESCE(SUM(total_portions), 0)::NUMERIC FROM event_menue_recipes
  UNION ALL SELECT 'noShoppingLists',      COUNT(*)::NUMERIC FROM event_shopping_lists
  UNION ALL SELECT 'noMaterialLists',      COUNT(*)::NUMERIC FROM event_material_lists
  -- Durchschnitt pro Anlass
  UNION ALL SELECT 'avgEventDuration',     COALESCE(ROUND(AVG(date_to - date_from + 1), 1), 0) FROM event_dates
  UNION ALL SELECT 'avgCooksPerEvent',     COALESCE(ROUND(AVG(cook_count), 1), 0) FROM (SELECT COUNT(*) AS cook_count FROM event_cooks GROUP BY event_id) sub
  UNION ALL SELECT 'avgRecipesPerEvent',   COALESCE(ROUND(AVG(recipe_count), 1), 0) FROM (SELECT COUNT(*) AS recipe_count FROM event_menue_recipes GROUP BY event_id) sub
  UNION ALL SELECT 'avgPortionsPerEvent',  COALESCE(ROUND(AVG(portion_sum), 1), 0) FROM (SELECT SUM(total_portions) AS portion_sum FROM event_menue_recipes GROUP BY event_id) sub
  UNION ALL SELECT 'avgShoppingListItems', COALESCE(ROUND(AVG(item_count), 1), 0) FROM (SELECT COUNT(*) AS item_count FROM event_shopping_list_items GROUP BY list_id) sub
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO authenticated;
