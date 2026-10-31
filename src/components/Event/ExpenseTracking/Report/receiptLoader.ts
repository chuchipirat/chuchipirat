import {PDFDocument} from "pdf-lib";

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

/**
 * Ein PDF-Beleg ist passwortgeschützt; seine Seiten lassen sich nicht
 * einsetzen. Eigene Klasse, weil `EncryptedPDFError` aus pdf-lib sich
 * nicht erkennen lässt: pdf-lib ist nach ES5 übersetzt, dort liefert
 * `new EncryptedPDFError()` ein gewöhnliches `Error` (weder `instanceof`
 * noch `name` passen).
 */
export class EncryptedReceiptError extends Error {
  /** Erstellt den Fehler mit fester Meldung. */
  constructor() {
    super("PDF-Beleg ist passwortgeschützt.");
    this.name = "EncryptedReceiptError";
  }
}

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
 * @param onProgress - Wird nach jedem geladenen Bild oder PDF aufgerufen.
 * @param fetchBlob - Lädt eine Datei; Standard: `fetch`. Für Tests ersetzbar.
 * @param prepareImage - Verkleinert ein Bild und liefert eine Data-URL;
 *   Standard: `resizeImage` + `FileReader`. Für Tests ersetzbar.
 * @param preparePdf - Liest ein PDF als Bytes und zählt seine Seiten;
 *   Standard: `pdf-lib`. Für Tests ersetzbar.
 */
export type ReceiptLoaderDependencies = {
  getAttachmentUrl: (attachmentPath: string) => string;
  onProgress: (progress: ReportProgress) => void;
  fetchBlob?: (url: string) => Promise<Blob>;
  prepareImage?: (blob: Blob) => Promise<string>;
  preparePdf?: (blob: Blob) => Promise<PreparedPdf>;
};

/**
 * Ergebnis von `preparePdf`.
 *
 * @param bytes - Inhalt der PDF-Datei.
 * @param pageCount - Anzahl Seiten (mindestens 1).
 */
export type PreparedPdf = {bytes: Uint8Array; pageCount: number};

/**
 * Alle Abhängigkeiten, die ein einzelner Beleg zum Laden braucht, mit
 * gesetzten Standardwerten.
 */
type ReceiptPreparers = Required<Omit<ReceiptLoaderDependencies, "onProgress">>;

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
    preparePdf = prepareReceiptPdf,
  }: ReceiptLoaderDependencies,
): Promise<LoadedReceipt[]> => {
  const preparers = {getAttachmentUrl, fetchBlob, prepareImage, preparePdf};
  const total = receipts.filter(isDownloadableReceipt).length;
  let loaded = 0;
  if (total > 0) {
    onProgress({stage: "loading", loaded, total});
  }

  const loadedReceipts: LoadedReceipt[] = [];
  // nacheinander statt Promise.all: viele Handyfotos gleichzeitig
  // dekodiert sprengen auf dem Handy den Speicher
  for (const receipt of receipts) {
    loadedReceipts.push(await loadReceipt(receipt, preparers));
    if (isDownloadableReceipt(receipt)) {
      loaded += 1;
      onProgress({stage: "loading", loaded, total});
    }
  }
  return loadedReceipts;
};

/**
 * `true` für Belege, die heruntergeladen werden (Bilder und PDFs). Nur sie
 * zählen im Fortschritt; Leerseiten brauchen keinen Download.
 *
 * @param receipt - Der Beleg.
 * @returns `true` bei einem Bild- oder PDF-Beleg.
 */
const isDownloadableReceipt = (receipt: ReportReceipt): boolean =>
  receipt.attachmentPath !== null &&
  getReceiptFileKind(receipt.attachmentPath) !== "unknown";

/**
 * Lädt einen einzelnen Beleg. Ohne Beleg oder mit unbekannter Endung gibt
 * es nichts herunterzuladen; alles andere übernimmt {@link downloadReceipt}.
 *
 * @param receipt - Der Beleg.
 * @param preparers - Siehe {@link ReceiptPreparers}.
 * @returns Der fertige Eintrag.
 */
const loadReceipt = async (
  receipt: ReportReceipt,
  preparers: ReceiptPreparers,
): Promise<LoadedReceipt> => {
  if (receipt.attachmentPath === null) {
    return {kind: "missing", receipt};
  }
  const fileKind = getReceiptFileKind(receipt.attachmentPath);
  if (fileKind === "unknown") {
    return {kind: "failed", receipt, error: new Error("Unbekannter Belegtyp")};
  }
  return downloadReceipt(receipt, receipt.attachmentPath, fileKind, preparers);
};

/**
 * Lädt die Datei eines Belegs herunter und bereitet sie je nach Art auf.
 * Fängt jeden Fehler ab (Netz, HTTP-Status, kaputte Datei, Passwortschutz):
 * Der Beleg wird dann zu `failed`, die übrigen laden weiter.
 *
 * @param receipt - Der Beleg.
 * @param attachmentPath - Pfad des Belegs im Storage.
 * @param fileKind - Bild oder PDF.
 * @param preparers - Siehe {@link ReceiptPreparers}.
 * @returns Der fertige Eintrag oder `failed`.
 */
const downloadReceipt = async (
  receipt: ReportReceipt,
  attachmentPath: string,
  fileKind: Exclude<ReceiptFileKind, "unknown">,
  {getAttachmentUrl, fetchBlob, prepareImage, preparePdf}: ReceiptPreparers,
): Promise<LoadedReceipt> => {
  try {
    const blob = await fetchBlob(getAttachmentUrl(attachmentPath));
    return fileKind === "image"
      ? {kind: "image", receipt, dataUrl: await prepareImage(blob)}
      : {kind: "pdf", receipt, ...(await preparePdf(blob))};
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
export const fetchReceiptBlob = async (url: string): Promise<Blob> => {
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
 * Liest ein PDF als Bytes und zählt seine Seiten. Bei einer Ausnahme wird
 * der Beleg zu `failed`.
 *
 * @param blob - Die PDF-Datei.
 * @returns Bytes und Seitenzahl.
 * @throws {EncryptedReceiptError} Wenn das PDF passwortgeschützt ist.
 * @throws {Error} Wenn das PDF nicht lesbar ist oder keine Seite hat.
 */
const prepareReceiptPdf = async (blob: Blob): Promise<PreparedPdf> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // ignoreEncryption + selbst prüfen: so entsteht ein erkennbarer Fehler
  const pdfDocument = await PDFDocument.load(bytes, {ignoreEncryption: true});
  if (pdfDocument.isEncrypted) {
    throw new EncryptedReceiptError();
  }
  const pageCount = pdfDocument.getPageCount();
  if (pageCount === 0) {
    // ohne Seite würde der Beleg im PDF einfach fehlen
    throw new Error("PDF-Beleg hat keine Seite.");
  }
  return {bytes, pageCount};
};

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
