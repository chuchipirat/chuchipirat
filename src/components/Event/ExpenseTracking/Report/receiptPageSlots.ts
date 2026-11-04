import {LoadedReceipt, ReceiptPageSlot} from "./expenseReport.types";

/**
 * Macht aus den geladenen Belegen die Liste der Belegseiten (Story 7.3b,
 * C3): ein Eintrag pro Seite. react-pdf zeichnet genau diese Liste,
 * `embedPdfReceipts` läuft genau diese Liste ab; darum liegt jede Seite
 * eines PDF-Belegs im richtigen Feld.
 *
 * @param loadedReceipts - Belege in Nummernreihenfolge.
 * @returns Belegseiten in derselben Reihenfolge; ein PDF-Beleg mit k Seiten
 *   ergibt k Einträge, alle anderen genau einen.
 * @example
 * getReceiptPageSlots([image, pdfWithTwoPages]).map(
 *   (slot) => `${slot.pageNumber}/${slot.pageCount}`,
 * ) // ["1/1", "1/2", "2/2"]
 */
export const getReceiptPageSlots = (
  loadedReceipts: LoadedReceipt[],
): ReceiptPageSlot[] =>
  loadedReceipts.flatMap((loadedReceipt) => {
    const pageCount =
      loadedReceipt.kind === "pdf" ? loadedReceipt.pageCount : 1;
    return Array.from({length: pageCount}, (_unused, index) => ({
      loadedReceipt,
      pageNumber: index + 1,
      pageCount,
    }));
  });
