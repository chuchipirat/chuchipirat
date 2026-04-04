/**
 * Unit-Tests für DialogReportError.
 *
 * Prüft das Rendering des Dialogs, den Submit-Callback mit
 * eingegebenem Fehlertext und das Schliessen über den Abbrechen-Button.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import {DialogReportError} from "../dialogReportError";

/* ===================================================================
// ======================== Basis-Props ===============================
// =================================================================== */

const baseProps = {
  dialogOpen: true,
  handleOk: jest.fn(),
  handleClose: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("DialogReportError", () => {
  /* ------------------------------------------
  // 1. Rendert Dialog
  // ------------------------------------------ */
  test("Rendert Dialog mit Titel und Beschreibung", () => {
    render(<DialogReportError {...baseProps} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Titel und Button teilen denselben Text "Fehler melden"
    const matches = screen.getAllByText("Fehler melden");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  /* ------------------------------------------
  // 2. Submit ruft handleOk mit eingegebenem Text auf
  // ------------------------------------------ */
  test("Submit ruft handleOk mit eingegebenem Fehlertext auf", async () => {
    const handleOk = jest.fn();
    render(<DialogReportError {...baseProps} handleOk={handleOk} />);

    // Fehlerbeschreibung eingeben
    const textField = screen.getByLabelText(
      /Beschreibung des Fehlers im Rezept/,
    );
    await userEvent.type(textField, "Zutat fehlt");

    // Submit-Button hat denselben Text wie der Titel: "Fehler melden"
    const submitButton = screen.getByRole("button", {name: "Fehler melden"});
    await userEvent.click(submitButton);

    expect(handleOk).toHaveBeenCalledTimes(1);
    expect(handleOk).toHaveBeenCalledWith("Zutat fehlt");
  });

  /* ------------------------------------------
  // 3. Abbrechen-Button ruft handleClose auf
  // ------------------------------------------ */
  test("Abbrechen-Button ruft handleClose auf", async () => {
    const handleClose = jest.fn();
    render(<DialogReportError {...baseProps} handleClose={handleClose} />);

    const cancelButton = screen.getByRole("button", {name: "Abbrechen"});
    await userEvent.click(cancelButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
