-- Tabellen für Supabase Realtime aktivieren.
-- Supabase Realtime benötigt explizites Hinzufügen zur Publication `supabase_realtime`.

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
