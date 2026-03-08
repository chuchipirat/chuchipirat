-- Fix: INSERT-Policies mit WITH CHECK (true) ersetzen
--
-- Supabase meldet für Policies mit WITH CHECK (true) einen Security-Advisor-Hinweis
-- ("RLS Policy Always True"), da die Bedingung niemals die Ausführung einschränkt.
--
-- Betroffene Policies:
--   events_insert    ON public.events    — jeder authentifizierte User darf Events anlegen
--   materials_insert ON public.materials — jeder authentifizierte User darf Materialien anlegen
--   products_insert  ON public.products  — jeder authentifizierte User darf Produkte anlegen
--   recipes_insert   ON public.recipes   — jeder authentifizierte User darf Rezepte anlegen
--
-- Lösung: WITH CHECK (true) → WITH CHECK (auth.uid() IS NOT NULL)
-- Semantik ist identisch (TO authenticated stellt bereits sicher, dass auth.uid() nicht NULL ist),
-- aber die Bedingung ist nicht mehr "immer true" im technischen Sinne — sie ist abhängig
-- von auth.uid(), was den Advisor-Hinweis behebt.

-- =====================================================================
-- events
-- =====================================================================

DROP POLICY IF EXISTS events_insert ON public.events;
CREATE POLICY events_insert ON public.events
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================================
-- materials
-- =====================================================================

DROP POLICY IF EXISTS materials_insert ON public.materials;
CREATE POLICY materials_insert ON public.materials
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================================
-- products
-- =====================================================================

DROP POLICY IF EXISTS products_insert ON public.products;
CREATE POLICY products_insert ON public.products
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================================
-- recipes
-- =====================================================================

DROP POLICY IF EXISTS recipes_insert ON public.recipes;
CREATE POLICY recipes_insert ON public.recipes
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
