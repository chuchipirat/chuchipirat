-- =============================================================================
-- Nebenläufigkeitssichere Diff-Persistenz für Einkaufs- und Materiallisten
--
-- Bisher ersetzte der Client alle Positionen einer Liste per DELETE + Bulk-
-- INSERT (neue UUIDs pro Zeile). Der Hotfix in 20260906000002 kapselte das
-- in eine Transaktion mit Advisory Lock, das Grundmuster blieb aber:
--   - Row-IDs sind nicht stabil → Realtime kann Items nur über den Namen
--     vergleichen; laufende Eingaben gehen bei jedem Fremd-Save verloren
--   - Zwei Köch:innen, die gleichzeitig speichern → letzter Replace gewinnt,
--     Fremdänderungen gehen verloren
--   - jede Mengenänderung erzeugt N×DELETE + N×INSERT WAL-Events
--
-- Diese Migration ersetzt `save_shopping_list_items` durch eine 3-Parameter-
-- Diff-Variante und ergänzt das Pendant `save_material_list_items`:
--
--   p_list_id    Ziel-Liste
--   p_items      gewünschter Voll-Zustand; jedes Element trägt eine stabile,
--                client-generierte `id` (Muster wie save_menuplan)
--   p_known_ids  IDs, die im Basis-Snapshot des Clients vorhanden waren.
--                Nur diese dürfen gelöscht werden. Eine Zeile, die eine andere
--                Köchin seit dem Snapshot angelegt hat, fehlt in p_known_ids
--                und bleibt deshalb erhalten.
--
-- Der Upsert schreibt eine Zeile nur, wenn sich mindestens eine persistierte
-- Spalte ändert (`IS DISTINCT FROM`). Unveränderte Zeilen erzeugen keinen
-- WAL-Record, keinen updated_at/updated_by-Trigger und kein Realtime-Echo.
--
-- Kein SECURITY DEFINER (wie save_menuplan): die bestehenden RLS-Policies auf
-- event_shopping_list_items / event_material_list_items (Prüfung via
-- is_event_cook über die zugehörige Listen-Kopfzeile) greifen automatisch.
--
-- WARTUNG: die persistierten Spalten stehen je Funktion 3× (INSERT-Spaltenliste,
-- SET, IS DISTINCT FROM). Beim Hinzufügen einer Spalte alle 3 Stellen anpassen.
-- =============================================================================

-- Der Hotfix (PR #224, release/2.0.4) kann eine 2-Parameter-Variante angelegt
-- haben. Explizit entfernen, damit nur die 3-Parameter-Signatur existiert.
-- No-op, falls der Hotfix nie auf develop gelandet ist.
DROP FUNCTION IF EXISTS public.save_shopping_list_items(text, jsonb);

-- ── save_shopping_list_items ────────────────────────────────────────────────
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
  -- Konkurrierende Speichervorgänge derselben Liste serialisieren.
  PERFORM pg_advisory_xact_lock(hashtext(p_list_id));

  SELECT COALESCE(array_agg(elem ->> 'id'), '{}')
    INTO v_payload_ids
    FROM jsonb_array_elements(p_items) AS elem;

  -- Nur weglassen, was der Client kannte und intentional entfernt hat.
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
  WHERE (
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

-- ── save_material_list_items ───────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.save_material_list_items(text, jsonb);

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
  WHERE (
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
