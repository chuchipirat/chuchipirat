/**
 * Unit-Tests für den Fortschrittsdialog des ZIP-Exports
 * (exportProgressDialog.tsx).
 */
import React from "react";
import {render, screen, within} from "@testing-library/react";
import "@testing-library/jest-dom";

import {ExportProgressDialog} from "../exportProgressDialog";
import {EXPORT_ZIP_PROGRESS_TITLE as TEXT_EXPORT_ZIP_PROGRESS_TITLE} from "../../../../../constants/text/expenseTracking";

describe("ExportProgressDialog", () => {
  test("ohne Fortschritt kein Dialog", () => {
    render(<ExportProgressDialog progress={null} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("Dialog mit Titel, solange exportiert wird", () => {
    render(<ExportProgressDialog progress={{loaded: 2, total: 5}} />);

    expect(
      screen.getByRole("dialog", {name: TEXT_EXPORT_ZIP_PROGRESS_TITLE}),
    ).toBeInTheDocument();
  });

  test("beim Laden: Text mit Zahlen und Balken mit Prozentwert", () => {
    render(<ExportProgressDialog progress={{loaded: 2, total: 5}} />);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Belege werden geladen (2 von 5)",
    );
    expect(within(dialog).getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
  });

  test("vor dem ersten Beleg (total 0): laufender Balken ohne Wert, kein Text", () => {
    render(<ExportProgressDialog progress={{loaded: 0, total: 0}} />);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("progressbar")).not.toHaveAttribute(
      "aria-valuenow",
    );
    expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
  });
});
