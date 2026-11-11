import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";

import {ConfirmSecureDialog} from "../ConfirmSecureDialog";

/* ===================================================================
// ======================== Hilfsfunktionen ==========================
// =================================================================== */

/**
 * Rendert den sicheren Lösch-Dialog mit dem Namen eines Anlasses als
 * Bestätigungstext.
 *
 * @returns Das Eingabefeld für den Bestätigungstext.
 */
const renderConfirmSecureDialog = () => {
  render(
    <ConfirmSecureDialog
      visible
      title="Löschen?"
      subtitle="Das kann nicht rückgängig gemacht werden."
      text="Gib zur Bestätigung den Namen des Anlasses ein:"
      buttonTextConfirm="Löschen"
      buttonTextCancel="Abbrechen"
      confirmationString="Anlass 1"
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
    />,
  );
  return screen.getByRole("textbox");
};

/* ===================================================================
// ======================== Tests ====================================
// =================================================================== */

describe("ConfirmSecureDialog — Validierung der Eingabe", () => {
  // Der Dialog verlangt je nach Aufrufer einen Namen, eine Einheit oder ein
  // Wort. Die Fehlermeldung darf deshalb nicht von einer "ID" sprechen.
  test("zeigt bei falscher Eingabe eine neutrale Meldung ohne 'ID'", () => {
    const confirmationInput = renderConfirmSecureDialog();

    fireEvent.change(confirmationInput, {target: {value: "Anlass"}});

    expect(screen.getByText("Die Eingabe stimmt nicht überein")).toBeInTheDocument();
    expect(screen.queryByText(/\bID\b/)).not.toBeInTheDocument();
  });

  test("zeigt bei korrekter Eingabe keine Fehlermeldung", () => {
    const confirmationInput = renderConfirmSecureDialog();

    fireEvent.change(confirmationInput, {target: {value: "Anlass 1"}});

    expect(screen.queryByText("Die Eingabe stimmt nicht überein")).not.toBeInTheDocument();
  });
});
