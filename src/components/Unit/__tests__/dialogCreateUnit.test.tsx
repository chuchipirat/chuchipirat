/**
 * Unit-Tests fuer DialogCreateUnit.
 *
 * Prueft Rendering, Validierung (beide Felder gleichzeitig), Formular-Submit,
 * Reset nach Erstellen und Abbrechen sowie Enter-Key-Verhalten.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor, fireEvent} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import {DialogCreateUnit} from "../dialogCreateUnit";
import {UnitDimension} from "../unit.class";

/* ===================================================================
// ======================== Hilfsfunktionen ===========================
// =================================================================== */

/** Findet das Eingabefeld fuer die Abkuerzung (key) anhand der DOM-ID. */
const getKeyInput = () => document.getElementById("key") as HTMLInputElement;

/** Findet das Eingabefeld fuer den Namen anhand der DOM-ID. */
const getNameInput = () => document.getElementById("name") as HTMLInputElement;

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

interface RenderOptions {
  dialogOpen?: boolean;
  handleCreate?: jest.Mock;
  handleClose?: jest.Mock;
}

/**
 * Rendert den DialogCreateUnit mit konfigurierbaren Props.
 *
 * @param options - Optionale Konfiguration der Dialog-Props.
 * @returns Objekt mit den Mock-Callbacks.
 */
const renderDialog = (options: RenderOptions = {}) => {
  const {
    dialogOpen = true,
    handleCreate = jest.fn(),
    handleClose = jest.fn(),
  } = options;

  render(
    <DialogCreateUnit
      dialogOpen={dialogOpen}
      handleCreate={handleCreate}
      handleClose={handleClose}
    />
  );

  return {handleCreate, handleClose};
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => jest.clearAllMocks());

describe("DialogCreateUnit", () => {
  test("Rendert Dialog-Inhalt wenn dialogOpen=true", () => {
    renderDialog({dialogOpen: true});

    // Dialog-Titel und Formularfelder sichtbar
    expect(screen.getByText("Neue Einheit anlegen")).toBeInTheDocument();
    expect(getKeyInput()).toBeInTheDocument();
    expect(getNameInput()).toBeInTheDocument();
    expect(screen.getByRole("button", {name: /abbrechen/i})).toBeInTheDocument();
    expect(screen.getByRole("button", {name: /erstellen/i})).toBeInTheDocument();
  });

  test("Rendert keinen Inhalt wenn dialogOpen=false", () => {
    renderDialog({dialogOpen: false});

    // Dialog-Titel sollte nicht sichtbar sein
    expect(screen.queryByText("Neue Einheit anlegen")).not.toBeInTheDocument();
  });

  test("Zeigt Validierungsfehler fuer BEIDE Felder gleichzeitig wenn leer", async () => {
    const handleCreate = jest.fn();
    renderDialog({handleCreate});

    // fireEvent.submit umgeht die native required-Validierung des Browsers,
    // damit die React-eigene Validierung in onOkClick greift.
    const form = document.querySelector("form")!;
    fireEvent.submit(form);

    // Beide Fehlermeldungen muessen gleichzeitig erscheinen (Regressions-Test)
    await waitFor(() => {
      const errorMessages = screen.getAllByText("Bitte Einheit angeben.");
      expect(errorMessages).toHaveLength(2);
    });

    expect(handleCreate).not.toHaveBeenCalled();
  });

  test("Ruft handleCreate mit korrekten Unit-Daten auf", async () => {
    const handleCreate = jest.fn();
    renderDialog({handleCreate});

    // Felder ausfuellen
    await userEvent.type(getKeyInput(), "kg");
    await userEvent.type(getNameInput(), "Kilogramm");

    await userEvent.click(screen.getByRole("button", {name: /erstellen/i}));

    expect(handleCreate).toHaveBeenCalledTimes(1);
    expect(handleCreate).toHaveBeenCalledWith({
      key: "kg",
      name: "Kilogramm",
      dimension: UnitDimension.dimensionless,
    });
  });

  test("Setzt Formularfelder nach erfolgreichem Erstellen zurueck", async () => {
    const handleCreate = jest.fn();
    renderDialog({handleCreate});

    const keyInput = getKeyInput();
    const nameInput = getNameInput();

    await userEvent.type(keyInput, "kg");
    await userEvent.type(nameInput, "Kilogramm");

    await userEvent.click(screen.getByRole("button", {name: /erstellen/i}));

    // Felder sollten zurueckgesetzt sein
    expect(keyInput).toHaveValue("");
    expect(nameInput).toHaveValue("");
  });

  test("Setzt Formular beim Abbrechen zurueck und ruft handleClose auf", async () => {
    const handleCreate = jest.fn();
    const handleClose = jest.fn();
    renderDialog({handleCreate, handleClose});

    const keyInput = getKeyInput();
    const nameInput = getNameInput();

    // Felder ausfuellen
    await userEvent.type(keyInput, "kg");
    await userEvent.type(nameInput, "Kilogramm");

    // Abbrechen
    await userEvent.click(screen.getByRole("button", {name: /abbrechen/i}));

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(handleCreate).not.toHaveBeenCalled();

    // Felder zurueckgesetzt
    expect(keyInput).toHaveValue("");
    expect(nameInput).toHaveValue("");
  });

  test("Enter-Taste submitted das Formular", async () => {
    const handleCreate = jest.fn();
    renderDialog({handleCreate});

    // Felder ausfuellen
    await userEvent.type(getKeyInput(), "ml");
    await userEvent.type(getNameInput(), "Milliliter");

    // Enter-Taste im letzten Feld druecken
    await userEvent.type(getNameInput(), "{enter}");

    expect(handleCreate).toHaveBeenCalledTimes(1);
    expect(handleCreate).toHaveBeenCalledWith({
      key: "ml",
      name: "Milliliter",
      dimension: UnitDimension.dimensionless,
    });
  });
});
