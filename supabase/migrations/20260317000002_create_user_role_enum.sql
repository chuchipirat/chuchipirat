-- =============================================================================
-- Gemeinsamer ENUM-Typ für Benutzerrollen.
-- Wird von users.roles (Array) und feeds.visibility (Einzelwert) verwendet.
-- =============================================================================

BEGIN;

-- 1. ENUM erstellen
CREATE TYPE public.user_role AS ENUM ('basic', 'communityLeader', 'admin');

-- 2. RLS-Policies auf users temporär entfernen, die roles referenzieren.
--    Ohne dies blockiert Postgres den ALTER COLUMN TYPE.
DROP POLICY IF EXISTS users_update ON public.users;

-- 3. users.roles von TEXT[] auf user_role[] umstellen.
--    Default muss zuerst entfernt werden, da Postgres den Cast nicht
--    automatisch auf Default-Ausdrücke anwendet.
ALTER TABLE public.users ALTER COLUMN roles DROP DEFAULT;

ALTER TABLE public.users
  ALTER COLUMN roles TYPE public.user_role[]
  USING roles::public.user_role[];

ALTER TABLE public.users
  ALTER COLUMN roles SET DEFAULT ARRAY['basic'::public.user_role];

-- 4. RLS-Policy wiederherstellen (identisch mit dem aktuellen Stand
--    aus 20260308000006_fix_multiple_permissive_policies.sql, aber jetzt
--    mit implizitem user_role-Vergleich statt TEXT).
CREATE POLICY users_update ON public.users
  FOR UPDATE TO authenticated
  USING (
    (auth_uid = (SELECT auth.uid()))
    OR is_admin()
    OR (
      auth_uid IS NULL
      AND email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))::TEXT
    )
  )
  WITH CHECK (
    -- Eigenes Profil: roles darf nicht geändert werden
    (auth_uid = (SELECT auth.uid())
      AND roles = (SELECT roles FROM public.users WHERE auth_uid = (SELECT auth.uid())))
    -- Admin: darf alles ändern
    OR is_admin()
    -- Auth-Linking: nur auth_uid setzen, roles muss unverändert bleiben
    OR (auth_uid = (SELECT auth.uid())
      AND roles = (
        SELECT roles FROM public.users
        WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))::TEXT
      ))
  );

-- 5. Funktionen neu erstellen — expliziter Cast auf user_role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_uid = (SELECT auth.uid()) AND 'admin'::public.user_role = ANY(roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_community_leader()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_uid = (SELECT auth.uid())
      AND ('admin'::public.user_role = ANY(roles) OR 'communityLeader'::public.user_role = ANY(roles))
  );
$$;

COMMIT;
