-- Menüplan: CHECK-Constraints für nicht-negative Mengen und Faktoren.
-- Verhindert ungültige Werte auf DB-Ebene als zweite Verteidigungslinie
-- hinter der Client-seitigen Validierung.

ALTER TABLE event_menue_recipes
  ADD CONSTRAINT chk_menue_recipes_total_portions_non_negative
    CHECK (total_portions >= 0);

ALTER TABLE event_menue_products
  ADD CONSTRAINT chk_menue_products_quantity_non_negative
    CHECK (quantity >= 0);

ALTER TABLE event_menue_materials
  ADD CONSTRAINT chk_menue_materials_quantity_non_negative
    CHECK (quantity >= 0);

ALTER TABLE event_menuplan_item_plans
  ADD CONSTRAINT chk_item_plans_factor_non_negative
    CHECK (factor >= 0),
  ADD CONSTRAINT chk_item_plans_servings_non_negative
    CHECK (servings >= 0);
