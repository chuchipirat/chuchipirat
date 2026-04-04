/**
 * Unit-Tests fuer UnitAutocomplete.
 *
 * Prueft korrektes Rendering mit Label und Optionsauswahl
 * via onChange-Callback.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import {UnitAutocomplete} from "../unitAutocomplete";
import {Unit, UnitDimension} from "../unit.class";

/* ===================================================================
// ======================== Testdaten =================================
// =================================================================== */

const mockUnits: Unit[] = [
  {key: "kg", name: "Kilogramm", dimension: UnitDimension.mass},
  {key: "g", name: "Gramm", dimension: UnitDimension.mass},
  {key: "l", name: "Liter", dimension: UnitDimension.volume},
  {key: "Stk", name: "Stück", dimension: UnitDimension.dimensionless},
];

beforeEach(() => jest.clearAllMocks());

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("UnitAutocomplete", () => {
  test("Rendert mit korrektem Label", () => {
    const onChange = jest.fn();

    render(
      <UnitAutocomplete
        unitKey=""
        units={mockUnits}
        onChange={onChange}
      />
    );

    // Standard-Label auf nicht-xs Bildschirmen ist "Einheit"
    expect(screen.getByLabelText(/Einheit/i)).toBeInTheDocument();
  });

  test("Zeigt Optionen und ruft onChange bei Auswahl auf", async () => {
    const onChange = jest.fn();

    render(
      <UnitAutocomplete
        unitKey=""
        units={mockUnits}
        onChange={onChange}
      />
    );

    const input = screen.getByLabelText(/Einheit/i);

    // Autocomplete oeffnen und tippen
    await userEvent.click(input);
    await userEvent.type(input, "kg");

    // Option in der Dropdown-Liste auswaehlen
    const option = await screen.findByRole("option", {name: "kg"});
    await userEvent.click(option);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    // Pruefen, dass der korrekte Wert uebergeben wurde
    const callArgs = onChange.mock.calls[0];
    // callArgs: [event, newValue, action, objectId]
    expect(callArgs[1]).toEqual(
      expect.objectContaining({key: "kg", name: "Kilogramm"})
    );
    expect(callArgs[3]).toBe("unit"); // objectId ohne componentKey
  });
});
