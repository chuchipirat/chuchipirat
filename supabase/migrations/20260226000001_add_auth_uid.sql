-- Phase 2: Supabase Auth Integration
-- Erweitert die users-Tabelle um auth_uid und aktiviert Row Level Security.

-- 1. auth_uid für Supabase Auth Verknüpfung
-- (id is already TEXT from the initial migration)
ALTER TABLE public.users ADD COLUMN auth_uid UUID UNIQUE;
CREATE INDEX idx_users_auth_uid ON public.users(auth_uid);

-- 3. Hilfsfunktion: prüft ob aktueller User Admin ist
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_uid = auth.uid() AND 'admin' = ANY(roles)
  );
$$;

-- 4. Hilfsfunktion: prüft ob aktueller User CommunityLeader oder Admin ist
CREATE OR REPLACE FUNCTION is_community_leader()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_uid = auth.uid()
      AND ('admin' = ANY(roles) OR 'communityLeader' = ANY(roles))
  );
$$;

-- 5. RLS aktivieren
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 6. Policies
CREATE POLICY users_select_own ON public.users
  FOR SELECT USING (auth_uid = auth.uid());

CREATE POLICY users_select_leader ON public.users
  FOR SELECT USING (is_community_leader());

CREATE POLICY users_insert_self ON public.users
  FOR INSERT WITH CHECK (auth_uid = auth.uid());

CREATE POLICY users_insert_admin ON public.users
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY users_update_own ON public.users
  FOR UPDATE USING (auth_uid = auth.uid())
  WITH CHECK (auth_uid = auth.uid()
    AND roles = (SELECT roles FROM public.users WHERE auth_uid = auth.uid()));

CREATE POLICY users_update_admin ON public.users
  FOR UPDATE USING (is_admin());

-- Migrations-Policy: Erlaubt einem frisch authentifizierten User, seinen eigenen
-- auth_uid zu setzen, wenn dieser noch NULL ist und die E-Mail übereinstimmt.
CREATE POLICY users_link_auth ON public.users
  FOR UPDATE
  USING (auth_uid IS NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (auth_uid = auth.uid());

-- 7. View aktualisieren (auth_uid hinzufügen)
-- DROP nötig, da CREATE OR REPLACE keine neuen Spalten zu einer bestehenden View hinzufügen kann
DROP VIEW IF EXISTS public.user_profiles;
CREATE VIEW public.user_profiles AS
  SELECT id, auth_uid, display_name, member_since, member_id, motto,
    picture_src_small, picture_src_normal, picture_src_full
  FROM public.users;
GRANT SELECT ON public.user_profiles TO anon, authenticated;

-- 8. Service-Role Bypass (für Migration und Admin-Operationen)
-- service_role hat automatisch RLS-Bypass in Supabase
