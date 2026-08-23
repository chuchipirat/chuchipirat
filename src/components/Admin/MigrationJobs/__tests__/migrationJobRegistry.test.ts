/**
 * Unit-Tests für migrationJobRegistry.
 *
 * Testet ausschliesslich die FK-Abhängigkeits-Reihenfolge der Registry
 * (Object-Key-Reihenfolge = Anzeige-/empfohlene Ausführungsreihenfolge in
 * der Admin-UI, siehe migration.tsx). Fokus: recipeVariants muss vor
 * menuplan laufen — Menü-Positionen können auf Varianten-Rezepte
 * verweisen; in falscher Reihenfolge migriert MenuplanMigrationJob diese
 * Referenzen fälschlich als "[DELETED]" (recipeIdByFirebaseUid enthält zum
 * Zeitpunkt des Menuplan-Laufs noch keine Varianten-Rezepte).
 */
import {getMigrationJobKeys} from "../migrationJobRegistry";

describe("migrationJobRegistry — Reihenfolge", () => {
  test("recipeVariants steht vor menuplan", () => {
    const keys = getMigrationJobKeys();
    const recipeVariantsIndex = keys.indexOf("recipeVariants");
    const menuplanIndex = keys.indexOf("menuplan");

    expect(recipeVariantsIndex).toBeGreaterThanOrEqual(0);
    expect(menuplanIndex).toBeGreaterThanOrEqual(0);
    expect(recipeVariantsIndex).toBeLessThan(menuplanIndex);
  });

  test("events und recipes stehen vor recipeVariants", () => {
    const keys = getMigrationJobKeys();
    const recipeVariantsIndex = keys.indexOf("recipeVariants");

    expect(keys.indexOf("events")).toBeLessThan(recipeVariantsIndex);
    expect(keys.indexOf("recipes")).toBeLessThan(recipeVariantsIndex);
  });

  test("events und groupConfig stehen vor menuplan", () => {
    const keys = getMigrationJobKeys();
    const menuplanIndex = keys.indexOf("menuplan");

    expect(keys.indexOf("events")).toBeLessThan(menuplanIndex);
    expect(keys.indexOf("groupConfig")).toBeLessThan(menuplanIndex);
  });

  test("menuplan steht vor usedRecipes", () => {
    const keys = getMigrationJobKeys();
    expect(keys.indexOf("menuplan")).toBeLessThan(keys.indexOf("usedRecipes"));
  });
});
