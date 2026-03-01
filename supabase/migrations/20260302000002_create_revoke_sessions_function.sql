-- Migration: SQL-Funktion zum Widerrufen von Benutzer-Sessions.
-- Wird von der Edge Function sign-out-all-users aufgerufen.
-- Löscht Sessions und Refresh-Tokens direkt in der auth-Schema-Tabelle.

CREATE OR REPLACE FUNCTION public.revoke_user_sessions(target_user_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Refresh-Tokens löschen (werden über Session-ID referenziert)
  DELETE FROM auth.refresh_tokens
  WHERE session_id IN (
    SELECT id FROM auth.sessions
    WHERE user_id = ANY(target_user_ids)
  );

  -- Sessions löschen
  DELETE FROM auth.sessions
  WHERE user_id = ANY(target_user_ids);
END;
$$;

-- Nur der Service-Role-Key darf diese Funktion aufrufen
REVOKE ALL ON FUNCTION public.revoke_user_sessions(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_user_sessions(UUID[]) FROM anon;
REVOKE ALL ON FUNCTION public.revoke_user_sessions(UUID[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(UUID[]) TO service_role;
