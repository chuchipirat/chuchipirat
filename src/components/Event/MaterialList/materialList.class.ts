import * as Sentry from "@sentry/react";
import Material, {MaterialType} from "../../Material/material.class";
import {ChangeRecord} from "../../Shared/global.interface";
import Utils from "../../Shared/utils.class";
import {
  Meal,
  Menue,
  MenuplanData,
} from "../Menuplan/menuplan.types";
import {getMealsOfMenues, getMenuesOfMeals} from "../Menuplan/menuplanService";

import {UsedRecipes} from "../UsedRecipes/usedRecipes.class";

import {ERROR_NO_RECIPES_FOUND as TEXT_ERROR_NO_RECIPES_FOUND} from "../../../constants/text";
import Recipe, {RecipeMaterialPosition, Recipes} from "../../Recipe/recipe.class";
import {ProductTrace} from "../ShoppingList/shoppingListCollection.class";
import {ItemType} from "../ShoppingList/shoppingList.class";

/**
 * Einzelne Liste mit Properties und Items.
 */
export interface MaterialListEntry {
  properties: ListProperties;
  items: MaterialListMaterial[];
}

/**
 * Materialposition in einer Materialliste.
 *
 * @param checked - Abgehakt
 * @param name - Materialname
 * @param uid - Material-UID (oder generierte UID bei Freitext)
 * @param type - Materialtyp
 * @param quantity - Menge
 * @param trace - Herkunfts-Trace (nur in-memory, nicht in DB)
 * @param manualEdit - Manuell bearbeitet
 * @param manualAdd - Manuell hinzugefügt
 * @param supabaseId - Supabase-Row-ID für granulare Updates
 * @param assignedCookId - ID des zugewiesenen Kochs (event_cooks.id)
 * @param assignedCookName - Freitext-Koch-Name
 * @param resolvedCookName - Aufgelöster Koch-Anzeigename
 */
export interface MaterialListMaterial {
  checked: boolean;
  name: Material["name"];
  uid: Material["uid"];
  type: MaterialType;
  quantity: number;
  trace: ProductTrace[];
  manualEdit?: boolean;
  manualAdd?: boolean;
  supabaseId?: string;
  assignedCookId?: string | null;
  assignedCookName?: string | null;
  resolvedCookName?: string | null;
}

/**
 * Kopfdaten einer Materialliste.
 */
interface ListProperties {
  uid: string;
  name: string;
  selectedMeals: Meal["uid"][];
  selectedMenues: Menue["uid"][];
  generated: ChangeRecord;
}

interface DeleteList {
  materialList: MaterialList;
  listUidToDelete: ListProperties["uid"];
}
interface EditListName {
  materialList: MaterialList;
  listUidToEdit: ListProperties["uid"];
  newName: ListProperties["name"];
}
interface AddItem {
  material: Material;
  list: MaterialListMaterial[];
  quantity: number;
  planedPortions?: number;
  manualAdd?: boolean;
  recipeUid?: Recipe["uid"];
  recipeName?: Recipe["name"];
  menueUid?: Menue["uid"];
}
interface DeleteMaterialFromList {
  materialUid: Material["uid"];
  list: MaterialListMaterial[];
}
interface CreateNewListParams {
  name: string;
  selectedMenues: Menue["uid"][];
  menueplan: MenuplanData;
  materials: Material[];
  recipes: Recipes;
}
interface RefreshListParams {
  listUidToRefresh: string;
  materialList: MaterialList;
  keepManuallyAddedItems?: boolean;
  menueplan: MenuplanData;
  materials: Material[];
  recipes: Recipes;
}

/**
 * Domain-Klasse für Materiallisten eines Events.
 *
 * Enthält reine Business-Logik (kein Firebase/Supabase). Persistenz
 * erfolgt über MaterialListRepository via useMaterialListHandlers.
 */
export default class MaterialList {
  uid: string;
  lists: {
    [key: string]: MaterialListEntry;
  };
  lastChange: ChangeRecord;

  /* =====================================================================
  // Konstruktor
  // ===================================================================== */
  constructor() {
    this.uid = "";
    this.lists = {};
    this.lastChange = {date: new Date(0), fromUid: "", fromDisplayName: ""};
  }

  /* =====================================================================
  // Neue Liste erstellen (synchron — Rezepte werden vorgeladen übergeben)
  // ===================================================================== */

  /**
   * Erstellt eine neue Materialliste aus dem Menüplan.
   *
   * Verwendet vorgeladene Rezepte statt Firebase-Calls. Berechnet
   * Materialbedarfe über Math.max (Peak-Bedarf, nicht Summe).
   *
   * @param params - Name, Menüs, Menüplan, Materialien, Rezepte
   * @returns MaterialListEntry mit berechneten Items
   * @throws {Error} Wenn keine Rezepte gefunden werden
   */
  static createNewList({
    name,
    selectedMenues,
    menueplan,
    materials,
    recipes,
  }: CreateNewListParams): MaterialListEntry {
    const listEntry: MaterialListEntry = {
      properties: {
        uid: Utils.generateUid(5),
        name: name,
        selectedMeals: getMealsOfMenues({
          menuplan: menueplan,
          menues: selectedMenues,
        }),
        selectedMenues: selectedMenues,
        generated: {date: new Date(), fromUid: "", fromDisplayName: ""},
      },
      items: [],
    };

    // Alle Rezepte in den Menüs herausfiltern, die selektiert wurden
    const recipeList = UsedRecipes.defineSelectedRecipes({
      selectedMenues: selectedMenues,
      menueplan: menueplan,
    });

    if (!recipeList || recipeList.length === 0) {
      throw new Error(TEXT_ERROR_NO_RECIPES_FOUND);
    }

    // Über gewählte Menüs loopen
    selectedMenues.forEach((menueUid) => {
      // Über alle Rezepte dieses Menü loopen
      menueplan.menues[menueUid].mealRecipeOrder.forEach((mealRecipeUid) => {
        // Gelöschtes Rezept überspringen
        if (!menueplan.mealRecipes[mealRecipeUid].recipe.recipeUid) {
          return;
        }

        const recipeUid = menueplan.mealRecipes[mealRecipeUid].recipe.recipeUid;
        const recipe = recipes[recipeUid];
        if (!recipe) {
          Sentry.addBreadcrumb({
            category: "materialList",
            message: `Rezept ${recipeUid} nicht in vorgeladenen Rezepten gefunden`,
            level: "warning",
          });
          return;
        }

        // Alle Materialien holen und skalieren
        const scaledMaterials = Recipe.scaleMaterials({
          recipe: recipe,
          portionsToScale: menueplan.mealRecipes[mealRecipeUid].totalPortions,
        });

        // Alle skalierten Materialien hinzufügen
        Object.values(scaledMaterials).forEach(
          (recipeMaterial: RecipeMaterialPosition) => {
            const material = materials.find(
              (candidate) => candidate.uid === recipeMaterial.material.uid,
            );

            if (material?.type === MaterialType.usage) {
              listEntry.items = MaterialList.addMaterialToList({
                material: material,
                list: listEntry.items,
                quantity: recipeMaterial.quantity,
                planedPortions:
                  menueplan.mealRecipes[mealRecipeUid].totalPortions,
                recipeName: recipe.name,
                recipeUid: recipe.uid,
                menueUid: menueUid,
              });
            }
          },
        );
      });

      // Material aus dem Menü ebenfalls hinzufügen
      menueplan.menues[menueUid].materialOrder.forEach((materialMenuUid) => {
        const menuPlanMaterialEntry = menueplan.materials[materialMenuUid];

        const material = materials.find(
          (candidate) => candidate.uid === menuPlanMaterialEntry.materialUid,
        );
        if (material?.type === MaterialType.usage) {
          listEntry.items = MaterialList.addMaterialToList({
            material: material,
            list: listEntry.items,
            quantity: menuPlanMaterialEntry.totalQuantity,
            menueUid: menueUid,
          });
        }
      });
    });

    return listEntry;
  }

  /* =====================================================================
  // Bestehende Liste aktualisieren (synchron)
  // ===================================================================== */

  /**
   * Aktualisiert eine bestehende Materialliste mit dem aktuellen Menüplan.
   *
   * Erkennt Drift (verschobene Menüs) und behält bei Bedarf
   * manuell hinzugefügte Items.
   *
   * @param params - Liste-ID, MaterialList, Flags, Menüplan, Materialien, Rezepte
   * @returns Aktualisierte MaterialList
   */
  static refreshList({
    listUidToRefresh,
    materialList,
    keepManuallyAddedItems = false,
    menueplan,
    materials,
    recipes,
  }: RefreshListParams): MaterialList {
    let manuallyAddedItems: MaterialListMaterial[] = [];
    // Tiefe Kopie erstellen
    const updatedMaterialList = JSON.parse(JSON.stringify(materialList)) as MaterialList;
    const listToUpdate = updatedMaterialList.lists[listUidToRefresh];

    if (keepManuallyAddedItems) {
      manuallyAddedItems = listToUpdate.items.filter(
        (material) => material.manualAdd === true,
      );
    }

    // Drift-Erkennung: Menüs im Menüplan verschoben?
    if (
      !Utils.areStringArraysEqual(
        listToUpdate.properties.selectedMeals,
        getMealsOfMenues({
          menuplan: menueplan,
          menues: listToUpdate.properties.selectedMenues,
        }),
      ) ||
      listToUpdate.properties.selectedMenues.length !==
        getMenuesOfMeals({
          menuplan: menueplan,
          meals: listToUpdate.properties.selectedMeals,
        }).length
    ) {
      listToUpdate.properties.selectedMenues = getMenuesOfMeals({
        menuplan: menueplan,
        meals: listToUpdate.properties.selectedMeals,
      });
    }

    const result = MaterialList.createNewList({
      name: listToUpdate.properties.name,
      selectedMenues: listToUpdate.properties.selectedMenues,
      menueplan: menueplan,
      materials: materials,
      recipes: recipes,
    });

    // selectedMeals beibehalten (Refresh, nicht Neuerstellung)
    result.properties.selectedMeals = listToUpdate.properties.selectedMeals;

    if (keepManuallyAddedItems) {
      updatedMaterialList.lists[listUidToRefresh] = {
        properties: result.properties,
        items: [...result.items, ...manuallyAddedItems],
      };
    } else {
      updatedMaterialList.lists[listUidToRefresh] = result;
    }
    updatedMaterialList.lists[listUidToRefresh].properties.uid =
      listUidToRefresh;

    return updatedMaterialList;
  }

  /* =====================================================================
  // Liste löschen
  // ===================================================================== */

  /**
   * Entfernt eine Liste aus der MaterialList-Struktur.
   *
   * @param params - MaterialList und UID der zu löschenden Liste
   * @returns Aktualisierte MaterialList ohne die gelöschte Liste
   */
  static deleteList = ({materialList, listUidToDelete}: DeleteList) => {
    const updatedMaterialList = JSON.parse(JSON.stringify(materialList)) as MaterialList;
    delete updatedMaterialList.lists[listUidToDelete];
    return updatedMaterialList;
  };

  /* =====================================================================
  // Listenname bearbeiten
  // ===================================================================== */

  /**
   * Ändert den Namen einer bestehenden Liste.
   *
   * @param params - MaterialList, Listen-UID und neuer Name
   * @returns Aktualisierte MaterialList mit neuem Namen
   */
  static editListName = ({
    materialList,
    listUidToEdit,
    newName,
  }: EditListName) => {
    const updatedMaterialList = JSON.parse(JSON.stringify(materialList)) as MaterialList;
    updatedMaterialList.lists[listUidToEdit].properties.name = newName;
    return updatedMaterialList;
  };

  /* =====================================================================
  // Material zur Liste hinzufügen
  // ===================================================================== */

  /**
   * Fügt ein Material zur Liste hinzu oder passt die Menge an.
   *
   * Bei Materialien wird Math.max verwendet (Peak-Bedarf), nicht die Summe.
   * Jeder Aufruf erzeugt einen Trace-Eintrag.
   *
   * @param params - Material, Liste, Menge und Trace-Infos
   * @returns Aktualisierte Item-Liste
   */
  static addMaterialToList = ({
    material,
    list,
    quantity,
    planedPortions,
    manualAdd = false,
    recipeUid = "",
    recipeName = "",
    menueUid = "",
  }: AddItem) => {
    const materialInList = list.find((existingMaterial) => existingMaterial.uid === material.uid);

    if (materialInList) {
      // Peak-Bedarf: Math.max statt Summe
      materialInList.quantity = Math.max(materialInList.quantity, quantity);
      materialInList.trace.push({
        menueUid: menueUid,
        recipe: {uid: recipeUid, name: recipeName},
        planedPortions: planedPortions ?? 0,
        quantity: quantity,
        unit: "",
        manualAdd: manualAdd,
        itemType: ItemType.material,
      });
    } else {
      list.push({
        checked: false,
        name: material.name,
        uid: material.uid,
        type: material.type,
        quantity: quantity,
        trace: [
          {
            menueUid: menueUid,
            recipe: {uid: recipeUid, name: recipeName},
            planedPortions: planedPortions ?? 0,
            quantity: quantity,
            unit: "",
            manualAdd: manualAdd,
            itemType: ItemType.material,
          },
        ],
      });
    }

    return list;
  };

  /* =====================================================================
  // Material aus Liste entfernen
  // ===================================================================== */

  /**
   * Entfernt ein Material aus der Liste.
   *
   * @param params - Material-UID und aktuelle Liste
   * @returns Gefilterte Liste ohne das entfernte Material
   */
  static deleteMaterialFromList = ({
    materialUid,
    list,
  }: DeleteMaterialFromList) => {
    return list.filter((material) => material.uid !== materialUid);
  };

  /* =====================================================================
  // Trace on-demand berechnen
  // ===================================================================== */

  /**
   * Berechnet den Herkunfts-Trace für ein Material on-demand.
   *
   * Durchsucht die ausgewählten Menüs im Menüplan und ermittelt,
   * welche Rezepte das gegebene Material verwenden.
   *
   * @param materialUid - UID des Materials
   * @param selectedMenues - Ausgewählte Menü-UIDs
   * @param menueplan - Aktueller Menüplan
   * @param materials - Alle Materialien
   * @param recipes - Vorgeladene Rezepte
   * @returns Array von ProductTrace-Einträgen
   */
  static computeTrace({
    materialUid,
    selectedMenues,
    menueplan,
    materials,
    recipes,
  }: {
    materialUid: string;
    selectedMenues: string[];
    menueplan: MenuplanData;
    materials: Material[];
    recipes: Recipes;
  }): ProductTrace[] {
    const traces: ProductTrace[] = [];

    selectedMenues.forEach((menueUid) => {
      menueplan.menues[menueUid]?.mealRecipeOrder.forEach((mealRecipeUid) => {
        // Gelöschtes Rezept überspringen
        if (!menueplan.mealRecipes[mealRecipeUid].recipe.recipeUid) {
          return;
        }

        const recipeUid = menueplan.mealRecipes[mealRecipeUid].recipe.recipeUid;
        const recipe = recipes[recipeUid];
        if (!recipe) return;

        const scaledMaterials = Recipe.scaleMaterials({
          recipe: recipe,
          portionsToScale: menueplan.mealRecipes[mealRecipeUid].totalPortions,
        });

        Object.values(scaledMaterials).forEach(
          (recipeMaterial: RecipeMaterialPosition) => {
            if (recipeMaterial.material.uid === materialUid) {
              const material = materials.find(
                (candidate) => candidate.uid === materialUid,
              );
              if (material?.type === MaterialType.usage) {
                traces.push({
                  menueUid: menueUid,
                  recipe: {uid: recipe.uid, name: recipe.name},
                  planedPortions:
                    menueplan.mealRecipes[mealRecipeUid].totalPortions,
                  quantity: recipeMaterial.quantity,
                  unit: "",
                  manualAdd: false,
                  itemType: ItemType.material,
                });
              }
            }
          },
        );
      });

      // Material direkt am Menü
      menueplan.menues[menueUid]?.materialOrder.forEach((materialMenuUid) => {
        const entry = menueplan.materials[materialMenuUid];
        if (entry?.materialUid === materialUid) {
          traces.push({
            menueUid: menueUid,
            recipe: {uid: "", name: ""},
            planedPortions: 0,
            quantity: entry.totalQuantity,
            unit: "",
            manualAdd: false,
            itemType: ItemType.material,
          });
        }
      });
    });

    return traces;
  }

  /* =====================================================================
  // Hilfsmethoden
  // ===================================================================== */

  /**
   * Zählt die Gesamtanzahl der Items über alle Listen.
   *
   * @param materialList - Die MaterialList-Instanz
   * @returns Gesamtanzahl der Items
   */
  static countItems(materialList: MaterialList): number {
    return Object.values(materialList.lists).reduce(
      (sum, entry) => sum + entry.items.length,
      0,
    );
  }
}
