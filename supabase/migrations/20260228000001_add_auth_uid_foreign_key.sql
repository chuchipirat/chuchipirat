-- Foreign Key auf auth.users für referenzielle Integrität.
-- NULL-Werte sind weiterhin erlaubt (Firebase-only User ohne Supabase-Account).
-- ON DELETE SET NULL: Wird ein Auth-Account gelöscht, bleibt der User-Datensatz
-- erhalten, verliert aber die Verknüpfung.

ALTER TABLE public.users
  ADD CONSTRAINT fk_users_auth_uid
  FOREIGN KEY (auth_uid) REFERENCES auth.users(id)
  ON DELETE SET NULL;
