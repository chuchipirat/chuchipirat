-- =====================================================================
-- Migration: no_comments Spalte auf recipes + Trigger + RLS-Fix
--
-- Ergänzt recipes um einen denormalisierten Kommentar-Zähler.
-- Der Trigger aktualisiert den Zähler bei INSERT/DELETE auf recipe_comments.
-- Die DELETE-Policy wird von is_admin() auf is_community_leader() erweitert,
-- damit auch Community Leader fremde Kommentare löschen können.
-- =====================================================================

-- Spalte hinzufügen (idempotent)
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS no_comments INTEGER NOT NULL DEFAULT 0;

-- =====================================================================
-- Trigger-Funktion: Zähler auf recipes aktualisieren
-- SECURITY DEFINER, damit der UPDATE auf recipes immer funktioniert,
-- auch wenn der Aufrufende kein UPDATE-Recht auf recipes hat.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_recipe_no_comments()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.recipes
    SET no_comments = no_comments + 1
    WHERE id = NEW.recipe_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.recipes
    SET no_comments = GREATEST(0, no_comments - 1)
    WHERE id = OLD.recipe_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger anlegen (idempotent: zuerst löschen falls bereits vorhanden)
DROP TRIGGER IF EXISTS trg_recipe_comments_count ON public.recipe_comments;
CREATE TRIGGER trg_recipe_comments_count
  AFTER INSERT OR DELETE ON public.recipe_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_recipe_no_comments();

-- =====================================================================
-- RLS-Fix: Delete-Policy auf recipe_comments
-- War: created_by = auth.uid() OR is_admin()   → nur Admin
-- Neu: created_by = auth.uid() OR is_community_leader() → CL + Admin
-- =====================================================================
DROP POLICY IF EXISTS recipe_comments_delete ON public.recipe_comments;
CREATE POLICY recipe_comments_delete ON public.recipe_comments
  FOR DELETE USING (created_by = auth.uid() OR is_community_leader());
