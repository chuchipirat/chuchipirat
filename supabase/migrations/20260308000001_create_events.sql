-- Migration Phase 6: Event-Tabellen erstellen
-- Ersetzt die Firestore-Kollektionen events / events/{uid}/docs/groupConfiguration / events/{uid}/docs/menuplan.
--
-- Tabellenstruktur (FK-Abhängigkeitsreihenfolge):
--   events                              – Kopfdaten eines Events
--   event_cooks                         – Koch-Mitglieder eines Events
--   event_dates                         – Zeitscheiben (von–bis) eines Events
--   event_groupconfiguration_diets      – Diätgruppen der Gruppenconfig
--   event_groupconfiguration_intolerances – Unverträglichkeiten der Gruppenconfig
--   event_groupconfiguration_portions   – Portionenmatrix (Diet × Intolerance)
--   event_meal_types                    – Mahlzeitentypen (z.B. "Frühstück", "Mittagessen")
--   event_meals                         – Mahlzeit-Slots (Datum × MealType)
--   event_menues                        – Menü-Container innerhalb einer Mahlzeit
--   event_menue_recipes                 – Rezepte innerhalb eines Menüs
--   event_menue_products                – Produkte innerhalb eines Menüs
--   event_menue_materials               – Materialien innerhalb eines Menüs
--   event_notes                         – Notizen (einem Menü oder Datum zugeordnet)
--   event_menuplan_item_plans           – Plan-Zeilen für Rezepte/Produkte/Materialien

-- ============================================================
-- ENUMs
-- ============================================================

-- Bereich der Plan-Einträge: ALL = alle Portionen, FIX = fixer Wert, group = spezifische Gruppe
CREATE TYPE public.plan_scope_type AS ENUM ('ALL', 'FIX', 'group');

-- Planerstellungs-Modus für Waren: total = Gesamtmenge, per_portion = pro Portion
CREATE TYPE public.plan_mode_type AS ENUM ('total', 'per_portion');

-- ============================================================
-- Tabelle 1: events — Kopfdaten eines Events (zuerst nackt,
-- da RLS erst nach is_event_cook()-Funktion aktiviert werden kann)
-- ============================================================

CREATE TABLE public.events (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid TEXT,
  name        TEXT        NOT NULL DEFAULT '',
  motto       TEXT        NOT NULL DEFAULT '',
  location    TEXT        NOT NULL DEFAULT '',
  picture_src TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================
-- Tabelle 2: event_cooks — Köche / Teammitglieder eines Events
-- (ebenfalls zuerst nackt, da is_event_cook() diese Tabelle referenziert)
-- ============================================================

CREATE TABLE public.event_cooks (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid TEXT,
  event_id     TEXT        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(event_id, user_id)
);

-- ============================================================
-- Hilfsfunktion: is_event_cook()
-- Muss nach event_cooks definiert werden (referenziert die Tabelle),
-- aber vor den RLS-Policies (die sie aufrufen).
-- SECURITY DEFINER vermeidet zirkuläre RLS-Abhängigkeit in event_cooks.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_event_cook(p_event_id TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_cooks
    WHERE event_id = p_event_id AND user_id = auth.uid()
  );
$$;

-- ============================================================
-- RLS, Policies, Grants, Indexes, Trigger für events
-- ============================================================

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events REPLICA IDENTITY FULL;

-- Sichtbarkeit: nur Köche des Events oder Admins
CREATE POLICY events_select ON public.events
  FOR SELECT TO authenticated
  USING (is_event_cook(id) OR is_admin());

-- Jeder authentifizierte User darf ein Event anlegen
CREATE POLICY events_insert ON public.events
  FOR INSERT TO authenticated WITH CHECK (true);

-- Nur Köche oder Admins dürfen ein Event bearbeiten
CREATE POLICY events_update ON public.events
  FOR UPDATE TO authenticated
  USING (is_event_cook(id) OR is_admin());

-- Nur Köche oder Admins dürfen ein Event löschen
CREATE POLICY events_delete ON public.events
  FOR DELETE TO authenticated
  USING (is_event_cook(id) OR is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;

CREATE INDEX idx_events_firebase_uid ON public.events (firebase_uid);
CREATE INDEX idx_events_created_by   ON public.events (created_by);

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_events_updated_by
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- RLS, Policies, Grants, Indexes, Trigger für event_cooks
-- ============================================================

ALTER TABLE public.event_cooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_cooks REPLICA IDENTITY FULL;

CREATE POLICY event_cooks_select ON public.event_cooks
  FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

-- Bootstrap-Regel: der Event-Ersteller darf unmittelbar nach dem Event-INSERT
-- den ersten Koch eintragen, bevor er selbst in event_cooks steht.
CREATE POLICY event_cooks_insert ON public.event_cooks
  FOR INSERT TO authenticated
  WITH CHECK (
    is_event_cook(event_id)
    OR EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id AND created_by = auth.uid()
    )
    OR is_community_leader()
    OR is_admin()
  );

CREATE POLICY event_cooks_update ON public.event_cooks
  FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_cooks_delete ON public.event_cooks
  FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_cooks TO authenticated;

CREATE INDEX idx_event_cooks_event_id ON public.event_cooks (event_id);
CREATE INDEX idx_event_cooks_user_id  ON public.event_cooks (user_id);

CREATE TRIGGER trg_event_cooks_updated_at
  BEFORE UPDATE ON public.event_cooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_event_cooks_updated_by
  BEFORE INSERT OR UPDATE ON public.event_cooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Tabelle 3: event_dates — Zeitscheiben eines Events
-- ============================================================

CREATE TABLE public.event_dates (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid TEXT,
  event_id     TEXT        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  date_from    DATE        NOT NULL,
  date_to      DATE        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (date_from <= date_to)
);

ALTER TABLE public.event_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_dates REPLICA IDENTITY FULL;

CREATE POLICY event_dates_select ON public.event_dates
  FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_dates_insert ON public.event_dates
  FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_dates_update ON public.event_dates
  FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_dates_delete ON public.event_dates
  FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_dates TO authenticated;

CREATE INDEX idx_event_dates_event_id ON public.event_dates (event_id, sort_order);

CREATE TRIGGER trg_event_dates_updated_at
  BEFORE UPDATE ON public.event_dates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_event_dates_updated_by
  BEFORE INSERT OR UPDATE ON public.event_dates
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Tabelle 4: event_groupconfiguration_diets — Diätgruppen
-- ============================================================

CREATE TABLE public.event_groupconfiguration_diets (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid TEXT,
  event_id     TEXT        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL DEFAULT '',
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.event_groupconfiguration_diets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_groupconfiguration_diets REPLICA IDENTITY FULL;

CREATE POLICY event_groupconfiguration_diets_select ON public.event_groupconfiguration_diets
  FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_groupconfiguration_diets_insert ON public.event_groupconfiguration_diets
  FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_groupconfiguration_diets_update ON public.event_groupconfiguration_diets
  FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_groupconfiguration_diets_delete ON public.event_groupconfiguration_diets
  FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_groupconfiguration_diets TO authenticated;

CREATE INDEX idx_event_gc_diets_event_id ON public.event_groupconfiguration_diets (event_id, sort_order);

CREATE TRIGGER trg_event_groupconfiguration_diets_updated_at
  BEFORE UPDATE ON public.event_groupconfiguration_diets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_event_groupconfiguration_diets_updated_by
  BEFORE INSERT OR UPDATE ON public.event_groupconfiguration_diets
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Tabelle 5: event_groupconfiguration_intolerances — Unverträglichkeiten
-- ============================================================

CREATE TABLE public.event_groupconfiguration_intolerances (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid TEXT,
  event_id     TEXT        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL DEFAULT '',
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.event_groupconfiguration_intolerances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_groupconfiguration_intolerances REPLICA IDENTITY FULL;

CREATE POLICY event_groupconfiguration_intolerances_select ON public.event_groupconfiguration_intolerances
  FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_groupconfiguration_intolerances_insert ON public.event_groupconfiguration_intolerances
  FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_groupconfiguration_intolerances_update ON public.event_groupconfiguration_intolerances
  FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_groupconfiguration_intolerances_delete ON public.event_groupconfiguration_intolerances
  FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_groupconfiguration_intolerances TO authenticated;

CREATE INDEX idx_event_gc_intolerances_event_id ON public.event_groupconfiguration_intolerances (event_id, sort_order);

CREATE TRIGGER trg_event_groupconfiguration_intolerances_updated_at
  BEFORE UPDATE ON public.event_groupconfiguration_intolerances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_event_groupconfiguration_intolerances_updated_by
  BEFORE INSERT OR UPDATE ON public.event_groupconfiguration_intolerances
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Tabelle 6: event_groupconfiguration_portions — Portionenmatrix
-- ============================================================

CREATE TABLE public.event_groupconfiguration_portions (
  id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid     TEXT,
  event_id         TEXT        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  diet_id          TEXT        NOT NULL REFERENCES public.event_groupconfiguration_diets(id) ON DELETE CASCADE,
  intolerance_id   TEXT        NOT NULL REFERENCES public.event_groupconfiguration_intolerances(id) ON DELETE CASCADE,
  servings         INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(event_id, diet_id, intolerance_id)
);

ALTER TABLE public.event_groupconfiguration_portions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_groupconfiguration_portions REPLICA IDENTITY FULL;

CREATE POLICY event_groupconfiguration_portions_select ON public.event_groupconfiguration_portions
  FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_groupconfiguration_portions_insert ON public.event_groupconfiguration_portions
  FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_groupconfiguration_portions_update ON public.event_groupconfiguration_portions
  FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_groupconfiguration_portions_delete ON public.event_groupconfiguration_portions
  FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_groupconfiguration_portions TO authenticated;

CREATE INDEX idx_event_gc_portions_event_id ON public.event_groupconfiguration_portions (event_id);
CREATE INDEX idx_event_gc_portions_diet_id  ON public.event_groupconfiguration_portions (diet_id);
CREATE INDEX idx_event_gc_portions_intol_id ON public.event_groupconfiguration_portions (intolerance_id);

CREATE TRIGGER trg_event_groupconfiguration_portions_updated_at
  BEFORE UPDATE ON public.event_groupconfiguration_portions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_event_groupconfiguration_portions_updated_by
  BEFORE INSERT OR UPDATE ON public.event_groupconfiguration_portions
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Tabelle 7: event_meal_types — Mahlzeitentypen
-- ============================================================

CREATE TABLE public.event_meal_types (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid TEXT,
  event_id     TEXT        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL DEFAULT '',
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.event_meal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_meal_types REPLICA IDENTITY FULL;

CREATE POLICY event_meal_types_select ON public.event_meal_types
  FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_meal_types_insert ON public.event_meal_types
  FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_meal_types_update ON public.event_meal_types
  FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_meal_types_delete ON public.event_meal_types
  FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_meal_types TO authenticated;

CREATE INDEX idx_event_meal_types_event_id ON public.event_meal_types (event_id, sort_order);

CREATE TRIGGER trg_event_meal_types_updated_at
  BEFORE UPDATE ON public.event_meal_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_event_meal_types_updated_by
  BEFORE INSERT OR UPDATE ON public.event_meal_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Tabelle 8: event_meals — Mahlzeit-Slots (Datum × MealType)
-- ============================================================

CREATE TABLE public.event_meals (
  id             TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid   TEXT,
  event_id       TEXT        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  meal_date      DATE        NOT NULL,
  meal_type_id   TEXT        NOT NULL REFERENCES public.event_meal_types(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by     UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(event_id, meal_date, meal_type_id)
);

ALTER TABLE public.event_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_meals REPLICA IDENTITY FULL;

CREATE POLICY event_meals_select ON public.event_meals
  FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_meals_insert ON public.event_meals
  FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_meals_update ON public.event_meals
  FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_meals_delete ON public.event_meals
  FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_meals TO authenticated;

CREATE INDEX idx_event_meals_event_id      ON public.event_meals (event_id);
CREATE INDEX idx_event_meals_meal_date     ON public.event_meals (event_id, meal_date);
CREATE INDEX idx_event_meals_meal_type_id  ON public.event_meals (meal_type_id);

CREATE TRIGGER trg_event_meals_updated_at
  BEFORE UPDATE ON public.event_meals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_event_meals_updated_by
  BEFORE INSERT OR UPDATE ON public.event_meals
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Tabelle 9: event_menues — Menü-Container innerhalb einer Mahlzeit
-- ============================================================

CREATE TABLE public.event_menues (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid TEXT,
  event_id     TEXT        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  meal_id      TEXT        NOT NULL REFERENCES public.event_meals(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL DEFAULT '',
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.event_menues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_menues REPLICA IDENTITY FULL;

CREATE POLICY event_menues_select ON public.event_menues
  FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menues_insert ON public.event_menues
  FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menues_update ON public.event_menues
  FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menues_delete ON public.event_menues
  FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_menues TO authenticated;

CREATE INDEX idx_event_menues_event_id ON public.event_menues (event_id);
CREATE INDEX idx_event_menues_meal_id  ON public.event_menues (meal_id, sort_order);

CREATE TRIGGER trg_event_menues_updated_at
  BEFORE UPDATE ON public.event_menues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_event_menues_updated_by
  BEFORE INSERT OR UPDATE ON public.event_menues
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Tabelle 10: event_menue_recipes — Rezepte innerhalb eines Menüs
-- ============================================================
-- recipe_id ist nullable: wird NULL wenn das Rezept gelöscht wird.
-- deleted_recipe_name wird dann von der Edge Function befüllt.

CREATE TABLE public.event_menue_recipes (
  id                   TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid         TEXT,
  event_id             TEXT        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  menue_id             TEXT        NOT NULL REFERENCES public.event_menues(id) ON DELETE CASCADE,
  recipe_id            TEXT        REFERENCES public.recipes(id) ON DELETE RESTRICT,
  -- Wird nur befüllt, wenn das Rezept gelöscht wurde (Edge Function setzt diesen Wert vorher):
  deleted_recipe_name  TEXT,
  variant_name         TEXT,
  -- Gecachte Summe der plan-Zeilen (SUM(servings)), wird via App-Code aktuell gehalten:
  total_portions       INTEGER     NOT NULL DEFAULT 0,
  sort_order           INTEGER     NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by           UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by           UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.event_menue_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_menue_recipes REPLICA IDENTITY FULL;

CREATE POLICY event_menue_recipes_select ON public.event_menue_recipes
  FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menue_recipes_insert ON public.event_menue_recipes
  FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menue_recipes_update ON public.event_menue_recipes
  FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menue_recipes_delete ON public.event_menue_recipes
  FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_menue_recipes TO authenticated;

CREATE INDEX idx_event_menue_recipes_event_id  ON public.event_menue_recipes (event_id);
CREATE INDEX idx_event_menue_recipes_menue_id  ON public.event_menue_recipes (menue_id, sort_order);
CREATE INDEX idx_event_menue_recipes_recipe_id ON public.event_menue_recipes (recipe_id);

CREATE TRIGGER trg_event_menue_recipes_updated_at
  BEFORE UPDATE ON public.event_menue_recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_event_menue_recipes_updated_by
  BEFORE INSERT OR UPDATE ON public.event_menue_recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Tabelle 11: event_menue_products — Produkte innerhalb eines Menüs
-- ============================================================

CREATE TABLE public.event_menue_products (
  id             TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid   TEXT,
  event_id       TEXT          NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  menue_id       TEXT          NOT NULL REFERENCES public.event_menues(id) ON DELETE CASCADE,
  product_id     TEXT          NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity       NUMERIC(12,4) NOT NULL DEFAULT 0,
  unit           TEXT          REFERENCES public.units(key) ON DELETE SET NULL,
  plan_mode      public.plan_mode_type NOT NULL DEFAULT 'total',
  -- Gecachte Gesamtmenge (SUM der plan-Mengen):
  total_quantity NUMERIC(12,4) NOT NULL DEFAULT 0,
  sort_order     INTEGER       NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by     UUID          DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_by     UUID          DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.event_menue_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_menue_products REPLICA IDENTITY FULL;

CREATE POLICY event_menue_products_select ON public.event_menue_products
  FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menue_products_insert ON public.event_menue_products
  FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menue_products_update ON public.event_menue_products
  FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menue_products_delete ON public.event_menue_products
  FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_menue_products TO authenticated;

CREATE INDEX idx_event_menue_products_event_id   ON public.event_menue_products (event_id);
CREATE INDEX idx_event_menue_products_menue_id   ON public.event_menue_products (menue_id, sort_order);
CREATE INDEX idx_event_menue_products_product_id ON public.event_menue_products (product_id);

CREATE TRIGGER trg_event_menue_products_updated_at
  BEFORE UPDATE ON public.event_menue_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_event_menue_products_updated_by
  BEFORE INSERT OR UPDATE ON public.event_menue_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Tabelle 12: event_menue_materials — Materialien innerhalb eines Menüs
-- ============================================================

CREATE TABLE public.event_menue_materials (
  id             TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid   TEXT,
  event_id       TEXT          NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  menue_id       TEXT          NOT NULL REFERENCES public.event_menues(id) ON DELETE CASCADE,
  material_id    TEXT          NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  quantity       NUMERIC(12,4) NOT NULL DEFAULT 0,
  unit           TEXT          REFERENCES public.units(key) ON DELETE SET NULL,
  plan_mode      public.plan_mode_type NOT NULL DEFAULT 'total',
  -- Gecachte Gesamtmenge:
  total_quantity NUMERIC(12,4) NOT NULL DEFAULT 0,
  sort_order     INTEGER       NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by     UUID          DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_by     UUID          DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.event_menue_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_menue_materials REPLICA IDENTITY FULL;

CREATE POLICY event_menue_materials_select ON public.event_menue_materials
  FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menue_materials_insert ON public.event_menue_materials
  FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menue_materials_update ON public.event_menue_materials
  FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menue_materials_delete ON public.event_menue_materials
  FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_menue_materials TO authenticated;

CREATE INDEX idx_event_menue_materials_event_id    ON public.event_menue_materials (event_id);
CREATE INDEX idx_event_menue_materials_menue_id    ON public.event_menue_materials (menue_id, sort_order);
CREATE INDEX idx_event_menue_materials_material_id ON public.event_menue_materials (material_id);

CREATE TRIGGER trg_event_menue_materials_updated_at
  BEFORE UPDATE ON public.event_menue_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_event_menue_materials_updated_by
  BEFORE INSERT OR UPDATE ON public.event_menue_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Tabelle 13: event_notes — Notizen
-- ============================================================

CREATE TABLE public.event_notes (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid TEXT,
  event_id     TEXT        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  menue_id     TEXT        REFERENCES public.event_menues(id) ON DELETE CASCADE,
  note_date    DATE        NOT NULL,
  text         TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.event_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_notes REPLICA IDENTITY FULL;

CREATE POLICY event_notes_select ON public.event_notes
  FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_notes_insert ON public.event_notes
  FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_notes_update ON public.event_notes
  FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_notes_delete ON public.event_notes
  FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_notes TO authenticated;

CREATE INDEX idx_event_notes_event_id  ON public.event_notes (event_id);
CREATE INDEX idx_event_notes_menue_id  ON public.event_notes (menue_id);
CREATE INDEX idx_event_notes_note_date ON public.event_notes (event_id, note_date);

CREATE TRIGGER trg_event_notes_updated_at
  BEFORE UPDATE ON public.event_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_event_notes_updated_by
  BEFORE INSERT OR UPDATE ON public.event_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- ============================================================
-- Tabelle 14: event_menuplan_item_plans — Planzeilen (Einheitstabelle)
-- ============================================================
-- Genau eine der drei FK-Spalten (menue_recipe_id, menue_product_id, menue_material_id)
-- ist NOT NULL — dies wird durch die CHECK-Constraint sichergestellt.

CREATE TABLE public.event_menuplan_item_plans (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  event_id          TEXT        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  -- Genau eine dieser drei FK-Spalten ist NOT NULL:
  menue_recipe_id   TEXT        REFERENCES public.event_menue_recipes(id) ON DELETE CASCADE,
  menue_product_id  TEXT        REFERENCES public.event_menue_products(id) ON DELETE CASCADE,
  menue_material_id TEXT        REFERENCES public.event_menue_materials(id) ON DELETE CASCADE,
  -- Gruppenconfig-Verknüpfung:
  diet_scope        public.plan_scope_type NOT NULL DEFAULT 'ALL',
  diet_id           TEXT        REFERENCES public.event_groupconfiguration_diets(id) ON DELETE CASCADE,
  intolerance_scope public.plan_scope_type NOT NULL DEFAULT 'ALL',
  intolerance_id    TEXT        REFERENCES public.event_groupconfiguration_intolerances(id) ON DELETE CASCADE,
  factor            NUMERIC(10,4) NOT NULL DEFAULT 1,
  servings          INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  -- diet_id muss gesetzt sein, wenn diet_scope = 'group'
  CHECK (diet_scope <> 'group' OR diet_id IS NOT NULL),
  -- intolerance_id muss gesetzt sein, wenn intolerance_scope = 'group'
  CHECK (intolerance_scope <> 'group' OR intolerance_id IS NOT NULL),
  -- Genau eine Item-Referenz muss gesetzt sein:
  CHECK (
    (menue_recipe_id IS NOT NULL)::int +
    (menue_product_id IS NOT NULL)::int +
    (menue_material_id IS NOT NULL)::int = 1
  )
);

ALTER TABLE public.event_menuplan_item_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_menuplan_item_plans REPLICA IDENTITY FULL;

CREATE POLICY event_menuplan_item_plans_select ON public.event_menuplan_item_plans
  FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menuplan_item_plans_insert ON public.event_menuplan_item_plans
  FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menuplan_item_plans_update ON public.event_menuplan_item_plans
  FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

CREATE POLICY event_menuplan_item_plans_delete ON public.event_menuplan_item_plans
  FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_menuplan_item_plans TO authenticated;

CREATE INDEX idx_event_menuplan_plans_event_id       ON public.event_menuplan_item_plans (event_id);
CREATE INDEX idx_event_menuplan_plans_recipe_id      ON public.event_menuplan_item_plans (menue_recipe_id);
CREATE INDEX idx_event_menuplan_plans_product_id     ON public.event_menuplan_item_plans (menue_product_id);
CREATE INDEX idx_event_menuplan_plans_material_id    ON public.event_menuplan_item_plans (menue_material_id);
CREATE INDEX idx_event_menuplan_plans_diet_id        ON public.event_menuplan_item_plans (diet_id);
CREATE INDEX idx_event_menuplan_plans_intolerance_id ON public.event_menuplan_item_plans (intolerance_id);

CREATE TRIGGER trg_event_menuplan_item_plans_updated_at
  BEFORE UPDATE ON public.event_menuplan_item_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_event_menuplan_item_plans_updated_by
  BEFORE INSERT OR UPDATE ON public.event_menuplan_item_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();
