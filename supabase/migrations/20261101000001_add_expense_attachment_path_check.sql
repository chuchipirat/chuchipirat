-- =============================================================================
-- Neue Funktionalität: Abrechnung
--
-- Der Belegpfad muss zur eigenen Ausgabe gehören. Der Job cron-receipt-retention
-- löscht diese Pfade mit der Service Role; ein manipulierter Pfad könnte sonst
-- fremde Dateien treffen. NOT VALID: Nur neue und geänderte Zeilen werden
-- geprüft, bestehende Zeilen können das Deployment nicht blockieren. Solche
-- Zeilen überspringt der Job und meldet sie.
-- =============================================================================

ALTER TABLE public.event_expenses
ADD CONSTRAINT event_expenses_attachment_path_check CHECK (
    attachment_path IS NULL
    OR attachment_path ~ ('^' || event_id::text || '/expenses/' || id::text || '\.[a-z0-9]{1,5}$')
) NOT VALID;
