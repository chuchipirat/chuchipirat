-- =============================================================================
-- Chuchipirat – Baseline Migration (1/7): Extensions, Enums, Sequences
-- Generated: 2026-04-01
-- =============================================================================
-- This file is part of the baseline schema. Do NOT modify after first deploy.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────

-- pg_trgm: Trigram-basierte Ähnlichkeitssuche (z.B. Produktduplikate)
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- pg_net: Asynchrone HTTP-Requests (Edge Functions, Webhooks)
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- pg_cron: wird von Supabase automatisch bereitgestellt (pg_catalog)

-- ─────────────────────────────────────────────────────────────────────────────
-- Internal Schema (System-/Infrastruktur-Tabellen, nicht via API exponiert)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS internal;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────

-- Auth & Users
CREATE TYPE public.user_role AS ENUM ('basic', 'communityLeader', 'admin');

-- Masterdata – Products & Materials
CREATE TYPE public.material_type AS ENUM ('none', 'consumable', 'usage');
CREATE TYPE public.diet_type AS ENUM ('meat', 'vegetarian', 'vegan');
CREATE TYPE public.allergen_type AS ENUM ('lactose', 'gluten');

-- Recipes
CREATE TYPE public.recipe_type AS ENUM ('public', 'private', 'variant');
CREATE TYPE public.menu_type AS ENUM (
  'main_course', 'side_dish', 'appetizer', 'dessert',
  'breakfast', 'snack', 'apero', 'beverage'
);
CREATE TYPE public.recipe_ingredient_pos_type AS ENUM ('ingredient', 'section');
CREATE TYPE public.recipe_step_pos_type AS ENUM ('preparation_step', 'section');

-- Events – Menuplan
CREATE TYPE public.plan_scope_type AS ENUM ('ALL', 'FIX', 'group');
CREATE TYPE public.plan_mode_type AS ENUM ('total', 'per_portion');

-- Requests
CREATE TYPE public.request_status_type AS ENUM (
  'created', 'inReview', 'declined', 'backToAuthor', 'done'
);
CREATE TYPE public.request_type_enum AS ENUM ('recipePublish', 'reportError');

-- Shopping Lists
CREATE TYPE public.shopping_list_edit_source AS ENUM (
  'generated', 'manual_add', 'manual_edit'
);

-- Feeds
CREATE TYPE public.feed_type AS ENUM (
  'userCreated', 'recipePublished', 'recipeRated', 'recipeCommented',
  'eventCreated', 'eventCookAdded', 'shoppingListCreated',
  'productCreated', 'materialCreated', 'profilePictureChanged',
  'donationConfirmed'
);

-- Donations
CREATE TYPE public.donation_status AS ENUM (
  'pending', 'confirmed', 'failed', 'cancelled', 'refunded', 'migrated'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Sequences
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SEQUENCE public.request_number_seq
  START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE SEQUENCE public.donation_receipt_seq
  START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
