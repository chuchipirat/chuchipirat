-- Fügt no_found_bugs direkt zur users-Tabelle hinzu.
-- Wird beim Migrations-Job aus stats.noFoundBugs des Firebase-Public-Profils befüllt.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS no_found_bugs INTEGER NOT NULL DEFAULT 0;

-- RPC: atomar erhöhen/verringern, niemals unter 0
CREATE OR REPLACE FUNCTION increment_found_bugs(p_user_id TEXT, p_delta INTEGER)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.users
  SET no_found_bugs = GREATEST(0, no_found_bugs + p_delta)
  WHERE id = p_user_id;
END;
$$;
