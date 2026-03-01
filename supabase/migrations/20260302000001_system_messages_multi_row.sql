-- Migration: system_messages von Singleton auf Multi-Row umstellen.
-- Ermöglicht mehrere Systemmeldungen gleichzeitig.

-- Singleton-Constraint entfernen
ALTER TABLE public.system_messages DROP CONSTRAINT single_row;

-- Default-ID auf UUID ändern (als TEXT gespeichert)
ALTER TABLE public.system_messages ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;

-- INSERT-Policy (nur Admins)
CREATE POLICY system_messages_insert ON public.system_messages
  FOR INSERT WITH CHECK (is_admin());

-- DELETE-Policy (nur Admins)
CREATE POLICY system_messages_delete ON public.system_messages
  FOR DELETE USING (is_admin());

-- INSERT/DELETE-Rechte für authentifizierte Benutzer
GRANT INSERT, DELETE ON public.system_messages TO authenticated;
