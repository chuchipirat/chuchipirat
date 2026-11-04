-- =============================================================================
-- Neue Funktionalität: Abrechnung
--
-- Tabelle für die Budgets eines Anlasses. Pro Event können mehrere benannte
-- Budgets existieren, entweder als Fixbetrag oder als Betrag pro Person und Tag.
-- =============================================================================

CREATE TYPE public.budget_type AS ENUM ('fixed_amount', 'per_person_per_day');

CREATE TABLE public.event_budgets (
  id text DEFAULT gen_random_uuid()::text NOT NULL,
  event_id text NOT NULL,
  name text NOT NULL,
  budget_type public.budget_type DEFAULT 'fixed_amount'::public.budget_type NOT NULL,
  amount_in_cents integer,
  currency text DEFAULT 'CHF'::text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now() NOT NULL,
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT event_budgets_pkey PRIMARY KEY (id),
  CONSTRAINT event_budgets_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events (id) ON DELETE CASCADE,
  CONSTRAINT event_budgets_amount_in_cents_check CHECK (amount_in_cents > 0),
  CONSTRAINT event_budgets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT event_budgets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

ALTER TABLE public.event_budgets REPLICA IDENTITY FULL;
ALTER TABLE public.event_budgets ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_event_budgets_updated_at BEFORE UPDATE ON public.event_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_event_budgets_updated_by BEFORE UPDATE ON public.event_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

CREATE POLICY "event_budgets_select" ON public.event_budgets FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_budgets_insert" ON public.event_budgets FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_budgets_update" ON public.event_budgets FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin())
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_budgets_delete" ON public.event_budgets FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

GRANT ALL ON public.event_budgets TO authenticated;

CREATE INDEX IF NOT EXISTS idx_event_budgets_event ON public.event_budgets USING btree (event_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.event_budgets;
