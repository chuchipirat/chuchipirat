-- Storage-Policies für Event-Bilder im media-Bucket.
-- Event-Bilder werden unter events/{event_id}.jpg gespeichert.
-- Nur Köche des Events dürfen Bilder hochladen/ändern/löschen.
-- Lesen ist via bestehende öffentliche Bucket-Einstellung erlaubt.

-- Bucket-Limit auf 5 MB erhöhen — Event-Bilder sind nach clientseitigem
-- Resize grösser als Profilbilder (die das vorherige 2-MB-Limit definierten).
UPDATE storage.buckets SET file_size_limit = 5242880 WHERE id = 'media';

CREATE POLICY media_events_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'events'
    AND is_event_cook(
      (regexp_match(storage.filename(name), '^([0-9a-f-]+)\.jpg$'))[1]::TEXT
    )
  );

CREATE POLICY media_events_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'events'
    AND is_event_cook(
      (regexp_match(storage.filename(name), '^([0-9a-f-]+)\.jpg$'))[1]::TEXT
    )
  );

CREATE POLICY media_events_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'events'
    AND is_event_cook(
      (regexp_match(storage.filename(name), '^([0-9a-f-]+)\.jpg$'))[1]::TEXT
    )
  );
