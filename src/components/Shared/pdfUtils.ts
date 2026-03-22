import {pdf} from "@react-pdf/renderer";
import fileSaver from "file-saver";
import * as Sentry from "@sentry/react";

/**
 * Generiert ein PDF als Blob und speichert es als Datei.
 *
 * Zentralisiert die PDF-Generierung und Fehlerbehandlung, damit alle
 * PDF-Exporte einheitlich funktionieren und Fehler via Sentry geloggt werden.
 *
 * @param pdfElement - Das React-Element für @react-pdf/renderer.
 * @param filename - Der Dateiname für den Download (inkl. .pdf-Suffix).
 * @param onError - Optionaler Callback für Fehlerbehandlung in der aufrufenden Komponente
 *                  (z.B. Dispatch an Reducer für AlertMessage).
 * @param sentryContext - Optionaler zusätzlicher Kontext für Sentry (z.B. eventUid).
 * @example
 * generateAndDownloadPdf(
 *   <MenuplanPdf event={event} menuplan={menuplan} authUser={authUser} />,
 *   "Menueplan Sommerlager.pdf",
 *   (error) => dispatch({type: ReducerActions.GENERIC_ERROR, payload: error}),
 * );
 */
export const generateAndDownloadPdf = async (
  pdfElement: React.ReactElement,
  filename: string,
  onError?: (error: Error) => void,
  sentryContext?: Record<string, unknown>,
): Promise<void> => {
  try {
    const blob = await pdf(pdfElement).toBlob();
    fileSaver.saveAs(blob, filename);
  } catch (thrown) {
    const error =
      thrown instanceof Error ? thrown : new Error(String(thrown));
    Sentry.captureException(error, {
      extra: {filename, ...sentryContext},
    });
    onError?.(error);
  }
};
