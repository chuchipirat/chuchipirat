import {ERROR_NOT_IMPLEMENTED_YET} from "../../../constants/text";

import Firebase from "../firebase.class";
import FirebaseDbCloudFunctionLog from "./firebase.db.cloudfunction.log.class";
import {
  FirebaseDbSuper,
  PrepareDataForApp,
  PrepareDataForDb,
  ValueObject,
} from "./firebase.db.super.class";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "./sessionStorageHandler.class";
import {collection, collectionGroup, doc} from "firebase/firestore";

/**
 * Koordinator für Firebase Cloud Functions.
 *
 * Alle individuellen Cloud-Function-Handler (updateProduct, updateRecipe,
 * deleteRecipe, usw.) wurden entfernt — ihre Aufgaben werden nun direkt
 * über Postgres FKs/JOINs oder Supabase RPC-Funktionen erledigt.
 *
 * Es verbleibt nur noch der Log-Handler, der von der Basisklasse
 * FirebaseDbCloudFunctionSuper verwendet wird.
 */
export class FirebaseDbCloudFunction extends FirebaseDbSuper {
  firebase: Firebase;
  log: FirebaseDbCloudFunctionLog;
  /* =====================================================================
  // Constructor
  // ===================================================================== */
  constructor(firebase: Firebase) {
    super();
    this.firebase = firebase;
    this.log = new FirebaseDbCloudFunctionLog(firebase);
  }
  /* =====================================================================
  // Collection holen
  // ===================================================================== */
  getCollection() {
    return collection(this.firebase.firestore, `_cloudFunctions`);
  }
  /* =====================================================================
  // Collection-Group holen
  // ===================================================================== */
  getCollectionGroup() {
    throw Error(ERROR_NOT_IMPLEMENTED_YET);
    return collectionGroup(this.firebase.firestore, `none`);
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
    return value as unknown as T;
  }
  /* =====================================================================
  // Daten für DB-Strutkur vorbereiten
  // ===================================================================== */
  prepareDataForApp<T extends ValueObject>({value}: PrepareDataForApp): T {
    return value as unknown as T;
  }
  /* =====================================================================
  // Einstellungen für den Session Storage zurückgeben
  //===================================================================== */
  getSessionHandlerProperty(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.NONE;
  }
}
export default FirebaseDbCloudFunction;
