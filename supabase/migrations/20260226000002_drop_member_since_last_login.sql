-- Phase 2b: member_since und last_login entfernen
-- member_since wird durch created_at ersetzt.
-- last_login wird durch auth.users.last_sign_in_at ersetzt (Supabase Auth).

-- 1. View droppen (referenziert member_since)
DROP VIEW IF EXISTS public.user_profiles;

-- 2. Spalten entfernen
ALTER TABLE public.users DROP COLUMN member_since;
ALTER TABLE public.users DROP COLUMN last_login;

-- 3. View ohne member_since/last_login neu erstellen
CREATE VIEW public.user_profiles AS
  SELECT id, auth_uid, display_name, created_at, member_id, motto,
    picture_src_small, picture_src_normal, picture_src_full
  FROM public.users;
GRANT SELECT ON public.user_profiles TO anon, authenticated;
