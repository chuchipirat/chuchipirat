-- Materiallisten-Tabellen zur Supabase-Realtime-Publication hinzufügen.
-- Ohne diesen Schritt werden keine WAL-Events emittiert und die
-- postgres_changes-Subscriptions im Frontend erhalten keine Updates.

ALTER PUBLICATION supabase_realtime ADD TABLE public.event_material_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_material_list_items;
