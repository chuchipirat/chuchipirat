/**
 * Umrechnung zwischen einer Liste ausgewählter UIDs (so führen die Seiten
 * ihre Auswahl im Zustand) und der Auswahl des MUI-DataGrids.
 *
 * Seit MUI X 8 ist die Grid-Auswahl ein Objekt `{type, ids}`: `include` heisst
 * «genau diese Zeilen», `exclude` «alle Zeilen ausser diesen» (so meldet der
 * Grid z.B. «alle auswählen» über die Checkbox im Kopf).
 */
import type {GridRowSelectionModel} from "@mui/x-data-grid";

/**
 * Wandelt die UIDs der Seite in die Auswahl für den DataGrid.
 *
 * Eine leere Liste wird zu `include` ohne IDs; `exclude` ohne IDs hiesse
 * «alles ausgewählt».
 *
 * @param uids UIDs der ausgewählten Zeilen.
 * @returns Auswahl für die Prop `rowSelectionModel`.
 * @example
 * <DataGrid rowSelectionModel={toGridRowSelection(selectedMaterialUids)} … />
 */
export function toGridRowSelection(uids: string[]): GridRowSelectionModel {
  return {type: "include", ids: new Set(uids)};
}

/**
 * Wandelt die vom DataGrid gemeldete Auswahl zurück in eine UID-Liste.
 *
 * @param model Auswahl aus `onRowSelectionModelChange`.
 * @param rowIds UIDs der Zeilen, die der Grid zeigt (für `exclude` nötig,
 *   um «alle ausser …» auszuschreiben).
 * @returns UIDs der ausgewählten Zeilen; bei `include` in Auswahlreihenfolge.
 * @example
 * fromGridRowSelection({type: "exclude", ids: new Set()}, ["a", "b"]) // ["a", "b"]
 */
export function fromGridRowSelection(
  model: GridRowSelectionModel,
  rowIds: string[],
): string[] {
  if (model.type === "include") {
    return [...model.ids].map((id) => String(id));
  }
  return rowIds.filter((rowId) => !model.ids.has(rowId));
}
