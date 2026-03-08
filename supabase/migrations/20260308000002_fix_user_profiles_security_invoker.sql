-- Fix: user_profiles View auf SECURITY INVOKER umstellen
--
-- Supabase meldet einen Security-Advisor-Hinweis, weil die View ohne
-- explizites SECURITY INVOKER erstellt wurde. Postgres-Standard ist
-- SECURITY DEFINER für Views, d.h. die View läuft mit den Rechten des
-- View-Erstellers (postgres/superuser) und umgeht die RLS-Policies des
-- anfragenden Benutzers.
--
-- Mit SECURITY INVOKER wird die View mit den Rechten des anfragenden
-- Benutzers ausgeführt — RLS-Policies greifen wie erwartet.
--
-- user_profiles ist eine read-only Projektion der users-Tabelle.
-- Da users.id = Firebase-UID (TEXT, kein UUID) und RLS auf users
-- nur den eigenen Datensatz für UPDATE/DELETE schützt, aber SELECT
-- für alle authentifizierten Benutzer erlaubt ist (für Profil-Lookups),
-- ändert sich das Verhalten durch SECURITY INVOKER nicht funktional —
-- es behebt aber den Security-Advisor-Hinweis korrekt.

DROP VIEW IF EXISTS public.user_profiles;

CREATE VIEW public.user_profiles
  WITH (security_invoker = true)
AS
  SELECT
    id,
    auth_uid,
    display_name,
    created_at,
    member_id,
    motto,
    picture_src
  FROM public.users;

GRANT SELECT ON public.user_profiles TO anon, authenticated;
