/**
 * ShoppingList — Domain-Service für Einkaufslisten.
 *
 * Reine Geschäftslogik ohne Persistenz-Code. Die Klasse generiert
 * Einkaufslisten aus dem Menüplan, verwaltet Positionen (hinzufügen,
 * löschen, Checkbox-Status) und bietet Hilfsmethoden für die UI.
 *
 * Persistenz erfolgt über das ShoppingListRepository.
 */
import Department from "../../Department/department.class";
import Unit from "../../Unit/unit.class";
import {
  Menue,
  MenuplanData,
} from "../Menuplan/menuplan.types";
import {UsedRecipes} from "../UsedRecipes/usedRecipes.class";
import {
  ERROR_NO_RECIPE_PRODUCT_MATERIAL_FOUND as TEXT_ERROR_NO_RECIPE_PRODUCT_MATERIAL_FOUND,
} from "../../../constants/text";
import Recipe, {
  Ingredient,
  RecipeMaterialPosition,
} from "../../Recipe/recipe.class";
import Product from "../../Product/product.class";
import {
  UnitConversionBasic,
  UnitConversionProducts,
} from "../../Unit/unitConversion.class";
import Material, {MaterialType} from "../../Material/material.class";
import _ from "lodash";
import Utils from "../../Shared/utils.class";

/* =====================================================================
// Konstanten
// ===================================================================== */

/** Abteilungsname für Non-Food-Artikel (Materialien). */
const NON_FOOD_DEPARTMENT_NAME = "NON FOOD";

/** Platzhalter-Abteilung für Items ohne zuweisbare Abteilung. */
const UNASSIGNED_DEPARTMENT: Department = {
  uid: "NotIdentifiable",
  name: "Keine Zuordnung möglich",
  pos: 99,
  usable: true,
};

/* =====================================================================
// Enums & Interfaces
// ===================================================================== */

/** Art einer Einkaufslistenposition. */
export enum ItemType {
  none = 0,
  food,
  material,
  custom,
}

/**
 * Einzelne Position in einer Einkaufsliste.
 *
 * @param checked - Abgehakt-Status
 * @param quantity - Menge
 * @param unit - Einheiten-Key
 * @param item - Produkt-/Material-Referenz mit UID und Name
 * @param type - Art der Position (food, material, custom)
 * @param manualEdit - Wurde die Position manuell bearbeitet
 * @param manualAdd - Wurde die Position manuell hinzugefügt
 * @param supabaseId - Supabase-Zeilen-ID für granulare Updates (z.B. Checkbox)
 */
export interface ShoppingListItem {
  checked: boolean;
  quantity: number;
  unit: Unit["key"];
  item: {uid: string; name: string};
  type: ItemType;
  manualEdit?: boolean;
  manualAdd?: boolean;
  supabaseId?: string;
}

/**
 * Abteilung in einer Einkaufsliste mit ihren Positionen.
 *
 * @param departmentUid - UID der Abteilung
 * @param departmentName - Anzeigename der Abteilung
 * @param items - Positionen in dieser Abteilung
 */
export interface ShoppingListDepartment {
  departmentUid: Department["uid"];
  departmentName: Department["name"];
  items: ShoppingListItem[];
}

/**
 * Trace-Eintrag für eine einzelne Position — zeigt, aus welchem
 * Rezept/Menü die Menge stammt.
 *
 * @param menueUid - UID des Menüs
 * @param recipe - Rezept-Referenz (UID + Name)
 * @param planedPortions - Geplante Portionen
 * @param quantity - Menge aus diesem Rezept
 * @param unit - Einheiten-Key
 * @param manualAdd - Manuell hinzugefügt
 * @param manualEdit - Menge wurde manuell geändert
 * @param itemType - Art der Position
 */
export interface ProductTrace {
  menueUid: Menue["uid"];
  recipe: {uid: Recipe["uid"]; name: Recipe["name"]};
  planedPortions?: number;
  quantity: number;
  unit: Unit["key"];
  manualAdd?: boolean;
  manualEdit?: boolean;
  itemType: ItemType;
}

/**
 * Trace-Map: Item-UID → Array von Trace-Einträgen.
 * Zeigt für jede Position, wie sich deren Gesamtmenge zusammensetzt.
 */
export interface ShoppingListTrace {
  [key: Product["uid"]]: ProductTrace[];
}

/* =====================================================================
// Interfaces für Methoden-Parameter
// ===================================================================== */

interface CreateNewListParams {
  selectedMenues: Menue["uid"][];
  selectedDepartments: Department["uid"][];
  menueplan: MenuplanData;
  /** Vorgeladene Rezepte — Key: recipeUid, Value: Recipe-Objekt */
  recipes: {[key: string]: Recipe};
  products: Product[];
  materials: Material[];
  departments: Department[];
  units: Unit[];
  unitConversionBasic: UnitConversionBasic;
  unitConversionProducts: UnitConversionProducts;
}

interface AddItemParams {
  shoppingListReference: ShoppingList;
  item: Product | Material;
  quantity: number;
  unit: Unit["key"];
  department: Department | undefined;
  addedManually?: boolean;
  itemType: ItemType;
}

interface DeleteItemParams {
  shoppingListReference: ShoppingList;
  itemUid: Product["uid"] | Material["uid"];
  unit: Unit["key"];
  departmentKey: Department["pos"];
}

interface AddTraceEntryParams {
  trace: ShoppingListTrace;
  item: Product | Material;
  menueUid: Menue["uid"];
  recipe: {uid: Recipe["uid"]; name: Recipe["name"]};
  planedPortions?: number;
  quantity: number;
  unit: Unit["key"];
  addedManually?: boolean;
  itemType: ItemType;
}

/* =====================================================================
// ShoppingList
// ===================================================================== */

/**
 * Domain-Service für Einkaufslisten.
 *
 * Generiert Listen aus dem Menüplan, verwaltet Positionen und bietet
 * Hilfsmethoden für die UI. Keine Persistenz-Logik enthalten.
 */
export default class ShoppingList {
  uid: string;
  list: {
    [key: Department["pos"]]: ShoppingListDepartment;
  };

  constructor() {
    this.uid = "";
    this.list = {0: {departmentUid: "", departmentName: "", items: []}};
  }

  /* =====================================================================
  // Neue Liste aus Menüplan generieren
  // ===================================================================== */

  /**
   * Generiert eine neue Einkaufsliste aus dem Menüplan.
   *
   * Skaliert Rezept-Zutaten auf die geplanten Portionen, fügt
   * Menüplan-Produkte und -Materialien hinzu, und baut parallel
   * eine Trace-Map auf.
   *
   * @param params - Ausgewählte Menüs, vorgeladene Rezepte, Stammdaten
   * @returns Generierte ShoppingList und Trace-Map
   * @throws {Error} Wenn keine Produkte/Materialien gefunden wurden
   */
  static createNewList(params: CreateNewListParams): {
    shoppingList: ShoppingList;
    trace: ShoppingListTrace;
  } {
    const shoppingList = {list: {}, uid: ""} as ShoppingList;
    let trace = {} as ShoppingListTrace;
    let itemCounter = 0;

    // 1. Zutaten aus Rezepten hinzufügen
    const ingredientResult = ShoppingList.addIngredientsFromRecipes({
      shoppingList,
      trace,
      ...params,
    });
    trace = ingredientResult.trace;
    itemCounter += ingredientResult.itemCount;

    // 2. Produkte direkt aus dem Menüplan hinzufügen
    const productResult = ShoppingList.addProductsFromMenuplan({
      shoppingList,
      trace,
      ...params,
    });
    trace = productResult.trace;
    itemCounter += productResult.itemCount;

    // 3. Materialien direkt aus dem Menüplan hinzufügen
    const materialResult = ShoppingList.addMaterialsFromMenuplan({
      shoppingList,
      trace,
      ...params,
    });
    trace = materialResult.trace;
    itemCounter += materialResult.itemCount;

    if (itemCounter === 0) {
      throw new Error(TEXT_ERROR_NO_RECIPE_PRODUCT_MATERIAL_FOUND);
    }

    return {shoppingList, trace};
  }

  /* =====================================================================
  // Zutaten aus Rezepten hinzufügen (Teilschritt von createNewList)
  // ===================================================================== */

  /**
   * Skaliert Rezept-Zutaten auf geplante Portionen und fügt sie zur Liste hinzu.
   */
  private static addIngredientsFromRecipes(params: {
    shoppingList: ShoppingList;
    trace: ShoppingListTrace;
    selectedMenues: Menue["uid"][];
    selectedDepartments: Department["uid"][];
    menueplan: MenuplanData;
    recipes: {[key: string]: Recipe};
    products: Product[];
    materials: Material[];
    departments: Department[];
    units: Unit[];
    unitConversionBasic: UnitConversionBasic;
    unitConversionProducts: UnitConversionProducts;
  }): {trace: ShoppingListTrace; itemCount: number} {
    const {
      shoppingList, selectedMenues, selectedDepartments, menueplan,
      recipes, products, materials, departments, units,
      unitConversionBasic, unitConversionProducts,
    } = params;
    let {trace} = params;
    let itemCount = 0;

    // Rezept-UIDs aus den ausgewählten Menüs ableiten
    const recipeList = UsedRecipes.defineSelectedRecipes({
      selectedMenues,
      menueplan,
    });

    if (recipeList.length === 0) return {trace, itemCount};

    selectedMenues.forEach((menueUid) => {
      menueplan.menues[menueUid].mealRecipeOrder.forEach((mealRecipeUid) => {
        const mealRecipe = menueplan.mealRecipes[mealRecipeUid];
        // Gelöschtes Rezept überspringen
        if (!mealRecipe.recipe.recipeUid) {
          return;
        }

        const recipe = recipes[mealRecipe.recipe.recipeUid];
        if (!recipe) return;

        // Zutaten skalieren
        const scaledIngredients = Recipe.scaleIngredients({
          recipe,
          portionsToScale: mealRecipe.totalPortions,
          scalingOptions: {convertUnits: true},
          units,
          unitConversionBasic,
          unitConversionProducts,
          products,
        });

        // Skalierte Zutaten zur Liste hinzufügen
        Object.values(scaledIngredients).forEach((ingredient: Ingredient) => {
          const product = products.find((p) => p.uid === ingredient.product.uid);
          const department = departments.find(
            (d) => d.uid === product?.department.uid,
          );

          if (
            !department ||
            !selectedDepartments ||
            selectedDepartments.includes(department.uid)
          ) {
            ShoppingList.addItem({
              shoppingListReference: shoppingList,
              item: product!,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
              department,
              itemType: ItemType.food,
            });
            itemCount++;

            trace = ShoppingList.addTraceEntry({
              trace,
              item: product!,
              menueUid,
              recipe: {uid: mealRecipe.recipe.recipeUid, name: mealRecipe.recipe.name},
              planedPortions: mealRecipe.totalPortions,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
              itemType: ItemType.food,
            });
          }
        });

        // Materialien aus dem Rezept skalieren und hinzufügen
        const scaledMaterials = Recipe.scaleMaterials({
          recipe,
          portionsToScale: mealRecipe.totalPortions,
        });

        Object.values(scaledMaterials).forEach((recipeMaterial: RecipeMaterialPosition) => {
          const material = materials.find(
            (m) => m.uid === recipeMaterial.material.uid,
          );
          const department = departments.find(
            (d) => d.name.toUpperCase() === NON_FOOD_DEPARTMENT_NAME,
          );

          if (
            !department ||
            !selectedDepartments ||
            (material?.type === MaterialType.consumable &&
              selectedDepartments.includes(department.uid))
          ) {
            ShoppingList.addItem({
              shoppingListReference: shoppingList,
              item: material!,
              quantity: recipeMaterial.quantity,
              unit: "",
              department,
              itemType: ItemType.material,
            });
            itemCount++;

            trace = ShoppingList.addTraceEntry({
              trace,
              item: material!,
              menueUid,
              recipe: {uid: mealRecipe.recipe.recipeUid, name: mealRecipe.recipe.name},
              planedPortions: mealRecipe.totalPortions,
              quantity: recipeMaterial.quantity,
              unit: "",
              itemType: ItemType.material,
            });
          }
        });
      });
    });

    return {trace, itemCount};
  }

  /* =====================================================================
  // Produkte aus dem Menüplan hinzufügen (Teilschritt von createNewList)
  // ===================================================================== */

  /**
   * Fügt Produkte, die direkt im Menüplan eingetragen sind, zur Liste hinzu.
   */
  private static addProductsFromMenuplan(params: {
    shoppingList: ShoppingList;
    trace: ShoppingListTrace;
    selectedMenues: Menue["uid"][];
    selectedDepartments: Department["uid"][];
    menueplan: MenuplanData;
    products: Product[];
    departments: Department[];
  }): {trace: ShoppingListTrace; itemCount: number} {
    const {shoppingList, selectedMenues, selectedDepartments, menueplan, products, departments} = params;
    let {trace} = params;
    let itemCount = 0;

    selectedMenues.forEach((menueUid) => {
      menueplan.menues[menueUid].productOrder.forEach((productMenuUid) => {
        const menuPlanProductEntry = menueplan.products[productMenuUid];
        const product = products.find((p) => p.uid === menuPlanProductEntry.productUid);
        const department = departments.find((d) => d.uid === product?.department.uid);

        if (!department || selectedDepartments.includes(department.uid)) {
          ShoppingList.addItem({
            shoppingListReference: shoppingList,
            item: product!,
            quantity: menuPlanProductEntry.totalQuantity,
            unit: menuPlanProductEntry.unit,
            department,
            itemType: ItemType.food,
          });
          itemCount++;

          trace = ShoppingList.addTraceEntry({
            trace,
            item: product!,
            menueUid,
            recipe: {} as {uid: string; name: string},
            quantity: menuPlanProductEntry.totalQuantity,
            unit: menuPlanProductEntry.unit,
            itemType: ItemType.food,
          });
        }
      });
    });

    return {trace, itemCount};
  }

  /* =====================================================================
  // Materialien aus dem Menüplan hinzufügen (Teilschritt von createNewList)
  // ===================================================================== */

  /**
   * Fügt Materialien, die direkt im Menüplan eingetragen sind, zur Liste hinzu.
   */
  private static addMaterialsFromMenuplan(params: {
    shoppingList: ShoppingList;
    trace: ShoppingListTrace;
    selectedMenues: Menue["uid"][];
    selectedDepartments: Department["uid"][];
    menueplan: MenuplanData;
    materials: Material[];
    departments: Department[];
  }): {trace: ShoppingListTrace; itemCount: number} {
    const {shoppingList, selectedMenues, selectedDepartments, menueplan, materials, departments} = params;
    let {trace} = params;
    let itemCount = 0;

    selectedMenues.forEach((menueUid) => {
      menueplan.menues[menueUid].materialOrder.forEach((materialMenuUid) => {
        const menuPlanMaterialEntry = menueplan.materials[materialMenuUid];
        const material = materials.find((m) => m.uid === menuPlanMaterialEntry.materialUid);
        const department = departments.find(
          (d) => d.name.toUpperCase() === NON_FOOD_DEPARTMENT_NAME,
        );

        if (
          (!department || selectedDepartments.includes(department.uid)) &&
          material?.type === MaterialType.consumable
        ) {
          ShoppingList.addItem({
            shoppingListReference: shoppingList,
            item: material!,
            quantity: menuPlanMaterialEntry.totalQuantity,
            unit: menuPlanMaterialEntry.unit,
            department,
            itemType: ItemType.material,
          });
          itemCount++;

          trace = ShoppingList.addTraceEntry({
            trace,
            item: material!,
            menueUid,
            recipe: {} as {uid: string; name: string},
            quantity: menuPlanMaterialEntry.totalQuantity,
            unit: menuPlanMaterialEntry.unit,
            itemType: ItemType.material,
          });
        }
      });
    });

    return {trace, itemCount};
  }

  /* =====================================================================
  // Item zur Liste hinzufügen (mit Akkumulation bei Duplikaten)
  // ===================================================================== */

  /**
   * Fügt ein Produkt oder Material zur Liste hinzu.
   * Bei gleicher UID + Einheit wird die Menge addiert.
   *
   * @param params - Item-Daten inkl. Referenz auf die Liste
   */
  static addItem = ({
    shoppingListReference,
    item,
    quantity,
    unit,
    department,
    addedManually = false,
    itemType,
  }: AddItemParams) => {
    if (!item) return;

    if (!department) {
      department = {...UNASSIGNED_DEPARTMENT};
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        shoppingListReference.list,
        department.pos,
      )
    ) {
      shoppingListReference.list[department.pos] = {
        departmentUid: department.uid,
        departmentName: department.name,
        items: [],
      };
    }

    let shoppingListItem = shoppingListReference.list[
      department.pos
    ].items.find(
      (listItem: ShoppingListItem) =>
        listItem.item.uid === item!.uid && listItem.unit === unit,
    );

    if (shoppingListItem) {
      shoppingListItem.quantity = shoppingListItem.quantity + quantity;
    } else {
      shoppingListItem = {
        checked: false,
        quantity,
        unit,
        item: {uid: item.uid, name: item.name},
        type: itemType,
      };

      if (addedManually) {
        shoppingListItem.manualAdd = true;
      }

      shoppingListReference.list[department.pos].items.push(shoppingListItem);
    }
  };

  /* =====================================================================
  // Trace-Eintrag hinzufügen
  // ===================================================================== */

  /**
   * Fügt einen Trace-Eintrag für ein Item hinzu.
   * Zeigt, aus welchem Menü/Rezept die Menge stammt.
   *
   * @param params - Trace-Daten
   * @returns Aktualisierte Trace-Map
   */
  static addTraceEntry = ({
    trace,
    item,
    menueUid,
    recipe,
    planedPortions,
    quantity,
    unit,
    addedManually = false,
    itemType,
  }: AddTraceEntryParams): ShoppingListTrace => {
    if (!Object.prototype.hasOwnProperty.call(trace, item.uid)) {
      trace[item.uid] = [];
    }

    const traceEntry: ProductTrace = {
      menueUid,
      recipe,
      quantity,
      unit,
      itemType,
    };
    if (planedPortions) traceEntry.planedPortions = planedPortions;
    if (addedManually) traceEntry.manualAdd = true;

    trace[item.uid].push(traceEntry);
    return trace;
  };

  /* =====================================================================
  // Trace-Eintrag löschen
  // ===================================================================== */

  /**
   * Entfernt den Trace-Eintrag eines Items.
   *
   * @param trace - Aktuelle Trace-Map
   * @param itemUid - UID des zu entfernenden Items
   * @returns Aktualisierte Trace-Map (Kopie)
   */
  static deleteTraceEntry = (
    trace: ShoppingListTrace,
    itemUid: Product["uid"] | Material["uid"],
  ): ShoppingListTrace => {
    const updatedTrace = _.cloneDeep(trace);
    delete updatedTrace[itemUid];
    return updatedTrace;
  };

  /* =====================================================================
  // Item aus der Liste entfernen
  // ===================================================================== */

  /**
   * Entfernt ein Item aus der Liste. Löscht die Abteilung, wenn sie leer ist.
   *
   * @param params - Item-Identifikation (UID, Einheit, Abteilung)
   * @returns Aktualisierte ShoppingList (Kopie)
   */
  static deleteItem = ({
    shoppingListReference,
    departmentKey,
    unit,
    itemUid,
  }: DeleteItemParams) => {
    const updatedShoppingList = _.cloneDeep(shoppingListReference) as ShoppingList;

    updatedShoppingList.list[departmentKey].items =
      updatedShoppingList.list[departmentKey].items.filter(
        (item) => item.unit !== unit || item.item.uid !== itemUid,
      );

    if (updatedShoppingList.list[departmentKey].items.length === 0) {
      delete updatedShoppingList.list[departmentKey];
    }
    return updatedShoppingList;
  };

  /* =====================================================================
  // Abteilung zur Liste hinzufügen
  // ===================================================================== */

  /**
   * Fügt eine Abteilung zur Einkaufsliste hinzu, falls diese noch nicht existiert.
   *
   * @param params.shoppingList - Die Einkaufsliste
   * @param params.departmentUid - Die UID der hinzuzufügenden Abteilung
   * @param params.departments - Alle verfügbaren Abteilungen
   * @returns Die aktualisierte Einkaufsliste
   */
  static addDepartmentToList = ({
    shoppingList,
    departmentUid,
    departments,
  }: {
    shoppingList: ShoppingList;
    departmentUid: Department["uid"];
    departments: Department[];
  }) => {
    if (!shoppingList || !departmentUid) return shoppingList;

    const department = departments.find((d) => d.uid === departmentUid);
    if (!department) return shoppingList;
    if (Object.hasOwn(shoppingList.list, department.pos)) return shoppingList;

    shoppingList.list[department.pos] = {
      departmentUid: department.uid,
      departmentName: department.name,
      items: [],
    };

    return shoppingList;
  };

  /* =====================================================================
  // Leere Einträge für Edit-Modus erstellen
  // ===================================================================== */

  /**
   * Fügt pro Abteilung einen leeren Eintrag am Ende hinzu (für den Edit-Modus).
   */
  static createEmptyListEntries = ({shoppingList}: {shoppingList: ShoppingList}) => {
    Object.keys(shoppingList.list).forEach((departmentPos) => {
      const dept = shoppingList.list[Number(departmentPos) as Department["pos"]];
      if (
        dept.items.length === 0 ||
        dept.items[dept.items.length - 1].item.name !== ""
      ) {
        dept.items.push(ShoppingList.createEmptyListItem());
      }
    });
    return shoppingList;
  };

  /**
   * Erstellt ein leeres Listenelement für den Edit-Modus.
   */
  static createEmptyListItem = (): ShoppingListItem => ({
    checked: false,
    quantity: 0,
    unit: "",
    item: {uid: Utils.generateUid(10), name: ""},
    type: ItemType.none,
    manualEdit: false,
    manualAdd: true,
  });

  /* =====================================================================
  // Leere Einträge entfernen
  // ===================================================================== */

  /**
   * Entfernt alle Items ohne Menge, Einheit und Name.
   */
  static deleteEmptyItems = ({shoppingList}: {shoppingList: ShoppingList}) => {
    Object.keys(shoppingList.list).forEach((departmentPos) => {
      shoppingList.list[Number(departmentPos) as Department["pos"]].items =
        shoppingList.list[Number(departmentPos) as Department["pos"]].items.filter(
          (item) =>
            !(item.quantity === 0 && item.unit === "" && item.item.name === ""),
        );
    });
    return shoppingList;
  };

  /* =====================================================================
  // Checked-Items extrahieren und wiederherstellen
  // ===================================================================== */

  /**
   * Liefert alle abgehakten Items gruppiert nach Department zurück.
   */
  static getCheckedItemsByDepartment = ({
    shoppingList,
  }: {
    shoppingList: ShoppingList;
  }): ShoppingList["list"] => {
    const result = {} as ShoppingList["list"];

    Object.entries(shoppingList.list).forEach(
      ([departmentPosStr, department]) => {
        const checked = department.items.filter((item) => item.checked);
        if (checked.length === 0) return;

        result[departmentPosStr as unknown as Department["pos"]] = {
          departmentUid: department.departmentUid,
          departmentName: department.departmentName,
          items: checked,
        };
      },
    );

    return result;
  };

  /**
   * Stellt den checked-Status anhand zuvor gespeicherter Items wieder her.
   *
   * @param params.shoppingList - Die Einkaufsliste
   * @param params.checkedItems - Zuvor gespeicherte abgehakte Items
   * @returns Die aktualisierte Einkaufsliste
   */
  static restoreCheckedItems = ({
    shoppingList,
    checkedItems,
  }: {
    shoppingList: ShoppingList;
    checkedItems: ShoppingList["list"];
  }) => {
    Object.entries(checkedItems).forEach(([departmentPosStr, department]) => {
      const departmentPos = Number(departmentPosStr) as Department["pos"];
      const dep = shoppingList.list[departmentPos];
      if (!dep) return;

      department.items.forEach((checkedItem) => {
        dep.items.forEach((item) => {
          if (
            item.item.uid === checkedItem.item.uid &&
            item.unit === checkedItem.unit
          ) {
            item.checked = true;
          }
        });
      });
    });
    return shoppingList;
  };

  /* =====================================================================
  // Manuelle Items extrahieren (für Refresh-Preserve)
  // ===================================================================== */

  /**
   * Extrahiert manuell hinzugefügte und/oder manuell bearbeitete Items
   * aus einer Einkaufsliste. Wird beim Refresh verwendet, um diese Items
   * zu bewahren.
   *
   * @param list - Die aktuelle Einkaufsliste
   * @param keepManuallyAdded - Manuell hinzugefügte Items behalten
   * @param keepManuallyEdited - Manuell bearbeitete Items behalten
   * @returns Gefilterte Liste mit nur manuellen Items
   */
  static preserveManualItems(
    list: ShoppingList["list"],
    keepManuallyAdded: boolean,
    keepManuallyEdited: boolean,
  ): ShoppingList["list"] {
    const preserved = _.cloneDeep(list);

    Object.entries(preserved).forEach(([departmentPos, department]) => {
      department.items = department.items.filter(
        (item) =>
          (keepManuallyAdded && item?.manualAdd === true) ||
          (keepManuallyEdited && item?.manualEdit === true),
      );

      if (department.items.length === 0) {
        delete preserved[departmentPos as unknown as Department["pos"]];
      }
    });

    return preserved;
  }

  /**
   * Merged manuell bewahrte Items in eine neu generierte Liste.
   *
   * - manualEdit-Items: Menge aus der alten Liste beibehalten
   * - manualAdd-Items: Falls UID+Menge identisch → addieren, sonst anhängen
   *
   * @param newList - Die neu generierte Liste (wird mutiert)
   * @param preservedItems - Die zu bewahrenden manuellen Items
   */
  static mergeManualItems(
    newList: ShoppingList,
    preservedItems: ShoppingList["list"],
  ): void {
    Object.entries(preservedItems).forEach(([departmentKey, department]) => {
      department.items.forEach((item) => {
        if (
          !Object.prototype.hasOwnProperty.call(newList.list, departmentKey)
        ) {
          newList.list[departmentKey as unknown as Department["pos"]] = {...department};
          return;
        }

        if (item.manualEdit) {
          // Manuell bearbeiteter Artikel: UID in neuer Liste suchen, Menge übernehmen
          const existing = newList.list[
            departmentKey as unknown as Department["pos"]
          ].items.find(
            (updatedItem: ShoppingListItem) =>
              updatedItem.item.uid === item.item.uid,
          );
          if (existing) {
            existing.quantity = item.quantity;
            existing.manualEdit = true;
          } else {
            newList.list[departmentKey as unknown as Department["pos"]].items.push(item);
          }
        } else {
          // Manuell hinzugefügter Artikel: bei identischem UID+Menge addieren
          const existing = newList.list[
            departmentKey as unknown as Department["pos"]
          ].items.find(
            (updatedItem: ShoppingListItem) =>
              updatedItem.item.uid === item.item.uid &&
              updatedItem.quantity === item.quantity,
          );
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            newList.list[departmentKey as unknown as Department["pos"]].items.push(item);
          }
        }
      });
    });
  }

  /**
   * Merged manuell bewahrte Trace-Einträge in einen neuen Trace.
   *
   * @param newTrace - Der neu generierte Trace (wird mutiert)
   * @param preservedItems - Die bewahrten manuellen Items
   * @param originalTrace - Die originalen Trace-Einträge der alten Liste
   */
  static mergeManualTraceEntries(
    newTrace: ShoppingListTrace,
    preservedItems: ShoppingList["list"],
    originalTrace: ShoppingListTrace,
  ): void {
    Object.values(preservedItems).forEach((department) => {
      department.items.forEach((item) => {
        if (!item.manualAdd) return;
        const traceEntries = originalTrace[item.item.uid];
        if (!traceEntries) return;

        const manualTraceEntries = traceEntries.filter((e) => e.manualAdd);
        if (manualTraceEntries.length === 0) return;

        if (!Object.prototype.hasOwnProperty.call(newTrace, item.item.uid)) {
          newTrace[item.item.uid] = [];
        }
        newTrace[item.item.uid] = newTrace[item.item.uid].concat(manualTraceEntries);
      });
    });
  }

  /* =====================================================================
  // Trace on-demand berechnen
  // ===================================================================== */

  /**
   * Berechnet den Trace on-demand, indem die Liste intern neu generiert
   * wird (ohne Persistenz). Ergänzt manualAdd- und manualEdit-Einträge
   * aus der bestehenden Liste.
   *
   * @param params - Menüplan, Rezepte, Stammdaten und bestehende Einkaufsliste
   * @returns Berechnete Trace-Map
   */
  static computeTrace(params: {
    selectedMenues: Menue["uid"][];
    selectedDepartments: Department["uid"][];
    menueplan: MenuplanData;
    recipes: {[key: string]: Recipe};
    products: Product[];
    materials: Material[];
    departments: Department[];
    units: Unit[];
    unitConversionBasic: UnitConversionBasic;
    unitConversionProducts: UnitConversionProducts;
    existingList: ShoppingList;
  }): ShoppingListTrace {
    const {existingList, ...createParams} = params;

    // Basis-Trace durch Neugenerierung der Liste ermitteln
    let trace: ShoppingListTrace = {};

    try {
      const result = ShoppingList.createNewList(createParams);
      trace = result.trace;
    } catch {
      // Keine Items gefunden (z.B. leerer Menüplan) — leerer Trace als Basis
    }

    // manualEdit-Items: Trace-Einträge mit manualEdit=true markieren
    Object.values(existingList.list).forEach((department) => {
      department.items.forEach((item) => {
        if (item.manualEdit && trace[item.item.uid]) {
          trace[item.item.uid].forEach((entry) => {
            entry.manualEdit = true;
          });
        }
      });
    });

    // manualAdd-Items: Trace-Eintrag hinzufügen
    Object.values(existingList.list).forEach((department) => {
      department.items.forEach((item) => {
        if (item.manualAdd) {
          trace = ShoppingList.addTraceEntry({
            trace,
            item: item.item as Product,
            menueUid: "",
            recipe: {} as {uid: string; name: string},
            quantity: item.quantity,
            unit: item.unit,
            addedManually: true,
            itemType: item.type,
          });
        }
      });
    });

    return trace;
  }

  /* =====================================================================
  // Items zählen
  // ===================================================================== */

  /**
   * Zählt die Gesamtanzahl der Items in der Liste.
   */
  static countItems = ({shoppingList}: {shoppingList: ShoppingList}) => {
    let result = 0;
    Object.values(shoppingList.list).forEach(
      (department) => (result += department.items.length),
    );
    return result;
  };

}
