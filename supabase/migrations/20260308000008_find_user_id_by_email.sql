-- Migration: SECURITY DEFINER Funktion find_user_id_by_email
--
-- Problem: Die users_select RLS-Policy erlaubt nur das Lesen der eigenen Zeile
-- (auth_uid = auth.uid()). Dadurch kann findByEmail() im UserRepository keinen
-- anderen Benutzer finden — z.B. beim Hinzufügen eines Kochs per E-Mail.
--
-- Lösung: Eine SECURITY DEFINER Funktion, die RLS umgeht und nur die user-ID
-- zurückgibt — minimale Datenexposition (kein Name, kein Profil).

CREATE OR REPLACE FUNCTION public.find_user_id_by_email(lookup_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT auth_uid
  FROM public.users
  WHERE LOWER(email) = LOWER(TRIM(lookup_email))
  LIMIT 1;
$$;

-- Nur authentifizierte Benutzer dürfen die Funktion aufrufen
REVOKE ALL ON FUNCTION public.find_user_id_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT) TO authenticated;
