-- =============================================================================
-- Chuchipirat – Baseline Migration (7/7): Grants, Indexes, Storage Policies
-- Generated: 2026-04-01
-- =============================================================================
-- This file is part of the baseline schema. Do NOT modify after first deploy.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Default Privileges – prevent future anon grants
-- ─────────────────────────────────────────────────────────────────────────────

-- Default privileges for postgres role
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- Default privileges for supabase_admin role
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Table Grants
-- ─────────────────────────────────────────────────────────────────────────────

-- All tables: full access for authenticated
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.global_settings TO authenticated;
GRANT ALL ON public.system_messages TO authenticated;
GRANT ALL ON public.departments TO authenticated;
GRANT ALL ON public.units TO authenticated;
GRANT ALL ON public.products TO authenticated;
GRANT ALL ON public.materials TO authenticated;
GRANT ALL ON public.unit_conversion_basic TO authenticated;
GRANT ALL ON public.unit_conversion_products TO authenticated;
GRANT ALL ON public.product_synonyms TO authenticated;
GRANT ALL ON public.product_duplicate_dismissals TO authenticated;
GRANT ALL ON public.recipes TO authenticated;
GRANT ALL ON public.recipe_ingredients TO authenticated;
GRANT ALL ON public.recipe_preparation_steps TO authenticated;
GRANT ALL ON public.recipe_materials TO authenticated;
GRANT ALL ON public.recipe_ratings TO authenticated;
GRANT ALL ON public.recipe_comments TO authenticated;
GRANT ALL ON public.events TO authenticated;
GRANT ALL ON public.event_cooks TO authenticated;
GRANT ALL ON public.event_dates TO authenticated;
GRANT ALL ON public.event_groupconfiguration_diets TO authenticated;
GRANT ALL ON public.event_groupconfiguration_intolerances TO authenticated;
GRANT ALL ON public.event_groupconfiguration_portions TO authenticated;
GRANT ALL ON public.event_meal_types TO authenticated;
GRANT ALL ON public.event_meals TO authenticated;
GRANT ALL ON public.event_menues TO authenticated;
GRANT ALL ON public.event_menue_recipes TO authenticated;
GRANT ALL ON public.event_menue_products TO authenticated;
GRANT ALL ON public.event_menue_materials TO authenticated;
GRANT ALL ON public.event_notes TO authenticated;
GRANT ALL ON public.event_menuplan_item_plans TO authenticated;
GRANT ALL ON public.event_menuplan_tracking TO authenticated;
GRANT ALL ON public.event_used_recipe_lists TO authenticated;
GRANT ALL ON public.event_shopping_lists TO authenticated;
GRANT ALL ON public.event_shopping_list_items TO authenticated;
GRANT ALL ON public.event_material_lists TO authenticated;
GRANT ALL ON public.event_material_list_items TO authenticated;
GRANT ALL ON public.requests TO authenticated;
GRANT ALL ON public.request_comments TO authenticated;
GRANT ALL ON public.feeds TO authenticated;
GRANT ALL ON public.donations TO authenticated;
GRANT ALL ON public.donation_goal_sections TO authenticated;
GRANT ALL ON public.cron_job_log TO authenticated;
GRANT ALL ON public.mail_log TO authenticated;
-- rpc_rate_limits: kein GRANT nötig — Zugriff nur via SECURITY DEFINER Funktion

-- service_role: Vollzugriff auf alle Tabellen, Views und Sequenzen.
-- Wird für Edge Functions (Cron-Jobs), die Datenmigration und
-- administrative Operationen benötigt.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- anon: selective SELECT only (3 tables/views)
GRANT SELECT ON public.global_settings TO anon;
GRANT SELECT ON public.system_messages TO anon;
-- user_profiles: nur für authentifizierte Benutzer (kein anon-Zugriff)

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. View Grants
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT ON public.user_profiles TO authenticated;
GRANT SELECT ON public.recipe_ingredients_with_names TO authenticated;
GRANT SELECT ON public.recipe_materials_with_names TO authenticated;
GRANT SELECT ON public.event_shopping_list_items_view TO authenticated;
GRANT SELECT ON public.event_material_list_items_view TO authenticated;
GRANT SELECT ON public.requests_view TO authenticated;
GRANT SELECT ON public.request_comments_view TO authenticated;
GRANT SELECT ON public.recipe_comments_view TO authenticated;
GRANT SELECT ON public.feeds_view TO authenticated;
GRANT SELECT ON public.donations_view TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Function Grants
-- ─────────────────────────────────────────────────────────────────────────────

-- Revoke all from PUBLIC and anon first
REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_updated_by() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_auth_email() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_role_escalation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_recipe_rating_aggregate() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_recipe_no_comments() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_community_leader() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_event_cook(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.event_has_cooks(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.increment_logins(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.increment_found_bugs(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_user_id_by_email(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_comment_author_profiles(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_event_cook_profiles(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_profile_stats(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_platform_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_menuplan(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_recipe(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_used_recipe_list_recipes(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.merge_products(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.merge_materials(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.convert_product_to_material(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.convert_material_to_product(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.where_used(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_similar_products(double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_auth_users_sync() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_duplicate_emails() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_events_without_dates() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_orphaned_event_cooks() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_orphaned_recipes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_recipes_without_events() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_unused_products() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_unused_materials() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_users_without_events() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cleanup_unused_products(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cleanup_unused_materials(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cleanup_recipes_without_events(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_donation_receipt_number() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_donation_goal_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_users_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_user_sessions(uuid[]) FROM PUBLIC, anon;

-- Grant to authenticated
GRANT EXECUTE ON FUNCTION public.update_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_by() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_auth_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_recipe_rating_aggregate() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_recipe_no_comments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_community_leader() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_cook(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.event_has_cooks(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_logins(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_found_bugs(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_comment_author_profiles(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_cook_profiles(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_menuplan(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_recipe(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_used_recipe_list_recipes(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_products(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_materials(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_product_to_material(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_material_to_product(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.where_used(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_similar_products(double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_users_sync() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_duplicate_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_events_without_dates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_orphaned_event_cooks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_orphaned_recipes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_recipes_without_events() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_unused_products() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_unused_materials() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_users_without_events() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_unused_products(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_unused_materials(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_recipes_without_events(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_users_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_donation_receipt_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_donation_goal_stats() TO authenticated;

-- service_role: Funktionen, die nur vom service_role aufgerufen werden dürfen
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid[]) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Sequence Grants
-- ─────────────────────────────────────────────────────────────────────────────

GRANT USAGE ON SEQUENCE public.request_number_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.donation_receipt_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.users_member_id_seq TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email);
CREATE INDEX IF NOT EXISTS idx_users_roles ON public.users USING gin (roles);
CREATE INDEX IF NOT EXISTS idx_users_search ON public.users USING gin (search_vector);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_department_id ON public.products USING btree (department_id);
CREATE INDEX IF NOT EXISTS idx_products_shopping_unit ON public.products USING btree (shopping_unit);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON public.products USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_qa_checked ON public.products USING btree (qa_checked);
CREATE INDEX IF NOT EXISTS idx_materials_qa_checked ON public.materials USING btree (qa_checked);

-- Unit Conversions
CREATE INDEX IF NOT EXISTS idx_unit_conv_basic_from ON public.unit_conversion_basic USING btree (from_unit);
CREATE INDEX IF NOT EXISTS idx_unit_conv_basic_to ON public.unit_conversion_basic USING btree (to_unit);
CREATE INDEX IF NOT EXISTS idx_unit_conv_products_from ON public.unit_conversion_products USING btree (from_unit);
CREATE INDEX IF NOT EXISTS idx_unit_conv_products_to ON public.unit_conversion_products USING btree (to_unit);
CREATE INDEX IF NOT EXISTS idx_unit_conv_products_product ON public.unit_conversion_products USING btree (product_id);

-- Recipes
CREATE INDEX IF NOT EXISTS idx_recipes_created_by ON public.recipes USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_recipes_recipe_type ON public.recipes USING btree (recipe_type);
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON public.recipes USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_recipes_menu_types ON public.recipes USING gin (menu_types);
CREATE INDEX IF NOT EXISTS idx_recipes_allergens ON public.recipes USING gin (allergens);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON public.recipe_ingredients USING btree (recipe_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_product_id ON public.recipe_ingredients USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_unit ON public.recipe_ingredients USING btree (unit);
CREATE INDEX IF NOT EXISTS idx_recipe_preparation_steps_recipe_id ON public.recipe_preparation_steps USING btree (recipe_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_recipe_materials_recipe_id ON public.recipe_materials USING btree (recipe_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_recipe_materials_material_id ON public.recipe_materials USING btree (material_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_recipe_id ON public.recipe_ratings USING btree (recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_user_id ON public.recipe_ratings USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_comments_recipe_id ON public.recipe_comments USING btree (recipe_id, created_at DESC);

-- Events
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_events_firebase_uid ON public.events USING btree (firebase_uid);
CREATE INDEX IF NOT EXISTS idx_event_cooks_event_id ON public.event_cooks USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_event_cooks_user_id ON public.event_cooks USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_event_dates_event_id ON public.event_dates USING btree (event_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_event_gc_diets_event_id ON public.event_groupconfiguration_diets USING btree (event_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_event_gc_intolerances_event_id ON public.event_groupconfiguration_intolerances USING btree (event_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_event_gc_portions_event_id ON public.event_groupconfiguration_portions USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_event_gc_portions_diet_id ON public.event_groupconfiguration_portions USING btree (diet_id);
CREATE INDEX IF NOT EXISTS idx_event_gc_portions_intol_id ON public.event_groupconfiguration_portions USING btree (intolerance_id);
CREATE INDEX IF NOT EXISTS idx_event_meal_types_event_id ON public.event_meal_types USING btree (event_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_event_meals_event_id ON public.event_meals USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_event_meals_meal_date ON public.event_meals USING btree (event_id, meal_date);
CREATE INDEX IF NOT EXISTS idx_event_meals_meal_type_id ON public.event_meals USING btree (meal_type_id);
CREATE INDEX IF NOT EXISTS idx_event_menues_event_id ON public.event_menues USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_event_menues_meal_id ON public.event_menues USING btree (meal_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_event_menue_recipes_event_id ON public.event_menue_recipes USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_event_menue_recipes_menue_id ON public.event_menue_recipes USING btree (menue_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_event_menue_recipes_recipe_id ON public.event_menue_recipes USING btree (recipe_id);
CREATE INDEX IF NOT EXISTS idx_event_menue_products_event_id ON public.event_menue_products USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_event_menue_products_menue_id ON public.event_menue_products USING btree (menue_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_event_menue_products_product_id ON public.event_menue_products USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_event_menue_materials_event_id ON public.event_menue_materials USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_event_menue_materials_menue_id ON public.event_menue_materials USING btree (menue_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_event_menue_materials_material_id ON public.event_menue_materials USING btree (material_id);
CREATE INDEX IF NOT EXISTS idx_event_notes_event_id ON public.event_notes USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_event_notes_menue_id ON public.event_notes USING btree (menue_id);
CREATE INDEX IF NOT EXISTS idx_event_notes_note_date ON public.event_notes USING btree (event_id, note_date);
CREATE INDEX IF NOT EXISTS idx_event_menuplan_plans_event_id ON public.event_menuplan_item_plans USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_event_menuplan_plans_recipe_id ON public.event_menuplan_item_plans USING btree (menue_recipe_id);
CREATE INDEX IF NOT EXISTS idx_event_menuplan_plans_product_id ON public.event_menuplan_item_plans USING btree (menue_product_id);
CREATE INDEX IF NOT EXISTS idx_event_menuplan_plans_material_id ON public.event_menuplan_item_plans USING btree (menue_material_id);
CREATE INDEX IF NOT EXISTS idx_event_menuplan_plans_diet_id ON public.event_menuplan_item_plans USING btree (diet_id);
CREATE INDEX IF NOT EXISTS idx_event_menuplan_plans_intolerance_id ON public.event_menuplan_item_plans USING btree (intolerance_id);

-- Used Recipe Lists
CREATE INDEX IF NOT EXISTS idx_used_recipe_lists_event ON public.event_used_recipe_lists USING btree (event_id);

-- Shopping Lists
CREATE INDEX IF NOT EXISTS idx_shopping_lists_event ON public.event_shopping_lists USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list ON public.event_shopping_list_items USING btree (list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_product_id ON public.event_shopping_list_items USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_material_id ON public.event_shopping_list_items USING btree (material_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_department_id ON public.event_shopping_list_items USING btree (department_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_unit ON public.event_shopping_list_items USING btree (unit);

-- Material Lists
CREATE INDEX IF NOT EXISTS idx_material_lists_event ON public.event_material_lists USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_material_list_items_list ON public.event_material_list_items USING btree (list_id);
CREATE INDEX IF NOT EXISTS idx_material_list_items_material_id ON public.event_material_list_items USING btree (material_id);
CREATE INDEX IF NOT EXISTS idx_material_list_items_assigned_cook ON public.event_material_list_items USING btree (assigned_cook_id);

-- Requests
CREATE INDEX IF NOT EXISTS idx_requests_author ON public.requests USING btree (author_uid);
CREATE INDEX IF NOT EXISTS idx_requests_assignee ON public.requests USING btree (assignee_uid);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_requests_number ON public.requests USING btree (number);
CREATE INDEX IF NOT EXISTS idx_requests_firebase ON public.requests USING btree (firebase_uid);
CREATE INDEX IF NOT EXISTS idx_request_comments_request ON public.request_comments USING btree (request_id);

-- Feeds
CREATE INDEX IF NOT EXISTS idx_feeds_created_at ON public.feeds USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feeds_feed_type ON public.feeds USING btree (feed_type);
CREATE INDEX IF NOT EXISTS idx_feeds_user_uid ON public.feeds USING btree (user_uid);
CREATE INDEX IF NOT EXISTS idx_feeds_visibility ON public.feeds USING btree (visibility);
CREATE INDEX IF NOT EXISTS idx_feeds_firebase_uid ON public.feeds USING btree (firebase_uid) WHERE (firebase_uid IS NOT NULL);

-- Donations
CREATE INDEX IF NOT EXISTS idx_donations_donor_uid ON public.donations USING btree (donor_uid);
CREATE INDEX IF NOT EXISTS idx_donations_event_id ON public.donations USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON public.donations USING btree (status);
CREATE INDEX IF NOT EXISTS idx_donations_payrexx_ref ON public.donations USING btree (payrexx_reference_id);

-- Admin/Monitoring
CREATE INDEX IF NOT EXISTS idx_cron_job_log_job_name ON public.cron_job_log USING btree (job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_job_log_status ON public.cron_job_log USING btree (status);
CREATE INDEX IF NOT EXISTS idx_mail_log_sent_at ON public.mail_log USING btree (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_log_delivery_status ON public.mail_log USING btree (delivery_status);

-- Rate-Limiting
CREATE INDEX IF NOT EXISTS idx_rpc_rate_limits_lookup
    ON internal.rpc_rate_limits (user_id, function_name, called_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Storage – Media Bucket & Policies
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
DROP POLICY IF EXISTS "media_select_public" ON storage.objects;
CREATE POLICY "media_select_public" ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- Events: cooks can manage event images
DROP POLICY IF EXISTS "media_events_insert" ON storage.objects;
CREATE POLICY "media_events_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'events'
    AND is_event_cook((regexp_match(storage.filename(name), '^([0-9a-f-]+).jpg$'))[1])
  );

DROP POLICY IF EXISTS "media_events_update" ON storage.objects;
CREATE POLICY "media_events_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'events'
    AND is_event_cook((regexp_match(storage.filename(name), '^([0-9a-f-]+).jpg$'))[1])
  );

DROP POLICY IF EXISTS "media_events_delete" ON storage.objects;
CREATE POLICY "media_events_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'events'
    AND is_event_cook((regexp_match(storage.filename(name), '^([0-9a-f-]+).jpg$'))[1])
  );

-- Users: can manage own profile picture
DROP POLICY IF EXISTS "media_users_insert_own" ON storage.objects;
CREATE POLICY "media_users_insert_own" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'users'
    AND storage.filename(name) = ((SELECT auth.uid())::text || '.jpg')
  );

DROP POLICY IF EXISTS "media_users_update_own" ON storage.objects;
CREATE POLICY "media_users_update_own" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'users'
    AND storage.filename(name) = ((SELECT auth.uid())::text || '.jpg')
  );

DROP POLICY IF EXISTS "media_users_delete_own" ON storage.objects;
CREATE POLICY "media_users_delete_own" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'users'
    AND storage.filename(name) = ((SELECT auth.uid())::text || '.jpg')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Realtime – Tabellen zur supabase_realtime Publication hinzufügen
-- ─────────────────────────────────────────────────────────────────────────────

-- Event-Tabellen
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_cooks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_dates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_groupconfiguration_diets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_groupconfiguration_intolerances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_groupconfiguration_portions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_meal_types;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_meals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_menues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_menue_recipes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_menue_products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_menue_materials;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_menuplan_item_plans;

-- Einkaufslisten
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_shopping_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_shopping_list_items;

-- Materiallisten
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_material_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_material_list_items;
