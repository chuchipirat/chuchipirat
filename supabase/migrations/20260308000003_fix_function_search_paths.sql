-- Fix: SET search_path = public für alle SECURITY DEFINER Funktionen ohne expliziten search_path
--
-- Supabase meldet für jede Funktion ohne SET search_path einen Security-Advisor-Hinweis.
-- Ein bösartiger Benutzer könnte temporäre Objekte in einen anderen Schema-Pfad legen
-- und die Funktion damit auf eigene Objekte umlenken (search_path-Angriff).
--
-- Lösung: CREATE OR REPLACE mit SET search_path = public für alle betroffenen Funktionen.
-- Die Funktionsbodies bleiben identisch zu den ursprünglichen Definitionen.
--
-- Betroffene Funktionen (alle ohne SET search_path):
--   update_updated_at()              – Trigger, kein SECURITY DEFINER
--   update_updated_by()              – Trigger, kein SECURITY DEFINER
--   is_admin()                       – SECURITY DEFINER
--   is_community_leader()            – SECURITY DEFINER
--   increment_logins(TEXT)           – SECURITY DEFINER
--   sync_auth_email()                – SECURITY DEFINER
--   increment_found_bugs(TEXT, INT)  – SECURITY DEFINER
--   update_recipe_no_comments()      – SECURITY DEFINER
--   update_recipe_rating_aggregate() – SECURITY DEFINER
--   is_event_cook(TEXT)              – SECURITY DEFINER (war in 20260308000001 ohne search_path angelegt)

-- =====================================================================
-- Trigger-Funktionen (kein SECURITY DEFINER, aber SET search_path empfohlen)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_by()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_by = (SELECT auth.uid());
  RETURN NEW;
END;
$$;

-- =====================================================================
-- RLS-Hilfsfunktionen (SECURITY DEFINER)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_uid = (SELECT auth.uid()) AND 'admin' = ANY(roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_community_leader()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_uid = (SELECT auth.uid())
      AND ('admin' = ANY(roles) OR 'communityLeader' = ANY(roles))
  );
$$;

-- =====================================================================
-- Benutzer-Operationen (SECURITY DEFINER)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.increment_logins(user_id TEXT)
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.users
  SET no_logins = no_logins + 1
  WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.sync_auth_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.increment_found_bugs(p_user_id TEXT, p_delta INTEGER)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET no_found_bugs = GREATEST(0, no_found_bugs + p_delta)
  WHERE id = p_user_id;
END;
$$;

-- =====================================================================
-- Rezept-Trigger-Funktionen (SECURITY DEFINER)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.update_recipe_no_comments()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.recipes
    SET no_comments = no_comments + 1
    WHERE id = NEW.recipe_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.recipes
    SET no_comments = GREATEST(0, no_comments - 1)
    WHERE id = OLD.recipe_id;
  END IF;
  RETURN NULL;
END;
$$;

-- =====================================================================
-- Event-Hilfsfunktion (SECURITY DEFINER)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_event_cook(p_event_id TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_cooks
    WHERE event_id = p_event_id AND user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.update_recipe_rating_aggregate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_recipe_id TEXT;
BEGIN
  -- Bei DELETE kommt die alte Zeile in OLD, bei INSERT/UPDATE die neue in NEW
  IF TG_OP = 'DELETE' THEN
    target_recipe_id := OLD.recipe_id;
  ELSE
    target_recipe_id := NEW.recipe_id;
  END IF;

  UPDATE public.recipes
  SET
    avg_rating = COALESCE((
      SELECT ROUND(AVG(rating)::NUMERIC, 2)
      FROM public.recipe_ratings
      WHERE recipe_id = target_recipe_id
    ), 0),
    no_ratings = (
      SELECT COUNT(*)
      FROM public.recipe_ratings
      WHERE recipe_id = target_recipe_id
    )
  WHERE id = target_recipe_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
