-- =====================================================================
-- Funktion: get_comment_author_profiles
--
-- Gibt die öffentlichen Profilfelder (Anzeigename, Profilbild) für eine
-- Liste von Auth-UUIDs zurück, die als Ersteller von Rezeptkommentaren
-- auftreten.
--
-- Hintergrund: Die View `public.user_profiles` unterliegt der RLS-Policy
-- `users_select_own`, sodass ein authentifizierter Benutzer über den
-- regulären Client nur seine eigene Zeile lesen kann. Für die Anzeige
-- von Kommentaren anderer Benutzer ist ein SECURITY DEFINER nötig, der
-- RLS umgeht und ausschliesslich öffentliche Felder zurückgibt.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_comment_author_profiles(uids UUID[])
RETURNS TABLE(auth_uid UUID, display_name TEXT, picture_src TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.auth_uid, u.display_name, u.picture_src
  FROM public.users u
  WHERE u.auth_uid = ANY(uids)
    AND u.auth_uid IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_comment_author_profiles(UUID[]) TO authenticated;
