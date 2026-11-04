-- =============================================================================
-- Neue Funktionalität: Abrechnung
--
-- Zahlungsangaben (Adresse + IBAN) für Rückerstattungen. 1:1 zum Konto, nur
-- von der Person selbst les- und schreibbar (auch nicht von Admins). Eine
-- Zeile existiert nur nach aktivem Speichern durch die Person (= Einwilligung).
-- =============================================================================

CREATE TABLE public.user_payment_details (
    user_id uuid DEFAULT auth.uid() NOT NULL,
    street text NOT NULL,
    postal_code text NOT NULL,
    city text NOT NULL,
    iban text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT user_payment_details_pkey PRIMARY KEY (user_id),
    CONSTRAINT user_payment_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT user_payment_details_street_check CHECK (char_length(btrim(street)) BETWEEN 1 AND 100),
    CONSTRAINT user_payment_details_postal_code_check CHECK (char_length(btrim(postal_code)) BETWEEN 1 AND 10),
    CONSTRAINT user_payment_details_city_check CHECK (char_length(btrim(city)) BETWEEN 1 AND 100),
    -- Nur die Form; die Mod-97-Prüfsumme prüft die App
    CONSTRAINT user_payment_details_iban_check CHECK (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$')
);

ALTER TABLE public.user_payment_details ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_user_payment_details_updated_at BEFORE UPDATE ON public.user_payment_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Bewusst ohne is_admin(): Bankdaten sieht nur die Person selbst.
CREATE POLICY "user_payment_details_select" ON public.user_payment_details FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "user_payment_details_insert" ON public.user_payment_details FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "user_payment_details_update" ON public.user_payment_details FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "user_payment_details_delete" ON public.user_payment_details FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Supabase-Default-Privileges geben anon UND authenticated automatisch ALL
-- (inkl. TRUNCATE, das RLS umgeht) — ohne REVOKE wäre das GRANT wirkungslos.
REVOKE ALL ON public.user_payment_details FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_payment_details TO authenticated;
