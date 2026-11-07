/**
 * Unit-Tests für `generateAndDownloadPdf` (pdfUtils.ts): Rückgabewert,
 * Download und Fehlermeldung an Sentry (Story 7.3a, B8); optionaler
 * Zwischenschritt `transformPdf` (Story 7.3b, C6); Element aus einer
 * Funktion (Zweidurchlauf, Story 7.5).
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
import {pdf, type DocumentProps} from "@react-pdf/renderer";
import fileSaver from "file-saver";
import * as Sentry from "@sentry/react";

import {generateAndDownloadPdf} from "../pdfUtils";

const mockedPdf = jest.mocked(pdf);
/**
 * Platzhalter für ein `<Document>` von react-pdf. `pdf()` ist gemockt, es
 * zählt nur, dass das Element den Typ eines PDF-Dokuments hat.
 */
const FakeDocument = (_props: DocumentProps) => null;
const PDF_ELEMENT = React.createElement(FakeDocument, {});

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

  test("mit transformPdf: speichert das umgewandelte PDF", async () => {
    // jsdom-Blobs haben kein arrayBuffer(); ein Ersatz mit genau dieser Methode
    const originalBytes = new Uint8Array([1, 2, 3]);
    mockToBlob(() =>
      Promise.resolve({
        arrayBuffer: async () => originalBytes.slice().buffer,
      } as unknown as Blob),
    );
    const transformPdf = jest.fn(async () => new Uint8Array([9, 8, 7, 6]));

    const isDownloaded = await generateAndDownloadPdf(
      PDF_ELEMENT,
      "Abrechnung.pdf",
      undefined,
      undefined,
      transformPdf,
    );

    expect(isDownloaded).toBe(true);
    expect(transformPdf).toHaveBeenCalledWith(originalBytes);
    const [savedBlob, fileName] = jest.mocked(fileSaver.saveAs).mock.calls[0];
    expect(fileName).toBe("Abrechnung.pdf");
    expect(savedBlob).toBeInstanceOf(Blob);
    // 4 Bytes aus transformPdf, nicht die 3 Originalbytes
    expect((savedBlob as Blob).size).toBe(4);
    expect((savedBlob as Blob).type).toBe("application/pdf");
  });

  test("transformPdf wirft: Sentry, onError, kein Download, false", async () => {
    mockToBlob(() =>
      Promise.resolve({
        arrayBuffer: async () => new ArrayBuffer(1),
      } as unknown as Blob),
    );
    const error = new Error("Beleg passt nicht");
    const onError = jest.fn();

    const isDownloaded = await generateAndDownloadPdf(
      PDF_ELEMENT,
      "Abrechnung.pdf",
      onError,
      undefined,
      () => Promise.reject(error),
    );

    expect(isDownloaded).toBe(false);
    expect(fileSaver.saveAs).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      extra: {filename: "Abrechnung.pdf"},
    });
    expect(onError).toHaveBeenCalledWith(error);
  });

  test("Element aus einer Funktion: wird erst erzeugt, dann gezeichnet", async () => {
    mockToBlob(() => Promise.resolve(new Blob(["%PDF"])));
    const createElement = jest.fn(async () => PDF_ELEMENT);

    const isDownloaded = await generateAndDownloadPdf(
      createElement,
      "Abrechnung.pdf",
    );

    expect(isDownloaded).toBe(true);
    expect(createElement).toHaveBeenCalledTimes(1);
    expect(mockedPdf).toHaveBeenCalledWith(PDF_ELEMENT);
  });

  test("Funktion wirft: Sentry, onError, nichts gezeichnet, false", async () => {
    const error = new Error("Durchlauf 1 gescheitert");
    const onError = jest.fn();

    const isDownloaded = await generateAndDownloadPdf(
      () => Promise.reject(error),
      "Abrechnung.pdf",
      onError,
    );

    expect(isDownloaded).toBe(false);
    expect(mockedPdf).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      extra: {filename: "Abrechnung.pdf"},
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
