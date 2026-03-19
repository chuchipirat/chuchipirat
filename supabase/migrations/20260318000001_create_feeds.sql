-- =============================================================================
-- Migration Phase 11: Feed-System
-- Erstellt Tabelle, ENUM (feed_type), View, RLS, Trigger und Indizes.
-- Die Sichtbarkeit (visibility) verwendet den gemeinsamen ENUM user_role
-- aus 20260317000002_create_user_role_enum.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENUM: feed_type
-- -----------------------------------------------------------------------------
CREATE TYPE public.feed_type AS ENUM (
  'userCreated',
  'recipePublished',
  'recipeRated',
  'recipeCommented',
  'eventCreated',
  'eventCookAdded',
  'shoppingListCreated',
  'productCreated',
  'materialCreated',
  'profilePictureChanged'
);

-- -----------------------------------------------------------------------------
-- 2. Tabelle: feeds
-- -----------------------------------------------------------------------------
CREATE TABLE public.feeds (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid        TEXT,
  feed_type           public.feed_type NOT NULL,
  visibility          public.user_role NOT NULL DEFAULT 'basic',
  user_uid            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_object_type  TEXT NOT NULL,
  source_object_uid   TEXT NOT NULL,
  source_object_data  JSONB,
  -- Audit-Spalten
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.feeds IS 'Feed-Einträge für die Aktivitätsübersicht auf der Startseite.';

-- -----------------------------------------------------------------------------
-- 3. Trigger: updated_at / updated_by
-- -----------------------------------------------------------------------------
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.feeds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_by
  BEFORE UPDATE ON public.feeds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_by();

-- -----------------------------------------------------------------------------
-- 4. Indizes
-- -----------------------------------------------------------------------------
CREATE INDEX idx_feeds_created_at    ON public.feeds (created_at DESC);
CREATE INDEX idx_feeds_feed_type     ON public.feeds (feed_type);
CREATE INDEX idx_feeds_visibility    ON public.feeds (visibility);
CREATE INDEX idx_feeds_user_uid      ON public.feeds (user_uid);
CREATE INDEX idx_feeds_firebase_uid  ON public.feeds (firebase_uid) WHERE firebase_uid IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. View: feeds_view — löst User- und Quellobjekt-Namen via JOIN auf
-- -----------------------------------------------------------------------------
CREATE VIEW public.feeds_view WITH (security_invoker = true) AS
SELECT
  f.*,
  -- Person im Feed-Eintrag
  u.display_name       AS user_display_name,
  u.picture_src        AS user_picture_src,
  -- Quellobjekt (bedingte JOINs je nach Typ)
  COALESCE(r.name, e.name, p.name, m.name, u2.display_name, '') AS source_object_name,
  COALESCE(r.picture_src, e.picture_src, u2.picture_src, '') AS source_object_picture_src
FROM public.feeds f
LEFT JOIN public.users u    ON u.auth_uid = f.user_uid
LEFT JOIN public.recipes r  ON r.id = f.source_object_uid AND f.source_object_type = 'recipe'
LEFT JOIN public.events e   ON e.id = f.source_object_uid AND f.source_object_type = 'event'
LEFT JOIN public.products p ON p.id = f.source_object_uid AND f.source_object_type = 'product'
LEFT JOIN public.materials m ON m.id = f.source_object_uid AND f.source_object_type = 'material'
LEFT JOIN public.users u2   ON u2.auth_uid::TEXT = f.source_object_uid AND f.source_object_type = 'user';

-- -----------------------------------------------------------------------------
-- 6. RLS aktivieren
-- -----------------------------------------------------------------------------
ALTER TABLE public.feeds ENABLE ROW LEVEL SECURITY;

-- SELECT: Alle authentifizierten User dürfen lesen (Visibility-Filter in der App)
CREATE POLICY feeds_select ON public.feeds
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: Alle authentifizierten User dürfen Feed-Einträge erstellen
CREATE POLICY feeds_insert ON public.feeds
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- DELETE: Nur Community Leaders und Admins
CREATE POLICY feeds_delete ON public.feeds
  FOR DELETE TO authenticated
  USING (is_community_leader());

-- Kein UPDATE — Feed-Einträge werden nur erstellt und gelöscht.

-- -----------------------------------------------------------------------------
-- 7. GRANT
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, DELETE ON public.feeds TO authenticated;
GRANT SELECT ON public.feeds_view TO authenticated;
