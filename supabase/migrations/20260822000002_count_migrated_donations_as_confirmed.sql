-- ─────────────────────────────────────────────────────────────────────────────
-- Fix get_donation_goal_stats(): migrierte Spenden (status='migrated', echte
-- historische Spenden aus Firebase) wurden bisher aus dem öffentlichen
-- Spendenziel-Fortschritt ausgeschlossen, da nur status='confirmed' gezählt
-- wurde. Migrierte Spenden sind tatsächlich eingegangene Spenden, nur über
-- einen anderen Kanal als die Live-Zahlungsintegration — sie sollen daher
-- gleich wie bestätigte Spenden gezählt werden.
--
-- Analog dazu wurden clientseitig auch die persönliche Spendenübersicht
-- (userProfile.tsx), die Event-Spenden-Anzeige (DonationRepository.
-- getEventDonations) und die Admin-Statistik-Karten (overviewDonations.tsx)
-- angepasst, migrierte Spenden mitzuzählen.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_donation_goal_stats() RETURNS TABLE(total_cents bigint, donor_count bigint, donation_count bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(SUM(amount_in_cents), 0)::BIGINT AS total_cents,
    COUNT(DISTINCT donor_uid)::BIGINT AS donor_count,
    COUNT(*)::BIGINT AS donation_count
  FROM donations
  WHERE status IN ('confirmed', 'migrated')
    AND EXTRACT(YEAR FROM paid_at) = EXTRACT(YEAR FROM NOW());
$$;
