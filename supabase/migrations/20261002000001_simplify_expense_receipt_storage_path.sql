-- =============================================================================
-- Vereinfacht den Speicherpfad für Ausgaben-Belege: events/<event-uid>/expenses/
-- <expense-uid>.<ext> statt events/<event-uid>/expenses/<expense-uid>/<dateiname>.
-- Jede Ausgabe hat genau einen Beleg (attachment_path ist eine einzelne Spalte,
-- kein Array) — die expense-uid ist bereits global eindeutig, ein zusätzlicher
-- Ordner pro Ausgabe bringt keinen Vorteil, den die expense-uid als Dateiname
-- nicht schon hätte. Ersetzt die Policies aus
-- 20261001000001_add_expense_receipt_storage_policies.sql (jene Migration wird
-- nicht verändert, nur durch diese hier fachlich abgelöst).
-- =============================================================================

DROP POLICY IF EXISTS "media_expenses_insert" ON storage.objects;
CREATE POLICY "media_expenses_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] = 'expenses'
    AND is_event_cook((storage.foldername(name))[2])
  );

DROP POLICY IF EXISTS "media_expenses_update" ON storage.objects;
CREATE POLICY "media_expenses_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] = 'expenses'
    AND is_event_cook((storage.foldername(name))[2])
  );
