-- =====================================================================
-- FK-Constraints für Varianten-Felder in recipes
-- =====================================================================
-- Die Spalten variant_event_uid und original_recipe_uid wurden in
-- Phase 5 ohne FKs angelegt, weil die events-Tabelle damals noch
-- nicht existierte. Jetzt, da alle Tabellen vorhanden sind, werden
-- die FKs nachgezogen.
--
-- original_recipe_creator_uid (TEXT) speichert die Auth-UUID, kann
-- aber auch leer sein. Ein FK zu auth.users(id) (UUID) wäre wegen
-- des Typ-Unterschieds nicht möglich ohne Column-Typ-Änderung —
-- wird als Post-Migration-Task nachgezogen.
--
-- variant_event_uid → ON DELETE CASCADE: Varianten-Rezepte gehören zum
-- Event und haben ohne es keinen Zweck.
-- original_recipe_uid → ON DELETE SET NULL: Das Original-Rezept kann
-- unabhängig gelöscht werden; die Variante bleibt erhalten.
-- =====================================================================

ALTER TABLE public.recipes
  ADD CONSTRAINT fk_recipes_variant_event
    FOREIGN KEY (variant_event_uid)
    REFERENCES public.events(id)
    ON DELETE CASCADE;

ALTER TABLE public.recipes
  ADD CONSTRAINT fk_recipes_original_recipe
    FOREIGN KEY (original_recipe_uid)
    REFERENCES public.recipes(id)
    ON DELETE SET NULL;
