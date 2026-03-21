import Firebase from "../Firebase/firebase.class";
import FirebaseAnalyticEvent from "../../constants/firebaseEvent";

import AuthUser from "../Firebase/Authentication/authUser.class";

import Utils from "../Shared/utils.class";
import Stats, {StatsField} from "../Shared/stats.class";
import {ValueObject} from "../Firebase/Db/firebase.db.super.class";
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
interface SaveAllMaterials {
  materials: Material[];
  firebase: Firebase;
  authUser: AuthUser;
}

interface GetAllMaterials {
  firebase: Firebase;
  onlyUsable?: boolean;
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

    // Statistik
    Stats.incrementStat({
      firebase: firebase,
      field: StatsField.noMaterials,
      value: 1,
    });

    return material;
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
}
