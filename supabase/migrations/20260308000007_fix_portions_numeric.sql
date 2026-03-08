-- Fix: Portionen können Dezimalwerte sein (z.B. 0.5 für eine halbe Portion).
--
-- event_menuplan_item_plans.servings und event_menue_recipes.total_portions
-- wurden als INTEGER definiert, was Werte wie 46.5 ablehnt.
-- Beide Spalten werden auf NUMERIC(10,2) umgestellt — konsistent mit den
-- anderen Mengenspalten im Schema (quantity NUMERIC(12,4)).
-- 2 Dezimalstellen sind für Portionen ausreichend (z.B. 0.5, 1.25).

ALTER TABLE public.event_menuplan_item_plans
  ALTER COLUMN servings TYPE NUMERIC(10,2) USING servings::NUMERIC(10,2);

ALTER TABLE public.event_menue_recipes
  ALTER COLUMN total_portions TYPE NUMERIC(10,2) USING total_portions::NUMERIC(10,2);
