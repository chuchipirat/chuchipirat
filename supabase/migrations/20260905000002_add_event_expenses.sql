-- =============================================================================
-- Neue Funktionalität: Abrechnung
--
-- Tabelle für die einzelnen Ausgaben eines Anlasses. Jede Ausgabe gehört zu
-- genau einem Budget (event_budgets) und trägt event_id redundant für RLS.
-- payee_type unterscheidet Rückerstattung an bestehende Nutzer:innen, an
-- externe Personen (nur Name) oder keine Rückerstattung nötig.
-- =============================================================================

CREATE TYPE public.expense_payee_type AS ENUM ('existing_user', 'new_person', 'no_refund_needed');

CREATE TABLE public.event_expenses (
  id text DEFAULT gen_random_uuid()::text NOT NULL,
  event_id text NOT NULL,
  budget_id text NOT NULL,
  expense_date date NOT NULL,
  amount_in_cents integer NOT NULL,
  currency text DEFAULT 'CHF'::text NOT NULL,
  label text NOT NULL,
  comment text,
  payee_type public.expense_payee_type NOT NULL,
  payee_user_id uuid,
  payee_name text,
  attachment_path text,
  attachment_original_filename text,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  updated_at timestamptz DEFAULT now() NOT NULL,
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT event_expenses_pkey PRIMARY KEY (id),
  CONSTRAINT event_expenses_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events (id) ON DELETE CASCADE,
  CONSTRAINT event_expenses_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES public.event_budgets (id) ON DELETE RESTRICT,
  CONSTRAINT event_expenses_amount_in_cents_check CHECK (amount_in_cents > 0),
  CONSTRAINT event_expenses_payee_user_id_fkey FOREIGN KEY (payee_user_id) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT chk_expense_payee CHECK (
    (payee_type = 'existing_user' AND payee_user_id IS NOT NULL AND payee_name IS NULL) OR
    (payee_type = 'new_person' AND payee_name IS NOT NULL AND payee_user_id IS NULL) OR
    (payee_type = 'no_refund_needed' AND payee_user_id IS NULL AND payee_name IS NULL)
  ),
  CONSTRAINT event_expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT event_expenses_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

ALTER TABLE public.event_expenses REPLICA IDENTITY FULL;
ALTER TABLE public.event_expenses ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_event_expenses_updated_at BEFORE UPDATE ON public.event_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_event_expenses_updated_by BEFORE UPDATE ON public.event_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_by();

-- Wird eine als payee_user_id referenzierte Person gelöscht, bleibt die Ausgabe
-- erhalten: der Anzeigename wird als Snapshot in payee_name kopiert und der
-- Empfänger-Typ auf 'new_person' umgestellt. Läuft als BEFORE-DELETE-Trigger,
-- also bevor die FK-Aktion (SET NULL) und der Cascade auf public.users greifen.
CREATE FUNCTION public.detach_deleted_expense_payee() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.event_expenses AS expense
  SET payee_name = COALESCE(
        (SELECT NULLIF(TRIM(deleted_user.display_name), '')
           FROM public.users AS deleted_user WHERE deleted_user.id = OLD.id),
        (SELECT deleted_user.email
           FROM public.users AS deleted_user WHERE deleted_user.id = OLD.id),
        'Unbekannt'
      ),
      payee_type = 'new_person',
      payee_user_id = NULL
  WHERE expense.payee_user_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_detach_deleted_expense_payee BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.detach_deleted_expense_payee();

CREATE POLICY "event_expenses_select" ON public.event_expenses FOR SELECT TO authenticated
  USING (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_expenses_insert" ON public.event_expenses FOR INSERT TO authenticated
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_expenses_update" ON public.event_expenses FOR UPDATE TO authenticated
  USING (is_event_cook(event_id) OR is_admin())
  WITH CHECK (is_event_cook(event_id) OR is_admin());
CREATE POLICY "event_expenses_delete" ON public.event_expenses FOR DELETE TO authenticated
  USING (is_event_cook(event_id) OR is_admin());

GRANT ALL ON public.event_expenses TO authenticated;

CREATE INDEX IF NOT EXISTS idx_event_expenses_event ON public.event_expenses USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_event_expenses_budget ON public.event_expenses USING btree (budget_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.event_expenses;
