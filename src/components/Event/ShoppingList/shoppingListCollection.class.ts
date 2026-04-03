/**
 * ShoppingListCollection — Domain-Modell für die Übersicht aller
 * Einkaufslisten eines Events.
 *
 * Reine Geschäftslogik ohne Persistenz-Code. Verwaltet die
 * Listen-Properties (Name, Auswahlen) und bietet Factory-Methoden.
 *
 * Persistenz erfolgt über das ShoppingListRepository.
 * Traces werden bei Bedarf on-the-fly aus dem Menüplan berechnet
 * (kein separates Trace-Feld mehr in der DB).
 */
import {ChangeRecord} from "../../Shared/global.interface";
import {Unit} from "../../Unit/unit.class";
import {Event} from "../Event/event.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {Product} from "../../Product/product.types";
import {Meal, Menue, MenuplanData} from "../Menuplan/menuplan.types";
import {getMealsOfMenues, getMenuesOfMeals} from "../Menuplan/menuplanService";
import Recipe from "../../Recipe/recipe.class";
import {ShoppingList,
  ItemType,
  ShoppingListItem,
  ShoppingListTrace,
} from "./shoppingList.class";
import {
  UnitConversionBasic,
  UnitConversionProducts,
} from "../../Unit/unitConversion.class";
import Department from "../../Department/department.class";
import {Material} from "../../Material/material.types";

import {Utils} from "../../Shared/utils.class";


/**
 * Properties einer einzelnen Einkaufsliste.
 *
 * @param uid - Eindeutige ID der Liste
 * @param name - Anzeigename
 * @param selectedMeals - Ausgewählte Meal-IDs (für Drift-Erkennung)
 * @param selectedMenues - Ausgewählte Menü-IDs
 * @param selectedDepartments - Ausgewählte Abteilungs-IDs (Filter)
 * @param generated - Wer/wann die Liste generiert/aktualisiert wurde
 * @param hasManuallyAddedItems - Hat manuell hinzugefügte Positionen
 */
export interface ShoppingListProperties {
  uid: string;
  name: string;
  selectedMeals: Meal["uid"][];
  selectedMenues: Menue["uid"][];
  selectedDepartments: Department["uid"][];
  generated: ChangeRecord;
  hasManuallyAddedItems: boolean;
}

/**
 * @deprecated Wird nur noch für die Kompatibilität mit bestehendem UI-Code
 * exportiert. Trace-Daten werden in Supabase on-the-fly berechnet.
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
 * @deprecated Trace ist jetzt in ShoppingList.class.ts definiert.
 */
export type {ShoppingListTrace};

/**
 * Eintrag in der Listen-Übersicht — Properties + optionaler Trace.
 */
export interface ShoppingListEntry {
  properties: ShoppingListProperties;
  trace: ShoppingListTrace;
}


interface CreateNewListParams {
  name: string;
  selectedMenues: Menue["uid"][];
  selectedDepartments: Department["uid"][];
  shoppingListCollection: ShoppingListCollection;
  menueplan: MenuplanData;
  /** Vorgeladene Rezepte — Key: recipeUid, Value: Recipe-Objekt */
  recipes: {[key: string]: Recipe};
  products: Product[];
  materials: Material[];
  departments: Department[];
  units: Unit[];
  unitConversionBasic: UnitConversionBasic;
  unitConversionProducts: UnitConversionProducts;
  authUser: AuthUser;
}

interface RefreshListParams {
  shoppingListCollection: ShoppingListCollection;
  shoppingList: ShoppingList;
  keepManuallyAddedItems?: boolean;
  keepManuallyEditedItems?: boolean;
  menueplan: MenuplanData;
  /** Vorgeladene Rezepte — Key: recipeUid, Value: Recipe-Objekt */
  recipes: {[key: string]: Recipe};
  products: Product[];
  materials: Material[];
  departments: Department[];
  units: Unit[];
  unitConversionBasic: UnitConversionBasic;
  unitConversionProducts: UnitConversionProducts;
  authUser: AuthUser;
}

interface DeleteListParams {
  usedRecipes?: unknown;
  shoppingListCollection?: ShoppingListCollection;
  /** @deprecated Verwende shoppingListCollection statt shoppingListColection */
  shoppingListColection?: ShoppingListCollection;
  listUidToDelete: ShoppingList["uid"];
  authUser: AuthUser;
}

interface EditListNameParams {
  shoppingListCollection: ShoppingListCollection;
  listUidToEdit: ShoppingList["uid"];
  newName: ShoppingListProperties["name"];
  authUser: AuthUser;
}


/**
 * Domain-Modell für die Übersicht aller Einkaufslisten eines Events.
 *
 * Verwaltet Listen-Properties, bietet Factory-Methoden für Erstellen,
 * Aktualisieren und Löschen. Keine Persistenz-Logik enthalten —
 * der aufrufende Code (Handler-Hook) speichert über das Repository.
 */
export class ShoppingListCollection {
  noOfLists: number;
  lists: {[key: string]: ShoppingListEntry};
  lastChange: ChangeRecord;
  eventUid: Event["uid"];
  /** @deprecated Nicht mehr in der DB — Supabase-VIEW löst Produkte auf. */
  usedProducts?: Product["uid"][];
  /** @deprecated Nicht mehr in der DB — Supabase-VIEW löst Materialien auf. */
  usedMaterials?: Material["uid"][];

  /** Auch exportiert als uid für Kompatibilität */
  uid?: string;

  constructor() {
    this.noOfLists = 0;
    this.lastChange = {date: new Date(0), fromUid: "", fromDisplayName: ""};
    this.lists = {};
    this.eventUid = "";
  }
  /**
   * Erstellt eine leere ShoppingListCollection für ein Event.
   *
   * @param params.event - Das Event, für das die Collection erstellt wird
   * @returns Leere ShoppingListCollection
   */
  static factory = ({event}: {event: Event}) => {
    const collection = new ShoppingListCollection();
    collection.eventUid = event.uid;
    return collection;
  };
  /**
   * Erstellt eine neue Einkaufsliste und aktualisiert die Collection.
   *
   * Delegiert die Listengenerierung an ShoppingList.createNewList()
   * und fügt die Properties in die Collection ein.
   *
   * @param params - Name, Auswahlen, vorgeladene Rezepte, Stammdaten
   * @returns Aktualisierte Collection + generierte Liste + Trace
   */
  static createNewList(params: CreateNewListParams): {
    shoppingList: ShoppingList;
    trace: ShoppingListTrace;
    shoppingListCollection: ShoppingListCollection;
  } {
    const {
      name, selectedMenues, selectedDepartments, shoppingListCollection,
      menueplan, recipes, products, materials, departments, units,
      unitConversionBasic, unitConversionProducts, authUser,
    } = params;

    // Liste generieren
    const {shoppingList, trace} = ShoppingList.createNewList({
      selectedMenues,
      selectedDepartments,
      menueplan,
      recipes,
      products,
      materials,
      departments,
      units,
      unitConversionBasic,
      unitConversionProducts,
    });

    // Collection aktualisieren
    const updatedCollection = structuredClone(shoppingListCollection);
    updatedCollection.noOfLists++;

    // UID wird nach dem Speichern durch das Repository gesetzt —
    // hier als Platzhalter leer lassen
    updatedCollection.lists["__pending__"] = {
      properties: {
        uid: "",
        name,
        selectedMenues,
        selectedDepartments,
        selectedMeals: getMealsOfMenues({menuplan: menueplan, menues: selectedMenues}),
        generated: Utils.createChangeRecord(authUser),
        hasManuallyAddedItems: false,
      },
      trace,
    };

    return {shoppingList, trace, shoppingListCollection: updatedCollection};
  }
  /**
   * Aktualisiert eine bestehende Einkaufsliste (Refresh).
   *
   * Generiert die Liste neu aus dem Menüplan und merged optional
   * manuell hinzugefügte/bearbeitete Items.
   *
   * @param params - Aktuelle Collection, Liste, Optionen, Stammdaten
   * @returns Aktualisierte ShoppingList + Collection
   */
  static refreshList(params: RefreshListParams): {
    shoppingList: ShoppingList;
    shoppingListCollection: ShoppingListCollection;
  } {
    const {
      shoppingListCollection, shoppingList,
      keepManuallyAddedItems = false, keepManuallyEditedItems = false,
      menueplan, recipes, products, materials, departments, units,
      unitConversionBasic, unitConversionProducts, authUser,
    } = params;

    const updatedCollection = structuredClone(shoppingListCollection);
    const listEntry = updatedCollection.lists[shoppingList.uid];

    // Manuelle Items bewahren (falls gewünscht)
    let preservedItems: ShoppingList["list"] | undefined;
    if (keepManuallyAddedItems || keepManuallyEditedItems) {
      preservedItems = ShoppingList.preserveManualItems(
        shoppingList.list,
        keepManuallyAddedItems,
        keepManuallyEditedItems,
      );
    }

    // Drift-Erkennung: Menüs im Menüplan verschoben?
    if (
      !Utils.areStringArraysEqual(
        listEntry.properties.selectedMeals,
        getMealsOfMenues({
          menuplan: menueplan,
          menues: listEntry.properties.selectedMenues,
        }),
      ) ||
      listEntry.properties.selectedMenues.length !==
        getMenuesOfMeals({
          menuplan: menueplan,
          meals: listEntry.properties.selectedMeals,
        }).length
    ) {
      listEntry.properties.selectedMenues = getMenuesOfMeals({
        menuplan: menueplan,
        meals: listEntry.properties.selectedMeals,
      });
    }

    // Liste neu generieren
    const {shoppingList: newList, trace: newTrace} = ShoppingList.createNewList({
      selectedMenues: listEntry.properties.selectedMenues,
      selectedDepartments: listEntry.properties.selectedDepartments,
      menueplan,
      recipes,
      products,
      materials,
      departments,
      units,
      unitConversionBasic,
      unitConversionProducts,
    });

    newList.uid = shoppingList.uid;

    // Manuelle Items mergen
    if (preservedItems && (keepManuallyAddedItems || keepManuallyEditedItems)) {
      ShoppingList.mergeManualItems(newList, preservedItems);
      ShoppingList.mergeManualTraceEntries(
        newTrace,
        preservedItems,
        shoppingListCollection.lists[shoppingList.uid].trace,
      );
    }

    // Collection aktualisieren
    updatedCollection.lists[shoppingList.uid].trace = newTrace;
    updatedCollection.lists[shoppingList.uid].properties.generated =
      Utils.createChangeRecord(authUser);
    updatedCollection.lists[shoppingList.uid].properties.hasManuallyAddedItems =
      keepManuallyAddedItems;

    return {
      shoppingList: newList,
      shoppingListCollection: updatedCollection,
    };
  }
  /**
   * Entfernt eine Liste aus der Collection (optimistisches UI-Update).
   * Der Caller muss die Löschung im Repository separat durchführen.
   *
   * @param params - Collection, Liste zum Löschen, AuthUser
   * @returns Aktualisierte Collection
   */
  static deleteList({
    shoppingListCollection,
    shoppingListColection,
    listUidToDelete,
    authUser,
  }: DeleteListParams): ShoppingListCollection {
    // Abwärtskompatibilität: beide Varianten akzeptieren
    const collection = structuredClone(
      (shoppingListCollection ?? shoppingListColection)!,
    ) as ShoppingListCollection;

    delete collection.lists[listUidToDelete];

    collection.lastChange = {
      fromDisplayName: authUser.publicProfile.displayName,
      fromUid: authUser.uid,
      date: new Date(),
    };
    collection.noOfLists--;

    return collection;
  }
  /**
   * Ändert den Namen einer Liste in der Collection (optimistisches UI-Update).
   *
   * @param params - Collection, Listen-UID, neuer Name, AuthUser
   * @returns Aktualisierte Collection
   */
  static editListName({
    shoppingListCollection,
    listUidToEdit,
    newName,
    authUser,
  }: EditListNameParams): ShoppingListCollection {
    const updated = structuredClone(shoppingListCollection) as ShoppingListCollection;

    updated.lists[listUidToEdit].properties.name = newName;
    updated.lastChange = {
      fromDisplayName: authUser.publicProfile.displayName,
      fromUid: authUser.uid,
      date: new Date(),
    };

    return updated;
  }

}
