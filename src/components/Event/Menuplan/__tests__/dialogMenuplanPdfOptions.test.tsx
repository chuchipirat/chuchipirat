/**
 * Unit-Tests für dialogMenuplanPdfOptions.tsx.
 *
 * Getestet werden:
 * - Die Initialwerte der Exportoptionen (MENUPLAN_PDF_OPTIONS_INITIAL)
 * - Rendering der drei Schalter (Produkte, Materialien, Portionen)
 * - Bestätigen mit umgeschalteten Optionen
 * - Abbrechen und Zurücksetzen des internen Zustands
 * - Bestätigen ohne Änderungen (alle Optionen auf false)
 */
import React from "react";
import {render, screen, fireEvent} from "@testing-library/react";
import "@testing-library/jest-dom";

import {DialogMenuplanPdfOptions,
  MENUPLAN_PDF_OPTIONS_INITIAL,
} from "../dialogMenuplanPdfOptions";

import {
  MENUPLAN_PDF_OPTIONS_TITLE,
  MENUPLAN_PDF_SHOW_PRODUCTS,
  MENUPLAN_PDF_SHOW_MATERIALS,
  MENUPLAN_PDF_SHOW_PORTIONS,
  CANCEL,
  PRINTVERSION,
} from "../../../../constants/text";


/** Standard-Props für den Dialog erstellen. */
const createDefaultProps = (overrides: Record<string, unknown> = {}) => ({
  open: true,
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
  ...overrides,
});


/** Prüft die Struktur und Standardwerte der Exportoptionen-Konstante. */
describe("MENUPLAN_PDF_OPTIONS_INITIAL", () => {
  it("sollte alle drei Optionen auf false setzen", () => {
    expect(MENUPLAN_PDF_OPTIONS_INITIAL).toEqual({
      showProducts: false,
      showMaterials: false,
      showPortions: false,
    });
  });

  it("sollte genau drei Schlüssel enthalten", () => {
    const keys = Object.keys(MENUPLAN_PDF_OPTIONS_INITIAL);
    expect(keys).toHaveLength(3);
    expect(keys).toContain("showProducts");
    expect(keys).toContain("showMaterials");
    expect(keys).toContain("showPortions");
  });
});

/** Prüft das Rendering des Dialogs mit drei Schaltern. */
describe("DialogMenuplanPdfOptions — Rendering", () => {
  it("sollte den Titel und alle drei Schalter anzeigen", () => {
    const props = createDefaultProps();
    render(<DialogMenuplanPdfOptions {...props} />);

    // Titel prüfen
    expect(screen.getByText(MENUPLAN_PDF_OPTIONS_TITLE)).toBeInTheDocument();

    // Drei Schalter-Labels prüfen
    expect(
      screen.getByText(MENUPLAN_PDF_SHOW_PRODUCTS)
    ).toBeInTheDocument();
    expect(
      screen.getByText(MENUPLAN_PDF_SHOW_MATERIALS)
    ).toBeInTheDocument();
    expect(
      screen.getByText(MENUPLAN_PDF_SHOW_PORTIONS)
    ).toBeInTheDocument();

    // Buttons prüfen
    expect(screen.getByText(CANCEL)).toBeInTheDocument();
    expect(screen.getByText(PRINTVERSION)).toBeInTheDocument();
  });

  it("sollte alle Schalter initial auf unchecked haben", () => {
    const props = createDefaultProps();
    render(<DialogMenuplanPdfOptions {...props} />);

    // MUI Switch rendert ein input[type="checkbox"] intern
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(3);
    switches.forEach((sw) => {
      expect(sw).not.toBeChecked();
    });
  });
});

/** Prüft die Bestätigungs-Logik mit umgeschalteten Optionen. */
describe("DialogMenuplanPdfOptions — Bestätigen mit Änderungen", () => {
  it("sollte onConfirm mit allen aktivierten Optionen aufrufen", () => {
    const props = createDefaultProps();
    render(<DialogMenuplanPdfOptions {...props} />);

    // Alle drei Schalter umschalten
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]); // showProducts
    fireEvent.click(switches[1]); // showMaterials
    fireEvent.click(switches[2]); // showPortions

    // Bestätigen
    fireEvent.click(screen.getByText(PRINTVERSION));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith({
      showProducts: true,
      showMaterials: true,
      showPortions: true,
    });
  });

  it("sollte onConfirm mit nur einer aktivierten Option aufrufen", () => {
    const props = createDefaultProps();
    render(<DialogMenuplanPdfOptions {...props} />);

    // Nur den zweiten Schalter (showMaterials) umschalten
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[1]);

    fireEvent.click(screen.getByText(PRINTVERSION));

    expect(props.onConfirm).toHaveBeenCalledWith({
      showProducts: false,
      showMaterials: true,
      showPortions: false,
    });
  });
});

/** Prüft die Abbrechen-Logik und das Zurücksetzen des Zustands. */
describe("DialogMenuplanPdfOptions — Abbrechen und Zurücksetzen", () => {
  it("sollte onCancel aufrufen und den Zustand zurücksetzen", () => {
    const props = createDefaultProps();
    const {rerender} = render(<DialogMenuplanPdfOptions {...props} />);

    // Schalter umschalten
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]); // showProducts aktivieren
    fireEvent.click(switches[2]); // showPortions aktivieren

    // Prüfen, dass die Schalter tatsächlich umgeschaltet sind
    expect(switches[0]).toBeChecked();
    expect(switches[2]).toBeChecked();

    // Abbrechen
    fireEvent.click(screen.getByText(CANCEL));
    expect(props.onCancel).toHaveBeenCalledTimes(1);

    // Neu rendern — der Zustand sollte zurückgesetzt sein
    rerender(<DialogMenuplanPdfOptions {...props} />);

    const switchesAfterReset = screen.getAllByRole("switch");
    switchesAfterReset.forEach((sw) => {
      expect(sw).not.toBeChecked();
    });
  });
});

/** Prüft die Bestätigung ohne Änderungen (Standardwerte). */
describe("DialogMenuplanPdfOptions — Bestätigen ohne Änderungen", () => {
  it("sollte onConfirm mit allen Optionen auf false aufrufen", () => {
    const props = createDefaultProps();
    render(<DialogMenuplanPdfOptions {...props} />);

    // Direkt bestätigen ohne etwas umzuschalten
    fireEvent.click(screen.getByText(PRINTVERSION));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith({
      showProducts: false,
      showMaterials: false,
      showPortions: false,
    });
  });
});
