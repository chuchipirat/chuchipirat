import Firebase from "../Firebase/firebase.class";
import FirebaseAnalyticEvent from "../../constants/firebaseEvent";

import AuthUser from "../Firebase/Authentication/authUser.class";

import Utils from "../Shared/utils.class";
import Stats, {StatsField} from "../Shared/stats.class";
import Feed, {FeedType} from "../Shared/feed.class";
import Role from "../../constants/roles";
import {ValueObject} from "../Firebase/Db/firebase.db.super.class";
import Product from "../Product/product.class";

import {ERROR_PARAMETER_NOT_PASSED as TEXT_ERROR_PARAMETER_NOT_PASSED} from "../../constants/text";
import {logEvent} from "firebase/analytics";

// HINT💡:
// wird dies erweitert, muss auch im Cloud-Function File index
// die Beschreibung angepasst werden. Sonst funktioniert der
// Feed-Recap-Newsletter nicht.
export enum MaterialType {
  none = 0,
  consumable,
  usage,
}

interface CreateMaterial {
  firebase: Firebase;
  name: string;
  type: MaterialType;
  authUser: AuthUser;
}
export interface ConvertProductToMaterialCallbackDocument {
  date: Date;
  documentList: {document: string; name: string}[];
  done: boolean;
  product: {uid: string; name: string};
  type: MaterialType;
}

interface CreateMaterialFromProduct {
  firebase: Firebase;
  product: {uid: Product["uid"]; name: Product["name"]};
  newMaterialType: MaterialType;
  authUser: AuthUser;
  callbackDone?: (document: ConvertProductToMaterialCallbackDocument) => void;
}

interface SaveAllMaterials {
  materials: Material[];
  firebase: Firebase;
  authUser: AuthUser;
}

interface GetAllMaterials {
  firebase: Firebase;
  onlyUsable?: boolean;
}
export interface MergeMaterialsCallbackDocument {
  date: Date;
  documentList: {document: string; name: string}[];
  done: boolean;
  materialToReplace: {uid: string; name: string};
  materialToReplaceWith: {uid: string; name: string};
}

interface MergeMaterials {
  firebase: Firebase;
  authUser: AuthUser;
  materialToReplace: {uid: string; name: string};
  materialToReplaceWith: {uid: string; name: string};
  callbackDone: (document: MergeMaterialsCallbackDocument) => void;
}

export default class Material {
  uid: string;
  name: string;
  type: MaterialType;
  usable: boolean;

  /* =====================================================================
  // Constructor
  // ===================================================================== */
  constructor() {
    this.uid = "";
    this.name = "";
    this.type = MaterialType.consumable;
    this.usable = false;
  }
  // =====================================================================
  /**
   * Alle Materiale aus der DB holen -->
   * Möglichkeit mit onlyUsable die nicht nutzbaren Produkte
   * auszufiltern.
   * @param Objekt nach Interface GetAllMaterials
   * @returns Liste der Materiale
   */
  static async getAllMaterials({firebase, onlyUsable}: GetAllMaterials) {
    let materials: Material[] = [];

    // Produkte holen
    await firebase.masterdata.materials
      .read<ValueObject>({uids: []})
      .then((result) => {
        Object.entries(result).forEach(([key, value]) => {
          if (onlyUsable === true && value.usable === false) {
            // Nächster Datensatz
            return;
          }

          materials.push({
            uid: key,
            name: value.name,
            type: value.type,
            usable: value.usable,
          });
        });

        materials = Utils.sortArray({
          array: materials,
          attributeName: "name",
        });
      })
      .catch((error) => {
        throw error;
      });

    return materials;
  }
  /* =====================================================================
  // Material anlegen
  // ===================================================================== */
  static createMaterial = async ({
    firebase,
    name,
    type,
    authUser,
  }: CreateMaterial) => {
    const material = new Material();

    material.uid = crypto.randomUUID();
    material.name = name.trim();
    material.type = type;
    material.usable = true;

    // Dokument updaten mit neuem Produkt
    firebase.masterdata.materials.update<Array<Material>>({
      uids: [""], // Wird in der Klasse bestimmt
      value: [material],
      authUser: authUser,
    });

    // Event auslösen
    logEvent(firebase.analytics, FirebaseAnalyticEvent.materialCreated);

    // interner Feed-Eintrag
    Feed.createFeedEntry({
      firebase: firebase,
      authUser: authUser,
      feedType: FeedType.materialCreated,
      feedVisibility: Role.communityLeader,
      objectUid: material.uid,
      objectName: material.name,
      textElements: [material.name],
    });

    // Statistik
    Stats.incrementStat({
      firebase: firebase,
      field: StatsField.noMaterials,
      value: 1,
    });

    return material;
  };
  // =====================================================================
  /**
   * Aus einem Produkt ein Material erstellen -->
   * Cloud-FX triggern, die das Produkt umwandelt.
   * auszufiltern.
   * @param Objekt nach Interface GetAllMaterials
   * @returns void
   */
  static createMaterialFromProduct = async ({
    firebase,
    product,
    newMaterialType,
    authUser,
    callbackDone,
  }: CreateMaterialFromProduct) => {
    if (!firebase || !product || !newMaterialType) {
      throw new Error(TEXT_ERROR_PARAMETER_NOT_PASSED);
    }
    let unsubscribe: () => void;
    let documentId = "";

    firebase.cloudFunction.convertProductToMaterial
      .triggerCloudFunction({
        values: {product: product, materialType: newMaterialType},
        authUser: authUser,
      })
      .then((result) => {
        documentId = result;
      })
      .then(() => {
        if (!callbackDone) {
          return;
        }
        // Melden wenn fertig
        const callback = (data) => {
          if (data?.done) {
            callbackDone(data);
            unsubscribe();
          }
        };
        const errorCallback = (error: Error) => {
          throw error;
        };

        firebase.cloudFunction.convertProductToMaterial
          .listen({
            uids: [documentId],
            callback: callback,
            errorCallback: errorCallback,
          })
          .then((result) => {
            unsubscribe = result;
          });
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  };
  // ===================================================================== */
  /**
   * Alle Produkte speichern
   * @param object - Objekt mit Produkte-Array, Firebase Referenz und Authuser
   */
  static saveAllMaterials = async ({
    firebase,
    materials,
    authUser,
  }: SaveAllMaterials) => {
    // Dokument updaten mit neuem Produkt
    let triggerCloudFx = false;
    const changedMaterials = [] as Material[];

    await Material.getAllMaterials({
      firebase: firebase,
      onlyUsable: false,
    })
      .then((result) => {
        materials.forEach((material) => {
          const dbMaterial = result.find(
            (dbMaterial) => dbMaterial.uid === material.uid
          );

          if (dbMaterial && dbMaterial.name != material.name) {
            // Das Produkt hat eine Änderung erfahren, die über alle
            // Dokumente nachgeführt werden muss
            triggerCloudFx = true;
            changedMaterials.push(material);
          }
        });
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });

    firebase.masterdata.materials.update<Array<Material>>({
      uids: [""], // Wird in der Klasse bestimmt
      value: materials,
      authUser: authUser,
    });

    if (triggerCloudFx) {
      firebase.cloudFunction.updateMaterial.triggerCloudFunction({
        values: {changedMaterials: changedMaterials},
        authUser: authUser,
      });
    }

    return materials;
  };
  // =====================================================================
  /**
   * Zwei Materialien mergen
   * Über eine Cloud-Function werden zwei Materialien zusammengeführt und
   * in allen relevanten Dokumenten wird das nachgeführt
   * @param Objekt - Referenz auf Firebase, AuthUser, Material zu erstetzen,
   *                 Ersatz-material, Callback wenn Cloud-FX fertig.
   */
  static mergeMaterials = async ({
    firebase,
    authUser,
    materialToReplace,
    materialToReplaceWith,
    callbackDone,
  }: MergeMaterials) => {
    if (!firebase || !materialToReplace || !materialToReplaceWith) {
      throw new Error(TEXT_ERROR_PARAMETER_NOT_PASSED);
    }
    let unsubscribe: () => void;
    let documentId = "";

    firebase.cloudFunction.mergeMaterials
      .triggerCloudFunction({
        values: {
          materialToReplace: materialToReplace,
          materialToReplaceWith: materialToReplaceWith,
        },
        authUser: authUser,
      })
      .then((result) => {
        documentId = result;
      })
      .then(() => {
        // Melden wenn fertig
        const callback = (data) => {
          if (data?.done) {
            callbackDone(data);
            unsubscribe();
          }
        };
        const errorCallback = (error: Error) => {
          throw error;
        };

        firebase.cloudFunction.mergeMaterials
          .listen({
            uids: [documentId],
            callback: callback,
            errorCallback: errorCallback,
          })
          .then((result) => {
            unsubscribe = result;
          });
      })
      .catch((error) => {
        throw error;
      });
  };
}
