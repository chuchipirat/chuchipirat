import Firebase from "../firebase.class";
import {
  ValueObject,
  PrepareDataForDb,
  PrepareDataForApp,
  FirebaseDbSuper,
} from "./firebase.db.super.class";
import {
  ERROR_WRONG_DB_CLASS,
  ERROR_NOT_IMPLEMENTED_YET,
} from "../../../constants/text";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "./sessionStorageHandler.class";
// Legacy-Typen — ChangeLog und Comment existieren nicht mehr in request.class.ts
type ChangeLog = any;
type Comment = any;
import {collection, collectionGroup, doc} from "firebase/firestore";

export class FirebaseDbRequestClosed extends FirebaseDbSuper {
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
    return collection(this.firebase.firestore, `requests/closed/requests`);
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
    throw Error(ERROR_WRONG_DB_CLASS);
    // Not implemented
  }
  /* =====================================================================
  // Daten für DB-Strutkur vorbereiten
  // ===================================================================== */
  prepareDataForDb<T extends ValueObject>({value}: PrepareDataForDb<T>) {
    const changeLog = value.changeLog.map((entry: ChangeLog) => {
      return {
        date: entry.date,
        user: {uid: entry.user.uid, displayName: entry.user.displayName},
        action: entry.action,
      };
    });

    const comments = value.comments.map((comment: Comment) => {
      return {
        ...comment,
        date: comment.date,
      };
    });
    let resolveDate: Date = new Date();
    value.resolveDate
      ? (resolveDate = value.resolveDate)
      : (resolveDate = new Date("9999-12-31"));

    return {
      number: value.number,
      status: value.status,
      createDate: value.createDate,
      resolveDate: resolveDate,
      requestObject: value.requestObject,
      requestType: value.requestType,
      author: value.author,
      assignee: value.assignee,
      comments: comments,
      changeLog: changeLog,
    };
  }
  /* =====================================================================
  // Daten für DB-Strutkur vorbereiten
  // ===================================================================== */
  prepareDataForApp<T extends ValueObject>({uid, value}: PrepareDataForApp) {
    return {
      uid: uid,
      number: value.number,
      status: value.status,
      createDate: value.createDate,
      resolveDate: value.resolveDate,
      requestObject: value.requestObject,
      requestType: value.requestType,
      author: value.author,
      assignee: value.assignee,
      comments: value?.comments ? value?.comments : [],
      changeLog: value.changeLog ? value.changeLog : [],
    } as unknown as T;
  }
  /* =====================================================================
  // Einstellungen für den Session Storage zurückgeben
  //===================================================================== */
  getSessionHandlerProperty(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.NONE;
  }
}
export default FirebaseDbRequestClosed;
