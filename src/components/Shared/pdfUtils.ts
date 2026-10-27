import {pdf} from "@react-pdf/renderer";
import fileSaver from "file-saver";
import * as Sentry from "@sentry/react";

/**
 * Generiert ein PDF als Blob und speichert es als Datei.
 *
 * Zentralisiert die PDF-Generierung und Fehlerbehandlung, damit alle
 * PDF-Exporte einheitlich funktionieren und Fehler via Sentry geloggt werden.
 *
 * @param pdfElement - Das React-Element für @react-pdf/renderer, oder eine
 *                     Funktion, die es erst erzeugt (z.B. nach einem ersten
 *                     Durchlauf für Seitenzahlen). Wirft sie, gilt das wie
 *                     ein Fehler beim Erstellen.
 * @param filename - Der Dateiname für den Download (inkl. .pdf-Suffix).
 * @param onError - Optionaler Callback für Fehlerbehandlung in der aufrufenden Komponente
 *                  (z.B. Dispatch an Reducer für AlertMessage).
 * @param sentryContext - Optionaler zusätzlicher Kontext für Sentry (z.B. eventUid).
 * @param transformPdf - Optionaler Zwischenschritt zwischen Erstellen und
 *                       Speichern, z.B. PDF-Belege einsetzen (Abrechnung).
 *                       Wirft er, gilt das wie ein Fehler beim Erstellen.
 * @returns `true`, wenn der Download gestartet wurde; `false` nach einem
 *          Fehler (Sentry und `onError` sind dann bereits informiert).
 * @example
 * generateAndDownloadPdf(
 *   <MenuplanPdf event={event} menuplan={menuplan} authUser={authUser} />,
 *   "Menueplan Sommerlager.pdf",
 *   (error) => dispatch({type: ReducerActions.GENERIC_ERROR, payload: error}),
 * );
 */
export const generateAndDownloadPdf = async (
  pdfElement: React.ReactElement | (() => Promise<React.ReactElement>),
  filename: string,
  onError?: (error: Error) => void,
  sentryContext?: Record<string, unknown>,
  transformPdf?: (bytes: Uint8Array) => Promise<Uint8Array>,
): Promise<boolean> => {
  try {
    const element =
      typeof pdfElement === "function" ? await pdfElement() : pdfElement;
    const blob = await pdf(element).toBlob();
    fileSaver.saveAs(
      transformPdf ? await transformPdfBlob(blob, transformPdf) : blob,
      filename,
    );
    return true;
  } catch (thrown) {
    const error = thrown instanceof Error ? thrown : new Error(String(thrown));
    Sentry.captureException(error, {
      extra: {filename, ...sentryContext},
    });
    onError?.(error);
    return false;
  }
};

/**
 * Wendet einen Zwischenschritt auf ein fertiges PDF an: Blob → Bytes →
 * Zwischenschritt → wieder ein Blob zum Speichern.
 *
 * @param blob - Das PDF aus react-pdf.
 * @param transformPdf - Der Zwischenschritt.
 * @returns Das veränderte PDF als Blob.
 */
const transformPdfBlob = async (
  blob: Blob,
  transformPdf: (bytes: Uint8Array) => Promise<Uint8Array>,
): Promise<Blob> => {
  const bytes = await transformPdf(new Uint8Array(await blob.arrayBuffer()));
  // pdf-lib liefert nie einen SharedArrayBuffer; die Typisierung erlaubt
  // ihn nur theoretisch. Der Cast spart eine Kopie des ganzen PDFs.
  return new Blob([bytes as Uint8Array<ArrayBuffer>], {
    type: "application/pdf",
  });
};
