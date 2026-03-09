import Firebase from "../firebase.class";
import {
  FirebaseDbSuper,
  ValueObject,
  PrepareDataForDb,
  PrepareDataForApp,
} from "./firebase.db.super.class";
// import { AuthUser } from "../firebase.class.temp";
import {ERROR_NOT_IMPLEMENTED_YET} from "../../../constants/text";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "./sessionStorageHandler.class";
import FirebaseDbEventUsedRecipes from "./firebase.db.event.usedRecipes.class";
import FirebaseDbEventShoppingList from "./firebase.db.event.shoppingList";
import FirebaseDbEventShoppingListCollection from "./firebase.db.event.shoppingListCollection.class";
import FirebaseDbEventMaterialList from "./firebase.db.event.materialList.class";
import FirebaseDbEventReceipt from "./firebase.db.event.receipt.class";
import {collection, collectionGroup, doc} from "firebase/firestore";

export class FirebaseDbEvent extends FirebaseDbSuper {
  firebase: Firebase;
  usedRecipes: FirebaseDbEventUsedRecipes;
  shoppingList: FirebaseDbEventShoppingList;
  shoppingListCollection: FirebaseDbEventShoppingListCollection;
  materialList: FirebaseDbEventMaterialList;
  receipt: FirebaseDbEventReceipt;
  /* =====================================================================
  // Constructor
  // ===================================================================== */
  constructor(firebase: Firebase) {
    super();
    this.firebase = firebase;
    this.usedRecipes = new FirebaseDbEventUsedRecipes(firebase);
    this.shoppingList = new FirebaseDbEventShoppingList(firebase);
    this.shoppingListCollection = new FirebaseDbEventShoppingListCollection(
      firebase
    );
    this.materialList = new FirebaseDbEventMaterialList(firebase);
    this.receipt = new FirebaseDbEventReceipt(firebase);
  }
  /* =====================================================================
  // Collection holen
  // ===================================================================== */
  getCollection() {
    return collection(this.firebase.firestore, "events");
  }
  /* =====================================================================
  // Collection-Group holen
  // ===================================================================== */
  getCollectionGroup() {
    throw Error(ERROR_NOT_IMPLEMENTED_YET);
    return collectionGroup(this.firebase.firestore, "none");
  }
  /* =====================================================================
  // Dokument holen
  // ===================================================================== */
  getDocument(uids: string[]) {
    return doc(this.firebase.firestore, this.getCollection().path, uids[0]);
  }
  /* =====================================================================
  // Dokumente holen
  // ===================================================================== */
  getDocuments() {
    // Not implemented
  }
  /* =====================================================================
  // Daten für DB-Strutkur vorbereiten
  // ===================================================================== */
  prepareDataForDb<T extends ValueObject>({value}: PrepareDataForDb<T>) {
    const dbObject = {
      authUsers: value.authUsers,
      cooks: value.cooks,
      dates: value.dates,
      location: value.location,
      maxDate: value.maxDate,
      motto: value.motto,
      name: value.name,
      numberOfDays: value.numberOfDays,
      pictureSrc: value.pictureSrc,
      created: value.created,
      lastChange: value.lastChange,
    };

    if (
      Object.prototype.hasOwnProperty.call(value, "refDocuments") &&
      value["refDocuments"]
    ) {
      dbObject["refDocuments"] = value.refDocuments;
    }

    return dbObject;
  }
  /* =====================================================================
  // Daten für DB-Strutkur vorbereiten
  // ===================================================================== */
  prepareDataForApp<T extends ValueObject>({uid, value}: PrepareDataForApp) {
    const appObject = {
      uid: uid,
      name: value.name,
      motto: value.motto,
      location: value.location,
      cooks: value.cooks,
      numberOfDays: value.numberOfDays,
      dates: value.dates,
      maxDate: value.maxDate,
      pictureSrc: value.pictureSrc,
      authUsers: value.authUsers,
      created: value.created,
      lastChange: value.lastChange,
    };
    if (Object.prototype.hasOwnProperty.call(value, "refDocuments")) {
      appObject["refDocuments"] = value.refDocuments;
    }

    return appObject as unknown as T;
  }
  /* =====================================================================
  // Einstellungen für den Session Storage zurückgeben
  //===================================================================== */
  getSessionHandlerProperty(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.EVENT;
  }
}
export default FirebaseDbEvent;
