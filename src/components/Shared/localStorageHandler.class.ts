import {ValueObject} from "../Firebase/Db/firebase.db.super.class";

interface GetLocalStorageEntryProps {
  path: string;
}

export interface LocalStorageValue {
  date: Date;
  values: any;
}

interface SetLocalStorageEntryProps<T> {
  path: string;
  value: T;
}
interface HasDataToBeFetchedProps<T> {
  values: T | undefined;
}
interface DeleteLocalStorageEntry {
  path: string;
}

export enum LocalStoragePath {
  editMode = "editMode",
}

// ==================================================================== */
/**
 * Local-Storage Klasse
 * Holt und schreibt Werte in den Local Storage
 */
export class LocalStorageHandler {
  /**
   * Werte aus Local Storage lesen
   * @param uid - Eindeutige ID des Local-Storage
   */
  static getLocalStorageEntry = <T extends ValueObject>({
    path,
  }: GetLocalStorageEntryProps) => {
    const localStorageValue = localStorage.getItem(path);
    if (localStorageValue) {
      return JSON.parse(localStorageValue) as T;
    }
  };

  /**
   * Werte in den Local Storage schreiben
   * @param uid - Eindeutige ID des Local-Storage
   * @param values - Werte (als Objekt)
   */
  static setLocalStorageEntry = <T extends ValueObject>({
    path,
    value,
  }: SetLocalStorageEntryProps<T>) => {
    localStorage.setItem(path, JSON.stringify(value));
  };

  /**
   * Prüft ob die Daten erneut geladen werden müssen
   * (älter als 1 Stunde oder nicht vorhanden).
   *
   * @param values Gespeicherte Werte mit Zeitstempel.
   * @returns `true` wenn die Daten neu geladen werden müssen.
   */
  static hasDataToBeFetched = <T extends ValueObject>({
    values,
  }: HasDataToBeFetchedProps<T>) => {
    if (values) {
      if (
        (new Date().getTime() - new Date(values?.date).getTime()) / 1000 >
        3600
      ) {
        // Letzter Fetch ist über 1 Stunde her (3600s) — neu holen
        return true;
      } else {
        return false;
      }
    } else {
      return true;
    }
  };
  /**
   * Delete local storage entry of
   */
  static deleteLocalStorageEntry = ({path}: DeleteLocalStorageEntry) => {
    localStorage.removeItem(path);
  };
}
