-- ─────────────────────────────────────────────────────────────────────────────
-- Home-Bereitschafts-Widget: admin-konfigurierbare Mahlzeit-Typ-Cutoff-Zeiten.
--
-- Mahlzeit-Typ-Namen (event_meal_types.name) sind komplett freier Text pro
-- Event, ohne festes Vokabular — verschiedene Events nennen dieselbe Mahlzeit
-- z.B. "Zmorge", "Zmorgen" oder "Frühstück". Um zu entscheiden, ob eine
-- Mahlzeit an einem laufenden Lagertag noch relevant ist, wird ihr Name gegen
-- diese admin-pflegbare Liste von Synonym-Gruppen abgeglichen (clientseitig,
-- case-insensitiv gegen jeden Eintrag in `names`). Namen ohne Treffer gelten
-- immer als noch relevant.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.meal_type_cutoff_times (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    names text[] NOT NULL DEFAULT '{}',
    cutoff_time text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    updated_at timestamptz DEFAULT now() NOT NULL,
    updated_by uuid DEFAULT auth.uid(),
    CONSTRAINT meal_type_cutoff_times_pkey PRIMARY KEY (id),
    CONSTRAINT meal_type_cutoff_times_cutoff_time_check
      CHECK (cutoff_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    CONSTRAINT meal_type_cutoff_times_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT meal_type_cutoff_times_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.meal_type_cutoff_times ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_meal_type_cutoff_times_updated_at BEFORE UPDATE ON public.meal_type_cutoff_times
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_meal_type_cutoff_times_updated_by BEFORE UPDATE ON public.meal_type_cutoff_times
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE POLICY "meal_type_cutoff_times_select" ON public.meal_type_cutoff_times FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "meal_type_cutoff_times_admin_insert" ON public.meal_type_cutoff_times FOR INSERT TO authenticated
  WITH CHECK (is_admin());
CREATE POLICY "meal_type_cutoff_times_admin_update" ON public.meal_type_cutoff_times FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "meal_type_cutoff_times_admin_delete" ON public.meal_type_cutoff_times FOR DELETE TO authenticated
  USING (is_admin());

GRANT ALL ON public.meal_type_cutoff_times TO authenticated;
