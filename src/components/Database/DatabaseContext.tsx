/**
 * DatabaseContext — React Context für den Datenbankzugriff.
 *
 * Stellt den DatabaseService über einen React Context bereit,
 * analog zum bestehenden FirebaseContext. Wird in index.jsx
 * als Provider eingebunden.
 */
import React from "react";
import DatabaseService from "./DatabaseService";

/** React Context, der die DatabaseService-Instanz hält */
export const DatabaseContext = React.createContext<DatabaseService | null>(null);

/**
 * Hook für den Zugriff auf den DatabaseService.
 * Muss innerhalb eines DatabaseContext.Provider verwendet werden.
 * @returns Die aktive DatabaseService-Instanz
 * @throws Error falls ausserhalb des Providers aufgerufen
 */
export const useDatabase = (): DatabaseService => {
  const database = React.useContext(DatabaseContext);
  if (!database)
    throw new Error(
      "useDatabase must be used within DatabaseContext.Provider"
    );
  return database;
};
