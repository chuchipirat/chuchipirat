/**
 * Change-Management Objekt für das festhalten von
 * Created / Edited
 * @param date - Datum der Änderung
 * @param fromUid - UID des Users
 * @param fromDisplayName - Anzeigename des Users
 */
export interface ChangeRecord {
  date: Date;
  fromUid: string;
  fromDisplayName: string;
}
export interface ButtonAction {
  buttonText: string;
  onClick: (
    event: React.MouseEvent<HTMLButtonElement>,
    value?: {[key: string]: any}
  ) => void;
}
