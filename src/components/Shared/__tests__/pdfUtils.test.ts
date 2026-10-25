/**
 * Unit-Tests für `generateAndDownloadPdf` (pdfUtils.ts): Rückgabewert,
 * Download und Fehlermeldung an Sentry (Story 7.3a, B8).
 *
 * react-pdf, file-saver und Sentry werden gemockt; geprüft wird nur, was
 * die Funktion mit ihren Ergebnissen macht.
 */
jest.mock("@react-pdf/renderer", () => ({pdf: jest.fn()}));
jest.mock("file-saver", () => ({
  __esModule: true,
  default: {saveAs: jest.fn()},
}));
jest.mock("@sentry/react", () => ({captureException: jest.fn()}));

import React from "react";
import {pdf} from "@react-pdf/renderer";
import fileSaver from "file-saver";
import * as Sentry from "@sentry/react";

import {generateAndDownloadPdf} from "../pdfUtils";

const mockedPdf = jest.mocked(pdf);
/** Platzhalter für das PDF-Element; `pdf` ist gemockt. */
const PDF_ELEMENT = React.createElement("div");

/**
 * Lässt `pdf(...).toBlob()` mit dem gegebenen Ergebnis antworten.
 *
 * @param toBlob - Ersatz für `toBlob`.
 */
const mockToBlob = (toBlob: () => Promise<Blob>) => {
  // nur toBlob wird gebraucht; der Rest der react-pdf-Instanz fehlt bewusst
  mockedPdf.mockReturnValue({toBlob} as unknown as ReturnType<typeof pdf>);
};

describe("generateAndDownloadPdf", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("Erfolg: speichert unter dem Dateinamen und liefert true", async () => {
    const blob = new Blob(["%PDF"]);
    mockToBlob(() => Promise.resolve(blob));

    const isDownloaded = await generateAndDownloadPdf(
      PDF_ELEMENT,
      "Abrechnung.pdf",
    );

    expect(isDownloaded).toBe(true);
    expect(fileSaver.saveAs).toHaveBeenCalledWith(blob, "Abrechnung.pdf");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("Fehler: Sentry mit Dateiname und Kontext, onError, liefert false", async () => {
    const error = new Error("Bild kaputt");
    mockToBlob(() => Promise.reject(error));
    const onError = jest.fn();

    const isDownloaded = await generateAndDownloadPdf(
      PDF_ELEMENT,
      "Abrechnung.pdf",
      onError,
      {eventUid: "event-1"},
    );

    expect(isDownloaded).toBe(false);
    expect(fileSaver.saveAs).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      extra: {filename: "Abrechnung.pdf", eventUid: "event-1"},
    });
    expect(onError).toHaveBeenCalledWith(error);
  });

  test("geworfener Nicht-Error wird zu Error", async () => {
    mockToBlob(() => Promise.reject("kaputt"));
    const onError = jest.fn();

    await generateAndDownloadPdf(PDF_ELEMENT, "Abrechnung.pdf", onError);

    expect(onError).toHaveBeenCalledWith(new Error("kaputt"));
  });
});
