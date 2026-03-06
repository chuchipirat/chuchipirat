-- Migration: Rezept-Tabellen erstellen
-- Ersetzt die Firestore-Kollektionen recipePublic / recipePrivate / recipeVariant.
-- Alle Rezept-Typen (public, private, variant) landen in einer einzigen Tabelle.
--
-- Tabellenstruktur:
--   recipes                  – Kopfdaten (Metadaten) eines Rezepts
--   recipe_ingredients       – Zutaten-Zeilen und Abschnitts-Trennzeilen, geordnet via sort_order
--   recipe_preparation_steps – Zubereitungsschritte und Abschnitts-Trennzeilen, geordnet via sort_order
--   recipe_materials         – Materialpositionen des Rezepts
--   recipe_ratings           – Bewertungen (1 Zeile pro User pro Rezept)
--   recipe_comments          – Kommentare zu öffentlichen Rezepten

-- ============================================================
-- Enums
-- ============================================================

-- Entspricht RecipeType in recipe.class.ts
CREATE TYPE public.recipe_type AS ENUM ('public', 'private', 'variant');

-- Entspricht MenuType in recipe.class.ts (None=0 nicht gespeichert, leeres Array stattdessen)
CREATE TYPE public.menu_type AS ENUM (
  'main_course',
  'side_dish',
  'appetizer',
  'dessert',
  'breakfast',
  'snack',
  'apero',
  'beverage'
);

-- Entspricht PositionType in recipe.class.ts (ingredient=0, preparationStep=1, section=2)
CREATE TYPE public.recipe_ingredient_pos_type AS ENUM ('ingredient', 'section');

-- Entspricht PositionType in recipe.class.ts für Zubereitungsschritte
CREATE TYPE public.recipe_step_pos_type AS ENUM ('preparation_step', 'section');

-- ============================================================
-- Haupttabelle: recipes
-- ============================================================

CREATE TABLE public.recipes (
  id                     TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid           TEXT,
  name                   TEXT        NOT NULL DEFAULT '',
  portions               INTEGER     NOT NULL DEFAULT 0,
  source                 TEXT        NOT NULL DEFAULT '',
  -- Zeitangaben in Minuten
  time_preparation       INTEGER     NOT NULL DEFAULT 0,
  time_rest              INTEGER     NOT NULL DEFAULT 0,
  time_cooking           INTEGER     NOT NULL DEFAULT 0,
  picture_src            TEXT        NOT NULL DEFAULT '',
  note                   TEXT        NOT NULL DEFAULT '',
  tags                   TEXT[]      NOT NULL DEFAULT '{}',
  menu_types             public.menu_type[] NOT NULL DEFAULT '{}',
  diet                   public.diet_type NOT NULL DEFAULT 'meat',
  allergens              public.allergen_type[] NOT NULL DEFAULT '{}',
  outdoor_kitchen_suitable BOOLEAN   NOT NULL DEFAULT false,
  is_in_review           BOOLEAN     NOT NULL DEFAULT false,
  usable                 BOOLEAN     NOT NULL DEFAULT true,
  -- Aggregatwerte für Bewertung (via Trigger aktuell gehalten)
  avg_rating             NUMERIC(3,2) NOT NULL DEFAULT 0,
  no_ratings             INTEGER      NOT NULL DEFAULT 0,
  recipe_type            public.recipe_type NOT NULL DEFAULT 'public',
  -- Varianten-Felder (nur gefüllt wenn recipe_type = 'variant')
  variant_note           TEXT,
  variant_name           TEXT,
  variant_event_uid      TEXT,
  original_recipe_uid    TEXT,
  original_recipe_type   public.recipe_type,
  original_recipe_creator_uid TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by             UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by             UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- Öffentliche Rezepte sind für alle authentifizierten Benutzer lesbar.
-- Private Rezepte und Varianten nur für den Ersteller.
CREATE POLICY recipes_select ON public.recipes
  FOR SELECT TO authenticated
  USING (
    recipe_type = 'public'
    OR created_by = auth.uid()
  );

-- Jeder authentifizierte Benutzer darf eigene Rezepte anlegen
CREATE POLICY recipes_insert ON public.recipes
  FOR INSERT TO authenticated WITH CHECK (true);

-- Nur der Ersteller oder ein Admin darf ein Rezept ändern
CREATE POLICY recipes_update ON public.recipes
  FOR UPDATE USING (
    created_by = auth.uid() OR is_admin()
  );

-- Nur der Ersteller oder ein Admin darf ein Rezept löschen
CREATE POLICY recipes_delete ON public.recipes
  FOR DELETE USING (
    created_by = auth.uid() OR is_admin()
  );

GRANT SELECT, INSERT ON public.recipes TO authenticated;
GRANT UPDATE, DELETE ON public.recipes TO authenticated;

CREATE INDEX idx_recipes_recipe_type     ON public.recipes (recipe_type);
CREATE INDEX idx_recipes_created_by      ON public.recipes (created_by);
CREATE INDEX idx_recipes_tags            ON public.recipes USING GIN (tags);
CREATE INDEX idx_recipes_menu_types      ON public.recipes USING GIN (menu_types);
CREATE INDEX idx_recipes_allergens       ON public.recipes USING GIN (allergens);

CREATE TRIGGER trg_recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_recipes_updated_by
  BEFORE INSERT OR UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Zutaten und Abschnitt-Trennzeilen: recipe_ingredients
-- ============================================================

CREATE TABLE public.recipe_ingredients (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid      TEXT,
  recipe_id         TEXT        NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  pos_type          public.recipe_ingredient_pos_type NOT NULL DEFAULT 'ingredient',
  -- Felder für pos_type = 'ingredient'
  product_id        TEXT        REFERENCES public.products(id) ON DELETE SET NULL,
  quantity          NUMERIC(12,4) NOT NULL DEFAULT 0,
  unit              TEXT        REFERENCES public.units(key) ON DELETE SET NULL,
  detail            TEXT        NOT NULL DEFAULT '',
  scaling_factor    NUMERIC(8,4) NOT NULL DEFAULT 1,
  -- Felder für pos_type = 'section'
  section_name      TEXT        NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- Sichtbarkeit folgt dem Eltern-Rezept
CREATE POLICY recipe_ingredients_select ON public.recipe_ingredients
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.recipe_type = 'public' OR recipe.created_by = auth.uid())
    )
  );

CREATE POLICY recipe_ingredients_insert ON public.recipe_ingredients
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_admin())
    )
  );

CREATE POLICY recipe_ingredients_update ON public.recipe_ingredients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_admin())
    )
  );

CREATE POLICY recipe_ingredients_delete ON public.recipe_ingredients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_admin())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_ingredients TO authenticated;

CREATE INDEX idx_recipe_ingredients_recipe_id
  ON public.recipe_ingredients (recipe_id, sort_order);

CREATE TRIGGER trg_recipe_ingredients_updated_at
  BEFORE UPDATE ON public.recipe_ingredients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_recipe_ingredients_updated_by
  BEFORE INSERT OR UPDATE ON public.recipe_ingredients
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Zubereitungsschritte und Abschnitt-Trennzeilen: recipe_preparation_steps
-- ============================================================

CREATE TABLE public.recipe_preparation_steps (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid      TEXT,
  recipe_id         TEXT        NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  pos_type          public.recipe_step_pos_type NOT NULL DEFAULT 'preparation_step',
  -- Felder für pos_type = 'preparation_step'
  step              TEXT        NOT NULL DEFAULT '',
  -- Felder für pos_type = 'section'
  section_name      TEXT        NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.recipe_preparation_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY recipe_preparation_steps_select ON public.recipe_preparation_steps
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.recipe_type = 'public' OR recipe.created_by = auth.uid())
    )
  );

CREATE POLICY recipe_preparation_steps_insert ON public.recipe_preparation_steps
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_admin())
    )
  );

CREATE POLICY recipe_preparation_steps_update ON public.recipe_preparation_steps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_admin())
    )
  );

CREATE POLICY recipe_preparation_steps_delete ON public.recipe_preparation_steps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_admin())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_preparation_steps TO authenticated;

CREATE INDEX idx_recipe_preparation_steps_recipe_id
  ON public.recipe_preparation_steps (recipe_id, sort_order);

CREATE TRIGGER trg_recipe_preparation_steps_updated_at
  BEFORE UPDATE ON public.recipe_preparation_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_recipe_preparation_steps_updated_by
  BEFORE INSERT OR UPDATE ON public.recipe_preparation_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Materialpositionen: recipe_materials
-- ============================================================

CREATE TABLE public.recipe_materials (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid      TEXT,
  recipe_id         TEXT        NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  material_id       TEXT        REFERENCES public.materials(id) ON DELETE SET NULL,
  quantity          NUMERIC(12,4) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.recipe_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY recipe_materials_select ON public.recipe_materials
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.recipe_type = 'public' OR recipe.created_by = auth.uid())
    )
  );

CREATE POLICY recipe_materials_insert ON public.recipe_materials
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_admin())
    )
  );

CREATE POLICY recipe_materials_update ON public.recipe_materials
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_admin())
    )
  );

CREATE POLICY recipe_materials_delete ON public.recipe_materials
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id
        AND (recipe.created_by = auth.uid() OR is_admin())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_materials TO authenticated;

CREATE INDEX idx_recipe_materials_recipe_id
  ON public.recipe_materials (recipe_id, sort_order);

CREATE TRIGGER trg_recipe_materials_updated_at
  BEFORE UPDATE ON public.recipe_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_recipe_materials_updated_by
  BEFORE INSERT OR UPDATE ON public.recipe_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Bewertungen: recipe_ratings
-- ============================================================

CREATE TABLE public.recipe_ratings (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  recipe_id         TEXT        NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating            INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Jeder User darf ein Rezept nur einmal bewerten
  UNIQUE (recipe_id, user_id)
);

ALTER TABLE public.recipe_ratings ENABLE ROW LEVEL SECURITY;

-- Jeder Benutzer sieht nur seine eigenen Bewertungen;
-- die Aggregatwerte (avg_rating, no_ratings) stehen im recipes-Kopfdatensatz.
CREATE POLICY recipe_ratings_select ON public.recipe_ratings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- Jeder darf ein öffentliches Rezept bewerten
CREATE POLICY recipe_ratings_insert ON public.recipe_ratings
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id AND recipe.recipe_type = 'public'
    )
  );

-- Nur der Ersteller der Bewertung darf sie ändern
CREATE POLICY recipe_ratings_update ON public.recipe_ratings
  FOR UPDATE USING (user_id = auth.uid());

-- Nur der Ersteller oder ein Admin darf eine Bewertung löschen
CREATE POLICY recipe_ratings_delete ON public.recipe_ratings
  FOR DELETE USING (user_id = auth.uid() OR is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_ratings TO authenticated;

CREATE INDEX idx_recipe_ratings_recipe_id ON public.recipe_ratings (recipe_id);
CREATE INDEX idx_recipe_ratings_user_id   ON public.recipe_ratings (user_id);

CREATE TRIGGER trg_recipe_ratings_updated_at
  BEFORE UPDATE ON public.recipe_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_recipe_ratings_updated_by
  BEFORE INSERT OR UPDATE ON public.recipe_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Trigger: Bewertungs-Aggregat auf recipes aktuell halten
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_recipe_rating_aggregate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_recipe_id TEXT;
BEGIN
  -- Bei DELETE kommt die alte Zeile in OLD, bei INSERT/UPDATE die neue in NEW
  IF TG_OP = 'DELETE' THEN
    target_recipe_id := OLD.recipe_id;
  ELSE
    target_recipe_id := NEW.recipe_id;
  END IF;

  UPDATE public.recipes
  SET
    avg_rating = COALESCE((
      SELECT ROUND(AVG(rating)::NUMERIC, 2)
      FROM public.recipe_ratings
      WHERE recipe_id = target_recipe_id
    ), 0),
    no_ratings = (
      SELECT COUNT(*)
      FROM public.recipe_ratings
      WHERE recipe_id = target_recipe_id
    )
  WHERE id = target_recipe_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recipe_ratings_aggregate
  AFTER INSERT OR UPDATE OR DELETE ON public.recipe_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_recipe_rating_aggregate();

-- ============================================================
-- Kommentare: recipe_comments
-- ============================================================

CREATE TABLE public.recipe_comments (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid      TEXT,
  recipe_id         TEXT        NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  comment           TEXT        NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.recipe_comments ENABLE ROW LEVEL SECURITY;

-- Kommentare nur bei öffentlichen Rezepten sichtbar
CREATE POLICY recipe_comments_select ON public.recipe_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id AND recipe.recipe_type = 'public'
    )
  );

-- Jeder darf Kommentare zu öffentlichen Rezepten hinterlassen
CREATE POLICY recipe_comments_insert ON public.recipe_comments
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes recipe
      WHERE recipe.id = recipe_id AND recipe.recipe_type = 'public'
    )
  );

-- Nur der Ersteller oder ein Admin darf einen Kommentar ändern
CREATE POLICY recipe_comments_update ON public.recipe_comments
  FOR UPDATE USING (created_by = auth.uid() OR is_admin());

-- Nur der Ersteller oder ein Admin darf einen Kommentar löschen
CREATE POLICY recipe_comments_delete ON public.recipe_comments
  FOR DELETE USING (created_by = auth.uid() OR is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_comments TO authenticated;

CREATE INDEX idx_recipe_comments_recipe_id
  ON public.recipe_comments (recipe_id, created_at DESC);

CREATE TRIGGER trg_recipe_comments_updated_at
  BEFORE UPDATE ON public.recipe_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_recipe_comments_updated_by
  BEFORE INSERT OR UPDATE ON public.recipe_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();
