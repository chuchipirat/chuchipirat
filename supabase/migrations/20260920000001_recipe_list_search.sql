-- ============================================================
-- Rezeptliste: Paging, Filter und Suche in der Datenbank
--
-- Die Rezeptseite und die Rezept-Schublade im Menüplan luden bisher alle
-- Rezepte auf einmal und filterten im Browser. Diese Migration liefert
-- den Baustein für «erste Seite laden, beim Scrollen nachladen»:
--
-- 1. unaccent + zwei IMMUTABLE-Hilfsfunktionen für eine Suche ohne
--    Akzente und ohne Gross-/Kleinschreibung («hornli» findet «Hörnli»).
-- 2. Ein Trigram-Index auf dem Suchtext (Name, Variantenname, Tags),
--    also genau den Feldern, die die Suche bisher im Browser prüfte.
-- 3. Die RPC list_recipe_shorts(): Sichtbarkeit, Filter, Suche und
--    Keyset-Paging in einem Aufruf.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Suche ohne Akzente
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- unaccent() ist nur STABLE. Ein Index-Ausdruck braucht IMMUTABLE, deshalb
-- der übliche Wrapper mit explizitem Wörterbuch (Ergebnis hängt nur von der
-- Eingabe ab, nicht von search_path oder Konfiguration).
CREATE FUNCTION public.immutable_unaccent(input text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    SET search_path TO ''
AS $$
  SELECT extensions.unaccent('extensions.unaccent'::regdictionary, input);
$$;

-- Suchtext eines Rezepts: Name, Variantenname und Tags, klein und ohne
-- Akzente. Wird für den Index und für die Abfrage verwendet (identischer
-- Ausdruck, sonst nutzt der Planer den Index nicht).
CREATE FUNCTION public.recipe_search_text(
  p_name text,
  p_variant_name text,
  p_tags text[]
) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO ''
AS $$
  SELECT lower(public.immutable_unaccent(
    p_name || ' ' || COALESCE(p_variant_name, '') || ' ' || COALESCE(array_to_string(p_tags, ' '), '')
  ));
$$;

-- ------------------------------------------------------------
-- 2. Indizes
-- ------------------------------------------------------------
CREATE INDEX idx_recipes_search_trgm ON public.recipes
  USING gin (public.recipe_search_text(name, variant_name, tags) extensions.gin_trgm_ops);

CREATE INDEX idx_recipes_name_id ON public.recipes (name, id);

-- ------------------------------------------------------------
-- 3. Rezeptliste (Kurzform) seitenweise
--
-- SECURITY DEFINER mit fest eingebauter Sichtbarkeit: öffentliche Rezepte,
-- eigene private Rezepte und (nur mit p_event_id) die Varianten dieses
-- Anlasses, sofern die Person Koch/Köchin des Anlasses ist (oder
-- Community-Leader/Admin bzw. Ersteller:in der Variante, wie in der RLS).
-- Die Nutzer-ID kommt immer aus auth.uid(), nie aus einem Parameter.
--
-- Warum nicht SECURITY INVOKER (RLS aktiv)? Gemessen mit 15'000 Rezepten:
-- Die RLS-Regel von recipes enthält Funktionsaufrufe (is_event_cook,
-- is_community_leader), die nicht leakproof sind. Der Planer darf die
-- Suchbedingung (LIKE) dann nicht vor diese Regel ziehen und liest die
-- ganze Tabelle (173 ms statt 5 ms, der Trigram-Index bleibt ungenutzt).
-- Die RLS erlaubt ausserdem allen Nutzer:innen fremde private Rezepte und
-- Community-Leadern alles; die Liste soll aber nur Eigenes zeigen, die
-- explizite Sichtbarkeit ist hier also ohnehin nötig.
--
-- Sortierung name, id (Namen sind nicht eindeutig: Varianten heissen wie
-- das Original), Paging per Keyset. Geliefert werden p_limit + 1 Zeilen,
-- der Client erkennt daran, ob es weitere Seiten gibt. total_count steht
-- nur auf der ersten Seite (p_after_name IS NULL).
--
-- plan_cache_mode = force_custom_plan: Die Abfrage wird pro Aufruf mit den
-- echten Parameterwerten geplant. Nur so fallen die Bedingungen
-- «(p IS NULL OR ...)» weg und der Trigram-Index wird genutzt.
-- ------------------------------------------------------------
CREATE FUNCTION public.list_recipe_shorts(
  p_search text DEFAULT NULL,
  p_diet public.diet_type DEFAULT NULL,
  p_exclude_allergens public.allergen_type[] DEFAULT NULL,
  p_menu_types public.menu_type[] DEFAULT NULL,
  p_outdoor boolean DEFAULT NULL,
  p_scope text DEFAULT 'all',
  p_only_mine boolean DEFAULT NULL,
  p_event_id text DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_after_name text DEFAULT NULL,
  p_after_id text DEFAULT NULL
) RETURNS TABLE(
  id text,
  name text,
  source text,
  picture_src text,
  tags text[],
  menu_types public.menu_type[],
  diet public.diet_type,
  allergens public.allergen_type[],
  outdoor_kitchen_suitable boolean,
  avg_rating numeric,
  no_ratings integer,
  no_comments integer,
  recipe_type public.recipe_type,
  variant_name text,
  created_at timestamptz,
  created_by uuid,
  total_count bigint
)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET plan_cache_mode = force_custom_plan
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 100);
  -- Varianten eines Anlasses sieht, wer dort Koch/Köchin ist (wie die RLS)
  v_sees_event_variants boolean;
  v_tokens text[];
  v_pattern_1 text;
  v_pattern_2 text;
  v_pattern_3 text;
  v_pattern_4 text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet';
  END IF;
  IF p_scope NOT IN ('all', 'public', 'private', 'variant') THEN
    RAISE EXCEPTION 'Unbekannter Bereich: %', p_scope;
  END IF;

  -- Suchtext in Wörter teilen (jedes Wort muss vorkommen), höchstens 4.
  -- LIKE-Sonderzeichen werden maskiert, damit «100%» wörtlich gesucht wird.
  SELECT COALESCE(array_agg(
           '%' || replace(replace(replace(token, '\', '\\'), '%', '\%'), '_', '\_') || '%'
         ), '{}')
  INTO v_tokens
  FROM (
    SELECT token
    FROM regexp_split_to_table(
           lower(public.immutable_unaccent(COALESCE(p_search, ''))), '\s+'
         ) AS token
    WHERE token <> ''
    LIMIT 4
  ) words;
  v_sees_event_variants := p_event_id IS NOT NULL
    AND (public.is_event_cook(p_event_id) OR public.is_community_leader());
  v_pattern_1 := v_tokens[1];
  v_pattern_2 := v_tokens[2];
  v_pattern_3 := v_tokens[3];
  v_pattern_4 := v_tokens[4];

  RETURN QUERY
  WITH filtered AS (
    SELECT r.*
    FROM public.recipes r
    WHERE (
        r.recipe_type = 'public'
        OR (r.recipe_type = 'private' AND r.created_by = v_user_id)
        OR (r.recipe_type = 'variant' AND p_event_id IS NOT NULL AND r.variant_event_uid = p_event_id
            AND (v_sees_event_variants OR r.created_by = v_user_id))
      )
      AND (p_scope = 'all'
        OR (p_scope = 'public' AND r.recipe_type = 'public')
        OR (p_scope = 'private' AND r.recipe_type = 'private')
        OR (p_scope = 'variant' AND r.recipe_type = 'variant'))
      AND (p_only_mine IS NOT TRUE OR r.created_by = v_user_id)
      AND (p_diet IS NULL OR r.diet = p_diet)
      AND (p_exclude_allergens IS NULL OR cardinality(p_exclude_allergens) = 0
           OR NOT (r.allergens && p_exclude_allergens))
      AND (p_menu_types IS NULL OR cardinality(p_menu_types) = 0
           OR r.menu_types && p_menu_types)
      AND (p_outdoor IS NOT TRUE OR r.outdoor_kitchen_suitable)
      AND (v_pattern_1 IS NULL OR public.recipe_search_text(r.name, r.variant_name, r.tags) LIKE v_pattern_1)
      AND (v_pattern_2 IS NULL OR public.recipe_search_text(r.name, r.variant_name, r.tags) LIKE v_pattern_2)
      AND (v_pattern_3 IS NULL OR public.recipe_search_text(r.name, r.variant_name, r.tags) LIKE v_pattern_3)
      AND (v_pattern_4 IS NULL OR public.recipe_search_text(r.name, r.variant_name, r.tags) LIKE v_pattern_4)
  )
  SELECT f.id, f.name, f.source, f.picture_src, f.tags, f.menu_types, f.diet,
         f.allergens, f.outdoor_kitchen_suitable, f.avg_rating, f.no_ratings,
         f.no_comments, f.recipe_type, f.variant_name, f.created_at, f.created_by,
         CASE WHEN p_after_name IS NULL THEN (SELECT count(*) FROM filtered) END
  FROM filtered f
  WHERE p_after_name IS NULL OR (f.name, f.id) > (p_after_name, p_after_id)
  ORDER BY f.name, f.id
  LIMIT v_limit + 1;
END;
$$;

-- ------------------------------------------------------------
-- Grants: nur angemeldete Nutzer.
-- Die beiden Hilfsfunktionen bleiben für angemeldete Nutzer ausführbar
-- (Standard-Rechte), weil der Index sie bei jedem INSERT/UPDATE auf recipes
-- mit den Rechten der schreibenden Person auswertet.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.list_recipe_shorts(
  text, public.diet_type, public.allergen_type[], public.menu_type[], boolean, text, boolean, text, integer, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_recipe_shorts(
  text, public.diet_type, public.allergen_type[], public.menu_type[], boolean, text, boolean, text, integer, text, text
) TO authenticated;

ANALYZE public.recipes;
