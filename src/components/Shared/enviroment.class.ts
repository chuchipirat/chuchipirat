import Firebase from "../Firebase/firebase.class";

interface GetActualVersion {
  firebase: Firebase;
}
// ===================================================================== */
/**
 * Aktuelle Version der DB holen
 * Wird benötigt um die Version im Browser mit der aktuellen Version zu
 * vergleichen. Falls eine neue Version vorhanden ist, muss der User
 * seinen Browser aktualisieren
 * @param object Objekt mit Firebase Referenz
 * @returns aktuelle Version
 */ export class Environment {
  static getActualVersion = async ({firebase}: GetActualVersion) => {
    let actualVersion = "";
    await firebase.configuration.version
      .read({uids: []})
      .then((result) => {
        actualVersion = result.actualVersion;
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });

    return actualVersion;
  };
}
