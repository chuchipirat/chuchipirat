-- Migration: Audit-Spalten umbenennen und auf UUID mit FK umstellen.
-- Betrifft: users, global_settings, system_messages.
-- Renames: created_from → created_by, last_change_at → updated_at, last_changed_from → updated_by
-- Typ-Änderung: created_by/updated_by von TEXT auf UUID mit FK auf auth.users(id).

-- 1. Trigger-Funktionen umbenennen
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_updated_by()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

-- Alte Funktionen aufräumen (werden nicht mehr benötigt)
DROP FUNCTION IF EXISTS update_last_change_at() CASCADE;
DROP FUNCTION IF EXISTS update_last_changed_from() CASCADE;
DROP FUNCTION IF EXISTS set_created_from_if_null() CASCADE;

-- 2. users: Spalte umbenennen + Trigger neu erstellen
ALTER TABLE public.users RENAME COLUMN last_change_at TO updated_at;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. global_settings: Spalten umbenennen, Typ ändern, FK setzen
ALTER TABLE public.global_settings RENAME COLUMN created_from TO created_by;
ALTER TABLE public.global_settings RENAME COLUMN last_change_at TO updated_at;
ALTER TABLE public.global_settings RENAME COLUMN last_changed_from TO updated_by;

ALTER TABLE public.global_settings
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN created_by DROP DEFAULT,
  ALTER COLUMN created_by TYPE UUID USING NULLIF(created_by::text, '')::UUID,
  ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.global_settings
  ALTER COLUMN updated_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP DEFAULT,
  ALTER COLUMN updated_by TYPE UUID USING NULLIF(updated_by::text, '')::UUID,
  ALTER COLUMN updated_by SET DEFAULT auth.uid();

ALTER TABLE public.global_settings
  ADD CONSTRAINT fk_global_settings_created_by
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.global_settings
  ADD CONSTRAINT fk_global_settings_updated_by
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TRIGGER trg_global_settings_updated_at
  BEFORE UPDATE ON public.global_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_global_settings_updated_by
  BEFORE INSERT OR UPDATE ON public.global_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- 4. system_messages: Spalten umbenennen, Typ ändern, FK setzen
ALTER TABLE public.system_messages RENAME COLUMN created_from TO created_by;
ALTER TABLE public.system_messages RENAME COLUMN last_change_at TO updated_at;
ALTER TABLE public.system_messages RENAME COLUMN last_changed_from TO updated_by;

ALTER TABLE public.system_messages
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN created_by DROP DEFAULT,
  ALTER COLUMN created_by TYPE UUID USING NULLIF(created_by::text, '')::UUID,
  ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.system_messages
  ALTER COLUMN updated_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP DEFAULT,
  ALTER COLUMN updated_by TYPE UUID USING NULLIF(updated_by::text, '')::UUID,
  ALTER COLUMN updated_by SET DEFAULT auth.uid();

ALTER TABLE public.system_messages
  ADD CONSTRAINT fk_system_messages_created_by
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.system_messages
  ADD CONSTRAINT fk_system_messages_updated_by
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TRIGGER trg_system_messages_updated_at
  BEFORE UPDATE ON public.system_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_system_messages_updated_by
  BEFORE INSERT OR UPDATE ON public.system_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();
