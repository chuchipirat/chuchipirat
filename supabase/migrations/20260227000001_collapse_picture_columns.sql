-- Migration: 3 Bild-Spalten → 1 Spalte picture_src
-- Bisherige Spalten picture_src_small, picture_src_normal, picture_src_full
-- werden durch eine einzige picture_src-Spalte ersetzt. Die Anzeigegrössen
-- werden via Supabase Image Transformation URL-Parameter gesteuert.

-- View zuerst löschen, da sie auf die alten Spalten referenziert
DROP VIEW IF EXISTS public.user_profiles;

-- Neue Spalte hinzufügen
ALTER TABLE public.users ADD COLUMN picture_src TEXT NOT NULL DEFAULT '';

-- Daten aus picture_src_normal übernehmen (war die meistverwendete Grösse)
UPDATE public.users SET picture_src = picture_src_normal WHERE picture_src_normal != '';

-- Alte Spalten entfernen
ALTER TABLE public.users DROP COLUMN picture_src_small;
ALTER TABLE public.users DROP COLUMN picture_src_normal;
ALTER TABLE public.users DROP COLUMN picture_src_full;

-- View mit neuer Spaltenstruktur neu erstellen
CREATE OR REPLACE VIEW public.user_profiles AS
  SELECT
    id,
    auth_uid,
    display_name,
    created_at,
    member_id,
    motto,
    picture_src
  FROM public.users;

GRANT SELECT ON public.user_profiles TO anon, authenticated;
