-- =============================================================================
-- RLS: Admins auf die restlichen Listen-Tabellen des Anlasses zulassen
--
-- Fortsetzung von 20260908000003 (Einkaufslisten): auch
--   - event_material_lists
--   - event_material_list_items
--   - event_used_recipe_lists
-- prüften bisher nur `is_event_cook(...)`, während alle übrigen Event-Tabellen
-- `is_event_cook(event_id) OR is_admin()` erlauben. Damit konnte ein Admin ohne
-- Koch-Rolle diese Listen weder lesen noch bearbeiten.
--
-- Diese Migration ergänzt alle drei Tabellen um `OR is_admin()` auf allen vier
-- Operationen. Die *_items-Policies behalten die EXISTS-Prüfung über die
-- Kopfzeile bei. Die Policy-Namen von event_used_recipe_lists heissen aus
-- historischen Gründen `event_cooks_*` — hier unverändert übernommen.
-- =============================================================================

-- ── event_material_lists ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "material_lists_select" ON public.event_material_lists;
CREATE POLICY "material_lists_select" ON public.event_material_lists FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

DROP POLICY IF EXISTS "material_lists_insert" ON public.event_material_lists;
CREATE POLICY "material_lists_insert" ON public.event_material_lists FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());

DROP POLICY IF EXISTS "material_lists_update" ON public.event_material_lists;
CREATE POLICY "material_lists_update" ON public.event_material_lists FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

DROP POLICY IF EXISTS "material_lists_delete" ON public.event_material_lists;
CREATE POLICY "material_lists_delete" ON public.event_material_lists FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

-- ── event_material_list_items ──────────────────────────────────────────────
DROP POLICY IF EXISTS "material_list_items_select" ON public.event_material_list_items;
CREATE POLICY "material_list_items_select" ON public.event_material_list_items FOR SELECT TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM event_material_lists h
      WHERE h.id = event_material_list_items.list_id
        AND is_event_cook(h.event_id)
    )
  );

DROP POLICY IF EXISTS "material_list_items_insert" ON public.event_material_list_items;
CREATE POLICY "material_list_items_insert" ON public.event_material_list_items FOR INSERT TO authenticated
  WITH CHECK (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM event_material_lists h
      WHERE h.id = event_material_list_items.list_id
        AND is_event_cook(h.event_id)
    )
  );

DROP POLICY IF EXISTS "material_list_items_update" ON public.event_material_list_items;
CREATE POLICY "material_list_items_update" ON public.event_material_list_items FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM event_material_lists h
      WHERE h.id = event_material_list_items.list_id
        AND is_event_cook(h.event_id)
    )
  );

DROP POLICY IF EXISTS "material_list_items_delete" ON public.event_material_list_items;
CREATE POLICY "material_list_items_delete" ON public.event_material_list_items FOR DELETE TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM event_material_lists h
      WHERE h.id = event_material_list_items.list_id
        AND is_event_cook(h.event_id)
    )
  );

-- ── event_used_recipe_lists ────────────────────────────────────────────────
DROP POLICY IF EXISTS "event_cooks_select" ON public.event_used_recipe_lists;
CREATE POLICY "event_cooks_select" ON public.event_used_recipe_lists FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

DROP POLICY IF EXISTS "event_cooks_insert" ON public.event_used_recipe_lists;
CREATE POLICY "event_cooks_insert" ON public.event_used_recipe_lists FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());

DROP POLICY IF EXISTS "event_cooks_update" ON public.event_used_recipe_lists;
CREATE POLICY "event_cooks_update" ON public.event_used_recipe_lists FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

DROP POLICY IF EXISTS "event_cooks_delete" ON public.event_used_recipe_lists;
CREATE POLICY "event_cooks_delete" ON public.event_used_recipe_lists FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
