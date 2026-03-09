import Firebase from "../../Firebase/firebase.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import Recipe, {RecipeIndetifier} from "../../Recipe/recipe.class";
import {ChangeRecord} from "../../Shared/global.interface";
import Utils from "../../Shared/utils.class";
import Event from "../Event/event.class";
import _ from "lodash";
import {
  Meal,
  MealRecipeDeletedPrefix,
  Menue,
  MenuplanData,
} from "../Menuplan/menuplan.types";
import {getMealsOfMenues, getMenuesOfMeals} from "../Menuplan/menuplanService";

import {ERROR_NO_RECIPES_FOUND as TEXT_ERROR_NO_RECIPES_FOUND} from "../../../constants/text";

interface Factory {
  event: Event;
}

interface Save {
  usedRecipes: UsedRecipes;
  firebase: Firebase;
  authUser: AuthUser;
}
interface Delete {
  eventUid: Event["uid"];
  firebase: Firebase;
}

interface GetUsedRecipesListener {
  firebase: Firebase;
  uid: string;
  callback: (usedRecipes: UsedRecipes) => void;
  errorCallback: (error: Error) => void;
}

interface CreateNewList {
  name: string;
  selectedMenues: Menue["uid"][];
  menueplan: MenuplanData;
  firebase: Firebase;
  authUser: AuthUser;
}
interface RefreshLists {
  usedRecipes: UsedRecipes;
  menueplan: MenuplanData;
  firebase: Firebase;
  authUser: AuthUser;
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
interface ListProperties {
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
export interface UsedRecipeListEntry {
  properties: ListProperties;
  recipes: {[key: Recipe["uid"]]: Recipe};
}

export default class UsedRecipes {
  uid: string;
  noOfLists: number;
  lists: {[key: string]: UsedRecipeListEntry};
  lastChange: ChangeRecord;
  /* =====================================================================
  // Constructor
  // ===================================================================== */
  constructor() {
    this.uid = "";
    this.noOfLists = 0;
    this.lastChange = {date: new Date(0), fromUid: "", fromDisplayName: ""};
    this.lists = {};
  }
  // ===================================================================== */
  /**
   * Factory Methode
   * @returns usedRecipes
   */
  static factory({event}: Factory) {
    const usedRecipes = new UsedRecipes();
    usedRecipes.uid = event.uid;
    return usedRecipes;
  }
  // ===================================================================== */
  /**
   * Daten speichern
   * @param object - Objekt mit UsedRecipes, Firebase, AuthUser
   * @returns usedRecipes
   */
  static save = async ({usedRecipes, firebase, authUser}: Save) => {
    usedRecipes.lastChange = Utils.createChangeRecord(authUser);
    firebase.event.usedRecipes
      .set({
        uids: [usedRecipes.uid],
        value: usedRecipes,
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
   * Alle Listen löschen (gesamte Dokument)
   * @param object - Objekt mit Event-UID und Firebase-Referenz
   */
  static delete = async ({eventUid, firebase}: Delete) => {
    firebase.event.usedRecipes.delete({uids: [eventUid]}).catch((error) => {
      console.error(error);
      throw error;
    });
  };
  // ===================================================================== */
  /**
   * Listener holen
   * @param object - Objekt mit Firebase, UID, und Callback-Funktion
   * @returns listener
   */
  static getUsedRecipesListener = async ({
    firebase,
    uid,
    callback,
    errorCallback,
  }: GetUsedRecipesListener) => {
    const usedRecipesCallback = (usedRecipes: UsedRecipes) => {
      // Menüplan mit UID anreichern
      usedRecipes.uid = uid;
      callback(usedRecipes);
    };

    return await firebase.event.usedRecipes
      .listen<UsedRecipes>({
        uids: [uid],
        callback: usedRecipesCallback,
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
   * @param object - Objekt Name der Liste, ausgewählte Menües [menueUid], a
   *                 ausgewählte Rezepte [recipeUid], Firebase und Authuser
   * @returns Generierte Liste als Objekt
   */
  static createNewList = async ({
    name,
    selectedMenues,
    menueplan,
    firebase,
    authUser,
  }: CreateNewList) => {
    const listEntry = {} as UsedRecipeListEntry;

    // Es wird mit den Menüs gearbeitet. Aber gespeichert werden die
    // Mahlzeiten. --> Wenn die Menüs verschoben werden, müssen die
    // Augrund der gewählten Mahlzeit neu bestimmt werden.
    listEntry.properties = {
      uid: Utils.generateUid(5),
      name: name,
      selectedMeals: getMealsOfMenues({
        menuplan: menueplan,
        menues: selectedMenues,
      }),
      selectedMenues: selectedMenues,
      generated: Utils.createChangeRecord(authUser),
    };

    const recipeList = UsedRecipes.defineSelectedRecipes({
      selectedMenues: selectedMenues,
      menueplan: menueplan,
    });

    if (recipeList == undefined || recipeList.length == 0) {
      throw new Error(TEXT_ERROR_NO_RECIPES_FOUND);
    }

    // @ts-expect-error — Legacy Firebase-Methode, wird bei Migration entfernt
    await Recipe.getMultipleRecipes({
      firebase: firebase,
      recipes: recipeList,
    })
      .then((result) => {
        listEntry.recipes = result;
        return listEntry;
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });

    return listEntry;
  };
  // ===================================================================== */
  /**
   * Liste aktualisieren
   * @param object - Objekt Name der Liste, ausgewählte Menües [menueUid], a
   *                 ausgewählte Rezepte [recipeUid], Firebase und Authuser
   * @returns Aktualisierte Liste als Objekt
   */
  static refreshLists = async ({
    usedRecipes,
    menueplan,
    firebase,
    authUser,
  }: RefreshLists) => {
    let recipeList: RecipeIndetifier[] = [];
    const usedRecipesPerList: {[key: string]: RecipeIndetifier[]} = {};
    // Für alle Listen die die Rezepte neu sammeln.
    Object.values(usedRecipes.lists).forEach((list) => {
      // Alle Rezepte hiervon zusammensammeln
      list.properties.generated = {
        fromDisplayName: authUser.publicProfile.displayName,
        fromUid: authUser.uid,
        date: new Date(),
      };

      // überprüfen ob die gewählten Menüs auch in den Mahlzeiten sind.
      // Wenn die Menüs im Menüplan verschoben werden, müssen die Menüs neu definiert werden
      // Anhand der Mahlzeiten (die mitgespeichert werden)
      if (
        !Utils.areStringArraysEqual(
          list.properties.selectedMeals,
          getMealsOfMenues({
            menuplan: menueplan,
            menues: list.properties.selectedMenues,
          })
        ) ||
        // Sind neue Menü dazugekommen/ oder wurden Menüs aus der
        // Auswahl entfernt
        list.properties.selectedMenues.length !==
          getMenuesOfMeals({
            menuplan: menueplan,
            meals: list.properties.selectedMeals,
          }).length
      ) {
        // Die Menüs wurden geändert. Daher müssen wir jetzt
        // die Menüs neu bestimmen anhand der Mahlzeiten
        list.properties.selectedMenues = getMenuesOfMeals({
          menuplan: menueplan,
          meals: list.properties.selectedMeals,
        });
      }

      usedRecipesPerList[list.properties.uid] =
        UsedRecipes.defineSelectedRecipes({
          selectedMenues: list.properties.selectedMenues,
          menueplan: menueplan,
        });

      recipeList = recipeList.concat(usedRecipesPerList[list.properties.uid]);
    });
    // Dupplikate löschen und alle Rezepte holen
    // Dies ist nötig, weil in verschiedenen Listen, das gleiche Rezept
    // mehrmals vorkommen kann. Wir wollen es aber nur einmal lesen.
    recipeList = UsedRecipes._getUniqRecipes(recipeList);

    if (recipeList.length === 0) {
      throw new Error(TEXT_ERROR_NO_RECIPES_FOUND);
    }

    // @ts-expect-error — Legacy Firebase-Methode, wird bei Migration entfernt
    await Recipe.getMultipleRecipes({
      firebase: firebase,
      recipes: recipeList,
    })
      .then((result) => {
        //Hier nochmals darüberloopen und benötigte Rezepte hinzufügen....
        Object.values(usedRecipes.lists).forEach((list) => {
          list.recipes = {};
          usedRecipesPerList[list.properties.uid].forEach((recipe) => {
            if (result[recipe.uid]) {
              list.recipes[recipe.uid] = result[recipe.uid];
            }
          });
        });
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
    return usedRecipes;
  };

  // ===================================================================== */
  /**
   * Liste löschen
   * @param object - Objekt mit UsedRecipes und UID die es zu löschen gilt
   * @returns Angepasstes Used Recipes
   */
  static deleteList = ({
    usedRecipes,
    listUidToDelete,
    authUser,
  }: DeleteList) => {
    const updatedUsedRecipes = _.cloneDeep(usedRecipes) as UsedRecipes;

    delete updatedUsedRecipes.lists[listUidToDelete];

    updatedUsedRecipes.lastChange = Utils.createChangeRecord(authUser);
    updatedUsedRecipes.noOfLists--;

    return updatedUsedRecipes;
  };
  // ===================================================================== */
  /**
   * Name einer Liste anpassen
   * @param object - Objekt mit UsedRecipes und UID angepasst wird, neuer
   * Name der Liste und Authuser
   * @returns Angepasstes Used Recipes
   */
  static editListName = ({
    usedRecipes,
    listUidToEdit,
    newName,
    authUser,
  }: EditListName) => {
    const updatedUsedRecipes = _.cloneDeep(usedRecipes) as UsedRecipes;

    updatedUsedRecipes.lists[listUidToEdit].properties.name = newName;
    updatedUsedRecipes.lastChange = Utils.createChangeRecord(authUser);

    return updatedUsedRecipes;
  };
  // ===================================================================== */
  /**
   * Rezepte aus den ausgewählten Rezepten bestimmen
   * @param object - Objekt mit SelectedMenues und Menueplan
   * @returns Liste der Rezept-UIDs
   */
  static defineSelectedRecipes = ({
    menueplan,
    selectedMenues,
  }: _DefineSelectedRecipes) => {
    const usedRecipesList: RecipeIndetifier[] = [];

    selectedMenues.forEach((menueUid) => {
      menueplan.menues[menueUid].mealRecipeOrder.forEach((mealRecipeUid) => {
        if (
          menueplan.mealRecipes[mealRecipeUid].recipe &&
          !menueplan.mealRecipes[
            mealRecipeUid
          ].recipe.recipeUid.includes(MealRecipeDeletedPrefix)
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
  };
  // ===================================================================== */
  /**
   * Doppelte Rezepte löschen
   * @param usedRecipes - Array mit allen Rezepten
   * @returns Liste mit den Rezepten ohne Dupplikate
   */
  static _getUniqRecipes = (usedRecipesList: RecipeIndetifier[]) => {
    return Array.from(new Set(usedRecipesList.map((recipe) => recipe.uid))).map(
      (uid) => {
        return usedRecipesList.find((recipe) => recipe.uid == uid);
      }
    ) as RecipeIndetifier[];
  };
}
