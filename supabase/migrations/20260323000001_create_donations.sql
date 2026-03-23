-- =====================================================================
-- Spenden-Tabelle und zugehörige Infrastruktur
-- =====================================================================

-- Status-ENUM für Spenden
CREATE TYPE public.donation_status AS ENUM (
  'pending', 'confirmed', 'failed', 'cancelled', 'refunded', 'migrated'
);

-- Haupttabelle für Spenden
CREATE TABLE public.donations (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  event_id               TEXT REFERENCES public.events(id) ON DELETE SET NULL,

  -- Payrexx-Referenzen
  payrexx_gateway_id     TEXT,
  payrexx_reference_id   TEXT,
  payrexx_transaction_id TEXT,

  -- Zahlungsdaten
  amount_in_cents        INTEGER NOT NULL CHECK (amount_in_cents > 0),
  currency               TEXT NOT NULL DEFAULT 'CHF',
  status                 public.donation_status NOT NULL DEFAULT 'pending',
  payment_method         TEXT,
  paid_at                TIMESTAMPTZ,

  -- Spender-Referenz (JOIN auf users für Name/E-Mail)
  donor_uid              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  donor_message          TEXT CHECK (char_length(donor_message) <= 200),

  -- Quittung
  receipt_number         TEXT UNIQUE,
  receipt_sent_at        TIMESTAMPTZ,

  -- Audit-Spalten
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Audit-Trigger
CREATE TRIGGER trg_donations_updated_at BEFORE UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_donations_updated_by BEFORE UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- Indizes
CREATE INDEX idx_donations_payrexx_ref ON public.donations(payrexx_reference_id);
CREATE INDEX idx_donations_event_id ON public.donations(event_id);
CREATE INDEX idx_donations_donor_uid ON public.donations(donor_uid);
CREATE INDEX idx_donations_status ON public.donations(status);

-- RLS aktivieren
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- Eigene Spenden einfügen (nur pending)
CREATE POLICY donations_insert_own ON public.donations
  FOR INSERT TO authenticated
  WITH CHECK (donor_uid = auth.uid() AND status = 'pending');

-- Eigene Spenden lesen
CREATE POLICY donations_select_own ON public.donations
  FOR SELECT TO authenticated
  USING (donor_uid = auth.uid());

-- Bestätigte Spenden für Event-Köche sichtbar
CREATE POLICY donations_select_event_cooks ON public.donations
  FOR SELECT TO authenticated
  USING (event_id IS NOT NULL AND status = 'confirmed' AND is_event_cook(event_id));

-- Admins sehen alle Spenden
CREATE POLICY donations_select_admin ON public.donations
  FOR SELECT TO authenticated
  USING (is_admin());

-- Quittungsnummer-Sequenz und Generator
CREATE SEQUENCE public.donation_receipt_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_donation_receipt_number()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXTRACT(YEAR FROM NOW())::TEXT || '-' ||
         LPAD(nextval('public.donation_receipt_seq')::TEXT, 4, '0');
$$;
