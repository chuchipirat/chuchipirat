-- Aktualisiert find_similar_products(): Schliesst bestätigte Duplikat-Paare
-- aus der product_duplicate_dismissals-Tabelle aus.

CREATE OR REPLACE FUNCTION public.find_similar_products(
  similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH
    -- Trigram-basierte Ähnlichkeitspaare (nur obere Dreiecksmatrix, keine Selbst-Paare)
    trigram_pairs AS (
      SELECT
        product_a.id   AS product_a_id,
        product_a.name AS product_a_name,
        product_b.id   AS product_b_id,
        product_b.name AS product_b_name,
        similarity(product_a.name, product_b.name) AS similarity_score,
        'trigram' AS match_type
      FROM public.products product_a
      JOIN public.products product_b
        ON product_a.id < product_b.id
      WHERE similarity(product_a.name, product_b.name) >= similarity_threshold
    ),
    -- Synonym-basierte Paare: Produkte, deren Namen mit einem Synonym-Paar übereinstimmen
    synonym_pairs AS (
      SELECT
        product_a.id   AS product_a_id,
        product_a.name AS product_a_name,
        product_b.id   AS product_b_id,
        product_b.name AS product_b_name,
        1.0::FLOAT     AS similarity_score,
        'synonym' AS match_type
      FROM public.product_synonyms synonym
      JOIN public.products product_a
        ON LOWER(product_a.name) = LOWER(synonym.name_a)
      JOIN public.products product_b
        ON LOWER(product_b.name) = LOWER(synonym.name_b)
      WHERE product_a.id <> product_b.id
    ),
    -- Kombiniert und dedupliziert (Synonym-Treffer haben Vorrang)
    combined AS (
      SELECT DISTINCT ON (
        LEAST(product_a_id, product_b_id),
        GREATEST(product_a_id, product_b_id)
      )
        product_a_id,
        product_a_name,
        product_b_id,
        product_b_name,
        similarity_score,
        match_type
      FROM (
        SELECT * FROM synonym_pairs
        UNION ALL
        SELECT * FROM trigram_pairs
      ) all_pairs
      ORDER BY
        LEAST(product_a_id, product_b_id),
        GREATEST(product_a_id, product_b_id),
        match_type DESC
    ),
    -- Bereits bestätigte Paare ausschliessen
    filtered AS (
      SELECT combined.*
      FROM combined
      LEFT JOIN public.product_duplicate_dismissals dismissal
        ON dismissal.product_a_id = LEAST(combined.product_a_id, combined.product_b_id)
       AND dismissal.product_b_id = GREATEST(combined.product_a_id, combined.product_b_id)
      WHERE dismissal.id IS NULL
    )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'product_a_id',   product_a_id,
      'product_a_name', product_a_name,
      'product_b_id',   product_b_id,
      'product_b_name', product_b_name,
      'similarity',     ROUND(similarity_score::NUMERIC, 3),
      'match_type',     match_type
    )
    ORDER BY similarity_score DESC
  ), '[]'::JSONB)
  INTO result
  FROM filtered;

  RETURN result;
END;
$$;
