-- Trigger-Funktion zum automatischen Sync der E-Mail-Adresse
-- von auth.users nach public.users bei Änderung (z.B. nach E-Mail-Bestätigung).
-- Folgt dem gleichen Muster wie increment_logins: SECURITY DEFINER,
-- damit die Funktion trotz RLS auf public.users schreiben kann.
CREATE OR REPLACE FUNCTION public.sync_auth_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.users
    SET email = NEW.email::text
    WHERE auth_uid = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_auth_email
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_auth_email();
