-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: Community Leader sah auf der Admin-Anlassübersicht (overviewEvents.tsx)
-- keine Events. events_select prüfte nur is_admin(), nicht is_community_leader() —
-- obwohl die Anlassübersicht laut system.tsx explizit auch für Community Leader
-- gedacht ist. is_community_leader() deckt Admin bereits mit ab (siehe Definition
-- in 20260401000003_functions.sql), daher genügt der Ersatz von is_admin().
--
-- event_cooks_select und event_dates_select haben denselben Fehler: getAllEventsShort()
-- lädt Events zusammen mit den verschachtelten event_cooks/event_dates via PostgREST-Embed
-- (select("*, event_cooks(user_id), event_dates(...)")). RLS filtert diese Kindtabellen
-- unabhängig — ohne Fix würde ein Community Leader zwar jetzt die Event-Zeilen sehen,
-- aber mit leeren Köche-/Datumsangaben (0 Köche, keine Start-/Enddaten).
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "events_select" ON public.events;
CREATE POLICY "events_select" ON public.events FOR SELECT TO authenticated
  USING (
    is_event_cook(id)
    OR created_by = (( SELECT auth.uid())) AND NOT event_has_cooks(id)
    OR is_community_leader()
  );

DROP POLICY IF EXISTS "event_cooks_select" ON public.event_cooks;
CREATE POLICY "event_cooks_select" ON public.event_cooks FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR user_id = (( SELECT auth.uid())) OR is_community_leader());

DROP POLICY IF EXISTS "event_dates_select" ON public.event_dates;
CREATE POLICY "event_dates_select" ON public.event_dates FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_community_leader());
