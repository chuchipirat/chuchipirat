-- Sicherheits-Update fuer den media-Bucket:
--
-- Problem: Die urspruenglichen Policies (20260227000002) erlauben jedem
-- authentifizierten User, Dateien im Ordner users/ zu schreiben und zu
-- loeschen — auch die Dateien anderer User.
--
-- Loesung: Policies werden auf den exakten Pfad users/{auth.uid()}.jpg
-- eingeschraenkt. Jeder User kann damit ausschliesslich sein eigenes
-- Profilbild schreiben, ersetzen oder loeschen.
--
-- Dateigrösse: Profilbilder werden clientseitig auf max. 1200px skaliert
-- und als JPEG hochgeladen. Ein hochwertiges 1200×1200 JPEG liegt bei
-- 150–500 KB. 2 MB ist ein grosszuegiger, aber realistischer Server-Limit.

-- Bucket-Limit von 5 MB auf 2 MB reduzieren
-- (ausreichend fuer Profilbilder nach clientseitiger Skalierung)
UPDATE storage.buckets
SET file_size_limit = 2097152   -- 2 MB
WHERE id = 'media';

-- Schwache bestehende Write/Delete-Policies entfernen
DROP POLICY IF EXISTS media_insert_own ON storage.objects;
DROP POLICY IF EXISTS media_update_own ON storage.objects;
DROP POLICY IF EXISTS media_delete_own ON storage.objects;

-- Einfuegen: nur eigene Datei unter users/{auth.uid()}.jpg
-- storage.foldername(name)[1] = 'users'    → Ordner-Check
-- storage.filename(name) = uid || '.jpg'   → Dateiname-Check (kein anderer User)
CREATE POLICY media_users_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'users'
    AND storage.filename(name) = auth.uid()::TEXT || '.jpg'
  );

-- Aktualisieren (upsert): nur eigene Datei
CREATE POLICY media_users_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'users'
    AND storage.filename(name) = auth.uid()::TEXT || '.jpg'
  );

-- Loeschen: nur eigene Datei
CREATE POLICY media_users_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'users'
    AND storage.filename(name) = auth.uid()::TEXT || '.jpg'
  );
