-- =============================================================================
-- Atomares Speichern der Positionen einer Einkaufsliste
--
-- `saveListItems` im Client ersetzte bisher alle Positionen einer Liste per
-- separatem DELETE + INSERT ohne Transaktion und ohne Sperre. Zwei gleichzeitige
-- Saves derselben Liste (schnelle Edits, mehrere Köch:innen, mehrere Tabs)
-- konnten beide ihr DELETE + INSERT ausführen → Positionen vervielfachten sich
-- real in der Tabelle und blieben nach einem Reload bestehen.
--
-- Diese Funktion kapselt DELETE + INSERT in eine Transaktion und serialisiert
-- konkurrierende Aufrufe pro Liste über einen transaktionsgebundenen Advisory
-- Lock. Dadurch sind Duplikate strukturell ausgeschlossen und andere Clients
-- sehen nie den transienten Leerzustand zwischen DELETE und INSERT.
--
-- Läuft bewusst OHNE `SECURITY DEFINER` (wie `save_menuplan`): die bestehenden
-- RLS-Policies auf `event_shopping_list_items` (Prüfung via `is_event_cook`
-- über die zugehörige `event_shopping_lists`-Zeile) greifen automatisch.
-- =============================================================================

CREATE FUNCTION public.save_shopping_list_items(p_list_id text, p_items jsonb)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  -- Konkurrierende Replace-all-Operationen auf derselben Liste serialisieren.
  -- Transaktionsgebunden: wird bei COMMIT/ROLLBACK automatisch freigegeben.
  PERFORM pg_advisory_xact_lock(hashtext(p_list_id));

  DELETE FROM event_shopping_list_items WHERE list_id = p_list_id;

  INSERT INTO event_shopping_list_items
    (list_id, product_id, material_id, department_id, free_text_name,
     quantity, unit, checked, edit_source, sort_order)
  SELECT
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
  FROM jsonb_array_elements(p_items) AS elem;
END;
$$;

REVOKE ALL ON FUNCTION public.save_shopping_list_items(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_shopping_list_items(text, jsonb) TO authenticated, service_role;
