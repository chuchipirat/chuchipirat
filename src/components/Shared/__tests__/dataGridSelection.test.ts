/**
 * Unit-Tests für die Umrechnung zwischen UID-Listen und der Auswahl des
 * MUI-DataGrids.
 *
 * Seit MUI X 8 ist die Auswahl ein Objekt `{type, ids}` statt einer Liste.
 * `type: "exclude"` heisst «alle Zeilen ausser `ids`»; so meldet der Grid
 * z.B. «alle auswählen» über die Checkbox im Kopf.
 */
import {
  fromGridRowSelection,
  toGridRowSelection,
} from "../dataGridSelection";

const ROW_IDS = ["mat-1", "mat-2", "mat-3"];

describe("toGridRowSelection()", () => {
  it("übergibt die ausgewählten UIDs als «include»", () => {
    const selection = toGridRowSelection(["mat-1", "mat-3"]);

    expect(selection.type).toBe("include");
    expect([...selection.ids]).toEqual(["mat-1", "mat-3"]);
  });

  it("bildet eine leere Auswahl als «include» ohne IDs ab", () => {
    // «exclude» ohne IDs hiesse «alles ausgewählt»
    const selection = toGridRowSelection([]);

    expect(selection.type).toBe("include");
    expect(selection.ids.size).toBe(0);
  });
});

describe("fromGridRowSelection()", () => {
  it("liest «include» als Liste der UIDs in der Auswahlreihenfolge", () => {
    const uids = fromGridRowSelection(
      {type: "include", ids: new Set(["mat-3", "mat-1"])},
      ROW_IDS,
    );

    expect(uids).toEqual(["mat-3", "mat-1"]);
  });

  it("wandelt Zahlen-IDs in Strings", () => {
    const uids = fromGridRowSelection({type: "include", ids: new Set([7])}, []);

    expect(uids).toEqual(["7"]);
  });

  it("liest «exclude» ohne IDs als «alle Zeilen ausgewählt»", () => {
    const uids = fromGridRowSelection({type: "exclude", ids: new Set()}, ROW_IDS);

    expect(uids).toEqual(ROW_IDS);
  });

  it("liest «exclude» mit IDs als «alle ausser diesen»", () => {
    const uids = fromGridRowSelection(
      {type: "exclude", ids: new Set(["mat-2"])},
      ROW_IDS,
    );

    expect(uids).toEqual(["mat-1", "mat-3"]);
  });

  it("gibt nach Hin- und Rückweg dieselben UIDs zurück", () => {
    const uids = ["mat-2", "mat-1"];

    expect(fromGridRowSelection(toGridRowSelection(uids), ROW_IDS)).toEqual(uids);
  });
});
