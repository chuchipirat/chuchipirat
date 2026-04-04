/**
 * Unit-Tests fuer DepartmentAutocomplete.
 *
 * Testet die Autocomplete-Komponente zur Abteilungsauswahl:
 * Standard-Label, ausgewaehlter Wert, Dropdown-Optionen,
 * onChange-Callback, deaktivierter Zustand, Fehlerzustand
 * und leere Optionsliste.
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import {DepartmentAutocomplete} from "../departmentAutocomplete";
import {DepartmentDomain} from "../../Database/Repository/DepartmentRepository";

/* ===================================================================
// ======================== Test-Daten ================================
// =================================================================== */

/** Mock-Abteilungen fuer die Autocomplete-Optionen */
const mockDepartments: DepartmentDomain[] = [
  {uid: "dept-1", name: "Gemuese", pos: 1, usable: true},
  {uid: "dept-2", name: "Fruechte", pos: 2, usable: true},
];

/** Standard-Props fuer die Komponente */
const defaultProps = {
  department: null as DepartmentDomain | null,
  departments: mockDepartments,
  disabled: false,
  onChange: jest.fn(),
};

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die DepartmentAutocomplete mit optionalen Prop-Ueberschreibungen.
 *
 * @param overrides - Optionale Prop-Ueberschreibungen
 */
const renderAutocomplete = (
  overrides: Partial<typeof defaultProps> = {}
) => {
  const props = {
    ...defaultProps,
    onChange: jest.fn(),
    ...overrides,
  };

  render(<DepartmentAutocomplete {...props} />);

  return props;
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DepartmentAutocomplete", () => {
  test("Zeigt Standard-Label 'Abteilung' an", () => {
    renderAutocomplete();

    expect(screen.getByLabelText("Abteilung")).toBeInTheDocument();
  });

  test("Zeigt ausgewaehlten Wert im Eingabefeld an", () => {
    renderAutocomplete({department: mockDepartments[0]});

    expect(screen.getByDisplayValue("Gemuese")).toBeInTheDocument();
  });

  test("Alle Optionen werden im Dropdown angezeigt", async () => {
    renderAutocomplete();

    // Dropdown oeffnen durch Klick auf den Pfeil-Button
    const openButton = screen.getByRole("button", {name: /open/i});
    await userEvent.click(openButton);

    await waitFor(() => {
      expect(screen.getByText("Gemuese")).toBeInTheDocument();
      expect(screen.getByText("Fruechte")).toBeInTheDocument();
    });
  });

  test("onChange wird beim Auswaehlen einer Option aufgerufen", async () => {
    const props = renderAutocomplete();

    // Dropdown oeffnen
    const openButton = screen.getByRole("button", {name: /open/i});
    await userEvent.click(openButton);

    // Option auswaehlen
    await waitFor(() => {
      expect(screen.getByText("Fruechte")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Fruechte"));

    await waitFor(() => {
      expect(props.onChange).toHaveBeenCalledTimes(1);
      // Zweites Argument ist der ausgewaehlte Wert
      expect(props.onChange.mock.calls[0][1]).toEqual(mockDepartments[1]);
    });
  });

  test("Deaktivierter Zustand zeigt Hinweistext an", () => {
    renderAutocomplete({disabled: true});

    const input = screen.getByRole("combobox");
    expect(input).toBeDisabled();
    expect(
      screen.getByText("Artikel kann nicht geändert werden.")
    ).toBeInTheDocument();
  });

  test("Fehlerzustand zeigt Fehlertext an", () => {
    renderAutocomplete({
      error: {isError: true, errorText: "Bitte Abteilung wählen."},
    } as any);

    expect(
      screen.getByText("Bitte Abteilung wählen.")
    ).toBeInTheDocument();
  });

  test("Leere Optionsliste zeigt 'Keine Einträge' an", async () => {
    renderAutocomplete({departments: []});

    // Dropdown oeffnen
    const openButton = screen.getByRole("button", {name: /open/i});
    await userEvent.click(openButton);

    await waitFor(() => {
      expect(screen.getByText("Keine Einträge")).toBeInTheDocument();
    });
  });
});
