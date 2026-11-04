-- =============================================================================
-- Neue Funktionalität: Abrechnung
--
-- Belege können Namen, Adressen oder Kartenendziffern zeigen und ziehen deshalb
-- aus dem öffentlichen Bucket `media` in den privaten Bucket `receipts`. Zugriff
-- nur über signierte Links. Köch:innen des Anlasses verwalten die Belege, Admins
-- dürfen sie lesen und beim Löschen eines Anlasses mit entfernen.
--
-- `media` geht zurück auf den Stand von 20260719000001: nur Bilder, höchstens
-- 2 MB. Bestehende Dateien bleiben davon unberührt.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts',
    'receipts',
    FALSE,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

UPDATE storage.buckets
SET
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'media';

DROP POLICY IF EXISTS "media_expenses_insert" ON storage.objects;
DROP POLICY IF EXISTS "media_expenses_update" ON storage.objects;

CREATE POLICY "receipts_select" ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] = 'expenses'
    AND (public.is_event_cook((storage.foldername(name))[2]) OR public.is_admin())
);

CREATE POLICY "receipts_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] = 'expenses'
    AND array_length(storage.foldername(name), 1) = 3
    AND public.is_event_cook((storage.foldername(name))[2])
);

CREATE POLICY "receipts_update" ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] = 'expenses'
    AND array_length(storage.foldername(name), 1) = 3
    AND public.is_event_cook((storage.foldername(name))[2])
);

CREATE POLICY "receipts_delete" ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] = 'expenses'
    AND (public.is_event_cook((storage.foldername(name))[2]) OR public.is_admin())
);
