-- Views für Rezept-Zutaten und -Materialien mit aufgelösten Namen.
-- Eliminiert die clientseitige productNameMap/materialNameMap-Auflösung.
-- security_invoker = true: die View erbt die RLS-Regeln des aufrufenden Benutzers.

-- =====================================================================
-- recipe_ingredients_with_names
-- =====================================================================
CREATE OR REPLACE VIEW public.recipe_ingredients_with_names
  WITH (security_invoker = true)
AS
SELECT
  ri.*,
  p.name AS product_name
FROM public.recipe_ingredients ri
LEFT JOIN public.products p ON p.id = ri.product_id;

COMMENT ON VIEW public.recipe_ingredients_with_names IS
  'Rezept-Zutaten mit aufgelöstem Produktnamen (LEFT JOIN, da Abschnitte product_id = NULL haben).';

GRANT SELECT ON public.recipe_ingredients_with_names TO authenticated;

-- =====================================================================
-- recipe_materials_with_names
-- =====================================================================
CREATE OR REPLACE VIEW public.recipe_materials_with_names
  WITH (security_invoker = true)
AS
SELECT
  rm.*,
  m.name AS material_name
FROM public.recipe_materials rm
LEFT JOIN public.materials m ON m.id = rm.material_id;

COMMENT ON VIEW public.recipe_materials_with_names IS
  'Rezept-Materialien mit aufgelöstem Materialnamen (LEFT JOIN, da material_id nullable ist).';

GRANT SELECT ON public.recipe_materials_with_names TO authenticated;
