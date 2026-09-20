-- ============================================================
-- Datenintegrität: Rezepte mit Zutaten/Materialien ohne Produkt/Material
--
-- Produkte und Materialien lassen sich löschen, obwohl Rezepte sie noch
-- verwenden. Die FKs recipe_ingredients.product_id und
-- recipe_materials.material_id sind ON DELETE SET NULL: Die Zeile bleibt
-- mit Menge/Einheit/Detail bestehen, der Name geht verloren. Der Rezept-
-- Editor speichert ausserdem Zutaten mit Menge, aber ohne Produkt.
-- Beides führt zu einer Zutat ohne Produkt (die Einkaufslisten-Erzeugung
-- stösst sich daran).
--
-- Nicht betroffen: Einkaufs-/Materiallisten (CHECK chk_item_source bzw.
-- chk_material_item_source verbietet ein NULL-Produkt) und Menüplan
-- (NOT NULL, ON DELETE RESTRICT).
--
-- Beide Prüfungen liefern eine Zeile pro Rezept und sind read-only.
-- ============================================================

-- ------------------------------------------------------------
-- Zutaten ohne Produkt (Abschnittszeilen haben legitim kein Produkt)
-- ------------------------------------------------------------
CREATE FUNCTION public.check_recipe_ingredients_without_product() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  RETURN (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(broken) ORDER BY broken.recipe_name, broken.recipe_id),
      '[]'::jsonb
    )
    FROM (
      SELECT r.id AS recipe_id,
             r.name AS recipe_name,
             r.recipe_type,
             COALESCE(
               NULLIF(u.display_name, ''),
               NULLIF(trim(u.first_name || ' ' || u.last_name), '')
             ) AS created_by_name,
             count(*)::integer AS broken_count,
             jsonb_agg(
               jsonb_build_object('quantity', ri.quantity, 'unit', ri.unit, 'detail', ri.detail)
               ORDER BY ri.sort_order
             ) AS broken_rows
      FROM public.recipe_ingredients ri
      JOIN public.recipes r ON r.id = ri.recipe_id
      LEFT JOIN public.users u ON u.id = r.created_by
      WHERE ri.pos_type = 'ingredient'
        AND ri.product_id IS NULL
      GROUP BY r.id, r.name, r.recipe_type, u.display_name, u.first_name, u.last_name
    ) broken
  );
END;
$$;

-- ------------------------------------------------------------
-- Materialien ohne Material
-- ------------------------------------------------------------
CREATE FUNCTION public.check_recipe_materials_without_material() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen diese Funktion ausführen.';
  END IF;

  RETURN (
    SELECT COALESCE(
      jsonb_agg(to_jsonb(broken) ORDER BY broken.recipe_name, broken.recipe_id),
      '[]'::jsonb
    )
    FROM (
      SELECT r.id AS recipe_id,
             r.name AS recipe_name,
             r.recipe_type,
             COALESCE(
               NULLIF(u.display_name, ''),
               NULLIF(trim(u.first_name || ' ' || u.last_name), '')
             ) AS created_by_name,
             count(*)::integer AS broken_count,
             jsonb_agg(
               jsonb_build_object('quantity', rm.quantity)
               ORDER BY rm.sort_order
             ) AS broken_rows
      FROM public.recipe_materials rm
      JOIN public.recipes r ON r.id = rm.recipe_id
      LEFT JOIN public.users u ON u.id = r.created_by
      WHERE rm.material_id IS NULL
      GROUP BY r.id, r.name, r.recipe_type, u.display_name, u.first_name, u.last_name
    ) broken
  );
END;
$$;

-- ------------------------------------------------------------
-- Grants: nur angemeldete Nutzer, Berechtigung prüft is_admin() im Body
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.check_recipe_ingredients_without_product() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_recipe_materials_without_material() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_recipe_ingredients_without_product() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_recipe_materials_without_material() TO authenticated;
