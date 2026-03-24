/**
 * Unit-Tests fuer EnhancedTable.
 *
 * Testet das Rendern von Spaltenköpfen, Datenzellen, Sichtbarkeits-
 * steuerung, verschiedene Spaltentypen, verschachtelte Eigenschaften
 * per Punkt-Notation, clientseitiges Sortieren sowie die Callbacks
 * onRowClick und onIconClick.
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, within} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import EditIcon from "@mui/icons-material/Edit";

import {EnhancedTable,
  Column,
  ColumnTextAlign,
  TableColumnTypes,
} from "../enhancedTable";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: useCustomStyles — gibt ein minimales Styles-Objekt zurück. */
jest.mock("../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({typographyCode: {fontFamily: "monospace"}})),
}));

/** Mock: Utils.getDomain — gibt die Domain aus einer URL zurück. */
jest.mock("../utils.class", () => ({
  Utils: {
    getDomain: jest.fn((url: string) => {
      try {
        return new URL(url).hostname;
      } catch {
        return url;
      }
    }),
  },
}));

/* ===================================================================
// ======================== Hilfsdaten ================================
// =================================================================== */

/** Minimale String-Spalten-Definition */
const makeStringColumn = (id: string, label: string): Column => ({
  id,
  type: TableColumnTypes.string,
  textAlign: ColumnTextAlign.left,
  disablePadding: false,
  label,
  visible: true,
});

/** Einfache Testdaten */
const SIMPLE_DATA = [
  {id: "row-1", name: "Alpha", count: 3},
  {id: "row-2", name: "Beta", count: 1},
  {id: "row-3", name: "Gamma", count: 2},
];

const SIMPLE_COLUMNS: Column[] = [
  makeStringColumn("name", "Name"),
  {
    ...makeStringColumn("count", "Anzahl"),
    type: TableColumnTypes.number,
  },
];

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert EnhancedTable mit den übergebenen Props.
 *
 * @param props - Optionale Props (überschreiben Standardwerte)
 * @returns Render-Ergebnis von @testing-library/react
 */
const renderTable = (
  props: Partial<React.ComponentProps<typeof EnhancedTable>> = {}
) => {
  const defaults: React.ComponentProps<typeof EnhancedTable> = {
    tableData: SIMPLE_DATA,
    tableColumns: SIMPLE_COLUMNS,
    keyColum: "id",
  };
  return render(<EnhancedTable {...defaults} {...props} />);
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("EnhancedTable", () => {
  /* ------------------------------------------------------------------
  // Spaltenköpfe
  // ------------------------------------------------------------------ */
  describe("Spaltenköpfe", () => {
    test("Zeigt alle sichtbaren Spaltenüberschriften an", () => {
      renderTable();

      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Anzahl")).toBeInTheDocument();
    });

    test("Versteckte Spalten erscheinen nicht im Kopf", () => {
      const columns: Column[] = [
        makeStringColumn("name", "Name"),
        {...makeStringColumn("hidden", "Versteckt"), visible: false},
      ];
      renderTable({tableColumns: columns});

      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.queryByText("Versteckt")).not.toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------
  // Datenzellen
  // ------------------------------------------------------------------ */
  describe("Datenzellen", () => {
    test("Zeigt alle Datenwerte in Tabellenzeilen an", () => {
      renderTable();

      expect(screen.getByText("Alpha")).toBeInTheDocument();
      expect(screen.getByText("Beta")).toBeInTheDocument();
      expect(screen.getByText("Gamma")).toBeInTheDocument();
    });

    test("Versteckte Spalten erscheinen nicht in Datenzellen", () => {
      const data = [{id: "r1", name: "Sichtbar", secret: "GEHEIM"}];
      const columns: Column[] = [
        makeStringColumn("name", "Name"),
        {...makeStringColumn("secret", "Geheim"), visible: false},
      ];
      renderTable({tableData: data, tableColumns: columns});

      expect(screen.getByText("Sichtbar")).toBeInTheDocument();
      expect(screen.queryByText("GEHEIM")).not.toBeInTheDocument();
    });

    test("Leere Datenliste rendert ohne Fehler", () => {
      renderTable({tableData: []});

      // Kopfzeilen noch vorhanden
      expect(screen.getByText("Name")).toBeInTheDocument();
      // Kein Dateninhalt
      expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------
  // Spaltentypen
  // ------------------------------------------------------------------ */
  describe("Spaltentypen", () => {
    test("string-Spalte rendert den Textwert", () => {
      const data = [{id: "r1", label: "Hallo Welt"}];
      renderTable({
        tableData: data,
        tableColumns: [makeStringColumn("label", "Label")],
      });

      expect(screen.getByText("Hallo Welt")).toBeInTheDocument();
    });

    test("number-Spalte rendert den numerischen Wert", () => {
      const data = [{id: "r1", count: 42}];
      const columns: Column[] = [
        {
          ...makeStringColumn("count", "Anzahl"),
          type: TableColumnTypes.number,
        },
      ];
      renderTable({tableData: data, tableColumns: columns});

      expect(screen.getByText("42")).toBeInTheDocument();
    });

    test("checkbox-Spalte rendert eine deaktivierte Checkbox", () => {
      const data = [{id: "r1", active: true}];
      const columns: Column[] = [
        {
          ...makeStringColumn("active", "Aktiv"),
          type: TableColumnTypes.checkbox,
        },
      ];
      renderTable({tableData: data, tableColumns: columns});

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toBeChecked();
      expect(checkbox).toBeDisabled();
    });

    test("checkbox-Spalte: unchecked wird korrekt gerendert", () => {
      const data = [{id: "r1", active: false}];
      const columns: Column[] = [
        {
          ...makeStringColumn("active", "Aktiv"),
          type: TableColumnTypes.checkbox,
        },
      ];
      renderTable({tableData: data, tableColumns: columns});

      expect(screen.getByRole("checkbox")).not.toBeChecked();
    });

    test("button-Spalte rendert einen IconButton", () => {
      const onIconClick = jest.fn();
      const data = [{id: "r1", name: "Zeile"}];
      const columns: Column[] = [
        makeStringColumn("name", "Name"),
        {
          ...makeStringColumn("action", "Aktion"),
          type: TableColumnTypes.button,
          iconButton: <EditIcon data-testid="edit-icon" />,
        },
      ];
      renderTable({tableData: data, tableColumns: columns, onIconClick});

      expect(screen.getByTestId("edit-icon")).toBeInTheDocument();
    });

    test("button-Spalte ruft onIconClick mit der Zeile auf", async () => {
      const onIconClick = jest.fn();
      const data = [{id: "r1", name: "Zeile"}];
      const columns: Column[] = [
        makeStringColumn("name", "Name"),
        {
          ...makeStringColumn("action", "Aktion"),
          type: TableColumnTypes.button,
          // data-testid ermöglicht gezieltes Auffinden des Buttons
          iconButton: <EditIcon data-testid="action-edit-icon" />,
        },
      ];
      renderTable({tableData: data, tableColumns: columns, onIconClick});

      // Der TableSortLabel rendert ebenfalls role="button" → gezielt über testid klicken
      await userEvent.click(screen.getByTestId("action-edit-icon"));

      expect(onIconClick).toHaveBeenCalledTimes(1);
      expect(onIconClick).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({id: "r1", name: "Zeile"})
      );
    });

    test("link-Spalte rendert einen Anker-Link", () => {
      const data = [{id: "r1", url: "https://example.com/path"}];
      const columns: Column[] = [
        {
          ...makeStringColumn("url", "URL"),
          type: TableColumnTypes.link,
        },
      ];
      renderTable({tableData: data, tableColumns: columns});

      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "https://example.com/path");
      // getDomain-Mock gibt den Hostnamen zurück
      expect(link).toHaveTextContent("example.com");
    });

    test("chip-Spalte rendert einen MUI Chip mit dem Zellwert", () => {
      const data = [{id: "r1", status: "Aktiv"}];
      const columns: Column[] = [
        {
          ...makeStringColumn("status", "Status"),
          type: TableColumnTypes.chip,
        },
      ];
      renderTable({tableData: data, tableColumns: columns});

      // MUI Chip rendert den Label-Text
      expect(screen.getByText("Aktiv")).toBeInTheDocument();
    });

    test("JSX-Spalte rendert das enthaltene Element", () => {
      const data = [
        {id: "r1", content: <span data-testid="custom-jsx">Inhalt</span>},
      ];
      const columns: Column[] = [
        {
          ...makeStringColumn("content", "Inhalt"),
          type: TableColumnTypes.JSX,
        },
      ];
      renderTable({tableData: data, tableColumns: columns});

      expect(screen.getByTestId("custom-jsx")).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------
  // Punkt-Notation (verschachtelte Eigenschaften)
  // ------------------------------------------------------------------ */
  describe("Punkt-Notation", () => {
    test("Löst verschachtelte Eigenschaften korrekt auf", () => {
      const data = [{id: "r1", address: {city: "Zürich"}}];
      const columns: Column[] = [
        {
          ...makeStringColumn("address.city", "Stadt"),
          type: TableColumnTypes.string,
        },
      ];
      renderTable({tableData: data, tableColumns: columns});

      expect(screen.getByText("Zürich")).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------
  // Sortierung
  // ------------------------------------------------------------------ */
  describe("Sortierung", () => {
    test("Klick auf Spaltenüberschrift wechselt Sortierrichtung", async () => {
      renderTable();

      const nameHeader = screen.getByText("Name");
      // Erster Klick: aufsteigend sortieren nach "name"
      await userEvent.click(nameHeader);
      // Zweiter Klick: absteigend
      await userEvent.click(nameHeader);

      // Der TableSortLabel erhält aria-sort="descending"
      const sortLabel = nameHeader.closest("[aria-sort]");
      expect(sortLabel).toHaveAttribute("aria-sort", "descending");
    });

    test("Standardsortierung zeigt alle Zeilen an (kein Absturz)", () => {
      renderTable();

      // Alle drei Zeilen müssen vorhanden sein
      expect(screen.getByText("Alpha")).toBeInTheDocument();
      expect(screen.getByText("Beta")).toBeInTheDocument();
      expect(screen.getByText("Gamma")).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------
  // onRowClick
  // ------------------------------------------------------------------ */
  describe("onRowClick", () => {
    test("Ruft onRowClick mit dem Zeilenschlüssel auf", async () => {
      const onRowClick = jest.fn();
      renderTable({onRowClick});

      const rows = screen.getAllByRole("row");
      // rows[0] ist der Kopf, rows[1..] sind Datenzeilen
      await userEvent.click(rows[1]);

      expect(onRowClick).toHaveBeenCalledTimes(1);
      // Der übergebene Schlüssel ist ein String aus keyColum
      expect(typeof onRowClick.mock.calls[0][1]).toBe("string");
    });

    test("Kein Fehler, wenn onRowClick nicht gesetzt ist", async () => {
      renderTable({onRowClick: undefined});

      const rows = screen.getAllByRole("row");
      // Klick ohne Handler darf keinen Fehler werfen
      await userEvent.click(rows[1]);
    });
  });

  /* ------------------------------------------------------------------
  // monoSpaces
  // ------------------------------------------------------------------ */
  describe("monoSpaces", () => {
    test("Gibt sx-Prop weiter, wenn monoSpaces=true gesetzt ist", () => {
      const data = [{id: "r1", code: "abc123"}];
      const columns: Column[] = [
        {
          ...makeStringColumn("code", "Code"),
          monoSpaces: true,
        },
      ];
      renderTable({tableData: data, tableColumns: columns});

      // Die Zelle muss vorhanden sein — sx wird intern angewendet
      expect(screen.getByText("abc123")).toBeInTheDocument();
    });
  });
});
