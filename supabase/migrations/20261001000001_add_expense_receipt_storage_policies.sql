-- Neue Migration: 20261001000001_add_expense_receipt_storage_policies.sql

DROP POLICY IF EXISTS "media_expenses_insert" ON storage.objects;
CREATE POLICY "media_expenses_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] = 'expenses'
    AND (storage.foldername(name))[4] IS NOT NULL
    AND is_event_cook((storage.foldername(name))[2])
  );

DROP POLICY IF EXISTS "media_expenses_update" ON storage.objects;
CREATE POLICY "media_expenses_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] = 'expenses'
    AND (storage.foldername(name))[4] IS NOT NULL
    AND is_event_cook((storage.foldername(name))[2])
  );