-- ============================================================
-- Deploy-Check: Admin-RPCs für laufende Lager und letzte Aktivität
--
-- Vor einem Deploy muss der Admin wissen, ob heute ein Lager läuft
-- und ob gerade jemand in der App arbeitet. Beide Funktionen sind
-- read-only und liefern für Nicht-Admins ein leeres Ergebnis.
-- ============================================================

-- ------------------------------------------------------------
-- Laufende Lager: heute liegt in einem event_dates-Zeitfenster
-- ------------------------------------------------------------
CREATE FUNCTION public.admin_get_running_events()
RETURNS TABLE(
  event_id text,
  name text,
  location text,
  date_from date,
  date_to date
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- "Heute" wird explizit in Schweizer Zeit bestimmt, da Sessions in UTC
  -- laufen können und CURRENT_DATE den Tag sonst verschiebt.
  SELECT DISTINCT ON (e.id)
         e.id, e.name, e.location, d.date_from, d.date_to
  FROM public.events e
  JOIN public.event_dates d ON d.event_id = e.id
  WHERE public.is_admin()
    AND (now() AT TIME ZONE 'Europe/Zurich')::date BETWEEN d.date_from AND d.date_to
  ORDER BY e.id, d.date_from;
$$;

-- ------------------------------------------------------------
-- Letzte Aktivität: pro Person, Bereich und Objekt der jüngste Schreibzugriff
-- ------------------------------------------------------------
CREATE FUNCTION public.admin_get_recent_activity(
  p_since_minutes integer DEFAULT 1440
)
RETURNS TABLE(
  user_id uuid,
  user_name text,
  area text,
  object_id text,
  object_name text,
  last_activity_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH params AS (
    -- Zeitfenster begrenzen (1 Minute bis 7 Tage), damit die Abfrage günstig bleibt
    SELECT now() - make_interval(mins => LEAST(GREATEST(p_since_minutes, 1), 10080)) AS since
  ),
  event_activity AS (
    SELECT t.event_id, t.updated_by, t.updated_at
    FROM (
      SELECT id AS event_id, updated_by, updated_at FROM public.events
      UNION ALL SELECT event_id, updated_by, updated_at FROM public.event_cooks
      UNION ALL SELECT event_id, updated_by, updated_at FROM public.event_dates
      UNION ALL SELECT event_id, updated_by, updated_at FROM public.event_groupconfiguration_diets
      UNION ALL SELECT event_id, updated_by, updated_at FROM public.event_groupconfiguration_intolerances
      UNION ALL SELECT event_id, updated_by, updated_at FROM public.event_groupconfiguration_portions
      -- save_menuplan() setzt updated_at hier explizit (Menüplan-Kindtabellen haben keine Audit-Spalten)
      UNION ALL SELECT event_id, updated_by, updated_at FROM public.event_menuplan_tracking
      UNION ALL SELECT event_id, updated_by, updated_at FROM public.event_used_recipe_lists
      UNION ALL SELECT event_id, updated_by, updated_at FROM public.event_shopping_lists
      UNION ALL SELECT event_id, updated_by, updated_at FROM public.event_material_lists
      UNION ALL SELECT l.event_id, i.updated_by, i.updated_at
        FROM public.event_shopping_list_items i
        JOIN public.event_shopping_lists l ON l.id = i.list_id
      UNION ALL SELECT l.event_id, i.updated_by, i.updated_at
        FROM public.event_material_list_items i
        JOIN public.event_material_lists l ON l.id = i.list_id
    ) t, params
    WHERE t.updated_at >= params.since
  ),
  recipe_activity AS (
    SELECT t.recipe_id, t.updated_by, t.updated_at
    FROM (
      SELECT id AS recipe_id, updated_by, updated_at FROM public.recipes
      UNION ALL SELECT recipe_id, updated_by, updated_at FROM public.recipe_ingredients
      UNION ALL SELECT recipe_id, updated_by, updated_at FROM public.recipe_preparation_steps
      UNION ALL SELECT recipe_id, updated_by, updated_at FROM public.recipe_materials
      UNION ALL SELECT recipe_id, updated_by, updated_at FROM public.recipe_comments
      UNION ALL SELECT recipe_id, updated_by, updated_at FROM public.recipe_ratings
    ) t, params
    WHERE t.updated_at >= params.since
  ),
  activity AS (
    SELECT a.updated_by, 'event'::text AS area, a.event_id AS object_id,
           ev.name AS object_name, a.updated_at
    FROM event_activity a
    JOIN public.events ev ON ev.id = a.event_id

    UNION ALL
    SELECT a.updated_by, 'recipe', a.recipe_id, rc.name, a.updated_at
    FROM recipe_activity a
    JOIN public.recipes rc ON rc.id = a.recipe_id

    -- Stammdaten mit sprechendem Namen
    UNION ALL
    SELECT m.updated_by, 'masterdata', m.id, m.name, m.updated_at
    FROM (
      SELECT id, name, updated_by, updated_at FROM public.products
      UNION ALL SELECT id, name, updated_by, updated_at FROM public.materials
      UNION ALL SELECT id, name, updated_by, updated_at FROM public.departments
      UNION ALL SELECT key, name, updated_by, updated_at FROM public.units
    ) m, params
    WHERE m.updated_at >= params.since

    -- Stammdaten ohne eigenen Namen: Anzeige über festen Bezeichner
    UNION ALL
    SELECT m.updated_by, 'masterdata', m.id, m.label, m.updated_at
    FROM (
      SELECT id, 'Synonyme'::text AS label, updated_by, updated_at FROM public.product_synonyms
      UNION ALL SELECT id, 'Einheitenumrechnung', updated_by, updated_at FROM public.unit_conversion_basic
      UNION ALL SELECT id, 'Einheitenumrechnung', updated_by, updated_at FROM public.unit_conversion_products
    ) m, params
    WHERE m.updated_at >= params.since

    UNION ALL
    SELECT r.updated_by, 'request', r.id, 'Anfrage #' || r.number, r.updated_at
    FROM public.requests r, params
    WHERE r.updated_at >= params.since

    UNION ALL
    SELECT c.updated_by, 'request', r.id, 'Anfrage #' || r.number, c.updated_at
    FROM public.request_comments c
    JOIN public.requests r ON r.id = c.request_id, params
    WHERE c.updated_at >= params.since
  )
  SELECT act.updated_by AS user_id,
         -- Ohne Person (Cron, Migration, Systemprozess) erscheint "System"
         COALESCE(
           NULLIF(u.display_name, ''),
           NULLIF(trim(u.first_name || ' ' || u.last_name), ''),
           'System'
         ) AS user_name,
         act.area,
         act.object_id,
         act.object_name,
         MAX(act.updated_at) AS last_activity_at
  FROM activity act
  LEFT JOIN public.users u ON u.id = act.updated_by
  WHERE public.is_admin()
  GROUP BY act.updated_by, user_name, act.area, act.object_id, act.object_name
  ORDER BY last_activity_at DESC;
$$;

-- ------------------------------------------------------------
-- Grants: nur angemeldete Nutzer, Berechtigung prüft is_admin() im Body
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_get_running_events() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_recent_activity(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_running_events() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_recent_activity(integer) TO authenticated;
