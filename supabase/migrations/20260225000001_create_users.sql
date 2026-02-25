-- Helper: auto-update last_change_at
CREATE OR REPLACE FUNCTION update_last_change_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.last_change_at = NOW(); RETURN NEW; END;
$$;

-- Users table (fully normalized, zero JSONB)
-- id is VARCHAR(20) to match Firebase Auth UIDs (nanoid format).
-- No FK to auth.users — Firebase UIDs are kept as-is for easier migration.
-- RLS policies will be added in Phase 2 (Supabase Auth migration).
CREATE TABLE public.users (
  id VARCHAR(20) PRIMARY KEY,

  -- Private fields (was: users/{uid})
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  roles TEXT[] NOT NULL DEFAULT ARRAY['basic'],
  last_login TIMESTAMPTZ,
  no_logins INTEGER NOT NULL DEFAULT 0,

  -- Public profile fields (was: users/{uid}/public/profile)
  display_name TEXT NOT NULL DEFAULT '',
  member_since TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  member_id INTEGER GENERATED ALWAYS AS IDENTITY,
  motto TEXT NOT NULL DEFAULT '',

  -- Picture (was: pictureSrc JSONB -> 3 flat columns)
  picture_src_small TEXT NOT NULL DEFAULT '',
  picture_src_normal TEXT NOT NULL DEFAULT '',
  picture_src_full TEXT NOT NULL DEFAULT '',

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_change_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Full-text search (replaces searchFields subcollection)
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('german',
      coalesce(display_name, '') || ' ' ||
      coalesce(email, '') || ' ' ||
      coalesce(first_name, '') || ' ' ||
      coalesce(last_name, ''))
  ) STORED
);

-- Indexes
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_roles ON public.users USING GIN(roles);
CREATE INDEX idx_users_search ON public.users USING GIN(search_vector);

-- Auto-update trigger
CREATE TRIGGER trg_users_last_change
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_last_change_at();

-- RLS is NOT enabled yet.
-- auth.uid() requires Supabase Auth, which is Phase 2.
-- During Phase 1, the app connects with the anon key and RLS is off.
-- The following policies are prepared as comments for Phase 2:
--
-- Helper functions (require Supabase Auth):
--
-- CREATE OR REPLACE FUNCTION is_admin()
-- RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
--   SELECT EXISTS (
--     SELECT 1 FROM public.users WHERE id = auth.uid()::VARCHAR(20) AND 'admin' = ANY(roles)
--   );
-- $$;
--
-- CREATE OR REPLACE FUNCTION is_community_leader()
-- RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
--   SELECT EXISTS (
--     SELECT 1 FROM public.users
--     WHERE id = auth.uid()::VARCHAR(20)
--       AND ('admin' = ANY(roles) OR 'communityLeader' = ANY(roles))
--   );
-- $$;
--
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY users_select_own ON public.users
--   FOR SELECT USING (id = auth.uid()::VARCHAR(20));
--
-- CREATE POLICY users_select_leader ON public.users
--   FOR SELECT USING (is_community_leader());
--
-- CREATE POLICY users_insert_self ON public.users
--   FOR INSERT WITH CHECK (id = auth.uid()::VARCHAR(20));
--
-- CREATE POLICY users_insert_admin ON public.users
--   FOR INSERT WITH CHECK (is_admin());
--
-- CREATE POLICY users_update_own ON public.users
--   FOR UPDATE USING (id = auth.uid()::VARCHAR(20))
--   WITH CHECK (id = auth.uid()::VARCHAR(20)
--     AND roles = (SELECT roles FROM public.users WHERE id = auth.uid()::VARCHAR(20)));
--
-- CREATE POLICY users_update_admin ON public.users
--   FOR UPDATE USING (is_admin());

-- Public profile view (readable by all authenticated users)
-- Stats columns will be added to this view later via JOINs once data tables exist
CREATE OR REPLACE VIEW public.user_profiles AS
  SELECT
    id,
    display_name,
    member_since,
    member_id,
    motto,
    picture_src_small,
    picture_src_normal,
    picture_src_full
  FROM public.users;

-- Grant access to the view (Phase 1: all roles; Phase 2: restrict to authenticated)
GRANT SELECT ON public.user_profiles TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
