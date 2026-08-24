-- =============================================================================
-- Newsletter-Abmeldung: neue Spalte auf public.users
--
-- Ermöglicht Nutzer*innen, sich von künftigen Mail-Konsolen-Versänden
-- (Newsletter) abzumelden — über das eigene Profil, die Admin-Nutzerübersicht
-- oder den Abmelde-Link im Footer der E-Mail (Edge Function
-- unsubscribe-newsletter, ohne Login).
--
-- Keine neue RLS-Policy nötig: die bestehende "users_update"-Policy
-- (id = auth.uid() OR is_admin()) deckt Profil- und Admin-Pfad bereits ab;
-- der Abmelde-Link läuft serverseitig über den Service-Role-Client.
-- =============================================================================

ALTER TABLE public.users
  ADD COLUMN newsletter_opt_out boolean NOT NULL DEFAULT false;
