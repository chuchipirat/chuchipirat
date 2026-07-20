-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: feeds_insert erlaubte nur user_uid = auth.uid() — das bricht jeden Feed-
-- Eintrag, der bewusst eine ANDERE Person credited als die, die die Aktion
-- ausführt (z.B. eine Community Leaderin genehmigt einen Rezept-Publish-Antrag
-- und der Feed-Eintrag soll den Autor als user_uid tragen, nicht die Leaderin;
-- analog beim Hinzufügen eines Kochs zu einem Event). Beide Inserts scheiterten
-- bisher still an dieser Policy (FeedRepository.insertFeed fängt den Fehler nur
-- ab und meldet ihn an Sentry).
--
-- feeds_select ist bereits uneingeschränkt (USING (true)) und feeds_delete
-- bereits auf Community Leaders beschränkt — Feed-Einträge sind eine rein
-- informative Social-Funktion ohne Berechtigungs-Auswirkung. Die Insert-Policy
-- wird daher an den Read-Policy-Umfang angeglichen, statt eine Sonderlogik pro
-- Feed-Typ/Quellobjekt in RLS abzubilden. Testfall FD-031 dokumentierte
-- "feeds_insert TO authenticated" bereits ohne Eigentümer-Einschränkung — dieser
-- Fix bringt das tatsächliche Verhalten in Einklang damit.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "feeds_insert" ON public.feeds;
CREATE POLICY "feeds_insert" ON public.feeds FOR INSERT TO authenticated
  WITH CHECK (true);
