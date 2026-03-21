import {Operator, OrderBy, ValueObject, Where} from "./firebase.db.super.class";

import {ERROR_NOT_IMPLEMENTED_YET} from "../../../constants/text";
import Utils from "../../Shared/utils.class";

export interface StorageObjectProperty {
  durationOfValidity: number; // in Minuten
  uid: string;
  respectPrefix: boolean; // soll for dem Dokumenten-Namen noch ein Präfix hin?
  excludeFromCaching: boolean; // kein Caching dieser Daten z.B. Menüplan;
}

export const STORAGE_OBJECT_PROPERTY: {[key: string]: StorageObjectProperty} = {
  STATS_COUNTER: {
    durationOfValidity: 0,
    uid: "/stats",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  STATS_RECIPE_VARIANTS: {
    durationOfValidity: 0,
    uid: "/stats",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  STATS_RECIPES_IN_MENUPLAN: {
    durationOfValidity: 0,
    uid: "/stats",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  FEED: {
    durationOfValidity: 0,
    uid: "/feed",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  EVENT: {
    durationOfValidity: 0,
    uid: "/event",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  EVENT_SHORT: {
    durationOfValidity: 0,
    uid: "/eventShort",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  RECIPE_SHORT_PUBLIC: {
    durationOfValidity: 0,
    uid: "/recipeShortPublic",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  RECIPE_SHORT_PRIVATE: {
    durationOfValidity: 0,
    uid: "/recipeShortPrivate",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  RECIPE_SHORT_VARIANT: {
    durationOfValidity: 0,
    uid: "/recipeShortVariant",
    respectPrefix: true,
    excludeFromCaching: true,
  },
  SEARCH_SETTINGS: {
    durationOfValidity: 0,
    uid: "/searchSettings",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  RECIPE: {
    durationOfValidity: 0,
    uid: "/recipe",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  PRODUCTS: {
    durationOfValidity: 0,
    uid: "/products",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  DEPARTMENTS: {
    durationOfValidity: 1440,
    uid: "/departments",
    respectPrefix: false,
    excludeFromCaching: false,
  },
  MATERIALS: {
    durationOfValidity: 0,
    uid: "/materials",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  UNITS: {
    durationOfValidity: 1440,
    uid: "/units",
    respectPrefix: false,
    excludeFromCaching: false,
  },
  UNIT_CONVERSION: {
    durationOfValidity: 1440,
    uid: "/unitConversion",
    respectPrefix: false,
    excludeFromCaching: false,
  },
  MENUPLAN: {
    durationOfValidity: 0,
    uid: "/menuplan",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  EVENT_GROUP_CONFIGRUATION: {
    durationOfValidity: 0,
    uid: "/groupConfiguration",
    respectPrefix: true,
    excludeFromCaching: true,
  },
  USED_RECIPES: {
    durationOfValidity: 0,
    uid: "/usedRecipes",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  PROFILE_PUBLIC: {
    durationOfValidity: 0,
    uid: "/profilePublic",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  MAILBOX: {
    durationOfValidity: 0,
    uid: "/mailbox",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  CLOUDFUNCTION: {
    durationOfValidity: 0,
    uid: "/cloudfunction",
    respectPrefix: true,
    excludeFromCaching: true,
  },
  USER_SHORT: {
    durationOfValidity: 0,
    uid: "",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  NONE: {
    durationOfValidity: 0,
    uid: "",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  VERSION: {
    durationOfValidity: 0,
    uid: "/configuration",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  CONFIGURATION: {
    durationOfValidity: 0,
    uid: "",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  GLOBAL_SETTINGS: {
    durationOfValidity: 0,
    uid: "",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  SYSTEM_MESSAGE: {
    durationOfValidity: 0,
    uid: "/configuration",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  RECIPE_INGREDIENT: {
    durationOfValidity: 0,
    uid: "",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  RECIPE_PREPARATION_STEP: {
    durationOfValidity: 0,
    uid: "",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  RECIPE_MATERIAL: {
    durationOfValidity: 0,
    uid: "",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  RECIPE_RATING: {
    durationOfValidity: 0,
    uid: "",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  RECIPE_COMMENT: {
    durationOfValidity: 0,
    uid: "",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  SHOPPING_LISTS: {
    durationOfValidity: 0,
    uid: "/shoppingLists",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  MATERIAL_LISTS: {
    durationOfValidity: 0,
    uid: "/materialLists",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  REQUESTS: {
    durationOfValidity: 0,
    uid: "/requests",
    respectPrefix: false,
    excludeFromCaching: true,
  },
  REQUEST_COMMENTS: {
    durationOfValidity: 0,
    uid: "/requestComments",
    respectPrefix: false,
    excludeFromCaching: true,
  },
};

const PREFIX_DOCUMENTUID_SEPARATOR = "|";

export interface SessionStorageValue {
  date: Date;
  values: any;
}
export interface SessionStorageDocument {
  [key: string]: SessionStorageValue;
}
/* =====================================================================
  // Methoden Interfaces
  // ===================================================================== */
interface UpsertDocument<T> {
  storageObjectProperty: StorageObjectProperty;
  documentUid: string;
  value: T;
  prefix?: string;
}
interface UpsertDocuments<T> {
  storageObjectProperty: StorageObjectProperty;
  values: T[];
}
interface UpdateDocumentField<T> {
  storageObjectProperty: StorageObjectProperty;
  documentUid: string;
  value: T;
  prefix?: string;
}
interface IncrementFieldValue {
  storageObjectProperty: StorageObjectProperty;
  documentUid: string;
  field: string;
  value: number;
  prefix?: string;
}
interface IncrementFieldsValue {
  storageObjectProperty: StorageObjectProperty;
  documentUid: string;
  values: {field: string; value: number}[];
  prefix?: string;
}

interface DeleteDocument {
  storageObjectProperty: StorageObjectProperty;
  documentUid: string;
  prefix: string;
}
interface DeleteDocumentField {
  storageObjectProperty: StorageObjectProperty;
  documentUid: string;
  field: string;
  prefix: string;
}
interface GetDocument {
  storageObjectProperty: StorageObjectProperty;
  documentUid: string;
  prefix?: string;
}
interface GetDocuments {
  storageObjectProperty: StorageObjectProperty;
  // documentUid: string;
  where?: Where[];
  orderBy: OrderBy;
  limit?: number;
}
interface GetSessionStorageEntry {
  storageObjectProperty: StorageObjectProperty;
}
interface SetSessionStorageEntry<T> {
  storageObjectProperty: StorageObjectProperty;
  value: T;
}
export class SessionStorageHandler {
  // ===================================================================== */
  /**
   * Einzelne Dokument in den Session Storage schreiben.
   * Wenn bereits vorhanden wird dieses überschrieben. Ansonsten
   * wird es neu angelegt
   * @param object Objekt mit Einstellungen für diesen Objekttyp,
   *               Dokumenten-UID und den Werten des Dokumentes
   */
  static upsertDocument<T extends ValueObject>({
    storageObjectProperty,
    documentUid,
    value,
    prefix,
  }: UpsertDocument<T>) {
    // Bestehende Dokumente auslesen
    // prüfen ob es eines mit dieser UID schon gibt
    // wieder einfügen

    if (storageObjectProperty.excludeFromCaching) {
      return;
    }

    let sessionStorageValue = SessionStorageHandler.getSessionStorageEntry({
      storageObjectProperty: storageObjectProperty,
    });

    if (!sessionStorageValue) {
      sessionStorageValue = {};
    }
    // Dokument-ID erstellen
    const documentPrefixUid = SessionStorageHandler.mergeStorageDocumentUid(
      storageObjectProperty,
      documentUid,
      prefix
    );

    // Neuer Wert einfügen/überklatschen
    sessionStorageValue[documentPrefixUid] = {
      date: new Date(),
      value:
        sessionStorageValue[documentPrefixUid] == undefined
          ? value
          : {...sessionStorageValue[documentPrefixUid].value, ...value},
    };

    SessionStorageHandler.setSessionStorageEntry({
      storageObjectProperty: storageObjectProperty,
      value: sessionStorageValue,
    });
  }
  // ===================================================================== */
  /**
   * Mehrere Dokumente (im Array) in den Session Storage schreiben.
   * Wenn das Dokument bereits vorhanden ist, wird dieses überschrieben.
   * Ansonsten wird es neu angelegt
   * @param object Objekt mit Einstellungen für diesen Objekttyp,
   *               Dokumenten-UID und den Werten des Dokumentes
   */
  static upsertDocuments<T extends ValueObject>({
    storageObjectProperty,
    values,
  }: UpsertDocuments<T>) {
    if (storageObjectProperty.excludeFromCaching) {
      return;
    }
    // Bestehender Session Storage auslesen
    // prüfen ob es eines mit dieser UID schon gibt
    // wieder einfügen
    let sessionStorageValue = SessionStorageHandler.getSessionStorageEntry({
      storageObjectProperty: storageObjectProperty,
    });
    if (!sessionStorageValue) {
      sessionStorageValue = {};
    }

    values.forEach((value) => {
      sessionStorageValue![value.uid] = {date: new Date(), value: value};
    });
    SessionStorageHandler.setSessionStorageEntry({
      storageObjectProperty: storageObjectProperty,
      value: sessionStorageValue,
    });
  }
  // ===================================================================== */
  /**
   * Einzelne Felder eines Dokumentes anpassen
   * @param object Objekt mit Einstellungen für diesen Objekttyp,
   *               Dokumenten-UID und den Werten des Dokumentes
   */
  static updateDocumentField<T>({
    storageObjectProperty,
    documentUid,
    value,
    prefix,
  }: UpdateDocumentField<T>) {
    // Dokument lesen
    if (storageObjectProperty.excludeFromCaching) {
      return;
    }

    const sessionStorageValue = SessionStorageHandler.getSessionStorageEntry({
      storageObjectProperty: storageObjectProperty,
    });

    if (!sessionStorageValue) {
      // Wenn kein File vorhanden ist, können auch keine
      // einzelnen Felder angepasst werden
      return;
    }

    // Dokument-ID erstellen
    const documentPrefixUid = SessionStorageHandler.mergeStorageDocumentUid(
      storageObjectProperty,
      documentUid,
      prefix
    );

    // Wert überklatschen
    sessionStorageValue[documentPrefixUid] = {
      date: new Date(),
      value: {...sessionStorageValue[documentPrefixUid].value, ...value},
    };

    SessionStorageHandler.setSessionStorageEntry({
      storageObjectProperty: storageObjectProperty,
      value: sessionStorageValue,
    });
  }
  // ===================================================================== */
  /**
   * Einzelnes Dokument aus dem Session Storage auslesen.
   * Prüfung ob der Eintrag noch nicht zu alt ist. Der Wert wird in der
   * PROPERTY durationOfValidity definiert (in Minuten)
   * Wenn kein Resultat gefunden wird (oder dieses zeitlich abgelaufen ist)
   * wird NULL retourniert.
   * @param object - Objekt mit Einstellungen für diesen Objekttyp und der
   * Dokumenten-UID
   */
  static getDocument<T extends ValueObject>({
    storageObjectProperty,
    documentUid,
    prefix,
  }: GetDocument): T | null {
    if (storageObjectProperty.excludeFromCaching) {
      return null;
    }
    const sessionStorage = this.getSessionStorageEntry<T>({
      storageObjectProperty: storageObjectProperty,
    });
    // Dokument-ID erstellen
    const documentPrefixUid = SessionStorageHandler.mergeStorageDocumentUid(
      storageObjectProperty,
      documentUid,
      prefix
    );

    // Gibt es das Dokument im Session Storage
    if (
      !sessionStorage ||
      !Object.prototype.hasOwnProperty.call(sessionStorage, documentPrefixUid)
    ) {
      return null;
    }

    if (
      new Date().getTime() -
        new Date(sessionStorage[documentPrefixUid]?.date).getTime() / 60000 >
      storageObjectProperty.durationOfValidity
    ) {
      return sessionStorage[documentPrefixUid].value;
    } else {
      return null;
    }
  }
  // ===================================================================== */
  /**
   * Mehrere Dokumente aus dem Session Storage auslesen.
   * Prüfung ob der Eintrag noch nicht zu alt ist. Der Wert wird in der
   * PROPERTY durationOfValidity definiert (in Minuten)
   * Wenn kein Resultat gefunden wird (oder dieses zeitlich abgelaufen ist)
   * wird NULL retourniert. Falls Werte in der Where Klausel definiert sind,
   * werden diese berücksichtig.
   * @param object - Objekt mit Einstellungen für diesen Objekttyp und der
   * Dokumenten-UID
   */
  static getDocuments<T extends ValueObject>({
    storageObjectProperty,
    where,
    orderBy,
    limit,
  }: GetDocuments) {
    if (storageObjectProperty.excludeFromCaching) {
      return null;
    }
    let validSessionStorageEntries: T[] = [];

    const sessionStorage = this.getSessionStorageEntry<T>({
      storageObjectProperty: storageObjectProperty,
    });
    // Gibt es das Dokument im Session Storage
    if (!sessionStorage) {
      return null;
    }
    // Objekt in Array umwandeln
    Object.values(sessionStorage).forEach((value) =>
      validSessionStorageEntries.push(value)
    );

    // Alles was veraltet ist rausfiltern
    validSessionStorageEntries = validSessionStorageEntries.filter(
      (entry) =>
        new Date().getTime() - new Date(entry.date).getTime() / 60000 >
        storageObjectProperty.durationOfValidity
    );
    if (where) {
      // Ausfiltern...
      where.forEach((statement) => {
        validSessionStorageEntries = validSessionStorageEntries.filter(
          (entry) => {
            switch (statement.operator) {
              case Operator.EQ:
                return entry.value[statement.field] == statement.value;
              case Operator.LT:
                return entry.value[statement.field] < statement.value;
              case Operator.LE:
                return entry.value[statement.field] <= statement.value;
              case Operator.GT:
                return entry.value[statement.field] > statement.value;
              case Operator.GE:
                return entry.value[statement.field] >= statement.value;
              case Operator.NE:
                return entry.value[statement.field] != statement.value;
              case Operator.ArrayContains:
                return entry.value[statement.field]?.includes(statement.value);
              case Operator.ArrayContainsAny:
                throw Error(ERROR_NOT_IMPLEMENTED_YET);
              case Operator.in:
                throw Error(ERROR_NOT_IMPLEMENTED_YET);
              case Operator.notIn:
                throw Error(ERROR_NOT_IMPLEMENTED_YET);
            }
          }
        );
      });
    }

    validSessionStorageEntries = Utils.sortArray<T>({
      array: validSessionStorageEntries.map((entry) => entry.value),
      attributeName: orderBy.field,
      sortOrder: orderBy.sortOrder,
    });

    if (limit) {
      validSessionStorageEntries = validSessionStorageEntries.slice(0, limit);
    }

    // nur die Werte zurückgeben - Sortiert
    return validSessionStorageEntries.length > 0
      ? validSessionStorageEntries
      : null;
  }
  // ===================================================================== */
  /**
   * Der Feldwert um den Wert VALUE erhöhen.
   * @param object - Objekt mit Einstellungen für diesen Objekttyp und der
   * Dokumenten-UID, Wert der erhöht/reduziert werden soll, Prefix
   */
  static incrementFieldValue({
    storageObjectProperty,
    documentUid,
    field,
    value,
    prefix,
  }: IncrementFieldValue) {
    // Dokument lesen
    if (storageObjectProperty.excludeFromCaching) {
      return;
    }
    const sessionStorageValue = SessionStorageHandler.getSessionStorageEntry({
      storageObjectProperty: storageObjectProperty,
    });

    // Dokument-ID erstellen
    const documentPrefixUid = SessionStorageHandler.mergeStorageDocumentUid(
      storageObjectProperty,
      documentUid,
      prefix
    );

    if (!sessionStorageValue || !sessionStorageValue[documentPrefixUid]) {
      // Wenn kein File vorhanden ist, können auch keine
      // einzelnen Felder angepasst werden
      return;
    }

    // Wert überklatschen
    sessionStorageValue[documentPrefixUid] = {
      date: new Date(),
      value: {
        ...sessionStorageValue[documentPrefixUid].value,
        [field]: sessionStorageValue[documentPrefixUid].value[field] + value,
      },
    };

    SessionStorageHandler.setSessionStorageEntry({
      storageObjectProperty: storageObjectProperty,
      value: sessionStorageValue,
    });
  }
  // ===================================================================== */
  /**
   * Die Feldwerte um den Wert VALUE erhöhen.
   * @param object - Objekt mit Einstellungen für diesen Objekttyp und der
   * Dokumenten-UID, Wert der erhöht/reduziert werden soll, Prefix
   */
  static incrementFieldsValue({
    storageObjectProperty,
    documentUid,
    values,
    prefix,
  }: IncrementFieldsValue) {
    // Dokument lesen
    if (storageObjectProperty.excludeFromCaching) {
      return;
    }
    const sessionStorageValue = SessionStorageHandler.getSessionStorageEntry({
      storageObjectProperty: storageObjectProperty,
    });

    // Dokument-ID erstellen
    const documentPrefixUid = SessionStorageHandler.mergeStorageDocumentUid(
      storageObjectProperty,
      documentUid,
      prefix
    );

    if (!sessionStorageValue || !sessionStorageValue[documentPrefixUid]) {
      // Wenn kein File vorhanden ist, können auch keine
      // einzelnen Felder angepasst werden
      return;
    }

    const newValues = {};
    values.forEach((value) => {
      newValues[value.field] =
        sessionStorageValue[documentPrefixUid].value[value.field] + value.value;
    });

    // Wert überklatschen
    sessionStorageValue[documentPrefixUid] = {
      date: new Date(),
      value: {
        ...sessionStorageValue[documentPrefixUid].value,
        newValues,
      },
    };

    SessionStorageHandler.setSessionStorageEntry({
      storageObjectProperty: storageObjectProperty,
      value: sessionStorageValue,
    });
  }
  // ===================================================================== */
  /**
   * Dokument aus dem Session Storage herauslöschen
   * @param object - Objekt mit Einstellungen für diesen Objekttyp und der
   * Dokumenten-UID, Prefix
   */
  static deleteDocument({
    storageObjectProperty,
    documentUid,
    prefix,
  }: DeleteDocument) {
    // Dokument lesen
    if (storageObjectProperty.excludeFromCaching) {
      return;
    }

    const sessionStorageValue = SessionStorageHandler.getSessionStorageEntry({
      storageObjectProperty: storageObjectProperty,
    });

    if (!sessionStorageValue) {
      // Wenn kein File vorhanden ist, kann auch nichts gelöscht werden
      return;
    }

    // Dokument-ID erstellen
    const documentPrefixUid = SessionStorageHandler.mergeStorageDocumentUid(
      storageObjectProperty,
      documentUid,
      prefix
    );
    // Dokument löschen und zurückschreiben
    delete sessionStorageValue[documentPrefixUid];

    SessionStorageHandler.setSessionStorageEntry({
      storageObjectProperty: storageObjectProperty,
      value: sessionStorageValue,
    });
  }
  // ===================================================================== */
  /**
   * Feld aus einem Dokument löschen
   * @param object - Objekt mit Einstellungen für diesen Objekttyp und der
   * Dokumenten-UID, Prefix
   */
  static deleteDocumentField({
    storageObjectProperty,
    documentUid,
    field,
    prefix,
  }: DeleteDocumentField) {
    // Dokument lesen
    if (storageObjectProperty.excludeFromCaching) {
      return;
    }

    const sessionStorageValue = SessionStorageHandler.getSessionStorageEntry({
      storageObjectProperty: storageObjectProperty,
    });

    if (!sessionStorageValue) {
      // Wenn kein File vorhanden ist, kann auch nichts gelöscht werden
      return;
    }

    // Dokument-ID erstellen
    const documentPrefixUid = SessionStorageHandler.mergeStorageDocumentUid(
      storageObjectProperty,
      documentUid,
      prefix
    );

    // Feld löschen und zurückschreiben
    delete sessionStorageValue[documentPrefixUid].value[field];
    sessionStorageValue[documentPrefixUid].date = new Date();

    SessionStorageHandler.setSessionStorageEntry({
      storageObjectProperty: storageObjectProperty,
      value: sessionStorageValue,
    });
  }
  // ===================================================================== */
  /**
   * Werte aus Session Storage lesen
   * @param uid - Eindeutige ID des SessionStorage
   */
  static getSessionStorageEntry = <T extends ValueObject>({
    storageObjectProperty,
  }: GetSessionStorageEntry) => {
    const sessionStorageValue = sessionStorage.getItem(
      storageObjectProperty.uid
    );
    if (sessionStorageValue) {
      return SessionStorageHandler.convertStoredData(
        JSON.parse(sessionStorageValue)
      ) as T;
    } else {
      return null;
    }
  };
  // ===================================================================== */
  /**
   * Werte in den Session Storage schreiben
   * @param object - Einstellungn zu Session Storage Item und die Werte
   * des gesammten Dokumentes
   */
  static setSessionStorageEntry = <T extends ValueObject>({
    storageObjectProperty,
    value,
  }: SetSessionStorageEntry<T>) => {
    sessionStorage.setItem(storageObjectProperty.uid, JSON.stringify(value));
  };
  // ===================================================================== */
  /**
   * Versuchen alle Felder die, irgendwas mit Datum zu tun haben, in ein
   * Datum umzuwandeln. Methode wird rekursiv ausgeführt!
   * @param value - der zu prüfende Wert
   */
  static convertStoredData(values: any) {
    if (typeof values === "object" && values !== null) {
      Object.entries(values).forEach(([key, value]) => {
        switch (typeof value) {
          case "object":
            if (Array.isArray(value)) {
              value.forEach((entry) => this.convertStoredData(entry));
            } else {
              value = this.convertStoredData(value);
            }
            break;
          case "string":
            if (key.toLocaleLowerCase().includes("date")) {
              value = new Date(value);
            }
            break;
          default:
        }
        values[key] = value;
      });
    }
    return values;
  }
  // ===================================================================== */
  /**
   * Präfix erstellen - falls nötig
   */
  static mergeStorageDocumentUid(
    storageObjectProperty: StorageObjectProperty,
    documentUid: string,
    prefix?: string
  ) {
    // Dokument-ID erstellen
    if (storageObjectProperty.respectPrefix && prefix !== "") {
      return `${prefix}${PREFIX_DOCUMENTUID_SEPARATOR}${documentUid}`;
    } else {
      return documentUid;
    }
  }
  // ===================================================================== */
  /**
   * Gesamer Session-Storage löschen
   */
  static clearAll() {
    sessionStorage.clear();
  }
}
