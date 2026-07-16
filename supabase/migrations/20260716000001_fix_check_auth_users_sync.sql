-- ─────────────────────────────────────────────────────────────────────────────
-- Fix check_auth_users_sync(): public.users has no "auth_uid" column.
-- The FK to auth.users is public.users.id itself (fk_users_auth), so the
-- function must compare against u.id instead of the nonexistent u.auth_uid.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_auth_users_sync() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'user_id', u.id,
      'display_name', u.display_name,
      'issue', 'public.users hat keinen auth.users-Eintrag'
    )), '[]'::JSONB)
    FROM public.users u
    WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id)
  );
END;
$$;
