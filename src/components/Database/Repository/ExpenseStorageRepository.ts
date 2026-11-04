/**
 * Storage-Repository für Ausgaben-Belege.
 *
 * Speichert Belege im privaten `receipts`-Bucket, Zugriff nur über signierte
 * Links (`getSignedUrl`), weil Belege Personendaten enthalten können. Pfad ist
 * `events/{eventId}/expenses/{expenseId}.{ext}` — genau ein Beleg pro
 * Ausgabe, der Dateiname ist die `expenseId` selbst (eindeutig, kein
 * zusätzlicher Unterordner nötig).
 *
 * @example
 * const repo = new ExpenseStorageRepository();
 * const result = await repo.upload(`${eventId}/expenses/${expenseId}.pdf`, file, "application/pdf");
 */
import {StorageRepository} from "./StorageRepository";

export class ExpenseStorageRepository extends StorageRepository {
  bucketName = "receipts";
  folderPath = "events/";
}
