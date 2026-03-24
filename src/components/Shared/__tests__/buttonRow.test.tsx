/**
 * Unit-Tests fuer die ButtonRow-Komponente.
 * Prueft Sichtbarkeit, Klick-Handler und Overflow-Menue-Verhalten.
 */

// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, fireEvent} from "@testing-library/react";
import "@testing-library/jest-dom";

import {ButtonRow, CustomButton} from "../buttonRow";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock fuer useCustomStyles — gibt ein leeres Styles-Objekt zurueck. */
jest.mock("../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({heroButton: {}, button: {}})),
}));

/**
 * Mock fuer useMediaQuery — standardmaessig kein Breakpoint aktiv,
 * kann pro Test ueberschrieben werden.
 */
let mockUseMediaQueryReturnValue = false;
jest.mock("@mui/material/useMediaQuery", () => ({
  __esModule: true,
  default: jest.fn(() => mockUseMediaQueryReturnValue),
}));

/* ===================================================================
// ======================== Hilfs-Funktionen ==========================
// =================================================================== */

/**
 * Erstellt einen Test-Button mit Standardwerten.
 *
 * @param overrides Optionale Ueberschreibungen der Button-Eigenschaften.
 * @returns Ein CustomButton-Objekt.
 */
const createButton = (overrides: Partial<CustomButton> = {}): CustomButton => ({
  id: "btn-test",
  label: "Test",
  hero: false,
  variant: "contained",
  color: "primary",
  onClick: jest.fn(),
  visible: true,
  ...overrides,
});

/**
 * Rendert die ButtonRow-Komponente mit den uebergebenen Props.
 *
 * @param props Optionale Teilmenge der ButtonRow-Props.
 * @returns Render-Ergebnis von @testing-library/react.
 */
const renderButtonRow = (
  props: Partial<React.ComponentProps<typeof ButtonRow>> = {}
) => {
  const defaultProps = {
    buttons: [] as CustomButton[],
    ...props,
  };
  return render(<ButtonRow {...defaultProps} />);
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMediaQueryReturnValue = false;
});

describe("ButtonRow", () => {
  describe("Sichtbare Buttons", () => {
    test("Rendert sichtbare Buttons", () => {
      const buttons = [
        createButton({id: "btn-save", label: "Speichern", visible: true}),
        createButton({id: "btn-cancel", label: "Abbrechen", visible: true}),
      ];

      renderButtonRow({buttons});

      expect(screen.getByText("Speichern")).toBeInTheDocument();
      expect(screen.getByText("Abbrechen")).toBeInTheDocument();
    });

    test("Versteckt Buttons wenn visible auf false gesetzt ist", () => {
      const buttons = [
        createButton({id: "btn-visible", label: "Sichtbar", visible: true}),
        createButton({
          id: "btn-hidden",
          label: "Versteckt",
          visible: false,
        }),
      ];

      renderButtonRow({buttons});

      expect(screen.getByText("Sichtbar")).toBeInTheDocument();
      expect(screen.queryByText("Versteckt")).not.toBeInTheDocument();
    });
  });

  describe("Klick-Handler", () => {
    test("Ruft onClick auf wenn ein Button geklickt wird", () => {
      const onClick = jest.fn();
      const buttons = [
        createButton({id: "btn-action", label: "Aktion", onClick}),
      ];

      renderButtonRow({buttons});

      fireEvent.click(screen.getByText("Aktion"));

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Overflow-Menue", () => {
    test("Zeigt Overflow-Icon wenn mehr Buttons als sichtbare Plaetze vorhanden sind (XS-Breakpoint)", () => {
      // Simuliere XS-Breakpoint: alle Breakpoint-Abfragen geben true zurueck
      mockUseMediaQueryReturnValue = true;

      const buttons = [
        createButton({id: "btn-1", label: "Erster"}),
        createButton({id: "btn-2", label: "Zweiter"}),
        createButton({id: "btn-3", label: "Dritter"}),
      ];

      renderButtonRow({buttons});

      // Bei XS werden nur 2 Buttons angezeigt, der Rest ins Overflow-Menue
      const moreButton = screen.getByLabelText("more");
      expect(moreButton).toBeInTheDocument();
    });

    test("Zeigt alle Buttons ohne Overflow-Menue bei genuegend Platz", () => {
      // Kein Breakpoint aktiv — alle Buttons sichtbar
      mockUseMediaQueryReturnValue = false;

      const buttons = [
        createButton({id: "btn-1", label: "Erster"}),
        createButton({id: "btn-2", label: "Zweiter"}),
      ];

      renderButtonRow({buttons});

      expect(screen.queryByLabelText("more")).not.toBeInTheDocument();
    });
  });
});
