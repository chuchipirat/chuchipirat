-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: Der "media"-Bucket hatte weder file_size_limit noch allowed_mime_types
-- gesetzt — beide waren nur in den Sicherheits-Testfällen (SC-020, SC-021)
-- als Annahme dokumentiert, aber nie tatsächlich konfiguriert. Uploads bis zur
-- globalen Storage-Service-Grenze (FILE_SIZE_LIMIT=52428800, 50 MiB) und mit
-- beliebigem MIME-Type wurden akzeptiert.
--
-- file_size_limit: 2097152 Bytes (2 MB) — deutlich über dem, was das
-- client-seitige Resize (max. 1200px, JPEG q=0.85) je produziert, aber eng
-- genug, um Missbrauch als Datei-Hosting via direktem API-Zugriff zu verhindern.
-- allowed_mime_types: nur Bildformate, die die App tatsächlich hochlädt.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE storage.buckets
SET
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'media';
