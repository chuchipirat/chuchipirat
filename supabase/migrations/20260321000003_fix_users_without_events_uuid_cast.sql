-- ============================================================
-- Fix: check_users_without_events — UUID-Cast-Fehler beheben
-- ============================================================
-- users.id ist TEXT (Firebase-UID), event_cooks.user_id ist UUID (auth.users).
-- Der bisherige Cast u.id::UUID schlug für Firebase-UIDs fehl, die kein
-- gültiges UUID-Format haben. Stattdessen wird jetzt u.auth_uid verwendet,
-- das bereits UUID ist und direkt mit event_cooks.user_id verglichen werden kann.
-- Benutzer ohne auth_uid (noch nicht zu Supabase Auth migriert) werden
-- ebenfalls als "ohne Event" gemeldet.

CREATE OR REPLACE FUNCTION public.check_users_without_events()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', u.id,
    'display_name', u.display_name,
    'email', u.email
  )), '[]'::JSONB)
  FROM public.users u
  WHERE u.auth_uid IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.event_cooks ec WHERE ec.user_id = u.auth_uid
     );
$$;
