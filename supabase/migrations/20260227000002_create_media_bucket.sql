-- Media-Bucket für Profilbilder (und später Event-Bilder)
-- Öffentlich lesbar, Schreiben nur für authentifizierte User.
-- Max. Dateigrösse: 5 MB, erlaubte MIME-Types: JPEG, PNG, WebP.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('media', 'media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- Lesen: öffentlich (public bucket)
CREATE POLICY media_select_public ON storage.objects
  FOR SELECT
  USING (bucket_id = 'media');

-- Einfügen: authentifizierte User im users/-Ordner
CREATE POLICY media_insert_own ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'users'
  );

-- Aktualisieren: authentifizierte User im users/-Ordner
CREATE POLICY media_update_own ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'users'
  );

-- Löschen: authentifizierte User im users/-Ordner
CREATE POLICY media_delete_own ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'users'
  );
