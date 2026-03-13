-- =====================================================================
-- Funktion: get_event_cook_profiles
--
-- Gibt die Köche eines Events mit öffentlichen Profilfeldern zurück.
-- Löst das N+1-Problem: statt einzelner User.getPublicProfile()-Aufrufe
-- pro Koch werden alle Köche + Profile in einer Abfrage geladen.
--
-- Hintergrund: Die RLS-Policy auf public.users erlaubt authentifizierten
-- Benutzern nur das Lesen der eigenen Zeile (oder aller Zeilen für
-- Community-Leader/Admins). Für die Anzeige anderer Köche ist ein
-- SECURITY DEFINER nötig, der RLS auf users umgeht und nur öffentliche
-- Felder zurückgibt. Der Zugriff wird über is_event_cook() bzw.
-- is_admin() geschützt.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_event_cook_profiles(p_event_id TEXT)
RETURNS TABLE(
  id TEXT,
  user_id UUID,
  display_name TEXT,
  motto TEXT,
  picture_src TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    ec.id,
    ec.user_id,
    COALESCE(u.display_name, '') AS display_name,
    COALESCE(u.motto, '') AS motto,
    COALESCE(u.picture_src, '') AS picture_src
  FROM public.event_cooks ec
  LEFT JOIN public.users u ON u.auth_uid = ec.user_id
  WHERE ec.event_id = p_event_id
    AND (is_event_cook(p_event_id) OR is_admin());
$$;

GRANT EXECUTE ON FUNCTION public.get_event_cook_profiles(TEXT) TO authenticated;
