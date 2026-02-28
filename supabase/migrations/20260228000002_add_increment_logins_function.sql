-- Funktion zum atomaren Hochzählen der Login-Anzahl.
-- Ersetzt das bisherige SELECT + UPDATE mit einem einzigen Statement.
-- SECURITY DEFINER nötig, da RLS auf der users-Tabelle aktiv ist
-- und die Funktion über die Firebase-UID (id) filtert, nicht über auth_uid.
CREATE OR REPLACE FUNCTION public.increment_logins(user_id TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.users
  SET no_logins = no_logins + 1
  WHERE id = user_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_logins(TEXT) TO authenticated;
