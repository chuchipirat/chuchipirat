/**
 * Unit-Tests für DialogScaleRecipe.
 *
 * Prüft das Rendering mit initialen Portionen, die Anzeige des
 * Einheiten-Umrechnungs-Schalters sowie die Callbacks für
 * OK- und Abbrechen-Button.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, fireEvent} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import {DialogScaleRecipe} from "../dialogScaleRecipe";

/* ===================================================================
// ======================== Basis-Props ===============================
// =================================================================== */

const baseProps = {
  dialogOpen: true,
  handleOk: jest.fn(),
  handleClose: jest.fn(),
  scaledPortions: 4,
};

beforeEach(() => jest.clearAllMocks());

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("DialogScaleRecipe", () => {
  /* ------------------------------------------
  // 1. Rendert mit initialen Portionen
  // ------------------------------------------ */
  test("Rendert Dialog mit initialen Portionen", () => {
    render(<DialogScaleRecipe {...baseProps} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Rezept skalieren")).toBeInTheDocument();

    // Portionen-Feld enthält den Initialwert
    const portionsInput = screen.getByLabelText(
      "zu skalierende Portionen",
    ) as HTMLInputElement;
    expect(portionsInput.value).toBe("4");
  });

  /* ------------------------------------------
  // 2. Zeigt den Einheiten-Umrechnen-Schalter
  // ------------------------------------------ */
  test("Zeigt Einheiten-Umrechnen-Schalter", () => {
    render(<DialogScaleRecipe {...baseProps} />);

    expect(screen.getByText("Einheiten umrechnen")).toBeInTheDocument();

    // Switch ist standardmässig aktiviert
    const switchInput = document.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(switchInput).toBeInTheDocument();
    expect(switchInput.checked).toBe(true);
  });

  /* ------------------------------------------
  // 3. OK-Button ruft handleOk mit Werten auf
  // ------------------------------------------ */
  test("OK-Button ruft handleOk mit Portionen und Optionen auf", async () => {
    const handleOk = jest.fn();
    render(<DialogScaleRecipe {...baseProps} handleOk={handleOk} />);

    const okButton = screen.getByRole("button", {name: "Ok"});
    await userEvent.click(okButton);

    expect(handleOk).toHaveBeenCalledTimes(1);
    expect(handleOk).toHaveBeenCalledWith({
      scaledPortions: 4,
      scalingOptions: {convertUnits: true},
    });
  });

  /* ------------------------------------------
  // 4. Abbrechen-Button ruft handleClose auf
  // ------------------------------------------ */
  test("Abbrechen-Button ruft handleClose auf", async () => {
    const handleClose = jest.fn();
    render(<DialogScaleRecipe {...baseProps} handleClose={handleClose} />);

    const cancelButton = screen.getByRole("button", {name: "Abbrechen"});
    await userEvent.click(cancelButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  /* ------------------------------------------
  // 5. Kappt ungültige Portionen-Eingaben
  // ------------------------------------------ */
  describe("Kappung ungültiger Portionen-Eingaben", () => {
    test("kappt eine negativ eingegebene Portionenzahl auf 0", () => {
      render(<DialogScaleRecipe {...baseProps} />);

      const portionsInput = screen.getByLabelText(
        "zu skalierende Portionen",
      ) as HTMLInputElement;
      fireEvent.change(portionsInput, {target: {value: "-10"}});

      expect(portionsInput.value).toBe("0");
    });

    test("kappt eine absurd grosse Portionenzahl auf den Maximalwert", () => {
      render(<DialogScaleRecipe {...baseProps} />);

      const portionsInput = screen.getByLabelText(
        "zu skalierende Portionen",
      ) as HTMLInputElement;
      fireEvent.change(portionsInput, {target: {value: "99999999999"}});

      expect(portionsInput.value).toBe("1000000");
    });

    test("behandelt nicht parsebare Eingabe als 0", () => {
      render(<DialogScaleRecipe {...baseProps} />);

      const portionsInput = screen.getByLabelText(
        "zu skalierende Portionen",
      ) as HTMLInputElement;
      fireEvent.change(portionsInput, {target: {value: ""}});

      expect(portionsInput.value).toBe("0");
    });
  });
});
