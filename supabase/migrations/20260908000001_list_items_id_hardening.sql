-- =============================================================================
-- Härtung der Listen-Diff-RPCs gegen nicht-eindeutige Zeilen-IDs
--
-- Regression: Der Client erzeugte für die „neuer Artikel"-Vorlagenzeile eine
-- aus der Abteilungsposition abgeleitete ID (`tmpl-row-1`, `tmpl-row-22`, …).
-- Diese ist NICHT global eindeutig — zwei Einkaufslisten erzeugen beide
-- `tmpl-row-1` für ihre erste Abteilung. `id` ist aber der globale
-- Primärschlüssel von event_shopping_list_items. Das `INSERT … ON CONFLICT (id)
-- DO UPDATE` in save_shopping_list_items aktualisierte dann die Zeile einer
-- *anderen* Liste (deren `list_id` bleibt unverändert) → der neue Eintrag
-- erschien in keiner Liste.
--
-- Der Client generiert jetzt `crypto.randomUUID()` für Vorlagenzeilen. Diese
-- Migration:
--   1. normalisiert bereits gespeicherte `tmpl-row-%`-IDs auf frische UUIDs
--      (bleiben an ihrer aktuellen `list_id`), damit die alten Kollisions-
--      kandidaten aus der DB verschwinden;
--   2. ergänzt beide RPCs um die Bedingung `t.list_id = p_list_id` im
--      ON-CONFLICT-Zweig: Sollte doch einmal eine ID kollidieren, wird die
--      fremde Zeile NICHT mehr überschrieben (der Upsert ist dann ein No-op
--      statt einer stillen Datenbeschädigung).
--
-- WARTUNG: Spaltenlisten stehen je Funktion 3×. Beim Ändern alle 3 anpassen.
-- =============================================================================

-- ── 1. Bestehende nicht-eindeutige IDs normalisieren ───────────────────────
UPDATE event_shopping_list_items
   SET id = gen_random_uuid()::text
 WHERE id LIKE 'tmpl-row-%';

UPDATE event_material_list_items
   SET id = gen_random_uuid()::text
 WHERE id LIKE 'tmpl-row-%';

-- ── 2. save_shopping_list_items — ON-CONFLICT auf dieselbe Liste beschränken ─
CREATE OR REPLACE FUNCTION public.save_shopping_list_items(
  p_list_id   text,
  p_items     jsonb,
  p_known_ids text[]
) RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
DECLARE
  v_payload_ids text[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_list_id));

  SELECT COALESCE(array_agg(elem ->> 'id'), '{}')
    INTO v_payload_ids
    FROM jsonb_array_elements(p_items) AS elem;

  DELETE FROM event_shopping_list_items t
   WHERE t.list_id = p_list_id
     AND t.id = ANY (p_known_ids)
     AND NOT (t.id = ANY (v_payload_ids));

  INSERT INTO event_shopping_list_items AS t (
    id, list_id, product_id, material_id, department_id, free_text_name,
    quantity, unit, checked, edit_source, sort_order
  )
  SELECT
    elem ->> 'id',
    p_list_id,
    NULLIF(elem ->> 'product_id', ''),
    NULLIF(elem ->> 'material_id', ''),
    NULLIF(elem ->> 'department_id', ''),
    NULLIF(elem ->> 'free_text_name', ''),
    COALESCE((elem ->> 'quantity')::numeric, 0),
    NULLIF(elem ->> 'unit', ''),
    COALESCE((elem ->> 'checked')::boolean, false),
    COALESCE(
      (elem ->> 'edit_source')::public.shopping_list_edit_source,
      'generated'::public.shopping_list_edit_source
    ),
    COALESCE((elem ->> 'sort_order')::integer, 0)
  FROM jsonb_array_elements(p_items) AS elem
  ON CONFLICT (id) DO UPDATE SET
    product_id     = EXCLUDED.product_id,
    material_id    = EXCLUDED.material_id,
    department_id  = EXCLUDED.department_id,
    free_text_name = EXCLUDED.free_text_name,
    quantity       = EXCLUDED.quantity,
    unit           = EXCLUDED.unit,
    checked        = EXCLUDED.checked,
    edit_source    = EXCLUDED.edit_source,
    sort_order     = EXCLUDED.sort_order
  WHERE t.list_id = p_list_id
    AND (
      t.product_id, t.material_id, t.department_id, t.free_text_name,
      t.quantity, t.unit, t.checked, t.edit_source, t.sort_order
    ) IS DISTINCT FROM (
      EXCLUDED.product_id, EXCLUDED.material_id, EXCLUDED.department_id,
      EXCLUDED.free_text_name, EXCLUDED.quantity, EXCLUDED.unit,
      EXCLUDED.checked, EXCLUDED.edit_source, EXCLUDED.sort_order
    );
END;
$$;

REVOKE ALL ON FUNCTION public.save_shopping_list_items(text, jsonb, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_shopping_list_items(text, jsonb, text[]) TO authenticated, service_role;

-- ── 3. save_material_list_items — analog ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_material_list_items(
  p_list_id   text,
  p_items     jsonb,
  p_known_ids text[]
) RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
DECLARE
  v_payload_ids text[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_list_id));

  SELECT COALESCE(array_agg(elem ->> 'id'), '{}')
    INTO v_payload_ids
    FROM jsonb_array_elements(p_items) AS elem;

  DELETE FROM event_material_list_items t
   WHERE t.list_id = p_list_id
     AND t.id = ANY (p_known_ids)
     AND NOT (t.id = ANY (v_payload_ids));

  INSERT INTO event_material_list_items AS t (
    id, list_id, material_id, free_text_name, quantity, checked,
    edit_source, sort_order, assigned_cook_id, assigned_cook_name
  )
  SELECT
    elem ->> 'id',
    p_list_id,
    NULLIF(elem ->> 'material_id', ''),
    NULLIF(elem ->> 'free_text_name', ''),
    COALESCE((elem ->> 'quantity')::numeric, 0),
    COALESCE((elem ->> 'checked')::boolean, false),
    COALESCE(
      (elem ->> 'edit_source')::public.shopping_list_edit_source,
      'generated'::public.shopping_list_edit_source
    ),
    COALESCE((elem ->> 'sort_order')::integer, 0),
    NULLIF(elem ->> 'assigned_cook_id', ''),
    NULLIF(elem ->> 'assigned_cook_name', '')
  FROM jsonb_array_elements(p_items) AS elem
  ON CONFLICT (id) DO UPDATE SET
    material_id        = EXCLUDED.material_id,
    free_text_name     = EXCLUDED.free_text_name,
    quantity           = EXCLUDED.quantity,
    checked            = EXCLUDED.checked,
    edit_source        = EXCLUDED.edit_source,
    sort_order         = EXCLUDED.sort_order,
    assigned_cook_id   = EXCLUDED.assigned_cook_id,
    assigned_cook_name = EXCLUDED.assigned_cook_name
  WHERE t.list_id = p_list_id
    AND (
      t.material_id, t.free_text_name, t.quantity, t.checked,
      t.edit_source, t.sort_order, t.assigned_cook_id, t.assigned_cook_name
    ) IS DISTINCT FROM (
      EXCLUDED.material_id, EXCLUDED.free_text_name, EXCLUDED.quantity,
      EXCLUDED.checked, EXCLUDED.edit_source, EXCLUDED.sort_order,
      EXCLUDED.assigned_cook_id, EXCLUDED.assigned_cook_name
    );
END;
$$;

REVOKE ALL ON FUNCTION public.save_material_list_items(text, jsonb, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_material_list_items(text, jsonb, text[]) TO authenticated, service_role;
