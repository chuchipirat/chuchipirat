import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import {ConfirmDialog} from "../ConfirmDialog";

/* ===================================================================
// ======================== Hilfsfunktionen ==========================
// =================================================================== */

/**
 * Rendert den Dialog mit Löschen/Abbrechen und gibt die Callbacks zurück.
 *
 * @param destructive - Wird an den Dialog durchgereicht (`undefined` = Prop weglassen).
 * @returns Die Mock-Callbacks für Bestätigen und Abbrechen.
 */
const renderConfirmDialog = (destructive?: boolean) => {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  render(
    <ConfirmDialog
      visible
      title="Zahlungsangaben löschen"
      text="Willst du wirklich löschen?"
      buttonTextConfirm="Löschen"
      buttonTextCancel="Abbrechen"
      destructive={destructive}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return {onConfirm, onCancel};
};

/* ===================================================================
// ======================== Tests ====================================
// =================================================================== */

describe("ConfirmDialog", () => {
  describe("destruktiv", () => {
    test("Fokus startet auf Abbrechen, Bestätigen-Button ist rot", () => {
      renderConfirmDialog(true);

      expect(screen.getByRole("button", {name: "Abbrechen"})).toHaveFocus();
      const confirmButton = screen.getByRole("button", {name: "Löschen"});
      expect(confirmButton).toHaveClass("MuiButton-containedError");
    });

    test("Enter direkt nach dem Öffnen bricht ab statt zu löschen", async () => {
      const {onConfirm, onCancel} = renderConfirmDialog(true);

      await userEvent.keyboard("{Enter}");

      expect(onConfirm).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    test("Klick auf Löschen bestätigt", async () => {
      const {onConfirm} = renderConfirmDialog(true);

      await userEvent.click(screen.getByRole("button", {name: "Löschen"}));

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe("nicht destruktiv (bisheriges Verhalten)", () => {
    test("ohne Prop: Fokus auf Bestätigen, Button als Text in Primärfarbe", () => {
      renderConfirmDialog();

      const confirmButton = screen.getByRole("button", {name: "Löschen"});
      expect(confirmButton).toHaveFocus();
      expect(confirmButton).toHaveClass("MuiButton-textPrimary");
    });
  });
});
