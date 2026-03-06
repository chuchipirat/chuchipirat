-- =============================================================================
-- Fix RLS policies for all recipe-related tables
--
-- Changes from the original policies:
--
-- READ (SELECT):
--   All recipe types (public, private, variant) are readable by every
--   authenticated user. Recipe content is not sensitive data — it is already
--   visible via event menuplans to all event participants. The previous policy
--   (public OR own) was too restrictive.
--
-- WRITE (INSERT/UPDATE/DELETE):
--   - INSERT: unchanged (every authenticated user may create recipes)
--   - UPDATE/DELETE on recipes: creator OR is_community_leader()
--     (previously: creator OR is_admin() — community leaders were excluded)
--   - Same change applied to all child tables (ingredients, steps, materials,
--     ratings, comments)
--
-- Note on variants:
--   Variants belong to events. Edit rights for event cooks will be added in a
--   future migration once the event-participants table exists.
-- =============================================================================

-- ============================================================
-- recipes
-- ============================================================

DROP POLICY IF EXISTS recipes_select ON public.recipes;
DROP POLICY IF EXISTS recipes_update ON public.recipes;
DROP POLICY IF EXISTS recipes_delete ON public.recipes;

-- Alle Rezepttypen sind für jeden authentifizierten Benutzer lesbar.
-- Rezeptdaten sind nicht schutzbedürftig und bereits über Menuplan-Ansichten
-- für Event-Teilnehmer sichtbar.
CREATE POLICY recipes_select ON public.recipes
  FOR SELECT TO authenticated
  USING (true);

-- Nur der Ersteller, ein Admin oder ein Community-Leader darf ein Rezept ändern.
CREATE POLICY recipes_update ON public.recipes
  FOR UPDATE USING (
    created_by = auth.uid() OR is_community_leader()
  );

-- Nur der Ersteller, ein Admin oder ein Community-Leader darf ein Rezept löschen.
CREATE POLICY recipes_delete ON public.recipes
  FOR DELETE USING (
    created_by = auth.uid() OR is_community_leader()
  );

-- ============================================================
-- recipe_ingredients
-- ============================================================

DROP POLICY IF EXISTS recipe_ingredients_select ON public.recipe_ingredients;
DROP POLICY IF EXISTS recipe_ingredients_insert ON public.recipe_ingredients;
DROP POLICY IF EXISTS recipe_ingredients_update ON public.recipe_ingredients;
DROP POLICY IF EXISTS recipe_ingredients_delete ON public.recipe_ingredients;

-- Zutaten sind für jeden authentifizierten Benutzer lesbar (folgt Eltern-Rezept).
CREATE POLICY recipe_ingredients_select ON public.recipe_ingredients
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY recipe_ingredients_insert ON public.recipe_ingredients
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_community_leader())
    )
  );

CREATE POLICY recipe_ingredients_update ON public.recipe_ingredients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_community_leader())
    )
  );

CREATE POLICY recipe_ingredients_delete ON public.recipe_ingredients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_community_leader())
    )
  );

-- ============================================================
-- recipe_preparation_steps
-- ============================================================

DROP POLICY IF EXISTS recipe_preparation_steps_select ON public.recipe_preparation_steps;
DROP POLICY IF EXISTS recipe_preparation_steps_insert ON public.recipe_preparation_steps;
DROP POLICY IF EXISTS recipe_preparation_steps_update ON public.recipe_preparation_steps;
DROP POLICY IF EXISTS recipe_preparation_steps_delete ON public.recipe_preparation_steps;

-- Zubereitungsschritte sind für jeden authentifizierten Benutzer lesbar.
CREATE POLICY recipe_preparation_steps_select ON public.recipe_preparation_steps
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY recipe_preparation_steps_insert ON public.recipe_preparation_steps
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_community_leader())
    )
  );

CREATE POLICY recipe_preparation_steps_update ON public.recipe_preparation_steps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_community_leader())
    )
  );

CREATE POLICY recipe_preparation_steps_delete ON public.recipe_preparation_steps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_community_leader())
    )
  );

-- ============================================================
-- recipe_materials
-- ============================================================

DROP POLICY IF EXISTS recipe_materials_select ON public.recipe_materials;
DROP POLICY IF EXISTS recipe_materials_insert ON public.recipe_materials;
DROP POLICY IF EXISTS recipe_materials_update ON public.recipe_materials;
DROP POLICY IF EXISTS recipe_materials_delete ON public.recipe_materials;

-- Materialpositionen sind für jeden authentifizierten Benutzer lesbar.
CREATE POLICY recipe_materials_select ON public.recipe_materials
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY recipe_materials_insert ON public.recipe_materials
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_community_leader())
    )
  );

CREATE POLICY recipe_materials_update ON public.recipe_materials
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_community_leader())
    )
  );

CREATE POLICY recipe_materials_delete ON public.recipe_materials
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_community_leader())
    )
  );

-- ============================================================
-- recipe_ratings
-- ============================================================

DROP POLICY IF EXISTS recipe_ratings_select ON public.recipe_ratings;
DROP POLICY IF EXISTS recipe_ratings_delete ON public.recipe_ratings;

-- Eigene Bewertung oder Admins/Community-Leaders können alle Bewertungen lesen.
-- Aggregatwerte (avg_rating, no_ratings) stehen im recipes-Kopfdatensatz.
CREATE POLICY recipe_ratings_select ON public.recipe_ratings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_community_leader());

-- Nur der Ersteller oder Admins/Community-Leaders dürfen eine Bewertung löschen.
CREATE POLICY recipe_ratings_delete ON public.recipe_ratings
  FOR DELETE USING (user_id = auth.uid() OR is_community_leader());

-- ============================================================
-- recipe_comments
-- ============================================================

DROP POLICY IF EXISTS recipe_comments_select ON public.recipe_comments;
DROP POLICY IF EXISTS recipe_comments_update ON public.recipe_comments;
DROP POLICY IF EXISTS recipe_comments_delete ON public.recipe_comments;

-- Kommentare sind für jeden authentifizierten Benutzer lesbar.
-- (Kommentare existieren nur bei öffentlichen Rezepten — per INSERT-Policy.)
CREATE POLICY recipe_comments_select ON public.recipe_comments
  FOR SELECT TO authenticated
  USING (true);

-- Nur der Ersteller oder Admins/Community-Leaders dürfen einen Kommentar ändern.
CREATE POLICY recipe_comments_update ON public.recipe_comments
  FOR UPDATE USING (created_by = auth.uid() OR is_community_leader());

-- Nur der Ersteller oder Admins/Community-Leaders dürfen einen Kommentar löschen.
CREATE POLICY recipe_comments_delete ON public.recipe_comments
  FOR DELETE USING (created_by = auth.uid() OR is_community_leader());
