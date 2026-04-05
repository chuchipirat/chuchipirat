-- =============================================================================
-- Chuchipirat – Baseline Migration (5/7): Triggers
-- Generated: 2026-04-01
-- =============================================================================
-- This file is part of the baseline schema. Do NOT modify after first deploy.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Auth & Users
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Verhindert Rollen-Eskalation durch Nicht-Admins
CREATE TRIGGER trg_prevent_role_escalation BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- Sync auth.users email → public.users email
CREATE TRIGGER trg_sync_auth_email AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_auth_email();

-- Automatisch public.users-Eintrag bei neuem auth.users anlegen
CREATE TRIGGER trg_handle_new_user AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Global Config
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_global_settings_updated_at BEFORE UPDATE ON public.global_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_global_settings_updated_by BEFORE INSERT OR UPDATE ON public.global_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_system_messages_updated_at BEFORE UPDATE ON public.system_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_system_messages_updated_by BEFORE INSERT OR UPDATE ON public.system_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

-- ─────────────────────────────────────────────────────────────────────────────
-- Masterdata
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_departments_updated_at BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_departments_updated_by BEFORE INSERT OR UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_units_updated_at BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_units_updated_by BEFORE INSERT OR UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

-- ─────────────────────────────────────────────────────────────────────────────
-- Products & Materials
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_products_updated_by BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_materials_updated_at BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_materials_updated_by BEFORE INSERT OR UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_unit_conversion_basic_updated_at BEFORE UPDATE ON public.unit_conversion_basic
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_unit_conversion_basic_updated_by BEFORE INSERT OR UPDATE ON public.unit_conversion_basic
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_unit_conversion_products_updated_at BEFORE UPDATE ON public.unit_conversion_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_unit_conversion_products_updated_by BEFORE INSERT OR UPDATE ON public.unit_conversion_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_product_synonyms_updated_at BEFORE UPDATE ON public.product_synonyms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_product_synonyms_updated_by BEFORE INSERT OR UPDATE ON public.product_synonyms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_product_duplicate_dismissals_updated_at BEFORE UPDATE ON public.product_duplicate_dismissals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_product_duplicate_dismissals_updated_by BEFORE INSERT OR UPDATE ON public.product_duplicate_dismissals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

-- ─────────────────────────────────────────────────────────────────────────────
-- Recipes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_recipes_updated_at BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_recipes_updated_by BEFORE INSERT OR UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_recipe_ingredients_updated_at BEFORE UPDATE ON public.recipe_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_recipe_ingredients_updated_by BEFORE INSERT OR UPDATE ON public.recipe_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_recipe_preparation_steps_updated_at BEFORE UPDATE ON public.recipe_preparation_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_recipe_preparation_steps_updated_by BEFORE INSERT OR UPDATE ON public.recipe_preparation_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_recipe_materials_updated_at BEFORE UPDATE ON public.recipe_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_recipe_materials_updated_by BEFORE INSERT OR UPDATE ON public.recipe_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_recipe_ratings_updated_at BEFORE UPDATE ON public.recipe_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_recipe_ratings_updated_by BEFORE INSERT OR UPDATE ON public.recipe_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();
CREATE TRIGGER trg_recipe_ratings_aggregate AFTER INSERT OR DELETE OR UPDATE ON public.recipe_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_recipe_rating_aggregate();

CREATE TRIGGER trg_recipe_comments_updated_at BEFORE UPDATE ON public.recipe_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_recipe_comments_updated_by BEFORE INSERT OR UPDATE ON public.recipe_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();
CREATE TRIGGER trg_recipe_comments_count AFTER INSERT OR DELETE ON public.recipe_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_recipe_no_comments();

-- ─────────────────────────────────────────────────────────────────────────────
-- Events
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_events_updated_by BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_event_cooks_updated_at BEFORE UPDATE ON public.event_cooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_event_cooks_updated_by BEFORE INSERT OR UPDATE ON public.event_cooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_event_dates_updated_at BEFORE UPDATE ON public.event_dates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_event_dates_updated_by BEFORE INSERT OR UPDATE ON public.event_dates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_event_groupconfiguration_diets_updated_at BEFORE UPDATE ON public.event_groupconfiguration_diets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_event_groupconfiguration_diets_updated_by BEFORE INSERT OR UPDATE ON public.event_groupconfiguration_diets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_event_groupconfiguration_intolerances_updated_at BEFORE UPDATE ON public.event_groupconfiguration_intolerances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_event_groupconfiguration_intolerances_updated_by BEFORE INSERT OR UPDATE ON public.event_groupconfiguration_intolerances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_event_groupconfiguration_portions_updated_at BEFORE UPDATE ON public.event_groupconfiguration_portions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_event_groupconfiguration_portions_updated_by BEFORE INSERT OR UPDATE ON public.event_groupconfiguration_portions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_event_menuplan_tracking_updated_at BEFORE UPDATE ON public.event_menuplan_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_event_menuplan_tracking_updated_by BEFORE INSERT OR UPDATE ON public.event_menuplan_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

-- ─────────────────────────────────────────────────────────────────────────────
-- Used Recipe Lists
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_used_recipe_lists_updated_at BEFORE UPDATE ON public.event_used_recipe_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_used_recipe_lists_updated_by BEFORE UPDATE ON public.event_used_recipe_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

-- ─────────────────────────────────────────────────────────────────────────────
-- Shopping Lists
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_shopping_lists_updated_at BEFORE UPDATE ON public.event_shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_shopping_lists_updated_by BEFORE INSERT OR UPDATE ON public.event_shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_shopping_list_items_updated_at BEFORE UPDATE ON public.event_shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_shopping_list_items_updated_by BEFORE INSERT OR UPDATE ON public.event_shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

-- ─────────────────────────────────────────────────────────────────────────────
-- Material Lists
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_material_lists_updated_at BEFORE UPDATE ON public.event_material_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_material_lists_updated_by BEFORE INSERT OR UPDATE ON public.event_material_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_material_list_items_updated_at BEFORE UPDATE ON public.event_material_list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_material_list_items_updated_by BEFORE INSERT OR UPDATE ON public.event_material_list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

-- ─────────────────────────────────────────────────────────────────────────────
-- Requests
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_requests_updated_at BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_requests_updated_by BEFORE INSERT OR UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_request_comments_updated_at BEFORE UPDATE ON public.request_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_request_comments_updated_by BEFORE INSERT OR UPDATE ON public.request_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

-- ─────────────────────────────────────────────────────────────────────────────
-- Feeds
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.feeds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_by BEFORE UPDATE ON public.feeds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

-- ─────────────────────────────────────────────────────────────────────────────
-- Donations
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_donations_updated_at BEFORE UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_donations_updated_by BEFORE UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE TRIGGER trg_donation_goal_sections_updated_at BEFORE UPDATE ON public.donation_goal_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_donation_goal_sections_updated_by BEFORE UPDATE ON public.donation_goal_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();
