-- =============================================================================
-- Neue Funktionalität: Zeitpunkt der letzten inhaltlichen Rezeptänderung
--
-- Die Listen eines Anlasses (Einkaufsliste, Materialliste, geplante Rezepte)
-- warnen, wenn sie älter sind als der Menüplan. Eine Änderung an einem Rezept
-- aus dem Menüplan löste die Warnung bisher nicht aus.
--
-- recipes.updated_at taugt dafür nicht:
--   - Bewertungen und Kommentare schreiben die Zähler in recipes und setzen
--     updated_at damit ebenfalls neu (falsche Warnungen).
--   - Änderungen an Zutaten, Materialien und Zubereitungsschritten ausserhalb
--     des Rezept-Editors (z.B. Produkte zusammenführen) berühren recipes nicht.
--
-- Darum eine eigene Spalte content_updated_at, die nur bei inhaltlichen
-- Änderungen gesetzt wird:
--   - direkt am Rezept, sofern sich nicht nur Bewertung, Kommentare,
--     Review-Status oder Audit-Felder geändert haben;
--   - bei jedem Einfügen, Ändern oder Löschen von Zutaten, Materialien und
--     Zubereitungsschritten.
--
-- Bestehende Rezepte erhalten 1970-01-01. So warnt nach dem Deploy keine
-- Liste fälschlich; Änderungen vor dem Deploy bleiben wie bisher unbemerkt.
-- Der Wert wird über ADD COLUMN gesetzt, nicht per UPDATE, damit dabei keine
-- Trigger laufen und updated_at unverändert bleibt.
-- =============================================================================

ALTER TABLE public.recipes
  ADD COLUMN content_updated_at timestamptz NOT NULL DEFAULT '1970-01-01 00:00:00+00';

ALTER TABLE public.recipes
  ALTER COLUMN content_updated_at SET DEFAULT now();

-- ─────────────────────────────────────────────────────────────────────────────
-- Änderung am Rezept selbst
-- ─────────────────────────────────────────────────────────────────────────────

-- Vergleicht alle Spalten ausser denen, die keine inhaltliche Änderung
-- bedeuten. Neue Spalten zählen damit automatisch als Inhalt.
CREATE FUNCTION public.set_recipe_content_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
AS $$
DECLARE
  non_content_columns CONSTANT text[] := ARRAY[
    'updated_at', 'updated_by', 'content_updated_at',
    'avg_rating', 'no_ratings', 'no_comments',
    'is_in_review', 'usable'
  ];
BEGIN
  IF (to_jsonb(NEW) - non_content_columns)
       IS DISTINCT FROM (to_jsonb(OLD) - non_content_columns) THEN
    NEW.content_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recipes_content_updated_at BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.set_recipe_content_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Änderung an Zutaten, Materialien und Zubereitungsschritten
-- ─────────────────────────────────────────────────────────────────────────────

-- SECURITY DEFINER: Auch wer die Kindzeile ändern darf, aber das Rezept nicht
-- (z.B. Produkte zusammenführen), soll die Änderung sichtbar machen. Die
-- Funktion schreibt ausschliesslich content_updated_at des betroffenen
-- Rezepts. Die Bedingung "< now()" schreibt pro Transaktion nur einmal, weil
-- now() innerhalb einer Transaktion konstant ist.
CREATE FUNCTION public.touch_recipe_content_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  target_recipe_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_recipe_id := OLD.recipe_id;
  ELSE
    target_recipe_id := NEW.recipe_id;
  END IF;

  UPDATE public.recipes
  SET content_updated_at = now()
  WHERE id = target_recipe_id
    AND content_updated_at < now();

  -- Wechselt eine Zeile das Rezept, hat sich auch das bisherige geändert
  IF TG_OP = 'UPDATE' AND OLD.recipe_id IS DISTINCT FROM NEW.recipe_id THEN
    UPDATE public.recipes
    SET content_updated_at = now()
    WHERE id = OLD.recipe_id
      AND content_updated_at < now();
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_recipe_ingredients_content_updated_at
  AFTER INSERT OR UPDATE OR DELETE ON public.recipe_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.touch_recipe_content_updated_at();

CREATE TRIGGER trg_recipe_materials_content_updated_at
  AFTER INSERT OR UPDATE OR DELETE ON public.recipe_materials
  FOR EACH ROW EXECUTE FUNCTION public.touch_recipe_content_updated_at();

CREATE TRIGGER trg_recipe_preparation_steps_content_updated_at
  AFTER INSERT OR UPDATE OR DELETE ON public.recipe_preparation_steps
  FOR EACH ROW EXECUTE FUNCTION public.touch_recipe_content_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Rechte
-- ─────────────────────────────────────────────────────────────────────────────

-- Reine Trigger-Funktionen: Postgres prüft EXECUTE beim Auslösen nicht,
-- direkte Aufrufe über die API braucht niemand.
REVOKE ALL ON FUNCTION public.set_recipe_content_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_recipe_content_updated_at() FROM PUBLIC, anon, authenticated;
