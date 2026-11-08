-- =============================================================================
-- Neue Funktionalität: Grenzen für das Anlegen-Protokoll (item_creation_logs)
--
-- Alle Angemeldeten dürfen einfügen, löschen kann niemand ausser service_role.
-- Ohne Grenzen liesse sich die Tabelle per direktem API-Aufruf mit beliebig
-- grossen Zeilen füllen, die bis zum Aufräum-Job liegen bleiben. Die App
-- bleibt weit unter diesen Werten (Namen werden vor dem Schreiben gekürzt).
--
--   - final_name und result_name: wie entered_name 1–200 Zeichen, sonst NULL.
--   - hints: höchstens 50 Hinweise und 100 kB. Pro Vorgang zeigt der Dialog
--     wenige Hinweise; 100 kB fassen rund tausend Vorschläge.
--   - Ergebnis: höchstens eines von Produkt und Material. Der Typ des
--     Ergebnisses ist bewusst nicht an item_type gebunden, weil der
--     Produkt-Dialog künftig auch ein Material vorschlagen kann.
-- =============================================================================

ALTER TABLE public.item_creation_logs
  ADD CONSTRAINT item_creation_logs_final_name_check
    CHECK (final_name IS NULL OR LENGTH(trim(final_name)) BETWEEN 1 AND 200),
  ADD CONSTRAINT item_creation_logs_result_name_check
    CHECK (result_name IS NULL OR LENGTH(trim(result_name)) BETWEEN 1 AND 200),
  -- jsonb_array_length wirft bei Nicht-Arrays; die Art prüft schon
  -- item_creation_logs_hints_check, darum hier vorher absichern.
  ADD CONSTRAINT item_creation_logs_hints_size_check
    CHECK (
      OCTET_LENGTH(hints::text) <= 100000
      AND (jsonb_typeof(hints) <> 'array' OR jsonb_array_length(hints) <= 50)
    ),
  ADD CONSTRAINT item_creation_logs_single_result_check
    CHECK (num_nonnulls(result_product_id, result_material_id) <= 1);
