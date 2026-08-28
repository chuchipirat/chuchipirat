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
/**
 * Generische Aktion mit Button-Text und onClick-Handler.
 * Der Typ-Parameter T erlaubt typsichere Übergabe von Zusatzwerten.
 *
 * @param T Typ des optionalen Werts, der an onClick übergeben wird (Standard: unknown).
 */
export interface ButtonAction<T = unknown> {
  buttonText: string;
  onClick: (
    event: React.MouseEvent<HTMLButtonElement>,
    value?: T,
  ) => void;
}

/**
 * Generisches Marker-Interface für Domänen-Objekte, die über ein
 * Repository persistiert werden. Domänenübergreifend verwendet (nicht nur
 * von Supabase-Repositories), daher hier statt in einem einzelnen
 * Repository-Modul definiert.
 */
export interface ValueObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/** Sortierrichtung für Repository-Abfragen. */
export enum SortOrder {
  desc = "desc",
  asc = "asc",
}
