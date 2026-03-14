-- auth.uid() in RLS-Policies durch (SELECT auth.uid()) ersetzen,
-- damit der Aufruf nur einmal pro Query statt pro Zeile ausgewertet wird.

-- events: select, update, delete
DROP POLICY events_select ON public.events;
CREATE POLICY events_select ON public.events
  FOR SELECT TO authenticated
  USING (
    is_event_cook(id)
    OR (created_by = (SELECT auth.uid()) AND NOT event_has_cooks(id))
    OR is_admin()
  );

DROP POLICY events_update ON public.events;
CREATE POLICY events_update ON public.events
  FOR UPDATE TO authenticated
  USING (
    is_event_cook(id)
    OR (created_by = (SELECT auth.uid()) AND NOT event_has_cooks(id))
    OR is_admin()
  );

DROP POLICY events_delete ON public.events;
CREATE POLICY events_delete ON public.events
  FOR DELETE TO authenticated
  USING (
    is_event_cook(id)
    OR (created_by = (SELECT auth.uid()) AND NOT event_has_cooks(id))
    OR is_admin()
  );

-- events: insert
DROP POLICY events_insert ON public.events;
CREATE POLICY events_insert ON public.events
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- event_cooks: select
DROP POLICY event_cooks_select ON public.event_cooks;
CREATE POLICY event_cooks_select ON public.event_cooks
  FOR SELECT TO authenticated
  USING (
    is_event_cook(event_id)
    OR user_id = (SELECT auth.uid())
    OR is_admin()
  );

-- event_cooks: insert
DROP POLICY event_cooks_insert ON public.event_cooks;
CREATE POLICY event_cooks_insert ON public.event_cooks
  FOR INSERT TO authenticated
  WITH CHECK (
    is_event_cook(event_id)
    OR EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_cooks.event_id
        AND events.created_by = (SELECT auth.uid())
    )
    OR is_community_leader()
    OR is_admin()
  );
