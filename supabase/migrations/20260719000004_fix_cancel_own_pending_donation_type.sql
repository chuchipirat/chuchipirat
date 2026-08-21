-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: cancel_own_pending_donation(uuid) verglich "id = p_donation_id" — id ist
-- aber text (siehe donations.id: `text DEFAULT (gen_random_uuid())::text`),
-- nicht uuid. Postgres kennt keinen impliziten text = uuid Operator, daher
-- schlug jeder Aufruf mit 42883 ("operator does not exist: text = uuid") fehl.
-- Parameter-Typ auf text korrigiert, um zu donations.id zu passen.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.cancel_own_pending_donation(uuid);

CREATE FUNCTION public.cancel_own_pending_donation(p_donation_id text) RETURNS void
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

GRANT EXECUTE ON FUNCTION public.cancel_own_pending_donation(text) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_own_pending_donation(text) FROM PUBLIC, anon;
