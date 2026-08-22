-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: created_at/created_by für migrierte Produkte und Materialien
--
-- Firebase hat für Produkte und Materialien nie ein Erstellungsdatum
-- getrackt (im Gegensatz zu Rezepten/Events). ProductMigrationJob/
-- MaterialMigrationJob konnten daher keinen Wert setzen, wodurch created_at
-- auf den Spalten-Default (now() = Migrationszeitpunkt) und created_by auf
-- NULL zurückfielen (der service-role Client hat keinen JWT-Kontext für
-- auth.uid()).
--
-- Die einzige verfügbare Quelle für das echte Erstellungsdatum sind die
-- historischen productCreated/materialCreated Feed-Einträge — diese wurden
-- bereits korrekt migriert (FeedMigrationJob löst created_by/created_at
-- sowie source_object_uid → products.id/materials.id bereits richtig auf,
-- siehe FeedMigrationJob.ts). Statt eines eigenen Migrations-Jobs genügt
-- daher ein direkter Backfill aus der bereits migrierten feeds-Tabelle.
--
-- created_by IS NULL als Guard: idempotent (mehrfach ausführbar) und
-- betrifft nur Zeilen, die noch nie einen echten Wert hatten — Produkte/
-- Materialien, die nach der Migration direkt in Supabase angelegt wurden,
-- haben created_by bereits korrekt via auth.uid() gesetzt und werden nicht
-- angetastet.
--
-- Produkte/Materialien ohne zugehörigen (migrierten) Feed-Eintrag bleiben
-- unverändert — für sie gibt es keine andere Quelle für das echte Datum.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.products p
SET created_at = f.created_at,
    created_by = f.created_by
FROM public.feeds f
WHERE f.feed_type = 'productCreated'
  AND f.source_object_uid = p.id
  AND p.created_by IS NULL;

UPDATE public.materials m
SET created_at = f.created_at,
    created_by = f.created_by
FROM public.feeds f
WHERE f.feed_type = 'materialCreated'
  AND f.source_object_uid = m.id
  AND m.created_by IS NULL;
