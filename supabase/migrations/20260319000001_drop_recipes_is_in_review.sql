-- =============================================================================
-- Entfernt die Spalte is_in_review aus der Tabelle recipes.
--
-- Der Review-Status wird neu direkt aus der requests-Tabelle abgeleitet:
-- EXISTS(SELECT 1 FROM requests WHERE request_object_uid = recipe.id
--        AND request_type = 'recipePublish'
--        AND status NOT IN ('done', 'declined'))
--
-- Die denormalisierte Spalte war ein Firebase-Workaround und ist mit
-- dem relationalen Modell in Supabase nicht mehr nötig.
-- =============================================================================

ALTER TABLE public.recipes DROP COLUMN IF EXISTS is_in_review;
