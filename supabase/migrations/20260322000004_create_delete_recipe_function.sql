-- =====================================================================
-- delete_recipe(p_recipe_id TEXT)
-- =====================================================================
-- Löscht ein Rezept atomar: Sichert den Rezeptnamen in allen
-- event_menue_recipes-Referenzen (deleted_recipe_name), setzt recipe_id
-- auf NULL und löscht anschliessend das Rezept samt Kind-Datensätzen
-- (Zutaten, Schritte, Materialien, Bewertungen, Kommentare — via CASCADE).
--
-- Hintergrund: event_menue_recipes.recipe_id hat ON DELETE RESTRICT,
-- damit der Menuplan den Rezeptnamen auch nach Löschung anzeigen kann.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.delete_recipe(p_recipe_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Rezeptname in Menuplan-Referenzen sichern, bevor das Rezept gelöscht wird
  UPDATE event_menue_recipes
  SET deleted_recipe_name = (SELECT name FROM recipes WHERE id = p_recipe_id),
      recipe_id = NULL
  WHERE recipe_id = p_recipe_id;

  -- Rezept löschen (CASCADE entfernt Zutaten, Schritte, Materialien, Bewertungen, Kommentare)
  DELETE FROM recipes WHERE id = p_recipe_id;
END;
$$;

-- Nur authentifizierte Benutzer dürfen die Funktion aufrufen
GRANT EXECUTE ON FUNCTION public.delete_recipe(TEXT) TO authenticated;
