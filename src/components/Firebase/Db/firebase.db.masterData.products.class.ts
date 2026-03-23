import Firebase from "../firebase.class";
// import Stats from "../../Shared/stats.class";
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
import {Diet} from "../../Product/product.types";
import {collection, collectionGroup, doc} from "firebase/firestore";

export class FirebaseDbMasterDataProducts extends FirebaseDbSuper {
  firebase: Firebase;
  /* =====================================================================
  // Constructor
  // ===================================================================== */
  constructor(firebase: Firebase) {
    super();
    this.firebase = firebase;
  }
  /* =====================================================================
  // Collection holen
  // ===================================================================== */
  getCollection() {
    return collection(this.firebase.firestore, `masterData`);
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
  getDocument() {
    return doc(this.firebase.firestore, this.getCollection().path, `products`);
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
    // value kommt als Array, damit auch mehrere Produkte angepasst werden können

    const productsMap = {};

    value.forEach((product) => {
      // Allergene nur speichern, wenn auch welche vorhanden
      const dietProperties = product.dietProperties;
      if (product.dietProperties?.allergens?.length == 0) {
        delete dietProperties.allergens;
      }

      productsMap[product.uid] = {
        name: product.name,
        departmentUid: product.department?.uid ? product.department.uid : "",
        shoppingUnit: product.shoppingUnit,
        dietProperties: dietProperties,
        usable: product.usable,
      };
    });

    return productsMap;
  }
  /* =====================================================================
  // Daten für DB-Strutkur vorbereiten
  // ===================================================================== */
  prepareDataForApp<T extends ValueObject>({value}: PrepareDataForApp) {
    // Die Aufsplittung von Objekt zu Array geschieht in der products.class

    // Allergene hinzufügen, falls nicht vorhanden
    // Feld wird in prepareDataForDB gelöscht, damit keine leeren Felder
    // gespeichert werden. Hier muss es wieder hinzugefügt werden
    Object.keys(value).map((key) => {
      if (!Object.prototype.hasOwnProperty.call(value[key], "dietProperties")) {
        value[key].dietProperties = {allergens: [], diet: Diet.Meat};
      } else if (
        !Object.prototype.hasOwnProperty.call(
          value[key].dietProperties,
          "allergens"
        )
      ) {
        value[key].dietProperties.allergens = [];
      } else if (
        !Object.prototype.hasOwnProperty.call(value[key].dietProperties, "diet")
      ) {
        value[key].dietProperties.diet = Diet.Meat;
      }
    });
    return value as unknown as T;
  }
  /* =====================================================================
  // Einstellungen für den Session Storage zurückgeben
  //===================================================================== */
  getSessionHandlerProperty(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.PRODUCTS;
  }
}
export default FirebaseDbMasterDataProducts;
