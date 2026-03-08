-- Fix: Auth RLS Initialization Plan — auth.uid() in allen RLS-Policies wrappen
--
-- Supabase meldet für jeden direkten Aufruf von auth.uid() / auth.role() in einer
-- RLS-Policy einen Performance-Hinweis. Postgres wertet diese Funktionen bei naivem
-- Aufruf für jede gescannte Zeile neu aus.
--
-- Lösung: auth.uid() → (SELECT auth.uid())
-- Das zwingt den Planer, den Wert einmal zu initialisieren (Init Plan) und
-- als Konstante für alle Zeilen der Abfrage wiederzuverwenden.
--
-- Betroffene Tabellen und Policies (alle in bereits angewendeten Migrationen):
--   public.users          — users_select_own, users_insert_self, users_update_own, users_link_auth
--   storage.objects       — media_users_insert_own, media_users_update_own, media_users_delete_own
--   public.recipes        — recipes_update, recipes_delete
--   public.recipe_ingredients        — insert, update, delete
--   public.recipe_preparation_steps  — insert, update, delete
--   public.recipe_materials          — insert, update, delete
--   public.recipe_ratings            — select, insert, update, delete
--   public.recipe_comments           — update, delete
--   public.event_cooks               — event_cooks_insert

-- =====================================================================
-- public.users
-- =====================================================================

DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users
  FOR SELECT USING (auth_uid = (SELECT auth.uid()));

DROP POLICY IF EXISTS users_insert_self ON public.users;
CREATE POLICY users_insert_self ON public.users
  FOR INSERT WITH CHECK (auth_uid = (SELECT auth.uid()));

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (auth_uid = (SELECT auth.uid()))
  WITH CHECK (
    auth_uid = (SELECT auth.uid())
    AND roles = (SELECT roles FROM public.users WHERE auth_uid = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS users_link_auth ON public.users;
CREATE POLICY users_link_auth ON public.users
  FOR UPDATE
  USING (
    auth_uid IS NULL
    AND email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
  )
  WITH CHECK (
    auth_uid = (SELECT auth.uid())
    AND roles = (
      SELECT roles FROM public.users
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
    )
  );

-- =====================================================================
-- storage.objects (media bucket)
-- =====================================================================

DROP POLICY IF EXISTS media_users_insert_own ON storage.objects;
CREATE POLICY media_users_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'users'
    AND storage.filename(name) = (SELECT auth.uid())::TEXT || '.jpg'
  );

DROP POLICY IF EXISTS media_users_update_own ON storage.objects;
CREATE POLICY media_users_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'users'
    AND storage.filename(name) = (SELECT auth.uid())::TEXT || '.jpg'
  );

DROP POLICY IF EXISTS media_users_delete_own ON storage.objects;
CREATE POLICY media_users_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'users'
    AND storage.filename(name) = (SELECT auth.uid())::TEXT || '.jpg'
  );

-- =====================================================================
-- public.recipes
-- =====================================================================

DROP POLICY IF EXISTS recipes_update ON public.recipes;
CREATE POLICY recipes_update ON public.recipes
  FOR UPDATE USING (
    created_by = (SELECT auth.uid()) OR is_community_leader()
  );

DROP POLICY IF EXISTS recipes_delete ON public.recipes;
CREATE POLICY recipes_delete ON public.recipes
  FOR DELETE USING (
    created_by = (SELECT auth.uid()) OR is_community_leader()
  );

-- =====================================================================
-- public.recipe_ingredients
-- =====================================================================

DROP POLICY IF EXISTS recipe_ingredients_insert ON public.recipe_ingredients;
CREATE POLICY recipe_ingredients_insert ON public.recipe_ingredients
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = (SELECT auth.uid()) OR is_community_leader())
    )
  );

DROP POLICY IF EXISTS recipe_ingredients_update ON public.recipe_ingredients;
CREATE POLICY recipe_ingredients_update ON public.recipe_ingredients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = (SELECT auth.uid()) OR is_community_leader())
    )
  );

DROP POLICY IF EXISTS recipe_ingredients_delete ON public.recipe_ingredients;
CREATE POLICY recipe_ingredients_delete ON public.recipe_ingredients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = (SELECT auth.uid()) OR is_community_leader())
    )
  );

-- =====================================================================
-- public.recipe_preparation_steps
-- =====================================================================

DROP POLICY IF EXISTS recipe_preparation_steps_insert ON public.recipe_preparation_steps;
CREATE POLICY recipe_preparation_steps_insert ON public.recipe_preparation_steps
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = (SELECT auth.uid()) OR is_community_leader())
    )
  );

DROP POLICY IF EXISTS recipe_preparation_steps_update ON public.recipe_preparation_steps;
CREATE POLICY recipe_preparation_steps_update ON public.recipe_preparation_steps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = (SELECT auth.uid()) OR is_community_leader())
    )
  );

DROP POLICY IF EXISTS recipe_preparation_steps_delete ON public.recipe_preparation_steps;
CREATE POLICY recipe_preparation_steps_delete ON public.recipe_preparation_steps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = (SELECT auth.uid()) OR is_community_leader())
    )
  );

-- =====================================================================
-- public.recipe_materials
-- =====================================================================

DROP POLICY IF EXISTS recipe_materials_insert ON public.recipe_materials;
CREATE POLICY recipe_materials_insert ON public.recipe_materials
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = (SELECT auth.uid()) OR is_community_leader())
    )
  );

DROP POLICY IF EXISTS recipe_materials_update ON public.recipe_materials;
CREATE POLICY recipe_materials_update ON public.recipe_materials
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = (SELECT auth.uid()) OR is_community_leader())
    )
  );

DROP POLICY IF EXISTS recipe_materials_delete ON public.recipe_materials;
CREATE POLICY recipe_materials_delete ON public.recipe_materials
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = (SELECT auth.uid()) OR is_community_leader())
    )
  );

-- =====================================================================
-- public.recipe_ratings
-- =====================================================================

DROP POLICY IF EXISTS recipe_ratings_select ON public.recipe_ratings;
CREATE POLICY recipe_ratings_select ON public.recipe_ratings
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR is_community_leader());

DROP POLICY IF EXISTS recipe_ratings_insert ON public.recipe_ratings;
CREATE POLICY recipe_ratings_insert ON public.recipe_ratings
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id AND recipe.recipe_type = 'public'
    )
  );

DROP POLICY IF EXISTS recipe_ratings_update ON public.recipe_ratings;
CREATE POLICY recipe_ratings_update ON public.recipe_ratings
  FOR UPDATE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS recipe_ratings_delete ON public.recipe_ratings;
CREATE POLICY recipe_ratings_delete ON public.recipe_ratings
  FOR DELETE USING (user_id = (SELECT auth.uid()) OR is_community_leader());

-- =====================================================================
-- public.recipe_comments
-- =====================================================================

DROP POLICY IF EXISTS recipe_comments_update ON public.recipe_comments;
CREATE POLICY recipe_comments_update ON public.recipe_comments
  FOR UPDATE USING (created_by = (SELECT auth.uid()) OR is_community_leader());

DROP POLICY IF EXISTS recipe_comments_delete ON public.recipe_comments;
CREATE POLICY recipe_comments_delete ON public.recipe_comments
  FOR DELETE USING (created_by = (SELECT auth.uid()) OR is_community_leader());

-- =====================================================================
-- public.event_cooks
-- =====================================================================

DROP POLICY IF EXISTS event_cooks_insert ON public.event_cooks;
CREATE POLICY event_cooks_insert ON public.event_cooks
  FOR INSERT TO authenticated
  WITH CHECK (
    is_event_cook(event_id)
    OR EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id AND created_by = (SELECT auth.uid())
    )
    OR is_community_leader()
    OR is_admin()
  );
