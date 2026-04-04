-- =============================================================================
-- Chuchipirat – Baseline Migration (6/7): RLS Policies
-- Generated: 2026-04-01
-- =============================================================================
-- This file is part of the baseline schema. Do NOT modify after first deploy.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Users
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "users_select" ON public.users FOR SELECT TO authenticated
  USING (id = (( SELECT auth.uid())) OR is_community_leader() OR is_admin());

CREATE POLICY "users_insert" ON public.users FOR INSERT TO authenticated
  WITH CHECK (id = (( SELECT auth.uid())) OR is_admin());

CREATE POLICY "users_update" ON public.users FOR UPDATE TO authenticated
  USING (id = (( SELECT auth.uid())) OR is_admin())
  WITH CHECK (id = (( SELECT auth.uid())) AND roles = (( SELECT users_1.roles FROM users users_1 WHERE users_1.id = (( SELECT auth.uid())))) OR is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Global Config
-- ─────────────────────────────────────────────────────────────────────────────

-- Bewusst ohne TO authenticated: Pre-Auth-UI benötigt Zugriff auf globale Einstellungen
CREATE POLICY "global_settings_select" ON public.global_settings FOR SELECT
  USING (true);

CREATE POLICY "global_settings_update" ON public.global_settings FOR UPDATE TO authenticated
  USING (is_admin());

-- Bewusst ohne TO authenticated: Pre-Auth-UI benötigt Zugriff auf Systemmeldungen
CREATE POLICY "system_messages_select" ON public.system_messages FOR SELECT
  USING (true);

CREATE POLICY "system_messages_insert" ON public.system_messages FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "system_messages_update" ON public.system_messages FOR UPDATE TO authenticated
  USING (is_admin());

CREATE POLICY "system_messages_delete" ON public.system_messages FOR DELETE TO authenticated
  USING (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Masterdata
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "departments_select" ON public.departments FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "departments_insert" ON public.departments FOR INSERT TO authenticated
  WITH CHECK (is_admin());
CREATE POLICY "departments_update" ON public.departments FOR UPDATE TO authenticated
  USING (is_admin());
CREATE POLICY "departments_delete" ON public.departments FOR DELETE TO authenticated
  USING (is_admin());

CREATE POLICY "units_select" ON public.units FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "units_insert" ON public.units FOR INSERT TO authenticated
  WITH CHECK (is_admin());
CREATE POLICY "units_update" ON public.units FOR UPDATE TO authenticated
  USING (is_admin());
CREATE POLICY "units_delete" ON public.units FOR DELETE TO authenticated
  USING (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Products & Materials
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "products_select" ON public.products FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "products_insert" ON public.products FOR INSERT TO authenticated
  WITH CHECK ((( SELECT auth.uid())) IS NOT NULL);
CREATE POLICY "products_update" ON public.products FOR UPDATE TO authenticated
  USING (is_admin());
CREATE POLICY "products_delete" ON public.products FOR DELETE TO authenticated
  USING (is_admin());

CREATE POLICY "materials_select" ON public.materials FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "materials_insert" ON public.materials FOR INSERT TO authenticated
  WITH CHECK ((( SELECT auth.uid())) IS NOT NULL);
CREATE POLICY "materials_update" ON public.materials FOR UPDATE TO authenticated
  USING (is_admin());
CREATE POLICY "materials_delete" ON public.materials FOR DELETE TO authenticated
  USING (is_admin());

CREATE POLICY "unit_conversion_basic_select" ON public.unit_conversion_basic FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "unit_conversion_basic_insert" ON public.unit_conversion_basic FOR INSERT TO authenticated
  WITH CHECK (is_admin());
CREATE POLICY "unit_conversion_basic_update" ON public.unit_conversion_basic FOR UPDATE TO authenticated
  USING (is_admin());
CREATE POLICY "unit_conversion_basic_delete" ON public.unit_conversion_basic FOR DELETE TO authenticated
  USING (is_admin());

CREATE POLICY "unit_conversion_products_select" ON public.unit_conversion_products FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "unit_conversion_products_insert" ON public.unit_conversion_products FOR INSERT TO authenticated
  WITH CHECK (is_admin());
CREATE POLICY "unit_conversion_products_update" ON public.unit_conversion_products FOR UPDATE TO authenticated
  USING (is_admin());
CREATE POLICY "unit_conversion_products_delete" ON public.unit_conversion_products FOR DELETE TO authenticated
  USING (is_admin());

CREATE POLICY "product_synonyms_select" ON public.product_synonyms FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "product_synonyms_insert" ON public.product_synonyms FOR INSERT TO authenticated
  WITH CHECK (is_admin());
CREATE POLICY "product_synonyms_update" ON public.product_synonyms FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "product_synonyms_delete" ON public.product_synonyms FOR DELETE TO authenticated
  USING (is_admin());

CREATE POLICY "product_duplicate_dismissals_select" ON public.product_duplicate_dismissals FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "product_duplicate_dismissals_insert" ON public.product_duplicate_dismissals FOR INSERT TO authenticated
  WITH CHECK (is_admin());
CREATE POLICY "product_duplicate_dismissals_delete" ON public.product_duplicate_dismissals FOR DELETE TO authenticated
  USING (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Recipes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "recipes_select" ON public.recipes FOR SELECT TO authenticated
  USING (
    recipe_type IN ('public', 'private')
    OR created_by = (( SELECT auth.uid()))
    OR (recipe_type = 'variant'::recipe_type AND is_event_cook(variant_event_uid))
    OR is_community_leader()
  );
CREATE POLICY "recipes_insert" ON public.recipes FOR INSERT TO authenticated
  WITH CHECK ((( SELECT auth.uid())) IS NOT NULL);
CREATE POLICY "recipes_update" ON public.recipes FOR UPDATE TO authenticated
  USING (created_by = (( SELECT auth.uid())) OR is_community_leader() OR recipe_type = 'variant'::recipe_type AND is_event_cook(variant_event_uid));
CREATE POLICY "recipes_delete" ON public.recipes FOR DELETE TO authenticated
  USING (created_by = (( SELECT auth.uid())) OR is_community_leader() OR recipe_type = 'variant'::recipe_type AND is_event_cook(variant_event_uid));

CREATE POLICY "recipe_ingredients_select" ON public.recipe_ingredients FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "recipe_ingredients_insert" ON public.recipe_ingredients FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM recipes recipe WHERE recipe.id = recipe_ingredients.recipe_id AND (recipe.created_by = (( SELECT auth.uid())) OR is_community_leader() OR recipe.recipe_type = 'variant'::recipe_type AND is_event_cook(recipe.variant_event_uid)))));
CREATE POLICY "recipe_ingredients_update" ON public.recipe_ingredients FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM recipes recipe WHERE recipe.id = recipe_ingredients.recipe_id AND (recipe.created_by = (( SELECT auth.uid())) OR is_community_leader() OR recipe.recipe_type = 'variant'::recipe_type AND is_event_cook(recipe.variant_event_uid)))));
CREATE POLICY "recipe_ingredients_delete" ON public.recipe_ingredients FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM recipes recipe WHERE recipe.id = recipe_ingredients.recipe_id AND (recipe.created_by = (( SELECT auth.uid())) OR is_community_leader() OR recipe.recipe_type = 'variant'::recipe_type AND is_event_cook(recipe.variant_event_uid)))));

CREATE POLICY "recipe_preparation_steps_select" ON public.recipe_preparation_steps FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "recipe_preparation_steps_insert" ON public.recipe_preparation_steps FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM recipes recipe WHERE recipe.id = recipe_preparation_steps.recipe_id AND (recipe.created_by = (( SELECT auth.uid())) OR is_community_leader() OR recipe.recipe_type = 'variant'::recipe_type AND is_event_cook(recipe.variant_event_uid)))));
CREATE POLICY "recipe_preparation_steps_update" ON public.recipe_preparation_steps FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM recipes recipe WHERE recipe.id = recipe_preparation_steps.recipe_id AND (recipe.created_by = (( SELECT auth.uid())) OR is_community_leader() OR recipe.recipe_type = 'variant'::recipe_type AND is_event_cook(recipe.variant_event_uid)))));
CREATE POLICY "recipe_preparation_steps_delete" ON public.recipe_preparation_steps FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM recipes recipe WHERE recipe.id = recipe_preparation_steps.recipe_id AND (recipe.created_by = (( SELECT auth.uid())) OR is_community_leader() OR recipe.recipe_type = 'variant'::recipe_type AND is_event_cook(recipe.variant_event_uid)))));

CREATE POLICY "recipe_materials_select" ON public.recipe_materials FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "recipe_materials_insert" ON public.recipe_materials FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM recipes recipe WHERE recipe.id = recipe_materials.recipe_id AND (recipe.created_by = (( SELECT auth.uid())) OR is_community_leader() OR recipe.recipe_type = 'variant'::recipe_type AND is_event_cook(recipe.variant_event_uid)))));
CREATE POLICY "recipe_materials_update" ON public.recipe_materials FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM recipes recipe WHERE recipe.id = recipe_materials.recipe_id AND (recipe.created_by = (( SELECT auth.uid())) OR is_community_leader() OR recipe.recipe_type = 'variant'::recipe_type AND is_event_cook(recipe.variant_event_uid)))));
CREATE POLICY "recipe_materials_delete" ON public.recipe_materials FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM recipes recipe WHERE recipe.id = recipe_materials.recipe_id AND (recipe.created_by = (( SELECT auth.uid())) OR is_community_leader() OR recipe.recipe_type = 'variant'::recipe_type AND is_event_cook(recipe.variant_event_uid)))));

CREATE POLICY "recipe_ratings_select" ON public.recipe_ratings FOR SELECT TO authenticated
  USING (user_id = (( SELECT auth.uid())) OR is_community_leader());
CREATE POLICY "recipe_ratings_insert" ON public.recipe_ratings FOR INSERT TO authenticated
  WITH CHECK (user_id = (( SELECT auth.uid())) AND (EXISTS ( SELECT 1 FROM recipes recipe WHERE recipe.id = recipe_ratings.recipe_id AND recipe.recipe_type = 'public'::recipe_type)));
CREATE POLICY "recipe_ratings_update" ON public.recipe_ratings FOR UPDATE TO authenticated
  USING (user_id = (( SELECT auth.uid())));
CREATE POLICY "recipe_ratings_delete" ON public.recipe_ratings FOR DELETE TO authenticated
  USING (user_id = (( SELECT auth.uid())) OR is_community_leader());

CREATE POLICY "recipe_comments_select" ON public.recipe_comments FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "recipe_comments_insert" ON public.recipe_comments FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM recipes recipe WHERE recipe.id = recipe_comments.recipe_id AND recipe.recipe_type = 'public'::recipe_type)));
CREATE POLICY "recipe_comments_update" ON public.recipe_comments FOR UPDATE TO authenticated
  USING (created_by = (( SELECT auth.uid())) OR is_community_leader());
CREATE POLICY "recipe_comments_delete" ON public.recipe_comments FOR DELETE TO authenticated
  USING (created_by = (( SELECT auth.uid())) OR is_community_leader());

-- ─────────────────────────────────────────────────────────────────────────────
-- Events
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "events_select" ON public.events FOR SELECT TO authenticated
  USING (is_event_cook(id) OR created_by = (( SELECT auth.uid())) AND NOT event_has_cooks(id) OR is_admin());
CREATE POLICY "events_insert" ON public.events FOR INSERT TO authenticated
  WITH CHECK ((( SELECT auth.uid())) IS NOT NULL);
CREATE POLICY "events_update" ON public.events FOR UPDATE TO authenticated
  USING (is_event_cook(id) OR created_by = (( SELECT auth.uid())) AND NOT event_has_cooks(id) OR is_admin());
CREATE POLICY "events_delete" ON public.events FOR DELETE TO authenticated
  USING (is_event_cook(id) OR created_by = (( SELECT auth.uid())) AND NOT event_has_cooks(id) OR is_admin());

CREATE POLICY "event_cooks_select" ON public.event_cooks FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR user_id = (( SELECT auth.uid())) OR is_admin());
CREATE POLICY "event_cooks_insert" ON public.event_cooks FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR (EXISTS ( SELECT 1 FROM events WHERE events.id = event_cooks.event_id AND events.created_by = (( SELECT auth.uid())))) OR is_community_leader() OR is_admin());
CREATE POLICY "event_cooks_update" ON public.event_cooks FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_cooks_delete" ON public.event_cooks FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY "event_dates_select" ON public.event_dates FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_dates_insert" ON public.event_dates FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_dates_update" ON public.event_dates FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_dates_delete" ON public.event_dates FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY "event_groupconfiguration_diets_select" ON public.event_groupconfiguration_diets FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_groupconfiguration_diets_insert" ON public.event_groupconfiguration_diets FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_groupconfiguration_diets_update" ON public.event_groupconfiguration_diets FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_groupconfiguration_diets_delete" ON public.event_groupconfiguration_diets FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY "event_groupconfiguration_intolerances_select" ON public.event_groupconfiguration_intolerances FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_groupconfiguration_intolerances_insert" ON public.event_groupconfiguration_intolerances FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_groupconfiguration_intolerances_update" ON public.event_groupconfiguration_intolerances FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_groupconfiguration_intolerances_delete" ON public.event_groupconfiguration_intolerances FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY "event_groupconfiguration_portions_select" ON public.event_groupconfiguration_portions FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_groupconfiguration_portions_insert" ON public.event_groupconfiguration_portions FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_groupconfiguration_portions_update" ON public.event_groupconfiguration_portions FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_groupconfiguration_portions_delete" ON public.event_groupconfiguration_portions FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY "event_meal_types_select" ON public.event_meal_types FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_meal_types_insert" ON public.event_meal_types FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_meal_types_update" ON public.event_meal_types FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_meal_types_delete" ON public.event_meal_types FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY "event_meals_select" ON public.event_meals FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_meals_insert" ON public.event_meals FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_meals_update" ON public.event_meals FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_meals_delete" ON public.event_meals FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY "event_menues_select" ON public.event_menues FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menues_insert" ON public.event_menues FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menues_update" ON public.event_menues FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menues_delete" ON public.event_menues FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY "event_menue_recipes_select" ON public.event_menue_recipes FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menue_recipes_insert" ON public.event_menue_recipes FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menue_recipes_update" ON public.event_menue_recipes FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menue_recipes_delete" ON public.event_menue_recipes FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY "event_menue_products_select" ON public.event_menue_products FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menue_products_insert" ON public.event_menue_products FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menue_products_update" ON public.event_menue_products FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menue_products_delete" ON public.event_menue_products FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY "event_menue_materials_select" ON public.event_menue_materials FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menue_materials_insert" ON public.event_menue_materials FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menue_materials_update" ON public.event_menue_materials FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menue_materials_delete" ON public.event_menue_materials FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY "event_notes_select" ON public.event_notes FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_notes_insert" ON public.event_notes FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_notes_update" ON public.event_notes FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_notes_delete" ON public.event_notes FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY "event_menuplan_item_plans_select" ON public.event_menuplan_item_plans FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menuplan_item_plans_insert" ON public.event_menuplan_item_plans FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menuplan_item_plans_update" ON public.event_menuplan_item_plans FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menuplan_item_plans_delete" ON public.event_menuplan_item_plans FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY "event_menuplan_tracking_select" ON public.event_menuplan_tracking FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menuplan_tracking_insert" ON public.event_menuplan_tracking FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_menuplan_tracking_update" ON public.event_menuplan_tracking FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Used Recipe Lists
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "event_cooks_select" ON public.event_used_recipe_lists FOR SELECT TO authenticated
  USING (is_event_cook(event_id));
CREATE POLICY "event_cooks_insert" ON public.event_used_recipe_lists FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id));
CREATE POLICY "event_cooks_update" ON public.event_used_recipe_lists FOR UPDATE TO authenticated
  USING (is_event_cook(event_id));
CREATE POLICY "event_cooks_delete" ON public.event_used_recipe_lists FOR DELETE TO authenticated
  USING (is_event_cook(event_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Shopping Lists
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "shopping_lists_select" ON public.event_shopping_lists FOR SELECT TO authenticated
  USING (is_event_cook(event_id));
CREATE POLICY "shopping_lists_insert" ON public.event_shopping_lists FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id));
CREATE POLICY "shopping_lists_update" ON public.event_shopping_lists FOR UPDATE TO authenticated
  USING (is_event_cook(event_id));
CREATE POLICY "shopping_lists_delete" ON public.event_shopping_lists FOR DELETE TO authenticated
  USING (is_event_cook(event_id));

CREATE POLICY "shopping_list_items_select" ON public.event_shopping_list_items FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1 FROM event_shopping_lists h WHERE h.id = event_shopping_list_items.list_id AND is_event_cook(h.event_id))));
CREATE POLICY "shopping_list_items_insert" ON public.event_shopping_list_items FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM event_shopping_lists h WHERE h.id = event_shopping_list_items.list_id AND is_event_cook(h.event_id))));
CREATE POLICY "shopping_list_items_update" ON public.event_shopping_list_items FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM event_shopping_lists h WHERE h.id = event_shopping_list_items.list_id AND is_event_cook(h.event_id))));
CREATE POLICY "shopping_list_items_delete" ON public.event_shopping_list_items FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM event_shopping_lists h WHERE h.id = event_shopping_list_items.list_id AND is_event_cook(h.event_id))));

-- ─────────────────────────────────────────────────────────────────────────────
-- Material Lists
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "material_lists_select" ON public.event_material_lists FOR SELECT TO authenticated
  USING (is_event_cook(event_id));
CREATE POLICY "material_lists_insert" ON public.event_material_lists FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id));
CREATE POLICY "material_lists_update" ON public.event_material_lists FOR UPDATE TO authenticated
  USING (is_event_cook(event_id));
CREATE POLICY "material_lists_delete" ON public.event_material_lists FOR DELETE TO authenticated
  USING (is_event_cook(event_id));

CREATE POLICY "material_list_items_select" ON public.event_material_list_items FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1 FROM event_material_lists h WHERE h.id = event_material_list_items.list_id AND is_event_cook(h.event_id))));
CREATE POLICY "material_list_items_insert" ON public.event_material_list_items FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM event_material_lists h WHERE h.id = event_material_list_items.list_id AND is_event_cook(h.event_id))));
CREATE POLICY "material_list_items_update" ON public.event_material_list_items FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM event_material_lists h WHERE h.id = event_material_list_items.list_id AND is_event_cook(h.event_id))));
CREATE POLICY "material_list_items_delete" ON public.event_material_list_items FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM event_material_lists h WHERE h.id = event_material_list_items.list_id AND is_event_cook(h.event_id))));

-- ─────────────────────────────────────────────────────────────────────────────
-- Requests
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "requests_select" ON public.requests FOR SELECT TO authenticated
  USING (author_uid = (( SELECT auth.uid())) OR is_community_leader());
CREATE POLICY "requests_insert" ON public.requests FOR INSERT TO authenticated
  WITH CHECK (author_uid = (( SELECT auth.uid())));
CREATE POLICY "requests_update" ON public.requests FOR UPDATE TO authenticated
  USING (author_uid = (( SELECT auth.uid())) OR is_community_leader());

CREATE POLICY "request_comments_select" ON public.request_comments FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1 FROM requests r WHERE r.id = request_comments.request_id AND (r.author_uid = (( SELECT auth.uid())) OR is_community_leader()))));
CREATE POLICY "request_comments_insert" ON public.request_comments FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM requests r WHERE r.id = request_comments.request_id AND (r.author_uid = (( SELECT auth.uid())) OR is_community_leader()))));
CREATE POLICY "request_comments_update" ON public.request_comments FOR UPDATE TO authenticated
  USING (created_by = (( SELECT auth.uid())));

-- ─────────────────────────────────────────────────────────────────────────────
-- Feeds
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "feeds_select" ON public.feeds FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "feeds_insert" ON public.feeds FOR INSERT TO authenticated
  WITH CHECK (user_uid = (SELECT auth.uid()));
CREATE POLICY "feeds_delete" ON public.feeds FOR DELETE TO authenticated
  USING (is_community_leader());

-- ─────────────────────────────────────────────────────────────────────────────
-- Donations
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "donations_select" ON public.donations FOR SELECT TO authenticated
  USING (donor_uid = (( SELECT auth.uid())) OR is_admin() OR event_id IS NOT NULL AND status = 'confirmed'::donation_status AND is_event_cook(event_id));
CREATE POLICY "donations_insert_own" ON public.donations FOR INSERT TO authenticated
  WITH CHECK (donor_uid = (( SELECT auth.uid())) AND status = 'pending'::donation_status);

CREATE POLICY "goal_sections_select" ON public.donation_goal_sections FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "goal_sections_admin_insert" ON public.donation_goal_sections FOR INSERT TO authenticated
  WITH CHECK (is_admin());
CREATE POLICY "goal_sections_admin_update" ON public.donation_goal_sections FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "goal_sections_admin_delete" ON public.donation_goal_sections FOR DELETE TO authenticated
  USING (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Admin / Monitoring
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "cron_job_log_select" ON public.cron_job_log FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "mail_log_select" ON public.mail_log FOR SELECT TO authenticated
  USING (is_admin());
CREATE POLICY "mail_log_insert" ON public.mail_log FOR INSERT TO authenticated
  WITH CHECK (is_admin());
