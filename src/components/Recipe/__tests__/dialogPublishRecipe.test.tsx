/**
 * Unit-Tests für DialogPublishRecipe.
 *
 * Prüft das Rendering des Dialog-Titels, den OK-Callback mit
 * eingegebener Nachricht und das Schliessen über den Abbrechen-Button.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import {DialogPublishRecipe} from "../dialogPublishRecipe";

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

describe("DialogPublishRecipe", () => {
  /* ------------------------------------------
  // 1. Rendert Dialog-Titel
  // ------------------------------------------ */
  test("Rendert Dialog mit Titel", () => {
    render(<DialogPublishRecipe {...baseProps} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("Rezept für die Community veröffentlichen"),
    ).toBeInTheDocument();
  });

  /* ------------------------------------------
  // 2. OK-Button ruft handleOk mit Nachricht auf
  // ------------------------------------------ */
  test("OK-Button ruft handleOk mit eingegebener Nachricht auf", async () => {
    const handleOk = jest.fn();
    render(<DialogPublishRecipe {...baseProps} handleOk={handleOk} />);

    // Nachricht eingeben
    const textField = screen.getByLabelText("Nachricht für Review-Person");
    await userEvent.type(textField, "Bitte prüfen");

    const okButton = screen.getByRole("button", {
      name: "Rezept für Review einreichen",
    });
    await userEvent.click(okButton);

    expect(handleOk).toHaveBeenCalledTimes(1);
    expect(handleOk).toHaveBeenCalledWith("Bitte prüfen");
  });

  /* ------------------------------------------
  // 3. Abbrechen-Button ruft handleClose auf
  // ------------------------------------------ */
  test("Abbrechen-Button ruft handleClose auf", async () => {
    const handleClose = jest.fn();
    render(<DialogPublishRecipe {...baseProps} handleClose={handleClose} />);

    const cancelButton = screen.getByRole("button", {name: "Abbrechen"});
    await userEvent.click(cancelButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
