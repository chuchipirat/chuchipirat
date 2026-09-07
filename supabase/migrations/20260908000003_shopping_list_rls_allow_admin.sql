-- =============================================================================
-- RLS: Admins auf die Einkaufslisten-Tabellen zulassen
--
-- Alle übrigen Event-Tabellen (event_dates, event_menues, event_meals,
-- event_menue_*, event_notes, event_menuplan_* …) erlauben
-- `is_event_cook(event_id) OR is_admin()`. Die Einkaufslisten-Tabellen
-- (`event_shopping_lists`, `event_shopping_list_items`) prüfen dagegen nur
-- `is_event_cook(...)` — ein Admin, der nicht Koch des Anlasses ist, kann die
-- Einkaufsliste weder lesen noch bearbeiten (z.B. für Support).
--
-- Diese Migration ergänzt beide Tabellen um `OR is_admin()` auf allen vier
-- Operationen, analog zu den restlichen Event-Tabellen. Die Item-Policies
-- behalten die bestehende EXISTS-Prüfung über die Kopfzeile bei.
--
-- (Die Materiallisten-Tabellen und event_used_recipe_lists haben dieselbe
--  Lücke — hier bewusst nicht mitgeändert, siehe Aufgabenstellung.)
-- =============================================================================

-- ── event_shopping_lists ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "shopping_lists_select" ON public.event_shopping_lists;
CREATE POLICY "shopping_lists_select" ON public.event_shopping_lists FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

DROP POLICY IF EXISTS "shopping_lists_insert" ON public.event_shopping_lists;
CREATE POLICY "shopping_lists_insert" ON public.event_shopping_lists FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());

DROP POLICY IF EXISTS "shopping_lists_update" ON public.event_shopping_lists;
CREATE POLICY "shopping_lists_update" ON public.event_shopping_lists FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

DROP POLICY IF EXISTS "shopping_lists_delete" ON public.event_shopping_lists;
CREATE POLICY "shopping_lists_delete" ON public.event_shopping_lists FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

-- ── event_shopping_list_items ──────────────────────────────────────────────
DROP POLICY IF EXISTS "shopping_list_items_select" ON public.event_shopping_list_items;
CREATE POLICY "shopping_list_items_select" ON public.event_shopping_list_items FOR SELECT TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM event_shopping_lists h
      WHERE h.id = event_shopping_list_items.list_id
        AND is_event_cook(h.event_id)
    )
  );

DROP POLICY IF EXISTS "shopping_list_items_insert" ON public.event_shopping_list_items;
CREATE POLICY "shopping_list_items_insert" ON public.event_shopping_list_items FOR INSERT TO authenticated
  WITH CHECK (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM event_shopping_lists h
      WHERE h.id = event_shopping_list_items.list_id
        AND is_event_cook(h.event_id)
    )
  );

DROP POLICY IF EXISTS "shopping_list_items_update" ON public.event_shopping_list_items;
CREATE POLICY "shopping_list_items_update" ON public.event_shopping_list_items FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM event_shopping_lists h
      WHERE h.id = event_shopping_list_items.list_id
        AND is_event_cook(h.event_id)
    )
  );

DROP POLICY IF EXISTS "shopping_list_items_delete" ON public.event_shopping_list_items;
CREATE POLICY "shopping_list_items_delete" ON public.event_shopping_list_items FOR DELETE TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM event_shopping_lists h
      WHERE h.id = event_shopping_list_items.list_id
        AND is_event_cook(h.event_id)
    )
  );
