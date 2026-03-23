-- =====================================================================
-- Spendenziel-Abschnitte (admin-verwaltbar, N Abschnitte pro Jahr)
-- =====================================================================

CREATE TABLE public.donation_goal_sections (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  label       TEXT NOT NULL,
  target_cents INTEGER NOT NULL CHECK (target_cents > 0),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  year        INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,

  -- Audit-Spalten
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

-- RLS
ALTER TABLE public.donation_goal_sections ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten User können Ziele sehen (für das Widget)
CREATE POLICY goal_sections_select ON public.donation_goal_sections
  FOR SELECT USING (true);

-- Nur Admins dürfen Ziele verwalten
CREATE POLICY goal_sections_admin_write ON public.donation_goal_sections
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

GRANT SELECT ON public.donation_goal_sections TO authenticated;

-- Audit-Trigger
CREATE TRIGGER trg_donation_goal_sections_updated_at BEFORE UPDATE ON public.donation_goal_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_donation_goal_sections_updated_by BEFORE UPDATE ON public.donation_goal_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- Initiale Abschnitte für 2026
INSERT INTO public.donation_goal_sections (label, target_cents, sort_order, year) VALUES
  ('Infrastruktur', 40000, 1, 2026),
  ('Verein', 20000, 2, 2026);
