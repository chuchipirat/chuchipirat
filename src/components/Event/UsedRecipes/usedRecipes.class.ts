/**
 * UsedRecipes — Domain-Klasse für benannte Rezeptlisten eines Events.
 *
 * Enthält reine Business-Logik. Persistenz erfolgt über das
 * UsedRecipeListRepository.
 *
 * @example
 * const usedRecipes = UsedRecipes.factory({event});
 * const recipeIds = UsedRecipes.defineSelectedRecipes({menueplan, selectedMenues});
 */
import AuthUser from "../../Firebase/Authentication/authUser.class";
import Recipe, {RecipeIdentifier} from "../../Recipe/recipe.class";
import {ChangeRecord} from "../../Shared/global.interface";
import {Utils} from "../../Shared/utils.class";
import {Event} from "../Event/event.class";

import {
  Meal,
  Menue,
  MenuplanData,
} from "../Menuplan/menuplan.types";
import {getMealsOfMenues, getMenuesOfMeals} from "../Menuplan/menuplanService";
import {UsedRecipeListDomain} from "../../Database/Repository/UsedRecipeListRepository";

import {ERROR_NO_RECIPES_FOUND as TEXT_ERROR_NO_RECIPES_FOUND} from "../../../constants/text";


interface Factory {
  event: Event;
}

interface DeleteList {
  usedRecipes: UsedRecipes;
  listUidToDelete: ListProperties["uid"];
  authUser: AuthUser;
}

interface EditListName {
  usedRecipes: UsedRecipes;
  listUidToEdit: ListProperties["uid"];
  newName: ListProperties["name"];
  authUser: AuthUser;
}

interface CreateNewListProperties {
  name: string;
  selectedMenues: Menue["uid"][];
  menueplan: MenuplanData;
}

/**
 * Eigenschaften einer benannten Rezeptliste.
 *
 * @param uid - Eindeutige ID der Liste
 * @param name - Anzeigename der Liste
 * @param selectedMeals - IDs der ausgewählten Mahlzeiten
 * @param selectedMenues - IDs der ausgewählten Menüs
 * @param generated - Änderungsprotokoll
 */
export interface ListProperties {
  uid: string;
  name: string;
  selectedMeals: Meal["uid"][];
  selectedMenues: Menue["uid"][];
  generated: ChangeRecord;
}

interface _DefineSelectedRecipes {
  menueplan: MenuplanData;
  selectedMenues: string[];
}

/**
 * Ergebnis der Drift-Erkennung.
 *
 * @param hasDrift - true, wenn Menüs im Menüplan verschoben wurden
 * @param currentMealsFromMenues - Aktuelle Meals, abgeleitet aus den gespeicherten Menüs
 * @param currentMenuesFromMeals - Aktuelle Menüs, abgeleitet aus den gespeicherten Meals
 */
export interface DriftDetectionResult {
  hasDrift: boolean;
  currentMealsFromMenues: string[];
  currentMenuesFromMeals: string[];
}

/**
 * Eintrag einer benannten Rezeptliste.
 *
 * @param properties - Kopfdaten der Liste (Name, Menü-Auswahl)
 * @param recipes - Rezepte der Liste
 */
export interface UsedRecipeListEntry {
  properties: ListProperties;
  recipes: {[key: Recipe["uid"]]: Recipe};
}


/**
 * Domain-Klasse für benannte Rezeptlisten eines Events.
 *
 * Statische Methoden für reine Business-Logik (Validierung,
 * In-Memory-Transformationen, Rezept-Identifikation).
 * Persistenz erfolgt über das UsedRecipeListRepository.
 */
export class UsedRecipes {
  uid: string;
  noOfLists: number;
  lists: {[key: string]: UsedRecipeListEntry};
  lastChange: ChangeRecord;  constructor() {
    this.uid = "";
    this.noOfLists = 0;
    this.lastChange = {date: new Date(0), fromUid: "", fromDisplayName: ""};
    this.lists = {};
  }  /**
   * Erstellt eine leere UsedRecipes-Instanz für ein Event.
   *
   * @param object - Objekt mit dem Event
   * @returns Neue UsedRecipes-Instanz mit gesetzter UID
   */
  static factory({event}: Factory) {
    const usedRecipes = new UsedRecipes();
    usedRecipes.uid = event.uid;
    return usedRecipes;
  }  /**
   * Erstellt ein UsedRecipes-Objekt aus Supabase-Domain-Listen.
   *
   * Konvertiert `UsedRecipeListDomain[]` in die UI-erwartete Struktur.
   * `selectedMeals` wird aus der persistierten Meal-Auswahl übernommen.
   * Fallback: Wenn `selectedMeals` leer ist (Pre-Migration-Listen), werden
   * die Meals aus den Menüs abgeleitet (Backfill-Pfad).
   * Rezepte (`recipes`) bleiben leer — sie werden bei Bedarf per
   * Repository + RPC geladen.
   *
   * @param lists - Array der Domain-Listen aus dem Repository
   * @param eventUid - UID des Events
   * @param menuplan - Menüplan-Daten (für Backfill-Ableitung)
   * @returns UsedRecipes-Instanz mit allen Listen (ohne Rezepte)
   */
  static fromDomainLists({
    lists,
    eventUid,
    menuplan,
  }: {
    lists: UsedRecipeListDomain[];
    eventUid: string;
    menuplan: MenuplanData;
  }): UsedRecipes {
    const usedRecipes = new UsedRecipes();
    usedRecipes.uid = eventUid;
    usedRecipes.noOfLists = lists.length;

    for (const list of lists) {
      // Persistierte Meals verwenden; Fallback auf Ableitung für Pre-Migration-Listen
      const selectedMeals =
        list.selectedMeals.length > 0
          ? list.selectedMeals
          : getMealsOfMenues({menuplan, menues: list.selectedMenues});

      usedRecipes.lists[list.id] = {
        properties: {
          uid: list.id,
          name: list.name,
          selectedMeals,
          selectedMenues: list.selectedMenues,
          generated: {
            date: list.updatedAt,
            fromUid: "",
            fromDisplayName: "",
          },
        },
        recipes: {},
      };
    }

    return usedRecipes;
  }  /**
   * Erkennt, ob Menüs im Menüplan zwischen Tagen/Mahlzeiten verschoben wurden.
   *
   * Vergleicht die gespeicherten Meals mit den aktuell aus den Menüs abgeleiteten
   * Meals. Drift liegt vor, wenn:
   * 1. Die Meals nicht mehr übereinstimmen (Menüs wurden verschoben)
   * 2. Die Anzahl Menüs sich ändert (neue Menüs in den Meals oder Menüs entfernt)
   *
   * @param selectedMeals - Gespeicherte Meal-IDs
   * @param selectedMenues - Gespeicherte Menü-IDs
   * @param menuplan - Aktueller Menüplan
   * @returns Ergebnis der Drift-Erkennung
   */
  static detectDrift(
    selectedMeals: Meal["uid"][],
    selectedMenues: Menue["uid"][],
    menuplan: MenuplanData,
  ): DriftDetectionResult {
    const currentMealsFromMenues = getMealsOfMenues({
      menuplan,
      menues: selectedMenues,
    });
    const currentMenuesFromMeals = getMenuesOfMeals({
      menuplan,
      meals: selectedMeals,
    });

    const hasDrift =
      !Utils.areStringArraysEqual(selectedMeals, currentMealsFromMenues) ||
      selectedMenues.length !== currentMenuesFromMeals.length;

    return {hasDrift, currentMealsFromMenues, currentMenuesFromMeals};
  }  /**
   * Entfernt eine Liste aus dem UsedRecipes-Objekt (in-memory).
   *
   * @param object - Objekt mit UsedRecipes und UID der zu löschenden Liste
   * @returns Kopie des UsedRecipes ohne die gelöschte Liste
   */
  static deleteList = ({
    usedRecipes,
    listUidToDelete,
    authUser,
  }: DeleteList) => {
    const updatedUsedRecipes = structuredClone(usedRecipes) as UsedRecipes;

    delete updatedUsedRecipes.lists[listUidToDelete];

    updatedUsedRecipes.lastChange = Utils.createChangeRecord(authUser);
    updatedUsedRecipes.noOfLists--;

    return updatedUsedRecipes;
  };  /**
   * Ändert den Namen einer Liste (in-memory).
   *
   * @param object - Objekt mit UsedRecipes, Listen-UID, neuem Namen und AuthUser
   * @returns Kopie des UsedRecipes mit geändertem Listennamen
   */
  static editListName = ({
    usedRecipes,
    listUidToEdit,
    newName,
    authUser,
  }: EditListName) => {
    const updatedUsedRecipes = structuredClone(usedRecipes) as UsedRecipes;

    updatedUsedRecipes.lists[listUidToEdit].properties.name = newName;
    updatedUsedRecipes.lastChange = Utils.createChangeRecord(authUser);

    return updatedUsedRecipes;
  };  /**
   * Validiert die Eingaben und erstellt die Eigenschaften für eine neue Liste.
   *
   * Prüft, ob die ausgewählten Menüs Rezepte enthalten. Die tatsächliche
   * Persistenz erfolgt über das UsedRecipeListRepository.
   *
   * @param object - Objekt mit Name, ausgewählten Menüs und Menüplan
   * @returns ListProperties für die neue Liste
   * @throws {Error} Wenn keine Rezepte in den ausgewählten Menüs gefunden werden
   */
  static createNewListProperties = ({
    name,
    selectedMenues,
    menueplan,
  }: CreateNewListProperties): ListProperties => {
    const recipeList = UsedRecipes.defineSelectedRecipes({
      selectedMenues,
      menueplan,
    });

    if (recipeList == undefined || recipeList.length == 0) {
      throw new Error(TEXT_ERROR_NO_RECIPES_FOUND);
    }

    return {
      uid: "",
      name,
      selectedMeals: [],
      selectedMenues,
      generated: {date: new Date(0), fromUid: "", fromDisplayName: ""},
    };
  };  /**
   * Leitet die Rezept-Identifikatoren aus den ausgewählten Menüs ab.
   *
   * Iteriert über alle Menüs → deren mealRecipeOrder → extrahiert Rezept-UIDs.
   * Gelöschte Rezepte (leere recipeUid) werden ignoriert.
   * Duplikate werden entfernt.
   *
   * @param object - Objekt mit Menüplan und ausgewählten Menüs
   * @returns Array eindeutiger RecipeIdentifier
   */
  static defineSelectedRecipes = ({
    menueplan,
    selectedMenues,
  }: _DefineSelectedRecipes) => {
    const usedRecipesList: RecipeIdentifier[] = [];

    selectedMenues.forEach((menueUid) => {
      menueplan.menues[menueUid].mealRecipeOrder.forEach((mealRecipeUid) => {
        if (
          menueplan.mealRecipes[mealRecipeUid].recipe &&
          menueplan.mealRecipes[mealRecipeUid].recipe.recipeUid
        ) {
          usedRecipesList.push({
            uid: menueplan.mealRecipes[mealRecipeUid].recipe.recipeUid,
            recipeType: menueplan.mealRecipes[mealRecipeUid].recipe.type,
            createdFromUid:
              menueplan.mealRecipes[mealRecipeUid].recipe.createdFromUid,
            eventUid: menueplan.uid,
          });
        }
      });
    });
    // Doppelte Werte löschen
    return UsedRecipes._getUniqRecipes(usedRecipesList);
  };  /**
   * Entfernt doppelte Rezepte aus einer Liste (nach UID).
   *
   * @param usedRecipesList - Array mit allen Rezepten (kann Duplikate enthalten)
   * @returns Array ohne Duplikate
   */
  static _getUniqRecipes = (usedRecipesList: RecipeIdentifier[]) => {
    return Array.from(new Set(usedRecipesList.map((recipe) => recipe.uid))).map(
      (uid) => {
        return usedRecipesList.find((recipe) => recipe.uid == uid);
      },
    ) as RecipeIdentifier[];
  };
}
