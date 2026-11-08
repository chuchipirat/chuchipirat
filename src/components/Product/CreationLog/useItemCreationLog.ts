import React from "react";

import {LoggedNameHint} from "../Matching/nameHint.types";
import {
  CreationAttemptResult,
  CreationItemType,
  CreationOrigin,
  ItemCreationLogDomain,
  LEGACY_RULES_VERSION,
} from "./creationLog.types";
import {useDatabase} from "../../Database/DatabaseContext";
import {captureUnexpectedError} from "../../../utils/errorUtils";

/** Höchstlänge der Namensspalten, entspricht den CHECKs der Tabelle. */
const MAX_NAME_LENGTH = 200;

/** Feste Angaben zum Dialog, der den Hook verwendet. */
type UseItemCreationLogParams = {
  /** Ob der Dialog Produkte oder Materialien anlegt. */
  itemType: CreationItemType;
  /** Stelle in der App, an der der Dialog eingebunden ist. */
  origin: CreationOrigin;
};

/** Was während eines offenen Vorgangs gesammelt wird. */
type Notebook = {
  /** Eingegebener Name, getrimmt und gekürzt; leer, wenn der Dialog ohne Namen öffnete. */
  enteredName: string;
  /** Bisher gezeigte Hinweise, ohne Doppelte. */
  hints: LoggedNameHint[];
};

/**
 * Vergleichsschlüssel eines Hinweises: Art plus Vorschlags-IDs in ihrer
 * Reihenfolge. Zwei Hinweise mit gleichem Schlüssel gelten als derselbe
 * (die Prüfung kann bei mehreren OK-Klicks denselben Hinweis erneut zeigen).
 *
 * @param hint Gezeigter Hinweis.
 * @returns Schlüssel, z.B. `"similar_product|product-1,product-9"`.
 */
const hintKey = (hint: LoggedNameHint): string => {
  return `${hint.kind}|${hint.suggestions.map((suggestion) => suggestion.id).join(",")}`;
};

/**
 * Bereitet einen Namen fürs Protokoll auf: getrimmt und auf die erlaubte
 * Länge gekürzt, damit das Protokoll nie am CHECK der Tabelle scheitert.
 *
 * @param name Name, wie er im Dialog stand.
 * @returns Getrimmter, höchstens 200 Zeichen langer Name (evtl. leer).
 */
const toLoggableName = (name: string): string => {
  return name.trim().substring(0, MAX_NAME_LENGTH);
};

/**
 * Wie `toLoggableName`, für die optionalen Spalten `final_name` und
 * `result_name`: Die Tabelle erlaubt dort NULL, aber keinen leeren Text.
 *
 * @param name Name oder nichts.
 * @returns Aufbereiteter Name, `null` wenn nichts übrig bleibt.
 */
const toOptionalLoggableName = (name?: string | null): string | null => {
  return toLoggableName(name ?? "") || null;
};

/**
 * Protokolliert einen Anlegen-Vorgang im Produkt- oder Material-Dialog.
 *
 * Sammelt Name und gezeigte Hinweise in einer Ref (das Protokoll ist nicht
 * sichtbar, also kein Re-Render) und schreibt beim Abschluss genau eine
 * Zeile. Das Schreiben wird nicht abgewartet und wirft nie: Das Anlegen ist
 * die Aufgabe, das Protokoll nur Beobachtung. Die zurückgegebenen Funktionen
 * bleiben zwischen Renders gleich und dürfen in Effect-Abhängigkeiten stehen.
 *
 * @param params Produkt oder Material und Herkunft des Dialogs.
 * @returns `startAttempt`, `recordHint` und `finishAttempt`.
 * @example
 * const {startAttempt, recordHint, finishAttempt} = useItemCreationLog({
 *   itemType: CreationItemType.PRODUCT,
 *   origin: CreationOrigin.RECIPE,
 * });
 * startAttempt("Tomatem");
 * finishAttempt({decision: CreationDecision.CANCELLED});
 */
export const useItemCreationLog = ({
  itemType,
  origin,
}: UseItemCreationLogParams) => {
  const database = useDatabase();
  const notebookRef = React.useRef<Notebook | null>(null);

  /**
   * Beginnt einen Vorgang; ein noch offener wird ohne Eintrag verworfen.
   *
   * @param itemName Name beim Öffnen des Dialogs, darf leer sein.
   */
  const startAttempt = React.useCallback((itemName: string): void => {
    notebookRef.current = {enteredName: toLoggableName(itemName), hints: []};
  }, []);

  /**
   * Merkt sich einen gezeigten Hinweis für den offenen Vorgang. Ohne offenen
   * Vorgang oder bei einem schon gemerkten Hinweis passiert nichts.
   *
   * @param newHint Gezeigter Hinweis.
   */
  const recordHint = React.useCallback((newHint: LoggedNameHint): void => {
    if (!notebookRef.current) return;
    if (
      notebookRef.current.hints.some(
        (hint) => hintKey(hint) === hintKey(newHint),
      )
    )
      return;

    notebookRef.current.hints.push(newHint);
  }, []);

  /**
   * Schliesst den offenen Vorgang ab und schreibt ihn ins Protokoll. Ohne
   * offenen Vorgang (oder beim zweiten Aufruf) passiert nichts.
   *
   * @param result Ausgang des Vorgangs; fehlende Felder werden `null`.
   */
  const finishAttempt = React.useCallback(
    ({
      decision,
      finalName,
      resultProductId,
      resultMaterialId,
      resultName,
    }: CreationAttemptResult): void => {
      if (!notebookRef.current) return;
      const notebook = notebookRef.current;
      notebookRef.current = null;

      const loggableFinalName = toOptionalLoggableName(finalName);
      // Öffnete der Dialog ohne Namen, gilt der Endname als
      // Eingabe. Ganz ohne Namen ist der Vorgang wertlos und verletzte den CHECK.
      const enteredName = notebook.enteredName || loggableFinalName;
      if (!enteredName) return;

      const logEntry: ItemCreationLogDomain = {
        itemType: itemType,
        origin: origin,
        enteredName: enteredName,
        finalName: loggableFinalName,
        decision: decision,
        hints: notebook.hints,
        rulesVersion: LEGACY_RULES_VERSION,
        resultProductId: resultProductId ?? null,
        resultMaterialId: resultMaterialId ?? null,
        resultName: toOptionalLoggableName(resultName),
      };

      // Bewusst ohne await: Das Protokoll darf den Dialog nie aufhalten.
      database.itemCreationLogs.logCreation(logEntry).catch((error) =>
        captureUnexpectedError(error, {
          context: "Produkt/Material: Anlegen-Protokoll schreiben",
        }),
      );
    },
    [database, itemType, origin],
  );

  return {startAttempt, recordHint, finishAttempt};
};
