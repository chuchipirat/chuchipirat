/**
 * Hilfsfunktionen der Datenintegritätsseite (Anzeige, Löschregeln, RPC-Parameter).
 *
 * Reine Funktionen ohne Seiteneffekte, damit sie ohne Rendering der grossen
 * Seite `dataIntegrity.tsx` testbar sind.
 */
import {
  DATA_INTEGRITY_BULK_EMPTY_CONFIRM as TEXT_BULK_EMPTY_CONFIRM,
  DATA_INTEGRITY_BULK_EMPTY_LABEL as TEXT_BULK_EMPTY_LABEL,
  DATA_INTEGRITY_BULK_SKIPPED_HINT as TEXT_BULK_SKIPPED_HINT,
  DATA_INTEGRITY_EVENT_DELETE_WARNING as TEXT_EVENT_DELETE_WARNING,
  DATA_INTEGRITY_EVENT_EMPTY as TEXT_EVENT_EMPTY,
  DATA_INTEGRITY_EVENT_HAS_DATA as TEXT_EVENT_HAS_DATA,
  DATA_INTEGRITY_INGREDIENTS_WITHOUT_PRODUCT_COUNT as TEXT_INGREDIENTS_WITHOUT_PRODUCT_COUNT,
  DATA_INTEGRITY_MATERIALS_WITHOUT_MATERIAL_COUNT as TEXT_MATERIALS_WITHOUT_MATERIAL_COUNT,
  DATA_INTEGRITY_RECIPE_TYPE_PRIVATE as TEXT_RECIPE_TYPE_PRIVATE,
  DATA_INTEGRITY_RECIPE_TYPE_PUBLIC as TEXT_RECIPE_TYPE_PUBLIC,
  DATA_INTEGRITY_RECIPE_TYPE_VARIANT as TEXT_RECIPE_TYPE_VARIANT,
} from "../../../constants/text";

/** Eine von einer Prüf-RPC gemeldete Auffälligkeit (JSON-Objekt). */
export type Anomaly = Record<string, unknown>;

/**
 * Regel für «Alle löschen», wenn nur ein Teil der Auffälligkeiten
 * automatisch gelöscht werden darf.
 *
 * @param isDeletable Entscheidet, ob eine Auffälligkeit im Sammel-Löschen enthalten ist.
 * @param buttonLabel Beschriftung des Buttons bei `count` löschbaren Einträgen.
 * @param confirmMessage Text des Bestätigungsdialogs bei `count` löschbaren Einträgen.
 * @param skippedHint Hinweis, wie viele Einträge übersprungen werden.
 */
export type BulkDeleteMode = {
  isDeletable: (anomaly: Anomaly) => boolean;
  buttonLabel: (count: number) => string;
  confirmMessage: (count: number) => string;
  skippedHint: (count: number) => string;
};

/**
 * Regel für das Löschen eines einzelnen Eintrags.
 *
 * @param params Zusätzliche RPC-Parameter (z.B. `{only_empty: false}`).
 * @param warning Zusatzhinweis im Bestätigungsdialog.
 */
export type SingleDeleteMode = {
  params: Record<string, unknown>;
  warning: string;
};

/**
 * Prüft, ob ein gemeldeter Anlass leer ist (keine Mahlzeiten, Listen, Spenden).
 *
 * Nur ein striktes `true` zählt als leer: Fehlt das Feld (z.B. ältere
 * DB-Version), gilt der Anlass als nicht leer und wird nie automatisch gelöscht.
 *
 * @param anomaly Auffälligkeit aus `check_events_without_*`.
 * @returns `true`, wenn der Anlass leer ist.
 * @example
 * isEmptyEvent({is_empty: true}) // true
 * isEmptyEvent({})               // false
 */
export const isEmptyEvent = (anomaly: Anomaly): boolean =>
  anomaly.is_empty === true;

/** Liest eine Anzahl aus einem JSON-Feld; fehlende oder ungültige Werte zählen als 0. */
const toCount = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

/** Formatiert einen ISO-Zeitstempel als Schweizer Datum; `null` bei ungültigem Wert. */
const formatDate = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("de-CH");
};

/**
 * Beschreibt den Inhalt eines gemeldeten Anlasses in einer Zeile, damit der
 * Admin vor dem Löschen sieht, was mit dem Anlass verloren geht.
 *
 * @param anomaly Auffälligkeit aus `check_events_without_*`.
 * @returns Zeile wie «Leer · angelegt 12.11.2026 von Anna · Köch:innen 1 · Mahlzeiten 0 · Listen 0 · Spenden 0».
 * @example
 * describeEventAnomaly({is_empty: true, cook_count: 1}) // "Leer · Köch:innen 1 · Mahlzeiten 0 · Listen 0 · Spenden 0"
 */
export const describeEventAnomaly = (anomaly: Anomaly): string => {
  const parts: string[] = [
    isEmptyEvent(anomaly) ? TEXT_EVENT_EMPTY : TEXT_EVENT_HAS_DATA,
  ];

  const createdAt = formatDate(anomaly.created_at);
  const createdBy =
    typeof anomaly.created_by_name === "string" && anomaly.created_by_name
      ? anomaly.created_by_name
      : null;
  if (createdAt) {
    parts.push(`angelegt ${createdAt}${createdBy ? ` von ${createdBy}` : ""}`);
  }

  const lastActivity = formatDate(anomaly.last_activity_at);
  if (lastActivity) parts.push(`zuletzt geändert ${lastActivity}`);

  parts.push(
    `Köch:innen ${toCount(anomaly.cook_count)}`,
    `Mahlzeiten ${toCount(anomaly.meal_count)}`,
    `Listen ${toCount(anomaly.list_count)}`,
    `Spenden ${toCount(anomaly.donation_count)}`,
  );
  return parts.join(" · ");
};

/** Art der fehlenden Referenz eines Rezepts. */
export type BrokenRecipeKind = "ingredient" | "material";

/** Höchstzahl der einzeln aufgeführten Zeilen pro Rezept. */
const MAX_LISTED_ROWS = 5;

/** Anzeigetexte je Rezepttyp. */
const RECIPE_TYPE_LABELS: Record<string, string> = {
  public: TEXT_RECIPE_TYPE_PUBLIC,
  private: TEXT_RECIPE_TYPE_PRIVATE,
  variant: TEXT_RECIPE_TYPE_VARIANT,
};

const quantityFormat = new Intl.NumberFormat("de-CH", {
  maximumFractionDigits: 2,
});

/** Liest die Liste der betroffenen Zeilen; alles andere als ein Array gilt als leer. */
const toBrokenRows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter(
        (row): row is Record<string, unknown> =>
          typeof row === "object" && row !== null,
      )
    : [];

/** Beschreibt eine Zutat ohne Produkt, z.B. «500 Bund (frisch)». */
const describeIngredientRow = (row: Record<string, unknown>): string => {
  const quantity = quantityFormat.format(toCount(row.quantity));
  const unit = typeof row.unit === "string" ? row.unit : "";
  const detail =
    typeof row.detail === "string" && row.detail ? ` (${row.detail})` : "";
  return `${quantity} ${unit}`.trim() + detail;
};

/**
 * Beschreibt die betroffenen Zeilen. Bei Materialien ist nur die Menge
 * bekannt; Zeilen ohne Menge sind leere Zeilen und werden nicht aufgelistet.
 */
const describeBrokenRows = (
  rows: Record<string, unknown>[],
  kind: BrokenRecipeKind,
): string | null => {
  const described =
    kind === "ingredient"
      ? rows.map(describeIngredientRow)
      : rows
          .filter((row) => toCount(row.quantity) > 0)
          .map((row) => `Menge ${quantityFormat.format(toCount(row.quantity))}`);
  if (described.length === 0) return null;
  const listed = described.slice(0, MAX_LISTED_ROWS).join(", ");
  return described.length > MAX_LISTED_ROWS ? `${listed}, …` : listed;
};

/**
 * Beschreibt ein Rezept mit Zutaten ohne Produkt bzw. Materialien ohne
 * Material in einer Zeile: Rezepttyp, Ersteller, Anzahl und betroffene Zeilen.
 *
 * Bei privaten Rezepten steht der Hinweis, dass nur der Ersteller sie
 * bearbeiten kann — der Admin muss dann die Person kontaktieren.
 *
 * @param anomaly Auffälligkeit aus `check_recipe_ingredients_without_product`
 *   bzw. `check_recipe_materials_without_material`.
 * @param kind Ob es um Zutaten oder Materialien geht.
 * @returns Zeile wie «Öffentlich · von Anna · 2 Zutaten ohne Produkt: 500 Bund (frisch), 2».
 * @example
 * describeBrokenRecipeAnomaly({recipe_type: "public", broken_count: 1, broken_rows: [{quantity: 2}]}, "ingredient")
 * // "Öffentlich · 1 Zutat ohne Produkt: 2"
 */
export const describeBrokenRecipeAnomaly = (
  anomaly: Anomaly,
  kind: BrokenRecipeKind,
): string => {
  const parts: string[] = [];

  const typeLabel =
    typeof anomaly.recipe_type === "string"
      ? RECIPE_TYPE_LABELS[anomaly.recipe_type]
      : undefined;
  if (typeLabel) parts.push(typeLabel);

  if (typeof anomaly.created_by_name === "string" && anomaly.created_by_name) {
    parts.push(`von ${anomaly.created_by_name}`);
  }

  const rows = toBrokenRows(anomaly.broken_rows);
  const count = anomaly.broken_count === undefined ? rows.length : toCount(anomaly.broken_count);
  const countText =
    kind === "ingredient"
      ? TEXT_INGREDIENTS_WITHOUT_PRODUCT_COUNT(count)
      : TEXT_MATERIALS_WITHOUT_MATERIAL_COUNT(count);
  const rowsText = describeBrokenRows(rows, kind);
  parts.push(rowsText ? `${countText}: ${rowsText}` : countText);

  return parts.join(" · ");
};

/**
 * Baut die Parameter für eine Cleanup-RPC. Der ID-Parametername wird aus dem
 * ID-Feld abgeleitet (`event_id` → `event_ids`).
 *
 * @param idField Feld der Auffälligkeit, das die ID enthält (z.B. `event_id`).
 * @param ids Zu löschende IDs.
 * @param extraParams Zusätzliche Parameter (z.B. `{only_empty: false}`).
 * @returns Parameter-Objekt für `supabase.rpc`.
 * @example
 * buildCleanupParams("event_id", ["a"], {only_empty: false}) // {event_ids: ["a"], only_empty: false}
 */
export const buildCleanupParams = (
  idField: string,
  ids: string[],
  extraParams: Record<string, unknown> = {},
): Record<string, unknown> => ({
  [`${idField.replace("_id", "")}_ids`]: ids,
  ...extraParams,
});

/**
 * Filtert die Auffälligkeiten, die «Alle löschen» erfasst.
 *
 * @param anomalies Alle Auffälligkeiten einer Prüfung.
 * @param mode Sammel-Löschregel; ohne Regel sind alle löschbar.
 * @returns Die durch «Alle löschen» erfassten Auffälligkeiten.
 */
export const getBulkDeletableAnomalies = (
  anomalies: Anomaly[],
  mode?: BulkDeleteMode,
): Anomaly[] => (mode ? anomalies.filter(mode.isDeletable) : anomalies);

/**
 * Baut den Text des Bestätigungsdialogs für das Löschen eines Eintrags.
 *
 * @param name Anzeigename des Eintrags.
 * @param id ID des Eintrags.
 * @param description Optionale Inhaltsbeschreibung (z.B. von {@link describeEventAnomaly}).
 * @param warning Optionaler Zusatzhinweis (z.B. Kaskaden-Warnung).
 * @returns Dialogtext.
 */
export const buildSingleDeleteMessage = (
  name: string,
  id: string,
  description?: string,
  warning?: string,
): string =>
  [
    `Soll "${name}" (${id}) wirklich gelöscht werden?`,
    description ? `${description}.` : null,
    warning ?? null,
  ]
    .filter(Boolean)
    .join(" ");

/**
 * Gemeinsame Lösch-Optionen der beiden Anlass-Prüfungen
 * («ohne Zeitscheiben», «ohne Köch:innen»): Inhalt anzeigen, Einzellöschen
 * für jeden Anlass, «Alle löschen» nur für leere Anlässe.
 */
export const EVENT_CLEANUP_OPTIONS: {
  describeAnomaly: (anomaly: Anomaly) => string;
  bulkDelete: BulkDeleteMode;
  singleDelete: SingleDeleteMode;
} = {
  describeAnomaly: describeEventAnomaly,
  bulkDelete: {
    isDeletable: isEmptyEvent,
    buttonLabel: TEXT_BULK_EMPTY_LABEL,
    confirmMessage: TEXT_BULK_EMPTY_CONFIRM,
    skippedHint: TEXT_BULK_SKIPPED_HINT,
  },
  singleDelete: {
    params: {only_empty: false},
    warning: TEXT_EVENT_DELETE_WARNING,
  },
};
