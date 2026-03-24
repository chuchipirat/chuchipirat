/**
 * Unit-Tests fuer die FormListItem-Komponente.
 * Prueft Edit-/View-Modus, Datumsformatierung und Divider-Verhalten.
 */

// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";

import {FormListItem} from "../FormListItem";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock fuer useCustomStyles — gibt ein leeres Styles-Objekt zurueck. */
jest.mock("../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({
    listItemIcon: {},
    listItemTitle: {},
    listItemContent: {},
    typographyCode: {},
  })),
}));

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die FormListItem-Komponente mit den uebergebenen Props.
 *
 * @param props Optionale Ueberschreibungen der FormListItem-Props.
 * @returns Render-Ergebnis von @testing-library/react.
 */
const renderFormListItem = (
  props: Partial<React.ComponentProps<typeof FormListItem>> = {}
) => {
  const defaultProps = {
    value: "",
    id: "test-field",
    label: "Testfeld",
    ...props,
  };
  return render(<FormListItem {...defaultProps} />);
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
});

describe("FormListItem", () => {
  describe("Bearbeitungsmodus (editMode)", () => {
    test("Rendert ein TextField mit dem uebergebenen Wert", () => {
      renderFormListItem({
        editMode: true,
        value: "Testinhalt",
        label: "Bezeichnung",
      });

      const textField = screen.getByDisplayValue("Testinhalt");
      expect(textField).toBeInTheDocument();
    });

    test("Rendert das Label des TextFields", () => {
      renderFormListItem({
        editMode: true,
        value: "Wert",
        label: "Mein Label",
      });

      expect(screen.getByLabelText("Mein Label")).toBeInTheDocument();
    });
  });

  describe("Ansichtsmodus (View-Modus)", () => {
    test("Rendert ListItemText mit dem Labeltext", () => {
      renderFormListItem({
        editMode: false,
        value: "Angezeigter Wert",
        label: "Feldbezeichnung",
      });

      expect(screen.getByText("Feldbezeichnung")).toBeInTheDocument();
      expect(screen.getByText("Angezeigter Wert")).toBeInTheDocument();
    });
  });

  describe("Datumsformatierung", () => {
    test("Rendert ein Datum im de-CH Format", () => {
      const testDate = new Date(2025, 2, 15); // 15. Maerz 2025

      renderFormListItem({
        editMode: false,
        value: testDate,
        label: "Erstelldatum",
      });

      // de-CH medium Format: "15. Maerz 2025" oder "15. Marz 2025" je nach Umgebung
      // Wir pruefen ob das Datum ueberhaupt gerendert wird
      const formattedDate = testDate.toLocaleString("de-CH", {
        dateStyle: "medium",
      });
      expect(screen.getByText(formattedDate)).toBeInTheDocument();
    });
  });

  describe("Divider", () => {
    test("Rendert standardmaessig eine Trennlinie im View-Modus", () => {
      const {container} = renderFormListItem({
        editMode: false,
        value: "Wert",
      });

      // MUI Divider rendert ein <hr> oder ein <li> mit der Divider-Klasse
      // eslint-disable-next-line testing-library/no-container
      const divider = container.querySelector(".MuiDivider-root");
      expect(divider).toBeInTheDocument();
    });

    test("Rendert keine Trennlinie wenn withDivider auf false gesetzt ist", () => {
      const {container} = renderFormListItem({
        editMode: false,
        value: "Wert",
        withDivider: false,
      });

      // eslint-disable-next-line testing-library/no-container
      const divider = container.querySelector(".MuiDivider-root");
      expect(divider).not.toBeInTheDocument();
    });

    test("Rendert keine Trennlinie im Bearbeitungsmodus", () => {
      const {container} = renderFormListItem({
        editMode: true,
        value: "Wert",
        withDivider: true,
      });

      // eslint-disable-next-line testing-library/no-container
      const divider = container.querySelector(".MuiDivider-root");
      expect(divider).not.toBeInTheDocument();
    });
  });
});
