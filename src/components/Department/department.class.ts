import {Utils} from "../Shared/utils.class";
import Firebase from "../Firebase/firebase.class";
import {ValueObject} from "../Firebase/Db/firebase.db.super.class";
import AuthUser from "../Firebase/Authentication/authUser.class";
import {FirebaseAnalyticEvent} from "../../constants/firebaseEvent";
import {logEvent} from "firebase/analytics";

interface GetAllDepartments {
  firebase: Firebase;
}
interface CreateDepartment {
  firebase: Firebase;
  name: string;
  pos: number;
  authUser: AuthUser;
}
interface SetPositionForDepartment {
  departmentList: Department[];
  departmentUid: Department["uid"];
  newPos: Department["pos"];
}
interface SaveAllDepartments {
  firebase: Firebase;
  authUser: AuthUser;
  departments: Department[];
}

export default class Department {
  uid: string;
  name: string;
  pos: number;
  usable: boolean;
  /* =====================================================================
// Constructor
// ===================================================================== */
  constructor() {
    this.uid = "";
    this.name = "";
    this.pos = 0;
    this.usable = false;
  }

  /* =====================================================================
  // Alle Einheiten aus der DB holen
  // ===================================================================== */
  static async getAllDepartments({firebase}: GetAllDepartments) {
    let departments: Department[] = [];

    await firebase.masterdata.department
      .read<ValueObject>({uids: []})
      .then((result) => {
        Object.keys(result).forEach((key) => {
          departments.push({
            uid: key,
            name: result[key].name,
            pos: result[key].pos,
            usable: result[key].usable,
          });
        });
      })
      .catch((error: Error) => {
        throw error;
      });

    departments = Utils.sortArray({
      array: departments,
      attributeName: "name",
    });

    return departments;
  }
  /* =====================================================================
  // Abteilung anlegen
  // ===================================================================== */
  static createDepartment = async ({
    firebase,
    name,
    pos,
    authUser,
  }: CreateDepartment) => {
    const department = new Department();
    department.uid = crypto.randomUUID();
    department.name = name;
    department.pos = pos;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {uid: excluded, ...dbDepartment} = department;

    firebase.masterdata.department
      .updateFields({
        uids: [],
        values: {[department.uid]: dbDepartment},
        authUser: authUser,
      })
      .then(() => {
        logEvent(firebase.analytics, FirebaseAnalyticEvent.departmentCreated);
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
    return department;
  };
  /* =====================================================================
  // Neue Position setzen
  // ===================================================================== */
  static setPositionForDepartment({
    departmentList,
    departmentUid,
    newPos,
  }: SetPositionForDepartment) {
    const department = departmentList.find(
      (department) => department.uid === departmentUid
    );
    if (!department) {
      return;
    }

    departmentList = Department._sortListByPos(departmentList);
    // Einträge neu nummerieren --> funtkioniert nur wenn Tabelle sortiert ist
    if (department.pos > newPos) {
      // // das was die aktuelle Position hält, muss eins rauf.
      for (let i = newPos; i < department.pos; i++) {
        departmentList[i - 1].pos = i + 1;
      }
    } else {
      // department.pos -1 +1 --> -1 für Array Zugriff
      // +1 für den nächsten Eintrag anpassen
      for (let i = department.pos; i < newPos; i++) {
        departmentList[i].pos -= 1;
      }
    }
    department.pos = newPos;
    // sortieren bevor wir abschliessen
    return Department._sortListByPos(departmentList);
  }
  /* =====================================================================
  // Alle Abteilungen speichern
  // ===================================================================== */
  static saveAllDepartments = async ({
    firebase,
    authUser,
    departments,
  }: SaveAllDepartments) => {
    firebase.masterdata.department
      .update<Array<Department>>({
        uids: [""],
        value: departments,
        authUser: authUser,
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  };
  /* =====================================================================
  // PRIVATE: sortieren nach Position
  // ===================================================================== */
  // Liste nach Position sortieren
  static _sortListByPos(list: Department[]) {
    return list.sort((a, b) => (a.pos > b.pos ? 1 : -1));
  }
}
