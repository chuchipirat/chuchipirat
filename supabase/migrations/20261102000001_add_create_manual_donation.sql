-- =============================================================================
-- Neue Funktionalität: Abrechnung
--
-- Admins erfassen eine Spende von Hand, z.B. eine Banküberweisung oder eine
-- Testspende auf TEST, und verknüpfen sie mit einer Person und optional mit
-- einem ihrer Anlässe. Die Spende ist sofort bestätigt, schaltet damit die
-- Abrechnung frei und bekommt eine Quittungsnummer. Es geht keine Mail raus.
-- Die Zahlungsart beginnt mit `manual_`, damit manuell erfasste Spenden
-- erkennbar bleiben.
--
-- Ausserdem dürfen angemeldete Personen keine Quittungsnummern mehr ziehen:
-- Sie bekamen sonst Lücken. Nur noch diese Funktion und der Webhook
-- (Service Role) erzeugen Nummern.
-- =============================================================================

CREATE FUNCTION public.create_manual_donation(
    p_donor_uid uuid,
    p_event_id text,
    p_amount_in_cents integer,
    p_paid_at timestamptz,
    p_payment_method text,
    p_donor_message text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_donation_id text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Admins dürfen Spenden erfassen.' USING ERRCODE = '42501';
  END IF;

  -- Höchstbetrag fängt Tippfehler ab, die sonst zum Spendenziel zählten
  IF p_amount_in_cents IS NULL OR p_amount_in_cents NOT BETWEEN 500 AND 1000000 THEN
    RAISE EXCEPTION 'Der Betrag muss zwischen CHF 5 und CHF 10''000 liegen.' USING ERRCODE = '22023';
  END IF;

  IF p_paid_at IS NOT NULL
     AND (p_paid_at > NOW() + INTERVAL '1 day' OR p_paid_at < NOW() - INTERVAL '1 year') THEN
    RAISE EXCEPTION 'Das Zahlungsdatum darf nicht in der Zukunft und höchstens ein Jahr zurück liegen.' USING ERRCODE = '22023';
  END IF;

  IF char_length(BTRIM(COALESCE(p_donor_message, ''))) > 200 THEN
    RAISE EXCEPTION 'Die Nachricht darf höchstens 200 Zeichen lang sein.' USING ERRCODE = '22023';
  END IF;

  IF p_payment_method NOT IN ('manual_bank_transfer', 'manual_cash', 'manual_test') THEN
    RAISE EXCEPTION 'Unbekannte Zahlungsart.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_donor_uid) THEN
    RAISE EXCEPTION 'Person nicht gefunden.' USING ERRCODE = '22023';
  END IF;

  -- Nur Anlässe der Person, sonst schaltete eine Spende einen fremden Anlass frei
  IF p_event_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.event_cooks
    WHERE event_id = p_event_id AND user_id = p_donor_uid
  ) THEN
    RAISE EXCEPTION 'Die Person kocht nicht in diesem Anlass.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.donations (
    donor_uid,
    event_id,
    amount_in_cents,
    currency,
    status,
    payment_method,
    paid_at,
    donor_message,
    receipt_number
  ) VALUES (
    p_donor_uid,
    p_event_id,
    p_amount_in_cents,
    'CHF',
    'confirmed',
    p_payment_method,
    COALESCE(p_paid_at, NOW()),
    NULLIF(BTRIM(p_donor_message), ''),
    public.generate_donation_receipt_number()
  )
  RETURNING id INTO new_donation_id;

  RETURN new_donation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_manual_donation(uuid, text, integer, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_manual_donation(uuid, text, integer, timestamptz, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_donation_receipt_number() FROM authenticated;
REVOKE ALL ON SEQUENCE public.donation_receipt_seq FROM anon, authenticated;
