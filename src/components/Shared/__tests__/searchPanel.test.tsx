/**
 * Unit-Tests fuer die SearchPanel-Komponente.
 * Prueft Suchfeld-Rendering, Clear-Button und onChange-Verhalten.
 */

// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, fireEvent} from "@testing-library/react";
import "@testing-library/jest-dom";

import {SearchPanel} from "../searchPanel";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock fuer useCustomStyles — gibt ein leeres Styles-Objekt zurueck. */
jest.mock("../../../constants/styles", () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die SearchPanel-Komponente mit den uebergebenen Props.
 *
 * @param props Optionale Teilmenge der SearchPanel-Props.
 * @returns Render-Ergebnis von @testing-library/react.
 */
const renderSearchPanel = (
  props: Partial<React.ComponentProps<typeof SearchPanel>> = {}
) => {
  const defaultProps = {
    searchString: "",
    onUpdateSearchString: jest.fn(),
    onClearSearchString: jest.fn(),
    ...props,
  };
  return render(<SearchPanel {...defaultProps} />);
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SearchPanel", () => {
  test("Rendert ein Eingabefeld mit dem uebergebenen Suchbegriff", () => {
    renderSearchPanel({searchString: "Mehl"});

    const input = screen.getByDisplayValue("Mehl");
    expect(input).toBeInTheDocument();
  });

  test("Ruft onClearSearchString auf wenn der Clear-Button geklickt wird und ein Suchbegriff vorhanden ist", () => {
    const onClearSearchString = jest.fn();

    renderSearchPanel({
      searchString: "Zucker",
      onClearSearchString,
    });

    const clearButton = screen.getByLabelText("clear Search Term");
    fireEvent.click(clearButton);

    expect(onClearSearchString).toHaveBeenCalledTimes(1);
  });

  test("Ruft onClearSearchString nicht auf wenn der Clear-Button geklickt wird und kein Suchbegriff vorhanden ist", () => {
    const onClearSearchString = jest.fn();

    renderSearchPanel({
      searchString: "",
      onClearSearchString,
    });

    const clearButton = screen.getByLabelText("clear Search Term");
    fireEvent.click(clearButton);

    expect(onClearSearchString).not.toHaveBeenCalled();
  });

  test("Ruft onUpdateSearchString auf bei Aenderung des Eingabefeldes", () => {
    const onUpdateSearchString = jest.fn();

    renderSearchPanel({onUpdateSearchString});

    const input = screen.getByRole("textbox");
    fireEvent.change(input, {target: {value: "Reis"}});

    expect(onUpdateSearchString).toHaveBeenCalledTimes(1);
  });
});
