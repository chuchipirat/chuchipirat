-- =====================================================================
-- View: donations_view — JOINt Spender- und Event-Informationen
-- =====================================================================
-- Verwendet security_invoker, damit RLS-Policies der Basistabelle greifen.
-- =====================================================================

CREATE VIEW public.donations_view WITH (security_invoker = true) AS
SELECT
  d.*,
  u.display_name AS donor_display_name,
  u.email        AS donor_email,
  e.name         AS event_name
FROM public.donations d
LEFT JOIN public.users u ON u.id::UUID = d.donor_uid
LEFT JOIN public.events e ON e.id = d.event_id;

GRANT SELECT ON public.donations_view TO authenticated;
