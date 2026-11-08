import {LoggedNameHint} from "../Matching/nameHint.types";

/**
 * Regelversion für Vorgänge, die noch mit der bisherigen Ähnlichkeitsprüfung
 * liefen. Erlaubt später den Vergleich alter gegen neue Regeln.
 */
export const LEGACY_RULES_VERSION = 0;

/**
 * Was angelegt werden sollte. Werte = Labels des Postgres-ENUMs
 * `item_creation_type`.
 */
export enum CreationItemType {
  PRODUCT = "product",
  MATERIAL = "material",
}

/**
 * Stelle in der App, an der der Anlegen-Dialog geöffnet wurde. Werte = Labels
 * des Postgres-ENUMs `item_creation_origin`.
 */
export enum CreationOrigin {
  RECIPE = "recipe",
  MENUPLAN = "menuplan",
  SHOPPING_LIST = "shopping_list",
  MATERIAL_LIST = "material_list",
  PRODUCTS_ADMIN = "products_admin",
  MATERIALS_ADMIN = "materials_admin",
}

/**
 * Wie der Vorgang endete. Werte = Labels des Postgres-ENUMs
 * `item_creation_decision`.
 */
export enum CreationDecision {
  /** Ein neuer Eintrag wurde angelegt. */
  CREATED = "created",
  /** Statt neu anzulegen wurde ein vorgeschlagener Eintrag übernommen. */
  SUGGESTION_TAKEN = "suggestion_taken",
  /** Der Dialog wurde ohne Ergebnis geschlossen. */
  CANCELLED = "cancelled",
}

/**
 * Ein Anlegen-Vorgang im Produkt- oder Material-Dialog (camelCase).
 *
 * Enthält bewusst keine `id` und keine Audit-Felder: Die App schreibt den
 * Vorgang nur und liest ihn nie zurück; id, Zeitpunkt und Person setzt die
 * Datenbank.
 */
export type ItemCreationLogDomain = {
  /** Produkt oder Material. */
  itemType: CreationItemType;
  /** Stelle in der App, an der der Dialog geöffnet wurde. */
  origin: CreationOrigin;
  /** Name, wie er beim ersten Prüfen eingegeben war. */
  enteredName: string;
  /** Name beim Abschluss (kann nach den Hinweisen geändert sein), `null` bei Abbruch. */
  finalName: string | null;
  /** Wie der Vorgang endete. */
  decision: CreationDecision;
  /** Alle Hinweise, die während des Vorgangs angezeigt wurden. */
  hints: LoggedNameHint[];
  /** Version der Prüfregeln, mit der die Hinweise entstanden sind. */
  rulesVersion: number;
  /** Angelegtes oder übernommenes Produkt, sonst `null`. */
  resultProductId: string | null;
  /** Angelegtes oder übernommenes Material, sonst `null`. */
  resultMaterialId: string | null;
  /** Name des Ergebnisses; bleibt lesbar, wenn der Eintrag später gelöscht wird. */
  resultName: string | null;
};

/**
 * Zeile der Tabelle `item_creation_logs` (snake_case). Bedeutung der Felder
 * siehe {@link ItemCreationLogDomain}.
 */
export type ItemCreationLogRow = {
  id: string;
  item_type: CreationItemType;
  origin: CreationOrigin;
  entered_name: string;
  final_name: string | null;
  decision: CreationDecision;
  hints: LoggedNameHint[];
  rules_version: number;
  result_product_id: string | null;
  result_material_id: string | null;
  result_name: string | null;
  created_at: string;
  created_by: string | null;
};

/**
 * Ausgang eines Anlegen-Vorgangs, wie ihn der Dialog meldet.
 *
 * Der Dialog gibt nur an, was im jeweiligen Fall zutrifft; fehlende Felder
 * werden im Protokoll zu `null`.
 *
 * @example
 * {decision: CreationDecision.SUGGESTION_TAKEN, resultProductId: "p-1", resultName: "Tomaten"}
 * {decision: CreationDecision.CANCELLED}
 */
export type CreationAttemptResult = {
  /** Wie der Vorgang endete. */
  decision: CreationDecision;
  /** Name, unter dem angelegt wurde; nur bei `CREATED`. */
  finalName?: string;
  /** Angelegtes oder übernommenes Produkt. */
  resultProductId?: string;
  /** Angelegtes oder übernommenes Material. */
  resultMaterialId?: string;
  /** Name des angelegten oder übernommenen Eintrags. */
  resultName?: string;
};
