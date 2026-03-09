import Firebase from "../../Firebase/firebase.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import Material, {MaterialType} from "../../Material/material.class";
import {ChangeRecord} from "../../Shared/global.interface";
import Utils from "../../Shared/utils.class";
import Event from "../Event/event.class";
import {
  Meal,
  MealRecipeDeletedPrefix,
  Menue,
  MenuplanData,
} from "../Menuplan/menuplan.types";
import {getMealsOfMenues, getMenuesOfMeals} from "../Menuplan/menuplanService";
import _ from "lodash";

import UsedRecipes from "../UsedRecipes/usedRecipes.class";

import {ERROR_NO_RECIPES_FOUND as TEXT_ERROR_NO_RECIPES_FOUND} from "../../../constants/text";
import Recipe, {RecipeMaterialPosition} from "../../Recipe/recipe.class";
import {ProductTrace} from "../ShoppingList/shoppingListCollection.class";
import FirebaseAnalyticEvent from "../../../constants/firebaseEvent";
import Stats, {StatsField} from "../../Shared/stats.class";
import {ItemType} from "../ShoppingList/shoppingList.class";
import {logEvent} from "firebase/analytics";

export interface MaterialListEntry {
  properties: ListProperties;
  items: MaterialListMaterial[];
}

export interface MaterialListMaterial {
  checked: boolean;
  name: Material["name"];
  uid: Material["uid"];
  type: MaterialType;
  quantity: number;
  trace: ProductTrace[];
  manualEdit?: boolean;
  manualAdd?: boolean;
}

interface ListProperties {
  uid: string;
  name: string;
  selectedMeals: Meal["uid"][];
  selectedMenues: Menue["uid"][];
  generated: ChangeRecord;
}

interface Save {
  materialList: MaterialList;
  firebase: Firebase;
  authUser: AuthUser;
}
interface Delete {
  eventUid: Event["uid"];
  firebase: Firebase;
}
interface GetMaterialListListener {
  firebase: Firebase;
  uid: string;
  callback: (materialList: MaterialList) => void;
  errorCallback: (error: Error) => void;
}
interface Factory {
  event: Event;
  authUser: AuthUser;
}
interface CreateNewList {
  name: string;
  selectedMenues: Menue["uid"][];
  menueplan: MenuplanData;
  materials: Material[];
  firebase: Firebase;
  authUser: AuthUser;
}
interface DeleteList {
  materialList: MaterialList;
  listUidToDelete: ListProperties["uid"];
  authUser: AuthUser;
}
interface EditListName {
  materialList: MaterialList;
  listUidToEdit: ListProperties["uid"];
  newName: ListProperties["name"];
  authUser: AuthUser;
}
interface AddItem {
  material: Material;
  list: MaterialListMaterial[];
  quantity: number;
  planedPortions?: number;
  manuelAdd?: boolean;
  recipeUid?: Recipe["uid"];
  recipeName?: Recipe["name"];
  menueUid?: Menue["uid"];
}
interface DeleteMaterialFromList {
  materialUid: Material["uid"];
  list: MaterialListMaterial[];
}
interface RefreshLists {
  listUidToRefresh: string;
  materialList: MaterialList;
  keepManuallyAddedItems?: boolean;
  menueplan: MenuplanData;
  materials: Material[];
  firebase: Firebase;
  authUser: AuthUser;
}

export default class MaterialList {
  uid: string;
  noOfLists: number;
  lists: {
    [key: string]: MaterialListEntry;
  };
  lastChange: ChangeRecord;

  /* =====================================================================
  // Konstruktor
  // ===================================================================== */
  constructor() {
    this.uid = "";
    this.noOfLists = 0;
    this.lists = {};
    this.lastChange = {date: new Date(0), fromUid: "", fromDisplayName: ""};
  }
  // ===================================================================== */
  /**
   * Factory
   * @param object - Referenz zu Event und AuthUser
   * @returns Objekt vom Typ MaterialList
   */
  static factory = ({event, authUser}: Factory) => {
    return {
      uid: event.uid,
      noOfLists: 0,
      lists: {},
      lastChange: Utils.createChangeRecord(authUser),
    } as MaterialList;
  };
  // ===================================================================== */
  /**
   * Materialliste Speichern
   * @param object - Objekt mit Materialliste, Firebase und Authuser
   * @returns void
   */
  static save = async ({materialList, firebase, authUser}: Save) => {
    materialList.lastChange = Utils.createChangeRecord(authUser);

    firebase.event.materialList
      .set({
        uids: [materialList.uid],
        value: materialList,
        authUser: authUser,
      })
      .then((result) => {
        return result;
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  };
  // ===================================================================== */
  /**
   * Materialliste löschen (gesamtes Dokument)
   * @param object - Objekt Event-UID und Firebase
   * @returns void
   */
  static delete = async ({eventUid, firebase}: Delete) => {
    firebase.event.materialList
      .delete({uids: [eventUid]})
      .then(() => {
        Stats.incrementStat({
          field: StatsField.noMaterialLists,
          value: -1,
          firebase: firebase,
        });
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  };
  // ===================================================================== */
  /**
   * Listener für Materialliste holen
   * @param object - Objekt mit Firebase, Eventuid und Callback Funktion
   * @returns void
   */
  static getMaterialListListener = async ({
    firebase,
    uid,
    callback,
    errorCallback,
  }: GetMaterialListListener) => {
    const materialListCallback = (materialList: MaterialList) => {
      // Menüplan mit UID anreichern
      materialList.uid = uid;
      callback(materialList);
    };

    return await firebase.event.materialList
      .listen<MaterialList>({
        uids: [uid],
        callback: materialListCallback,
        errorCallback: errorCallback,
      })
      .then((result) => {
        return result;
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  };
  // ===================================================================== */
  /**
   * Neue Liste erstellen
   * @param object - Objekt mit Name der Liste, gewählte Menüs, Menüplan,
   *                 Event-UID, Liste mit Materialien, Firebase und AuthUser
   * @returns void
   */
  static createNewList = async ({
    name,
    selectedMenues,
    menueplan,
    materials,
    firebase,
    authUser,
  }: CreateNewList) => {
    // Es wird mit den Menüs gearbeitet. Aber gespeichert werden die
    // Mahlzeiten. --> Wenn die Menüs verschoben werden, müssen die
    // Augrund der gewählten Mahlzeit neu bestimmt werden.
    const listEntry = {
      properties: {
        uid: Utils.generateUid(5),
        name: name,
        selectedMeals: getMealsOfMenues({
          menuplan: menueplan,
          menues: selectedMenues,
        }),
        selectedMenues: selectedMenues,
        generated: Utils.createChangeRecord(authUser),
      },
      items: [],
    } as MaterialListEntry;

    // Alle Rezepte in den Menüs herausfiltern, die selektiert wurden
    const recipeList = UsedRecipes.defineSelectedRecipes({
      selectedMenues: selectedMenues,
      menueplan: menueplan,
    });

    if (recipeList == undefined || recipeList.length == 0) {
      throw new Error(TEXT_ERROR_NO_RECIPES_FOUND);
    }

    // Alle Rezepte holen
    // @ts-expect-error — Legacy Firebase-Methode, wird bei Migration entfernt
    await Recipe.getMultipleRecipes({
      firebase: firebase,
      recipes: recipeList,
    })
      .then((result) => {
        // Über gewählte Menüs loopen
        selectedMenues.forEach((menueUid) => {
          // Über alle Rezepte dieses Menü loopen
          menueplan.menues[menueUid].mealRecipeOrder.forEach(
            (mealRecipeUid) => {
              if (
                menueplan.mealRecipes[mealRecipeUid].recipe.recipeUid.includes(
                  MealRecipeDeletedPrefix
                )
              ) {
                // gelöschte Rezepte ausschliessen
                return;
              }

              // Alle Zutaten und Materiale holen
              const scaledMaterials = Recipe.scaleMaterials({
                recipe:
                  result[menueplan.mealRecipes[mealRecipeUid].recipe.recipeUid],
                portionsToScale:
                  menueplan.mealRecipes[mealRecipeUid].totalPortions,
              });

              // Alle skalierten Materialien hinzufügen
              Object.values(scaledMaterials).forEach(
                (recipeMaterial: RecipeMaterialPosition) => {
                  // Prüfen ob ein Gebrauchsmaterial
                  const material = materials.find(
                    (materialRecord) =>
                      materialRecord.uid == recipeMaterial.material.uid
                  );

                  if (material?.type == MaterialType.usage) {
                    listEntry.items = MaterialList.addMaterialToList({
                      material: material,
                      list: listEntry.items,
                      quantity: recipeMaterial.quantity,
                      planedPortions:
                        menueplan.mealRecipes[mealRecipeUid].totalPortions,
                      recipeName:
                        result[
                          menueplan.mealRecipes[mealRecipeUid].recipe.recipeUid
                        ].name,
                      recipeUid:
                        result[
                          menueplan.mealRecipes[mealRecipeUid].recipe.recipeUid
                        ].uid,
                      menueUid: menueUid,
                    });
                  }
                }
              );
            }
          );
          // Material aus dem Menü ebenefalls hinzufügen
          menueplan.menues[menueUid].materialOrder.forEach(
            (materialMenuUid) => {
              const menuPlanMaterialEntry =
                menueplan.materials[materialMenuUid];

              const material = materials.find(
                (material) => material.uid == menuPlanMaterialEntry.materialUid
              );
              if (material?.type == MaterialType.usage) {
                listEntry.items = MaterialList.addMaterialToList({
                  material: material,
                  list: listEntry.items,
                  quantity: menuPlanMaterialEntry.totalQuantity,
                  menueUid: menueUid,
                });
              }
            }
          );
        });
      })
      .then(() => {
        // Statistik mitführen
        Stats.incrementStat({
          firebase: firebase,
          field: StatsField.noMaterialLists,
          value: 1,
        });

        logEvent(
          firebase.analytics,
          FirebaseAnalyticEvent.materialListGenerated
        );
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });

    return listEntry;
  };
  // ===================================================================== */
  /**
   * Neue Liste erstellen
   * @param object - Objekt mit MateriaListe und UID die es zu löschen gilt
   * @returns Angepasstes MateriaListe
   */
  static deleteList = ({
    materialList,
    listUidToDelete,
    authUser,
  }: DeleteList) => {
    const updatedMaterialList = _.cloneDeep(materialList) as MaterialList;

    delete updatedMaterialList.lists[listUidToDelete];

    updatedMaterialList.lastChange = Utils.createChangeRecord(authUser);
    updatedMaterialList.noOfLists--;

    return updatedMaterialList;
  };
  // ===================================================================== */
  /**
   * Name einer Liste anpassen
   * @param object - Objekt mit UsedRecipes und UID angepasst wird, neuer
   * Name der Liste und Authuser
   * @returns Angepasstes Used Recipes
   */
  static editListName = ({
    materialList,
    listUidToEdit,
    newName,
    authUser,
  }: EditListName) => {
    const updatedMaterialList = _.cloneDeep(materialList) as MaterialList;

    updatedMaterialList.lists[listUidToEdit].properties.name = newName;
    updatedMaterialList.lastChange = Utils.createChangeRecord(authUser);

    return updatedMaterialList;
  };

  // ===================================================================== */
  /**
   * Material zur Liste hinzufügen
   * @param object - Objekt mit Material und Array der bestehenden Liste
   * @returns Liste mit hinzugefügten Material
   */
  static addMaterialToList = ({
    material,
    list,
    quantity,
    planedPortions,
    manuelAdd = false,
    recipeUid = "",
    recipeName = "",
    menueUid = "",
  }: AddItem) => {
    // Prüfen ob es das Material bereits gibt
    const materialInList = list.find(
      (materialInList) => materialInList.uid == material.uid
    );

    if (materialInList) {
      // Nur die Menge anpassen und einen Trace Eintrag hinzufügen
      materialInList.quantity = Math.max(materialInList.quantity, quantity);
      materialInList.trace.push({
        menueUid: menueUid,
        recipe: {uid: recipeUid, name: recipeName},
        planedPortions: planedPortions ? planedPortions : 0,
        quantity: quantity,
        unit: "",
        manualAdd: manuelAdd,
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
            planedPortions: planedPortions ? planedPortions : 0,
            quantity: quantity,
            unit: "",
            manualAdd: manuelAdd,
            itemType: ItemType.material,
          },
        ],
      });
    }

    return list;
  };
  // ===================================================================== */
  /**
   * Material von Liste entfernen
   * @param object - Objekt mit Material und Array der bestehenden Liste
   * @returns Liste mit hinzugefügten Material
   */
  static deleteMaterialFromList = ({
    materialUid,
    list,
  }: DeleteMaterialFromList) => {
    return list.filter((material) => material.uid !== materialUid);
  };
  // ===================================================================== */
  /**
   * Bestehende Liste aktualisieren
   * @param object - Objekt mit Referenz zu Materialliste, ID der Liste,
   *                 die angepasst werden soll, Wert ob manuelle Werte bei-
   *                 behalten werden sollen, Menüplan, Materialien,
   *                 Firebase und Authuser
   * @returns Aktualisierte Materialliste
   */
  static refreshList = async ({
    listUidToRefresh,
    materialList,
    keepManuallyAddedItems = false,
    menueplan,
    materials,
    firebase,
    authUser,
  }: RefreshLists) => {
    let manuallyAddedItems: MaterialListMaterial[] = [];
    const updatedMaterialList = _.cloneDeep(materialList) as MaterialList;
    const listToUpdate = updatedMaterialList.lists[listUidToRefresh];

    if (keepManuallyAddedItems) {
      manuallyAddedItems = listToUpdate.items.filter((material) =>
        material.trace.some((trace) => trace.manualAdd == true)
      );
    }

    // überprüfen ob die gewählten Menüs auch in den Mahlzeiten sind.
    // Wenn die Menüs im Menüplan verschoben werden, müssen die Menüs neu definiert werden
    // Anhand der Mahlzeiten (die mitgespeichert werden)
    if (
      !Utils.areStringArraysEqual(
        listToUpdate.properties.selectedMeals,
        getMealsOfMenues({
          menuplan: menueplan,
          menues: listToUpdate.properties.selectedMenues,
        })
      ) ||
      // Sind neue Menü dazugekommen/ oder wurden Menüs aus der
      // Auswahl entfernt
      listToUpdate.properties.selectedMenues.length !==
        getMenuesOfMeals({
          menuplan: menueplan,
          meals: listToUpdate.properties.selectedMeals,
        }).length
    ) {
      // Die Menüs wurden geändert. Daher müssen wir jetzt
      // die Menüs neu bestimmen anhand der Mahlzeiten
      listToUpdate.properties.selectedMenues = getMenuesOfMeals({
        menuplan: menueplan,
        meals: listToUpdate.properties.selectedMeals,
      });
    }

    await MaterialList.createNewList({
      name: listToUpdate.properties.name,
      selectedMenues: listToUpdate.properties.selectedMenues,
      menueplan: menueplan,
      materials: materials,
      firebase: firebase,
      authUser: authUser,
    })
      .then((result) => {
        // Die selectedMeals werden im CreateNewList neu bestimmt
        // da dies ein Refresh ist, müssen wir da die alten wieder
        // überklatschen
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
        updatedMaterialList.lastChange = Utils.createChangeRecord(authUser);
        logEvent(
          firebase.analytics,
          FirebaseAnalyticEvent.materialListRefreshed
        );
      })
      .then(() => {
        // Statistik mitführen
        Stats.incrementStat({
          firebase: firebase,
          field: StatsField.noMaterialLists,
          value: -1,
        });
      })
      .then(() => {
        logEvent(
          firebase.analytics,
          FirebaseAnalyticEvent.materialListGenerated
        );
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
    return updatedMaterialList;
  };
}
