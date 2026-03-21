-- ============================================================================
-- Migration: Event-Köche dürfen Rezeptvarianten ihrer Events bearbeiten/löschen
-- ============================================================================
-- Bug: Wenn ein Event-Koch (nicht der Ersteller) eine Rezeptvariante bearbeitet,
-- schlägt die UPDATE-Operation fehl, weil die bisherige RLS-Policy nur
-- created_by oder Community-Leader zulässt.
--
-- Fix: UPDATE- und DELETE-Policies auf recipes und allen Kind-Tabellen erweitern,
-- damit Event-Köche Varianten ihres Events ändern können.
-- Die Funktion is_event_cook(event_id) existiert bereits.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. recipes — UPDATE & DELETE
-- ============================================================================

DROP POLICY IF EXISTS recipes_update ON public.recipes;
CREATE POLICY recipes_update ON public.recipes
  FOR UPDATE USING (
    created_by = (SELECT auth.uid())
    OR is_community_leader()
    OR (recipe_type = 'variant' AND is_event_cook(variant_event_uid))
  );

DROP POLICY IF EXISTS recipes_delete ON public.recipes;
CREATE POLICY recipes_delete ON public.recipes
  FOR DELETE USING (
    created_by = (SELECT auth.uid())
    OR is_community_leader()
    OR (recipe_type = 'variant' AND is_event_cook(variant_event_uid))
  );

-- ============================================================================
-- 2. recipe_ingredients — INSERT, UPDATE & DELETE
-- ============================================================================

DROP POLICY IF EXISTS recipe_ingredients_insert ON public.recipe_ingredients;
CREATE POLICY recipe_ingredients_insert ON public.recipe_ingredients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (
          recipe.created_by = (SELECT auth.uid())
          OR is_community_leader()
          OR (recipe.recipe_type = 'variant' AND is_event_cook(recipe.variant_event_uid))
        )
    )
  );

DROP POLICY IF EXISTS recipe_ingredients_update ON public.recipe_ingredients;
CREATE POLICY recipe_ingredients_update ON public.recipe_ingredients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (
          recipe.created_by = (SELECT auth.uid())
          OR is_community_leader()
          OR (recipe.recipe_type = 'variant' AND is_event_cook(recipe.variant_event_uid))
        )
    )
  );

DROP POLICY IF EXISTS recipe_ingredients_delete ON public.recipe_ingredients;
CREATE POLICY recipe_ingredients_delete ON public.recipe_ingredients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (
          recipe.created_by = (SELECT auth.uid())
          OR is_community_leader()
          OR (recipe.recipe_type = 'variant' AND is_event_cook(recipe.variant_event_uid))
        )
    )
  );

-- ============================================================================
-- 3. recipe_preparation_steps — INSERT, UPDATE & DELETE
-- ============================================================================

DROP POLICY IF EXISTS recipe_preparation_steps_insert ON public.recipe_preparation_steps;
CREATE POLICY recipe_preparation_steps_insert ON public.recipe_preparation_steps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (
          recipe.created_by = (SELECT auth.uid())
          OR is_community_leader()
          OR (recipe.recipe_type = 'variant' AND is_event_cook(recipe.variant_event_uid))
        )
    )
  );

DROP POLICY IF EXISTS recipe_preparation_steps_update ON public.recipe_preparation_steps;
CREATE POLICY recipe_preparation_steps_update ON public.recipe_preparation_steps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (
          recipe.created_by = (SELECT auth.uid())
          OR is_community_leader()
          OR (recipe.recipe_type = 'variant' AND is_event_cook(recipe.variant_event_uid))
        )
    )
  );

DROP POLICY IF EXISTS recipe_preparation_steps_delete ON public.recipe_preparation_steps;
CREATE POLICY recipe_preparation_steps_delete ON public.recipe_preparation_steps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (
          recipe.created_by = (SELECT auth.uid())
          OR is_community_leader()
          OR (recipe.recipe_type = 'variant' AND is_event_cook(recipe.variant_event_uid))
        )
    )
  );

-- ============================================================================
-- 4. recipe_materials — INSERT, UPDATE & DELETE
-- ============================================================================

DROP POLICY IF EXISTS recipe_materials_insert ON public.recipe_materials;
CREATE POLICY recipe_materials_insert ON public.recipe_materials
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (
          recipe.created_by = (SELECT auth.uid())
          OR is_community_leader()
          OR (recipe.recipe_type = 'variant' AND is_event_cook(recipe.variant_event_uid))
        )
    )
  );

DROP POLICY IF EXISTS recipe_materials_update ON public.recipe_materials;
CREATE POLICY recipe_materials_update ON public.recipe_materials
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (
          recipe.created_by = (SELECT auth.uid())
          OR is_community_leader()
          OR (recipe.recipe_type = 'variant' AND is_event_cook(recipe.variant_event_uid))
        )
    )
  );

DROP POLICY IF EXISTS recipe_materials_delete ON public.recipe_materials;
CREATE POLICY recipe_materials_delete ON public.recipe_materials
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (
          recipe.created_by = (SELECT auth.uid())
          OR is_community_leader()
          OR (recipe.recipe_type = 'variant' AND is_event_cook(recipe.variant_event_uid))
        )
    )
  );

COMMIT;
