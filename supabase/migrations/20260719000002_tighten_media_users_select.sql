-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: "media_users_select" erlaubte jedem authentifizierten User SELECT auf
-- ALLE Dateien unter users/ (nicht nur die eigene) — dadurch liess sich über
-- den Storage-List-Endpoint (/storage/v1/object/list/media) die komplette
-- Liste aller User-UIDs mit Profilbild enumerieren (SC-057, Testfall 2).
--
-- Die App braucht diese breite Policy nicht: Profilbilder werden ausschliesslich
-- über getPublicUrl() angezeigt (StorageRepository.ts), was am öffentlichen
-- Bucket (public=true) direkt vorbeigeht und keine RLS-Prüfung durchläuft.
-- Die Policy wird daher auf die eigene Datei eingeschränkt, analog zu den
-- bestehenden INSERT/UPDATE/DELETE-Policies für users/.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "media_users_select" ON storage.objects;
CREATE POLICY "media_users_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'users'
    AND storage.filename(name) = ((SELECT auth.uid())::text || '.jpg')
  );
