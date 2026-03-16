/* =====================================================================
   Migration Phase 10: Requests — Anträge & Kommentare
   =====================================================================
   Erstellt die Tabellen, VIEWs, ENUMs und RLS-Policies für das
   Request-System (Rezept-Veröffentlichung, Fehlermeldungen).
   ===================================================================== */

/* =====================================================================
// ENUMs
// ===================================================================== */

CREATE TYPE public.request_status_type AS ENUM (
  'created',
  'inReview',
  'declined',
  'backToAuthor',
  'done'
);

CREATE TYPE public.request_type_enum AS ENUM (
  'recipePublish',
  'reportError'
);

/* =====================================================================
// SEQUENCE für fortlaufende Antragsnummern
// ===================================================================== */

CREATE SEQUENCE public.request_number_seq START WITH 1;

/* =====================================================================
// Tabelle: requests
// ===================================================================== */

CREATE TABLE public.requests (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid      TEXT,
  number            INTEGER     NOT NULL DEFAULT nextval('public.request_number_seq'),
  status            public.request_status_type NOT NULL DEFAULT 'created',
  request_type      public.request_type_enum   NOT NULL,
  author_uid        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignee_uid      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  request_object_uid TEXT       NOT NULL,
  change_log        JSONB       NOT NULL DEFAULT '[]'::JSONB,
  resolve_date      TIMESTAMPTZ,

  -- Audit-Spalten
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.requests IS 'Anträge (Rezept-Veröffentlichung, Fehlermeldungen)';
COMMENT ON COLUMN public.requests.number IS 'Fortlaufende Antragsnummer (via SEQUENCE)';
COMMENT ON COLUMN public.requests.change_log IS 'Statusänderungs-Protokoll als JSONB-Array [{date, userUid, action, newValue}]';
COMMENT ON COLUMN public.requests.request_object_uid IS 'UID des Rezepts, auf das sich der Antrag bezieht';

/* =====================================================================
// Tabelle: request_comments
// ===================================================================== */

CREATE TABLE public.request_comments (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  request_id        TEXT        NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  comment           TEXT        NOT NULL,

  -- Audit-Spalten
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.request_comments IS 'Kommentare zu Anträgen';

/* =====================================================================
// Audit-Trigger
// ===================================================================== */

CREATE TRIGGER trg_requests_updated_at
  BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_requests_updated_by
  BEFORE INSERT OR UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

CREATE TRIGGER trg_request_comments_updated_at
  BEFORE UPDATE ON public.request_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_request_comments_updated_by
  BEFORE INSERT OR UPDATE ON public.request_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

/* =====================================================================
// Indexes
// ===================================================================== */

CREATE INDEX idx_requests_status     ON public.requests(status);
CREATE INDEX idx_requests_author     ON public.requests(author_uid);
CREATE INDEX idx_requests_number     ON public.requests(number);
CREATE INDEX idx_requests_firebase   ON public.requests(firebase_uid);
CREATE INDEX idx_request_comments_request ON public.request_comments(request_id);

/* =====================================================================
// UNIQUE-Constraint auf number
// ===================================================================== */

ALTER TABLE public.requests ADD CONSTRAINT uq_requests_number UNIQUE (number);

/* =====================================================================
// VIEW: requests_view
// Löst Autor-, Assignee- und Rezeptdaten via JOINs auf
// ===================================================================== */

CREATE VIEW public.requests_view
  WITH (security_invoker = true)
AS
SELECT
  r.id,
  r.firebase_uid,
  r.number,
  r.status,
  r.request_type,
  r.author_uid,
  r.assignee_uid,
  r.request_object_uid,
  r.change_log,
  r.resolve_date,
  r.created_at,
  r.created_by,
  r.updated_at,
  r.updated_by,
  -- Autor-Daten
  ua.display_name   AS author_display_name,
  ua.picture_src    AS author_picture_src,
  -- Assignee-Daten
  uas.display_name  AS assignee_display_name,
  uas.picture_src   AS assignee_picture_src,
  -- Rezept-Daten
  rec.name          AS recipe_name,
  rec.picture_src   AS recipe_picture_src
FROM public.requests r
LEFT JOIN public.users ua   ON ua.auth_uid  = r.author_uid
LEFT JOIN public.users uas  ON uas.auth_uid = r.assignee_uid
LEFT JOIN public.recipes rec ON rec.id       = r.request_object_uid;

/* =====================================================================
// VIEW: request_comments_view
// Löst Kommentar-Autor-Daten via JOIN auf
// ===================================================================== */

CREATE VIEW public.request_comments_view
  WITH (security_invoker = true)
AS
SELECT
  rc.id,
  rc.request_id,
  rc.comment,
  rc.created_at,
  rc.created_by,
  rc.updated_at,
  rc.updated_by,
  -- Kommentar-Autor-Daten
  u.display_name  AS user_display_name,
  u.picture_src   AS user_picture_src
FROM public.request_comments rc
LEFT JOIN public.users u ON u.auth_uid = rc.created_by;

/* =====================================================================
// Row Level Security: requests
// ===================================================================== */

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- SELECT: Autor*in sieht eigene Anträge, Community Leader sehen alle
CREATE POLICY requests_select ON public.requests
  FOR SELECT TO authenticated
  USING (
    author_uid = auth.uid()
    OR is_community_leader()
  );

-- INSERT: Nur eigene Anträge erstellen
CREATE POLICY requests_insert ON public.requests
  FOR INSERT TO authenticated
  WITH CHECK (
    author_uid = auth.uid()
  );

-- UPDATE: Autor*in oder Community Leader
CREATE POLICY requests_update ON public.requests
  FOR UPDATE TO authenticated
  USING (
    author_uid = auth.uid()
    OR is_community_leader()
  );

-- Kein DELETE — Anträge werden nie gelöscht (nur Status-Wechsel)
-- Admin-Löschung erfolgt über Service-Role-Client

/* =====================================================================
// Row Level Security: request_comments
// ===================================================================== */

ALTER TABLE public.request_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: Sichtbar wenn der übergeordnete Antrag sichtbar ist
CREATE POLICY request_comments_select ON public.request_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_id
        AND (r.author_uid = auth.uid() OR is_community_leader())
    )
  );

-- INSERT: Kommentar nur wenn der Antrag sichtbar ist
CREATE POLICY request_comments_insert ON public.request_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_id
        AND (r.author_uid = auth.uid() OR is_community_leader())
    )
  );

-- UPDATE: Nur eigene Kommentare bearbeiten
CREATE POLICY request_comments_update ON public.request_comments
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
  );

-- Kein DELETE — Kommentare werden nicht gelöscht

/* =====================================================================
// Berechtigungen
// ===================================================================== */

GRANT SELECT, INSERT, UPDATE ON public.requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.request_comments TO authenticated;
GRANT USAGE ON SEQUENCE public.request_number_seq TO authenticated;
