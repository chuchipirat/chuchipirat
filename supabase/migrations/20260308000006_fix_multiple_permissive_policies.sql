-- Fix: Multiple Permissive Policies
--
-- Supabase meldet für jede Tabelle einen Performance-Hinweis, wenn mehrere
-- permissive RLS-Policies für dieselbe Rolle und Aktion existieren. Postgres
-- wertet alle permissive Policies per OR aus — alle müssen ausgewertet werden,
-- auch wenn die erste bereits erlaubt.
--
-- Ursachen:
--
-- 1. public.users — 6 Warnungen (3 Aktionen × 2 Rollen anon/authenticated)
--    Alle Policies wurden ohne TO-Klausel erstellt und gelten damit für alle Rollen.
--    SELECT:  users_select_own + users_select_leader (beide ohne TO)
--    INSERT:  users_insert_self + users_insert_admin (beide ohne TO)
--    UPDATE:  users_update_own + users_update_admin + users_link_auth (alle ohne TO)
--
-- 2. public.system_messages — 6 Warnungen (3 Aktionen × 2 Rollen)
--    20260302000001 hat system_messages_insert und system_messages_delete ohne
--    vorheriges DROP neu angelegt. Alle Policies fehlt die TO-Klausel.
--
-- Lösung:
--   - Mehrere Policies pro Aktion zu einer einzigen zusammenführen (OR-Verknüpfung)
--   - TO authenticated ergänzen, damit anon-Rolle ausgeschlossen wird
--   - auth.uid() → (SELECT auth.uid()) (kompatibel mit 20260308000005)

-- =====================================================================
-- public.users — SELECT, INSERT, UPDATE konsolidieren
-- =====================================================================

-- SELECT: users_select_own + users_select_leader → eine Policy
DROP POLICY IF EXISTS users_select_own    ON public.users;
DROP POLICY IF EXISTS users_select_leader ON public.users;

CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated
  -- Eigene Zeile oder Community-Leader dürfen lesen
  USING (auth_uid = (SELECT auth.uid()) OR is_community_leader());

-- INSERT: users_insert_self + users_insert_admin → eine Policy
DROP POLICY IF EXISTS users_insert_self  ON public.users;
DROP POLICY IF EXISTS users_insert_admin ON public.users;

CREATE POLICY users_insert ON public.users
  FOR INSERT TO authenticated
  -- Eigene Registrierung oder Admin-Insert
  WITH CHECK (auth_uid = (SELECT auth.uid()) OR is_admin());

-- UPDATE: users_update_own + users_update_admin + users_link_auth → eine Policy
DROP POLICY IF EXISTS users_update_own  ON public.users;
DROP POLICY IF EXISTS users_update_admin ON public.users;
DROP POLICY IF EXISTS users_link_auth   ON public.users;

CREATE POLICY users_update ON public.users
  FOR UPDATE TO authenticated
  USING (
    -- Eigenes Profil
    auth_uid = (SELECT auth.uid())
    -- Admin darf alles
    OR is_admin()
    -- Auth-Linking: verknüpft auth_uid bei noch nicht verknüpften Accounts
    OR (auth_uid IS NULL AND email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid())))
  )
  WITH CHECK (
    -- Eigenes Profil: roles darf nicht geändert werden
    (auth_uid = (SELECT auth.uid())
      AND roles = (SELECT roles FROM public.users WHERE auth_uid = (SELECT auth.uid())))
    -- Admin: darf alles ändern
    OR is_admin()
    -- Auth-Linking: nur auth_uid setzen, roles muss unveraendert bleiben
    OR (auth_uid = (SELECT auth.uid())
      AND roles = (
        SELECT roles FROM public.users
        WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      ))
  );

-- =====================================================================
-- public.system_messages — alle Policies neu erstellen mit TO authenticated
-- =====================================================================

DROP POLICY IF EXISTS system_messages_select ON public.system_messages;
DROP POLICY IF EXISTS system_messages_update ON public.system_messages;
DROP POLICY IF EXISTS system_messages_insert ON public.system_messages;
DROP POLICY IF EXISTS system_messages_delete ON public.system_messages;

-- Jeder darf lesen (Startseite zeigt Meldungen auch ohne Auth)
CREATE POLICY system_messages_select ON public.system_messages
  FOR SELECT USING (true);

-- Nur Admins dürfen schreiben, ändern und löschen
CREATE POLICY system_messages_update ON public.system_messages
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY system_messages_insert ON public.system_messages
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY system_messages_delete ON public.system_messages
  FOR DELETE TO authenticated USING (is_admin());
