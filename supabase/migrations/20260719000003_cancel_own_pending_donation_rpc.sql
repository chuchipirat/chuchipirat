-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: Der Zahlungsanbieter (Zahls.ch) sendet keinen Webhook, wenn ein User den
-- Checkout abbricht, bevor eine Zahlungsmethode versucht wurde — es existiert
-- schlicht keine Transaktion, über die berichtet werden könnte. Spenden blieben
-- dadurch nach einem Abbruch dauerhaft auf 'pending' stehen (DO-004).
--
-- Fix: Die Ergebnis-Seite (/donate/result?status=cancel) kennt die donationId
-- bereits aus der Redirect-URL und ruft diese RPC auf, um die eigene, noch
-- pending Spende explizit auf 'cancelled' zu setzen. Die WHERE-Bedingung
-- (donor_uid = auth.uid() AND status = 'pending') macht das sicher und
-- idempotent: greift nicht bei fremden Spenden und überschreibt nie einen
-- bereits vom Webhook gesetzten Status (z.B. bei einer Race Condition mit
-- einer verspätet eintreffenden 'confirmed'-Bestätigung).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE FUNCTION public.cancel_own_pending_donation(p_donation_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.donations
  SET status = 'cancelled'
  WHERE id = p_donation_id
    AND donor_uid = (SELECT auth.uid())
    AND status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_own_pending_donation(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_own_pending_donation(uuid) FROM PUBLIC, anon;
