import {ERROR_NOT_IMPLEMENTED_YET} from "../../../constants/text";

import Firebase from "../firebase.class";
import {AuthUser} from "../Authentication/authUser.class";
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
import {
  collection,
  collectionGroup,
  doc,
  increment,
  Timestamp,
} from "firebase/firestore";

//HINT: Aufbau verbNomen
export enum CloudFunctionType {
  none = "",
  updateUserDiplayName = "updateUserDiplayName",
  updateUserMotto = "updateUserMotto",
  updateUserPictureSrc = "updateUserPictureSrc",
  updateRecipe = "updateRecipe",
  deleteRecipe = "deleteRecipe",
  traceObject = "traceObject",
  updateProduct = "updateProduct",
  updateMaterial = "updateMaterial",
  publishRecipeRequest = "publishRecipeRequest",
  declineRecipeRequest = "declineRecipeRequest",
  sendMail = "sendMail",
  dailySummary = "dailySummary",
  deleteFeeds = "deleteFeeds",
  mergeProducts = "mergeProducts",
  mergeMaterials = "mergeMaterials",
  rebuildStats = "rebuildStats",
  convertProductToMaterial = "convertProductToMaterial",
  convertMaterialToProduct = "convertMaterialToProduct",
  activateSupportUser = "activateSupportUser",
  signOutAllUsers = "signOutAllUsers",
}

// interface CreateDocumentForCloudFunctionsTrigger {
//   document: DocumentReference;
//   values: {[key: string]: any};
// }
export interface TriggerCloudFunction {
  values: {[key: string]: any};
  authUser: AuthUser;
}
interface UpdateLog {
  uid: string;
  cloudFunctionType: CloudFunctionType;
  authUser: AuthUser;
}
interface UpdateCounter {
  cloudFunctionType: CloudFunctionType;
}
// interface Listen<T> {
//   uids: string[];
//   callback: (T: T) => void;
// }

export interface BaseDocumentStructure {
  date: Date;
  done: boolean;
}

export abstract class FirebaseDbCloudFunctionSuper extends FirebaseDbSuper {
  abstract firebase: Firebase;
  abstract getCloudFunctionType(): CloudFunctionType;
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
    throw Error(ERROR_NOT_IMPLEMENTED_YET);
    return doc(this.firebase.firestore, this.getCollection().path, uids[0]);
  }
  /* =====================================================================
  // Dokumente holen
  // ===================================================================== */
  getDocuments() {
    throw Error(ERROR_NOT_IMPLEMENTED_YET);
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
    return STORAGE_OBJECT_PROPERTY.CLOUDFUNCTION;
  }
  /* =====================================================================
  // Logfile updaten
  // ===================================================================== */
  async updateLog({uid, cloudFunctionType, authUser}: UpdateLog) {
    this.firebase.cloudFunction.log
      .update({
        uids: [],
        authUser: authUser,
        value: {
          [uid]: {
            cloudFunctionType: cloudFunctionType,
            date: Timestamp.fromDate(new Date()),
            invokedBy: {
              uid: authUser.uid,
              displayName: authUser.publicProfile.displayName,
              firstName: authUser.firstName,
              lastName: authUser.lastName,
              email: authUser.email,
            },
          },
        },
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  }
  /* =====================================================================
  // Zähler der Cloud-FX hochzählen
  // ===================================================================== */
  updateCounter = async ({cloudFunctionType}: UpdateCounter) => {
    this.firebase.cloudFunction
      .update({
        uids: ["functions"],
        value: {
          [cloudFunctionType]: increment(1),
        },
        authUser: {} as AuthUser,
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  };
  // ===================================================================== */
  /**
   * Cloudfunction triggern
   * @param param0  Objekt mit zu schreibenden Werten für die Cloudfuntions
   *                und den authUser
   * @returns UID des Dokumentes, das den Trigger ausgelöst hat
   */
  async triggerCloudFunction({values, authUser}: TriggerCloudFunction) {
    let documentUid = "";

    await this.create({value: values, authUser: authUser})
      .then((result) => {
        documentUid = result.documentUid;
        this.updateLog({
          uid: documentUid,
          cloudFunctionType: this.getCloudFunctionType(),
          authUser: authUser,
        });
        this.updateCounter({cloudFunctionType: this.getCloudFunctionType()});
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });

    return documentUid;
  }
}
export default FirebaseDbCloudFunctionSuper;
