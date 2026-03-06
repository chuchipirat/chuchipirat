-- =====================================================================
-- Sicherheits-Fix: users_link_auth darf roles nicht ändern
--
-- Problem: Die Policy users_link_auth erlaubte Benutzern mit auth_uid IS NULL,
-- gleichzeitig mit dem Setzen von auth_uid auch die roles-Spalte zu ändern.
-- Die WITH CHECK-Klausel prüfte nur auth_uid = auth.uid(), nicht aber, ob
-- roles unverändert geblieben ist.
--
-- Da PostgreSQL permissive Policies per OR verknüpft, konnte ein Benutzer
-- die strengere WITH CHECK-Klausel in users_update_own umgehen, indem er
-- users_link_auth nutzte — selbst wenn die Änderung von roles durch
-- users_update_own abgelehnt worden wäre.
--
-- Fix: WITH CHECK erweitert um roles-Vergleich gegen den aktuellen DB-Wert.
-- Der Subquery liest roles im aktuellen Commit-Stand (vor dem Update),
-- sodass users_link_auth ausschliesslich auth_uid setzen darf.
-- =====================================================================

DROP POLICY IF EXISTS users_link_auth ON public.users;

CREATE POLICY users_link_auth ON public.users
  FOR UPDATE
  USING (
    auth_uid IS NULL
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    auth_uid = auth.uid()
    AND roles = (
      SELECT roles FROM public.users
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
