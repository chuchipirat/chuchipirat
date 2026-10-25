import {resizeImage} from "../../../Shared/imageResize";
import {toError} from "../../../../utils/errorUtils";
import {ATTACHMENT_MIME_TO_EXTENSION} from "../Expense/expense.types";
import {
  LoadedReceipt,
  ReportProgress,
  ReportReceipt,
} from "./expenseReport.types";

/** Längste Bildseite im PDF: gut lesbar, klein genug für den Mailversand. */
const RECEIPT_IMAGE_MAX_DIMENSION = 2000;
/** JPEG-Qualität der Belegbilder. */
const RECEIPT_IMAGE_QUALITY = 0.8;

/** Art einer Belegdatei, abgeleitet aus der Dateiendung. */
export type ReceiptFileKind = "image" | "pdf" | "unknown";

/**
 * Erkennt die Art eines Belegs an der Dateiendung. Die Endung vergibt die
 * App beim Upload selbst (`ATTACHMENT_MIME_TO_EXTENSION`), sie ist daher
 * verlässlicher als der `Content-Type` einer Antwort.
 *
 * @param attachmentPath - Pfad des Belegs im Storage.
 * @returns `"image"`, `"pdf"` oder `"unknown"`.
 * @example
 * getReceiptFileKind("evt-1/expenses/exp-1.jpg") // "image"
 */
export const getReceiptFileKind = (attachmentPath: string): ReceiptFileKind => {
  const extension = attachmentPath.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = Object.keys(ATTACHMENT_MIME_TO_EXTENSION).find(
    (mime) => ATTACHMENT_MIME_TO_EXTENSION[mime] === extension,
  );
  if (mimeType === undefined) {
    return "unknown";
  }
  return mimeType === "application/pdf" ? "pdf" : "image";
};

/**
 * Abhängigkeiten von {@link loadReceipts}.
 *
 * @param getAttachmentUrl - Liefert die URL eines Belegs (von der Seite,
 *   damit der Loader die Datenbank nicht kennt).
 * @param onProgress - Wird nach jedem geladenen Bild aufgerufen.
 * @param fetchBlob - Lädt eine Datei; Standard: `fetch`. Für Tests ersetzbar.
 * @param prepareImage - Verkleinert ein Bild und liefert eine Data-URL;
 *   Standard: `resizeImage` + `FileReader`. Für Tests ersetzbar.
 */
export type ReceiptLoaderDependencies = {
  getAttachmentUrl: (attachmentPath: string) => string;
  onProgress: (progress: ReportProgress) => void;
  fetchBlob?: (url: string) => Promise<Blob>;
  prepareImage?: (blob: Blob) => Promise<string>;
};

/**
 * Lädt alle Belege des Anhangs, nacheinander und in Nummernreihenfolge.
 * Wirft nicht wegen eines einzelnen Belegs: Ein Fehler wird zu
 * `{kind: "failed"}` und im PDF zur Fehlerseite.
 *
 * @param receipts - Belege aus `ExpenseReportData.receipts`.
 * @param dependencies - Siehe {@link ReceiptLoaderDependencies}.
 * @returns Ein Eintrag pro Beleg, gleiche Reihenfolge.
 * @example
 * const loadedReceipts = await loadReceipts(report.receipts, {
 *   getAttachmentUrl,
 *   onProgress: setProgress,
 * });
 */
export const loadReceipts = async (
  receipts: ReportReceipt[],
  {
    getAttachmentUrl,
    onProgress,
    fetchBlob = fetchReceiptBlob,
    prepareImage = prepareReceiptImage,
  }: ReceiptLoaderDependencies,
): Promise<LoadedReceipt[]> => {
  const total = receipts.filter(isImageReceipt).length;
  let loaded = 0;
  if (total > 0) {
    onProgress({stage: "loading", loaded, total});
  }

  const loadedReceipts: LoadedReceipt[] = [];
  // nacheinander statt Promise.all: viele Handyfotos gleichzeitig
  // dekodiert sprengen auf dem Handy den Speicher
  for (const receipt of receipts) {
    loadedReceipts.push(
      await loadReceipt(receipt, getAttachmentUrl, fetchBlob, prepareImage),
    );
    if (isImageReceipt(receipt)) {
      loaded += 1;
      onProgress({stage: "loading", loaded, total});
    }
  }
  return loadedReceipts;
};

/**
 * `true` für Belege, die geladen werden müssen (Bilder). Leerseiten und
 * PDF-Belege brauchen keinen Download.
 *
 * @param receipt - Der Beleg.
 * @returns `true` bei einem Bild-Beleg.
 */
const isImageReceipt = (receipt: ReportReceipt): boolean =>
  receipt.attachmentPath !== null &&
  getReceiptFileKind(receipt.attachmentPath) === "image";

/**
 * Lädt einen einzelnen Beleg. Fängt jeden Fehler ab.
 *
 * @param receipt - Der Beleg.
 * @param getAttachmentUrl - URL eines Belegs.
 * @param fetchBlob - Lädt die Datei.
 * @param prepareImage - Verkleinert das Bild zur Data-URL.
 * @returns Der fertige Eintrag.
 */
const loadReceipt = async (
  receipt: ReportReceipt,
  getAttachmentUrl: (attachmentPath: string) => string,
  fetchBlob: (url: string) => Promise<Blob>,
  prepareImage: (blob: Blob) => Promise<string>,
): Promise<LoadedReceipt> => {
  if (receipt.attachmentPath === null) {
    return {kind: "missing", receipt};
  }
  const fileKind = getReceiptFileKind(receipt.attachmentPath);
  if (fileKind === "pdf") {
    return {kind: "pdfPending", receipt};
  }
  if (fileKind === "unknown") {
    return {
      kind: "failed",
      receipt,
      error: new Error("Unbekannter Belegtyp"),
    };
  }
  try {
    const blob = await fetchBlob(getAttachmentUrl(receipt.attachmentPath));
    return {kind: "image", receipt, dataUrl: await prepareImage(blob)};
  } catch (error) {
    return {kind: "failed", receipt, error: toError(error)};
  }
};

/**
 * Lädt eine Datei. `fetch` wirft nur bei Netzfehlern; ein 404 (Beleg
 * gelöscht) muss über `response.ok` selbst auffallen.
 *
 * @param url - URL der Datei.
 * @returns Die Datei als Blob.
 * @throws {Error} Bei einem HTTP-Fehler.
 */
const fetchReceiptBlob = async (url: string): Promise<Blob> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Beleg nicht abrufbar (HTTP ${response.status})`);
  }
  return response.blob();
};

/**
 * Verkleinert ein Bild und liefert es als Data-URL für `<Image>`.
 *
 * @param blob - Das Originalbild.
 * @returns Data-URL eines JPEG.
 */
const prepareReceiptImage = async (blob: Blob): Promise<string> =>
  blobToDataUrl(
    await resizeImage(blob, RECEIPT_IMAGE_MAX_DIMENSION, RECEIPT_IMAGE_QUALITY),
  );

/**
 * Liest einen Blob als Data-URL.
 *
 * @param blob - Der Blob.
 * @returns Data-URL, z.B. «data:image/jpeg;base64,…».
 * @throws {Error} Wenn der Blob nicht gelesen werden kann.
 */
const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    // readAsDataURL liefert immer einen String
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error("Beleg konnte nicht gelesen werden."));
    reader.readAsDataURL(blob);
  });
