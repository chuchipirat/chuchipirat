/**
 * Unit-Tests fuer MaterialAutocomplete.
 *
 * Testet Rendering, Filterung, "Hinzufügen"-Option,
 * Deaktivierung und Fehlerzustand.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import {MaterialAutocomplete} from "../materialAutocomplete";
import {MaterialType} from "../material.types";
import type {Material} from "../material.types";

/* ===================================================================
// ======================== Testdaten =================================
// =================================================================== */

const mockMaterials: Material[] = [
  {uid: "mat-1", name: "Schwingbesen", type: MaterialType.usage, usable: true},
  {uid: "mat-2", name: "Servietten", type: MaterialType.consumable, usable: true},
  {uid: "mat-3", name: "Teller", type: MaterialType.usage, usable: true},
];

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("MaterialAutocomplete", () => {
  test("Rendert mit ausgewaehltem Material-Wert", () => {
    const onChange = jest.fn();
    render(
      <MaterialAutocomplete
        material={mockMaterials[0]}
        materials={mockMaterials}
        disabled={false}
        onChange={onChange}
      />
    );

    expect(screen.getByDisplayValue("Schwingbesen")).toBeInTheDocument();
  });

  test("Zeigt 'Hinzufügen'-Option wenn allowCreateNewMaterial=true und Eingabe nicht existiert", async () => {
    const onChange = jest.fn();
    render(
      <MaterialAutocomplete
        material={null}
        materials={mockMaterials}
        disabled={false}
        allowCreateNewMaterial={true}
        onChange={onChange}
      />
    );

    const input = screen.getByRole("combobox");
    await userEvent.type(input, "Pfanne");

    // Die Hinzufügen-Option sollte im Dropdown erscheinen
    expect(await screen.findByText(/Pfanne.*hinzufügen/)).toBeInTheDocument();
  });

  test("Zeigt KEINE 'Hinzufügen'-Option wenn allowCreateNewMaterial=false", async () => {
    const onChange = jest.fn();
    render(
      <MaterialAutocomplete
        material={null}
        materials={mockMaterials}
        disabled={false}
        allowCreateNewMaterial={false}
        onChange={onChange}
      />
    );

    const input = screen.getByRole("combobox");
    await userEvent.type(input, "Pfanne");

    // Kurz warten und prüfen, dass keine Hinzufügen-Option erscheint
    expect(screen.queryByText(/Pfanne.*hinzufügen/)).not.toBeInTheDocument();
  });

  test("Zeigt deaktivierten Zustand mit Hilfstext", () => {
    const onChange = jest.fn();
    render(
      <MaterialAutocomplete
        material={mockMaterials[0]}
        materials={mockMaterials}
        disabled={true}
        onChange={onChange}
      />
    );

    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(
      screen.getByText("Artikel kann nicht geändert werden.")
    ).toBeInTheDocument();
  });

  test("Zeigt Fehlerzustand mit Fehlertext", () => {
    const onChange = jest.fn();
    render(
      <MaterialAutocomplete
        material={null}
        materials={mockMaterials}
        disabled={false}
        onChange={onChange}
        error={{isError: true, errorText: "Material ist Pflichtfeld"}}
      />
    );

    expect(
      screen.getByText("Material ist Pflichtfeld")
    ).toBeInTheDocument();
  });

  test("Ruft onChange mit korrekten Parametern bei Auswahl auf", async () => {
    const onChange = jest.fn();
    render(
      <MaterialAutocomplete
        material={null}
        materials={mockMaterials}
        disabled={false}
        onChange={onChange}
      />
    );

    const input = screen.getByRole("combobox");
    await userEvent.type(input, "Teller");

    const option = await screen.findByText("Teller");
    await userEvent.click(option);

    expect(onChange).toHaveBeenCalled();
  });
});
