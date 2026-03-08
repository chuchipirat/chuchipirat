import Menuplan, {
  Meal,
  Meals,
  MealType,
  Menue,
  Menues,
  Note,
  Notes,
  MealRecipe,
  MealRecipes,
  MenuplanMaterial,
  Materials,
  MenuplanProduct,
  Products,
  PortionPlan,
  PlanedDiet,
  PlanedIntolerances,
  GoodsPlanMode,
  MealRecipeDeletedPrefix,
} from "./menuplan.class";
import {
  MenuplanDomain,
  MealTypeDomain,
  MealDomain,
  MenueDomain,
  MenueRecipeDomain,
  MenueProductDomain,
  MenueMaterialDomain,
  NoteDomain,
  ItemPlanDomain,
  PlanScopeType,
  PlanModeType,
} from "../../Database/Repository/MenuplanRepository";
import {RecipeType} from "../../Recipe/recipe.class";

// =====================================================================
// Hilfsfunktionen für die Konvertierung der Plan-Zeilen
// =====================================================================

/**
 * Konvertiert ein Supabase-ItemPlanDomain in ein Firebase-PortionPlan.
 *
 * Der dietScope/intoleranceScope wird in die entsprechenden Enum-Werte
 * (PlanedDiet / PlanedIntolerances) oder in die Gruppen-UID aufgelöst.
 *
 * @param plan - Das Supabase-Plan-Objekt
 * @returns Das konvertierte PortionPlan-Objekt
 */
function itemPlanDomainToPortionPlan(plan: ItemPlanDomain): PortionPlan {
  let diet: PlanedDiet | string;
  if (plan.dietScope === "ALL") {
    diet = PlanedDiet.ALL;
  } else if (plan.dietScope === "FIX") {
    diet = PlanedDiet.FIX;
  } else {
    // scope === "group" → die konkrete Diät-UID verwenden
    diet = plan.dietId || "";
  }

  let intolerance: PlanedIntolerances | string;
  if (plan.intoleranceScope === "ALL") {
    intolerance = PlanedIntolerances.ALL;
  } else if (plan.intoleranceScope === "FIX") {
    intolerance = PlanedIntolerances.FIX;
  } else {
    // scope === "group" → die konkrete Intoleranz-UID verwenden
    intolerance = plan.intoleranceId || "";
  }

  return {
    diet,
    intolerance,
    factor: plan.factor,
    totalPortions: plan.servings,
  };
}

/**
 * Konvertiert ein Firebase-PortionPlan in ein Supabase-ItemPlanDomain.
 *
 * Die Enum-Werte PlanedDiet.ALL/FIX bzw. PlanedIntolerances.ALL/FIX werden
 * in den entsprechenden PlanScopeType umgewandelt. Alle anderen Werte
 * gelten als Gruppen-UIDs.
 *
 * @param plan - Das Firebase-Plan-Objekt
 * @returns Das konvertierte ItemPlanDomain-Objekt
 */
function portionPlanToItemPlanDomain(plan: PortionPlan): ItemPlanDomain {
  let dietScope: PlanScopeType;
  let dietId: string | null;

  if (plan.diet === PlanedDiet.ALL) {
    dietScope = "ALL";
    dietId = null;
  } else if (plan.diet === PlanedDiet.FIX) {
    dietScope = "FIX";
    dietId = null;
  } else {
    dietScope = "group";
    dietId = plan.diet;
  }

  let intoleranceScope: PlanScopeType;
  let intoleranceId: string | null;

  if (plan.intolerance === PlanedIntolerances.ALL) {
    intoleranceScope = "ALL";
    intoleranceId = null;
  } else if (plan.intolerance === PlanedIntolerances.FIX) {
    intoleranceScope = "FIX";
    intoleranceId = null;
  } else {
    intoleranceScope = "group";
    intoleranceId = plan.intolerance;
  }

  return {
    uid: "",
    dietScope,
    dietId,
    intoleranceScope,
    intoleranceId,
    factor: plan.factor,
    servings: plan.totalPortions,
  };
}

// =====================================================================
// Domain → Class
// =====================================================================

/**
 * Konvertiert ein Supabase-MenuplanDomain in eine Firebase-Menuplan-Klasseninstanz.
 *
 * Die flachen Arrays des Domain-Modells werden in die verschachtelten
 * Map-Strukturen ({entries, order} bzw. {[uid]: ...}) der Menuplan-Klasse
 * überführt. Sortierreihenfolgen werden aus den sortOrder-Feldern abgeleitet.
 *
 * @param domain - Das Supabase-MenuplanDomain-Objekt
 * @param eventUid - Die Event-UID, wird als Menuplan-UID verwendet
 * @returns Eine befüllte Menuplan-Klasseninstanz
 *
 * @example
 * const menuplan = menuplanDomainToClass(domain, "event-123");
 */
export function menuplanDomainToClass(
  domain: MenuplanDomain,
  eventUid: string
): Menuplan {
  const menuplan = new Menuplan();
  menuplan.uid = eventUid;

  // -- MealTypes: sortiert nach sortOrder in entries-Map und order-Array --
  const sortedMealTypes = [...domain.mealTypes].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  for (const mt of sortedMealTypes) {
    menuplan.mealTypes.entries[mt.uid] = {uid: mt.uid, name: mt.name};
    menuplan.mealTypes.order.push(mt.uid);
  }

  // -- Meals: MealDomain → Meal-Map --
  // Menues pro Meal gruppieren (nach sortOrder sortiert)
  const menuesByMealId = new Map<string, MenueDomain[]>();
  for (const menue of domain.menues) {
    const list = menuesByMealId.get(menue.mealId) || [];
    list.push(menue);
    menuesByMealId.set(menue.mealId, list);
  }

  for (const mealDomain of domain.meals) {
    const menuesForMeal = menuesByMealId.get(mealDomain.uid) || [];
    menuesForMeal.sort((a, b) => a.sortOrder - b.sortOrder);

    const meal: Meal = {
      uid: mealDomain.uid,
      date: mealDomain.mealDate,
      mealType: mealDomain.mealTypeId,
      menuOrder: menuesForMeal.map((m) => m.uid),
    };
    menuplan.meals[meal.uid] = meal;
  }

  // -- Hilfs-Maps: Welche Recipes/Products/Materials gehören zu welchem Menü? --
  const recipesByMenueId = new Map<string, MenueRecipeDomain[]>();
  for (const r of domain.menueRecipes) {
    const list = recipesByMenueId.get(r.menueId) || [];
    list.push(r);
    recipesByMenueId.set(r.menueId, list);
  }

  const productsByMenueId = new Map<string, MenueProductDomain[]>();
  for (const p of domain.menueProducts) {
    const list = productsByMenueId.get(p.menueId) || [];
    list.push(p);
    productsByMenueId.set(p.menueId, list);
  }

  const materialsByMenueId = new Map<string, MenueMaterialDomain[]>();
  for (const m of domain.menueMaterials) {
    const list = materialsByMenueId.get(m.menueId) || [];
    list.push(m);
    materialsByMenueId.set(m.menueId, list);
  }

  // -- Menues: MenueDomain → Menue-Map (mit Order-Arrays) --
  for (const menueDomain of domain.menues) {
    const recipesForMenue = recipesByMenueId.get(menueDomain.uid) || [];
    recipesForMenue.sort((a, b) => a.sortOrder - b.sortOrder);

    const productsForMenue = productsByMenueId.get(menueDomain.uid) || [];
    productsForMenue.sort((a, b) => a.sortOrder - b.sortOrder);

    const materialsForMenue = materialsByMenueId.get(menueDomain.uid) || [];
    materialsForMenue.sort((a, b) => a.sortOrder - b.sortOrder);

    const menue: Menue = {
      uid: menueDomain.uid,
      name: menueDomain.name,
      mealRecipeOrder: recipesForMenue.map((r) => r.uid),
      productOrder: productsForMenue.map((p) => p.uid),
      materialOrder: materialsForMenue.map((m) => m.uid),
    };
    menuplan.menues[menue.uid] = menue;
  }

  // -- MealRecipes: MenueRecipeDomain → MealRecipe-Map --
  for (const recipeDomain of domain.menueRecipes) {
    const mealRecipe: MealRecipe = {
      uid: recipeDomain.uid,
      recipe: {
        recipeUid: recipeDomain.recipeId || "",
        name: recipeDomain.recipeId === null
          ? recipeDomain.deletedRecipeName || ""
          : recipeDomain.recipeName,
        type: RecipeType.public,
        createdFromUid: "",
        variantName: recipeDomain.variantName || undefined,
      },
      plan: recipeDomain.plans.map(itemPlanDomainToPortionPlan),
      totalPortions: recipeDomain.totalPortions,
    };
    menuplan.mealRecipes[mealRecipe.uid] = mealRecipe;
  }

  // -- Products: MenueProductDomain → MenuplanProduct-Map --
  for (const productDomain of domain.menueProducts) {
    const product: MenuplanProduct = {
      uid: productDomain.uid,
      quantity: productDomain.quantity,
      unit: productDomain.unit || "",
      productUid: productDomain.productId,
      productName: productDomain.productName,
      planMode:
        productDomain.planMode === "total"
          ? GoodsPlanMode.TOTAL
          : GoodsPlanMode.PER_PORTION,
      plan: productDomain.plans.map(itemPlanDomainToPortionPlan),
      totalQuantity: productDomain.totalQuantity,
    };
    menuplan.products[product.uid] = product;
  }

  // -- Materials: MenueMaterialDomain → MenuplanMaterial-Map --
  for (const materialDomain of domain.menueMaterials) {
    const material: MenuplanMaterial = {
      uid: materialDomain.uid,
      quantity: materialDomain.quantity,
      unit: materialDomain.unit || "",
      materialUid: materialDomain.materialId,
      materialName: materialDomain.materialName,
      planMode:
        materialDomain.planMode === "total"
          ? GoodsPlanMode.TOTAL
          : GoodsPlanMode.PER_PORTION,
      plan: materialDomain.plans.map(itemPlanDomainToPortionPlan),
      totalQuantity: materialDomain.totalQuantity,
    };
    menuplan.materials[material.uid] = material;
  }

  // -- Notes: NoteDomain → Note-Map --
  for (const noteDomain of domain.notes) {
    const note: Note = {
      uid: noteDomain.uid,
      date: noteDomain.noteDate,
      menueUid: noteDomain.menueId || "",
      text: noteDomain.text,
    };
    menuplan.notes[note.uid] = note;
  }

  // -- Dates: Eindeutige Datumswerte aus den Meals ableiten und aufsteigend sortieren --
  const uniqueDateStrings = new Set<string>();
  for (const mealDomain of domain.meals) {
    uniqueDateStrings.add(mealDomain.mealDate);
  }
  menuplan.dates = Array.from(uniqueDateStrings)
    .sort()
    .map((dateStr) => new Date(new Date(dateStr).setUTCHours(0, 0, 0, 0)));

  return menuplan;
}

// =====================================================================
// Class → Domain
// =====================================================================

/**
 * Konvertiert eine Firebase-Menuplan-Klasseninstanz in ein Supabase-MenuplanDomain.
 *
 * Die verschachtelten Map-Strukturen der Menuplan-Klasse werden in die
 * flachen Array-Strukturen des Domain-Modells überführt. Sortierreihenfolgen
 * werden aus den Positionen in den Order-Arrays abgeleitet (Index × 10).
 *
 * @param menuplan - Die Firebase-Menuplan-Klasseninstanz
 * @param eventId - Die Event-ID für das Domain-Objekt
 * @returns Das konvertierte MenuplanDomain-Objekt
 *
 * @example
 * const domain = menuplanClassToDomain(menuplan, "event-123");
 */
export function menuplanClassToDomain(
  menuplan: Menuplan,
  eventId: string
): MenuplanDomain {
  // -- MealTypes: order-Array mit Index als sortOrder --
  const mealTypes: MealTypeDomain[] = menuplan.mealTypes.order.map(
    (uid, index) => ({
      uid,
      name: menuplan.mealTypes.entries[uid].name,
      sortOrder: index * 10,
    })
  );

  // -- Meals --
  const meals: MealDomain[] = Object.values(menuplan.meals).map((meal) => ({
    uid: meal.uid,
    mealDate: meal.date,
    mealTypeId: meal.mealType,
  }));

  // -- Hilfs-Map: Menü-UID → zugehörige Meal-UID und Position --
  const menueToMealMap = new Map<string, {mealId: string; sortOrder: number}>();
  for (const meal of Object.values(menuplan.meals)) {
    meal.menuOrder.forEach((menueUid, index) => {
      menueToMealMap.set(menueUid, {mealId: meal.uid, sortOrder: index * 10});
    });
  }

  // -- Menues: Nur Menüs aufnehmen, die einer Meal zugeordnet sind --
  // Verwaiste Menüs (nicht in einer Meal.menuOrder) werden übersprungen,
  // da sie keine gültige meal_id hätten und einen FK-Fehler verursachen würden.
  const menues: MenueDomain[] = [];
  for (const menue of Object.values(menuplan.menues)) {
    const mapping = menueToMealMap.get(menue.uid);
    if (!mapping) {
      console.warn(
        `menuplanClassToDomain: Menue ${menue.uid} ist keiner Meal zugeordnet — wird übersprungen.`,
      );
      continue;
    }
    menues.push({
      uid: menue.uid,
      mealId: mapping.mealId,
      name: menue.name,
      sortOrder: mapping.sortOrder,
    });
  }

  // Set der gültigen Menü-UIDs — nur Menüs, die einer Meal zugeordnet sind
  const validMenueIds = new Set(menues.map((m) => m.uid));

  // -- MenueRecipes: Nur aus gültigen Menüs die mealRecipeOrder durchgehen --
  const menueRecipes: MenueRecipeDomain[] = [];
  for (const menue of Object.values(menuplan.menues)) {
    if (!validMenueIds.has(menue.uid)) continue;

    menue.mealRecipeOrder.forEach((mealRecipeUid, index) => {
      const mealRecipe = menuplan.mealRecipes[mealRecipeUid];
      if (!mealRecipe) return;

      // Prüfen ob das Rezept als gelöscht markiert ist
      const isDeleted =
        !mealRecipe.recipe.recipeUid ||
        mealRecipe.recipe.name.startsWith(MealRecipeDeletedPrefix);

      const recipeDomain: MenueRecipeDomain = {
        uid: mealRecipe.uid,
        menueId: menue.uid,
        recipeId: isDeleted ? null : mealRecipe.recipe.recipeUid,
        recipeName: isDeleted ? "" : mealRecipe.recipe.name,
        deletedRecipeName: isDeleted ? mealRecipe.recipe.name : null,
        variantName: mealRecipe.recipe.variantName || null,
        totalPortions: mealRecipe.totalPortions,
        sortOrder: index * 10,
        plans: mealRecipe.plan.map(portionPlanToItemPlanDomain),
      };
      menueRecipes.push(recipeDomain);
    });
  }

  // -- MenueProducts: Nur aus gültigen Menüs die productOrder durchgehen --
  const menueProducts: MenueProductDomain[] = [];
  for (const menue of Object.values(menuplan.menues)) {
    if (!validMenueIds.has(menue.uid)) continue;

    menue.productOrder.forEach((productUid, index) => {
      const product = menuplan.products[productUid];
      if (!product) return;

      const productDomain: MenueProductDomain = {
        uid: product.uid,
        menueId: menue.uid,
        productId: product.productUid,
        productName: product.productName,
        quantity: product.quantity,
        unit: product.unit || null,
        planMode:
          product.planMode === GoodsPlanMode.TOTAL ? "total" : "per_portion",
        totalQuantity: product.totalQuantity,
        sortOrder: index * 10,
        plans: product.plan.map(portionPlanToItemPlanDomain),
      };
      menueProducts.push(productDomain);
    });
  }

  // -- MenueMaterials: Nur aus gültigen Menüs die materialOrder durchgehen --
  const menueMaterials: MenueMaterialDomain[] = [];
  for (const menue of Object.values(menuplan.menues)) {
    if (!validMenueIds.has(menue.uid)) continue;

    menue.materialOrder.forEach((materialUid, index) => {
      const material = menuplan.materials[materialUid];
      if (!material) return;

      const materialDomain: MenueMaterialDomain = {
        uid: material.uid,
        menueId: menue.uid,
        materialId: material.materialUid,
        materialName: material.materialName,
        quantity: material.quantity,
        unit: material.unit || null,
        planMode:
          material.planMode === GoodsPlanMode.TOTAL ? "total" : "per_portion",
        totalQuantity: material.totalQuantity,
        sortOrder: index * 10,
        plans: material.plan.map(portionPlanToItemPlanDomain),
      };
      menueMaterials.push(materialDomain);
    });
  }

  // -- Notes --
  const notes: NoteDomain[] = Object.values(menuplan.notes).map((note) => ({
    uid: note.uid,
    menueId: note.menueUid || null,
    noteDate: note.date,
    text: note.text,
  }));

  return {
    eventId,
    mealTypes,
    meals,
    menues,
    menueRecipes,
    menueProducts,
    menueMaterials,
    notes,
  };
}
