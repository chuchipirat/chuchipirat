-- View auf SECURITY INVOKER umstellen, damit RLS-Policies der
-- Basistabelle (event_shopping_list_items) greifen und Abfragen
-- im Kontext des aufrufenden Benutzers ausgeführt werden.

ALTER VIEW public.event_shopping_list_items_view SET (security_invoker = on);
